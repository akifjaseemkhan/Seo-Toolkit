import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspectProject } from '../lib/project-inspect.js';

function makeFixtureProject() {
  const root = mkdtempSync(join(tmpdir(), 'seo-tool-test-'));
  writeFileSync(
    join(root, 'package.json'),
    JSON.stringify({
      name: 'fixture-app',
      dependencies: { next: '14.0.0', react: '18.0.0' },
      devDependencies: { typescript: '5.0.0' },
      scripts: { build: 'next build', dev: 'next dev' },
    })
  );
  writeFileSync(join(root, 'package-lock.json'), '{}');
  writeFileSync(join(root, 'next.config.js'), 'module.exports = {}');
  mkdirSync(join(root, 'app'), { recursive: true });
  writeFileSync(
    join(root, 'app', 'layout.js'),
    'export async function generateMetadata() { return { title: "x" }; }'
  );
  mkdirSync(join(root, 'public'), { recursive: true });
  writeFileSync(join(root, 'public', 'robots.txt'), 'User-agent: *\nDisallow:\n');
  return root;
}

test('inspectProject detects package.json facts without judging them', () => {
  const root = makeFixtureProject();
  try {
    const facts = inspectProject(root);
    assert.ok(facts.packageJson);
    assert.deepEqual(facts.packageJson.dependencies.sort(), ['next', 'react']);
    assert.deepEqual(Object.keys(facts.packageJson.scripts).sort(), ['build', 'dev']);
    // The tool must return facts, not verdicts — no "framework" or "siteType" field.
    assert.equal('framework' in facts, false);
    assert.equal('siteType' in facts, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inspectProject detects the package manager from a lockfile', () => {
  const root = makeFixtureProject();
  try {
    assert.equal(inspectProject(root).packageManager, 'npm');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inspectProject detects framework config files and directory conventions', () => {
  const root = makeFixtureProject();
  try {
    const facts = inspectProject(root);
    assert.ok(facts.frameworkConfigFiles.includes('next.config.js'));
    assert.equal(facts.directoryConventions.hasAppRouterDir, true);
    assert.equal(facts.directoryConventions.hasPagesRouterDir, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inspectProject finds SEO-related files at their conventional locations', () => {
  const root = makeFixtureProject();
  try {
    const facts = inspectProject(root);
    assert.ok(facts.seoRelatedFilesFound.some((f) => f.includes('robots.txt')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inspectProject reports metadata implementation signal strings with sample file paths', () => {
  const root = makeFixtureProject();
  try {
    const facts = inspectProject(root);
    assert.ok('generateMetadata' in facts.metadataImplementationSignals);
    assert.equal(facts.metadataImplementationSignals.generateMetadata.fileCount, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inspectProject skips node_modules and does not crash on an absent package.json', () => {
  const root = mkdtempSync(join(tmpdir(), 'seo-tool-test-empty-'));
  try {
    mkdirSync(join(root, 'node_modules', 'some-dep'), { recursive: true });
    writeFileSync(join(root, 'node_modules', 'some-dep', 'index.js'), 'generateMetadata');
    const facts = inspectProject(root);
    assert.equal(facts.packageJson, null);
    assert.equal(facts.metadataImplementationSignals.generateMetadata, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
