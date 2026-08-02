# Member and Admin Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove and repair the end-to-end authentication, member profile, project-task, and administrator content-management flows against the current Flask API.

**Architecture:** Add Flask test-client flows that begin with seeded identities and exercise real JWT-protected endpoints. Use API contract tests to expose client/server field mismatches before changing UI code; retain the established camelCase request and snake_case response conventions where the current backend requires them.

**Tech Stack:** Flask, Flask-JWT-Extended, Flask-SQLAlchemy, pytest, React, TypeScript, Vite.

---

### Task 1: Member authentication and profile flow

**Files:**
- Modify: `backend/tests/test_member_admin_flows.py`
- Modify: `backend/routes/member.py` only if a failing contract test proves a defect
- Modify: `frontendnew/src/services/memberApi.ts` only if a failing contract test proves its request contract differs from the API

- [ ] **Step 1: Write the failing member flow test**

```python
def test_member_login_profile_update_and_password(client):
    login = client.post('/api/member/login', json={'account': '2023001', 'password': 'member123'})
    assert login.status_code == 200
    token = login.get_json()['token']
    headers = {'Authorization': f'Bearer {token}'}
    assert client.get('/api/member/me', headers=headers).status_code == 200
    updated = client.put('/api/member/me', headers=headers, json={'bio': 'integration bio'})
    assert updated.status_code == 200
    assert updated.get_json()['member']['bio'] == 'integration bio'
```

- [ ] **Step 2: Run the focused test**

Run: `python -m pytest tests/test_member_admin_flows.py::test_member_login_profile_update_and_password -v`

Expected: initially FAIL if the seeded identity, response object, or request field differs.

- [ ] **Step 3: Implement the minimum API/client contract correction**

Keep member request fields `name`, `phone`, `bio`, `github`, `blog`, `grade`, `skills`, and `notificationPrefs`; retain the `member` response wrapper for updates. Do not expose a member password hash or another member's private fields.

- [ ] **Step 4: Add and pass password regression coverage**

```python
changed = client.put('/api/member/me/password', headers=headers, json={
    'currentPassword': 'member123', 'newPassword': 'member456'
})
assert changed.status_code == 200
assert client.post('/api/member/login', json={'account': '2023001', 'password': 'member456'}).status_code == 200
```

- [ ] **Step 5: Commit the member identity flow**

```bash
git add backend/tests/test_member_admin_flows.py backend/routes/member.py frontendnew/src/services/memberApi.ts
git commit -m "test: cover member identity flow"
```

### Task 2: Project and task ownership flow

**Files:**
- Modify: `backend/tests/test_member_admin_flows.py`
- Modify: `backend/routes/member.py` or `frontendnew/src/services/memberApi.ts` only for a failing test

- [ ] **Step 1: Write the failing task lifecycle test**

```python
created = client.post('/api/member/projects/1/tasks', headers=headers, json={
    'title': 'Integration task', 'status': 'todo', 'assigneeId': 1,
    'priority': 'medium', 'sortOrder': 0,
})
assert created.status_code == 201
task_id = created.get_json()['task']['id']
changed = client.put(f'/api/member/tasks/{task_id}/status', headers=headers, json={'status': 'done'})
assert changed.status_code == 200
assert changed.get_json()['task']['status'] == 'done'
```

- [ ] **Step 2: Run the test and correct only the demonstrated contract mismatch**

Run: `python -m pytest tests/test_member_admin_flows.py::test_member_project_task_lifecycle -v`

Expected: PASS with `assigneeId` request and `assignee_id` response keys.

- [ ] **Step 3: Add authorization assertions**

```python
assert client.post('/api/member/projects/1/tasks', json={'title': 'blocked'}).status_code == 401
assert client.put(f'/api/member/tasks/{task_id}/status', headers=headers, json={'status': 'invalid'}).status_code == 400
```

- [ ] **Step 4: Commit the project-task contract coverage**

```bash
git add backend/tests/test_member_admin_flows.py backend/routes/member.py frontendnew/src/services/memberApi.ts
git commit -m "test: cover member task lifecycle"
```

### Task 3: Administrator login and content mutation flow

**Files:**
- Modify: `backend/tests/test_member_admin_flows.py`
- Modify: `backend/routes/admin.py` or `frontendnew/src/services/adminApi.ts` only for a failing test

- [ ] **Step 1: Write the failing admin flow test**

```python
login = client.post('/api/admin/login', json={'username': 'admin', 'password': 'admin123'})
assert login.status_code == 200
headers = {'Authorization': f"Bearer {login.get_json()['token']}"}
created = client.post('/api/admin/projects', headers=headers, json={'name': 'Integration project'})
assert created.status_code == 201
project = created.get_json()['project']
updated = client.put(f"/api/admin/projects/{project['id']}", headers=headers, json={'description': 'verified'})
assert updated.status_code == 200
assert updated.get_json()['project']['description'] == 'verified'
```

- [ ] **Step 2: Run the focused flow and fix only demonstrated API/client mismatches**

Run: `python -m pytest tests/test_member_admin_flows.py::test_admin_login_and_project_mutation -v`

Expected: PASS; unauthenticated create must return 401.

- [ ] **Step 3: Add an application status update assertion**

```python
applications = client.get('/api/admin/applications', headers=headers)
assert applications.status_code == 200
```

- [ ] **Step 4: Run complete integration and frontend gates, then commit**

Run: `python -m pytest tests/test_member_admin_flows.py -v`

Expected: all member/admin flow tests PASS.

Run: `npm run check && npm run build`

Expected: both commands exit 0.

```bash
git add backend/tests/test_member_admin_flows.py backend/routes/admin.py frontendnew/src/services/adminApi.ts
git commit -m "test: cover admin content flow"
```

## Plan self-review

- Coverage: member authentication/profile/password, task lifecycle/authorization, and administrator project/application flows are independently verified.
- Scope: resource, certificate and notification flows are deliberately scheduled next because they require file persistence and additional models.
- Contract consistency: member task creates use `assigneeId`; task responses retain `assignee_id`.
