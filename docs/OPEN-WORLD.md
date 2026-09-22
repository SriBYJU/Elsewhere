# Open-world visual direction

The reference target is a detailed, explorable 3D game world. The current browser implementation is an incremental procedural prototype, not AAA game fidelity or an exact reconstruction of a real place.

## Design

Figma: https://www.figma.com/design/Cr4esZpz7gmIrxHhhYhbyT

The street-world concept specifies full-screen exploration, readable building scale, material detail, compact world controls, a local map, contextual inspection, and keyboard/touch traversal. The drawing is concept art, not a screenshot of the runtime.

## Generated asset provenance

- File: `public/textures/higgsfield-brick.webp`
- Provider: Higgsfield, GPT Image 2, medium quality, 1024 × 1024.
- Job: `aee58c25-4d68-4bd3-9f33-5d5f7c916de2`
- Generated: 2026-09-21 UTC.
- Cost returned by preflight: 1 credit.
- Prompt: Seamlessly tileable photorealistic warm red-brown weathered brick wall material, orthographic front elevation, evenly lit diffuse albedo, fine mortar seams, subtle stains and age, no windows, no vegetation, no objects, no text, no perspective, no strong shadows. Entire square is wall surface. Architectural game texture.
- Intended use: a surface material on navigable three-dimensional geometry.

## Accuracy boundary

Scene props, street layouts, historical settlements, and environmental details are illustrative unless attached to specific reviewed evidence. Visual detail does not establish historical or scientific accuracy. The evidence/model workspace remains available from immersive exploration.

Additional generated textures:

- `public/textures/higgsfield-asphalt.webp`: Higgsfield GPT Image 2, job `682f512a-add5-4545-a386-167d5c5e1192`, 1024 × 1024. Photorealistic tileable unmarked asphalt, diffuse lighting, subtle aggregate and wear.
- `public/textures/higgsfield-forest.webp`: Higgsfield GPT Image 2, job `5e6b0726-96bc-400a-ba1f-dbd8049dd38f`, 1024 × 1024. Photorealistic tileable temperate forest ground with leaves, soil, moss, and small twigs.
- All three original PNGs were converted to WebP quality 86 at their original resolution: total download size fell from 8.2 MB to 1.18 MB. Brick runtime filename is `higgsfield-brick.webp`. Original PNG assets are preserved beside the repository in `../Elsewhere-texture-sources`.

## Playable release

`#/play/manhattan` opens directly in full-screen first-person traversal. The home page exposes this through Play the 3D world. `#/explore/manhattan` still opens the simulation workspace. Keyboard and touch navigation include collision, gravity, jump, sprint, drag look, optional pointer capture, node inspection, and a return to the model.

Lighting uses an analytic daylight sky and local cached sun shadows. Architectural and crowd geometry is instanced. The 70 pedestrians have articulated limbs, varied clothing, and a synchronized walking gait. This remains a procedural art direction; asset-authored buildings, detailed interiors, terrain streaming, and richer environmental interactions are future work.

The sky is rendered once into a small cube map rather than evaluating the atmosphere shader on every frame. On hardware graphics it also provides window reflections. Software graphics renderers use a lower pixel density and omit reflections/shadow maps to keep controls responsive. Inspection now checks distance and building occlusion; Manhattan inspection anchors are placed at walking height.
