import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the backyard viewer shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Backyard Renovation Viewer — Sonoran Horizon<\/title>/i);
  assert.match(html, /Backyard renovation viewer/);
  assert.doesNotMatch(html, />Before</);
  assert.doesNotMatch(html, /Project phase/);
  assert.match(html, /Measurements/);
  assert.match(html, /26′ × 23′/);
  assert.match(html, /Optimal/);
  assert.match(html, /Photos/);
  assert.doesNotMatch(html, /Black\. White\. Built to gather\./);
  assert.doesNotMatch(html, /Irvin backyard · interactive 3D/);
  assert.match(html, /Previous camera scene/);
  assert.match(html, /Next camera scene/);
  assert.match(html, /Patio · left/);
  assert.doesNotMatch(html, />Plan</);
  assert.match(html, /Concept only · verify in field/);
});

test("keeps exact dimensions and provisional decisions explicit", async () => {
  const [viewer, layout] = await Promise.all([
    readFile(new URL("../app/BackyardViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(viewer, /main:\s*\{ x0: 0, x1: 276, z0: 0, z1: 276 \}/);
  assert.match(viewer, /patio:\s*\{ x0: 96, x1: 276, z0: -126, z1: 0 \}/);
  assert.match(viewer, /upper:\s*\{ x0: 66, x1: 210, z0: 276, z1: 420 \}/);
  assert.match(viewer, /firepit:\s*\{ x0: 102, x1: 174, z0: 312, z1: 384 \}/);
  assert.match(viewer, /finishedHeight: 39\.25/);
  assert.match(viewer, /counterRun: 274/);
  assert.match(viewer, /footprintSqFt: 76\.1/);
  assert.match(viewer, /width: 192, depth: 192/);
  assert.match(viewer, /POST ON COUNTER/);
  assert.match(viewer, /TREE REMOVED · CONFIRMED/);
  assert.match(viewer, /treeRemovedAfter: true/);
  assert.match(viewer, /turfOmitted: true/);
  assert.match(viewer, /afterLayoutDirectEastRight: true/);
  assert.match(viewer, /planPresentationMirrored: true/);
  assert.match(viewer, /afterGroup\.scale\.x = -1/);
  assert.doesNotMatch(viewer, /const beforeGroup/);
  assert.doesNotMatch(viewer, /type Phase/);
  assert.match(viewer, /mainPadSquare:/);
  assert.match(viewer, /patioEastAligned:/);
  assert.match(viewer, /patioNorthEdgeTouchesMain:/);
  assert.match(viewer, /patioRoofMatchesOverlay: true/);
  assert.match(viewer, /houseBulkWestOfPatio: true/);
  assert.match(viewer, /houseReturnWallVisible: true/);
  assert.match(viewer, /patioBackWallVisible: true/);
  assert.match(viewer, /clearanceFromUpper: 78/);
  assert.match(viewer, /≈ 6′–6″ GAP/);
  assert.match(viewer, /north: \{ x: 84, z: 37/);
  assert.match(viewer, /original: \{ x: 84, z: 24/);
  assert.match(viewer, /pergolaMovedNorth: true/);
  assert.match(viewer, /pergolaLeftRightUnchanged: true/);
  assert.match(viewer, /closedPergola: true/);
  assert.match(viewer, /mediaWallIntegrated: true/);
  assert.match(viewer, /leftSideConceptAdded: true/);
  assert.match(viewer, /afterPaletteMonochrome: true/);
  assert.match(viewer, /beforeModeRemoved: true/);
  assert.match(viewer, /mobilePresetCameraOnly: true/);
  assert.match(viewer, /controls\.enableRotate = !mobilePresetOnly/);
  assert.match(viewer, /controls\.enablePan = !mobilePresetOnly/);
  assert.match(viewer, /controls\.enableZoom = !mobilePresetOnly/);
  assert.match(viewer, /arrowCameraTour: true/);
  assert.match(viewer, /birdseyeRemoved: true/);
  assert.match(viewer, /firepitDetailed: true/);
  assert.match(viewer, /planterPlantingAdded: true/);
  assert.match(viewer, /planterSceneAdded: true/);
  assert.match(viewer, /fireToPatioSceneAdded: true/);
  assert.match(viewer, /pergolaDownlightsAdded: true/);
  assert.match(viewer, /patioLeft:/);
  assert.match(viewer, /patioRight:/);
  assert.match(viewer, /mainForward:/);
  assert.match(viewer, /planterClose:/);
  assert.match(viewer, /fireToPatio:/);
  assert.doesNotMatch(viewer, /\bplan:\s*\{/);
  assert.match(viewer, /renovationRightFromPatio: true/);
  assert.match(viewer, /photo-13\.webp/);
  assert.match(layout, /title: "Backyard Renovation Viewer — Sonoran Horizon"/);
  assert.match(layout, /viewportFit: "cover"/);
});
