# Zero mandatory service cost

Elsewhere's core experience runs as a static browser application. Authored data, deterministic simulations, rendering, branch comparison, and document import/export execute on the visitor's device. The application needs no paid API key, hosted database, AI proxy, account system, or recurring server subscription. Normal device, electricity and internet costs still belong to the user.

## Runtime and development boundaries

| Layer | Execution | Required hosted service |
| --- | --- | --- |
| Interface and spatial rendering | Bundled browser JavaScript, HTML and CSS | Static file hosting |
| Question interpretation | Local deterministic routing into authored worlds or a disclosed system archetype | None |
| Simulations and causal explanations | Local functions over documented parameters | None |
| Saved worlds and branches | Browser storage and user-downloaded `.elsewhere` files | None |
| Sources and evidence labels | Curated authored sources plus optional bounded Wikipedia context for generated worlds | Wikipedia is optional; research failure produces an explicit offline world |
| Build, tests and Cascade | Developer machine or repository CI | None for deterministic work; optional model execution has separate requirements |

Local browser storage can be cleared or unavailable. Downloaded world files are the portable backup. A static host serves the application; it does not receive an uploaded saved world merely because the app imports one. Generated-world research sends the entered question to Wikipedia's public API; the interface discloses the research stage and continues offline when it fails. Avoid adding telemetry, paid API-backed generation, remote fonts, or external asset dependencies without revisiting these boundaries.

## Free public educational deployment

Use a public GitHub repository and GitHub Pages on its included `github.io` address. A custom domain is optional and may have a registration cost. GitHub Free includes Pages for public repositories. Pages currently limits a published site to 1 GB, uses a soft 100 GB monthly bandwidth limit, and times out deployments after 10 minutes. Excess usage can cause throttling, service refusal, or a request to reduce load or migrate. Pages is suitable here for the public educational project; its rules exclude sites primarily providing commercial SaaS or facilitating commercial transactions. [GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits)

Build `dist/` with `npm ci` and `npm run build`; use the repository's Pages workflow and matching Vite base path. Serve only the build output. Do not deploy `.cascade/`, source-control metadata, virtual environments, credentials, test recordings, or local saved worlds. Test a direct open and reload at the repository subpath before calling deployment successful.

For the least billing exposure, build locally and publish a branch containing only the static build, selecting that branch in Pages settings. For automated builds, use standard GitHub-hosted runners and keep artifacts small with short retention. GitHub currently makes standard runner execution free for public repositories and Pages; larger runners are charged. Artifact storage has a separate allowance, and expanding cache storage above the included 10 GB can incur charges. Free GitHub accounts include 500 MB artifact storage shared with Packages. An account without a payment method is blocked at quota; accounts with a payment method should configure spending-stop budgets. The project's design cannot certify an account's billing settings. [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)

These constraints establish a zero mandatory cost path, not unlimited free capacity or a guarantee that future provider terms will remain unchanged. Documentation checked September 20, 2026.

## Cascade is the development layer

Cascade's Python engine runs beside the repository. It supplies deterministic validation, bounded repository evidence, capability routing, exact caching, resumable checkpoints, worktree isolation and inspection commands. It is not bundled into the site, and its SQLite state does not power user persistence.

Planning and shadow routing do not execute a model. Model-backed development is optional and may consume the developer's existing Codex usage or require a separately configured local model. Installing Cascade does not provide free model inference, an API entitlement, or a browser assistant. See [Cascade setup and verified commands](docs/CASCADE.md).

## Optional browser-local AI investigation

[WebLLM](https://webllm.mlc.ai/docs/) provides language-model inference in the browser with WebGPU and worker support. It is a possible future optional interpreter for questions, not a dependency of this release. A suitable implementation would explicitly request the model download, disclose download size and hardware requirements, and keep deterministic examples available when the browser lacks the required GPU features or resources.

Any proposed parameters from a local model must still pass the existing world schema, bounds and provenance rules. A language model could propose a blueprint only after a future contract and evidence review; it could not promote an invented source to fact or remove the current assumption labels. Model files, licenses, download hosting, memory use, latency and mobile support require a separate measured evaluation. No local-AI performance, compatibility, or privacy guarantee has been established by this investigation.
