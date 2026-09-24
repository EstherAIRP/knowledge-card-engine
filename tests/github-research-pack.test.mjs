import assert from 'node:assert/strict';
import test from 'node:test';
import { selectGitHubInitialResearchPaths } from '../packages/ingestion/src/github/research-pack.js';

function discovery(candidates, limits = {}) {
  return {
    candidates,
    discovery: {
      limits: {
        max_selected_items: 20,
        max_total_bytes: 786432,
        ...limits
      }
    }
  };
}

function candidate(path, kind, priority, bytes = 100) {
  return { path, kind, priority, bytes };
}

test('initial GitHub research pack is deterministic and covers diverse high-value evidence kinds', () => {
  const input = discovery([
    candidate('src/z.js', 'source', 7),
    candidate('docs/architecture.md', 'documentation', 1),
    candidate('README.md', 'readme', 0),
    candidate('package.json', 'manifest', 1),
    candidate('src/index.js', 'entrypoint', 4),
    candidate('src/routes.js', 'api', 4),
    candidate('src/model.js', 'data_model', 3),
    candidate('src/auth.js', 'auth', 2),
    candidate('src/jobs.js', 'background_job', 3),
    candidate('SECURITY.md', 'security', 0),
    candidate('Dockerfile', 'deployment', 2),
    candidate('LICENSE', 'license', 1),
    candidate('config/app.yaml', 'configuration', 5),
    candidate('tests/app.test.js', 'test', 8),
    candidate('src/a.js', 'source', 7)
  ]);

  const first = selectGitHubInitialResearchPaths(input);
  const second = selectGitHubInitialResearchPaths({
    ...input,
    candidates: [...input.candidates].reverse()
  });

  assert.deepEqual(second, first);
  assert.ok(first.includes('README.md'));
  assert.ok(first.includes('docs/architecture.md'));
  assert.ok(first.includes('package.json'));
  assert.ok(first.includes('src/index.js'));
  assert.ok(first.includes('src/a.js') || first.includes('src/z.js'));
  assert.ok(first.includes('src/auth.js'));
  assert.ok(first.includes('src/jobs.js'));
  assert.ok(first.includes('SECURITY.md'));
  assert.ok(first.length <= 14);
});

test('initial GitHub research pack obeys item and byte limits while continuing past oversized candidates', () => {
  const input = discovery([
    candidate('README.md', 'readme', 0, 80),
    candidate('docs/architecture.md', 'documentation', 1, 500),
    candidate('package.json', 'manifest', 1, 90),
    candidate('src/index.js', 'entrypoint', 4, 90)
  ], {
    max_selected_items: 3,
    max_total_bytes: 260
  });

  const selected = selectGitHubInitialResearchPaths(input, {
    max_items: 10,
    max_bytes: 240
  });

  assert.deepEqual(selected, ['README.md', 'package.json']);
});


test('initial GitHub research pack prefers substantive docs and runtime files over low-signal placeholders', () => {
  const input = discovery([
    candidate('README.md', 'readme', 0),
    candidate('CONTRIBUTING.md', 'documentation', 3),
    candidate('docs/index.md', 'documentation', 3),
    candidate('docs/introduction.md', 'documentation', 3),
    candidate('docs/android/methodology.md', 'documentation', 3),
    candidate('docs/ios/methodology.md', 'documentation', 3),
    candidate('pyproject.toml', 'manifest', 1),
    candidate('src/app/cli.py', 'entrypoint', 4),
    candidate('src/app/worker.py', 'source', 7),
    candidate('src/app/__init__.py', 'source', 7),
    candidate('SECURITY.md', 'security', 0),
    candidate('docs/license.md', 'license', 1),
    candidate('.github/workflows/add-issue-to-project.yml', 'deployment', 2),
    candidate('.github/workflows/mypy.yml', 'deployment', 2),
    candidate('Dockerfile', 'deployment', 2),
    candidate('tests/__init__.py', 'test', 8),
    candidate('tests/test_cli.py', 'test', 8)
  ]);

  const selected = selectGitHubInitialResearchPaths(input);

  assert.ok(selected.includes('docs/introduction.md'));
  assert.ok(selected.includes('docs/android/methodology.md'));
  assert.ok(selected.includes('Dockerfile'));
  assert.ok(selected.includes('src/app/worker.py'));
  assert.equal(selected.includes('CONTRIBUTING.md'), false);
  assert.equal(selected.includes('.github/workflows/add-issue-to-project.yml'), false);
  assert.equal(selected.includes('.github/workflows/mypy.yml'), false);
  assert.equal(selected.includes('src/app/__init__.py'), false);
  assert.equal(selected.includes('tests/__init__.py'), false);
});
