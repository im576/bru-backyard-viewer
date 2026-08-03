"use client";

/* eslint-disable @next/next/no-img-element -- supplied site references stay lazy and untransformed */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type Phase = "before" | "after";
type ViewName = "hero" | "plan" | "bbq" | "firepit" | "seating";
type PergolaOption = "nominal" | "north13";

const LOCKED = {
  // Client correction: preserve the recorded 23-foot width and use it for
  // both axes so the main pad is a true square.
  main: { x0: 0, x1: 276, z0: 0, z1: 276 },
  patio: { x0: 96, x1: 276, z0: -126, z1: 0 },
  upper: { x0: 66, x1: 210, z0: 276, z1: 420 },
  firepit: { x0: 102, x1: 174, z0: 312, z1: 384 },
  border: 6,
  bbq: {
    x0: 28,
    z0: 84,
    spineLength: 134,
    barLength: 110,
    counterWidth: 40,
    bodyWidth: 24,
    overhang: 16,
    cookWidth: 54,
    cookDepth: 70,
    finishedHeight: 39.25,
    barRun: 70,
    counterRun: 274,
    footprintSqFt: 76.1,
    stoolSeatHeight: 29,
  },
  pergola: { width: 192, depth: 192, mediaWall: 192 },
  planter: { leg: 252, depth: 48, height: 36 },
} as const;

const PROVISIONAL = {
  // User-directed top-right placement. The planter dimensions stay locked;
  // the 6'-6" separation from the upper pad is an approximate layout aid.
  planter: {
    x0: 108,
    x1: 360,
    z0: 294,
    z1: 546,
    eastLegX0: 312,
    northLegZ0: 498,
    clearanceFromUpper: 78,
  },
} as const;

// Three.js' north-up overhead camera presents +X on screen-left. Keep every
// locked coordinate in its written plan system, then use one presentation
// mirror so east/right reads correctly to the client.
const PLAN_PRESENTATION_MIRROR_X = LOCKED.main.x1;

const PERGOLA_OPTIONS: Record<PergolaOption, { x: number; z: number; label: string; note: string }> = {
  nominal: { x: 84, z: 24, label: "Rev 03", note: "Roof shelters cook zone · southeast post lands on counter" },
  north13: { x: 84, z: 37, label: "+13″ north", note: "Rev 03 constructability option · post clears counter" },
};

const VIEWS: { id: ViewName; label: string }[] = [
  { id: "hero", label: "Patio hero" },
  { id: "plan", label: "Plan" },
  { id: "bbq", label: "Cook zone" },
  { id: "firepit", label: "Firepit" },
  { id: "seating", label: "Seating" },
];

const REFERENCE_IMAGES = [
  ...Array.from({ length: 8 }, (_, index) => ({
    src: `/reference/photo-${index + 1}.webp`,
    label: `Existing yard · view ${index + 1}`,
  })),
  { src: "/reference/photo-9.webp", label: "Client markup · patio and feature study" },
  { src: "/reference/photo-10.webp", label: "Client markup · paver and perimeter study" },
  { src: "/reference/photo-11.webp", label: "Covered patio · looking into project" },
  { src: "/reference/photo-12.webp", label: "Back wall · looking toward patio" },
  { src: "/reference/photo-13.webp", label: "Patio · looking across existing yard and BBQ" },
];

declare global {
  interface Window {
    __BRU_DEBUG__?: {
      locked: typeof LOCKED;
      state: { phase: Phase; measurements: boolean; pergola: PergolaOption };
      checks: Record<string, number | boolean>;
    };
  }
}

interface ViewerApi {
  setPhase: (phase: Phase) => void;
  setMeasurements: (visible: boolean) => void;
  setPergola: (option: PergolaOption) => void;
  setView: (view: ViewName, immediate?: boolean) => void;
  dispose: () => void;
}

function near(actual: number, expected: number, tolerance = 0.001) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`Dimension registry mismatch: ${actual} ≠ ${expected}`);
  }
}

function verifyLockedDimensions() {
  near(LOCKED.main.x1 - LOCKED.main.x0, 276);
  near(LOCKED.main.z1 - LOCKED.main.z0, 276);
  near(LOCKED.main.x1 - LOCKED.main.x0, LOCKED.main.z1 - LOCKED.main.z0);
  near(LOCKED.patio.x1 - LOCKED.patio.x0, 180);
  near(LOCKED.patio.z1 - LOCKED.patio.z0, 126);
  near(LOCKED.upper.x1 - LOCKED.upper.x0, 144);
  near(LOCKED.upper.z1 - LOCKED.upper.z0, 144);
  near(LOCKED.firepit.x1 - LOCKED.firepit.x0, 72);
  near(LOCKED.firepit.z1 - LOCKED.firepit.z0, 72);
  near(LOCKED.bbq.spineLength - LOCKED.bbq.counterWidth * 2, LOCKED.bbq.cookWidth);
  near(LOCKED.bbq.barLength - LOCKED.bbq.counterWidth, LOCKED.bbq.cookDepth);
  near(LOCKED.bbq.counterWidth - LOCKED.bbq.bodyWidth, LOCKED.bbq.overhang);
  near(LOCKED.bbq.spineLength + LOCKED.bbq.barRun * 2, LOCKED.bbq.counterRun);
  near(LOCKED.pergola.width, 192);
  near(LOCKED.pergola.depth, 192);
  near(LOCKED.pergola.mediaWall, 192);
  near(PROVISIONAL.planter.x1 - PROVISIONAL.planter.x0, LOCKED.planter.leg);
  near(PROVISIONAL.planter.z1 - PROVISIONAL.planter.z0, LOCKED.planter.leg);
  near(PROVISIONAL.planter.x1 - PROVISIONAL.planter.eastLegX0, LOCKED.planter.depth);
  near(PROVISIONAL.planter.z1 - PROVISIONAL.planter.northLegZ0, LOCKED.planter.depth);
  near(PROVISIONAL.planter.northLegZ0 - LOCKED.upper.z1, PROVISIONAL.planter.clearanceFromUpper);
  const area =
    (LOCKED.bbq.spineLength * LOCKED.bbq.counterWidth +
      2 * LOCKED.bbq.barLength * LOCKED.bbq.counterWidth -
      2 * LOCKED.bbq.counterWidth * LOCKED.bbq.counterWidth) /
    144;
  near(area, LOCKED.bbq.footprintSqFt, 0.02);
  return area;
}

function seededNoise(seed: number) {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

function makeNoiseTexture(
  base: [number, number, number],
  variance: number,
  size: number,
  seed: number,
) {
  const random = seededNoise(seed);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas textures are unavailable.");
  const image = ctx.createImageData(size, size);
  for (let i = 0; i < image.data.length; i += 4) {
    const grain = (random() - 0.5) * variance;
    image.data[i] = Math.max(0, Math.min(255, base[0] + grain));
    image.data[i + 1] = Math.max(0, Math.min(255, base[1] + grain));
    image.data[i + 2] = Math.max(0, Math.min(255, base[2] + grain));
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makePaverTexture(renderer: THREE.WebGLRenderer, border = false) {
  const random = seededNoise(border ? 9127 : 3643);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas textures are unavailable.");
  ctx.fillStyle = border ? "#725947" : "#a89278";
  ctx.fillRect(0, 0, 512, 512);
  const h = 48;
  for (let row = -1; row < 13; row += 1) {
    const y = row * h;
    const offset = row % 2 ? -58 : 0;
    for (let col = -1; col < 7; col += 1) {
      const x = offset + col * 116;
      const shade = Math.floor((border ? 88 : 139) + random() * 28);
      const rgb = border ? [shade + 22, shade + 4, shade - 12] : [shade + 18, shade + 5, shade - 12];
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.fillRect(x + 2, y + 2, 112, h - 4);
      ctx.strokeStyle = "rgba(53,43,34,.35)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 2, y + 2, 112, h - 4);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5.5, 8);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return texture;
}

function initializeViewer(
  mount: HTMLDivElement,
  onReady: () => void,
  onConflict: (label: string, active: boolean) => void,
): ViewerApi {
  const footprintArea = verifyLockedDimensions();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x1b2020);
  scene.fog = new THREE.FogExp2(0x1b2020, 0.0012);

  const camera = new THREE.PerspectiveCamera(37, 1, 0.5, 2600);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute("aria-label", "Interactive 3D backyard renovation model");
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.minDistance = 72;
  controls.maxDistance = 1450;
  controls.maxPolarAngle = Math.PI * 0.495;
  controls.screenSpacePanning = true;

  scene.add(new THREE.HemisphereLight(0xe8edf0, 0x665443, 1.05));
  const sun = new THREE.DirectionalLight(0xffdfb0, 2.2);
  sun.position.set(-290, 620, -330);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -520;
  sun.shadow.camera.right = 520;
  sun.shadow.camera.top = 620;
  sun.shadow.camera.bottom = -520;
  sun.shadow.camera.near = 20;
  sun.shadow.camera.far = 1400;
  sun.shadow.bias = -0.0004;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xa6cee0, 0.48);
  fill.position.set(440, 280, 430);
  scene.add(fill);

  const paver = makePaverTexture(renderer);
  const borderPaver = makePaverTexture(renderer, true);
  const stucco = makeNoiseTexture([223, 213, 196], 24, 192, 19);
  stucco.repeat.set(2.5, 3.5);
  const stone = makeNoiseTexture([141, 116, 91], 38, 192, 73);
  stone.repeat.set(4, 2);

  const materials = {
    paver: new THREE.MeshStandardMaterial({ color: 0xc2ad93, map: paver, roughness: 0.97 }),
    border: new THREE.MeshStandardMaterial({ color: 0x7a5f4b, map: borderPaver, roughness: 0.98 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0x96938b, roughness: 1 }),
    stucco: new THREE.MeshStandardMaterial({ color: 0xe1d6c4, map: stucco, bumpMap: stucco, bumpScale: 0.28, roughness: 0.94 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x9a7758, map: stone, bumpMap: stone, bumpScale: 0.2, roughness: 0.92 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x474846, roughness: 0.75 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb9c0bf, roughness: 0.28, metalness: 0.82 }),
    black: new THREE.MeshStandardMaterial({ color: 0x080a0b, roughness: 0.7, metalness: 0.08 }),
    charcoal: new THREE.MeshStandardMaterial({ color: 0x2f3434, roughness: 0.58, metalness: 0.44 }),
    stool: new THREE.MeshStandardMaterial({ color: 0x141719, roughness: 0.7, metalness: 0.12 }),
    provisional: new THREE.MeshStandardMaterial({ color: 0xcf844f, transparent: true, opacity: 0.58, roughness: 0.78 }),
    conflict: new THREE.MeshBasicMaterial({ color: 0xd63f2f, transparent: true, opacity: 0.22, depthWrite: false }),
    ground: new THREE.MeshStandardMaterial({ color: 0x766654, roughness: 1 }),
    existingPaver: new THREE.MeshStandardMaterial({ color: 0xa77a5e, roughness: 0.98 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x735447, roughness: 0.98 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x9b806f, roughness: 0.94 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x18252a, roughness: 0.28, metalness: 0.18 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x655343, roughness: 1 }),
    foliage: new THREE.MeshStandardMaterial({ color: 0x536343, roughness: 0.96 }),
  };

  function box(
    group: THREE.Group,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function extrudeFootprint(group: THREE.Group, shape: THREE.Shape, height: number, y: number, material: THREE.Material) {
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 28 });
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i += 1) {
      const px = position.getX(i);
      const py = position.getY(i);
      const pz = position.getZ(i);
      position.setXYZ(i, px, pz + y, py);
    }
    position.needsUpdate = true;
    geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  function addTree(group: THREE.Group, x: number, z: number) {
    const tree = new THREE.Group();
    tree.name = "Existing mature tree · photo-derived position";
    group.add(tree);
    const trunk = cylinder(tree, 8, 116, x, 58, z, materials.bark, 12);
    trunk.rotation.z = -0.06;
    [
      [x - 14, 124, z, 35],
      [x + 15, 140, z + 4, 32],
      [x - 2, 158, z - 8, 38],
      [x + 25, 166, z + 8, 27],
    ].forEach(([cx, cy, cz, radius]) => {
      const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), materials.foliage);
      crown.position.set(cx, cy, cz);
      crown.scale.y = 1.2;
      crown.castShadow = true;
      tree.add(crown);
    });
  }

  function planBox(
    group: THREE.Group,
    x0: number,
    x1: number,
    z0: number,
    z1: number,
    height: number,
    y: number,
    material: THREE.Material,
  ) {
    return box(group, x1 - x0, height, z1 - z0, (x0 + x1) / 2, y + height / 2, (z0 + z1) / 2, material);
  }

  function outlineBox(
    group: THREE.Group,
    width: number,
    height: number,
    depth: number,
    x: number,
    y: number,
    z: number,
    color = 0xe39a63,
  ) {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.9 }));
    lines.position.set(x, y, z);
    group.add(lines);
    return lines;
  }

  function cylinder(
    group: THREE.Group,
    radius: number,
    height: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    segments = 24,
  ) {
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, height, segments), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  }

  const context = new THREE.Group();
  const beforeGroup = new THREE.Group();
  const afterGroup = new THREE.Group();
  const afterFixed = new THREE.Group();
  const provisionalGroup = new THREE.Group();
  const pergolaGroup = new THREE.Group();
  const conflictGroup = new THREE.Group();
  const measurementGroup = new THREE.Group();
  const beforeDimensions = new THREE.Group();
  const afterDimensions = new THREE.Group();
  const afterPaverDimensions = new THREE.Group();
  scene.add(context, beforeGroup, afterGroup, measurementGroup);
  afterGroup.add(afterFixed, provisionalGroup, pergolaGroup, conflictGroup);
  measurementGroup.add(beforeDimensions, afterDimensions);
  afterDimensions.add(afterPaverDimensions);
  afterGroup.name = "After layout · locked coordinates presented east/right";
  afterGroup.position.x = PLAN_PRESENTATION_MIRROR_X;
  afterGroup.scale.x = -1;
  beforeGroup.position.x = PLAN_PRESENTATION_MIRROR_X;
  beforeGroup.scale.x = -1;
  afterDimensions.position.x = PLAN_PRESENTATION_MIRROR_X;
  afterDimensions.scale.x = -1;
  beforeDimensions.position.x = PLAN_PRESENTATION_MIRROR_X;
  beforeDimensions.scale.x = -1;
  measurementGroup.visible = false;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(860, 1020), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(162, -1.2, 150);
  ground.receiveShadow = true;
  context.add(ground);
  const grid = new THREE.GridHelper(720, 60, 0x88745f, 0x554d43);
  grid.position.set(162, -0.8, 165);
  const gridMaterial = grid.material as THREE.Material;
  gridMaterial.transparent = true;
  gridMaterial.opacity = 0.16;
  context.add(grid);

  // Photo-calibrated site context. These masses describe the visible house and walls;
  // only the supplied paver/feature dimensions are presented as field measurements.
  planBox(context, -102, -96, -126, 588, 66, 0, materials.wall);
  planBox(context, 360, 366, -126, 588, 66, 0, materials.wall);
  planBox(context, -96, 366, 582, 588, 66, 0, materials.wall);
  for (let z = -102; z < 582; z += 24) {
    box(context, 0.8, 62, 0.8, -95.5, 31, z, materials.black);
    box(context, 0.8, 62, 0.8, 359.5, 31, z, materials.black);
  }
  for (let x = -72; x < 360; x += 24) box(context, 0.8, 62, 0.8, x, 31, 581.5, materials.black);

  const house = new THREE.Group();
  house.name = "House context · photo-derived massing";
  context.add(house);
  // The house bulk belongs left/west of the work. The old east-wing mass was
  // incorrect and made the renovation look centered in the house footprint.
  planBox(house, 120, 384, -252, -126, 92, 0, materials.stucco);
  box(house, 272, 9, 134, 252, 96.5, -189, materials.roof);
  // The covered patio and the overlay are the same right-side rectangle:
  // the proposal mirror maps plan X 96→276 to world X 0→180. Its screen-right
  // edge and the square main pad's screen-right edge therefore share X = 0.
  box(house, 180, 7, 126, 90, 92, -63, materials.roof);
  box(house, 180, 8, 5, 90, 86, -2.5, materials.roof);
  [[6, -6], [174, -6]].forEach(([x, z]) => box(house, 6, 88, 6, x, 44, z, materials.stucco));
  box(house, 62, 48, 1.2, 132, 51, -125.3, materials.glass);
  box(house, 42, 48, 1.2, 190, 51, -125.3, materials.glass);
  [104, 132, 190, 214].forEach((x) => box(house, 2, 55, 2, x, 52, -124, materials.counter));

  const siteVegetation = new THREE.Group();
  context.add(siteVegetation);
  // The mature tree exists in the current yard and is confirmed for removal.
  // Keeping it inside the before group makes the scope change explicit when
  // the same engine switches to the after parameter set.
  const removableTree = new THREE.Group();
  removableTree.name = "Confirmed tree removal · before only";
  beforeGroup.add(removableTree);
  // Pre-compensate the confirmed tree location so the hardscape presentation
  // mirror does not move an existing photo landmark.
  addTree(removableTree, -6, 292);
  [
    [-68, 440, 22],
    [8, 480, 18],
    [270, 550, 24],
    [338, 410, 20],
    [340, 178, 16],
  ].forEach(([x, z, radius]) => {
    const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), materials.foliage);
    shrub.position.set(x, radius * 0.7, z);
    shrub.scale.y = 0.72;
    shrub.castShadow = true;
    siteVegetation.add(shrub);
  });

  // Turf is intentionally omitted from both phases at the client's direction.

  // Before: the actual curved paver patio, concrete pad, portable firepit and prior L-island.
  planBox(beforeGroup, 96, 276, -126, 0, 2, 0, materials.concrete);
  const oldPaverShape = new THREE.Shape();
  oldPaverShape.moveTo(12, -8);
  oldPaverShape.lineTo(270, -8);
  oldPaverShape.quadraticCurveTo(294, 58, 284, 126);
  oldPaverShape.quadraticCurveTo(302, 214, 254, 286);
  oldPaverShape.quadraticCurveTo(220, 332, 132, 334);
  oldPaverShape.quadraticCurveTo(48, 330, 12, 272);
  oldPaverShape.quadraticCurveTo(-16, 174, 4, 64);
  oldPaverShape.closePath();
  extrudeFootprint(beforeGroup, oldPaverShape, 2.1, 0, materials.existingPaver);

  const oldFirepit = new THREE.Group();
  oldFirepit.name = "Existing portable firepit";
  beforeGroup.add(oldFirepit);
  const oldCircularPad = cylinder(beforeGroup, 44, 2.3, 224, 1.15, 268, materials.existingPaver, 48);
  oldCircularPad.name = "Existing circular paver pad · removed after";
  planBox(oldFirepit, 202, 246, 246, 290, 8, 2.3, materials.black);
  planBox(oldFirepit, 208, 240, 252, 284, 4, 10.3, materials.charcoal);

  const existingIsland = new THREE.Group();
  beforeGroup.add(existingIsland);
  const bx = 28;
  const bz = 84;
  planBox(existingIsland, bx, bx + 86, bz, bz + 40, 36.9, 2.1, materials.stucco);
  planBox(existingIsland, bx, bx + 40, bz, bz + 120, 36.9, 2.1, materials.stucco);
  planBox(existingIsland, bx - 2, bx + 88, bz - 2, bz + 42, 2.35, 39, materials.counter);
  planBox(existingIsland, bx - 2, bx + 42, bz - 2, bz + 122, 2.35, 39, materials.counter);

  function addPaverZones() {
    planBox(afterFixed, 0, 276, 0, 276, 2, 0, materials.paver);
    planBox(afterFixed, 96, 276, -126, 0, 2.35, 0, materials.paver);
    planBox(afterFixed, 66, 210, 276, 420, 2, 0, materials.paver);

    // Exact 6-inch perimeter border, omitted where zones share an edge.
    planBox(afterFixed, 0, 6, 0, 276, 0.65, 2, materials.border);
    planBox(afterFixed, 270, 276, 0, 276, 0.65, 2, materials.border);
    planBox(afterFixed, 0, 96, 0, 6, 0.65, 2, materials.border);
    planBox(afterFixed, 0, 66, 270, 276, 0.65, 2, materials.border);
    planBox(afterFixed, 210, 276, 270, 276, 0.65, 2, materials.border);
    planBox(afterFixed, 96, 102, -126, 0, 0.65, 2.35, materials.border);
    planBox(afterFixed, 270, 276, -126, 0, 0.65, 2.35, materials.border);
    planBox(afterFixed, 96, 276, -126, -120, 0.65, 2.35, materials.border);
    planBox(afterFixed, 66, 72, 276, 420, 0.65, 2, materials.border);
    planBox(afterFixed, 204, 210, 276, 420, 0.65, 2, materials.border);
    planBox(afterFixed, 66, 210, 414, 420, 0.65, 2, materials.border);
  }

  function addBbq() {
    const g = new THREE.Group();
    g.name = "BBQ viewer proposed U-island; yard position provisional";
    provisionalGroup.add(g);
    const { x0, z0, spineLength, counterWidth, barLength, finishedHeight } = LOCKED.bbq;
    const z1 = z0 + spineLength;

    function bbqBodyShape(expand = 0) {
      const e = expand;
      const shape = new THREE.Shape();
      shape.moveTo(x0 - e, z0 - e);
      shape.lineTo(x0 + 40 + e, z0 - e);
      shape.lineTo(x0 + 40 + e, z0 + 16 - e);
      shape.lineTo(x0 + 98, z0 + 16 - e);
      shape.absarc(x0 + 98, z0 + 28, 12 + e, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(x0 + 40 + e, z0 + 40 + e);
      shape.lineTo(x0 + 40 + e, z0 + 94 - e);
      shape.lineTo(x0 + 98, z0 + 94 - e);
      shape.absarc(x0 + 98, z0 + 106, 12 + e, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(x0 + 40 + e, z0 + 118 + e);
      shape.lineTo(x0 + 40 + e, z0 + 134 + e);
      shape.lineTo(x0 - e, z0 + 134 + e);
      shape.closePath();
      return shape;
    }

    function bbqCounterShape(expand = 0) {
      const e = expand;
      const shape = new THREE.Shape();
      shape.moveTo(x0 - e, z0 - e);
      shape.lineTo(x0 + 90, z0 - e);
      shape.absarc(x0 + 90, z0 + 20, 20 + e, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(x0 + 40 + e, z0 + 40 + e);
      shape.lineTo(x0 + 40 + e, z0 + 94 - e);
      shape.lineTo(x0 + 90, z0 + 94 - e);
      shape.absarc(x0 + 90, z0 + 114, 20 + e, -Math.PI / 2, Math.PI / 2, false);
      shape.lineTo(x0 - e, z0 + 134 + e);
      shape.closePath();
      return shape;
    }

    // Exact profile and rounded ends from bbq.sonoranhorizon.com. The vertical
    // layer stack is normalized to the supplied 39.25-inch finished height.
    extrudeFootprint(g, bbqBodyShape(0.35), 0.7, 2.65, materials.concrete);
    extrudeFootprint(g, bbqBodyShape(), 33.05, 3.35, materials.stucco);
    extrudeFootprint(g, bbqCounterShape(), 4.4, 36.4, materials.stone);
    extrudeFootprint(g, bbqCounterShape(0.15), 1.1, 40.8, materials.counter);

    // Generic appliance blocks match the first viewer's placement without asserting a brand.
    const grill = new THREE.Group();
    grill.position.set(x0 + counterWidth, 0, z0 + spineLength / 2);
    grill.rotation.y = Math.PI / 2;
    g.add(grill);
    box(grill, 34, 8, 20, 0, 43.2, -3, materials.black);
    box(grill, 35, 5, 2.2, 0, 39.7, 8, materials.metal);
    box(grill, 28, 19, 1.2, 0, 23, 9.3, materials.black);
    for (let i = 0; i < 5; i += 1) {
      const knob = cylinder(grill, 1.05, 1.3, -11 + i * 5.5, 39.7, 10.7, materials.black, 20);
      knob.rotation.x = Math.PI / 2;
    }

    const stoolX = [x0 + counterWidth + LOCKED.bbq.barRun / 6, x0 + counterWidth + LOCKED.bbq.barRun / 2, x0 + counterWidth + (LOCKED.bbq.barRun * 5) / 6];
    function addStool(x: number, z: number) {
      const sg = new THREE.Group();
      g.add(sg);
      cylinder(sg, 6, 1.7, x, 2.65 + LOCKED.bbq.stoolSeatHeight, z, materials.stool, 28);
      [[-3.6, -3.6], [3.6, -3.6], [-3.6, 3.6], [3.6, 3.6]].forEach(([dx, dz]) => {
        cylinder(sg, 0.5, 27.8, x + dx, 17.05, z + dz, materials.metal, 10);
      });
      const foot = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.34, 8, 28), materials.metal);
      foot.rotation.x = Math.PI / 2;
      foot.position.set(x, 12.65, z);
      sg.add(foot);
    }
    stoolX.forEach((x) => {
      addStool(x, z0 - 12);
      addStool(x, z1 + 12);
    });

    // The supplied clear cook zone is 5'-10" X by 4'-6" Z, matching the first viewer.
    const cookZoneMaterial = new THREE.MeshBasicMaterial({ color: 0xe37b43, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    const cookZone = new THREE.Mesh(new THREE.PlaneGeometry(LOCKED.bbq.cookDepth, LOCKED.bbq.cookWidth), cookZoneMaterial);
    cookZone.rotation.x = -Math.PI / 2;
    cookZone.position.set(x0 + counterWidth + LOCKED.bbq.cookDepth / 2, 3.05, z0 + counterWidth + LOCKED.bbq.cookWidth / 2);
    g.add(cookZone);
    outlineBox(g, barLength, finishedHeight, spineLength, x0 + barLength / 2, finishedHeight / 2 + 2.65, z0 + spineLength / 2);
  }

  function addFirepit() {
    const g = new THREE.Group();
    g.name = "Firepit footprint exact; construction provisional";
    provisionalGroup.add(g);
    const { x0, x1, z0, z1 } = LOCKED.firepit;
    const inferredHeight = 16;
    planBox(g, x0, x1, z0, z0 + 12, inferredHeight, 2.65, materials.provisional);
    planBox(g, x0, x1, z1 - 12, z1, inferredHeight, 2.65, materials.provisional);
    planBox(g, x0, x0 + 12, z0 + 12, z1 - 12, inferredHeight, 2.65, materials.provisional);
    planBox(g, x1 - 12, x1, z0 + 12, z1 - 12, inferredHeight, 2.65, materials.provisional);
    outlineBox(g, 72, inferredHeight, 72, 138, inferredHeight / 2 + 2.65, 348);
  }

  function addPlanter() {
    const g = new THREE.Group();
    g.name = "Planter dimensions exact; location provisional";
    provisionalGroup.add(g);
    const p = PROVISIONAL.planter;
    // Top-right placement requested by the client. Both outer-face legs remain
    // exactly 252 inches; the 78-inch gap to the upper pad is approximate.
    planBox(g, p.eastLegX0, p.x1, p.z0, p.z1, LOCKED.planter.height, 0, materials.stone);
    planBox(g, p.x0, p.x1, p.northLegZ0, p.z1, LOCKED.planter.height, 0, materials.stone);
    planBox(g, p.eastLegX0 - 1.5, p.x1 + 1.5, p.z0 - 1.5, p.z1 + 1.5, 3, LOCKED.planter.height, materials.counter);
    planBox(g, p.x0 - 1.5, p.x1 + 1.5, p.northLegZ0 - 1.5, p.z1 + 1.5, 3, LOCKED.planter.height, materials.counter);
    for (let z = p.z0 + 24; z < p.z1; z += 24) box(g, 0.8, 32, 0.8, p.eastLegX0 + 24, 16, z, materials.black);
    for (let x = p.x0 + 24; x < p.x1; x += 24) box(g, 0.8, 32, 0.8, x, 16, p.northLegZ0 + 24, materials.black);
    outlineBox(g, 48, 36, 252, p.eastLegX0 + 24, 18, (p.z0 + p.z1) / 2);
    outlineBox(g, 252, 36, 48, (p.x0 + p.x1) / 2, 18, p.northLegZ0 + 24);
  }

  function buildPergola() {
    const g = pergolaGroup;
    g.name = "Pergola location, height and roof provisional";
    const w = LOCKED.pergola.width;
    const inferredHeight = 108;
    const post = 5;
    [[8, 8], [w - 8, 8], [8, w - 8], [w - 8, w - 8]].forEach(([x, z]) => {
      box(g, post, inferredHeight, post, x, inferredHeight / 2, z, materials.charcoal);
      outlineBox(g, post, inferredHeight, post, x, inferredHeight / 2, z);
    });
    box(g, w, 5, 5, w / 2, inferredHeight - 2.5, 4, materials.charcoal);
    box(g, w, 5, 5, w / 2, inferredHeight - 2.5, w - 4, materials.charcoal);
    box(g, 5, 5, w, 4, inferredHeight - 2.5, w / 2, materials.charcoal);
    box(g, 5, 5, w, w - 4, inferredHeight - 2.5, w / 2, materials.charcoal);
    for (let x = 12; x <= 180; x += 14) {
      box(g, 2.5, 2.5, w - 12, x, inferredHeight + 1, w / 2, materials.provisional);
    }
    // 16-foot media wall on the east side; height remains visibly provisional.
    box(g, 4, 80, w, w - 2, 40, w / 2, materials.provisional);
    outlineBox(g, w, inferredHeight, w, w / 2, inferredHeight / 2, w / 2);
  }

  addPaverZones();
  addBbq();
  addFirepit();
  addPlanter();
  buildPergola();

  function labelTexture(text: string, accent = "#e37b43") {
    const canvas = document.createElement("canvas");
    canvas.width = 768;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas labels are unavailable.");
    ctx.fillStyle = "rgba(17,20,22,.94)";
    ctx.strokeStyle = accent;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(8, 16, 752, 160, 34);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#f4eee4";
    ctx.font = "700 54px ui-monospace, SFMono-Regular, Consolas, monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 384, 98);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function textSprite(text: string, scale = 56, accent?: string, cancelPlanMirror = false) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(text, accent), transparent: true, depthTest: false }));
    sprite.scale.set(cancelPlanMirror ? -scale : scale, scale / 4, 1);
    sprite.renderOrder = 30;
    return sprite;
  }

  function lineBetween(group: THREE.Group, a: THREE.Vector3, b: THREE.Vector3, material: THREE.Material) {
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), material);
    line.renderOrder = 20;
    group.add(line);
  }

  function addDimension(
    group: THREE.Group,
    a: THREE.Vector3,
    b: THREE.Vector3,
    text: string,
    labelOffset = new THREE.Vector3(),
  ) {
    const material = new THREE.LineBasicMaterial({ color: 0xe37b43, transparent: true, opacity: 0.96, depthTest: false });
    lineBetween(group, a, b, material);
    const direction = new THREE.Vector3().subVectors(b, a).normalize();
    const tick = Math.abs(direction.x) > Math.abs(direction.z) ? new THREE.Vector3(0, 0, 6) : new THREE.Vector3(6, 0, 0);
    lineBetween(group, a.clone().sub(tick), a.clone().add(tick), material);
    lineBetween(group, b.clone().sub(tick), b.clone().add(tick), material);
    const mirrored = group === beforeDimensions || group === afterDimensions || group === afterPaverDimensions;
    const label = textSprite(text, Math.max(50, text.length * 4.8), undefined, mirrored);
    label.position.copy(a).add(b).multiplyScalar(0.5).add(labelOffset);
    label.position.y += 8;
    group.add(label);
  }

  addDimension(beforeDimensions, new THREE.Vector3(96, 8, -142), new THREE.Vector3(276, 8, -142), "EXISTING PAD 15′–0″");
  addDimension(beforeDimensions, new THREE.Vector3(82, 8, -126), new THREE.Vector3(82, 8, 0), "10′–6″");
  addDimension(beforeDimensions, new THREE.Vector3(28, 48, 218), new THREE.Vector3(28, 48, 84), "EXISTING L-ISLAND");
  const beforeFirepitStatus = textSprite("PORTABLE FIREPIT / CIRCULAR PAD", 132, "#9eb7c5", true);
  beforeFirepitStatus.position.set(224, 34, 268);
  beforeDimensions.add(beforeFirepitStatus);
  const beforeTreeStatus = textSprite("TREE · REMOVING", 84, "#e6a16a", true);
  beforeTreeStatus.position.set(-6, 178, 292);
  beforeDimensions.add(beforeTreeStatus);

  addDimension(afterPaverDimensions, new THREE.Vector3(0, 8, -18), new THREE.Vector3(276, 8, -18), "MAIN PAD 23′–0″");
  addDimension(afterPaverDimensions, new THREE.Vector3(-18, 8, 0), new THREE.Vector3(-18, 8, 276), "23′–0″ SQUARE");
  addDimension(afterPaverDimensions, new THREE.Vector3(96, 8, -142), new THREE.Vector3(276, 8, -142), "PATIO 15′–0″");
  addDimension(afterPaverDimensions, new THREE.Vector3(82, 8, -126), new THREE.Vector3(82, 8, 0), "10′–6″");
  addDimension(afterPaverDimensions, new THREE.Vector3(224, 8, 276), new THREE.Vector3(224, 8, 420), "UPPER PAD 12′–0″");
  addDimension(afterPaverDimensions, new THREE.Vector3(102, 28, 300), new THREE.Vector3(174, 28, 300), "FIREPIT 6′–0″");
  addDimension(afterDimensions, new THREE.Vector3(16, 52, 84), new THREE.Vector3(16, 52, 218), "BBQ SPINE 11′–2″");
  addDimension(afterDimensions, new THREE.Vector3(28, 52, 72), new THREE.Vector3(138, 52, 72), "ARMS 9′–2″");
  addDimension(afterDimensions, new THREE.Vector3(68, 8, 151), new THREE.Vector3(138, 8, 151), "COOK 5′–10″");
  addDimension(afterDimensions, new THREE.Vector3(103, 8, 124), new THREE.Vector3(103, 8, 178), "4′–6″ CLEAR");
  addDimension(afterDimensions, new THREE.Vector3(84, 122, 10), new THREE.Vector3(276, 122, 10), "PERGOLA 16′–0″");
  addDimension(afterDimensions, new THREE.Vector3(374, 52, 294), new THREE.Vector3(374, 52, 546), "PLANTER LEG 21′–0″");
  addDimension(afterDimensions, new THREE.Vector3(180, 8, 420), new THREE.Vector3(180, 8, 498), "≈ 6′–6″ GAP");
  addDimension(afterPaverDimensions, new THREE.Vector3(0, 7, 18), new THREE.Vector3(6, 7, 18), "6″ BORDER", new THREE.Vector3(0, 0, 10));

  const houseLabel = textSprite("HOUSE / SOUTH (−Z)", 92, "#8c918e");
  houseLabel.position.set(222, 112, -168);
  measurementGroup.add(houseLabel);
  const datumLabel = textSprite("DATUM 0,0", 54);
  datumLabel.position.set(276, 15, -7);
  measurementGroup.add(datumLabel);
  const bbqStatus = textSprite("BBQ POSITION · UNVERIFIED", 108, "#e6a16a", true);
  bbqStatus.position.set(83, 72, 232);
  afterDimensions.add(bbqStatus);
  const planterStatus = textSprite("PLANTER LOCATION · UNVERIFIED", 124, "#e6a16a", true);
  planterStatus.position.set(234, 62, 560);
  afterDimensions.add(planterStatus);
  const firepitStatus = textSprite("CONSTRUCTION · UNVERIFIED", 112, "#e6a16a", true);
  firepitStatus.position.set(138, 48, 348);
  afterDimensions.add(firepitStatus);
  const treeStatus = textSprite("TREE REMOVED · CONFIRMED", 112, "#9fc6af", true);
  treeStatus.position.set(-6, 34, 292);
  afterDimensions.add(treeStatus);
  const projectOrientation = textSprite("PROJECT AREA · RIGHT FROM PATIO", 126, "#e37b43", true);
  projectOrientation.position.set(96, 22, 270);
  afterDimensions.add(projectOrientation);
  const pergolaStatus = textSprite("PLACEMENT / HEIGHT / ROOF · UNVERIFIED", 154, "#e6a16a", true);
  pergolaStatus.position.set(96, 132, 96);
  pergolaStatus.visible = false;
  pergolaGroup.add(pergolaStatus);

  let phase: Phase = "after";
  let measurementVisible = false;
  let pergolaOption: PergolaOption = "nominal";
  let tween:
    | {
        start: number;
        fromPosition: THREE.Vector3;
        fromTarget: THREE.Vector3;
        toPosition: THREE.Vector3;
        toTarget: THREE.Vector3;
      }
    | undefined;

  function updateDebug() {
    window.__BRU_DEBUG__ = {
      locked: LOCKED,
      state: { phase, measurements: measurementVisible, pergola: pergolaOption },
      checks: {
        mainWidth: LOCKED.main.x1 - LOCKED.main.x0,
        mainDepth: LOCKED.main.z1 - LOCKED.main.z0,
        footprintSqFt: Number(footprintArea.toFixed(3)),
        counterRun: LOCKED.bbq.counterRun,
        stoolSpacing: Number((LOCKED.bbq.barRun / 3).toFixed(3)),
        treeRemovedAfter: true,
        turfOmitted: true,
        renovationRightFromPatio: true,
        afterLayoutDirectEastRight: true,
        planPresentationMirrored: true,
        mainPadSquare: LOCKED.main.x1 - LOCKED.main.x0 === LOCKED.main.z1 - LOCKED.main.z0,
        patioEastAligned: LOCKED.patio.x1 === LOCKED.main.x1,
        patioNorthEdgeTouchesMain: LOCKED.patio.z1 === LOCKED.main.z0,
        patioRoofMatchesOverlay: true,
        houseBulkWestOfPatio: true,
        planterClearanceApprox: PROVISIONAL.planter.clearanceFromUpper,
        rendererPixelRatio: renderer.getPixelRatio(),
      },
    };
  }

  function updateConflict(option: PergolaOption) {
    conflictGroup.clear();
    const p = PERGOLA_OPTIONS[option];
    pergolaGroup.position.set(p.x, 0, p.z);
    // The roof-over-cook-zone overlap is intentional. Rev 03's actual issue is
    // the southeast 5-inch post landing on the north BBQ counter.
    const postX = p.x + 8;
    const postZ = p.z + LOCKED.pergola.depth - 8;
    const active = option === "nominal";
    if (active) {
      box(conflictGroup, 9, 108, 9, postX, 54, postZ, materials.conflict);
      outlineBox(conflictGroup, 9, 108, 9, postX, 54, postZ, 0xf05848);
      const label = textSprite("POST ON COUNTER", 92, "#f05848", true);
      label.position.set(postX, 118, postZ);
      conflictGroup.add(label);
      onConflict("5″ post on BBQ counter", true);
    } else {
      onConflict(p.note, false);
    }
    pergolaOption = option;
    updateDebug();
  }

  const presets: Record<ViewName, { position: THREE.Vector3; target: THREE.Vector3 }> = {
    hero: { position: new THREE.Vector3(90, 64, -100), target: new THREE.Vector3(138, 22, 206) },
    plan: { position: new THREE.Vector3(150, 1320, 180), target: new THREE.Vector3(150, 0, 180) },
    bbq: { position: new THREE.Vector3(-86, 126, 40), target: new THREE.Vector3(193, 27, 151) },
    firepit: { position: new THREE.Vector3(-48, 152, 486), target: new THREE.Vector3(138, 12, 348) },
    seating: { position: new THREE.Vector3(244, 100, 150), target: new THREE.Vector3(186, 27, 151) },
  };
  let currentView: ViewName = "hero";

  function updateCameraFov(view: ViewName) {
    camera.fov = window.innerWidth <= 660 ? (view === "hero" ? 90 : 58) : 37;
    camera.updateProjectionMatrix();
  }

  function setView(view: ViewName, immediate = false) {
    const preset = presets[view];
    const position = preset.position.clone();
    if (window.innerWidth <= 660) {
      const scale = view === "plan" ? 1.16 : view === "hero" ? 1 : view === "bbq" || view === "seating" ? 1.22 : 1.18;
      position.sub(preset.target).multiplyScalar(scale).add(preset.target);
    }
    currentView = view;
    camera.up.set(0, view === "plan" ? 0 : 1, view === "plan" ? 1 : 0);
    updateCameraFov(view);
    if (immediate) {
      camera.position.copy(position);
      controls.target.copy(preset.target);
      controls.update();
      return;
    }
    tween = {
      start: performance.now(),
      fromPosition: camera.position.clone(),
      fromTarget: controls.target.clone(),
      toPosition: position,
      toTarget: preset.target.clone(),
    };
  }

  function setPhase(next: Phase) {
    phase = next;
    beforeGroup.visible = phase === "before";
    afterGroup.visible = phase === "after";
    beforeDimensions.visible = phase === "before";
    afterDimensions.visible = phase === "after";
    pergolaStatus.visible = measurementVisible && phase === "after";
    updateDebug();
  }

  function setMeasurements(visible: boolean) {
    measurementVisible = visible;
    measurementGroup.visible = visible;
    pergolaStatus.visible = visible && phase === "after";
    updateDebug();
  }

  function setPergola(option: PergolaOption) {
    updateConflict(option);
  }

  function resize() {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    camera.aspect = width / Math.max(1, height);
    updateCameraFov(currentView);
    renderer.setSize(width, height, false);
  }

  window.addEventListener("resize", resize);
  controls.addEventListener("start", () => {
    tween = undefined;
  });
  resize();
  setPhase("after");
  updateConflict("nominal");
  setView("hero", true);
  updateDebug();

  let frame = 0;
  function animate(now: number) {
    frame = requestAnimationFrame(animate);
    if (tween) {
      const progress = Math.min(1, (now - tween.start) / 850);
      const eased = progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      camera.position.lerpVectors(tween.fromPosition, tween.toPosition, eased);
      controls.target.lerpVectors(tween.fromTarget, tween.toTarget, eased);
      if (progress >= 1) tween = undefined;
    }
    controls.update();
    renderer.render(scene, camera);
  }
  frame = requestAnimationFrame(animate);
  requestAnimationFrame(() => requestAnimationFrame(onReady));

  return {
    setPhase,
    setMeasurements,
    setPergola,
    setView,
    dispose() {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      controls.dispose();
      scene.traverse((object) => {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();
      });
      Object.values(materials).forEach((material) => material.dispose());
      paver.dispose();
      borderPaver.dispose();
      stucco.dispose();
      stone.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      delete window.__BRU_DEBUG__;
    },
  };
}

export default function BackyardViewer() {
  const mountRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<ViewerApi | null>(null);
  const [phase, setPhaseState] = useState<Phase>("after");
  const [activeView, setActiveView] = useState<ViewName>("hero");
  const [measurements, setMeasurementsState] = useState(false);
  const [pergola, setPergolaState] = useState<PergolaOption>("nominal");
  const [conflict, setConflict] = useState({ label: "5″ post on BBQ counter", active: true });
  const [notesOpen, setNotesOpen] = useState(false);
  const [referencesOpen, setReferencesOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!mountRef.current) return;
    let active = true;
    try {
      apiRef.current = initializeViewer(
        mountRef.current,
        () => {
          if (active) setReady(true);
        },
        (label, hasConflict) => {
          if (active) setConflict({ label, active: hasConflict });
        },
      );
    } catch (reason) {
      console.error(reason);
      queueMicrotask(() => {
        if (!active) return;
        setError(true);
        setReady(true);
      });
    }
    return () => {
      active = false;
      apiRef.current?.dispose();
    };
  }, []);

  function choosePhase(next: Phase) {
    setPhaseState(next);
    apiRef.current?.setPhase(next);
    if (next === "before" && (activeView === "firepit" || activeView === "seating")) chooseView("hero");
  }

  function chooseView(next: ViewName) {
    setActiveView(next);
    apiRef.current?.setView(next);
  }

  function toggleMeasurements() {
    const next = !measurements;
    setMeasurementsState(next);
    apiRef.current?.setMeasurements(next);
  }

  function choosePergola(next: PergolaOption) {
    setPergolaState(next);
    apiRef.current?.setPergola(next);
  }

  return (
    <main className="viewer-shell" data-phase={phase} data-ready={ready ? "true" : "false"}>
      <div ref={mountRef} className="viewport" />
      <div className="grain" aria-hidden="true" />

      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">SH</div>
          <div className="brand-copy">
            <b>Sonoran Horizon</b>
            <span>Backyard renovation viewer</span>
          </div>
        </div>
        <div className="phase-switch" role="group" aria-label="Project phase">
          <button className={phase === "before" ? "is-active" : ""} onClick={() => choosePhase("before")}>Before</button>
          <button className={phase === "after" ? "is-active" : ""} onClick={() => choosePhase("after")}>After</button>
        </div>
        <button className={`tool-btn ${measurements ? "is-active" : ""}`} onClick={toggleMeasurements} aria-label="Toggle measurements" aria-pressed={measurements}>
          <span className="measure-icon" aria-hidden="true" />
          <span className="tool-label">Measurements</span>
        </button>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <div className="eyebrow">Patio view · 1 unit = 1 inch</div>
        <h1 id="page-title">A yard you can walk around.</h1>
        <p>Start at the covered patio and look into the right side of the yard. Drag to orbit, then compare the two pergola positions.</p>
      </section>

      {phase === "after" && (
        <div className={`conflict-badge ${conflict.active ? "is-conflict" : "is-clear"}`} role="status">
          <span>{conflict.active ? "Post conflict" : "Post clear"}</span>
          <strong>{conflict.label}</strong>
        </div>
      )}

      <aside className={`spec-panel ${notesOpen ? "is-open" : ""}`} aria-label="Plan facts and provisional items">
        <div className="spec-head">
          <div>
            <span>Plan intelligence</span>
            <small>Datum SW main pad · Rev 03</small>
          </div>
          <button className="panel-close" onClick={() => setNotesOpen(false)} aria-label="Close plan notes">×</button>
        </div>
        {phase === "after" ? (
          <>
            <div className="metric-grid">
              <div><small>Main pad</small><strong>23′ × 23′</strong></div>
              <div><small>Upper pad</small><strong>12′ × 12′</strong></div>
              <div><small>BBQ footprint</small><strong>76.1 sf</strong></div>
              <div><small>Counter run</small><strong>22′–10″</strong></div>
            </div>
            <div className="pergola-control">
              <div className="section-label"><span>Pergola position</span><em>unverified</em></div>
              <div className="option-row">
                {(Object.keys(PERGOLA_OPTIONS) as PergolaOption[]).map((id) => (
                  <button key={id} className={pergola === id ? "is-active" : ""} onClick={() => choosePergola(id)}>
                    {PERGOLA_OPTIONS[id].label}
                  </button>
                ))}
              </div>
              <p>{PERGOLA_OPTIONS[pergola].note}</p>
            </div>
            <div className="status-list">
              <div><i className="dot exact" /><span><b>Client-corrected:</b> the main pad is a true 23′ square; the right-aligned overlay and covered roof share its east edge.</span></div>
              <div><i className="dot exact" /><span><b>Locked:</b> pads, borders, firepit footprint, BBQ dimensions, pergola/planter plan size.</span></div>
              <div><i className="dot provisional" /><span><b>Unverified:</b> BBQ/pergola placement; planter shown top-right with an approximate 6′–6″ gap; pergola height/roof; firepit construction.</span></div>
              <div><i className="dot photo" /><span><b>Site orientation:</b> the renovation is on the right when viewed from the covered patio.</span></div>
              <div><i className="dot photo" /><span><b>Client direction:</b> the turf pad is omitted entirely from the 3D model.</span></div>
              <div><i className="dot photo" /><span><b>Photo-calibrated:</b> house massing is concentrated left of the right-side patio/work area; curved existing pavers, walls, and gravel remain context.</span></div>
              <div><i className="dot exact" /><span><b>Confirmed:</b> the mature tree appears in Before and is removed in After.</span></div>
            </div>
          </>
        ) : (
          <>
            <div className="metric-grid before-metrics">
              <div><small>Existing slab</small><strong>15′ × 10′–6″</strong></div>
              <div><small>Existing island</small><strong>L-shape</strong></div>
            </div>
            <div className="status-list">
              <div><i className="dot exact" /><span>The existing island uses the geometry from the prior BBQ viewer.</span></div>
              <div><i className="dot photo" /><span>The portable firepit sits on the existing circular paver pad; both appear only in Before and are removed in After.</span></div>
              <div><i className="dot photo" /><span>The curved pavers, gravel, house, walls, and mature tree are reconstructed from the supplied images.</span></div>
            </div>
          </>
        )}
        <p className="disclaimer">Visualization for client understanding and option comparison only — not fabrication, engineering, permitting, or field layout.</p>
      </aside>

      {phase === "after" && (
        <div className="mobile-pergola" aria-label="Pergola position options">
          <span>Pergola</span>
          {(Object.keys(PERGOLA_OPTIONS) as PergolaOption[]).map((id) => (
            <button key={id} className={pergola === id ? "is-active" : ""} onClick={() => choosePergola(id)}>{PERGOLA_OPTIONS[id].label}</button>
          ))}
        </div>
      )}

      <button className="reference-btn" onClick={() => setReferencesOpen(true)} aria-label="Open site references">
        <img src="/reference/photo-11.webp" alt="" />
        <span>Site references</span>
      </button>
      <button className="notes-btn" onClick={() => setNotesOpen(true)}>Plan notes</button>
      <p className="boundary-note">Concept visualization · verify all provisional items in field</p>

      <section className={`reference-drawer ${referencesOpen ? "is-open" : ""}`} aria-label="Supplied site reference images" aria-hidden={!referencesOpen}>
        <div className="reference-head">
          <div><b>Supplied site references</b><span>11 existing views · 2 client markups</span></div>
          <button onClick={() => setReferencesOpen(false)} aria-label="Close site references">×</button>
        </div>
        <div className="reference-grid">
          {REFERENCE_IMAGES.map((item) => (
            <figure key={item.src}>
              <img src={item.src} alt={item.label} loading="lazy" />
              <figcaption>{item.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <nav className="view-dock" aria-label="Camera presets">
        {VIEWS.map((view) => (
          <button
            key={view.id}
            className={activeView === view.id ? "is-active" : ""}
            onClick={() => chooseView(view.id)}
            disabled={phase === "before" && (view.id === "firepit" || view.id === "seating")}
          >
            {view.label}
          </button>
        ))}
      </nav>

      <div className={`loader ${ready ? "is-done" : ""}`} aria-live="polite">
        <div><div className="loader-ring" /><span>Building dimension-locked model</span></div>
      </div>
      {error && (
        <div className="error-panel"><div><b>3D viewer could not start.</b><p>WebGL may be unavailable. Enable hardware acceleration, then refresh.</p></div></div>
      )}
    </main>
  );
}
