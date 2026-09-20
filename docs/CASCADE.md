# Cascade for Elsewhere development

[Cascade](https://github.com/SriBYJU/Cascade) is a local Python orchestration layer for development. Elsewhere uses its project skill and six scoped agents, transparent capability routing, deterministic validation, bounded context, exact cache, task DAGs, checkpoints and trace inspection. The browser product does not load or execute Cascade.

## Reproduce the setup

Use Git, Node.js and Python 3.11 or newer. From the parent of your Elsewhere checkout:

```sh
git clone https://github.com/SriBYJU/Cascade.git
git -C Cascade checkout 80c3dcd89d6de5d6f34df1efd3fa52c67a4072c4
python -m venv cascade-venv
# macOS / Linux
cascade-venv/bin/python -m pip install -e ./Cascade
cascade-venv/bin/optimizer project-install --target ./Elsewhere --dry-run
cascade-venv/bin/optimizer project-install --target ./Elsewhere
```

PowerShell uses the virtual environment's `Scripts` directory:

```powershell
.\cascade-venv\Scripts\python.exe -m pip install -e .\Cascade
.\cascade-venv\Scripts\optimizer.exe project-install --target .\Elsewhere --dry-run
.\cascade-venv\Scripts\optimizer.exe project-install --target .\Elsewhere
```

Inspect installation conflicts before proceeding; no overwrite flag is needed for a clean project. Project installation is distinct from marketplace installation. A project repository need not contain Cascade's own distributable plugin manifests.

The `scripts/cascade.mjs` wrapper targets the checkout containing the script. It resolves, in order, an explicit `CASCADE_OPTIMIZER`, `CASCADE_VENV`, project `.venv`, project `cascade-venv`, sibling `cascade-venv`, or `optimizer` on PATH. Explicit overrides are paths to executables, not shell command strings. For a different location:

```powershell
$env:CASCADE_VENV = 'C:\tools\cascade-venv'
node scripts/cascade.mjs doctor
```

```sh
CASCADE_VENV="$HOME/tools/cascade-venv" node scripts/cascade.mjs doctor
```

Use `optimizer --repo /other/repo ...` directly for another repository. The project wrapper refuses a repo override.

## Daily workflow

```sh
node scripts/cascade.mjs doctor
node scripts/cascade.mjs project-status --target .
node scripts/cascade.mjs validators
node scripts/cascade.mjs models
node scripts/cascade.mjs plan "Run tests" --json
node scripts/cascade.mjs shadow "Improve world file validation" --write "src/core/**" --json
node scripts/cascade.mjs why --json
node scripts/cascade.mjs run "Run tests"
node scripts/cascade.mjs status
node scripts/cascade.mjs trace --compact
node scripts/cascade.mjs stats --json
node scripts/cascade.mjs cache stats
node scripts/cascade.mjs resume
```

`plan` and `shadow` preview routing and collect local repository evidence without executing a model. They can update local cache and trace state. `Run tests` is recognized as deterministic verification by the inspected engine; inspect the route before execution when changing task wording. The no-model route runs discovered validators, not an arbitrary shell command spelled out in a prompt. The primary full application gate remains `npm run check`.

For a model-backed change, first choose a bounded write scope. Omit `--apply` until you want the verified writer result integrated into a clean checkout:

```sh
node scripts/cascade.mjs plan "Improve world file validation" --write "src/core/**" --json
node scripts/cascade.mjs run "Improve world file validation" --write "src/core/**" --forbid "public/**"
```

Model-backed `run` can consume authenticated Codex usage. A local Ollama or vLLM endpoint is a separate setup; neither was available in the initial doctor check. Do not add API keys or local model requirements to the browser bundle. Capability profiles select the runtime model and effort separately. Use `models` to inspect actual mappings instead of hardcoding assumed model names.

## Cache, DAG and recovery commands

`cache` supports exactly `stats` and `clear`; there is no cache export, warm or semantic-cache command in this CLI. `cache clear` deliberately deletes local exact-cache entries and should only be invoked when wanted. Fingerprint changes invalidate reuse, so cache hits must be observed rather than promised.

The included read-only audit DAG has two independent scans followed by a dependent review:

```sh
node scripts/cascade.mjs batch scripts/cascade-read-audit.json --plan-only
# Optional: executes model-backed read tasks after you have configured a model.
node scripts/cascade.mjs batch scripts/cascade-read-audit.json
```

`batch` accepts a JSON list with `id`, `task`, `depends_on`, `write`, and `forbid`. `--plan-only` checks ordering without execution. An edge controls scheduling; it does not itself promise that one worker's prose is passed to another worker. Writers require isolated worktrees, bounded write sets and merge checks. No task in the example writes files.

`resume` with no ID lists resumable checkpoints. `resume <run-id>` resumes a persisted run; `--apply` requests integration after successful validation. There is no separate checkpoint-save command. Checkpoints and exact cache are in `.cascade/` and are local development state. Commit changes to Git for durable source preservation; do not mistake a checkpoint for a remote backup.

The upstream CLI accepts some blocked/not-found execution outcomes with exit code zero. The wrapper converts unsuccessful `run`, `resume <id>` and executed `batch` statuses to a nonzero exit code and retains the output for inspection. Always inspect status and validation details, not only a green command exit.

## Preserve a verified change

The cross-platform Node helper runs the declared `npm run check` gate and inspects an explicit file scope. Its default is a dry run:

```sh
node scripts/preserve.mjs --write src/core --write docs/CASCADE.md
node scripts/preserve.mjs --write src/core --message "Improve world validation" --commit
# Explicitly requested publication, with exact remote commit verification:
node scripts/preserve.mjs --write src/core --message "Improve world validation" --commit --push --remote origin
```

Paths are literal files or directories, not globs; the whole repository cannot be selected with `.`. An existing Git index, traversal, symlink, common secret patterns, local state, build output and large files are rejected. Unselected changes remain in the working tree. The script never resets, cleans, force-pushes, retries a remote side effect, or stages all repository files. A failed push leaves the local commit intact. Git hooks may run during a requested commit; inspect your repository's hooks as part of your ordinary trust boundary.

The secret scan is deliberately a baseline, not proof that every possible credential format is absent. Review the printed scope and diff. Run its mutation-safety checks with `node --test scripts/preserve-checks.mjs`; tests use temporary Git repositories and a local bare remote, never the project's configured network remote.

## Evidence from this integration

Initial checks on September 20, 2026 used Cascade `0.1.0`, Python `3.12.14`, Node `24.15.0`, Git `2.55.0.windows.3` and the available Codex CLI `0.155.0-alpha.9.2`.

Inspected Cascade source commit: `80c3dcd89d6de5d6f34df1efd3fa52c67a4072c4`. The setup pins that revision to make this command contract reproducible; update deliberately when adopting a newer engine.

- `doctor` found all six project agents, compatible Codex execution flags and the declared npm validators.
- The project doctor reported absent plugin distribution manifests. This repository uses the project-install route; those warnings are not evidence of a failed six-agent project installation.
- `project-status` in the isolated tooling worktree reported `not-installed`: the tracked skill/agent files were present, while the original checkout's local installation receipt was not copied into the worktree. Run project-status in the original installation target to inspect that receipt.
- No local Ollama/vLLM model was ready. No local-model execution is claimed.
- `plan "Run tests" --json` selected `no-model`, target `deterministic`, minimal effort, and zero reserved model tokens. That is routing evidence, not a percentage saving.
- The read-only DAG's `--plan-only` output contained two independent first-level tasks and one dependent second-level task. This proves scheduling compilation, not model task completion or parallel speedup.
- All seven preservation-script checks passed, including failed-validation rejection, staged-work preservation, scope isolation and exact commit verification against a temporary local bare remote. No network push was performed by these tests.

Traces and cache are generated locally and excluded from the public build. Keep measured model usage, elapsed time, outcomes and validated baseline traces before making any savings claim. A zero-token deterministic plan cannot establish that Cascade saved a particular percentage of development cost.
