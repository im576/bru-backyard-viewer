"use client";

/* eslint-disable @next/next/no-img-element -- supplied site references stay lazy and untransformed */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type SceneName = "patioLeft" | "patioRight" | "mainForward" | "planterClose" | "fireToPatio";
type PergolaOption = "north" | "original";

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
  north: { x: 84, z: 37, label: "Moved north", note: "Same alignment · shifted 13″ north" },
  original: { x: 84, z: 24, label: "Original", note: "Reference position · post intersects counter" },
};

const SCENES: { id: SceneName; label: string }[] = [
  { id: "patioLeft", label: "Patio · left" },
  { id: "patioRight", label: "Patio · right" },
  { id: "mainForward", label: "Main area" },
  { id: "planterClose", label: "Planter" },
  { id: "fireToPatio", label: "Firepit · patio" },
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
      state: { measurements: boolean; pergola: PergolaOption; mobilePresetOnly: boolean; scene: SceneName };
      checks: Record<string, number | boolean>;
    };
  }
}

interface ViewerApi {
  setMeasurements: (visible: boolean) => void;
  setPergola: (option: PergolaOption) => void;
  setScene: (scene: SceneName, immediate?: boolean) => void;
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
  ctx.fillStyle = border ? "#111417" : "#8e9397";
  ctx.fillRect(0, 0, 512, 512);
  const h = 48;
  for (let row = -1; row < 13; row += 1) {
    const y = row * h;
    const offset = row % 2 ? -58 : 0;
    for (let col = -1; col < 7; col += 1) {
      const x = offset + col * 116;
      const shade = Math.floor((border ? 18 : 116) + random() * (border ? 20 : 32));
      const rgb = border ? [shade, shade + 2, shade + 4] : [shade, shade + 2, shade + 4];
      ctx.fillStyle = `rgb(${rgb[0]},${rgb[1]},${rgb[2]})`;
      ctx.fillRect(x + 2, y + 2, 112, h - 4);
      ctx.strokeStyle = border ? "rgba(0,0,0,.68)" : "rgba(27,31,34,.48)";
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
  scene.background = new THREE.Color(0x64727e);
  scene.fog = new THREE.FogExp2(0x64727e, 0.0011);

  const camera = new THREE.PerspectiveCamera(37, 1, 0.5, 2600);
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.22;
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

  scene.add(new THREE.HemisphereLight(0xf5f8fa, 0x626a70, 1.38));
  const sun = new THREE.DirectionalLight(0xffffff, 2.55);
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
  const fill = new THREE.DirectionalLight(0xb8d1df, 0.52);
  fill.position.set(440, 280, 430);
  scene.add(fill);

  const paver = makePaverTexture(renderer);
  const borderPaver = makePaverTexture(renderer, true);
  const stucco = makeNoiseTexture([238, 239, 237], 15, 192, 19);
  stucco.repeat.set(2.5, 3.5);
  const stone = makeNoiseTexture([151, 154, 157], 26, 192, 73);
  stone.repeat.set(4, 2);

  const materials = {
    paver: new THREE.MeshStandardMaterial({ color: 0xa4a8ab, map: paver, roughness: 0.97 }),
    border: new THREE.MeshStandardMaterial({ color: 0x111315, map: borderPaver, roughness: 0.98 }),
    concrete: new THREE.MeshStandardMaterial({ color: 0xa7aaab, roughness: 1 }),
    stucco: new THREE.MeshStandardMaterial({ color: 0xf1f2ef, map: stucco, bumpMap: stucco, bumpScale: 0.2, roughness: 0.92 }),
    stone: new THREE.MeshStandardMaterial({ color: 0x9b9fa2, map: stone, bumpMap: stone, bumpScale: 0.16, roughness: 0.9 }),
    counter: new THREE.MeshStandardMaterial({ color: 0x222629, roughness: 0.68 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb9c0bf, roughness: 0.28, metalness: 0.82 }),
    black: new THREE.MeshStandardMaterial({ color: 0x080a0b, roughness: 0.7, metalness: 0.08 }),
    charcoal: new THREE.MeshStandardMaterial({ color: 0x2f3434, roughness: 0.58, metalness: 0.44 }),
    stool: new THREE.MeshStandardMaterial({ color: 0x141719, roughness: 0.7, metalness: 0.12 }),
    whiteMetal: new THREE.MeshStandardMaterial({ color: 0xf3f4f2, roughness: 0.45, metalness: 0.38 }),
    roofPanel: new THREE.MeshStandardMaterial({ color: 0xe8ebea, roughness: 0.5, metalness: 0.3 }),
    screen: new THREE.MeshStandardMaterial({ color: 0x080b0d, roughness: 0.2, metalness: 0.24 }),
    gravel: new THREE.MeshStandardMaterial({ color: 0x555b60, roughness: 1 }),
    path: new THREE.MeshStandardMaterial({ color: 0xb8babc, roughness: 0.96 }),
    soil: new THREE.MeshStandardMaterial({ color: 0x252823, roughness: 1 }),
    lavaRock: new THREE.MeshStandardMaterial({ color: 0x211d1d, roughness: 0.98 }),
    foliageAccent: new THREE.MeshStandardMaterial({ color: 0x75836c, roughness: 0.94 }),
    flower: new THREE.MeshStandardMaterial({ color: 0xe8ebe4, roughness: 0.8 }),
    flame: new THREE.MeshStandardMaterial({ color: 0xff8a32, emissive: 0xff4b16, emissiveIntensity: 2.6, transparent: true, opacity: 0.86 }),
    flameCore: new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xffa52f, emissiveIntensity: 3.2, transparent: true, opacity: 0.92 }),
    lightGlow: new THREE.MeshStandardMaterial({ color: 0xf2f5f6, emissive: 0xd7e6ef, emissiveIntensity: 1.2, roughness: 0.35 }),
    provisional: new THREE.MeshStandardMaterial({ color: 0xaeb8c1, transparent: true, opacity: 0.6, roughness: 0.78 }),
    conflict: new THREE.MeshBasicMaterial({ color: 0xd63f2f, transparent: true, opacity: 0.22, depthWrite: false }),
    ground: new THREE.MeshStandardMaterial({ color: 0x555b5f, roughness: 1 }),
    wall: new THREE.MeshStandardMaterial({ color: 0x5b5e61, roughness: 0.98 }),
    roof: new THREE.MeshStandardMaterial({ color: 0x707579, roughness: 0.94 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x18252a, roughness: 0.28, metalness: 0.18 }),
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
    color = 0xaab2b8,
  ) {
    const geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(width, height, depth));
    const lines = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.62 }));
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
  const afterGroup = new THREE.Group();
  const afterFixed = new THREE.Group();
  const leftSideGroup = new THREE.Group();
  const provisionalGroup = new THREE.Group();
  const pergolaGroup = new THREE.Group();
  const pergolaRoofGroup = new THREE.Group();
  const conflictGroup = new THREE.Group();
  const measurementGroup = new THREE.Group();
  const afterDimensions = new THREE.Group();
  const afterPaverDimensions = new THREE.Group();
  scene.add(context, afterGroup, measurementGroup);
  afterGroup.add(afterFixed, leftSideGroup, provisionalGroup, pergolaGroup, conflictGroup);
  pergolaGroup.add(pergolaRoofGroup);
  measurementGroup.add(afterDimensions);
  afterDimensions.add(afterPaverDimensions);
  afterGroup.name = "After layout · locked coordinates presented east/right";
  afterGroup.position.x = PLAN_PRESENTATION_MIRROR_X;
  afterGroup.scale.x = -1;
  afterDimensions.position.x = PLAN_PRESENTATION_MIRROR_X;
  afterDimensions.scale.x = -1;
  measurementGroup.visible = false;

  const ground = new THREE.Mesh(new THREE.PlaneGeometry(860, 1020), materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.position.set(162, -1.2, 150);
  ground.receiveShadow = true;
  context.add(ground);
  const grid = new THREE.GridHelper(720, 60, 0x7d858b, 0x454b50);
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
  // The covered patio is attached to the house, not freestanding. The plan's
  // 15-foot overlay maps to world X 0→180; the house begins immediately at its
  // remaining edge (X = 180) and continues west in plan / screen-left in the
  // approved presentation. This return is the stucco wall visible in the patio
  // photos and prevents the patio camera from seeing through to the perimeter.
  planBox(house, 180, 384, -126, 0, 92, 0, materials.stucco);
  box(house, 212, 9, 134, 282, 96.5, -63, materials.roof);
  box(house, 1.3, 46, 50, 179.3, 53, -70, materials.glass);
  [-97, -43].forEach((z) => box(house, 2.4, 54, 3.2, 178.3, 53, z, materials.counter));
  [26, 80].forEach((y) => box(house, 2.4, 3.2, 54, 178.3, y, -70, materials.counter));
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

  // Turf and the confirmed removal tree are omitted from the final proposal.

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

  function addLeftSideLandscape() {
    leftSideGroup.name = "Left-side landscape concept · turf omitted";
    planBox(leftSideGroup, -108, -8, -6, 426, 1.2, -0.1, materials.gravel);
    planBox(leftSideGroup, -10, -5, -6, 426, 1.3, 0.9, materials.border);

    // Large-format stepping pads and restrained planting carry the new palette
    // into the previously empty side of the yard without restoring the turf.
    [34, 104, 174, 244, 314, 384].forEach((z) => {
      planBox(leftSideGroup, -82, -24, z, z + 34, 1.7, 1.1, materials.path);
    });
    [62, 168, 274, 380].forEach((z) => {
      box(leftSideGroup, 3, 18, 3, -94, 9, z, materials.black);
      box(leftSideGroup, 4.2, 1.6, 4.2, -94, 18.8, z, materials.lightGlow);
    });
    [48, 145, 228, 342, 405].forEach((z, index) => {
      const shrub = new THREE.Mesh(new THREE.IcosahedronGeometry(index % 2 ? 12 : 15, 1), materials.foliage);
      shrub.position.set(index % 2 ? -96 : -90, 8, z);
      shrub.scale.set(1, 0.62, 1);
      shrub.castShadow = true;
      leftSideGroup.add(shrub);
    });
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
    const cookZoneMaterial = new THREE.MeshBasicMaterial({ color: 0xdfe4e7, transparent: true, opacity: 0.11, side: THREE.DoubleSide, depthWrite: false });
    const cookZone = new THREE.Mesh(new THREE.PlaneGeometry(LOCKED.bbq.cookDepth, LOCKED.bbq.cookWidth), cookZoneMaterial);
    cookZone.rotation.x = -Math.PI / 2;
    cookZone.position.set(x0 + counterWidth + LOCKED.bbq.cookDepth / 2, 3.05, z0 + counterWidth + LOCKED.bbq.cookWidth / 2);
    g.add(cookZone);
    outlineBox(g, barLength, finishedHeight, spineLength, x0 + barLength / 2, finishedHeight / 2 + 2.65, z0 + spineLength / 2);
  }

  function addFirepit() {
    const g = new THREE.Group();
    g.name = "Detailed firepit · footprint exact; construction provisional";
    provisionalGroup.add(g);
    const { x0, x1, z0, z1 } = LOCKED.firepit;
    const wallHeight = 18;
    const wall = 12;
    const baseY = 2.65;
    planBox(g, x0, x1, z0, z0 + wall, wallHeight, baseY, materials.stucco);
    planBox(g, x0, x1, z1 - wall, z1, wallHeight, baseY, materials.stucco);
    planBox(g, x0, x0 + wall, z0 + wall, z1 - wall, wallHeight, baseY, materials.stucco);
    planBox(g, x1 - wall, x1, z0 + wall, z1 - wall, wallHeight, baseY, materials.stucco);

    const capY = baseY + wallHeight;
    planBox(g, x0 - 1, x1 + 1, z0 - 1, z0 + 13, 3, capY, materials.counter);
    planBox(g, x0 - 1, x1 + 1, z1 - 13, z1 + 1, 3, capY, materials.counter);
    planBox(g, x0 - 1, x0 + 13, z0 + 13, z1 - 13, 3, capY, materials.counter);
    planBox(g, x1 - 13, x1 + 1, z0 + 13, z1 - 13, 3, capY, materials.counter);
    planBox(g, x0 + 14, x1 - 14, z0 + 14, z1 - 14, 2, baseY + 11, materials.lavaRock);

    const rockPositions = [
      [122, 334], [130, 332], [139, 334], [148, 332], [155, 337],
      [124, 345], [134, 343], [145, 345], [153, 348],
      [122, 357], [131, 361], [140, 356], [149, 360], [156, 356],
    ];
    rockPositions.forEach(([x, z], index) => {
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(2.1 + (index % 3) * 0.45, 0), materials.lavaRock);
      rock.position.set(x, baseY + 15.2, z);
      rock.scale.y = 0.65;
      rock.castShadow = true;
      g.add(rock);
    });
    const flames: Array<[number, number, number, number, THREE.Material]> = [
      [133, 348, 4.2, 14, materials.flame],
      [142, 350, 3.5, 11, materials.flameCore],
      [137, 342, 2.8, 9, materials.flameCore],
    ];
    flames.forEach(([x, z, radius, height, material], index) => {
      const flame = new THREE.Mesh(new THREE.ConeGeometry(radius, height, 12), material);
      flame.position.set(x, capY + height / 2 + 1, z);
      flame.rotation.z = index === 0 ? -0.14 : index === 1 ? 0.18 : -0.05;
      g.add(flame);
    });
    const glow = new THREE.PointLight(0xff8a45, 34, 110, 2);
    glow.position.set(138, 29, 348);
    g.add(glow);
    outlineBox(g, 72, wallHeight + 3, 72, 138, baseY + (wallHeight + 3) / 2, 348);
  }

  function addPlanter() {
    const g = new THREE.Group();
    g.name = "Planter dimensions exact; location provisional";
    provisionalGroup.add(g);
    const p = PROVISIONAL.planter;
    // Top-right placement requested by the client. Both outer-face legs remain
    // exactly 252 inches; the 78-inch gap to the upper pad is approximate.
    planBox(g, p.eastLegX0, p.x1, p.z0, p.z1, LOCKED.planter.height, 0, materials.stucco);
    planBox(g, p.x0, p.x1, p.northLegZ0, p.z1, LOCKED.planter.height, 0, materials.stucco);
    planBox(g, p.eastLegX0 - 1.5, p.x1 + 1.5, p.z0 - 1.5, p.z1 + 1.5, 3, LOCKED.planter.height, materials.whiteMetal);
    planBox(g, p.x0 - 1.5, p.x1 + 1.5, p.northLegZ0 - 1.5, p.z1 + 1.5, 3, LOCKED.planter.height, materials.whiteMetal);
    planBox(g, p.eastLegX0 + 8, p.x1 - 8, p.z0 + 8, p.z1 - 8, 1.4, LOCKED.planter.height + 0.3, materials.soil);
    planBox(g, p.x0 + 8, p.eastLegX0 + 8, p.northLegZ0 + 8, p.z1 - 8, 1.4, LOCKED.planter.height + 0.3, materials.soil);

    function addPlant(x: number, z: number, scale: number, accent = false) {
      if (accent) {
        cylinder(g, 0.6 * scale, 7 * scale, x, LOCKED.planter.height + 4, z, materials.foliage, 8);
        [[0, 0, 1], [-4, 1, 0.8], [3.5, 2, 0.72]].forEach(([dx, dz, size], index) => {
          const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(6.6 * scale * size, 1), materials.foliageAccent);
          leaf.position.set(x + dx * scale, LOCKED.planter.height + (10 + index * 2) * scale, z + dz * scale);
          leaf.scale.set(0.88, 1.18, 0.88);
          leaf.castShadow = true;
          g.add(leaf);
        });
        [[-3, 0], [2, 3], [4, -2]].forEach(([dx, dz]) => {
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(1.4 * scale, 8, 6), materials.flower);
          bloom.position.set(x + dx * scale, LOCKED.planter.height + 18 * scale, z + dz * scale);
          g.add(bloom);
        });
        return;
      }

      // Low-poly agave leaves add a second, recognizably planted silhouette.
      for (let index = 0; index < 7; index += 1) {
        const angle = index * (Math.PI * 2 / 7);
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(2.4 * scale, (index % 2 ? 14 : 18) * scale, 6), materials.foliage);
        leaf.position.set(
          x + Math.cos(angle) * 3.2 * scale,
          LOCKED.planter.height + 8 * scale,
          z + Math.sin(angle) * 3.2 * scale,
        );
        leaf.rotation.order = "YXZ";
        leaf.rotation.y = -angle;
        leaf.rotation.z = (index % 2 ? 0.28 : 0.4) * (index % 3 === 0 ? -1 : 1);
        leaf.castShadow = true;
        g.add(leaf);
      }
    }

    [322, 368, 414, 460, 516].forEach((z, index) => addPlant(p.eastLegX0 + 24, z, index % 2 ? 0.85 : 1.05, index % 2 === 0));
    [138, 184, 230, 276].forEach((x, index) => addPlant(x, p.northLegZ0 + 24, index % 2 ? 1 : 0.82, index % 2 === 1));
    outlineBox(g, 48, 36, 252, p.eastLegX0 + 24, 18, (p.z0 + p.z1) / 2);
    outlineBox(g, 252, 36, 48, (p.x0 + p.x1) / 2, 18, p.northLegZ0 + 24);
  }

  function buildPergola() {
    const g = pergolaGroup;
    g.name = "White closed-roof pergola · placement and height provisional";
    const w = LOCKED.pergola.width;
    const inferredHeight = 108;
    const post = 5;
    [[8, 8], [w - 8, 8], [8, w - 8], [w - 8, w - 8]].forEach(([x, z]) => {
      box(g, post, inferredHeight, post, x, inferredHeight / 2, z, materials.whiteMetal);
      outlineBox(g, post, inferredHeight, post, x, inferredHeight / 2, z);
    });
    box(g, w, 6, 6, w / 2, inferredHeight - 3, 4, materials.whiteMetal);
    box(g, w, 6, 6, w / 2, inferredHeight - 3, w - 4, materials.whiteMetal);
    box(g, 6, 6, w, 4, inferredHeight - 3, w / 2, materials.whiteMetal);
    box(g, 6, 6, w, w - 4, inferredHeight - 3, w / 2, materials.whiteMetal);

    // Closed roof with subtle standing seams.
    box(pergolaRoofGroup, w - 8, 4, w - 8, w / 2, inferredHeight + 1, w / 2, materials.roofPanel);
    for (let x = 24; x < w - 12; x += 24) {
      box(pergolaRoofGroup, 1, 1.2, w - 12, x, inferredHeight + 3.5, w / 2, materials.charcoal);
    }

    // Warm recessed lights keep the closed roof legible from the evening-style
    // camera angles without implying a particular fixture product.
    [[48, 48], [96, 48], [144, 48], [48, 144], [96, 144], [144, 144]].forEach(([x, z]) => {
      cylinder(pergolaRoofGroup, 2.1, 0.8, x, inferredHeight - 1.4, z, materials.lightGlow, 20);
    });

    // Integrated 16-foot white media wall, TV, soundbar and floating console.
    box(g, 5, 84, w, w - 2.5, 42, w / 2, materials.stucco);
    box(g, 1.4, 40, 68, w - 5.7, 61, w / 2, materials.black);
    box(g, 0.9, 35, 62, w - 6.9, 61, w / 2, materials.screen);
    box(g, 1.5, 3, 42, w - 7.1, 38.5, w / 2, materials.black);
    box(g, 10, 9, 76, w - 10, 25, w / 2, materials.whiteMetal);
    [48, 144].forEach((z) => box(g, 1.5, 14, 7, w - 6.8, 62, z, materials.charcoal));
    cylinder(g, 4.2, 5, w - 16, 32, 70, materials.charcoal, 20);
    const mediaPlant = new THREE.Mesh(new THREE.IcosahedronGeometry(5.4, 1), materials.foliageAccent);
    mediaPlant.position.set(w - 16, 38, 70);
    mediaPlant.scale.set(0.9, 1.15, 0.9);
    mediaPlant.castShadow = true;
    g.add(mediaPlant);

    // Centered three-blade ceiling fan.
    cylinder(pergolaRoofGroup, 2.1, 12, w / 2, 97, w / 2, materials.charcoal, 20);
    cylinder(pergolaRoofGroup, 5.2, 4.5, w / 2, 89.5, w / 2, materials.charcoal, 28);
    for (let i = 0; i < 3; i += 1) {
      const blade = box(pergolaRoofGroup, 34, 1.5, 6, w / 2 + 18, 88.4, w / 2, materials.charcoal);
      blade.geometry.translate(-18, 0, 0);
      blade.position.set(w / 2, 88.4, w / 2);
      blade.rotation.y = i * (Math.PI * 2 / 3);
    }
    outlineBox(g, w, inferredHeight, w, w / 2, inferredHeight / 2, w / 2);
  }

  addPaverZones();
  addLeftSideLandscape();
  addBbq();
  addFirepit();
  addPlanter();
  buildPergola();

  function labelTexture(text: string, accent = "#dfe4e7") {
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
    ctx.fillStyle = "#f4f6f7";
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
    const material = new THREE.LineBasicMaterial({ color: 0xdfe4e7, transparent: true, opacity: 0.96, depthTest: false });
    lineBetween(group, a, b, material);
    const direction = new THREE.Vector3().subVectors(b, a).normalize();
    const tick = Math.abs(direction.x) > Math.abs(direction.z) ? new THREE.Vector3(0, 0, 6) : new THREE.Vector3(6, 0, 0);
    lineBetween(group, a.clone().sub(tick), a.clone().add(tick), material);
    lineBetween(group, b.clone().sub(tick), b.clone().add(tick), material);
    const mirrored = group === afterDimensions || group === afterPaverDimensions;
    const label = textSprite(text, Math.max(50, text.length * 4.8), undefined, mirrored);
    label.position.copy(a).add(b).multiplyScalar(0.5).add(labelOffset);
    label.position.y += 8;
    group.add(label);
  }

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
  addDimension(afterDimensions, new THREE.Vector3(84, 122, 23), new THREE.Vector3(276, 122, 23), "PERGOLA 16′–0″");
  addDimension(afterDimensions, new THREE.Vector3(374, 52, 294), new THREE.Vector3(374, 52, 546), "PLANTER LEG 21′–0″");
  addDimension(afterDimensions, new THREE.Vector3(180, 8, 420), new THREE.Vector3(180, 8, 498), "≈ 6′–6″ GAP");
  addDimension(afterPaverDimensions, new THREE.Vector3(0, 7, 18), new THREE.Vector3(6, 7, 18), "6″ BORDER", new THREE.Vector3(0, 0, 10));

  const houseLabel = textSprite("HOUSE / SOUTH (−Z)", 92, "#8c918e");
  houseLabel.position.set(222, 112, -168);
  measurementGroup.add(houseLabel);
  const datumLabel = textSprite("DATUM 0,0", 54);
  datumLabel.position.set(276, 15, -7);
  measurementGroup.add(datumLabel);
  const bbqStatus = textSprite("BBQ POSITION · UNVERIFIED", 108, "#aeb8c1", true);
  bbqStatus.position.set(83, 72, 232);
  afterDimensions.add(bbqStatus);
  const planterStatus = textSprite("PLANTER LOCATION · UNVERIFIED", 124, "#aeb8c1", true);
  planterStatus.position.set(234, 62, 560);
  afterDimensions.add(planterStatus);
  const firepitStatus = textSprite("CONSTRUCTION · UNVERIFIED", 112, "#aeb8c1", true);
  firepitStatus.position.set(138, 48, 348);
  afterDimensions.add(firepitStatus);
  const treeStatus = textSprite("TREE REMOVED · CONFIRMED", 112, "#9fc6af", true);
  treeStatus.position.set(-6, 34, 292);
  afterDimensions.add(treeStatus);
  const projectOrientation = textSprite("PROJECT AREA · RIGHT FROM PATIO", 126, "#dfe4e7", true);
  projectOrientation.position.set(96, 22, 270);
  afterDimensions.add(projectOrientation);
  const pergolaStatus = textSprite("PLACEMENT / HEIGHT · UNVERIFIED", 132, "#aeb8c1", true);
  pergolaStatus.position.set(96, 132, 96);
  pergolaStatus.visible = false;
  pergolaGroup.add(pergolaStatus);

  let measurementVisible = false;
  let mobilePresetOnly = window.innerWidth <= 680;
  let pergolaOption: PergolaOption = "north";
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
      state: { measurements: measurementVisible, pergola: pergolaOption, mobilePresetOnly, scene: currentScene },
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
        houseReturnWallVisible: true,
        pergolaMovedNorth: true,
        pergolaLeftRightUnchanged: true,
        closedPergola: true,
        mediaWallIntegrated: true,
        leftSideConceptAdded: true,
        afterPaletteMonochrome: true,
        beforeModeRemoved: true,
        mobilePresetCameraOnly: true,
        arrowCameraTour: true,
        birdseyeRemoved: true,
        firepitDetailed: true,
        planterPlantingAdded: true,
        planterSceneAdded: true,
        fireToPatioSceneAdded: true,
        pergolaDownlightsAdded: true,
        planterClearanceApprox: PROVISIONAL.planter.clearanceFromUpper,
        rendererPixelRatio: renderer.getPixelRatio(),
      },
    };
  }

  function updateConflict(option: PergolaOption) {
    conflictGroup.clear();
    const p = PERGOLA_OPTIONS[option];
    pergolaGroup.position.set(p.x, 0, p.z);
    // Keep the original sketch position available for comparison. The preferred
    // option preserves its X alignment and moves it only north along the pad.
    const postX = p.x + 8;
    const postZ = p.z + LOCKED.pergola.depth - 8;
    const active = option === "original";
    if (active) {
      box(conflictGroup, 9, 108, 9, postX, 54, postZ, materials.conflict);
      outlineBox(conflictGroup, 9, 108, 9, postX, 54, postZ, 0xf05848);
      const label = textSprite("POST ON COUNTER", 92, "#f05848", true);
      label.position.set(postX, 118, postZ);
      conflictGroup.add(label);
      onConflict("Post on counter", true);
    } else {
      onConflict("Post clear", false);
    }
    pergolaOption = option;
    updateDebug();
  }

  const presets: Record<SceneName, { position: THREE.Vector3; target: THREE.Vector3 }> = {
    patioLeft: { position: new THREE.Vector3(36, 72, -106), target: new THREE.Vector3(235, 28, 168) },
    patioRight: { position: new THREE.Vector3(150, 72, -106), target: new THREE.Vector3(76, 28, 168) },
    mainForward: { position: new THREE.Vector3(138, 64, 212), target: new THREE.Vector3(138, 18, 360) },
    planterClose: { position: new THREE.Vector3(246, 86, 500), target: new THREE.Vector3(24, 30, 438) },
    fireToPatio: { position: new THREE.Vector3(138, 68, 414), target: new THREE.Vector3(150, 27, 42) },
  };
  let currentScene: SceneName = "patioLeft";

  function updateCameraFov(sceneName: SceneName) {
    if (window.innerWidth <= 660) {
      camera.fov = sceneName === "mainForward" ? 70 : sceneName === "planterClose" ? 64 : sceneName === "fireToPatio" ? 74 : 88;
    } else {
      camera.fov = 37;
    }
    camera.updateProjectionMatrix();
  }

  function setScene(sceneName: SceneName, immediate = false) {
    const preset = presets[sceneName];
    const position = preset.position.clone();
    if (window.innerWidth <= 660) {
      const scale = sceneName === "mainForward" ? 1.08 : sceneName === "planterClose" ? 1.06 : sceneName === "fireToPatio" ? 1.04 : 1;
      position.sub(preset.target).multiplyScalar(scale).add(preset.target);
    }
    currentScene = sceneName;
    updateDebug();
    camera.up.set(0, 1, 0);
    updateCameraFov(sceneName);
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

  function setMeasurements(visible: boolean) {
    measurementVisible = visible;
    measurementGroup.visible = visible;
    pergolaStatus.visible = visible;
    updateDebug();
  }

  function setPergola(option: PergolaOption) {
    updateConflict(option);
  }

  function resize() {
    const width = mount.clientWidth;
    const height = mount.clientHeight;
    mobilePresetOnly = width <= 680;
    controls.enableRotate = !mobilePresetOnly;
    controls.enablePan = !mobilePresetOnly;
    controls.enableZoom = !mobilePresetOnly;
    camera.aspect = width / Math.max(1, height);
    updateCameraFov(currentScene);
    renderer.setSize(width, height, false);
    updateDebug();
  }

  window.addEventListener("resize", resize);
  controls.addEventListener("start", () => {
    tween = undefined;
  });
  resize();
  updateConflict("north");
  setScene("patioLeft", true);
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
    setMeasurements,
    setPergola,
    setScene,
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
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [measurements, setMeasurementsState] = useState(false);
  const [pergola, setPergolaState] = useState<PergolaOption>("north");
  const [conflict, setConflict] = useState({ label: "Post clear", active: false });
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

  function moveScene(direction: -1 | 1) {
    const next = (activeSceneIndex + direction + SCENES.length) % SCENES.length;
    setActiveSceneIndex(next);
    apiRef.current?.setScene(SCENES[next].id);
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
    <main className="viewer-shell" data-ready={ready ? "true" : "false"}>
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
        <button className={`tool-btn ${measurements ? "is-active" : ""}`} onClick={toggleMeasurements} aria-label="Toggle measurements" aria-pressed={measurements}>
          <span className="measure-icon" aria-hidden="true" />
          <span className="tool-label">Measurements</span>
        </button>
      </header>

      <section className="intro" aria-labelledby="page-title">
        <div className="eyebrow">Irvin backyard · interactive 3D</div>
        <h1 id="page-title">Black. White. Built to gather.</h1>
      </section>

      <div className={`conflict-badge ${conflict.active ? "is-conflict" : "is-clear"}`} role="status">
        <span>{conflict.active ? "Original conflict" : "Pergola north"}</span>
        <strong>{conflict.label}</strong>
      </div>

      <aside className={`spec-panel ${notesOpen ? "is-open" : ""}`} aria-label="Plan facts and provisional items">
        <div className="spec-head">
          <div>
            <span>Project</span>
            <small>1 unit = 1 inch</small>
          </div>
          <button className="panel-close" onClick={() => setNotesOpen(false)} aria-label="Close plan notes">×</button>
        </div>
        <div className="metric-grid">
          <div><small>Main pad</small><strong>23′ × 23′</strong></div>
          <div><small>Upper pad</small><strong>12′ × 12′</strong></div>
          <div><small>BBQ footprint</small><strong>76.1 sf</strong></div>
          <div><small>Counter run</small><strong>22′–10″</strong></div>
        </div>
        <div className="pergola-control">
          <div className="section-label"><span>Pergola</span><em>concept</em></div>
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
          <div><i className="dot exact" /><span>23′ square · gray pavers · black border</span></div>
          <div><i className="dot exact" /><span>White closed pergola · fan · media wall</span></div>
          <div><i className="dot provisional" /><span>Left landscape is conceptual · no turf</span></div>
        </div>
        <p className="disclaimer">Concept only · verify in field.</p>
      </aside>

      <div className="mobile-pergola" aria-label="Pergola position options">
        <span>Pergola</span>
        {(Object.keys(PERGOLA_OPTIONS) as PergolaOption[]).map((id) => (
          <button key={id} className={pergola === id ? "is-active" : ""} onClick={() => choosePergola(id)}>{PERGOLA_OPTIONS[id].label}</button>
        ))}
      </div>

      <button className="reference-btn" onClick={() => setReferencesOpen(true)} aria-label="Open site references">
        <img src="/reference/photo-11.webp" alt="" />
        <span>Photos</span>
      </button>
      <button className="notes-btn" onClick={() => setNotesOpen(true)}>Details</button>

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

      <nav className="camera-tour" aria-label="Camera scenes">
        <button onClick={() => moveScene(-1)} aria-label="Previous camera scene">←</button>
        <div aria-live="polite">
          <small>{activeSceneIndex + 1} / {SCENES.length}</small>
          <strong>{SCENES[activeSceneIndex].label}</strong>
        </div>
        <button onClick={() => moveScene(1)} aria-label="Next camera scene">→</button>
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
