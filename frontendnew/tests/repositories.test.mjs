import test from 'node:test'
import assert from 'node:assert/strict'
import { githubRepository, publicRepositories } from '../src/lib/repositories.ts'

test('repository URLs are canonicalized without tracking parameters or git suffix', () => {
  assert.deepEqual(githubRepository(' https://GitHub.com/Studio/my-repo.git/?tab=readme#about '), {
    owner: 'Studio', name: 'my-repo', label: 'Studio/my-repo', href: 'https://github.com/Studio/my-repo',
  })
  assert.equal(githubRepository('http://github.com/a/b').href, 'https://github.com/a/b')
})

test('profiles, deep links and non-repository or unsafe URLs are excluded', () => {
  for (const url of [undefined, '', 'not a URL', 'javascript:alert(1)', 'https://github.com.fake.test/a/b',
    'https://evil.test/a/b', 'https://github.com/owner', 'https://github.com/owner/repo/issues',
    'https://user:secret@github.com/owner/repo', 'https://github.com:8443/owner/repo',
    'https://github.com/-owner/repo', 'https://github.com/owner/.git']) {
    assert.equal(githubRepository(url), null, String(url))
  }
})

test('only configured repositories appear and duplicates preserve the first project', () => {
  const projects = [
    { id: '1', name: 'First', githubUrl: 'https://github.com/Studio/Repo.git' },
    { id: '2', name: 'Duplicate', githubUrl: 'https://github.com/studio/repo' },
    { id: '3', name: 'No repository' },
    { id: '4', name: 'Other', githubUrl: 'https://github.com/Other/Work' },
  ]
  const entries = publicRepositories(projects)
  assert.deepEqual(entries.map(x => x.project.id), ['1', '4'])
  assert.equal(entries[0].repository.href, 'https://github.com/Studio/Repo')
  assert.equal(projects.length, 4)
})
