from services.reminder_service import start_reminder_scanner


def test_start_reminder_scanner_can_be_disabled(app):
    app.config.update({
        'TESTING': False,
        'REMINDER_SCAN_ENABLED': False,
        'REMINDER_SCHEDULER_BACKEND': 'thread',
    })

    assert start_reminder_scanner(app) is None


def test_start_reminder_scanner_skips_non_leader_instance(app):
    app.config.update({
        'TESTING': False,
        'REMINDER_SCAN_ENABLED': True,
        'REMINDER_SCHEDULER_BACKEND': 'apscheduler',
        'REMINDER_SCHEDULER_LEADER': False,
    })

    assert start_reminder_scanner(app) is None


def test_start_reminder_scanner_uses_thread_backend(app, monkeypatch):
    started = []

    class FakeThread:
        def __init__(self, target, name, daemon):
            self.target = target
            self.name = name
            self.daemon = daemon

        def start(self):
            started.append(self)

    app.config.update({
        'TESTING': False,
        'REMINDER_SCAN_ENABLED': True,
        'REMINDER_SCHEDULER_BACKEND': 'thread',
        'REMINDER_SCHEDULER_LEADER': True,
        'REMINDER_SCAN_INTERVAL': 123,
    })
    monkeypatch.setattr('services.reminder_service.threading.Thread', FakeThread)

    scanner = start_reminder_scanner(app)

    assert scanner.name == 'reminder-scanner'
    assert scanner.daemon is True
    assert started == [scanner]


def test_start_reminder_scanner_uses_apscheduler_backend(app, monkeypatch):
    created = []

    class FakeScheduler:
        def __init__(self, timezone):
            self.timezone = timezone
            self.jobs = []
            self.started = False
            created.append(self)

        def add_job(self, func, trigger, seconds, id, max_instances, coalesce, replace_existing):
            self.jobs.append({
                'func': func,
                'trigger': trigger,
                'seconds': seconds,
                'id': id,
                'max_instances': max_instances,
                'coalesce': coalesce,
                'replace_existing': replace_existing,
            })

        def start(self):
            self.started = True

    app.config.update({
        'TESTING': False,
        'REMINDER_SCAN_ENABLED': True,
        'REMINDER_SCHEDULER_BACKEND': 'apscheduler',
        'REMINDER_SCHEDULER_LEADER': True,
        'REMINDER_SCAN_INTERVAL': 321,
        'REMINDER_SCHEDULER_TIMEZONE': 'Asia/Shanghai',
    })
    monkeypatch.setattr(
        'services.reminder_service.BackgroundScheduler',
        FakeScheduler,
    )

    scheduler = start_reminder_scanner(app)

    assert scheduler is created[0]
    assert scheduler.timezone == 'Asia/Shanghai'
    assert scheduler.started is True
    assert scheduler.jobs == [{
        'func': scheduler.jobs[0]['func'],
        'trigger': 'interval',
        'seconds': 321,
        'id': 'reminder-scan',
        'max_instances': 1,
        'coalesce': True,
        'replace_existing': True,
    }]
