import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function fixture(check = 'node -e "process.exit(0)"') {
  const root = mkdtempSync(join(tmpdir(), 'elsewhere-preserve-'));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  mkdirSync(join(root, 'scripts'));
  copyFileSync(fileURLToPath(new URL('./preserve.mjs', import.meta.url)), join(root, 'scripts/preserve.mjs'));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { check } }));
  writeFileSync(join(root, 'selected.txt'), 'original\n');
  writeFileSync(join(root, 'unrelated.txt'), 'keep original\n');
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Preservation Test');
  git('config', 'user.email', 'preservation-test@example.invalid');
  git('add', '.');
  git('commit', '-m', 'Fixture');
  const before = git('rev-parse', 'HEAD');
  const run = (...args) => spawnSync(process.execPath, ['scripts/preserve.mjs', '--write', 'selected.txt', ...args], { cwd: root, encoding: 'utf8' });
  writeFileSync(join(root, 'selected.txt'), 'selected edit\n');
  writeFileSync(join(root, 'unrelated.txt'), 'keep user edit\n');
  return { root, git, run, before };
}

test('dry run validates and preserves index, HEAD, and unrelated changes', () => {
  const f = fixture();
  const result = f.run();
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Dry run passed/);
  assert.equal(f.git('rev-parse', 'HEAD'), f.before);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
  assert.equal(readFileSync(join(f.root, 'unrelated.txt'), 'utf8'), 'keep user edit\n');
});

test('explicit commit saves only selected changes', () => {
  const f = fixture();
  const result = f.run('--commit', '--message', 'Save selected work');
  assert.equal(result.status, 0, result.stderr);
  assert.notEqual(f.git('rev-parse', 'HEAD'), f.before);
  assert.equal(f.git('diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'), 'selected.txt');
  assert.equal(f.git('diff', '--name-only'), 'unrelated.txt');
});

test('failed validation cannot stage or commit', () => {
  const f = fixture('node -e "process.exit(1)"');
  const result = f.run('--commit', '--message', 'Must not commit');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Validation failed/);
  assert.equal(f.git('rev-parse', 'HEAD'), f.before);
  assert.equal(f.git('diff', '--cached', '--name-only'), '');
});

test('preexisting staged work is retained and rejected', () => {
  const f = fixture();
  f.git('add', 'unrelated.txt');
  assert.equal(f.run('--commit', '--message', 'Must not commit').status, 1);
  assert.equal(f.git('diff', '--cached', '--name-only'), 'unrelated.txt');
  assert.equal(f.git('rev-parse', 'HEAD'), f.before);
});

test('conflicting dry-run flags and traversal are rejected', () => {
  const f = fixture();
  assert.match(f.run('--dry-run', '--commit', '--message', 'No').stderr, /cannot be combined/);
  assert.match(f.run('--write', '../outside').stderr, /Unsafe scope/);
  assert.equal(f.git('rev-parse', 'HEAD'), f.before);
});

test('secret-like text is rejected without printing the content', () => {
  const f = fixture();
  const synthetic = ['ghp_', 'a'.repeat(36)].join('');
  writeFileSync(join(f.root, 'selected.txt'), synthetic);
  const result = f.run('--commit', '--message', 'No');
  assert.match(result.stderr, /Possible secret/);
  assert.ok(!result.stderr.includes(synthetic));
  assert.equal(f.git('rev-parse', 'HEAD'), f.before);
});

test('explicit push verifies the exact commit on a local bare remote', () => {
  const f = fixture();
  const remote = mkdtempSync(join(tmpdir(), 'elsewhere-preserve-remote-'));
  f.git('init', '--bare', remote);
  f.git('remote', 'add', 'backup', remote);
  const result = f.run('--commit', '--message', 'Preserve remotely', '--push', '--remote', 'backup');
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Remote commit verified/);
  assert.equal(f.git('ls-remote', '--heads', 'backup', 'refs/heads/main').split(/\s+/)[0], f.git('rev-parse', 'HEAD'));
});
