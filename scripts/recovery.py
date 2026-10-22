"""Quiesce one Compose backend, back up read-only mounts and rehearse off-line."""
import argparse
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import uuid
from datetime import datetime, timezone


def run(args, capture=False):
    return subprocess.run(args, check=True, text=True, encoding='utf-8', capture_output=capture).stdout


def container_info(compose):
    identifier = run(compose + ['ps', '-a', '-q', 'backend'], True).strip()
    if not identifier or '\n' in identifier:
        raise ValueError('Expected exactly one existing backend container')
    info = json.loads(run(['docker', 'inspect', identifier], True))[0]
    return identifier, info


def backup(compose, folder, helper):
    folder = Path(folder).resolve()
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    lock = folder / '.backup.lock'
    # Crashes leave a lock for the operator to inspect, rather than allowing
    # overlapping backups to restart another backup's paused writer.
    with lock.open('x', encoding='utf-8') as stream:
        stream.write(str(os.getpid()))
    try:
        return _backup(compose, folder, helper)
    finally:
        lock.unlink()


def _backup(compose, folder, helper):
    identifier, info = container_info(compose)
    env = dict(item.split('=', 1) for item in info['Config']['Env'] if '=' in item)
    if env.get('OSS_ENABLED', 'false').lower() in ('true', '1', 'yes', 'on'):
        raise ValueError('OSS storage requires a separate provider-native backup workflow')
    url = env.get('DATABASE_URL', '')
    if not url.startswith('sqlite:////') or '?' in url or '#' in url:
        raise ValueError('This backup supports absolute SQLite URLs only; use native tools for other databases')
    database = url[len('sqlite:///'):]
    uploads = env.get('UPLOAD_FOLDER', '/app/uploads')
    for path in [database, uploads]:
        if not PurePosixPath(path).is_absolute() or '..' in PurePosixPath(path).parts:
            raise ValueError('Database and uploads must use normalized absolute paths')
        if not any(PurePosixPath(path).is_relative_to(PurePosixPath(m['Destination'])) for m in info['Mounts']):
            raise ValueError('Database and uploads must be in persistent mounts')
    folder = Path(folder).resolve()
    folder.mkdir(mode=0o700, parents=True, exist_ok=True)
    name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
    was_running = info['State']['Running']
    # Mark the restart obligation before stop, so a partially failed stop is
    # still recovered. No other writer may access these volumes during backup.
    try:
        if was_running:
            run(compose + ['stop', '-t', '30', 'backend'])
        run(['docker', 'run', '--rm', '--network', 'none', '--volumes-from', identifier + ':ro',
             '-e', 'BACKUP_SOURCE_IMAGE=' + info['Image'],
             '--mount', f'type=bind,source={folder},target=/backup',
             '--mount', f'type=bind,source={helper},target=/maintenance.py,readonly',
             '--entrypoint', 'python', info['Image'], '/maintenance.py', 'backup',
             '--database', database, '--uploads', uploads, '--destination', '/backup/' + name])
    finally:
        if was_running:
            run(compose + ['start', 'backend'])
    bundle = folder / name
    # Rehearsal has no production volumes and no network, only a read-only
    # backup and a temporary filesystem that disappears with the container.
    rehearse(info['Image'], bundle, helper)
    return bundle


def rehearse(image, bundle, helper):
    run(['docker', 'run', '--rm', '--network', 'none', '--read-only',
         '--tmpfs', '/restore:rw,nosuid,nodev',
         '--mount', f'type=bind,source={Path(bundle).resolve()},target=/backup,readonly',
         '--mount', f'type=bind,source={helper},target=/maintenance.py,readonly',
         '--entrypoint', 'python', image, '/maintenance.py', 'restore',
         '--source', '/backup', '--destination', '/restore/check'])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--project', required=True)
    parser.add_argument('-f', '--file', action='append', required=True)
    parser.add_argument('--env-file')
    commands = parser.add_subparsers(dest='command', required=True)
    create = commands.add_parser('backup')
    create.add_argument('--output', required=True)
    recover = commands.add_parser('rehearse')
    recover.add_argument('--backup', required=True)
    args = parser.parse_args()
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*', args.project):
        parser.error('Invalid Compose project name')
    helper = Path(__file__).resolve().parents[1] / 'backend/maintenance.py'
    compose = ['docker', 'compose', '-p', args.project]
    if args.env_file:
        compose += ['--env-file', str(Path(args.env_file).resolve())]
    for file in args.file:
        compose += ['-f', str(Path(file).resolve())]
    if args.command == 'backup':
        print('Verified backup: ' + str(backup(compose, args.output, helper)))
    else:
        _, info = container_info(compose)
        rehearse(info['Image'], args.backup, helper)


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        raise SystemExit('Recovery failed: ' + str(error)) from None
