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
  assert.match(html, /Before/);
  assert.match(html, /After/);
  assert.match(html, /Measurements/);
  assert.match(html, /Site references/);
  assert.match(html, /Layout conflict/);
  assert.match(html, /not fabrication, engineering, permitting, or field layout/);
});

test("keeps exact dimensions and provisional decisions explicit", async () => {
  const [viewer, layout] = await Promise.all([
    readFile(new URL("../app/BackyardViewer.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(viewer, /main:\s*\{ x0: 0, x1: 276, z0: 0, z1: 312 \}/);
  assert.match(viewer, /patio:\s*\{ x0: 96, x1: 276, z0: -126, z1: 0 \}/);
  assert.match(viewer, /upper:\s*\{ x0: 66, x1: 210, z0: 312, z1: 456 \}/);
  assert.match(viewer, /firepit:\s*\{ x0: 102, x1: 174, z0: 348, z1: 420 \}/);
  assert.match(viewer, /finishedHeight: 39\.25/);
  assert.match(viewer, /counterRun: 274/);
  assert.match(viewer, /footprintSqFt: 76\.1/);
  assert.match(viewer, /width: 192, depth: 192/);
  assert.match(viewer, /Layout conflict/);
  assert.match(viewer, /TREE REMOVED · CONFIRMED/);
  assert.match(viewer, /treeRemovedAfter: true/);
  assert.match(viewer, /turfLeftFromPatio: true/);
  assert.match(viewer, /renovationRightFromPatio: true/);
  assert.match(viewer, /photo-13\.webp/);
  assert.match(layout, /title: "Backyard Renovation Viewer — Sonoran Horizon"/);
  assert.match(layout, /viewportFit: "cover"/);
});
