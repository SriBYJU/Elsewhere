# Elsewhere

> Question → Research → Model → Simulation → Interactive World

Elsewhere turns questions into structured worlds that people can enter, walk through, change, branch, compare, inspect, save, and share. It is designed for connected systems anywhere in the world: cities, companies, finance, supply chains, neural networks, CPUs, the internet, science, history, energy, ecosystems, and domains that do not yet have a custom model.

The browser performs every simulation locally. There is no account, API key, paid inference, or mandatory backend.

## World engines

| World | Computation | What it demonstrates |
| --- | --- | --- |
| A Manhattan with fewer cars | Authored normalized scenario equations | Walkable city geometry, transit and freight tradeoffs, scenario time, branches |
| A network learning XOR | Actual seeded forward passes and full-batch backpropagation | Activations, weights, loss, decision field, reproducible training |
| The semiconductor supply web | Conserved monthly stock-flow simulation | Bottlenecks, inventory, backlog, delayed capacity, dependency risk |
| Universal world compiler | Question classification, bounded public-context retrieval, disclosed system archetypes, deterministic propagation | Companies, finance, CPUs, networks, science, history, energy, ecosystems, and other complex systems |

An authored match routes directly to its reviewed model with no network request. Another question enters the universal cascade: classify the system, retrieve up to four public context pages when available, assemble entities and causal assumptions, run the deterministic simulation, and open the result. Research failure is a supported offline state.

Public references orient a generated world. They do not validate its generated causal links, generic sensitivities, or normalized outputs. Source DNA states that boundary inside every world.

## Enter the world

Every spatial world has two navigation scales:

- **Overview** orbits, pans, zooms, compares the structure, and traces connections.
- **Enter World** moves to a human-scale camera. Use WASD or arrow keys, drag to look, approach named entities, select them, and inspect what they mean. Touch controls appear on small screens.

The Manhattan scene includes a schematic island, streets, buildings, Central Park, water, bridges, transit, freight, and moving traffic. Generated CPU, ecosystem, energy, and general systems receive distinct procedural environments. World and X-ray views use the same current simulation state.

## Executable, inspectable state

A `.elsewhere` document contains bounded data: world type, controls, timeline, immutable baseline, scenario branches, mutation history, and, for generated worlds, a validated system blueprint with context sources. Imported documents never execute code. Zod rejects unknown fields, unsafe keys, invalid URLs, unknown evidence links, invalid graph references, altered runtime control contracts, broken branch ancestry, out-of-range values, and files above 1 MB.

The runtime produces metrics, nodes, causal edges, warnings, and time series. Source DNA separates facts, assumptions, derived values, simulation outputs, and speculation. X-ray exposes equations and dependencies. Why traces causes. Challenge lists boundaries and applies deterministic stress tests.

```text
Question
  → deterministic authored-model router
  → bounded public-context research when needed
  → reviewed model or disclosed system archetype
  → validated .elsewhere document
  → pure local simulation
  → nodes + causal edges + metrics + time series
  → overview / enter-world / accessible data view
  → mutation → automatic branch → cascading local save
```

Important modules:

- `src/core/definitions.ts`: authored catalog and the safe universal runtime contract.
- `src/core/universal.ts`: system classification, bounded research, blueprint construction, exact in-session research cache, and generic simulation.
- `src/core/simulation.ts`: pure authored and generated model execution with a bounded neural-result cache.
- `src/core/documents.ts`: compile, validate, serialize, branch, import, and reopen.
- `src/components/WorldScene.tsx`: reusable Three.js runtime, overview and walk modes, selection, cleanup, and 2D fallback.
- `src/storage.ts`: cascading persistence through a verified primary save and last-known-good recovery snapshot.

## Run and verify

Use Node.js 24 or a currently supported compatible Node release.

```bash
npm ci
npm run dev
npm run check
npx playwright install chromium
npm run test:e2e
node scripts/preserve-checks.mjs
```

`npm run check` runs TypeScript, ESLint, engine/document tests, and the production build. Browser tests cover Manhattan branching and comparison, neural computation and X-ray, universal CPU research and walk-through inspection, desktop/mobile layouts, and automated accessibility. Automated accessibility checks cover only part of WCAG; keyboard and visual review remain separate checks.

## Cascade

Elsewhere uses a deterministic-first cascade in the product and [SriBYJU/Cascade](https://github.com/SriBYJU/Cascade) in development.

The product route prefers a reviewed local model, then bounded context retrieval plus a local archetype, and always falls back to an explicit offline world. Exact research and neural computations use bounded caches. Saves use a primary snapshot plus recovery snapshot. No LLM call is required.

The development layer adds capability routing, bounded repository context, cache inspection, isolated work, deterministic validation, checkpoints, and metadata-only traces. It is not shipped to visitors. No savings percentage is claimed without a matched repeated benchmark. See [docs/CASCADE.md](docs/CASCADE.md).

## Deployment and cost

The production build is static. `.github/workflows/pages.yml` runs the full source check and deploys only `dist/` to GitHub Pages from `main`. Public GitHub Pages, browser storage, Wikipedia's public API, and local deterministic compute provide a path with zero mandatory recurring cost. Provider quotas and availability still apply; [ZERO-COST-ARCHITECTURE.md](ZERO-COST-ARCHITECTURE.md) records the boundaries.

## Known boundaries

- Generated system worlds are exploratory hypotheses rather than validated domain models or forecasts.
- The public research step currently uses English Wikipedia for bounded context and may return nothing.
- Authored city and supply-chain coefficients are educational assumptions and have not been empirically calibrated.
- The Manhattan geometry is schematic, and walk mode does not reproduce street-level geographic data.
- Local saves do not sync between devices unless exported or shared.
- Static hosting does not provide accounts, private cloud storage, or live multi-user collaboration.

See [NOVELTY.md](NOVELTY.md) for the comparison to adjacent tools, [design-system.md](design-system.md) for the visual contract, and [CONTINUE.md](CONTINUE.md) for the verified handoff state.

## Creator

Elsewhere was created by Shriyan Avadhanula. The creator image is reused from the public Capital Mastery repository; its exact source commit is recorded in `CONTINUE.md`.

MIT-licensed source. No fabricated users, partners, testimonials, forecasts, or citations.
