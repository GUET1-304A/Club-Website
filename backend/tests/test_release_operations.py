"""Release gates, recovery integrity and dependency-aware readiness."""
import importlib.util
import io
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import tarfile

import pytest

from maintenance import backup, restore, digest


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('release_tools', ROOT / 'scripts/release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)
recovery_spec = importlib.util.spec_from_file_location('recovery_tools', ROOT / 'scripts/recovery.py')
recovery = importlib.util.module_from_spec(recovery_spec)
recovery_spec.loader.exec_module(recovery)


@pytest.fixture
def data(tmp_path):
    database = tmp_path / 'source.db'
    with sqlite3.connect(database) as connection:
        connection.execute('CREATE TABLE examples (value TEXT)')
        connection.executemany('INSERT INTO examples VALUES (?)', [('真实内容',), ('第二条',)])
    uploads = tmp_path / 'uploads'
    uploads.mkdir()
    (uploads / '证明.txt').write_bytes(b'actual upload bytes')
    return database, uploads


def test_backup_and_restore_compare_database_rows_and_uploaded_bytes(tmp_path, data):
    database, uploads = data
    bundle = tmp_path / 'bundle'
    manifest = backup(database, uploads, bundle)
    assert manifest['tables'] == {'examples': 2}
    result = restore(bundle, tmp_path / 'restored')
    assert result['database'] == result['uploads'] == 'ok'
    assert (tmp_path / 'restored/uploads/证明.txt').read_bytes() == b'actual upload bytes'
    with sqlite3.connect(tmp_path / 'restored/database.sqlite3') as connection:
        assert connection.execute('SELECT value FROM examples ORDER BY rowid').fetchall() == [('真实内容',), ('第二条',)]


def test_corrupted_or_existing_backup_never_overwrites_data(tmp_path, data):
    bundle = tmp_path / 'bundle'
    backup(*data, bundle)
    with pytest.raises(FileExistsError):
        backup(*data, bundle)
    destination = tmp_path / 'existing'
    destination.mkdir()
    (destination / 'keep').write_text('keep')
    with pytest.raises(FileExistsError):
        restore(bundle, destination)
    with (bundle / 'database.sqlite3').open('ab') as stream:
        stream.write(b'corrupt')
    with pytest.raises(ValueError, match='checksum'):
        restore(bundle, tmp_path / 'bad')
    assert not (tmp_path / 'bad').exists()
    assert (destination / 'keep').read_text() == 'keep'


@pytest.mark.parametrize('name,kind', [('../escape', 'file'), ('/absolute', 'file'),
                                    ('link', 'symlink'), ('C:\\escape', 'file')])
def test_restore_rejects_unsafe_archives_even_with_matching_checksum(tmp_path, data, name, kind):
    bundle = tmp_path / 'bundle'
    backup(*data, bundle)
    with tarfile.open(bundle / 'uploads.tar.gz', 'w:gz') as archive:
        entry = tarfile.TarInfo(name)
        if kind == 'symlink':
            entry.type = tarfile.SYMTYPE
            entry.linkname = '/outside'
            archive.addfile(entry)
        else:
            entry.size = 1
            archive.addfile(entry, io.BytesIO(b'x'))
    manifest = json.loads((bundle / 'manifest.json').read_text())
    manifest['sha256']['uploads.tar.gz'] = digest(bundle / 'uploads.tar.gz')
    manifest['uploads'] = {name: 'ignored'}
    (bundle / 'manifest.json').write_text(json.dumps(manifest))
    with pytest.raises(ValueError, match='Unsafe'):
        restore(bundle, tmp_path / 'restored')
    assert not (tmp_path / 'restored').exists()


def test_committed_repository_gate_rejects_untracked_files(tmp_path):
    def git(*args):
        subprocess.run(['git', '-C', str(tmp_path), *args], check=True, capture_output=True)
    git('init', '-b', 'main')
    git('config', 'user.email', 'fixture@example.invalid')
    git('config', 'user.name', 'Release Test')
    files = ['scripts/release.py', 'scripts/recovery.py', 'scripts/deploy-remote.sh',
             'backend/maintenance.py', 'backend/services/readiness.py',
             'frontendnew/scripts/build-metadata.mjs', 'deploy/frontend/20-publish-bundle.sh',
             'deploy/nginx/frontend-proxy.inc', 'docker-compose.prod.yml', 'docker-compose.prod.tls.yml']
    for name in files:
        path = tmp_path / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text('fixture\n')
    git('add', '.')
    git('-c', 'core.hooksPath=/dev/null', 'commit', '-m', 'fixture')
    assert len(release.validate_repository(tmp_path)) == 40
    (tmp_path / 'forgotten.py').write_text('not in the release')
    with pytest.raises(ValueError, match='untracked'):
        release.validate_repository(tmp_path)


@pytest.fixture
def ready_bundle(app, tmp_path, monkeypatch):
    monkeypatch.setattr(app, 'root_path', str(tmp_path))
    (tmp_path / 'release_revision.txt').write_text('abc123')
    (tmp_path / 'assets').mkdir()
    (tmp_path / 'assets/app.js').write_text('app')
    manifest = tmp_path / 'metadata.json'
    manifest.write_text(json.dumps({'version': 1, 'revision': 'abc123', 'routes': {'/': {'title': 'Home'}},
                                    'template': '<head><script src="/assets/app.js"></script></head>'}))
    monkeypatch.setitem(app.config, 'FRONTEND_METADATA_FILE', str(manifest))
    return tmp_path, manifest


def test_readiness_checks_database_bundle_revision_and_asset(client, ready_bundle):
    folder, manifest = ready_bundle
    response = client.get('/health/ready')
    assert response.status_code == 200
    assert response.json == {'status': 'ok', 'revision': 'abc123', 'checks': {'database': 'ok', 'frontend': 'ok'}}
    (folder / 'assets/app.js').unlink()
    assert client.get('/health/ready').status_code == 503
    assert client.get('/health').status_code == 200


def test_readiness_rejects_previous_frontend_revision(client, ready_bundle):
    _, manifest = ready_bundle
    data = json.loads(manifest.read_text())
    data['revision'] = 'previous'
    manifest.write_text(json.dumps(data))
    assert client.get('/health/ready').status_code == 503


def test_readiness_rejects_database_failure(app, client, ready_bundle, monkeypatch):
    from models import db
    def fail(*args, **kwargs):
        raise RuntimeError('private connection details')
    monkeypatch.setattr(db.session, 'execute', fail)
    response = client.get('/health/ready')
    assert response.status_code == 503
    assert response.json['checks']['database'] == 'error'
    assert b'private' not in response.data


def test_smoke_rejects_old_version_before_testing_any_pages(monkeypatch):
    monkeypatch.setattr(release, 'fetch', lambda *args: (200, {}, json.dumps(
        {'revision': 'old', 'checks': {'database': 'ok', 'frontend': 'ok'}}).encode()))
    with pytest.raises(ValueError, match='version'):
        release.smoke('https://example.test', 'new')


def test_production_origin_rejects_credentials_paths_and_queries():
    for value in ['https://user:secret@example.com', 'https://example.com/path', 'javascript:alert(1)',
                  'https://example.com?token=secret']:
        with pytest.raises(ValueError):
            release.origin(value)


@pytest.fixture
def storage_config():
    environment = {'DATABASE_URL': 'sqlite:////app/data/site.db', 'UPLOAD_FOLDER': '/app/uploads'}
    data = {'services': {'backend': {'environment': environment, 'volumes': [
        {'type': 'volume', 'source': 'db', 'target': '/app/data'},
        {'type': 'volume', 'source': 'uploads', 'target': '/app/uploads'}]}},
        'volumes': {'db': {'name': 'actual_db'}, 'uploads': {'name': 'actual_uploads'}}}
    info = {'Config': {'Env': [key + '=' + value for key, value in environment.items()]}, 'Mounts': [
        {'Type': 'volume', 'Name': 'actual_db', 'Destination': '/app/data'},
        {'Type': 'volume', 'Name': 'actual_uploads', 'Destination': '/app/uploads'}]}
    return data, info


def test_release_keeps_actual_storage(storage_config):
    release.validate_existing_storage(*storage_config)


@pytest.mark.parametrize('change', ['database', 'uploads', 'volume', 'nested-mount', 'oss'])
def test_release_refuses_unplanned_data_switch(storage_config, change):
    data, info = storage_config
    if change == 'database':
        data['services']['backend']['environment']['DATABASE_URL'] = 'sqlite:////app/data/empty.db'
    elif change == 'uploads':
        data['services']['backend']['environment']['UPLOAD_FOLDER'] = '/app/uploads/new'
    elif change == 'volume':
        data['volumes']['db']['name'] = 'empty_db'
    elif change == 'nested-mount':
        info['Mounts'].append({'Type': 'volume', 'Name': 'hidden_db', 'Destination': '/app/data/site.db'})
    else:
        info['Config']['Env'].append('OSS_ENABLED=true')
    with pytest.raises(ValueError, match='changed|storage'):
        release.validate_existing_storage(data, info)


def test_backup_refuses_external_storage_before_stopping_writer(tmp_path, monkeypatch):
    calls = []
    info = {'Config': {'Env': ['OSS_ENABLED=true']}}
    monkeypatch.setattr(recovery, 'container_info', lambda args: ('backend', info))
    monkeypatch.setattr(recovery, 'run', lambda *args: calls.append(args))
    with pytest.raises(ValueError, match='OSS'):
        recovery.backup(['docker', 'compose'], tmp_path, tmp_path / 'helper.py')
    assert calls == []
    assert not (tmp_path / '.backup.lock').exists()


def test_failed_backup_restarts_original_backend_and_removes_own_lock(tmp_path, monkeypatch):
    calls = []
    info = {'Config': {'Env': ['DATABASE_URL=sqlite:////app/data/test.db', 'UPLOAD_FOLDER=/app/uploads']},
            'Mounts': [{'Destination': '/app/data'}, {'Destination': '/app/uploads'}],
            'State': {'Running': True}, 'Image': 'sha256:old-image'}
    monkeypatch.setattr(recovery, 'container_info', lambda args: ('old-container', info))
    def run(args, capture=False):
        calls.append(args)
        if args[:2] == ['docker', 'run']:
            assert '--network' in args and 'old-container:ro' in args
            raise RuntimeError('simulated disk failure')
    monkeypatch.setattr(recovery, 'run', run)
    with pytest.raises(RuntimeError, match='disk failure'):
        recovery.backup(['docker', 'compose'], tmp_path, tmp_path / 'helper.py')
    assert calls[-1] == ['docker', 'compose', 'start', 'backend']
    assert not (tmp_path / '.backup.lock').exists()


@pytest.mark.skipif(os.name == 'nt', reason='Remote bash behavior is exercised in Linux CI/container')
@pytest.mark.parametrize('failure', ['build', 'smoke', 'orphan'])
def test_remote_failures_do_not_accept_or_advance_release(tmp_path, failure):
    scripts = tmp_path / 'release/scripts'
    scripts.mkdir(parents=True)
    script = scripts / 'deploy-remote.sh'
    script.write_bytes((ROOT / 'scripts/deploy-remote.sh').read_bytes())
    base = tmp_path / 'installation'
    base.mkdir()
    (base / 'current-release').write_text('previous-release\n')
    (scripts.parent / 'compose.release.json').write_text(json.dumps({'volumes': {
        key: {'name': key} for key in ['db_data_prod', 'upload_data_prod']}}))
    executables = tmp_path / 'bin'
    executables.mkdir()
    docker = executables / 'docker'
    docker.write_text('''#!/bin/sh
echo "docker $*" >> "$QA_LOG"
case "$*" in
  *"ps -a -q backend") [ "$QA_FAIL" = orphan ] || echo existing-container ;;
  *" build") [ "$QA_FAIL" != build ] || exit 27 ;;
esac
exit 0
''')
    python = executables / 'python3'
    python.write_text('''#!/bin/sh
echo "python $*" >> "$QA_LOG"
case "$*" in
  *release-python-ok*) echo release-python-ok ;;
  *" smoke "*) [ "$QA_FAIL" != smoke ] || exit 23 ;;
  -c*) echo orphan-volume ;;
esac
exit 0
''')
    docker.chmod(0o755)
    python.chmod(0o755)
    env = {**os.environ, 'PATH': str(executables) + os.pathsep + os.environ['PATH'],
           'QA_LOG': str(tmp_path / 'calls'), 'QA_FAIL': failure, 'RELEASE_PYTHON': 'python3'}
    result = subprocess.run(['bash', str(script), str(base), 'test-project', 'a' * 40,
                             'https://example.test', 'first' if failure == 'orphan' else 'existing'],
                            env=env, capture_output=True, text=True)
    assert result.returncode != 0
    assert (base / 'current-release').read_text() == 'previous-release\n'
    calls = (tmp_path / 'calls').read_text()
    if failure in ['build', 'orphan']:
        assert 'up -d' not in calls and 'backup --output' not in calls


@pytest.mark.skipif(os.name == 'nt', reason='Remote interpreter selection runs on Linux')
def test_runtime_uses_parallel_python_without_replacing_old_system_command(tmp_path):
    old = tmp_path / 'python3'
    old.write_text('#!/bin/sh\nexit 1\n')
    supported = tmp_path / 'python3.11'
    supported.write_text('''#!/bin/sh
case "$*" in
  *release-python-ok*) echo release-python-ok ;;
  --version) echo 'Python 3.11.13' ;;
esac
''')
    old.chmod(0o755)
    supported.chmod(0o755)
    env = {**os.environ, 'PATH': str(tmp_path) + os.pathsep + os.environ['PATH']}
    env.pop('RELEASE_PYTHON', None)
    command = ['bash', str(ROOT / 'scripts/deploy-remote.sh'), '--check-runtime']
    result = subprocess.run(command, env=env, capture_output=True, text=True)
    assert result.returncode == 0
    assert str(supported) in result.stdout and 'Python 3.11.13' in result.stdout
    assert old.read_text() == '#!/bin/sh\nexit 1\n'
    # Explicit unsupported overrides must fail, rather than silently fall back.
    result = subprocess.run(command, env={**env, 'RELEASE_PYTHON': str(old)}, capture_output=True, text=True)
    assert result.returncode != 0 and 'Python 3.9+' in result.stderr


@pytest.mark.skipif(os.name == 'nt', reason='Remote interpreter selection runs on Linux')
def test_invalid_explicit_runtime_fails_before_acquiring_deploy_lock(tmp_path):
    not_python = tmp_path / 'not-python'
    not_python.write_text('#!/bin/sh\nexit 0\n')
    not_python.chmod(0o755)
    result = subprocess.run(['bash', str(ROOT / 'scripts/deploy-remote.sh'), str(tmp_path)],
        env={**os.environ, 'RELEASE_PYTHON': str(not_python)}, capture_output=True, text=True)
    assert result.returncode != 0 and 'Python 3.9+' in result.stderr
    assert not (tmp_path / '.deploy.lock').exists()
