#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const commands = new Set(['doctor', 'plan', 'run', 'shadow', 'status', 'trace', 'why', 'stats', 'resume', 'cache', 'batch', 'models', 'validators', 'project-status']);
if (!args.length || ['--help', '-h'].includes(args[0])) {
  console.log(`Elsewhere's local Cascade development wrapper
Usage: node scripts/cascade.mjs <command> [Cascade arguments]
Commands: ${[...commands].join(', ')}
Examples:
  node scripts/cascade.mjs plan "Run tests" --json
  node scripts/cascade.mjs shadow "Review saved world validation" --json
  node scripts/cascade.mjs batch scripts/cascade-read-audit.json --plan-only
  node scripts/cascade.mjs cache stats
Set CASCADE_OPTIMIZER to an optimizer executable (not a shell command), or
CASCADE_VENV to your Cascade virtual environment. See docs/CASCADE.md.`);
  process.exit(0);
}
if (!commands.has(args[0])) {
  console.error(`Unsupported command: ${args[0]}. Use --help or call optimizer directly.`);
  process.exit(2);
}
if (args.includes('--repo')) {
  console.error('This wrapper always targets its own project. Use optimizer --repo for another repository.');
  process.exit(2);
}

const binary = process.platform === 'win32' ? ['Scripts', 'optimizer.exe'] : ['bin', 'optimizer'];
const virtualEnvironments = [process.env.CASCADE_VENV, join(root, '.venv'), join(root, 'cascade-venv'), join(root, '..', 'cascade-venv')].filter(Boolean);
const candidates = process.env.CASCADE_OPTIMIZER
  ? [process.env.CASCADE_OPTIMIZER]
  : [...virtualEnvironments.map(path => join(path, ...binary)).filter(existsSync), 'optimizer'];
let result;
for (const executable of candidates) {
  result = spawnSync(executable, ['--repo', root, ...args], {
    cwd: root, env: process.env, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, shell: false,
  });
  if (result.error?.code === 'ENOENT') continue;
  break;
}
if (result.error) {
  console.error(`Cascade could not start: ${result.error.message}\nInstall Cascade or set CASCADE_OPTIMIZER. See docs/CASCADE.md.`);
  process.exit(1);
}
process.stdout.write(result.stdout || '');
process.stderr.write(result.stderr || '');
// Upstream currently exits 0 for blocked/not-found runs. CI must not treat these as success.
if (['run', 'resume', 'batch'].includes(args[0]) && !args.includes('--plan-only')) {
  try {
    const data = JSON.parse(result.stdout);
    const outcomes = data.results ? Object.values(data.results) : data.status ? [data] : [];
    if (outcomes.some(outcome => !['verified', 'merged', 'completed-read-only'].includes(outcome.status))) process.exit(1);
  } catch {
    console.error('Cascade execution did not return valid structured output. Inspect the trace.');
    process.exit(1);
  }
}
process.exit(result.status ?? 1);
