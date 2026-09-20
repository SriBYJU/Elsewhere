#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '..'));
const fail = message => { throw new Error(message); };
function git(args, { inherit = false } = {}) {
  const result = spawnSync('git', args, { cwd: root, encoding: 'utf8', shell: false, stdio: inherit ? 'inherit' : 'pipe', maxBuffer: 16 * 1024 * 1024 });
  if (result.error || result.status !== 0) fail(`git ${args[0]} failed${result.stderr ? `: ${result.stderr.trim()}` : ''}. Existing work was preserved.`);
  return result.stdout || '';
}
const split = value => value.split('\0').filter(Boolean);
const forbiddenPath = /(^|\/)(\.git|\.cascade|node_modules|dist|coverage|playwright-report|test-results|\.venv|cascade-venv|\.env(?:\..*)?|credentials?(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|id_rsa|id_ed25519)(\/|$)|\.(?:pem|p12|pfx|key|sqlite3?|db|log)$/i;
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
];

try {
  const args = process.argv.slice(2);
  const paths = [];
  let commit = false, push = false, dryRun = false, message, remote;
  const value = flag => {
    const next = args.shift();
    if (!next || next.startsWith('--')) fail(`${flag} requires a value.`);
    return next;
  };
  while (args.length) {
    const arg = args.shift();
    if (arg === '--write') paths.push(value(arg));
    else if (arg === '--message') message = value(arg);
    else if (arg === '--remote') remote = value(arg);
    else if (arg === '--commit') commit = true;
    else if (arg === '--push') push = true;
    else if (arg === '--dry-run') dryRun = true;
    else if (['--help', '-h'].includes(arg)) {
      console.log(`Usage: node scripts/preserve.mjs --write <file-or-directory> [--write ...]
       [--commit --message "Describe the change"] [--push --remote origin]
Default: run npm run check, inspect selected paths, print the intended commit.
--commit explicitly stages and commits the selected scope after checks pass.
--push also requires --commit and an explicit existing remote; it verifies the
remote branch equals the new commit. It never force-pushes or discards work.
Paths are literal repository-relative files/directories, not glob patterns.
The index must be empty. Secrets, generated artifacts and symlinks are refused.`);
      process.exit(0);
    } else fail(`Unknown option: ${arg}`);
  }
  if (!paths.length) fail('Select explicit files or directories with --write.');
  if (dryRun && (commit || push)) fail('--dry-run cannot be combined with --commit or --push.');
  if (commit && !message?.trim()) fail('--commit requires --message.');
  if (push && (!commit || !remote)) fail('--push requires --commit and --remote.');
  if (remote && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remote)) fail('Use a configured remote name, not a URL.');
  if (git(['diff', '--cached', '--name-only']).trim()) fail('The Git index already contains staged work. Preserve it separately first.');
  const branch = git(['symbolic-ref', '--quiet', '--short', 'HEAD']).trim();
  const head = git(['rev-parse', 'HEAD']).trim();
  const scopes = paths.map(path => {
    const normalized = path.replaceAll('\\', '/').replace(/\/$/, '');
    if (!normalized || normalized === '.' || isAbsolute(path) || normalized.split('/').some(part => ['..', '.', ''].includes(part)) || /[*?\[\]:\x00-\x1f]/.test(normalized)) fail(`Unsafe scope: ${path}`);
    return normalized;
  });
  if (push) {
    const remotes = git(['remote']).trim().split(/\r?\n/);
    if (!remotes.includes(remote)) fail(`Remote ${remote} is not configured.`);
    console.log(`Push destination: ${git(['remote', 'get-url', remote]).trim()} (${branch})`);
  }
  const candidates = split(git(['ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', ...scopes.map(path => `:(literal)${path}`)]));
  const changed = new Set([...split(git(['diff', '--name-only', '--no-renames', '-z', 'HEAD'])), ...split(git(['ls-files', '--others', '--exclude-standard', '-z']))]);
  const selected = [...new Set(candidates)].filter(path => changed.has(path));
  if (!selected.length) fail('There are no changed files in the selected scope.');
  const validateFiles = () => {
    for (const path of selected) {
      if (forbiddenPath.test(path)) fail(`Refusing secret/state/generated path: ${path}`);
      const absolute = resolve(root, path);
      const stat = lstatSync(absolute, { throwIfNoEntry: false });
      if (stat?.isSymbolicLink()) fail(`Refusing symlink: ${path}`);
      if (!existsSync(absolute)) continue; // A scoped deletion is reviewable and can be committed.
      const outside = relative(root, realpathSync(absolute));
      if (outside === '..' || outside.startsWith(`..${sep}`) || isAbsolute(outside) || lstatSync(absolute).isSymbolicLink()) fail(`Refusing symlink or path outside this repository: ${path}`);
      if (!stat.isFile() || stat.size > 5 * 1024 * 1024) fail(`Review this large or nonregular file manually: ${path}`);
      const content = readFileSync(absolute);
      if (secretPatterns.some(pattern => pattern.test(content.toString('utf8')))) fail(`Possible secret detected in ${path}; inspect it manually.`);
    }
  };
  validateFiles();
  console.log(`Selected ${selected.length} changed file(s):\n${selected.map(path => `  ${path}`).join('\n')}`);
  git(['diff', '--check', 'HEAD', '--', ...selected.map(path => `:(literal)${path}`)]);
  // Fixed command only: no user input is interpolated into a shell on Windows.
  const check = process.platform === 'win32'
    ? spawnSync('npm run check', { cwd: root, shell: true, stdio: 'inherit' })
    : spawnSync('npm', ['run', 'check'], { cwd: root, shell: false, stdio: 'inherit' });
  if (check.error || check.status !== 0) fail('Validation failed. Nothing was staged, committed, or pushed.');
  if (git(['rev-parse', 'HEAD']).trim() !== head || git(['symbolic-ref', '--quiet', '--short', 'HEAD']).trim() !== branch) fail('Git HEAD changed during validation. Review the checkout and retry.');
  if (git(['diff', '--cached', '--name-only']).trim()) fail('The Git index changed during validation. No commit was made.');
  validateFiles();
  if (!commit) {
    console.log('Dry run passed. Nothing staged, committed, or pushed. Repeat with --commit --message to preserve this scope.');
    process.exit(0);
  }
  git(['add', '--all', '--', ...selected.map(path => `:(literal)${path}`)]);
  const staged = split(git(['diff', '--cached', '--name-only', '--no-renames', '-z']));
  if (staged.some(path => !selected.includes(path))) fail('Unexpected staged paths appeared. Staged work is preserved for inspection; no commit was made.');
  if (!staged.length) fail('No changes remain after validation.');
  git(['diff', '--cached', '--check']);
  git(['commit', '-m', message], { inherit: true });
  const saved = git(['rev-parse', 'HEAD']).trim();
  console.log(`Local commit verified: ${saved}`);
  if (push) {
    git(['push', remote, `HEAD:refs/heads/${branch}`], { inherit: true });
    const remoteHead = git(['ls-remote', '--heads', remote, `refs/heads/${branch}`]).trim().split(/\s+/)[0];
    if (remoteHead !== saved) fail(`Remote commit verification failed. Local commit ${saved} is preserved.`);
    console.log(`Remote commit verified: ${saved}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
