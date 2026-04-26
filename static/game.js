import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const hud = document.getElementById("hud");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const hotbar = document.getElementById("hotbar");
const crosshair = document.getElementById("crosshair");
const inventory = document.getElementById("inventory");
const inventoryGrid = document.getElementById("inventory-grid");
const inventoryTitle = document.getElementById("inventory-title");
const craftGrid = document.getElementById("craft-grid");
const craftOutput = document.querySelector("#craft-output .craft-slot");
const inventoryHotbar = document.getElementById("inventory-hotbar");
const chestPanel = document.getElementById("chest-panel");
const chestGrid = document.getElementById("chest-grid");
const paletteGrid = document.getElementById("palette-grid");
const cursorItem = document.getElementById("cursor-item");
const breakBar = document.getElementById("break-bar");
const playerAvatar = document.getElementById("player-avatar");
const chunkDistanceInput = document.getElementById("chunk-distance");
const chunkDistanceValue = document.getElementById("chunk-distance-value");
const dashLines = document.getElementById("dash-lines");
const dashboardGoals = document.getElementById("dashboard-goals");
const photoModeBtn = document.getElementById("btn-photo-mode");
const centerCameraBtn = document.getElementById("btn-center-camera");
const toggleLanternBtn = document.getElementById("btn-toggle-lantern");
const openToolsBtn = document.getElementById("btn-open-tools");
const openLiveMapBtn = document.getElementById("btn-open-live-map");
const openSchemBtn = document.getElementById("btn-open-schem");
const openPanelBtn = document.getElementById("btn-open-panel");
const openTutorialBtn = document.getElementById("btn-open-tutorial");
const openWikiBtn = document.getElementById("btn-open-wiki");
const openCloneBtn = document.getElementById("btn-open-clone");

const BLOCKS = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  BRICK: 7,
  PLANK: 8,
  COBBLE: 9,
  CHEST: 10,
  COAL_ORE: 11,
  IRON_ORE: 12,
  GOLD_ORE: 13,
  DIAMOND_ORE: 14,
  BEDROCK: 15,
  WATER: 16,
  TORCH_BLOCK: 17,
  STICK: 100,
  TORCH: 101,
  APPLE: 102,
  BREAD: 103,
  COOKED_BEEF: 104,
  COOKED_CHICKEN: 105,
  COOKED_PORK: 106,
};

const BLOCK_COLORS = {
  [BLOCKS.GRASS]: 0x7cc36a,
  [BLOCKS.DIRT]: 0x8b5a2b,
  [BLOCKS.STONE]: 0x9ca3af,
  [BLOCKS.WOOD]: 0xb7794a,
  [BLOCKS.LEAVES]: 0x4caf50,
  [BLOCKS.SAND]: 0xd9c285,
  [BLOCKS.BRICK]: 0xb5523b,
  [BLOCKS.PLANK]: 0xd3a471,
  [BLOCKS.COBBLE]: 0x7b7f86,
  [BLOCKS.CHEST]: 0x9a6b3a,
  [BLOCKS.COAL_ORE]: 0x4f5968,
  [BLOCKS.IRON_ORE]: 0xbb8a67,
  [BLOCKS.GOLD_ORE]: 0xd7b54a,
  [BLOCKS.DIAMOND_ORE]: 0x5fd5d0,
  [BLOCKS.BEDROCK]: 0x3f4349,
  [BLOCKS.WATER]: 0x3b82f6,
  [BLOCKS.TORCH_BLOCK]: 0xf2c94c,
  [BLOCKS.STICK]: 0x8b5a2b,
  [BLOCKS.TORCH]: 0xf2c94c,
  [BLOCKS.APPLE]: 0xd94a4a,
  [BLOCKS.BREAD]: 0xd9a04a,
  [BLOCKS.COOKED_BEEF]: 0x8b4b2b,
  [BLOCKS.COOKED_CHICKEN]: 0xd6a86a,
  [BLOCKS.COOKED_PORK]: 0xc46b5b,
};

const BLOCK_NAMES = {
  [BLOCKS.GRASS]: "Grass",
  [BLOCKS.DIRT]: "Dirt",
  [BLOCKS.STONE]: "Stone",
  [BLOCKS.WOOD]: "Wood",
  [BLOCKS.LEAVES]: "Leaves",
  [BLOCKS.SAND]: "Sand",
  [BLOCKS.BRICK]: "Brick",
  [BLOCKS.PLANK]: "Planks",
  [BLOCKS.COBBLE]: "Cobble",
  [BLOCKS.CHEST]: "Chest",
  [BLOCKS.COAL_ORE]: "Coal Ore",
  [BLOCKS.IRON_ORE]: "Iron Ore",
  [BLOCKS.GOLD_ORE]: "Gold Ore",
  [BLOCKS.DIAMOND_ORE]: "Diamond Ore",
  [BLOCKS.BEDROCK]: "Bedrock",
  [BLOCKS.WATER]: "Water",
  [BLOCKS.TORCH_BLOCK]: "Torch (Block)",
  [BLOCKS.STICK]: "Stick",
  [BLOCKS.TORCH]: "Torch",
  [BLOCKS.APPLE]: "Apple",
  [BLOCKS.BREAD]: "Bread",
  [BLOCKS.COOKED_BEEF]: "Steak",
  [BLOCKS.COOKED_CHICKEN]: "Cooked Chicken",
  [BLOCKS.COOKED_PORK]: "Cooked Pork",
};

const state = {
  playerId: null,
  worldSize: {
    x: 32,
    y: 16,
    z: 32,
    minY: -100,
    maxY: 31,
    visibleChunks: 3,
    minVisibleChunks: 3,
    maxVisibleChunks: 9,
    borderMinX: 0,
    borderMaxX: 31,
    borderMinZ: 0,
    borderMaxZ: 31,
  },
  blocks: new Map(),
  blocksByType: new Map(),
  loadedChunks: new Set(),
  streamQueue: [],
  streamQueueIndex: 0,
  streamDirtyTypes: new Set(),
  streamLastFlush: 0,
  players: new Map(),
  mode: 1,
  slots: Array.from({ length: 36 }, () => null),
  craftSlots: [null, null, null, null],
  drops: new Map(),
  npcs: new Map(),
  chest: null,
  selectedSlot: 0,
};

const cursor = { item: null };

const toastHost = (() => {
  const el = document.createElement("div");
  el.id = "toasts";
  document.body.appendChild(el);
  return el;
})();

function showToast(text, ms = 2400) {
  if (!toastHost) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = text;
  toastHost.appendChild(t);
  setTimeout(() => {
    try {
      t.remove();
    } catch (_) {
      // ignore
    }
  }, ms);
}

// Chunk-based rendering (Uint8Array + worker-built meshes)
// This is the "1 + 2" optimization path:
// 1) Chunking: render only nearby chunks as separate meshes (frustum-cull friendly).
// 2) Worker pipeline + packed voxels: keep block data in Uint8Array and build geometry + light in a Web Worker.
const USE_CHUNK_RENDERER = true;
const chunkStore = new Map(); // key "cx,cz" -> {cx,cz,voxels,version,meshOpaque,meshWater}
let chunkWorker = null;
let chunkDims = { cs: 16, h: 132, minY: -100, maxY: 31 };
const dirtyChunkKeys = new Set();

function chunkKeyXY(cx, cz) {
  return `${cx},${cz}`;
}

function ensureChunk(cx, cz) {
  const k = chunkKeyXY(cx, cz);
  if (chunkStore.has(k)) return chunkStore.get(k);
  const total = chunkDims.cs * chunkDims.cs * chunkDims.h;
  const rec = { cx, cz, voxels: new Uint8Array(total), version: 0, meshOpaque: null, meshWater: null };
  chunkStore.set(k, rec);
  return rec;
}

function clearChunkMeshes() {
  // Remove meshes from the scene and reset the chunk store.
  chunkStore.forEach((rec) => {
    if (rec.meshOpaque) chunkMeshGroup.remove(rec.meshOpaque);
    if (rec.meshWater) chunkMeshGroup.remove(rec.meshWater);
  });
  chunkStore.clear();
  dirtyChunkKeys.clear();
  if (chunkMeshGroup && chunkMeshGroup.clear) chunkMeshGroup.clear();
}

function syncChunkDimsFromWorldSize() {
  const cs = getChunkSize();
  const minY = Number.isFinite(state.worldSize?.minY) ? Number(state.worldSize.minY) : -100;
  const maxY = Number.isFinite(state.worldSize?.maxY) ? Number(state.worldSize.maxY) : 31;
  const h = Math.max(1, (maxY - minY + 1) | 0);
  const changed = cs !== chunkDims.cs || minY !== chunkDims.minY || maxY !== chunkDims.maxY || h !== chunkDims.h;
  chunkDims = { cs, h, minY, maxY };
  if (changed) clearChunkMeshes();
}

function chunkLocalIndex(lx, ly, lz) {
  return lx + lz * chunkDims.cs + ly * chunkDims.cs * chunkDims.cs;
}

function getBlockTypeAt(x, y, z) {
  const cs = chunkDims.cs;
  const cx = Math.floor(x / cs);
  const cz = Math.floor(z / cs);
  const rec = chunkStore.get(chunkKeyXY(cx, cz));
  if (!rec) return state.blocks.get(keyFor(x, y, z)) ?? BLOCKS.AIR;
  const lx = ((x % cs) + cs) % cs;
  const lz = ((z % cs) + cs) % cs;
  const ly = y - chunkDims.minY;
  if (ly < 0 || ly >= chunkDims.h) return BLOCKS.AIR;
  return rec.voxels[chunkLocalIndex(lx, ly, lz)] || BLOCKS.AIR;
}

function setChunkBlock(x, y, z, t) {
  const cs = chunkDims.cs;
  const cx = Math.floor(x / cs);
  const cz = Math.floor(z / cs);
  const rec = ensureChunk(cx, cz);
  const lx = ((x % cs) + cs) % cs;
  const lz = ((z % cs) + cs) % cs;
  const ly = y - chunkDims.minY;
  if (ly < 0 || ly >= chunkDims.h) return;
  rec.voxels[chunkLocalIndex(lx, ly, lz)] = t & 0xff;
}

function initChunkWorker() {
  if (chunkWorker) return;
  chunkWorker = new Worker("/static/chunk_worker.js");
  chunkWorker.onmessage = (e) => {
    const msg = e.data || {};
    if (msg.type !== "mesh_chunk_result") return;
    const k = chunkKeyXY(msg.cx, msg.cz);
    const rec = chunkStore.get(k);
    if (!rec || msg.version !== rec.version) return;

    const applyMesh = (part, isWater) => {
      const pos = part.pos;
      if (!pos || !pos.length) return null;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(part.pos, 3));
      geo.setAttribute("normal", new THREE.BufferAttribute(part.nrm, 3));
      geo.setAttribute("color", new THREE.BufferAttribute(part.col, 3));
      geo.setIndex(new THREE.BufferAttribute(part.idx, 1));
      geo.computeBoundingSphere();
      const mat = new THREE.MeshLambertMaterial({
        vertexColors: true,
        transparent: isWater,
        opacity: isWater ? 0.62 : 1,
        depthWrite: isWater ? false : true,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(rec.cx * chunkDims.cs, chunkDims.minY, rec.cz * chunkDims.cs);
      mesh.frustumCulled = true;
      return mesh;
    };

    const oldO = rec.meshOpaque;
    const oldW = rec.meshWater;
    if (oldO) chunkMeshGroup.remove(oldO);
    if (oldW) chunkMeshGroup.remove(oldW);
    rec.meshOpaque = applyMesh(msg.opaque, false);
    rec.meshWater = applyMesh(msg.water, true);
    if (rec.meshOpaque) chunkMeshGroup.add(rec.meshOpaque);
    if (rec.meshWater) chunkMeshGroup.add(rec.meshWater);
  };
}

function requestChunkMesh(cx, cz) {
  initChunkWorker();
  const rec = ensureChunk(cx, cz);
  rec.version += 1;
  const copy = new Uint8Array(rec.voxels); // copy so we can transfer
  chunkWorker.postMessage(
    {
      type: "mesh_chunk",
      cx,
      cz,
      cs: chunkDims.cs,
      h: chunkDims.h,
      minY: chunkDims.minY,
      voxels: copy.buffer,
      version: rec.version,
    },
    [copy.buffer]
  );
}

function queueChunkMesh(cx, cz) {
  dirtyChunkKeys.add(chunkKeyXY(cx, cz));
}

function processChunkMeshQueue(limit = 1) {
  if (!dirtyChunkKeys.size) return;
  let i = 0;
  for (const k of dirtyChunkKeys) {
    dirtyChunkKeys.delete(k);
    const [cx, cz] = k.split(",").map((v) => Number(v));
    if (Number.isFinite(cx) && Number.isFinite(cz)) requestChunkMesh(cx, cz);
    i += 1;
    if (i >= limit) break;
  }
}

const clientId = (() => {
  const existing = localStorage.getItem("clientId");
  if (existing) return existing;
  const id = (crypto.randomUUID && crypto.randomUUID()) || `client-${Math.random().toString(36).slice(2)}`;
  localStorage.setItem("clientId", id);
  return id;
})();

let settingsDebounce = null;
const savedVisibleChunks = Number(localStorage.getItem("visibleChunks"));

const clock = new THREE.Clock();
const scene = new THREE.Scene();
const PERFORMANCE_PROFILE = {
  lowEnd: true,
  maxPixelRatio: 1.0,
  minPixelRatio: 0.6,
  raycastFar: 4.8,
  netIntervalMs: 220,
  dropPickupIntervalMs: 320,
  qualityTuneMs: 900,
  lowFpsThreshold: 61,
  highFpsThreshold: 68,
  streamBudget: 520,
  streamFlushMs: 45,
  streamRebuildPerFlush: 1,
  cameraFar: 92,
  fogNear: 20,
  fogFar: 56,
};
const SKY_COLOR = 0x95b9e8;
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, PERFORMANCE_PROFILE.fogNear, PERFORMANCE_PROFILE.fogFar);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, PERFORMANCE_PROFILE.cameraFar);
camera.position.set(8, 8, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
const MAX_PIXEL_RATIO = Math.min(window.devicePixelRatio || 1, PERFORMANCE_PROFILE.maxPixelRatio);
const MIN_PIXEL_RATIO = PERFORMANCE_PROFILE.minPixelRatio;
let dynamicPixelRatio = MAX_PIXEL_RATIO;
renderer.setPixelRatio(dynamicPixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(SKY_COLOR);

const ambient = new THREE.AmbientLight(0xffffff, 0.72);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 1.0);
sun.position.set(10, 20, 5);
scene.add(sun);
const headLamp = new THREE.PointLight(0xfff0be, 0, 16, 2);
scene.add(headLamp);
const DAY_SKY = new THREE.Color(0x95b9e8);
const NIGHT_SKY = new THREE.Color(0x060b16);
function createDashboardLine(id, color) {
  const line = document.createElement("div");
  line.id = id;
  line.className = "dash-line";
  if (color) line.style.color = color;
  if (dashLines) {
    dashLines.appendChild(line);
  } else if (hud) {
    hud.appendChild(line);
  }
  return line;
}

const dayClock = createDashboardLine("day-clock", "#26445d");
const lanternInfo = createDashboardLine("lantern-info", "#6a4b07");
const markerInfo = createDashboardLine("marker-info", "#0f5667");
const npcInfo = createDashboardLine("npc-info", "#6b3f22");
const statsInfo = createDashboardLine("stats-info", "#144861");
const worldInfo = createDashboardLine("world-info", "#1f4e2f");
const compassInfo = createDashboardLine("compass-info", "#244b8a");
const dayNight = {
  progress: 0.26,
  cycleSeconds: 360,
  speedMultiplier: 1,
  daylight: 1,
};

const playerGroup = new THREE.Group();
scene.add(playerGroup);

const blockGroup = new THREE.Group();
scene.add(blockGroup);
const chunkMeshGroup = new THREE.Group();
scene.add(chunkMeshGroup);
const dropGroup = new THREE.Group();
scene.add(dropGroup);
const borderGroup = new THREE.Group();
scene.add(borderGroup);
const npcGroup = new THREE.Group();
scene.add(npcGroup);
const nightMobGroup = new THREE.Group();
scene.add(nightMobGroup);
const fireflyGroup = new THREE.Group();
scene.add(fireflyGroup);
const starsGroup = new THREE.Group();
scene.add(starsGroup);
const markerGroup = new THREE.Group();
scene.add(markerGroup);
const rainGroup = new THREE.Group();
scene.add(rainGroup);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const meshes = new Map();
const materialCache = new Map();
const textureLoader = new THREE.TextureLoader();
textureLoader.setCrossOrigin("anonymous");
const textureCache = new Map();
const npcMaterialCache = new Map();
let graphicsMode = localStorage.getItem("gfxMode") || "auto";
const nightMobs = new Map();
const fireflies = [];
let lastNightSpawnAt = 0;
const markers = [];
let selectedMarkerIndex = -1;
let photoModeEnabled = false;
const homePoint = { set: false, x: 0, y: 0, z: 0 };
const pendingNpcs = new Map();
let lastNpcSnapshot = null;
const lantern = {
  enabled: false,
  charge: 100,
  maxCharge: 100,
  drainPerSec: 0,
  rechargePerSec: 0,
};
const playerProgress = {
  reputation: 0,
  spiritKills: 0,
  talks: 0,
};
const survivalStats = {
  stamina: 100,
  hunger: 100,
  cold: 0,
  health: 100,
  exploredChunks: new Set(),
};
const seasonState = {
  index: 0,
  name: "Весна",
  tempBias: 0,
  nextShift: performance.now() + 300000,
};
const FOOD_VALUES = new Map([
  [BLOCKS.APPLE, 18],
  [BLOCKS.BREAD, 26],
  [BLOCKS.COOKED_BEEF, 36],
  [BLOCKS.COOKED_CHICKEN, 28],
  [BLOCKS.COOKED_PORK, 30],
]);
const weatherState = {
  isRaining: false,
  intensity: 0,
  target: 0,
  nextShift: performance.now() + 120000,
};
const npcIdentity = new Map();
const NPC_ROLE_BY_KIND = {
  villager: "Villager",
  wandering_trader: "Trader",
  iron_golem: "Guardian",
  wolf: "Ranger",
  fox: "Scout",
  zombie: "Undead",
  skeleton: "Archer",
  cow: "Farmer",
  pig: "Butcher",
  chicken: "Cook",
  sheep: "Tailor",
};
const NPC_NAME_POOL = [
  "Alden", "Bora", "Mira", "Tarin", "Nox", "Yara", "Vex", "Luna", "Kiro", "Sana",
  "Rurik", "Nami", "Doran", "Kessa", "Ivor", "Zane", "Reya", "Orin",
];

const NPC_ITEM_LIBRARY = [
  { name: "Traveler Hat", color: 0x8b5a2b, scale: [0.62, 0.22, 0.62], offset: [0, 1.08, 0] },
  { name: "Scout Pack", color: 0x3b5b47, scale: [0.55, 0.6, 0.24], offset: [0, 0.45, -0.4] },
  { name: "Lantern", color: 0xf2c94c, scale: [0.18, 0.28, 0.18], offset: [0.35, 0.25, 0.35] },
  { name: "Wand", color: 0x8a4b2a, scale: [0.12, 0.55, 0.12], offset: [-0.35, 0.35, 0.35] },
  { name: "Shoulder Pad", color: 0x6b7280, scale: [0.4, 0.18, 0.4], offset: [0, 0.8, 0] },
];

function createStars() {
  const count = 700;
  const positions = new Float32Array(count * 3);
  const radius = 420;
  for (let i = 0; i < count; i += 1) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius + Math.random() * 80;
    positions[i * 3 + 0] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.abs(Math.cos(phi)) * r * 0.7 + 40;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: 0xe8f1ff,
    size: 1.8,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const stars = new THREE.Points(geometry, material);
  starsGroup.add(stars);
}
createStars();

function ensureRain() {
  if (rainGroup.children.length) return;
  const count = 900;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3 + 0] = (Math.random() - 0.5) * 80;
    positions[i * 3 + 1] = Math.random() * 40 + 10;
    positions[i * 3 + 2] = (Math.random() - 0.5) * 80;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color: 0x9ec3ff,
    size: 0.18,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const rain = new THREE.Points(geo, mat);
  rainGroup.add(rain);
}
ensureRain();

function addMarkerAtPlayer() {
  const id = `mk-${Math.random().toString(36).slice(2, 8)}`;
  const base = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.22, 0.35, 10),
    new THREE.MeshStandardMaterial({ color: 0x2dd4ff, emissive: 0x0b2a38, emissiveIntensity: 0.8 })
  );
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 30, 6),
    new THREE.MeshBasicMaterial({ color: 0x4fdfff, transparent: true, opacity: 0.35, depthWrite: false })
  );
  base.position.set(camera.position.x, Math.floor(camera.position.y - 1.6), camera.position.z);
  beam.position.set(base.position.x, base.position.y + 15.2, base.position.z);
  markerGroup.add(base);
  markerGroup.add(beam);
  markers.push({
    id,
    pos: base.position.clone(),
    base,
    beam,
  });
  selectedMarkerIndex = markers.length - 1;
}

function removeSelectedMarker() {
  if (selectedMarkerIndex < 0 || selectedMarkerIndex >= markers.length) return;
  const marker = markers[selectedMarkerIndex];
  markerGroup.remove(marker.base);
  markerGroup.remove(marker.beam);
  markers.splice(selectedMarkerIndex, 1);
  selectedMarkerIndex = markers.length ? Math.max(0, selectedMarkerIndex - 1) : -1;
}

function selectNextMarker() {
  if (!markers.length) return;
  selectedMarkerIndex = (selectedMarkerIndex + 1 + markers.length) % markers.length;
}

function updateMarkers(dt) {
  markers.forEach((marker, i) => {
    const selected = i === selectedMarkerIndex;
    marker.base.material.color.setHex(selected ? 0x7df9ff : 0x2dd4ff);
    marker.beam.material.opacity = selected ? 0.55 : 0.28;
    marker.beam.rotation.y += dt * 0.3;
  });

  if (!markerInfo) return;
  if (!markers.length || selectedMarkerIndex < 0) {
    markerInfo.textContent = "Markers: none (M = add, N = next, Backspace = remove)";
    return;
  }
  const marker = markers[selectedMarkerIndex];
  const dx = marker.pos.x - camera.position.x;
  const dy = marker.pos.y - camera.position.y;
  const dz = marker.pos.z - camera.position.z;
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz).toFixed(1);
  markerInfo.textContent = `Marker ${selectedMarkerIndex + 1}/${markers.length}: ${dist}m`;
}

function applyPhotoMode() {
  const hide = photoModeEnabled;
  [hud, chatLog?.parentElement, hotbar, crosshair, breakBar].forEach((el) => {
    if (!el) return;
    el.classList.toggle("hidden", hide);
  });
  if (photoModeBtn) {
    photoModeBtn.textContent = hide ? "Photo Mode: ON" : "Photo Mode [H]";
  }
}

function togglePhotoMode() {
  photoModeEnabled = !photoModeEnabled;
  applyPhotoMode();
  pushChat("SYSTEM", photoModeEnabled ? "Photo mode enabled" : "Photo mode disabled");
}

function setHomePoint() {
  homePoint.set = true;
  homePoint.x = camera.position.x;
  homePoint.y = camera.position.y;
  homePoint.z = camera.position.z;
  pushChat("SYSTEM", "Home point saved (K)");
}

function returnToHomePoint() {
  if (!homePoint.set) {
    pushChat("SYSTEM", "Home point not set yet. Press K first.");
    return;
  }
  camera.position.set(homePoint.x, homePoint.y, homePoint.z);
  clampToWorldBorder(camera.position);
  pushChat("SYSTEM", "Returned to home point (J)");
}

const MAX_STACK = 64;
const PLAYER_HEIGHT_BLOCKS = 1.5;
const MC_ASSET_ROOT = "https://mcasset.cloud/1.20.4/assets/minecraft/textures";
const STEVE_TEXTURE_URL = `${MC_ASSET_ROOT}/entity/player/wide/steve.png`;
const STEVE_FALLBACK_AVATAR_URL = createSteveAvatarDataUrl();
const BLOCK_TEXTURE_URLS = {
  [BLOCKS.GRASS]: {
    top: `${MC_ASSET_ROOT}/block/grass_block_top.png`,
    bottom: `${MC_ASSET_ROOT}/block/dirt.png`,
    side: `${MC_ASSET_ROOT}/block/grass_block_side.png`,
  },
  [BLOCKS.DIRT]: `${MC_ASSET_ROOT}/block/dirt.png`,
  [BLOCKS.STONE]: `${MC_ASSET_ROOT}/block/stone.png`,
  [BLOCKS.WOOD]: {
    top: `${MC_ASSET_ROOT}/block/oak_log_top.png`,
    bottom: `${MC_ASSET_ROOT}/block/oak_log_top.png`,
    side: `${MC_ASSET_ROOT}/block/oak_log.png`,
  },
  [BLOCKS.LEAVES]: `${MC_ASSET_ROOT}/block/oak_leaves.png`,
  [BLOCKS.SAND]: `${MC_ASSET_ROOT}/block/sand.png`,
  [BLOCKS.BRICK]: `${MC_ASSET_ROOT}/block/bricks.png`,
  [BLOCKS.PLANK]: `${MC_ASSET_ROOT}/block/oak_planks.png`,
  [BLOCKS.COBBLE]: `${MC_ASSET_ROOT}/block/cobblestone.png`,
  [BLOCKS.CHEST]: {
    top: `${MC_ASSET_ROOT}/block/chest_top.png`,
    bottom: `${MC_ASSET_ROOT}/block/chest_top.png`,
    side: `${MC_ASSET_ROOT}/block/chest_side.png`,
  },
  [BLOCKS.COAL_ORE]: `${MC_ASSET_ROOT}/block/coal_ore.png`,
  [BLOCKS.IRON_ORE]: `${MC_ASSET_ROOT}/block/iron_ore.png`,
  [BLOCKS.GOLD_ORE]: `${MC_ASSET_ROOT}/block/gold_ore.png`,
  [BLOCKS.DIAMOND_ORE]: `${MC_ASSET_ROOT}/block/diamond_ore.png`,
  [BLOCKS.BEDROCK]: `${MC_ASSET_ROOT}/block/bedrock.png`,
  [BLOCKS.WATER]: `${MC_ASSET_ROOT}/block/water_still.png`,
  [BLOCKS.TORCH_BLOCK]: `${MC_ASSET_ROOT}/block/torch.png`,
};
const ITEM_TEXTURE_URLS = {
  [BLOCKS.STICK]: `${MC_ASSET_ROOT}/item/stick.png`,
  [BLOCKS.TORCH]: `${MC_ASSET_ROOT}/item/torch.png`,
  [BLOCKS.APPLE]: `${MC_ASSET_ROOT}/item/apple.png`,
  [BLOCKS.BREAD]: `${MC_ASSET_ROOT}/item/bread.png`,
  [BLOCKS.COOKED_BEEF]: `${MC_ASSET_ROOT}/item/cooked_beef.png`,
  [BLOCKS.COOKED_CHICKEN]: `${MC_ASSET_ROOT}/item/cooked_chicken.png`,
  [BLOCKS.COOKED_PORK]: `${MC_ASSET_ROOT}/item/cooked_porkchop.png`,
};
const NPC_TEXTURE_URLS = {
  cow: `${MC_ASSET_ROOT}/entity/cow/cow.png`,
  pig: `${MC_ASSET_ROOT}/entity/pig/pig.png`,
  chicken: `${MC_ASSET_ROOT}/entity/chicken.png`,
};

const NPC_FALLBACK_COLORS = {
  cow: "#8b6a52",
  pig: "#f2a7b8",
  chicken: "#fff4d2",
};

function createSteveFallbackTexture() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  if (!ctx) return createSolidTexture(0xd7b28a);

  // Base skin tone to avoid black/uninitialized pixels.
  ctx.fillStyle = "#d7b28a";
  ctx.fillRect(0, 0, 64, 64);

  // Hair (head area).
  ctx.fillStyle = "#4a2f1f";
  ctx.fillRect(0, 0, 32, 16);

  // Eyes on head front.
  ctx.fillStyle = "#1f2b44";
  ctx.fillRect(10, 12, 2, 2);
  ctx.fillRect(14, 12, 2, 2);

  // Shirt areas.
  ctx.fillStyle = "#3d6cc4";
  ctx.fillRect(16, 16, 24, 16);

  // Arm sleeves.
  ctx.fillStyle = "#2f5aaa";
  ctx.fillRect(40, 20, 16, 12);

  // Pants areas.
  ctx.fillStyle = "#4f59aa";
  ctx.fillRect(0, 16, 16, 16);

  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.ClampToEdgeWrapping;
  return t;
}

function createSteveAvatarDataUrl() {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d");
  if (!ctx) return "";
  const skin = createSteveFallbackTexture().image;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(skin, 8, 8, 8, 8, 0, 0, 16, 16);
  return c.toDataURL("image/png");
}

function createNpcFallbackTexture(kind) {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  const base = NPC_FALLBACK_COLORS[kind] || "#9ac7d8";
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 64, 64);
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 60, 60);
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(8, 8, 48, 16);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 12px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText((NPC_ROLE_BY_KIND[kind] || "NPC").slice(0, 8), 32, 16);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  return t;
}

function pickNpcName(seedText) {
  let h = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    h = (h * 31 + seedText.charCodeAt(i)) >>> 0;
  }
  return NPC_NAME_POOL[h % NPC_NAME_POOL.length];
}

function makeLabelSprite(text, color = "#fff5d8") {
  const w = 256;
  const h = 64;
  const cvs = document.createElement("canvas");
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext("2d");
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "rgba(8,12,20,0.7)";
  ctx.fillRect(2, 12, w - 4, h - 24);
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.strokeRect(2, 12, w - 4, h - 24);
  ctx.font = "bold 22px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);
  const tex = new THREE.CanvasTexture(cvs);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(1.45, 0.38, 1);
  return sprite;
}

function getNpcTexture(kind) {
  const remoteUrl = NPC_TEXTURE_URLS[kind] || NPC_TEXTURE_URLS.cow;
  return getSafeNpcTexture(remoteUrl, createNpcFallbackTexture(kind));
}

function getSafeNpcTexture(url, fallback) {
  if (graphicsMode === "procedural") return fallback;
  if (!url) return fallback;
  if (textureCache.has(url)) return textureCache.get(url);
  textureCache.set(url, fallback);
  textureLoader.load(
    url,
    (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.magFilter = THREE.NearestFilter;
      loaded.minFilter = THREE.NearestFilter;
      loaded.generateMipmaps = false;
      textureCache.set(url, loaded);
    },
    undefined,
    () => {
      textureCache.set(url, fallback);
    }
  );
  return fallback;
}

function createSolidTexture(hex) {
  const c = document.createElement("canvas");
  c.width = 8;
  c.height = 8;
  const ctx = c.getContext("2d");
  ctx.fillStyle = `#${hex.toString(16).padStart(6, "0")}`;
  ctx.fillRect(0, 0, 8, 8);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  return t;
}

function getSafeTexture(url, fallback) {
  if (graphicsMode === "procedural") return fallback;
  if (!url) return fallback;
  if (textureCache.has(url)) return textureCache.get(url);
  textureCache.set(url, fallback);
  textureLoader.load(
    url,
    (loaded) => {
      loaded.colorSpace = THREE.SRGBColorSpace;
      loaded.magFilter = THREE.LinearFilter;
      loaded.minFilter = THREE.LinearMipmapLinearFilter;
      loaded.generateMipmaps = true;
      textureCache.set(url, loaded);
    },
    undefined,
    () => {
      textureCache.set(url, fallback);
    }
  );
  return fallback;
}

function createSkinMap(baseTexture, x, y, w, h) {
  const map = baseTexture.clone();
  map.needsUpdate = true;
  map.colorSpace = THREE.SRGBColorSpace;
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  map.wrapS = THREE.ClampToEdgeWrapping;
  map.wrapT = THREE.ClampToEdgeWrapping;
  map.repeat.set(w / 64, h / 64);
  map.offset.set(x / 64, 1 - (y + h) / 64);
  return map;
}

function createSkinBox(w, h, d, texture, faces) {
  const mats = [
    new THREE.MeshLambertMaterial({ map: createSkinMap(texture, faces.right[0], faces.right[1], faces.right[2], faces.right[3]) }),
    new THREE.MeshLambertMaterial({ map: createSkinMap(texture, faces.left[0], faces.left[1], faces.left[2], faces.left[3]) }),
    new THREE.MeshLambertMaterial({ map: createSkinMap(texture, faces.top[0], faces.top[1], faces.top[2], faces.top[3]) }),
    new THREE.MeshLambertMaterial({ map: createSkinMap(texture, faces.bottom[0], faces.bottom[1], faces.bottom[2], faces.bottom[3]) }),
    new THREE.MeshLambertMaterial({ map: createSkinMap(texture, faces.front[0], faces.front[1], faces.front[2], faces.front[3]) }),
    new THREE.MeshLambertMaterial({ map: createSkinMap(texture, faces.back[0], faces.back[1], faces.back[2], faces.back[3]) }),
  ];
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats);
}

function createBlockyHumanModel(texture) {
  const skinTexture = texture || createSteveFallbackTexture();
  const group = new THREE.Group();
  const unit = 0.0625;

  const head = createSkinBox(8 * unit, 8 * unit, 8 * unit, skinTexture, {
    right: [0, 8, 8, 8],
    left: [16, 8, 8, 8],
    top: [8, 0, 8, 8],
    bottom: [16, 0, 8, 8],
    front: [8, 8, 8, 8],
    back: [24, 8, 8, 8],
  });
  head.position.set(0, 1.7, 0);

  const body = createSkinBox(8 * unit, 12 * unit, 4 * unit, skinTexture, {
    right: [16, 20, 4, 12],
    left: [28, 20, 4, 12],
    top: [20, 16, 8, 4],
    bottom: [28, 16, 8, 4],
    front: [20, 20, 8, 12],
    back: [32, 20, 8, 12],
  });
  body.position.set(0, 1.1, 0);

  const armFaces = {
    right: [40, 20, 4, 12],
    left: [48, 20, 4, 12],
    top: [44, 16, 4, 4],
    bottom: [48, 16, 4, 4],
    front: [44, 20, 4, 12],
    back: [52, 20, 4, 12],
  };
  const armL = createSkinBox(4 * unit, 12 * unit, 4 * unit, skinTexture, armFaces);
  armL.position.set(-0.38, 1.1, 0);
  const armR = createSkinBox(4 * unit, 12 * unit, 4 * unit, skinTexture, armFaces);
  armR.position.set(0.38, 1.1, 0);

  const legFaces = {
    right: [0, 20, 4, 12],
    left: [8, 20, 4, 12],
    top: [4, 16, 4, 4],
    bottom: [8, 16, 4, 4],
    front: [4, 20, 4, 12],
    back: [12, 20, 4, 12],
  };
  const legL = createSkinBox(4 * unit, 12 * unit, 4 * unit, skinTexture, legFaces);
  legL.position.set(-0.13, 0.35, 0);
  const legR = createSkinBox(4 * unit, 12 * unit, 4 * unit, skinTexture, legFaces);
  legR.position.set(0.13, 0.35, 0);

  const currentModelHeight = 1.95;
  group.scale.setScalar(PLAYER_HEIGHT_BLOCKS / currentModelHeight);
  group.add(head, body, legL, legR, armL, armR);
  return group;
}

function createSimpleHumanoidModel(texture) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0x111111,
    emissiveIntensity: 0.2,
    map: texture || createSolidTexture(0xd6cbbd),
  });
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), material);
  head.position.set(0, 1.4, 0);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), material);
  body.position.set(0, 0.8, 0);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 0.26), material);
  legL.position.set(-0.18, 0.2, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.6, 0.26), material);
  legR.position.set(0.18, 0.2, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), material);
  armL.position.set(-0.52, 0.85, 0);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.22), material);
  armR.position.set(0.52, 0.85, 0);
  group.add(head, body, legL, legR, armL, armR);
  return group;
}

function createBlockyAnimalModel(kind, texture) {
  const group = new THREE.Group();
  const tex = texture || createNpcFallbackTexture(kind);
  // Ensure the texture looks like Minecraft pixels.
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;

  const material = new THREE.MeshLambertMaterial({ color: 0xffffff, map: tex, transparent: true, alphaTest: 0.05 });

  if (kind === "cow") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.7, 0.5), material);
    body.position.set(0, 0.75, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.65), material);
    head.position.set(0, 1.0, 0.55);
    const hornL = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.08), new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
    hornL.position.set(-0.22, 1.18, 0.82);
    const hornR = hornL.clone();
    hornR.position.x = 0.22;
    const legGeo = new THREE.BoxGeometry(0.16, 0.45, 0.16);
    const legFL = new THREE.Mesh(legGeo, material);
    legFL.position.set(-0.35, 0.25, 0.18);
    const legFR = new THREE.Mesh(legGeo, material);
    legFR.position.set(0.35, 0.25, 0.18);
    const legBL = new THREE.Mesh(legGeo, material);
    legBL.position.set(-0.35, 0.25, -0.18);
    const legBR = new THREE.Mesh(legGeo, material);
    legBR.position.set(0.35, 0.25, -0.18);
    group.add(body, head, hornL, hornR, legFL, legFR, legBL, legBR);
    return group;
  }

  if (kind === "pig") {
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.55, 0.62), material);
    body.position.set(0, 0.65, 0);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.42, 0.48), material);
    head.position.set(0, 0.82, 0.6);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.18), new THREE.MeshLambertMaterial({ color: 0xe38ea3 }));
    snout.position.set(0, 0.78, 0.87);
    const legGeo = new THREE.BoxGeometry(0.14, 0.36, 0.14);
    const legFL = new THREE.Mesh(legGeo, material);
    legFL.position.set(-0.28, 0.22, 0.2);
    const legFR = new THREE.Mesh(legGeo, material);
    legFR.position.set(0.28, 0.22, 0.2);
    const legBL = new THREE.Mesh(legGeo, material);
    legBL.position.set(-0.28, 0.22, -0.2);
    const legBR = new THREE.Mesh(legGeo, material);
    legBR.position.set(0.28, 0.22, -0.2);
    group.add(body, head, snout, legFL, legFR, legBL, legBR);
    return group;
  }

  // chicken
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.48, 0.38), material);
  body.position.set(0, 0.7, 0);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), material);
  head.position.set(0, 0.98, 0.3);
  const beak = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.08, 0.16), new THREE.MeshLambertMaterial({ color: 0xf2c94c }));
  beak.position.set(0, 0.93, 0.52);
  const wGeo = new THREE.BoxGeometry(0.08, 0.24, 0.34);
  const wingL = new THREE.Mesh(wGeo, material);
  wingL.position.set(-0.28, 0.72, 0.0);
  const wingR = new THREE.Mesh(wGeo, material);
  wingR.position.set(0.28, 0.72, 0.0);
  const legGeo = new THREE.BoxGeometry(0.06, 0.22, 0.06);
  const legL = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: 0xd59a2c }));
  legL.position.set(-0.1, 0.22, 0.06);
  const legR = new THREE.Mesh(legGeo, new THREE.MeshLambertMaterial({ color: 0xd59a2c }));
  legR.position.set(0.1, 0.22, 0.06);
  group.add(body, head, beak, wingL, wingR, legL, legR);
  return group;
}

function attachNpcItems(npcGroup, seedText) {
  let h = 0;
  for (let i = 0; i < seedText.length; i += 1) {
    h = (h * 33 + seedText.charCodeAt(i)) >>> 0;
  }
  const picks = 1 + (h % 2);
  for (let i = 0; i < picks; i += 1) {
    const item = NPC_ITEM_LIBRARY[(h + i * 7) % NPC_ITEM_LIBRARY.length];
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(item.scale[0], item.scale[1], item.scale[2]),
      new THREE.MeshStandardMaterial({ color: item.color })
    );
    mesh.position.set(item.offset[0], item.offset[1], item.offset[2]);
    npcGroup.add(mesh);
  }
}

function getTextureUrl(type, face = "side") {
  const blockEntry = BLOCK_TEXTURE_URLS[type];
  if (typeof blockEntry === "string") return blockEntry;
  if (blockEntry && typeof blockEntry === "object") return blockEntry[face] || blockEntry.side || null;
  return ITEM_TEXTURE_URLS[type] || null;
}

function loadRemoteTexture(url) {
  if (!url) return null;
  if (textureCache.has(url)) return textureCache.get(url);
  const tex = textureLoader.load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  textureCache.set(url, tex);
  return tex;
}

// Preview renderer cache for small 3D thumbnails used in UI chips.
const previewCache = new Map();
let previewRenderer = null;
let previewScene = null;
let previewCamera = null;

function ensurePreviewRenderer() {
  if (previewRenderer) return;
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  previewRenderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  previewRenderer.setSize(64, 64);
  previewScene = new THREE.Scene();
  previewCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
  previewCamera.position.set(2, 2, 2);
  previewCamera.lookAt(0, 0, 0);
  const amb = new THREE.AmbientLight(0xffffff, 0.6);
  previewScene.add(amb);
  const dir = new THREE.DirectionalLight(0xffffff, 0.6);
  dir.position.set(5, 10, 7);
  previewScene.add(dir);
}

function renderBlockPreview(type) {
  // return cached canvas if available
  const key = `block:${type}`;
  if (previewCache.has(key)) return previewCache.get(key);
  ensurePreviewRenderer();

  // Build a simple cube using the block's face materials (uses fallback textures immediately)
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const mats = [
    getFaceMaterial(type, "side"),
    getFaceMaterial(type, "side"),
    getFaceMaterial(type, "top"),
    getFaceMaterial(type, "bottom"),
    getFaceMaterial(type, "front"),
    getFaceMaterial(type, "back"),
  ];
  const mesh = new THREE.Mesh(geo, mats);
  mesh.rotation.y = Math.PI / 4;
  mesh.rotation.x = -0.35;

  const root = new THREE.Group();
  root.add(mesh);
  previewScene.add(root);

  // Render to the preview renderer's canvas, copy into a new canvas for safe caching.
  previewRenderer.render(previewScene, previewCamera);
  const out = document.createElement("canvas");
  out.width = previewRenderer.domElement.width;
  out.height = previewRenderer.domElement.height;
  const ctx = out.getContext("2d");
  ctx.drawImage(previewRenderer.domElement, 0, 0);

  // Cleanup temporary objects from scene
  previewScene.remove(root);
  // Cache and return
  previewCache.set(key, out);
  return out;
}

function applyChipTexture(chip, type) {
  // If this is a placeable block, render a small 3D preview and insert as a canvas
  if (isPlaceable(type)) {
    try {
      const preview = renderBlockPreview(type);
      chip.style.background = "transparent";
      chip.innerHTML = "";
      preview.className = "chip-preview-canvas";
      preview.style.width = "48px";
      preview.style.height = "48px";
      preview.style.imageRendering = "pixelated";
      chip.appendChild(preview);
      return;
    } catch (e) {
      // Fall back to 2D if WebGL rendering fails
      console.warn("3D preview failed, falling back to 2D preview", e);
    }
  }

  // Fallback: keep original 2D background behavior for items and non-placeable textures
  const textureUrl = getTextureUrl(type, "side");
  if (textureUrl) {
    chip.style.backgroundColor = "transparent";
    chip.style.backgroundImage = `url("${textureUrl}")`;
    chip.style.backgroundSize = "cover";
    chip.style.backgroundPosition = "center";
    chip.style.imageRendering = "auto";
    chip.innerHTML = "";
    return;
  }
  chip.style.background = `#${(BLOCK_COLORS[type] || 0xffffff).toString(16).padStart(6, "0")}`;
  chip.innerHTML = "";
}

function applySteveAvatar() {
  if (!playerAvatar) return;
  playerAvatar.textContent = "";
  playerAvatar.style.backgroundImage = `url("${STEVE_TEXTURE_URL}"), url("${STEVE_FALLBACK_AVATAR_URL}")`;
  playerAvatar.style.backgroundSize = "cover";
  playerAvatar.style.backgroundPosition = "center";
  playerAvatar.style.imageRendering = "pixelated";
}

function getSlot(index) {
  return state.slots[index];
}

function setSlot(index, item) {
  state.slots[index] = item;
}

function getSelectedType() {
  const item = getSlot(state.selectedSlot);
  return item ? item.t : null;
}

function isPlaceable(type) {
  return Number.isFinite(type) && type < 100;
}

function selectSlot(index) {
  state.selectedSlot = index;
  updateInventoryUI();
}

function renderHotbar() {
  hotbar.innerHTML = "";
  for (let i = 0; i < 9; i += 1) {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.index = i;
    if (i === state.selectedSlot) slot.classList.add("active");
    const item = getSlot(i);
    if (item) {
      const chip = document.createElement("div");
      chip.className = "chip";
      applyChipTexture(chip, item.t);
      slot.appendChild(chip);
      const badge = document.createElement("div");
      badge.className = "count";
      badge.textContent = state.mode === 1 ? "inf" : item.c;
      slot.appendChild(badge);
    } else {
      slot.textContent = i + 1;
    }
    slot.addEventListener("click", () => selectSlot(i));
    hotbar.appendChild(slot);
  }
}

function renderInventorySlots() {
  inventoryGrid.innerHTML = "";
  for (let i = 9; i < 36; i += 1) {
    const slot = buildSlotElement(i);
    inventoryGrid.appendChild(slot);
  }
}

function renderInventoryHotbar() {
  if (!inventoryHotbar) return;
  inventoryHotbar.innerHTML = "";
  for (let i = 0; i < 9; i += 1) {
    const slot = buildSlotElement(i);
    inventoryHotbar.appendChild(slot);
  }
}

function buildSlotElement(index) {
  const slot = document.createElement("div");
  slot.className = "inv-item";
  slot.dataset.index = index;
  if (index === state.selectedSlot) slot.classList.add("active");
  const item = getSlot(index);
  if (item) {
    const chip = document.createElement("div");
    chip.className = "chip";
    applyChipTexture(chip, item.t);
    const label = document.createElement("div");
    label.textContent = BLOCK_NAMES[item.t];
    slot.appendChild(chip);
    slot.appendChild(label);
    const badge = document.createElement("div");
    badge.className = "count";
    badge.textContent = state.mode === 1 ? "inf" : item.c;
    slot.appendChild(badge);
  }
  slot.addEventListener("click", (e) => handleSlotClick(index, e.shiftKey));
  return slot;
}

function handleSlotClick(index, shiftKey) {
  const item = getSlot(index);
  if (shiftKey && item) {
    addToCraft(item.t);
    return;
  }
  if (!cursor.item && item) {
    cursor.item = { ...item };
    setSlot(index, null);
  } else if (cursor.item && !item) {
    setSlot(index, { ...cursor.item });
    cursor.item = null;
  } else if (cursor.item && item) {
    const temp = { ...item };
    setSlot(index, { ...cursor.item });
    cursor.item = temp;
  }
  sendInventoryUpdate();
  updateInventoryUI();
}

function renderPalette() {
  if (!paletteGrid) return;
  paletteGrid.innerHTML = "";
  getPaletteOrder().forEach((type) => {
    const item = document.createElement("div");
    item.className = "inv-item";
    item.dataset.type = type;
    const chip = document.createElement("div");
    chip.className = "chip";
    applyChipTexture(chip, type);
    const label = document.createElement("div");
    label.textContent = BLOCK_NAMES[type];
    item.appendChild(chip);
    item.appendChild(label);
    item.addEventListener("click", () => giveFromPalette(type));
    paletteGrid.appendChild(item);
  });
}

function updateCursorUI() {
  if (!cursorItem) return;
  if (!cursor.item) {
    cursorItem.classList.add("hidden");
    cursorItem.innerHTML = "";
    return;
  }
  cursorItem.classList.remove("hidden");
  cursorItem.innerHTML = "";
  const chip = document.createElement("div");
  chip.className = "chip";
  applyChipTexture(chip, cursor.item.t);
  const badge = document.createElement("div");
  badge.className = "count";
  badge.textContent = state.mode === 1 ? "inf" : cursor.item.c;
  cursorItem.appendChild(chip);
  cursorItem.appendChild(badge);
}

function updateInventoryUI() {
  if (inventoryTitle) {
    inventoryTitle.textContent = `Inventory (${state.mode === 1 ? "Creative" : "Survival"})`;
  }
  renderHotbar();
  renderInventorySlots();
  renderInventoryHotbar();
  updateCursorUI();
  if (paletteGrid) {
    paletteGrid.parentElement.classList.toggle("hidden", state.mode !== 1);
  }
}

function giveFromPalette(type) {
  if (state.mode !== 1) return;
  const slotIndex = state.selectedSlot ?? 0;
  setSlot(slotIndex, { t: type, c: MAX_STACK });
  socketSend({ type: "give", playerId: state.playerId, blockType: type, count: MAX_STACK });
  sendInventoryUpdate();
  updateInventoryUI();
}

renderHotbar();
renderInventorySlots();
renderInventoryHotbar();
renderPalette();
applySteveAvatar();
updateChunkDistanceUI();
applyViewDistanceVisuals();
updateDashboardGoals();

if (chunkDistanceInput) {
  chunkDistanceInput.addEventListener("input", (e) => {
    const value = Number(e.target.value);
    requestVisibleChunksUpdate(value);
  });
}
if (photoModeBtn) {
  photoModeBtn.addEventListener("click", () => {
    togglePhotoMode();
  });
}
if (centerCameraBtn) {
  centerCameraBtn.addEventListener("click", () => {
    pitch = 0;
    pushChat("SYSTEM", "View centered");
  });
}
if (toggleLanternBtn) {
  toggleLanternBtn.addEventListener("click", () => {
    lantern.enabled = !lantern.enabled;
    pushChat("SYSTEM", `Lantern ${lantern.enabled ? "ON" : "OFF"}`);
  });
}
const openPage = (path) => {
  try {
    window.open(path, "_blank", "noopener,noreferrer");
  } catch (_) {
    window.location.href = path;
  }
};
if (openToolsBtn) openToolsBtn.addEventListener("click", () => openPage("/tools/"));
if (openLiveMapBtn) openLiveMapBtn.addEventListener("click", () => openPage("/live-map/"));
if (openSchemBtn) openSchemBtn.addEventListener("click", () => openPage("/schem-editor/"));
if (openPanelBtn) openPanelBtn.addEventListener("click", () => openPage("/panel/"));
if (openTutorialBtn) openTutorialBtn.addEventListener("click", () => openPage("/tutorial/"));
if (openWikiBtn) openWikiBtn.addEventListener("click", () => openPage("/wiki/"));
if (openCloneBtn) openCloneBtn.addEventListener("click", () => openPage("/clone/"));
applyPhotoMode();

window.addEventListener("wheel", (e) => {
  const delta = e.deltaY > 0 ? 1 : -1;
  const next = (state.selectedSlot + delta + 9) % 9;
  selectSlot(next);
});

function getBlockOrder() {
  return [
    BLOCKS.GRASS,
    BLOCKS.DIRT,
    BLOCKS.STONE,
    BLOCKS.COAL_ORE,
    BLOCKS.IRON_ORE,
    BLOCKS.GOLD_ORE,
    BLOCKS.DIAMOND_ORE,
    BLOCKS.BEDROCK,
    BLOCKS.WATER,
    BLOCKS.TORCH_BLOCK,
    BLOCKS.COBBLE,
    BLOCKS.SAND,
    BLOCKS.WOOD,
    BLOCKS.PLANK,
    BLOCKS.BRICK,
    BLOCKS.LEAVES,
    BLOCKS.CHEST,
  ];
}

function getPaletteOrder() {
  return [
    ...getBlockOrder(),
    BLOCKS.STICK,
    BLOCKS.TORCH,
    BLOCKS.APPLE,
    BLOCKS.BREAD,
    BLOCKS.COOKED_BEEF,
    BLOCKS.COOKED_CHICKEN,
    BLOCKS.COOKED_PORK,
  ];
}

function keyFor(x, y, z) {
  const minY = state.worldSize?.minY ?? 0;
  const yEncoded = (y - minY) & 0xff;
  return ((x & 0x7ff) << 19) | ((z & 0x7ff) << 8) | yEncoded;
}

function keyToX(key) {
  return (key >> 19) & 0x7ff;
}

function keyToZ(key) {
  return (key >> 8) & 0x7ff;
}

function keyToY(key) {
  const minY = state.worldSize?.minY ?? 0;
  return (key & 0xff) + minY;
}

function getTypeStore(type) {
  let store = state.blocksByType.get(type);
  if (!store) {
    store = new Set();
    state.blocksByType.set(type, store);
  }
  return store;
}

function setWorldBlock(x, y, z, nextType) {
  const key = keyFor(x, y, z);
  const oldType = state.blocks.get(key) || BLOCKS.AIR;
  if (oldType === nextType) return oldType;

  if (oldType !== BLOCKS.AIR) {
    state.blocks.delete(key);
    const oldStore = state.blocksByType.get(oldType);
    if (oldStore) {
      oldStore.delete(key);
      if (oldStore.size === 0) state.blocksByType.delete(oldType);
    }
  }

  if (nextType !== BLOCKS.AIR) {
    state.blocks.set(key, nextType);
    getTypeStore(nextType).add(key);
  }

  // Keep chunk voxel store in sync for fast raycast + meshing.
  setChunkBlock(x, y, z, nextType);
  queueChunkMesh(blockToChunk(x), blockToChunk(z));

  return oldType;
}

function getChunkSize() {
  return state.worldSize?.chunkSize || 16;
}

function normalizeVisibleChunks(value) {
  const min = state.worldSize?.minVisibleChunks || 3;
  const max = state.worldSize?.maxVisibleChunks || 9;
  let v = Number(value);
  if (!Number.isFinite(v)) v = state.worldSize?.visibleChunks || min;
  v = Math.max(min, Math.min(max, Math.round(v)));
  if (v % 2 === 0) v = Math.min(max, v + 1);
  return v;
}

function updateChunkDistanceUI() {
  if (!chunkDistanceInput || !chunkDistanceValue) return;
  const min = state.worldSize?.minVisibleChunks || 3;
  const max = state.worldSize?.maxVisibleChunks || 9;
  const visible = normalizeVisibleChunks(state.worldSize?.visibleChunks || 3);
  chunkDistanceInput.min = String(min);
  chunkDistanceInput.max = String(max);
  chunkDistanceInput.step = "2";
  chunkDistanceInput.value = String(visible);
  chunkDistanceValue.textContent = `${visible} chunks`;
}

function applyViewDistanceVisuals() {
  const visible = normalizeVisibleChunks(state.worldSize?.visibleChunks || 3);
  const span = visible * getChunkSize();
  const fogNear = Math.max(18, span * 0.45);
  const fogFar = Math.max(fogNear + 12, span * 1.35);
  scene.fog.near = fogNear;
  scene.fog.far = fogFar;
  camera.far = Math.max(90, fogFar + 24);
  camera.updateProjectionMatrix();
}

function updateDayNight(dt) {
  dayNight.progress = (dayNight.progress + (dt / dayNight.cycleSeconds) * dayNight.speedMultiplier) % 1;
  const angle = dayNight.progress * Math.PI * 2;
  const sunHeight = Math.sin(angle);
  const daylight = Math.max(0, sunHeight * 0.9 + 0.12);
  dayNight.daylight = daylight;

  ambient.intensity = 0.2 + daylight * 0.62;
  sun.intensity = 0.08 + daylight * 1.05;
  sun.position.set(Math.cos(angle) * 28, 7 + sunHeight * 24, Math.sin(angle) * 18);

  scene.background.copy(NIGHT_SKY).lerp(DAY_SKY, daylight);
  if (scene.fog) {
    scene.fog.color.copy(scene.background);
  }

  const worldHour = Math.floor((dayNight.progress * 24 + 6) % 24);
  const worldMinute = Math.floor(((dayNight.progress * 24 * 60) % 60));
  const h = String(worldHour).padStart(2, "0");
  const m = String(worldMinute).padStart(2, "0");
  if (dayClock) {
    dayClock.textContent = `World Time: ${h}:${m} (${daylight > 0.42 ? "Day" : "Night"}) | x${dayNight.speedMultiplier}`;
  }

  if (starsGroup.children.length) {
    starsGroup.position.copy(camera.position);
    const stars = starsGroup.children[0];
    stars.material.opacity = Math.max(0, (0.45 - daylight) * 2.4);
    stars.rotation.y += dt * 0.01;
  }
}

function updateWeather(dt) {
  const now = performance.now();
  if (now > weatherState.nextShift) {
    weatherState.target = weatherState.isRaining ? 0 : 1;
    weatherState.isRaining = !weatherState.isRaining;
    weatherState.nextShift = now + 90000 + Math.random() * 120000;
  }
  weatherState.intensity += (weatherState.target - weatherState.intensity) * Math.min(1, dt * 0.3);
  if (rainGroup.children.length) {
    const rain = rainGroup.children[0];
    rain.material.opacity = 0.35 * weatherState.intensity;
    rain.position.copy(camera.position);
    rain.position.y += 8;
    rain.rotation.y += dt * 0.1;
  }
  if (scene.fog) {
    const base = dayNight.daylight > 0.4 ? 0x9db8d6 : 0x0b1322;
    const rainFog = dayNight.daylight > 0.4 ? 0x6f8aa6 : 0x0a0f1a;
    scene.fog.color.setHex(THREE.MathUtils.lerp(base, rainFog, weatherState.intensity));
  }
}

function updateSurvivalStats(dt) {
  const sprinting = move.forward !== 0 && keysDown.has("ControlLeft");
  const drain = sprinting ? 20 : 6;
  survivalStats.hunger = Math.max(0, survivalStats.hunger - dt * (weatherState.intensity > 0.5 ? 0.8 : 0.5));
  survivalStats.stamina = Math.max(0, survivalStats.stamina - dt * drain);
  if (!sprinting) {
    survivalStats.stamina = Math.min(100, survivalStats.stamina + dt * 18);
  }
  const coldTarget = dayNight.daylight < 0.35 && weatherState.intensity > 0.2 ? 1 + seasonState.tempBias : 0 + seasonState.tempBias;
  survivalStats.cold += (coldTarget - survivalStats.cold) * Math.min(1, dt * 0.8);
  if (survivalStats.hunger <= 1 || survivalStats.cold > 0.8) {
    survivalStats.health = Math.max(0, survivalStats.health - dt * 6);
  } else if (survivalStats.hunger > 60 && survivalStats.health < 100) {
    survivalStats.health = Math.min(100, survivalStats.health + dt * 2.4);
  }
  if (survivalStats.health <= 0) {
    survivalStats.health = 100;
    survivalStats.hunger = 70;
    survivalStats.stamina = 80;
    pushChat("SYSTEM", "Вы потеряли сознание и очнулись у спавна.");
    camera.position.set(
      (state.worldSize?.x || 32) * 0.5,
      (state.worldSize?.maxY || 32) + 2,
      (state.worldSize?.z || 32) * 0.5
    );
  }
  if (statsInfo) {
    const st = Math.round(survivalStats.stamina);
    const hu = Math.round(survivalStats.hunger);
    const hp = Math.round(survivalStats.health);
    const cold = survivalStats.cold > 0.5 ? " (Холодно)" : "";
    statsInfo.textContent = `HP: ${hp}% | Выносливость: ${st}% | Голод: ${hu}%${cold}`;
  }
}

function updateSeasons(dt) {
  const now = performance.now();
  if (now > seasonState.nextShift) {
    seasonState.index = (seasonState.index + 1) % 4;
    const names = ["Весна", "Лето", "Осень", "Зима"];
    const bias = [0.0, -0.1, 0.15, 0.35];
    seasonState.name = names[seasonState.index];
    seasonState.tempBias = bias[seasonState.index];
    seasonState.nextShift = now + 240000 + Math.random() * 180000;
    pushChat("SYSTEM", `Сезон сменился: ${seasonState.name}`);
  }
}

function consumeFood(type) {
  if (!FOOD_VALUES.has(type)) return false;
  const slotIndex = state.selectedSlot ?? 0;
  const item = getSlot(slotIndex);
  if (!item || item.t !== type || item.c <= 0) return false;
  item.c -= 1;
  if (item.c <= 0) setSlot(slotIndex, null);
  survivalStats.hunger = Math.min(100, survivalStats.hunger + FOOD_VALUES.get(type));
  survivalStats.health = Math.min(100, survivalStats.health + 6);
  sendInventoryUpdate();
  updateInventoryUI();
  pushChat("SYSTEM", `Вы съели ${BLOCK_NAMES[type]}`);
  return true;
}

function updateLantern(dt) {
  lantern.charge = lantern.maxCharge;

  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  headLamp.position.set(
    camera.position.x + forward.x * 0.7,
    camera.position.y - 0.08,
    camera.position.z + forward.z * 0.7
  );
  const held = getSelectedType();
  const torchInHand = held === BLOCKS.TORCH;
  const active = lantern.enabled || torchInHand;
  headLamp.intensity = lantern.enabled ? 1.4 : torchInHand ? 0.95 : 0;
  headLamp.distance = lantern.enabled ? 17 : torchInHand ? 12 : 0;

  if (lanternInfo) {
    const pct = Math.round((lantern.charge / lantern.maxCharge) * 100);
    lanternInfo.textContent = `Light: ${active ? "ON" : "OFF"} | Lantern ${lantern.enabled ? "ON" : "OFF"} | Torch ${torchInHand ? "HELD" : "NO"}`;
  }
}

function updateCompass() {
  if (!compassInfo) return;
  const heading = ((yaw * 180) / Math.PI + 360) % 360;
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  const idx = Math.round(heading / 45) % 8;
  const x = Math.floor(camera.position.x);
  const z = Math.floor(camera.position.z);
  compassInfo.textContent = `Compass: ${dirs[idx]} (${heading.toFixed(0)}Â°) | X:${x} Z:${z}`;
}

function spawnNightMob() {
  const id = `night-${Math.random().toString(36).slice(2, 10)}`;
  const angle = Math.random() * Math.PI * 2;
  const radius = 12 + Math.random() * 26;
  const x = camera.position.x + Math.cos(angle) * radius;
  const z = camera.position.z + Math.sin(angle) * radius;
  const y = camera.position.y - 0.4 + Math.random() * 0.8;
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.32 + Math.random() * 0.18, 10, 10),
    new THREE.MeshStandardMaterial({
      color: 0x9fd4ff,
      emissive: 0x3b69aa,
      emissiveIntensity: 1.1,
      transparent: true,
      opacity: 0.8,
    })
  );
  mesh.position.set(x, y, z);
  nightMobGroup.add(mesh);
  nightMobs.set(id, {
    id,
    mesh,
    yaw: Math.random() * Math.PI * 2,
    speed: 0.7 + Math.random() * 0.6,
    bob: Math.random() * Math.PI * 2,
  });
}

function updateNightMobs(dt) {
  if (dayNight.daylight < 0.28 && performance.now() - lastNightSpawnAt > 750) {
    if (nightMobs.size < 10) {
      spawnNightMob();
    }
    lastNightSpawnAt = performance.now();
  }

  nightMobs.forEach((mob, id) => {
    if (dayNight.daylight > 0.42) {
      mob.mesh.material.opacity -= dt * 1.2;
      if (mob.mesh.material.opacity <= 0.02) {
        nightMobGroup.remove(mob.mesh);
        nightMobs.delete(id);
      }
      return;
    }

    mob.yaw += (Math.random() - 0.5) * dt;
    mob.bob += dt * 2;
    const moveStep = mob.speed * dt;
    mob.mesh.position.x += Math.sin(mob.yaw) * moveStep;
    mob.mesh.position.z += Math.cos(mob.yaw) * moveStep;
    mob.mesh.position.y += Math.sin(mob.bob) * 0.004;
    mob.mesh.lookAt(camera.position.x, camera.position.y, camera.position.z);

    const dx = mob.mesh.position.x - camera.position.x;
    const dz = mob.mesh.position.z - camera.position.z;
    const dy = mob.mesh.position.y - camera.position.y;
    const dist2 = dx * dx + dz * dz + dy * dy;
    if (dist2 < 6.0) {
      survivalStats.health = Math.max(0, survivalStats.health - dt * 8);
    }
    if ((dx * dx + dz * dz) > 3600) {
      nightMobGroup.remove(mob.mesh);
      nightMobs.delete(id);
    }
  });
}

function spawnFirefly() {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      color: 0xfff08a,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    })
  );
  sprite.scale.setScalar(0.14 + Math.random() * 0.08);
  sprite.position.set(
    camera.position.x + (Math.random() - 0.5) * 18,
    camera.position.y - 1 + Math.random() * 2.5,
    camera.position.z + (Math.random() - 0.5) * 18
  );
  fireflyGroup.add(sprite);
  fireflies.push({
    sprite,
    drift: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.08, (Math.random() - 0.5) * 0.3),
    pulse: Math.random() * Math.PI * 2,
  });
}

function updateFireflies(dt) {
  if (dayNight.daylight < 0.5 && fireflies.length < 16) {
    for (let i = 0; i < 2; i += 1) spawnFirefly();
  }

  for (let i = fireflies.length - 1; i >= 0; i -= 1) {
    const f = fireflies[i];
    f.pulse += dt * 5;
    f.sprite.position.addScaledVector(f.drift, dt);
    f.drift.x += (Math.random() - 0.5) * dt * 0.08;
    f.drift.z += (Math.random() - 0.5) * dt * 0.08;
    f.drift.y += (Math.random() - 0.5) * dt * 0.02;
    f.sprite.material.opacity = (dayNight.daylight < 0.5 ? 0.45 : 0.05) + (Math.sin(f.pulse) * 0.35);

    const dx = f.sprite.position.x - camera.position.x;
    const dz = f.sprite.position.z - camera.position.z;
    if ((dx * dx + dz * dz) > 420 || (dayNight.daylight > 0.72 && f.sprite.material.opacity < 0.02)) {
      fireflyGroup.remove(f.sprite);
      fireflies.splice(i, 1);
    }
  }
}

function rebuildWorldBorderVisual() {
  while (borderGroup.children.length) {
    borderGroup.remove(borderGroup.children[0]);
  }

  const minX = (state.worldSize?.borderMinX ?? 0) + 0.5;
  const maxX = (state.worldSize?.borderMaxX ?? state.worldSize.x - 1) + 0.5;
  const minZ = (state.worldSize?.borderMinZ ?? 0) + 0.5;
  const maxZ = (state.worldSize?.borderMaxZ ?? state.worldSize.z - 1) + 0.5;
  const minY = (state.worldSize?.minY ?? -100) + 0.5;
  const maxY = (state.worldSize?.maxY ?? 32) + PLAYER_HEIGHT_BLOCKS;
  const wallHeight = maxY - minY;
  const centerY = minY + wallHeight * 0.5;

  const wallMat = new THREE.MeshBasicMaterial({
    color: 0x8ed0ff,
    transparent: true,
    opacity: 0.08,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xa9ddff,
    transparent: true,
    opacity: 0.45,
  });

  const spanZ = Math.max(1, maxZ - minZ);
  const spanX = Math.max(1, maxX - minX);

  const west = new THREE.Mesh(new THREE.PlaneGeometry(spanZ, wallHeight), wallMat);
  west.position.set(minX, centerY, (minZ + maxZ) * 0.5);
  west.rotation.y = Math.PI / 2;
  borderGroup.add(west);

  const east = new THREE.Mesh(new THREE.PlaneGeometry(spanZ, wallHeight), wallMat);
  east.position.set(maxX, centerY, (minZ + maxZ) * 0.5);
  east.rotation.y = Math.PI / 2;
  borderGroup.add(east);

  const north = new THREE.Mesh(new THREE.PlaneGeometry(spanX, wallHeight), wallMat);
  north.position.set((minX + maxX) * 0.5, centerY, minZ);
  borderGroup.add(north);

  const south = new THREE.Mesh(new THREE.PlaneGeometry(spanX, wallHeight), wallMat);
  south.position.set((minX + maxX) * 0.5, centerY, maxZ);
  borderGroup.add(south);

  const topLoopPoints = [
    new THREE.Vector3(minX, maxY, minZ),
    new THREE.Vector3(maxX, maxY, minZ),
    new THREE.Vector3(maxX, maxY, maxZ),
    new THREE.Vector3(minX, maxY, maxZ),
    new THREE.Vector3(minX, maxY, minZ),
  ];
  const topLoop = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(topLoopPoints),
    lineMat
  );
  borderGroup.add(topLoop);
}

function clampToWorldBorder(pos) {
  const minX = (state.worldSize?.borderMinX ?? 0) + 0.5;
  const maxX = (state.worldSize?.borderMaxX ?? state.worldSize.x - 1) + 0.5;
  const minZ = (state.worldSize?.borderMinZ ?? 0) + 0.5;
  const maxZ = (state.worldSize?.borderMaxZ ?? state.worldSize.z - 1) + 0.5;
  pos.x = Math.max(minX, Math.min(maxX, pos.x));
  pos.z = Math.max(minZ, Math.min(maxZ, pos.z));
}

function requestVisibleChunksUpdate(visibleChunks) {
  const visible = normalizeVisibleChunks(visibleChunks);
  state.worldSize.visibleChunks = visible;
  localStorage.setItem("visibleChunks", String(visible));
  updateChunkDistanceUI();
  applyViewDistanceVisuals();
  if (settingsDebounce) clearTimeout(settingsDebounce);
  settingsDebounce = setTimeout(() => {
    socketSend({ type: "settings_update", playerId: state.playerId, visibleChunks: visible });
  }, 140);
}

function chunkKey(cx, cz) {
  return `${cx},${cz}`;
}

function blockToChunk(v) {
  return Math.floor(v / getChunkSize());
}

function chunkKeyForBlock(x, z) {
  return chunkKey(blockToChunk(x), blockToChunk(z));
}

function isChunkLoadedAt(x, z) {
  const key = chunkKeyForBlock(Math.floor(x), Math.floor(z));
  return state.loadedChunks.has(key);
}

function markChunksLoaded(chunks) {
  if (!Array.isArray(chunks)) return;
  chunks.forEach((c) => {
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.z)) return;
    state.loadedChunks.add(chunkKey(c.x, c.z));
    survivalStats.exploredChunks.add(chunkKey(c.x, c.z));
  });
  flushPendingNpcs();
}

function clampByte(v) {
  return Math.max(0, Math.min(255, v | 0));
}

function hexToRgb(hex) {
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255,
  };
}

function shadeColor(hex, offset) {
  const c = hexToRgb(hex);
  return {
    r: clampByte(c.r + offset),
    g: clampByte(c.g + offset),
    b: clampByte(c.b + offset),
  };
}

function noiseAt(type, x, y) {
  const n = ((x + 11) * 374761393 + (y + 7) * 668265263 + type * 2654435761) >>> 0;
  return ((n ^ (n >> 13)) >>> 0) / 0xffffffff;
}

function paintBase(ctx, type, baseHex, variation = 22) {
  const base = hexToRgb(baseHex);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const n = noiseAt(type, x, y);
      const d = Math.floor((n - 0.5) * variation);
      ctx.fillStyle = `rgb(${clampByte(base.r + d)} ${clampByte(base.g + d)} ${clampByte(base.b + d)})`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paintOreSpecks(ctx, type, oreHex, threshold = 0.87) {
  const ore = hexToRgb(oreHex);
  for (let y = 1; y < 15; y += 1) {
    for (let x = 1; x < 15; x += 1) {
      const n = noiseAt(type * 13, x, y);
      if (n > threshold) {
        const d = Math.floor((n - threshold) * 210);
        ctx.fillStyle = `rgb(${clampByte(ore.r + d)} ${clampByte(ore.g + d)} ${clampByte(ore.b + d)})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function paintBrickLines(ctx, type) {
  for (let y = 0; y < 16; y += 4) {
    for (let x = 0; x < 16; x += 1) {
      if (noiseAt(type, x, y) > 0.2) {
        ctx.fillStyle = "rgba(60,28,20,0.45)";
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  for (let y = 2; y < 16; y += 4) {
    for (let x = 0; x < 16; x += 8) {
      ctx.fillStyle = "rgba(60,28,20,0.35)";
      ctx.fillRect(x, y - 1, 1, 3);
    }
  }
}

function paintPlankLines(ctx, type) {
  for (let y = 0; y < 16; y += 4) {
    ctx.fillStyle = `rgba(84,53,28,${0.28 + noiseAt(type, y, 1) * 0.22})`;
    ctx.fillRect(0, y, 16, 1);
  }
  for (let x = 1; x < 16; x += 5) {
    ctx.fillStyle = "rgba(96,64,33,0.22)";
    ctx.fillRect(x, 0, 1, 16);
  }
}

function paintLogRings(ctx, type) {
  const cx = 7.5;
  const cy = 7.5;
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.sin(dist * 1.15 + noiseAt(type, x, y) * 2.5);
      const d = Math.floor(ring * 10);
      ctx.fillStyle = `rgba(${clampByte(122 + d)} ${clampByte(90 + d)} ${clampByte(54 + d)} 0.75)`;
      ctx.fillRect(x, y, 1, 1);
    }
  }
}

function paintBark(ctx, type) {
  for (let x = 0; x < 16; x += 2) {
    const alpha = 0.18 + noiseAt(type, x, 2) * 0.18;
    ctx.fillStyle = `rgba(75,52,30,${alpha})`;
    ctx.fillRect(x, 0, 1, 16);
  }
}

function paintGrassTop(ctx, type) {
  paintBase(ctx, type * 31, 0x67b25d, 26);
  const h = shadeColor(0x67b25d, 16);
  for (let y = 0; y < 16; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (noiseAt(type * 19, x, y) > 0.92) {
        ctx.fillStyle = `rgb(${h.r} ${h.g} ${h.b})`;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
}

function paintGrassSide(ctx, type) {
  paintBase(ctx, BLOCKS.DIRT, BLOCK_COLORS[BLOCKS.DIRT], 24);
  for (let y = 0; y < 4; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const n = noiseAt(type * 23, x, y);
      const base = hexToRgb(0x65a955);
      const d = Math.floor((n - 0.5) * 26);
      ctx.fillStyle = `rgb(${clampByte(base.r + d)} ${clampByte(base.g + d)} ${clampByte(base.b + d)})`;
      ctx.fillRect(x, y, 1, 1);
      if (y === 3 && n > 0.74) {
        ctx.fillRect(x, y + 1, 1, 1);
      }
    }
  }
}

function createTextureCanvas(type, face = "side") {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;

  if (type === BLOCKS.GRASS && face === "top") {
    paintGrassTop(ctx, type);
    return canvas;
  }
  if (type === BLOCKS.GRASS && face === "bottom") {
    paintBase(ctx, BLOCKS.DIRT, BLOCK_COLORS[BLOCKS.DIRT], 24);
    return canvas;
  }
  if (type === BLOCKS.GRASS) {
    paintGrassSide(ctx, type);
    return canvas;
  }

  if (type === BLOCKS.WOOD && (face === "top" || face === "bottom")) {
    paintBase(ctx, type * 2, 0x8c6138, 16);
    paintLogRings(ctx, type);
    return canvas;
  }
  if (type === BLOCKS.WOOD) {
    paintBase(ctx, type, 0x8f6338, 18);
    paintBark(ctx, type);
    return canvas;
  }

  if (type === BLOCKS.PLANK) {
    paintBase(ctx, type, 0xbf8d59, 18);
    paintPlankLines(ctx, type);
    return canvas;
  }

  if (type === BLOCKS.BRICK) {
    paintBase(ctx, type, 0x9f4d38, 18);
    paintBrickLines(ctx, type);
    return canvas;
  }

  if (type === BLOCKS.COBBLE) {
    paintBase(ctx, type, 0x7f8287, 20);
    for (let y = 1; y < 16; y += 4) {
      for (let x = 0; x < 16; x += 4) {
        ctx.fillStyle = "rgba(57,60,67,0.25)";
        ctx.fillRect(x, y, 2, 2);
      }
    }
    return canvas;
  }

  if (type === BLOCKS.BEDROCK) {
    paintBase(ctx, type, 0x43474d, 14);
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        const n = noiseAt(type * 5, x, y);
        if (n > 0.9) {
          ctx.fillStyle = "rgba(210,210,210,0.28)";
          ctx.fillRect(x, y, 1, 1);
        } else if (n < 0.08) {
          ctx.fillStyle = "rgba(20,20,20,0.45)";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return canvas;
  }

  if (type === BLOCKS.LEAVES) {
    paintBase(ctx, type, 0x4a8b44, 28);
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        if (noiseAt(type * 7, x, y) > 0.94) {
          ctx.fillStyle = "rgba(20,45,22,0.55)";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return canvas;
  }

  if (type === BLOCKS.SAND) {
    paintBase(ctx, type, 0xd9c987, 16);
    for (let y = 0; y < 16; y += 1) {
      for (let x = 0; x < 16; x += 1) {
        if (noiseAt(type * 11, x, y) > 0.93) {
          ctx.fillStyle = "rgba(235,220,161,0.65)";
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    return canvas;
  }

  if (type === BLOCKS.COAL_ORE || type === BLOCKS.IRON_ORE || type === BLOCKS.GOLD_ORE || type === BLOCKS.DIAMOND_ORE) {
    paintBase(ctx, BLOCKS.STONE, 0x8f949b, 16);
    paintOreSpecks(ctx, type, BLOCK_COLORS[type], 0.875);
    return canvas;
  }

  if (type === BLOCKS.CHEST) {
    paintBase(ctx, type, 0x9f6f3b, 18);
    paintPlankLines(ctx, type * 3);
    if (face !== "bottom") {
      ctx.fillStyle = "rgba(55,34,20,0.35)";
      ctx.fillRect(0, 7, 16, 2);
    }
    return canvas;
  }

  if (type === BLOCKS.STONE) {
    paintBase(ctx, type, 0x93989f, 16);
    return canvas;
  }

  if (type === BLOCKS.DIRT) {
    paintBase(ctx, type, 0x8b5f36, 20);
    return canvas;
  }

  if (type === BLOCKS.WATER) {
    paintBase(ctx, type, 0x3b82f6, 10);
    ctx.fillStyle = "rgba(255,255,255,0.14)";
    for (let i = 0; i < 20; i += 1) {
      ctx.fillRect(Math.floor(Math.random() * 16), Math.floor(Math.random() * 16), 1, 1);
    }
    return canvas;
  }

  paintBase(ctx, type, BLOCK_COLORS[type] || 0xffffff, 18);
  return canvas;
}

function getFaceMaterial(type, face) {
  const cacheKey = `${type}:${face}`;
  if (materialCache.has(cacheKey)) return materialCache.get(cacheKey);
  const textureUrl = getTextureUrl(type, face);
  const fallbackTex = new THREE.CanvasTexture(createTextureCanvas(type, face));
  fallbackTex.colorSpace = THREE.SRGBColorSpace;
  fallbackTex.magFilter = THREE.LinearFilter;
  fallbackTex.minFilter = THREE.LinearMipmapLinearFilter;
  fallbackTex.generateMipmaps = true;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: fallbackTex,
    transparent: type === BLOCKS.LEAVES || type === BLOCKS.WATER,
    opacity: type === BLOCKS.WATER ? 0.62 : 1,
    depthWrite: type === BLOCKS.WATER ? false : true,
    alphaTest: type === BLOCKS.LEAVES ? 0.25 : 0,
    roughness: 1,
    metalness: 0,
  });
  if (textureUrl) {
    textureLoader.load(
      textureUrl,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.magFilter = THREE.LinearFilter;
        loaded.minFilter = THREE.LinearMipmapLinearFilter;
        loaded.generateMipmaps = true;
        material.map = loaded;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        // Keep fallback texture when remote loading fails.
      }
    );
  }
  materialCache.set(cacheKey, material);
  return material;
}

function getBlockMaterial(type) {
  if (type === BLOCKS.GRASS || type === BLOCKS.WOOD || type === BLOCKS.CHEST) {
    const side = getFaceMaterial(type, "side");
    const top = getFaceMaterial(type, "top");
    const bottom = getFaceMaterial(type, "bottom");
    return [side, side, top, bottom, side, side];
  }
  return getFaceMaterial(type, "side");
}

function rebuildInstanced(type) {
  if (USE_CHUNK_RENDERER) return;
  const existing = meshes.get(type);
  if (existing) blockGroup.remove(existing.mesh);

  const blocksRaw = Array.from(state.blocksByType.get(type) || []);

  // Render optimization: skip blocks that are completely surrounded by other solid blocks.
  // This is a simple "hidden block culling" that reduces instance count immediately.
  const isOpaque = (t) => t !== BLOCKS.AIR && t !== BLOCKS.LEAVES && t !== BLOCKS.WATER;
  const blockTypeAt = (x, y, z) => state.blocks.get(keyFor(x, y, z)) ?? BLOCKS.AIR;
  const isOpaqueAt = (x, y, z) => isOpaque(blockTypeAt(x, y, z));
  const blocks = blocksRaw.filter((packedKey) => {
    if (!isOpaque(type)) return true;
    const x = keyToX(packedKey);
    const y = keyToY(packedKey);
    const z = keyToZ(packedKey);
    // If any neighbor is missing, at least one face is visible.
    return !(
      isOpaqueAt(x + 1, y, z) &&
      isOpaqueAt(x - 1, y, z) &&
      isOpaqueAt(x, y + 1, z) &&
      isOpaqueAt(x, y - 1, z) &&
      isOpaqueAt(x, y, z + 1) &&
      isOpaqueAt(x, y, z - 1)
    );
  });

  const material = getBlockMaterial(type);
  const instanced = new THREE.InstancedMesh(geometry, material, blocks.length || 1);
  instanced.count = blocks.length;
  instanced.userData.type = type;
  const matrix = new THREE.Matrix4();
  blocks.forEach((packedKey, i) => {
    matrix.makeTranslation(keyToX(packedKey), keyToY(packedKey), keyToZ(packedKey));
    instanced.setMatrixAt(i, matrix);
  });
  instanced.instanceMatrix.needsUpdate = true;

  blockGroup.add(instanced);
  meshes.set(type, { mesh: instanced, blocks });
}

function rebuildAll() {
  if (USE_CHUNK_RENDERER) return;
  getBlockOrder().forEach(rebuildInstanced);
}

function normalizeInventory(invObj) {
  if (Array.isArray(invObj)) {
    return invObj.map((item) => (item ? { t: item.t, c: item.c } : null));
  }
  if (invObj && typeof invObj === "object") {
    const slots = Array.from({ length: 36 }, () => null);
    let i = 0;
    Object.entries(invObj).forEach(([k, v]) => {
      if (i >= 36) return;
      slots[i] = { t: Number(k), c: v };
      i += 1;
    });
    return slots;
  }
  return Array.from({ length: 36 }, () => null);
}

function setInventory(invObj) {
  state.slots = normalizeInventory(invObj);
  updateInventoryUI();
}

function sendInventoryUpdate() {
  socketSend({
    type: "inv_update",
    playerId: state.playerId,
    slots: state.slots,
  });
}

function countItem(type) {
  return state.slots.reduce((sum, item) => {
    if (item && item.t === type) return sum + item.c;
    return sum;
  }, 0);
}

function addToCraft(type) {
  const index = state.craftSlots.findIndex((s) => s === null);
  if (index === -1) return;
  if (state.mode === 0) {
    const count = countItem(type);
    if (count <= 0) return;
  }
  state.craftSlots[index] = type;
  renderCraft();
}

function clearCraft() {
  state.craftSlots = [null, null, null, null];
  renderCraft();
}

function renderCraft() {
  Array.from(craftGrid.children).forEach((slot, i) => {
    const type = state.craftSlots[i];
    slot.textContent = type ? BLOCK_NAMES[type] : "";
    slot.dataset.type = type || "";
  });
  const recipe = getRecipe(state.craftSlots);
  craftOutput.textContent = recipe ? `${BLOCK_NAMES[recipe.out]} x${recipe.count}` : "";
  craftOutput.dataset.type = recipe ? recipe.out : "";
}

function getRecipe(slots) {
  const filtered = slots.filter((s) => s !== null);
  if (filtered.length === 1 && filtered[0] === BLOCKS.WOOD) {
    return { out: BLOCKS.PLANK, count: 4 };
  }
  if (filtered.length === 3 && filtered.every((t) => t === BLOCKS.APPLE)) {
    return { out: BLOCKS.BREAD, count: 1 };
  }
  if (filtered.length === 2 && filtered.every((t) => t === BLOCKS.PLANK)) {
    return { out: BLOCKS.STICK, count: 4 };
  }
  if (filtered.length === 4 && filtered.every((t) => t === BLOCKS.COBBLE)) {
    return { out: BLOCKS.BRICK, count: 1 };
  }
  if (filtered.length === 4 && filtered.every((t) => t === BLOCKS.PLANK)) {
    return { out: BLOCKS.CHEST, count: 1 };
  }
  if (filtered.length === 2 && filtered.includes(BLOCKS.STICK) && filtered.includes(BLOCKS.PLANK)) {
    return { out: BLOCKS.TORCH, count: 4 };
  }
  return null;
}

function addBlock(x, y, z, type) {
  setWorldBlock(x, y, z, type);
}

function removeBlock(x, y, z) {
  setWorldBlock(x, y, z, BLOCKS.AIR);
}

function updateBlock(block) {
  const old = setWorldBlock(block.x, block.y, block.z, block.t);
  if (!USE_CHUNK_RENDERER) {
    if (old !== BLOCKS.AIR) rebuildInstanced(old);
    if (block.t !== BLOCKS.AIR) rebuildInstanced(block.t);
  }

  if (block.t === BLOCKS.WATER && block.by === state.playerId) {
    if (!localStorage.getItem("ach_water")) {
      localStorage.setItem("ach_water", "1");
      showToast("Achievement: First Water! (simple fluid spread enabled)");
    }
  }
}

function applyBlockBatch(blocks) {
  const changed = new Set();
  blocks.forEach((block) => {
    const old = setWorldBlock(block.x, block.y, block.z, block.t);
    if (old !== BLOCKS.AIR) changed.add(old);
    if (block.t !== BLOCKS.AIR) changed.add(block.t);
  });
  if (!USE_CHUNK_RENDERER) changed.forEach((type) => rebuildInstanced(type));
}

function enqueueStreamBlocks(blocks) {
  if (!Array.isArray(blocks) || !blocks.length) return;
  state.streamQueue.push(...blocks);
}

function processStreamQueue() {
  if (state.streamQueueIndex >= state.streamQueue.length) {
    state.streamQueue = [];
    state.streamQueueIndex = 0;
    return;
  }

  const visible = normalizeVisibleChunks(state.worldSize?.visibleChunks || 3);
  const queueRemain = state.streamQueue.length - state.streamQueueIndex;
  const turbo = Math.min(1800, Math.max(0, queueRemain * 0.22));
  const budget = PERFORMANCE_PROFILE.streamBudget + Math.max(0, (visible - 3) * 220) + turbo;
  let processed = 0;
  while (processed < budget && state.streamQueueIndex < state.streamQueue.length) {
    const block = state.streamQueue[state.streamQueueIndex];
    state.streamQueueIndex += 1;
    processed += 1;

    const old = setWorldBlock(block.x, block.y, block.z, block.t);
    if (old !== BLOCKS.AIR) state.streamDirtyTypes.add(old);
    if (block.t !== BLOCKS.AIR) state.streamDirtyTypes.add(block.t);
  }

  const now = performance.now();
  const queueDone = state.streamQueueIndex >= state.streamQueue.length;
  if (queueDone || now - state.streamLastFlush > PERFORMANCE_PROFILE.streamFlushMs) {
    const dirty = Array.from(state.streamDirtyTypes);
    const limit = queueDone ? dirty.length : PERFORMANCE_PROFILE.streamRebuildPerFlush;
    if (!USE_CHUNK_RENDERER) {
      for (let i = 0; i < limit; i += 1) {
        const type = dirty[i];
        rebuildInstanced(type);
        state.streamDirtyTypes.delete(type);
      }
    } else {
      // Keep the set from growing forever; meshing is driven by chunk queue instead.
      state.streamDirtyTypes.clear();
    }
    state.streamLastFlush = now;
  }

  if (queueDone) {
    state.streamQueue = [];
    state.streamQueueIndex = 0;
  }
}

function unloadChunks(chunks) {
  if (!Array.isArray(chunks) || !chunks.length) return;
  const unloadKeys = new Set();
  chunks.forEach((c) => {
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.z)) return;
    const k = chunkKey(c.x, c.z);
    unloadKeys.add(k);
    state.loadedChunks.delete(k);
  });
  if (!unloadKeys.size) return;

  // Remove NPCs that are now out of loaded area.
  state.npcs.forEach((npc, id) => {
    const ck = chunkKeyForBlock(Math.floor(npc.mesh.position.x), Math.floor(npc.mesh.position.z));
    if (unloadKeys.has(ck)) {
      npcGroup.remove(npc.mesh);
      if (npc.tag) npcGroup.remove(npc.tag);
      npcIdentity.delete(id);
      state.npcs.delete(id);
    }
  });

  const changed = new Set();
  Array.from(state.blocks.entries()).forEach(([k, type]) => {
    const x = keyToX(k);
    const y = keyToY(k);
    const z = keyToZ(k);
    if (unloadKeys.has(chunkKeyForBlock(x, z))) {
      setWorldBlock(x, y, z, BLOCKS.AIR);
      changed.add(type);
    }
  });
  if (state.streamQueue.length) {
    state.streamQueue = state.streamQueue.filter((b) => !unloadKeys.has(chunkKeyForBlock(b.x, b.z)));
    state.streamQueueIndex = 0;
  }
  if (!USE_CHUNK_RENDERER) changed.forEach((type) => rebuildInstanced(type));

  // Free chunk meshes + voxel buffers for unloaded chunks.
  unloadKeys.forEach((k) => {
    dirtyChunkKeys.delete(k);
    const rec = chunkStore.get(k);
    if (rec) {
      if (rec.meshOpaque) chunkMeshGroup.remove(rec.meshOpaque);
      if (rec.meshWater) chunkMeshGroup.remove(rec.meshWater);
      chunkStore.delete(k);
    }
  });
}

function setChest(chest) {
  state.chest = chest;
  if (!chestPanel || !chestGrid) return;
  if (chest) {
    chestPanel.classList.remove("hidden");
    renderChest();
  } else {
    chestPanel.classList.add("hidden");
    chestGrid.innerHTML = "";
  }
}

function renderChest() {
  if (!state.chest || !chestGrid) return;
  chestGrid.innerHTML = "";
  const total = 27;
  for (let i = 0; i < total; i += 1) {
    const slot = document.createElement("div");
    slot.className = "inv-item";
    slot.dataset.index = i;
    const entry = state.chest.items[i];
    if (entry) {
      const chip = document.createElement("div");
      chip.className = "chip";
      applyChipTexture(chip, entry.t);
      const label = document.createElement("div");
      label.textContent = BLOCK_NAMES[entry.t];
      slot.appendChild(chip);
      slot.appendChild(label);
      const badge = document.createElement("div");
      badge.className = "count";
      badge.textContent = entry.c;
      slot.appendChild(badge);
    }
    chestGrid.appendChild(slot);
  }
}

function spawnDrop(drop) {
  if (state.drops.has(drop.id)) return;
  const dropTexture = loadRemoteTexture(getTextureUrl(drop.t, "side"));
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: dropTexture || null,
    roughness: 1,
    metalness: 0,
  });
  const geo = new THREE.BoxGeometry(0.4, 0.4, 0.4);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(drop.x + 0.5, drop.y + 0.5, drop.z + 0.5);
  mesh.userData.id = drop.id;
  dropGroup.add(mesh);
  state.drops.set(drop.id, { ...drop, mesh });
}

function removeDrop(id) {
  const d = state.drops.get(id);
  if (d) {
    dropGroup.remove(d.mesh);
    state.drops.delete(id);
  }
}

function addPlayer(player) {
  if (player.id === state.playerId) return;
  const texture = getSafeTexture(STEVE_TEXTURE_URL, createSteveFallbackTexture());
  const model = createBlockyHumanModel(texture);
  model.position.set(player.pos.x, player.pos.y, player.pos.z);
  model.userData.id = player.id;
  playerGroup.add(model);
  state.players.set(player.id, { ...player, mesh: model });
}

function removePlayer(id) {
  const p = state.players.get(id);
  if (p) {
    playerGroup.remove(p.mesh);
    state.players.delete(id);
  }
}

function updatePlayer(player) {
  if (player.id === state.playerId) return;
  const p = state.players.get(player.id);
  if (p) {
    p.mesh.position.set(player.pos.x, player.pos.y, player.pos.z);
  } else {
    addPlayer(player);
  }
}

function getNpcMaterial(kind) {
  if (npcMaterialCache.has(kind)) return npcMaterialCache.get(kind);
  const fallback = createNpcFallbackTexture(kind);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: fallback,
    transparent: true,
    alphaTest: 0.05,
    side: THREE.DoubleSide,
    roughness: 1,
    metalness: 0,
  });
  const remoteUrl = NPC_TEXTURE_URLS[kind] || NPC_TEXTURE_URLS.cow;
  if (remoteUrl) {
    textureLoader.load(
      remoteUrl,
      (loaded) => {
        loaded.colorSpace = THREE.SRGBColorSpace;
        loaded.magFilter = THREE.NearestFilter;
        loaded.minFilter = THREE.NearestFilter;
        loaded.generateMipmaps = false;
        material.map = loaded;
        material.needsUpdate = true;
      },
      undefined,
      () => {
        // Keep fallback texture when remote loading fails.
      }
    );
  }
  npcMaterialCache.set(kind, material);
  return material;
}

function addNpc(npc) {
  const role = NPC_ROLE_BY_KIND[npc.kind] || "Nomad";
  const npcName = pickNpcName(npc.id + npc.kind);
  const texture = getNpcTexture(npc.kind);
  const model = createBlockyAnimalModel(npc.kind, texture);
  model.position.set(npc.x, npc.y, npc.z);
  model.userData.id = npc.id;
  npcGroup.add(model);

  let tag = null;
  if (!isAnimal) {
    tag = makeLabelSprite(`${npcName} - ${role}`, role === "Trader" ? "#b0ff9f" : "#fff5d8");
    tag.position.set(npc.x, npc.y + 1.35, npc.z);
    npcGroup.add(tag);
  }

  state.npcs.set(npc.id, {
    id: npc.id,
    kind: npc.kind,
    name: npcName,
    role,
    mesh: model,
    tag,
    targetX: npc.x,
    targetY: npc.y,
    targetZ: npc.z,
    yaw: npc.yaw || 0,
  });
  npcIdentity.set(npc.id, { name: npcName, role });
}

function npcChunkKey(npc) {
  return chunkKeyForBlock(Math.floor(npc.x), Math.floor(npc.z));
}

function isNpcChunkLoaded(npc) {
  if (!npc) return false;
  return state.loadedChunks.has(npcChunkKey(npc));
}

function flushPendingNpcs() {
  if (!pendingNpcs.size) return;
  if (!lastNpcSnapshot) return;
  let changed = false;
  pendingNpcs.forEach((npc, id) => {
    if (isNpcChunkLoaded(npc)) {
      pendingNpcs.delete(id);
      changed = true;
    }
  });
  if (changed) syncNpcs(lastNpcSnapshot);
}

function syncNpcs(npcs) {
  if (!Array.isArray(npcs)) return;
  lastNpcSnapshot = npcs;
  const incoming = new Set();
  npcs.forEach((npc) => {
    if (!npc?.id) return;
    incoming.add(npc.id);
    if (!isNpcChunkLoaded(npc)) {
      pendingNpcs.set(npc.id, npc);
      return;
    }
    const local = state.npcs.get(npc.id);
    if (!local) {
      addNpc(npc);
      return;
    }
    local.targetX = npc.x;
    local.targetY = npc.y;
    local.targetZ = npc.z;
    local.yaw = npc.yaw || local.yaw;
    if (local.kind !== npc.kind) {
      local.kind = npc.kind;
      const tex = getNpcTexture(npc.kind);
      const newModel = createBlockyAnimalModel(npc.kind, tex);
      newModel.position.copy(local.mesh.position);
      newModel.userData.id = npc.id;
      npcGroup.remove(local.mesh);
      npcGroup.add(newModel);
      local.mesh = newModel;
      local.role = NPC_ROLE_BY_KIND[npc.kind] || local.role;
    }
  });
  state.npcs.forEach((npc, id) => {
    if (!incoming.has(id)) {
      npcGroup.remove(npc.mesh);
      if (npc.tag) npcGroup.remove(npc.tag);
      npcIdentity.delete(id);
      state.npcs.delete(id);
    }
  });
}

function clearNpcs() {
  state.npcs.forEach((npc) => {
    npcGroup.remove(npc.mesh);
    if (npc.tag) npcGroup.remove(npc.tag);
  });
  npcIdentity.clear();
  state.npcs.clear();
  pendingNpcs.clear();
  lastNpcSnapshot = null;
}

function updateNpcs(dt) {
  state.npcs.forEach((npc) => {
    const alpha = Math.min(1, dt * 8);
    npc.mesh.position.x += (npc.targetX - npc.mesh.position.x) * alpha;
    npc.mesh.position.y += (npc.targetY - npc.mesh.position.y) * alpha;
    npc.mesh.position.z += (npc.targetZ - npc.mesh.position.z) * alpha;
    const lx = npc.mesh.position.x + Math.sin(npc.yaw || 0);
    const lz = npc.mesh.position.z + Math.cos(npc.yaw || 0);
    npc.mesh.lookAt(lx, npc.mesh.position.y, lz);
    if (npc.tag) {
      npc.tag.position.set(npc.mesh.position.x, npc.mesh.position.y + 1.05, npc.mesh.position.z);
      npc.tag.lookAt(camera.position);
    }
  });
}

function findClosestNpc(maxDistance = 3.2) {
  let best = null;
  let bestDistSq = maxDistance * maxDistance;
  state.npcs.forEach((npc) => {
    const dx = npc.mesh.position.x - camera.position.x;
    const dy = npc.mesh.position.y - camera.position.y;
    const dz = npc.mesh.position.z - camera.position.z;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestDistSq) {
      best = npc;
      bestDistSq = d2;
    }
  });
  return best;
}

function interactWithNpc() {
  const npc = findClosestNpc(3.5);
  if (!npc) {
    pushChat("SYSTEM", "No NPC nearby (come closer and press G)");
    return;
  }
  playerProgress.talks += 1;

  if (npc.role === "Trader") {
    if (playerProgress.reputation >= 6) {
      pushChat(`${npc.name}`, "You are trusted. I opened rare routes in this region.");
    } else {
      pushChat(`${npc.name}`, "Help this land: defeat night spirits and talk with villagers.");
    }
  } else if (npc.role === "Guardian") {
    pushChat(`${npc.name}`, `Keep watch. Spirits defeated: ${playerProgress.spiritKills}`);
  } else if (npc.role === "Villager") {
    pushChat(`${npc.name}`, "Our village grows. Visit the dungeon under the well.");
  } else if (npc.role === "Undead" || npc.role === "Archer") {
    pushChat(`${npc.name}`, "...");
  } else {
    pushChat(`${npc.name}`, `Greetings, traveler. Reputation: ${playerProgress.reputation}`);
  }

  playerProgress.reputation = Math.min(99, playerProgress.reputation + 1);
}

function updateNpcHud() {
  if (!npcInfo) return;
  const nearby = findClosestNpc(4.2);
  if (nearby) {
    npcInfo.textContent = `NPC: ${nearby.name} (${nearby.role}) | G = talk | REP ${playerProgress.reputation}`;
  } else {
    npcInfo.textContent = `NPC Content: talks ${playerProgress.talks} | spirits ${playerProgress.spiritKills} | REP ${playerProgress.reputation}`;
  }
  if (worldInfo) {
    const explored = survivalStats.exploredChunks.size;
    const weather = weatherState.intensity > 0.45 ? "Rain" : "Clear";
    worldInfo.textContent = `Chunks explored: ${explored} | Weather: ${weather} | Season: ${seasonState.name}`;
  }
}

function updateDashboardGoals() {
  if (!dashboardGoals) return;
  const explored = survivalStats.exploredChunks.size;
  const rep = playerProgress.reputation;
  const talks = playerProgress.talks;
  const spirits = playerProgress.spiritKills;
  const score = Math.min(100, Math.round(rep * 0.35 + talks * 2 + spirits * 3 + explored * 0.2));
  const loaded = state.loadedChunks?.size || 0;
  const qRemain = Math.max(0, (state.streamQueue?.length || 0) - (state.streamQueueIndex || 0));
  const gfx = graphicsMode || "auto";
  dashboardGoals.textContent =
    `Global Goals: REP ${rep} | Talks ${talks} | Spirits ${spirits} | Scout ${explored} | Progress ${score}%\n` +
    `Perf: loadedChunks ${loaded} | streamQueue ${qRemain} | gfx ${gfx} | new pages: P Tools, L Map, O Schem`;
}
function pushChat(name, text) {
  const msg = document.createElement("div");
  msg.className = "msg";
  const nameEl = document.createElement("span");
  nameEl.className = "name";
  nameEl.textContent = name;
  const textEl = document.createElement("span");
  textEl.textContent = text;
  msg.appendChild(nameEl);
  msg.appendChild(textEl);
  chatLog.appendChild(msg);
  chatLog.scrollTop = chatLog.scrollHeight;
}

const raycaster = new THREE.Raycaster();
raycaster.far = PERFORMANCE_PROFILE.raycastFar;
const mouse = new THREE.Vector2();

function getIntersect() {
  raycaster.setFromCamera(mouse, camera);
  if (USE_CHUNK_RENDERER) {
    // Voxel DDA raycast against packed chunk voxels.
    const origin = raycaster.ray.origin;
    const dir = raycaster.ray.direction;
    const maxDist = raycaster.far;

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dir.x > 0 ? 1 : -1;
    const stepY = dir.y > 0 ? 1 : -1;
    const stepZ = dir.z > 0 ? 1 : -1;

    const tDeltaX = dir.x === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dir.x);
    const tDeltaY = dir.y === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dir.y);
    const tDeltaZ = dir.z === 0 ? Number.POSITIVE_INFINITY : Math.abs(1 / dir.z);

    const nextBoundary = (p, step) => (step > 0 ? Math.floor(p) + 1 : Math.floor(p));
    let tMaxX = dir.x === 0 ? Number.POSITIVE_INFINITY : (nextBoundary(origin.x, stepX) - origin.x) / dir.x;
    let tMaxY = dir.y === 0 ? Number.POSITIVE_INFINITY : (nextBoundary(origin.y, stepY) - origin.y) / dir.y;
    let tMaxZ = dir.z === 0 ? Number.POSITIVE_INFINITY : (nextBoundary(origin.z, stepZ) - origin.z) / dir.z;
    if (tMaxX < 0) tMaxX = 0;
    if (tMaxY < 0) tMaxY = 0;
    if (tMaxZ < 0) tMaxZ = 0;

    let t = 0;
    let normal = new THREE.Vector3(0, 0, 0);
    for (let iter = 0; iter < 4096 && t <= maxDist; iter += 1) {
      const bt = getBlockTypeAt(x, y, z);
      if (bt !== BLOCKS.AIR) {
        return { x, y, z, t: bt, normal };
      }

      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        t = tMaxX;
        tMaxX += tDeltaX;
        normal = new THREE.Vector3(-stepX, 0, 0);
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        t = tMaxY;
        tMaxY += tDeltaY;
        normal = new THREE.Vector3(0, -stepY, 0);
      } else {
        z += stepZ;
        t = tMaxZ;
        tMaxZ += tDeltaZ;
        normal = new THREE.Vector3(0, 0, -stepZ);
      }
    }

    return null;
  }

  // Legacy instanced raycast (fallback).
  const hits = raycaster.intersectObjects(blockGroup.children, false);
  if (!hits.length) return null;
  const hit = hits[0];
  const type = hit.object.userData.type;
  const list = meshes.get(type)?.blocks || [];
  const packedKey = list[hit.instanceId];
  if (packedKey === undefined) return null;
  return { x: keyToX(packedKey), y: keyToY(packedKey), z: keyToZ(packedKey), t: type, normal: hit.face?.normal };
}

function getBreakTime(type) {
  switch (type) {
    case BLOCKS.BEDROCK:
      return Number.POSITIVE_INFINITY;
    case BLOCKS.STONE:
    case BLOCKS.COBBLE:
    case BLOCKS.COAL_ORE:
    case BLOCKS.IRON_ORE:
    case BLOCKS.GOLD_ORE:
    case BLOCKS.DIAMOND_ORE:
      return 900;
    case BLOCKS.WOOD:
    case BLOCKS.PLANK:
      return 700;
    case BLOCKS.DIRT:
    case BLOCKS.GRASS:
    case BLOCKS.SAND:
      return 450;
    case BLOCKS.LEAVES:
      return 200;
    default:
      return 500;
  }
}

let pointerLocked = false;
canvas.addEventListener("click", () => {
  if (!pointerLocked) canvas.requestPointerLock();
});

document.addEventListener("pointerlockchange", () => {
  pointerLocked = document.pointerLockElement === canvas;
});

const move = { forward: 0, right: 0, up: 0 };
let yaw = 0;
let pitch = 0;
const player = { velocityY: 0, onGround: false };
const keysDown = new Set();
const breakState = { active: false, key: null, start: 0 };
let lastBreakRaycastAt = 0;
let cachedBreakHit = null;
let audioCtx = null;

function playBreakSound() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = "square";
  osc.frequency.value = 180;
  gain.gain.value = 0.05;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + 0.06);
}

document.addEventListener("mousemove", (e) => {
  if (!pointerLocked) return;
  yaw -= e.movementX * 0.002;
  pitch -= e.movementY * 0.002;
  pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, pitch));
});

document.addEventListener("mousemove", (e) => {
  if (!cursorItem || cursorItem.classList.contains("hidden")) return;
  cursorItem.style.left = `${e.clientX + 6}px`;
  cursorItem.style.top = `${e.clientY + 6}px`;
});

document.addEventListener("keydown", (e) => {
  keysDown.add(e.code);
  if (document.activeElement === chatInput) return;
  if (e.code === "KeyE") {
    inventory.classList.toggle("hidden");
    if (!inventory.classList.contains("hidden")) {
      document.exitPointerLock();
    } else {
      setChest(null);
      if (cursor.item) {
        const empty = state.slots.findIndex((s) => s === null);
        if (empty !== -1) {
          setSlot(empty, cursor.item);
          cursor.item = null;
          sendInventoryUpdate();
          updateInventoryUI();
        }
      }
      if (cursorItem) cursorItem.classList.add("hidden");
    }
  }
  if (e.code === "KeyW" || e.code === "ArrowUp") move.forward = 1;
  if (e.code === "KeyS" || e.code === "ArrowDown") move.forward = -1;
  if (e.code === "KeyA" || e.code === "ArrowLeft") move.right = -1;
  if (e.code === "KeyD" || e.code === "ArrowRight") move.right = 1;
  if (e.code === "Space") move.up = 1;
  if (e.code === "ShiftLeft" || e.code === "ShiftRight") move.up = -1;
  if (e.code === "KeyT") {
    chatInput.focus();
  }
  if (e.code === "KeyG") {
    interactWithNpc();
  }
  if (e.code === "KeyF") {
    if (!lantern.enabled && lantern.charge <= 1) {
      pushChat("SYSTEM", "Lantern is recharging...");
    } else {
      lantern.enabled = !lantern.enabled;
      pushChat("SYSTEM", `Lantern ${lantern.enabled ? "ON" : "OFF"}`);
    }
  }
  if (e.code === "KeyM") {
    addMarkerAtPlayer();
  }
  if (e.code === "KeyN") {
    selectNextMarker();
  }
  if (e.code === "KeyH") {
    togglePhotoMode();
  }
  if (e.code === "KeyP") {
    openPage("/tools/");
  }
  if (e.code === "KeyL") {
    openPage("/live-map/");
  }
  if (e.code === "KeyO") {
    openPage("/schem-editor/");
  }
  if (e.code === "KeyK") {
    setHomePoint();
  }
  if (e.code === "KeyJ") {
    returnToHomePoint();
  }
  if (e.code === "Backspace") {
    e.preventDefault();
    removeSelectedMarker();
  }
  if (e.code.startsWith("Digit")) {
    const slot = Number(e.code.replace("Digit", "")) - 1;
    if (slot >= 0 && slot < 9) selectSlot(slot);
  }
});

document.addEventListener("keyup", (e) => {
  keysDown.delete(e.code);
  if (e.code === "KeyW" || e.code === "KeyS" || e.code === "ArrowUp" || e.code === "ArrowDown") {
    move.forward = 0;
  }
  if (e.code === "KeyA" || e.code === "KeyD" || e.code === "ArrowLeft" || e.code === "ArrowRight") {
    move.right = 0;
  }
  if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") move.up = 0;
});

chatInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (text) {
      if (text.startsWith("/time")) {
        const parts = text.split(/\s+/);
        const arg = (parts[1] || "").toLowerCase();
        if (arg.endsWith("x")) {
          const speed = Number(arg.replace("x", ""));
          if (Number.isFinite(speed) && speed > 0 && speed <= 20) {
            dayNight.speedMultiplier = speed;
            pushChat("SYSTEM", `Time speed set to x${speed}`);
          } else {
            pushChat("SYSTEM", "Usage: /time 0.5x .. 20x");
          }
        } else if (arg === "day") {
          dayNight.progress = 0;
          pushChat("SYSTEM", "Time set to day");
        } else if (arg === "night") {
          dayNight.progress = 0.5;
          pushChat("SYSTEM", "Time set to night");
        } else if (arg === "noon") {
          dayNight.progress = 0.25;
          pushChat("SYSTEM", "Time set to noon");
        } else if (arg === "midnight") {
          dayNight.progress = 0.75;
          pushChat("SYSTEM", "Time set to midnight");
        } else if (arg === "reset") {
          dayNight.speedMultiplier = 1;
          pushChat("SYSTEM", "Time speed reset to x1");
        } else {
          pushChat("SYSTEM", "Commands: /time day|night|noon|midnight|reset|4x");
        }
      } else if (text.startsWith("/mod") || text.startsWith("/mode")) {
        socketSend({ type: "command", text, playerId: state.playerId });
      } else if (text.startsWith("/gfx")) {
        const parts = text.split(/\s+/);
        const arg = (parts[1] || "").toLowerCase();
        if (arg === "procedural" || arg === "local") {
          graphicsMode = "procedural";
          localStorage.setItem("gfxMode", graphicsMode);
          pushChat("SYSTEM", "Graphics mode: procedural (local textures only). Reload recommended.");
        } else if (arg === "auto" || arg === "normal") {
          graphicsMode = "auto";
          localStorage.setItem("gfxMode", graphicsMode);
          pushChat("SYSTEM", "Graphics mode: auto (remote textures). Reload recommended.");
        } else {
          pushChat("SYSTEM", "Usage: /gfx procedural | /gfx auto");
        }
      } else if (text.startsWith("/eat")) {
        survivalStats.hunger = 100;
        pushChat("SYSTEM", "Вы поели. Голод восстановлен.");
      } else if (text.startsWith("/heal")) {
        survivalStats.health = 100;
        pushChat("SYSTEM", "Вы полностью восстановились.");
      } else {
        socketSend({ type: "chat", text, playerId: state.playerId });
      }
      chatInput.value = "";
    }
    chatInput.blur();
    setTimeout(() => {
      if (!pointerLocked) {
        canvas.requestPointerLock();
      }
    }, 120);
  }
});

craftGrid.addEventListener("click", (e) => {
  const slot = e.target.closest(".craft-slot");
  if (!slot) return;
  const index = Number(slot.dataset.slot);
  if (!Number.isFinite(index)) return;
  state.craftSlots[index] = null;
  renderCraft();
});

craftOutput.addEventListener("click", () => {
  const recipe = getRecipe(state.craftSlots);
  if (!recipe) return;
  socketSend({
    type: "craft",
    playerId: state.playerId,
    slots: state.craftSlots,
    out: recipe.out,
  });
});

if (chestGrid) {
  chestGrid.addEventListener("click", (e) => {
    const slot = e.target.closest(".inv-item");
    if (!slot || !state.chest) return;
    const index = Number(slot.dataset.index);
    if (!Number.isFinite(index)) return;
    socketSend({
      type: "chest_take",
      playerId: state.playerId,
      chestId: state.chest.id,
      index,
    });
  });
}

if (inventoryGrid) {
  inventoryGrid.addEventListener("contextmenu", (e) => {
    if (!state.chest) return;
    e.preventDefault();
    const itemEl = e.target.closest(".inv-item");
    if (!itemEl) return;
    const index = Number(itemEl.dataset.index);
    if (!Number.isFinite(index)) return;
    const item = getSlot(index);
    if (!item) return;
    socketSend({
      type: "chest_put",
      playerId: state.playerId,
      chestId: state.chest.id,
      blockType: item.t,
      count: 1,
    });
  });
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());

canvas.addEventListener("mousedown", (e) => {
  if (!pointerLocked) return;
  const hit = getIntersect();
  if (!hit) {
    if (e.button === 0 && nightMobs.size > 0) {
      let targetId = null;
      let best = 2.6 * 2.6;
      nightMobs.forEach((mob, id) => {
        const dx = mob.mesh.position.x - camera.position.x;
        const dy = mob.mesh.position.y - camera.position.y;
        const dz = mob.mesh.position.z - camera.position.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < best) {
          best = d2;
          targetId = id;
        }
      });
      if (targetId) {
        const mob = nightMobs.get(targetId);
        nightMobGroup.remove(mob.mesh);
        nightMobs.delete(targetId);
        playerProgress.spiritKills += 1;
        playerProgress.reputation = Math.min(99, playerProgress.reputation + 2);
        pushChat("SYSTEM", `Spirit defeated! REP +2 (total ${playerProgress.reputation})`);
        playBreakSound();
      }
    }
    return;
  }
  const reach = 5;
  const dist = camera.position.distanceTo(new THREE.Vector3(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5));
  if (dist > reach) {
    statusEl.textContent = "Too far";
    setTimeout(() => {
      if (statusEl.textContent === "Too far") {
        statusEl.textContent = `Players: ${state.players.size + 1}`;
      }
    }, 800);
    return;
  }
  if (e.button === 0) {
    if (state.mode === 1) {
      socketSend({
        type: "block_update",
        block: { x: hit.x, y: hit.y, z: hit.z, t: BLOCKS.AIR },
        playerId: state.playerId,
      });
    } else {
      breakState.active = true;
      breakState.key = `${hit.x},${hit.y},${hit.z}`;
      breakState.start = performance.now();
      cachedBreakHit = hit;
      lastBreakRaycastAt = breakState.start;
    }
  }
  if (e.button === 2 && hit.normal) {
    if (hit.t === BLOCKS.CHEST) {
      socketSend({
        type: "chest_open",
        playerId: state.playerId,
        x: hit.x,
        y: hit.y,
        z: hit.z,
      });
      return;
    }
    const placeType = getSelectedType();
    if (!isPlaceable(placeType)) {
      if (consumeFood(placeType)) return;
      return;
    }
    const nx = hit.x + Math.round(hit.normal.x);
    const ny = hit.y + Math.round(hit.normal.y);
    const nz = hit.z + Math.round(hit.normal.z);
    socketSend({
      type: "block_update",
      block: { x: nx, y: ny, z: nz, t: placeType },
      playerId: state.playerId,
    });
  }
});

canvas.addEventListener("mouseup", () => {
  breakState.active = false;
  breakState.key = null;
  cachedBreakHit = null;
});

function updateCamera(dt) {
  let speed = 6;
  if (state.mode === 0) {
    const sprinting = move.forward !== 0 && keysDown.has("ControlLeft") && survivalStats.stamina > 5;
    if (sprinting) {
      speed *= 1.6;
    } else if (survivalStats.hunger < 25) {
      speed *= 0.75;
    }
  }
  const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  const right = new THREE.Vector3(-forward.z, 0, forward.x);
  const velocity = new THREE.Vector3();
  velocity.addScaledVector(forward, move.forward * speed * dt);
  velocity.addScaledVector(right, move.right * speed * dt);
  if (state.mode === 1) {
    velocity.y += move.up * speed * dt;
  } else {
    player.velocityY -= 16 * dt;
    if (move.up > 0 && player.onGround) {
      player.velocityY = 6;
    }
    velocity.y += player.velocityY * dt;
  }

  const next = camera.position.clone();
  if (state.mode === 0) {
    const playerHeight = PLAYER_HEIGHT_BLOCKS;
    const radius = 0.5;

    // X axis
    const tryX = next.clone().add(new THREE.Vector3(velocity.x, 0, 0));
    if (!collidesAt(tryX, radius, playerHeight)) {
      next.x = tryX.x;
    }

    // Z axis
    const tryZ = next.clone().add(new THREE.Vector3(0, 0, velocity.z));
    if (!collidesAt(tryZ, radius, playerHeight)) {
      next.z = tryZ.z;
    }

    // Y axis
    if (!isChunkLoadedAt(next.x, next.z)) {
      player.velocityY = 0;
      player.onGround = true;
    } else {
      const tryY = next.clone().add(new THREE.Vector3(0, velocity.y, 0));
      if (!collidesAt(tryY, radius, playerHeight)) {
        next.y = tryY.y;
        player.onGround = false;
      } else if (velocity.y < 0) {
        player.onGround = true;
        player.velocityY = 0;
      }
    }

    if (next.y < playerHeight + 1) {
      next.y = playerHeight + 1;
      player.velocityY = 0;
      player.onGround = true;
    }
  } else {
    next.add(velocity);
  }

  clampToWorldBorder(next);
  camera.position.copy(next);
  camera.rotation.set(pitch, yaw, 0, "YXZ");
}

let lastNet = 0;
let fpsEma = 60;
let lastQualityTune = 0;
let lastDropPickupScan = 0;
let animationStarted = false;
function tick() {
  const dt = clock.getDelta();
  if (dt > 0) {
    const instFps = 1 / dt;
    fpsEma = fpsEma * 0.92 + instFps * 0.08;
  }
  const now = performance.now();
  if (now - lastQualityTune > PERFORMANCE_PROFILE.qualityTuneMs) {
    if (fpsEma < PERFORMANCE_PROFILE.lowFpsThreshold && dynamicPixelRatio > MIN_PIXEL_RATIO) {
      dynamicPixelRatio = Math.max(MIN_PIXEL_RATIO, dynamicPixelRatio - 0.1);
      renderer.setPixelRatio(dynamicPixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    } else if (fpsEma > PERFORMANCE_PROFILE.highFpsThreshold && dynamicPixelRatio < MAX_PIXEL_RATIO) {
      dynamicPixelRatio = Math.min(MAX_PIXEL_RATIO, dynamicPixelRatio + 0.05);
      renderer.setPixelRatio(dynamicPixelRatio);
      renderer.setSize(window.innerWidth, window.innerHeight, false);
    }
    lastQualityTune = now;
  }

  updateCamera(dt);
  updateDayNight(dt);
  updateSeasons(dt);
  updateWeather(dt);
  updateSurvivalStats(dt);
  updateLantern(dt);
  updateCompass();
  updateNpcs(dt);
  updateNpcHud();
  updateDashboardGoals();
  updateNightMobs(dt);
  updateFireflies(dt);
  updateMarkers(dt);
  processStreamQueue();
  // Mesh a few chunks per frame; this makes the optimization visible immediately (faster load, fewer stutters).
  processChunkMeshQueue(fpsEma > 45 ? 3 : 1);
  renderer.render(scene, camera);

  if (breakState.active && state.mode === 0) {
    if (now - lastBreakRaycastAt > 45 || !cachedBreakHit) {
      cachedBreakHit = getIntersect();
      lastBreakRaycastAt = now;
    }
    const hit = cachedBreakHit;
    if (!hit) {
      breakState.active = false;
      cachedBreakHit = null;
    } else {
        const key = `${hit.x},${hit.y},${hit.z}`;
        if (key !== breakState.key) {
          breakState.active = false;
          cachedBreakHit = null;
        } else {
          const needed = getBreakTime(getBlockTypeAt(hit.x, hit.y, hit.z) || BLOCKS.STONE);
          if (!Number.isFinite(needed)) {
            breakState.active = false;
            cachedBreakHit = null;
            if (breakBar) breakBar.classList.add("hidden");
            return;
          }
          const progress = Math.min(1, (performance.now() - breakState.start) / needed);
        if (breakBar) {
          breakBar.classList.remove("hidden");
          breakBar.style.setProperty("--break-progress", `${Math.floor(progress * 100)}%`);
        }
        if (progress >= 1) {
          socketSend({
            type: "block_update",
            block: { x: hit.x, y: hit.y, z: hit.z, t: BLOCKS.AIR },
            playerId: state.playerId,
          });
          breakState.active = false;
          cachedBreakHit = null;
          if (breakBar) breakBar.classList.add("hidden");
          playBreakSound();
        }
      }
    }
  } else if (breakBar) {
    breakBar.classList.add("hidden");
  }

  if (state.drops.size > 0 && now - lastDropPickupScan > PERFORMANCE_PROFILE.dropPickupIntervalMs) {
    state.drops.forEach((drop) => {
      const dx = camera.position.x - drop.mesh.position.x;
      const dy = camera.position.y - drop.mesh.position.y;
      const dz = camera.position.z - drop.mesh.position.z;
      if ((dx * dx + dy * dy + dz * dz) < 2.25) {
        socketSend({ type: "pickup", playerId: state.playerId, dropId: drop.id });
      }
    });
    lastDropPickupScan = now;
  }

  if (state.playerId && now - lastNet > PERFORMANCE_PROFILE.netIntervalMs) {
    socketSend({
      type: "player_update",
      playerId: state.playerId,
      pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      rot: { x: pitch, y: yaw },
    });
    lastNet = now;
  }

  requestAnimationFrame(tick);
}

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

let socket;
function socketSend(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

window.addEventListener("error", (e) => {
  const msg = e?.message || "Client error";
  if (statusEl) statusEl.textContent = `Error: ${msg}`;
});

window.addEventListener("unhandledrejection", (e) => {
  const reason = e?.reason?.message || e?.reason || "Promise rejected";
  if (statusEl) statusEl.textContent = `Error: ${String(reason)}`;
});

function connect() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const host = window.location.host;
  const cid = encodeURIComponent(clientId);
  const candidates = [`${protocol}://${host}/ws/game/?clientId=${cid}`];

  let index = 0;
  let settled = false;
  let handshakeTimer = null;

  const tryNext = () => {
    if (index >= candidates.length) {
      statusEl.textContent = "WS failed: check server command";
      setTimeout(connect, 1200);
      return;
    }

    const url = candidates[index++];
    statusEl.textContent = `Connecting WS ${index}/${candidates.length}...`;

    try {
      socket = new WebSocket(url);
    } catch (err) {
      statusEl.textContent = `WS URL error: ${err?.message || err}`;
      setTimeout(tryNext, 200);
      return;
    }

    settled = false;
    if (handshakeTimer) clearTimeout(handshakeTimer);
    handshakeTimer = setTimeout(() => {
      if (!settled) {
        try {
          socket.close();
        } catch (_) {
          // Ignore close errors during fallback.
        }
      }
    }, 1100);

    socket.onopen = () => {
      settled = true;
      if (handshakeTimer) clearTimeout(handshakeTimer);
      statusEl.textContent = "Connected";
      socketSend({ type: "hello", clientId });
    };

    socket.onerror = () => {
      if (settled) return;
      statusEl.textContent = `WS error on ${url.replace(`${protocol}://`, "")}`;
    };

    socket.onclose = (event) => {
      if (handshakeTimer) clearTimeout(handshakeTimer);
      if (!settled) {
        setTimeout(tryNext, 80);
        return;
      }
      statusEl.textContent = `Disconnected (${event.code}) - retrying`;
      setTimeout(connect, 700);
    };

    socket.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (_) {
        return;
      }
      if (data.type === "init") {
        state.playerId = data.playerId;
        state.worldSize = { ...state.worldSize, ...(data.worldSize || {}) };
        // Make sure chunk packing dimensions match the server-provided world size.
        syncChunkDimsFromWorldSize();
        // New session: clear previous render artifacts.
        clearChunkMeshes();
        if (blockGroup && blockGroup.clear) blockGroup.clear();
        meshes.clear();
        state.blocks.clear();
        state.blocksByType.clear();
        state.loadedChunks.clear();
        state.streamQueue = [];
        state.streamQueueIndex = 0;
        state.streamDirtyTypes.clear();
        state.streamLastFlush = 0;
        state.drops.clear();
        dropGroup.clear();
        clearNpcs();
        markers.forEach((marker) => {
          markerGroup.remove(marker.base);
          markerGroup.remove(marker.beam);
        });
        markers.length = 0;
        selectedMarkerIndex = -1;
        nightMobs.forEach((mob) => nightMobGroup.remove(mob.mesh));
        nightMobs.clear();
        fireflies.forEach((f) => fireflyGroup.remove(f.sprite));
        fireflies.length = 0;
        applyBlockBatch(data.world || []);
        markChunksLoaded(data.chunks);
        // Kickstart a few chunk builds right away so the optimization is visible immediately.
        processChunkMeshQueue(8);
        updateChunkDistanceUI();
        applyViewDistanceVisuals();
        rebuildWorldBorderVisual();
        if (Number.isFinite(savedVisibleChunks)) {
          const want = normalizeVisibleChunks(savedVisibleChunks);
          if (want !== normalizeVisibleChunks(state.worldSize.visibleChunks)) {
            requestVisibleChunksUpdate(want);
          }
        }
        const selfPlayer = data.players.find((p) => p.id === state.playerId);
        state.mode = selfPlayer?.mode ?? 1;
        if (selfPlayer?.pos) {
          camera.position.set(selfPlayer.pos.x, selfPlayer.pos.y, selfPlayer.pos.z);
        }
        if (data.inventory) setInventory(data.inventory);
        if (data.drops) {
          data.drops.forEach(spawnDrop);
        }
        syncNpcs(data.npcs || []);
        data.players.forEach(addPlayer);
        statusEl.textContent = `Players: ${data.players.length}`;
        if (!animationStarted) {
          animationStarted = true;
          tick();
        }
      }

      if (data.type === "player_join") {
        addPlayer(data.player);
        statusEl.textContent = `Players: ${state.players.size + 1}`;
        pushChat("SYSTEM", `${data.player.name} joined`);
      }

      if (data.type === "player_leave") {
        removePlayer(data.playerId);
        statusEl.textContent = `Players: ${state.players.size + 1}`;
      }

      if (data.type === "player_update") {
        updatePlayer(data.player);
      }

      if (data.type === "block_update") {
        updateBlock(data.block);
      }

      if (data.type === "drop_spawn") {
        spawnDrop(data.drop);
      }

      if (data.type === "drop_remove") {
        removeDrop(data.dropId);
      }

      if (data.type === "npc_sync") {
        syncNpcs(data.npcs || []);
      }

      if (data.type === "chunk_data") {
        if (Array.isArray(data.blocks) && data.blocks.length) {
          enqueueStreamBlocks(data.blocks);
        }
        markChunksLoaded(data.chunks);
      }

      if (data.type === "chunk_unload") {
        unloadChunks(data.chunks);
      }

      if (data.type === "settings_applied") {
        if (Number.isFinite(data.visibleChunks)) state.worldSize.visibleChunks = normalizeVisibleChunks(data.visibleChunks);
        if (Number.isFinite(data.minVisibleChunks)) state.worldSize.minVisibleChunks = Number(data.minVisibleChunks);
        if (Number.isFinite(data.maxVisibleChunks)) state.worldSize.maxVisibleChunks = Number(data.maxVisibleChunks);
        if (Number.isFinite(data.borderMinX)) state.worldSize.borderMinX = Number(data.borderMinX);
        if (Number.isFinite(data.borderMaxX)) state.worldSize.borderMaxX = Number(data.borderMaxX);
        if (Number.isFinite(data.borderMinZ)) state.worldSize.borderMinZ = Number(data.borderMinZ);
        if (Number.isFinite(data.borderMaxZ)) state.worldSize.borderMaxZ = Number(data.borderMaxZ);
        updateChunkDistanceUI();
        applyViewDistanceVisuals();
        rebuildWorldBorderVisual();
      }

      if (data.type === "chat") {
        pushChat(data.name, data.text);
      }
      if (data.type === "server_event") {
        if (data.event === "time") {
          if (Number.isFinite(data.speedMultiplier)) dayNight.speedMultiplier = data.speedMultiplier;
          if (Number.isFinite(data.progress)) dayNight.progress = ((data.progress % 1) + 1) % 1;
          pushChat("SYSTEM", "Server time updated");
        }
      }

      if (data.type === "mode") {
        state.mode = data.mode;
        pushChat("SYSTEM", `Mode: ${data.mode === 1 ? "Creative" : "Survival"}`);
        updateInventoryUI();
        clearCraft();
      }

      if (data.type === "inventory") {
        setInventory(data.inventory);
        if (data.crafted) {
          clearCraft();
          pushChat("SYSTEM", `Crafted ${BLOCK_NAMES[data.crafted.out]} x${data.crafted.count}`);
          if (data.crafted.out === BLOCKS.TORCH && !localStorage.getItem("ach_torch")) {
            localStorage.setItem("ach_torch", "1");
            showToast("Achievement: Let There Be Light! (torch in hand gives light)");
          }
        }
      }

      if (data.type === "chest_data") {
        if (inventory) {
          inventory.classList.remove("hidden");
        }
        setChest(data.chest);
      }
    };
  };

  tryNext();
}

connect();

function isSolid(x, y, z) {
  const t = getBlockTypeAt(x, y, z);
  if (t === undefined || t === BLOCKS.AIR) return false;
  if (t === BLOCKS.WATER) return false;
  if (t === BLOCKS.TORCH_BLOCK) return false;
  return true;
}

function collidesAt(pos, radius, height) {
  const minX = Math.floor(pos.x - radius);
  const maxX = Math.floor(pos.x + radius);
  const minZ = Math.floor(pos.z - radius);
  const maxZ = Math.floor(pos.z + radius);
  const footY = pos.y - height;
  const worldMinY = state.worldSize?.minY ?? -100;
  const worldMaxY = state.worldSize?.maxY ?? 64;
  const minY = Math.max(worldMinY, Math.floor(footY));
  const maxY = Math.min(worldMaxY, Math.floor(footY + height));
  if (minY > maxY) return false;
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}





