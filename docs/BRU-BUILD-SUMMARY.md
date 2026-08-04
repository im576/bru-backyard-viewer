# BRU Backyard 3D Viewer — Build Summary and Design Record

**Document path:** `/Users/isidromarquez/.codex/visualizations/2026/08/01/019fbf51-5736-7622-a7c7-dee346d273e8/bru-site/docs/BRU-BUILD-SUMMARY.md`  
**Project source path:** `/Users/isidromarquez/.codex/visualizations/2026/08/01/019fbf51-5736-7622-a7c7-dee346d273e8/bru-site`  
**Primary 3D source:** `/Users/isidromarquez/.codex/visualizations/2026/08/01/019fbf51-5736-7622-a7c7-dee346d273e8/bru-site/app/BackyardViewer.tsx`  
**Live viewer:** <https://bru.sonoranhorizon.com>  
**Current unbranded plan PDF:** <https://bru.sonoranhorizon.com/downloads/backyard-plan.pdf>  
**Record date:** 2026-08-04

## Purpose of this record

This document explains the BRU backyard viewer as a product, a design, and a collaborative revision process. It records the project scope, evidence, architecture, design rationale, major changes, obstacles, verification method, and current limitations.

This is a practical rationale and decision record. It does not reproduce private token-by-token internal reasoning. Instead, it captures the useful design logic, alternatives considered, evidence used, decisions made, and why the final implementation took its present form.

## Executive summary

BRU is a mobile-friendly interactive 3D visualization of a full backyard renovation. It was built to help a homeowner understand the relationship among a new paver layout, an existing covered patio, a detailed U-shaped BBQ island, a closed-roof pergola with an integrated media wall, a firepit, an L-shaped planter, the house, perimeter walls, and the left side of the yard.

The application is not a video, a static rendering, a SketchUp embed, or a photogrammetric scan. It is a custom parametric scene built in TypeScript with Three.js. One model unit represents one inch. Most elements are assembled from lightweight boxes, cylinders, extruded shapes, procedural textures, lines, and text sprites. That approach keeps the site fast enough to open from a text message while allowing geometry, camera positions, and labels to be revised without rebuilding a large 3D asset.

The build evolved through repeated visual corrections. The original numerical brief established dimensions, but the supplied yard photos, aerial image, patio views, annotated sketches, and blueprint clarified that the project occupies the right side of the backyard when viewed from the covered patio. The homeowner/project lead repeatedly corrected orientation, patio placement, the left/right relationship, pergola position, house-wall visibility, planter placement, camera behavior, and the visual palette. Those corrections materially improved the result.

The current viewer uses a five-stop arrow-driven camera tour on phones, retains desktop orbit controls, defaults to an optimized pergola placement, contains an optional measurement layer, omits the former before mode and bird's-eye view, and uses a restrained black, gray, and white design language.

## Original BRU build brief

The following is the operative initial BRU brief reconstructed from the actual task conversation. The separately attached `pasted-text.txt` was Meta Ad Library research and was not the BRU brief.

> Build a mobile-friendly interactive 3D viewer for a full backyard renovation, using the same architecture and design language as the BBQ island viewer at `bbq.sonoranhorizon.com`. Follow the playbook at `company-brain/reference/interactive-3d-structure-viewer.md`. Publish at `bru.sonoranhorizon.com`.
>
> Coordinate system: one 3D unit equals one inch. Ground is `Y=0`, plan is in `X/Z`, height is `Y`. Datum is the southwest corner of the main paver pad at `(0,0)`, with the house to the south (`-Z`).
>
> Lock the main pad, patio overlay, upper pad, firepit, U-shaped BBQ island, BBQ bar overhangs and stools, 16-foot-square pergola and media wall, 21-foot-per-leg L-shaped planter, and six-inch contrasting paver border. Treat BBQ placement, pergola placement, planter location, pergola height/roof style, and firepit construction as provisional where stated.
>
> Model the pergola/BBQ conflict rather than hiding it, and provide a way to compare positions. Include free orbit/zoom, useful camera presets, an optional 3D measurement layer, and initially a before/after toggle using one engine. Keep the viewer lightweight, use a Sonoran Horizon title and favicon, test desktop and a 390×844-class phone viewport, and present the result as a visualization rather than fabrication, engineering, permitting, or field layout.
>
> Supporting material would include site photos from each side, the existing BBQ photos, sketches, and dimensioned plan sheets.

**Requested documentation output path:** `/Users/isidromarquez/.codex/visualizations/2026/08/01/019fbf51-5736-7622-a7c7-dee346d273e8/bru-site/docs/BRU-BUILD-SUMMARY.md`

## Inputs and evidence hierarchy

The viewer was built from several kinds of evidence that did not always agree at first. The project used this priority order:

1. Explicit dimensions and direct corrections from the user.
2. The correct dimensioned plan identified as `irvin-backyard-plan-rev03.pdf`, followed by corrected generated revisions.
3. Repeated site features visible across multiple real photos.
4. Annotated screenshots and sketches showing intended feature regions and orientation.
5. Aerial imagery for gross site relationships.
6. Common construction proportions only where the supplied material did not define a detail.

The repository currently contains 13 optimized reference images at:

`/Users/isidromarquez/.codex/visualizations/2026/08/01/019fbf51-5736-7622-a7c7-dee346d273e8/bru-site/public/reference/`

They include existing-yard views, patio-facing views, back-wall views, and client markups. The photos were not converted automatically into geometry. They were used as overlapping visual evidence. For example:

- The patio photos established which side of the yard the work occupies.
- The aerial image clarified the house, existing BBQ, turf, tree, and circular firepit-pad relationship.
- Multiple ground-level views distinguished the white BBQ mass from its shadow.
- The annotated images identified the intended paver outline, pergola, BBQ, firepit, and planter zones.
- The covered-patio photos exposed the house return walls and back patio wall that were initially underrepresented.
- The existing BBQ viewer supplied the detailed U-island design language and dimensional construction.

The images provided appearance and spatial context; written dimensions remained the controlling source for dimensioned features.

## Design scope

### Main hardscape

- Main paver area represented as the central project platform.
- 15′ × 10′-6″ patio overlay aligned to the right/east edge of the main pad and connected to the covered patio.
- 12′ × 12′ upper pad centered on the north side of the main pad.
- Six-inch contrasting perimeter border.
- Gray Phoenix-style paver palette with a black border.
- Turf removed from the proposed design.

### BBQ island

The BBQ is a detailed U-shaped island based on the separate BBQ viewer and the supplied dimensions:

- 11′-2″ spine.
- 9′-2″ arms.
- 3′-4″ counter width.
- 2′ masonry body with 16″ knee overhang.
- 5′-10″ × 4′-6″ clear cook zone.
- 39.25″ finished height.
- 76.1-square-foot footprint.
- 22′-10″ total counter run.
- Three stools per bar with 29″ seats.

The island includes separate body and countertop masses, dark counters, stools, grill/cook components, and enough detail to read clearly from both patio and firepit viewpoints without using a heavy manufacturer-specific model.

### Pergola and media wall

- 16′ × 16′ freestanding pergola.
- White structure and closed roof.
- Ceiling fan and downlights.
- Integrated white media wall with television and accessory details.
- Right/east alignment retained.
- Two layout states remain available: **Optimal** and **Original**.
- The viewer defaults to **Optimal**, shifted 13″ north while preserving left/right alignment.
- The original option visibly reports the post-on-counter conflict rather than concealing it.
- The optimized position produces zero post/BBQ collisions in the generated plan verification.

### Firepit

- Six-foot-square footprint centered on the upper pad.
- Modeled as a recognizable built fire feature rather than an abstract block.
- Includes a recessed dark center, stone/edge massing, and visible flame forms.
- Construction type remains conceptual and must be verified before construction.

### Planter

- White L-shaped planter.
- 21′ per leg, four feet deep, three feet tall.
- Located in the top-right/northeast portion of the yard.
- Approximately 6′-6″ beyond the upper pad.
- Includes planting rather than being shown as an empty wall.
- Location remains provisional pending field confirmation.

### House, patio, perimeter, and left yard

- House mass is concentrated more to the left, leaving the main renovation on the right.
- Existing covered patio and roof overlay align on the right side of the main pad.
- House return walls and the patio back wall are visible from the relevant camera angles.
- Perimeter walls frame the site.
- The existing central tree is removed in the proposed design.
- The left side of the yard is incorporated as contextual landscaping rather than omitted.
- Left-side planting is conceptual and intentionally does not reintroduce the removed turf pad.

## Current dimensional state and an important visual caveat

The initial brief described the main paver pad as 23′ wide by 26′ deep (`X 0→276`, `Z 0→312`). During visual review, the user later directed that the main pad appear as a perfect square. The 3D model was therefore changed to a 276″ × 276″ square. The user subsequently clarified that the number should read 26′ × 23′ but explicitly said: **“Don’t change it visually, only the number.”**

The current state intentionally preserves that instruction:

- The interactive viewer's visible main-pad footprint remains square.
- The interface and measurement labels display 26′ × 23′.
- The final dimensioned PDF uses the 23′ × 26′ plan extents and labels the pad 26′ × 23′.

This is acceptable only as a client visualization state. It is not internally suitable for fabrication or field layout. Before any construction-document use, the field-verified footprint and orientation must become one consistent geometry registry across both the viewer and PDF.

## Technical architecture

### Rendering

- **Three.js 0.179** renders the 3D scene.
- **React 19** and **TypeScript** drive the interface and state.
- **OrbitControls** supports desktop orbit and zoom.
- **Vite 8** produces the static production build.
- **Vinext/Next-compatible tooling** supports the application shell and server-render checks.
- **GitHub Pages** hosts the built site.
- `public/CNAME` maps the deployment to `bru.sonoranhorizon.com`.

### Parametric construction

Geometry is generated from dimension registries in `app/BackyardViewer.tsx`. The model uses:

- `THREE.Group` objects to isolate hardscape, measurements, landscaping, pergola, conflict overlays, and provisional elements;
- boxes and cylinders for walls, posts, counters, stools, appliances, lights, fans, and firepit parts;
- custom shapes and repeated paver elements for plan areas;
- procedural canvas textures and material parameters instead of large downloaded textures;
- canvas-generated billboard sprites for measurement and status labels;
- separate roof and pergola groups so placement can change without rebuilding the yard;
- one continuous render engine rather than separate pages.

### Performance choices

The viewer was intentionally kept light for phone delivery:

- no large GLB/FBX yard model;
- no baked 4K texture sets;
- no video background;
- procedural materials and primitive geometry;
- capped renderer pixel ratio;
- static optimized WebP reference images;
- single-page build served from a CDN-backed static host.

The current compiled JavaScript is still relatively large because Three.js is bundled, but it remains far smaller and easier to revise than a highly detailed photoreal asset package.

## Interaction design

### Desktop

Desktop users can orbit, zoom, and inspect the scene directly. The camera is constrained to useful distances and angles so the user does not accidentally travel below the ground or lose the project.

### Mobile

Early free-orbit behavior felt awkward on a phone. The user specifically requested set viewpoints and arrows. The final phone experience therefore disables free rotation, pan, and zoom and uses a five-stop guided tour:

1. **Patio · left** — begins under/near the patio and looks toward the left portion of the project.
2. **Patio · right** — looks across the right side and major work area.
3. **Main area** — moves forward into the central project space.
4. **Planter** — provides a closer view of the top-right planter and surrounding layout.
5. **Firepit · patio** — looks from the firepit back toward the patio, pergola, BBQ, and house.

Large previous/next arrows reduce touch precision demands. Camera movement eases between presets so the homeowner retains spatial orientation. Mobile-specific fields of view keep the project inside a narrow 390×844-class frame.

### Measurement and pergola controls

- Measurements are a separate toggleable 3D group.
- Labels are generated from the same coordinate concepts used by the geometry.
- The optimal pergola is the default.
- The original pergola position remains available as an option-comparison state and visibly identifies its conflict.

### Removed interaction

The original brief included before/after and bird's-eye/top views. Both were removed at the user's direction:

- The before mode was eliminated completely.
- The bird's-eye view was eliminated completely.
- The title-heavy hero copy was removed, leaving the controls and model dominant.

## Visual design language

The early yard presentation leaned too strongly toward a generic desert aesthetic. The user wanted a cleaner homeowner-selected palette. The final direction is:

- gray pavers;
- black paver border;
- white pergola and media wall;
- white planter;
- black/charcoal counters, appliances, fan, and accents;
- planted greenery used selectively for contrast;
- dark interface chrome that recedes behind the model.

The interface was deliberately reduced. Large marketing copy competed with the model and consumed valuable vertical space on a phone. The final layout prioritizes camera arrows, pergola selection, measurements, details, and the 3D viewport.

## How the real images changed the model

The photos were essential because the initial coordinate interpretation alone did not communicate the actual yard orientation. The most important corrections enabled by the image set were:

1. **Right-side project orientation.** The user explained that walking out of the patio places the project on the right, while the turf was on the left. This reversed an early interpretation.
2. **Existing BBQ identification.** A dark region initially read like the BBQ, but the user identified it as a shadow and pointed to the blurry white island beneath it.
3. **Firepit context.** The portable firepit was confirmed to sit on the small circular pad scheduled for replacement.
4. **Tree removal.** The central tree was confirmed for removal and was therefore omitted from the final proposed scene while retaining a measurement/status note.
5. **Patio alignment.** Patio views and user sketches showed the patio/overlay much farther right, with its right edge flush to the main pad and the house bulk extending left.
6. **House visibility.** Phone screenshots revealed missing/invisible house and patio walls from specific camera angles. The house return wall and patio back wall were restored.
7. **Pergola/BBQ orientation.** A marked-up overhead screenshot established that the pergola and BBQ needed to be flipped relative to an earlier version.
8. **Planter location.** The planter moved from an ambiguous perimeter position to the top-right/northeast corner, approximately 6–7 feet beyond the upper pad.

The images therefore did more than improve appearance; they corrected the project coordinate interpretation and the user's lived viewpoint of the yard.

## Collaboration and the user's role

The project improved through a tight visual feedback loop rather than a one-pass build. The user supplied the information that software alone could not infer reliably:

- original site photos from several sides;
- views taken from under the covered patio;
- an aerial image;
- two annotated concept sketches;
- a corrected blueprint filename and path;
- direct confirmation that the tree would be removed;
- direct confirmation that the turf pad should be removed;
- clarification of left/right orientation from the patio;
- identification of the real BBQ versus its shadow;
- the intended top-right planter location;
- patio overlay alignment;
- desired color and material direction;
- preferred pergola movement;
- preferred mobile navigation order;
- screenshots showing missing house walls;
- final PDF branding, naming, and pricing restrictions.

The screenshots of the live mobile viewer were particularly useful. They converted vague concerns such as “the wall is missing” or “the camera is awkward” into reproducible viewpoint-specific problems. This allowed fixes to target the actual homeowner experience rather than merely making the default desktop hero view look better.

The collaboration worked because corrections were increasingly concrete: “move north, not left,” “right edge lines up,” “remove the bird's-eye view,” “first look left, next look right,” and “the planter is top right.” Each correction became either a coordinate, a camera preset, a visible scene element, or an interface rule.

## Revision history and major decisions

The repository history records the build as a sequence of focused changes:

| Date | Change |
|---|---|
| 2026-08-01 | Initial BRU backyard renovation viewer built and custom-domain marker added. |
| 2026-08-02 | Static viewport height fixed; yard orientation corrected from patio views; Rev 03 plan alignment incorporated. |
| 2026-08-03 | Proposed layout flipped to match the sketch; patio aligned to the right; square-pad visual and right-side work layout corrected. |
| 2026-08-03 | Gray/black/white design introduced; left yard added; pergola refined and moved north without moving left. |
| 2026-08-03 | Before mode removed; mobile camera changed from free orbit to fixed presets and then to arrow navigation. |
| 2026-08-03 | Detailed firepit, planter plants, planter camera, and firepit-to-patio camera added. |
| 2026-08-03 | House-side wall and patio back wall restored after mobile screenshot review; title chrome simplified. |
| 2026-08-03 | Displayed main-pad dimensions corrected without changing the visible footprint, per instruction. |
| 2026-08-03 | Plan PDF published, corrected for mobile access, changed to the optimal pergola position, and finally stripped of branding, client naming, and pricing references. |

There are 19 focused commits from initial build through the current unbranded PDF revision.

## Main hurdles and how they were overcome

### 1. Coordinate truth versus visual truth

The dimensions provided a formal coordinate system, but early layouts did not match the user's visual understanding of the property. The solution was to preserve explicit dimension registries while using photos and annotated plans to resolve orientation, then expose provisional choices rather than pretending they were surveyed.

### 2. Left/right ambiguity

North-up plan views, camera orientation, and human descriptions of “left” and “right” can conflict. A presentation mirror was added for the overhead mental model, and patio-based camera views became the practical reference. The user’s repeated statement that the work is on the right side from the patio became the governing presentation rule.

### 3. Pergola/BBQ overlap

The initial requirement explicitly warned of an overlap. It was modeled rather than hidden. The original pergola position places a post on the BBQ counter. A 13-inch north shift preserves the right/media-wall alignment, keeps the 16-foot roof inside the pad, continues to cover the cooking area, and clears all posts. The original position remains available for comparison in the viewer.

### 4. Mobile camera control

Free touch orbit was technically correct but experientially poor. Instead of tuning sensitivity indefinitely, the interaction was redesigned around the homeowner's questions. Five fixed views and large arrows now provide a reliable tour. This was a product-design change, not merely a control adjustment.

### 5. Missing walls caused by viewpoint assumptions

Some house surfaces were absent or visually ineffective because the initial model emphasized the yard rather than the patio enclosure. Mobile screenshots exposed the issue. Explicit return-wall and back-wall geometry was added and checked from the affected presets.

### 6. Excess interface copy

The initial title and project language occupied too much phone space. The user requested only the useful controls, so the large title treatment and secondary explanatory copy were removed from the primary view.

### 7. PDF delivery on mobile

The first PDF handoff used a local filesystem link, which could not open on a phone. The file was moved into the site's public assets and deployed as a normal HTTPS URL. Later PDF revisions received a stable neutral URL: `/downloads/backyard-plan.pdf`.

### 8. PDF correctness and identity

Earlier PDF revisions included an incorrect residence label and company branding. The current Rev 06 is unbranded, contains no homeowner name, and was scanned after deployment for company/client names and pricing terms. The previous public copies were removed.

## PDF deliverable

The current PDF is generated from code rather than manually drawn. It includes:

- the paver zones and borders;
- BBQ footprint and cook zone;
- selected optimal pergola and media-wall alignment;
- firepit;
- top-right planter and approximate 6′-6″ separation;
- house/perimeter context;
- dimensions, legend, notes, and verification table;
- a clear not-for-construction status.

The current revision passes 36 geometry checks with zero failed checks and zero pergola-post collisions. It is unbranded and contains no pricing, costs, estimates, or dollar amounts.

Local generator and output paths:

- `/Users/isidromarquez/Documents/Codex/2026-08-02/my/outputs/make_blueprint-rev06.py`
- `/Users/isidromarquez/Documents/Codex/2026-08-02/my/outputs/backyard-plan-rev06.pdf`
- `/Users/isidromarquez/.codex/visualizations/2026/08/01/019fbf51-5736-7622-a7c7-dee346d273e8/bru-site/public/downloads/backyard-plan.pdf`

## Verification and quality controls

The build uses several layers of verification:

- runtime dimensional assertions for locked geometry relationships;
- calculated BBQ footprint validation;
- explicit checks for patio alignment, planter dimensions, and planter clearance;
- debug state exposed through `window.__BRU_DEBUG__`;
- server-render tests for critical interface text and removed features;
- ESLint;
- application build and static production build;
- Git diff whitespace checks;
- public HTTP checks after deployment;
- public PDF text extraction and scans for prohibited branding/client/pricing terms;
- generated-plan collision checks for pergola posts against the BBQ counter;
- rendered PDF image inspection for sheet layout and clipping.

The deployment process commits source changes, pushes `main`, waits for the GitHub Pages workflow, and then validates the live asset rather than assuming a successful push means a successful public update.

## Current user experience

When a homeowner opens <https://bru.sonoranhorizon.com> on a phone:

1. The model opens at the patio-left viewpoint.
2. Large arrows move through the five-scene tour.
3. The model shows the final proposed renovation only; there is no before mode.
4. The top/bird's-eye scene is absent.
5. The optimal pergola is selected by default.
6. The original pergola can still be selected to understand why it conflicts.
7. Measurements can be toggled separately.
8. Details and reference photos remain available without dominating the viewport.

## Known limitations and construction boundary

- This is a visualization, not a survey, permit drawing, engineering document, fabrication model, or field-layout source.
- Pergola height and roof build-up remain unverified.
- Firepit construction and utilities remain unverified.
- BBQ and planter locations require field confirmation.
- House and wall massing are photo-derived.
- Left-side planting is conceptual.
- The main-pad visual footprint/displayed-number discrepancy must be resolved before any construction-document use.
- No product manufacturer, engineering performance, or code-compliance claim should be inferred from the model.

## Recommended next improvements

If the viewer needs another production round, the highest-value next actions are:

1. Field-measure the four corners of the main pad and reconcile the viewer and PDF to one 26′ × 23′ coordinate registry.
2. Field-measure BBQ, pergola, planter, and house-wall offsets from the same datum.
3. Confirm the exact pergola product, finished height, post size, roof thickness, drainage, and media-wall construction.
4. Confirm firepit type, finished height, fuel source, clearances, and seating plan.
5. Replace conceptual plants with the homeowner's intended plant palette only after selection.
6. Add a discreet in-view PDF button if homeowners need direct access from the 3D viewer.
7. Consider code-splitting Three.js if first-load performance becomes a concern on slower cellular connections.

## Handoff

The BRU build can be maintained primarily through:

- `app/BackyardViewer.tsx` for dimensions, geometry, materials, cameras, and interaction;
- `app/globals.css` for responsive interface styling;
- `public/reference/` for real-site references;
- `tests/rendered-html.test.mjs` for interface regression checks;
- `public/downloads/backyard-plan.pdf` for the current public plan;
- `.github/workflows/pages.yml` for deployment;
- `public/CNAME` for the custom domain.

Any future geometric correction should be made once in a canonical dimension registry and then propagated to the 3D model, measurement labels, debug checks, and PDF generator together. That is the clearest path from a strong client visualization to a more reliable preconstruction coordination tool.
