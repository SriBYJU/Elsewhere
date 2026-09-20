# Elsewhere design system

## Direction
An editorial atlas that becomes an instrument. The world owns the canvas; restrained controls sit at its edges. UI/UX Pro Max's immersive-experience pattern informs progressive disclosure, keyboard alternatives, reduced motion, and mobile fallbacks. Its glass palette is intentionally replaced with opaque ink surfaces to meet the brief.

## Color
Background #090d10; raised #11191d; inset #0c1216; border #2b373b. Primary text #eef0e9; secondary #adb9b9; muted #94a6a9. Accent #d1ec9c (creation and active controls); cyan #85ccdb (evidence/direct effects); amber #eab878 (assumptions); rose #ec9a9a (warnings). No text conveyed through color alone. Scene geometry uses desaturated slate and sea green; model uncertainty uses dashed strokes.

## Typography
Self-hosted Space Grotesk 400/500/600/700 for display and interface; IBM Plex Mono 400/500 for coordinates, equations and metadata. Display clamp(44px,6.8vw,96px), tight -0.065em tracking, line-height 1.03. Page title 32px; section 22px; body 16px/1.6; controls 14px/1.4; metadata 11–12px/1.5 with .08em tracking. Data is tabular.

## Spacing and shape
4, 8, 12, 16, 24, 32, 48, 64, 96px. Content maximum 1440px; desktop outer 48px, mobile 20px. Controls radius 6px; panels 12px; avoid endless cards. Borders 1px; important sections divided by rules. Touch targets at least 44px. Shadows only on floating controls: 0 16px 60px #0005.

## Icons and data
Lucide 18px, 1.6 stroke. Labels accompany unusual icons. Quantitative outcomes show units and explicit model status. Comparison has baseline and scenario columns; uncertainty has ranges and labels. Charts expose text/data equivalents.

## Motion
Motion for React (free). Feedback 140ms; panel entry 240ms; scene transition 650ms; ease [0.22,1,0.36,1]. Animate transform and opacity. Causal propagation follows graph order. Reduced motion disables camera flights and pulses; all final states remain accessible. Animation loops pause on hidden documents and dispose on unmount. Compilation visualizes actual completed stages, with no claim of live research.

## Responsive and accessibility
Desktop >=1100px: full scene with parameter rail and evidence inspector. Tablet 720–1099: narrower rails. Mobile <720: scene first, controls beneath, vertically scrollable, horizontal content fits. Semantic headings, landmarks, labels, visible lime focus rings, skip link, modal Escape/focus restoration, and keyboard equivalents. Canvas has a labeled data alternative. Never disable zoom.
