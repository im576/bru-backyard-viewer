# Sonoran Horizon Backyard Renovation Viewer

Interactive Three.js before/after viewer for the full backyard renovation at `bru.sonoranhorizon.com`.

## Model basis

- One world unit equals one inch; X/Z is plan and Y is height.
- Datum is the southwest corner of the proposed main paver pad.
- Proposed pad, border, firepit footprint, BBQ, pergola plan size, and planter dimensions are locked from the client brief.
- The proposed U-island uses the same geometry and orientation as `bbq.sonoranhorizon.com`.
- Existing curved pavers, turf, gravel, portable firepit, house massing, perimeter walls, mature tree, and planting context are reconstructed from ten supplied site images.
- BBQ, pergola, and planter locations remain provisional. Pergola height/roof and firepit construction remain conceptual.
- The mature tree is present in Before and removed in After, as confirmed August 1, 2026.

This is a client-understanding and option-comparison visualization, not fabrication, engineering, permitting, or field-layout documentation.

## Commands

```bash
npm run dev
npm run build
```
