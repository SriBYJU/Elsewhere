# Elsewhere continuation state

Updated: 2026-09-21

## Product direction

Elsewhere is global and domain-general: Question → Research → Model → Simulation → Interactive World. The requested visual direction is a detailed, playable open world comparable in ambition to Spider-Man. The current procedural browser release is an intermediate prototype; it does not meet AAA fidelity or recreate real locations exactly.

## Current implementation

- React, TypeScript, Vite, Three.js; static GitHub Pages with no mandatory paid inference.
- Universal compiler covers company, finance, supply-chain, CPU, internet, science, history, energy, ecosystem, and general systems. Historical time expressions take precedence over present-day place matches.
- `#/play/manhattan` opens the full-screen street-level game view; `#/explore/manhattan` opens the simulation workspace. Home has a prominent Play the 3D world link.
- Instanced city buildings, windows, roof equipment, sidewalks, crossings, parks, traffic, street fixtures and 70 articulated pedestrians. Daylight sky is baked once; hardware graphics add reflections and cached sun shadows, while software graphics use a lighter mode. Street-level inspection respects building occlusion.
- Keyboard/touch traversal, wall collision and sliding, gravity, jump, sprint, pointer capture, drag look, minimap and inspection. Escape first releases captured mouse; a subsequent Escape returns to the workspace.
- Context-sensitive historical/landscape environments; Virginia's historical setting no longer falls through to a generic six-node board or a Roman town.
- Generated Higgsfield surface textures (brick, asphalt, forest) total 1.18 MB as WebP. Figma design and asset provenance are in `docs/OPEN-WORLD.md`.
- Simulation controls, branches, comparison, evidence, X-ray, Why, Challenge, share and import/export remain available.
- Cascade routing and checkpoint/recovery implementation is documented in `docs/CASCADE.md`.

## Verification and release

- Remote: `https://github.com/SriBYJU/Elsewhere.git`; branch `main`.
- Live: `https://sribyju.github.io/Elsewhere/`.
- First playable environment checkpoint: `4444b20c7dd1ad810d33ebed114b033baebef545`, successful Pages workflow `35640015319`. Public HTML and texture verified HTTP 200.
- Street-level play checkpoint `afd4fed492cb415a041dadbf3ae7a9e42fbc7ff7` deployed successfully in workflow `35671876432`; public `release.json` matched the commit.
- `npm run check` passes: typecheck, lint, 39 unit tests and production build.
- Browser checks passed across 19 applicable cases after correcting desktop timing and a collision-test intersection location; 3 cases are intentionally skipped by device. Browser suite includes desktop Chromium and iPhone-sized WebKit. New traversal tests cover motion, stationary jumping, collision, Escape capture, held on-screen movement and release, and menu placement.
- `release.json` publishes the deployed Git SHA and build time; `.explorer[data-release]` identifies the loaded runtime. Check both to diagnose stale deployments.
- Local headless Chromium's software graphics can take much longer to compile shaders than WebKit; traversal tests use bounded longer timeouts.
- `node scripts/preserve-checks.mjs` tests the scoped Git preservation utility; it is separate from the browser suite.

## Remaining fidelity work

- Authored high-detail building and vegetation assets, interiors, richer environmental actions, and geographic/terrain streaming.
- Extend street-level anchors and contextual environmental actions across all world types.
- Expand physical environment packs for domains still represented schematically.
- Reviewed domain evidence and calibrated coefficients; visual detail is not evidence of accuracy.
- Establish approved visual baselines; screenshots alone are not visual-regression approval.
