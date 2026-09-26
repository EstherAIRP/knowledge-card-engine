import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import {
  ANALYSIS_SECTIONS,
  bindAnalysisToEvidence
} from '../packages/analysis/src/index.js';

const HANDOFF_SCRIPT = path.resolve('scripts/ingest-handoff.mjs');
const FETCH_HOOK = pathToFileURL(path.resolve('tests/fixtures/threads-handoff-fetch.mjs')).href;
let resultCounter = 0;

async function tempWorkspace() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-card-threads-handoff-'));
  await fs.cp(path.resolve('examples/synthetic-workspace'), root, { recursive: true });
  return root;
}

function handoffDir(root) {
  return path.join(root, 'state', 'ingestion');
}

async function writeJson(filePath, value) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

function runHandoff(root, { expectSuccess = true } = {}) {
  resultCounter += 1;
  const resultFile = path.join(
    os.tmpdir(),
    `knowledge-card-threads-result-${process.pid}-${resultCounter}.json`
  );
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      FETCH_HOOK,
      HANDOFF_SCRIPT,
      root,
      `--result-file=${resultFile}`
    ],
    {
      cwd: path.resolve('.'),
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_ACTIONS: 'false'
      }
    }
  );

  if (expectSuccess) {
    assert.equal(run.status, 0, run.stderr || run.stdout);
  } else {
    assert.notEqual(run.status, 0, 'Expected Remote Ingest handoff to fail.');
  }

  const result = JSON.parse(
    spawnSync(
      process.execPath,
      ['-e', 'process.stdout.write(require("fs").readFileSync(process.argv[1], "utf8"))', resultFile],
      { encoding: 'utf8' }
    ).stdout
  );
  fs.rm(resultFile, { force: true }).catch(() => {});
  return { run, result };
}

function analysisFrom(evidence) {
  return bindAnalysisToEvidence({
    title: 'Synthetic Threads Remote Handoff',
    summary: 'Synthetic accepted-source analysis proving the final Threads evidence handoff is reread before persistence.',
    resource_kind: 'article',
    navigation_categories: ['Engineering'],
    classification_categories: ['Developer Tools'],
    tags: ['synthetic', 'threads', 'remote-ingest'],
    relevance: { overall: 3, engineering: 4 },
    actions: ['LEARN'],
    status: 'active',
    sections: Object.fromEntries(ANALYSIS_SECTIONS.map((heading) => [
      heading,
      `Synthetic Threads evidence-backed content for ${heading}; the source is a complete single post.`
    ]))
  }, evidence);
}

test('synthetic Threads Remote Ingest exposes final accepted evidence before analysis and supports session resume', async () => {
  const root = await tempWorkspace();
  try {
    await writeJson(path.join(handoffDir(root), 'request.json'), {
      schema_version: 1,
      provider: 'threads',
      source_url: 'https://threads.com/@alice/post/REMOTE1'
    });

    const prepared = runHandoff(root);
    assert.equal(prepared.result.stage, 'prepared');
    assert.equal(prepared.result.waiting_for, 'analysis');
    assert.equal(prepared.result.analysis_handoff.reread_required, true);
    assert.deepEqual(
      prepared.result.analysis_handoff.input_paths,
      ['state/ingestion/evidence.json']
    );
    assert.equal(
      prepared.result.analysis_handoff.output_path,
      'state/ingestion/analysis.json'
    );
    assert.equal(prepared.result.analysis_handoff.analysis_evidence_digest, null);

    const evidence = await readJson(path.join(handoffDir(root), 'evidence.json'));
    assert.equal(evidence.provider, 'threads');
    assert.equal(evidence.thread.status, 'SINGLE_POST');
    assert.equal(evidence.thread.complete, true);
    assert.equal(prepared.result.analysis_handoff.evidence_digest, evidence.evidence_digest);

    const resumed = runHandoff(root);
    assert.equal(resumed.result.stage, 'waiting-for-analysis');
    assert.equal(resumed.result.waiting_for, 'analysis');
    assert.equal(resumed.result.analysis_handoff.reread_required, true);
    assert.deepEqual(
      resumed.result.analysis_handoff.input_paths,
      ['state/ingestion/evidence.json']
    );
    assert.equal(resumed.result.analysis_handoff.evidence_digest, evidence.evidence_digest);

    await writeJson(path.join(handoffDir(root), 'analysis.json'), analysisFrom(evidence));
    const applied = runHandoff(root);
    assert.equal(applied.result.stage, 'applied');
    assert.equal(applied.result.analysis_version, 1);
    await assert.rejects(fs.access(handoffDir(root)), (error) => error.code === 'ENOENT');
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
