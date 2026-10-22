"""Offline SQLite/uploads backup and isolated restore. Never imports the app."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import shutil
import sqlite3
import tarfile
from datetime import datetime, timezone


def digest(path):
    with open(path, 'rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def inventory(folder):
    result = {}
    for base, dirs, files in os.walk(folder, followlinks=False):
        for name in dirs + files:
            path = Path(base) / name
            if path.is_symlink():
                raise ValueError('Uploads must not contain symbolic links')
        for name in sorted(files):
            path = Path(base) / name
            if not path.is_file():
                raise ValueError('Uploads must contain regular files only')
            result[path.relative_to(folder).as_posix()] = digest(path)
    return result


def database_info(path):
    with sqlite3.connect(path.resolve().as_uri() + '?mode=ro', uri=True) as connection:
        if connection.execute('PRAGMA integrity_check').fetchall() != [('ok',)]:
            raise ValueError('SQLite integrity check failed')
        tables = [row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
        return {name: connection.execute('SELECT COUNT(*) FROM "' + name.replace('"', '""') + '"').fetchone()[0]
                for name in sorted(tables)}


def backup(database, uploads, destination):
    database, uploads, destination = map(Path, (database, uploads, destination))
    if not database.is_file() or not uploads.is_dir():
        raise ValueError('Source database and uploads must exist')
    destination.mkdir(mode=0o700, parents=False, exist_ok=False)
    # A missing manifest marks an incomplete backup; never overwrite any bundle.
    snapshot = destination / 'database.sqlite3'
    with sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True) as source:
        with sqlite3.connect(snapshot) as target:
            source.backup(target)
    files = inventory(uploads)
    with tarfile.open(destination / 'uploads.tar.gz', 'w:gz') as archive:
        for name in sorted(files):
            archive.add(uploads / name, arcname=name, recursive=False)
    stamp = Path('/app/release_revision.txt')
    manifest = {'version': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'sourceImage': os.environ.get('BACKUP_SOURCE_IMAGE', 'unknown'),
                'sourceRevision': stamp.read_text(encoding='utf-8').strip() if stamp.is_file() else 'legacy/unknown',
                'tables': database_info(snapshot), 'uploads': files,
                'sha256': {name: digest(destination / name) for name in ['database.sqlite3', 'uploads.tar.gz']}}
    (destination / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    return manifest


def restore(source, destination):
    source, destination = Path(source), Path(destination)
    manifest = json.loads((source / 'manifest.json').read_text(encoding='utf-8'))
    if manifest['version'] != 1:
        raise ValueError('Unsupported backup version')
    for name in ['database.sqlite3', 'uploads.tar.gz']:
        if digest(source / name) != manifest['sha256'][name]:
            raise ValueError('Backup checksum mismatch')
    if database_info(source / 'database.sqlite3') != manifest['tables']:
        raise ValueError('Backup database counts mismatch')
    # Preflight the entire archive before creating the destination.
    with tarfile.open(source / 'uploads.tar.gz', 'r:gz') as archive:
        members = archive.getmembers()
        names = set()
        for member in members:
            path = PurePosixPath(member.name)
            if (not member.isfile() or path.is_absolute() or '..' in path.parts
                    or '\\' in member.name or ':' in member.name or member.name in names):
                raise ValueError('Unsafe or duplicate backup archive entry')
            names.add(member.name)
        if names != set(manifest['uploads']):
            raise ValueError('Backup uploads inventory mismatch')
        destination.mkdir(mode=0o700, parents=False, exist_ok=False)
        shutil.copyfile(source / 'database.sqlite3', destination / 'database.sqlite3')
        uploads = destination / 'uploads'
        uploads.mkdir(mode=0o700)
        for member in members:
            output = uploads / member.name
            output.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
            with archive.extractfile(member) as incoming, output.open('xb') as outgoing:
                shutil.copyfileobj(incoming, outgoing)
    if inventory(uploads) != manifest['uploads'] or database_info(destination / 'database.sqlite3') != manifest['tables']:
        raise ValueError('Restored data verification failed')
    return {'database': 'ok', 'uploads': 'ok', 'tables': len(manifest['tables']), 'files': len(manifest['uploads'])}


def main():
    os.umask(0o077)
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    create = commands.add_parser('backup')
    create.add_argument('--database', required=True)
    create.add_argument('--uploads', required=True)
    create.add_argument('--destination', required=True)
    recover = commands.add_parser('restore')
    recover.add_argument('--source', required=True)
    recover.add_argument('--destination', required=True)
    args = vars(parser.parse_args())
    command = args.pop('command')
    result = backup(**args) if command == 'backup' else restore(**args)
    print(json.dumps({'status': 'ok', 'command': command,
                      'verification': result if command == 'restore' else {'tables': len(result['tables']), 'files': len(result['uploads'])}}))


if __name__ == '__main__':
    main()
