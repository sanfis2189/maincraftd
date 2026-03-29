import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const canvas = document.getElementById("game");
const statusEl = document.getElementById("status");
const chatLog = document.getElementById("chat-log");
const chatInput = document.getElementById("chat-input");
const hotbar = document.getElementById("hotbar");
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
const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("settings-panel");
const chunkDistanceInput = document.getElementById("chunk-distance");
const chunkDistanceValue = document.getElementById("chunk-distance-value");

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
  STICK: 100,
  TORCH: 101,
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
  [BLOCKS.STICK]: 0x8b5a2b,
  [BLOCKS.TORCH]: 0xf2c94c,
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
  [BLOCKS.STICK]: "Stick",
  [BLOCKS.TORCH]: "Torch",
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
  chest: null,
  selectedSlot: 0,
};

const cursor = { item: null };

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
  maxPixelRatio: 0.82,
  minPixelRatio: 0.42,
  raycastFar: 4.8,
  netIntervalMs: 180,
  dropPickupIntervalMs: 260,
  qualityTuneMs: 900,
  lowFpsThreshold: 58,
  highFpsThreshold: 64,
  streamBudget: 520,
  streamFlushMs: 80,
  streamRebuildPerFlush: 1,
  cameraFar: 104,
  fogNear: 20,
  fogFar: 64,
};
const SKY_COLOR = 0x95b9e8;
scene.background = new THREE.Color(SKY_COLOR);
scene.fog = new THREE.Fog(SKY_COLOR, PERFORMANCE_PROFILE.fogNear, PERFORMANCE_PROFILE.fogFar);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, PERFORMANCE_PROFILE.cameraFar);
camera.position.set(8, 8, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
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

const playerGroup = new THREE.Group();
scene.add(playerGroup);

const blockGroup = new THREE.Group();
scene.add(blockGroup);
const dropGroup = new THREE.Group();
scene.add(dropGroup);
const borderGroup = new THREE.Group();
scene.add(borderGroup);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const meshes = new Map();
const materialCache = new Map();

const MAX_STACK = 64;

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
      chip.style.background = `#${BLOCK_COLORS[item.t].toString(16).padStart(6, "0")}`;
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
    chip.style.background = `#${BLOCK_COLORS[item.t].toString(16).padStart(6, "0")}`;
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
    chip.style.background = `#${BLOCK_COLORS[type].toString(16).padStart(6, "0")}`;
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
  chip.style.background = `#${BLOCK_COLORS[cursor.item.t].toString(16).padStart(6, "0")}`;
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
updateChunkDistanceUI();
applyViewDistanceVisuals();

if (settingsToggle && settingsPanel) {
  settingsToggle.addEventListener("click", () => {
    settingsPanel.classList.toggle("hidden");
  });
}
if (chunkDistanceInput) {
  chunkDistanceInput.addEventListener("input", (e) => {
    const value = Number(e.target.value);
    requestVisibleChunksUpdate(value);
  });
}

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

function rebuildWorldBorderVisual() {
  while (borderGroup.children.length) {
    borderGroup.remove(borderGroup.children[0]);
  }

  const minX = (state.worldSize?.borderMinX ?? 0) + 0.5;
  const maxX = (state.worldSize?.borderMaxX ?? state.worldSize.x - 1) + 0.5;
  const minZ = (state.worldSize?.borderMinZ ?? 0) + 0.5;
  const maxZ = (state.worldSize?.borderMaxZ ?? state.worldSize.z - 1) + 0.5;
  const minY = (state.worldSize?.minY ?? -100) + 0.5;
  const maxY = (state.worldSize?.maxY ?? 32) + 1.5;
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

function markChunksLoaded(chunks) {
  if (!Array.isArray(chunks)) return;
  chunks.forEach((c) => {
    if (!c || !Number.isFinite(c.x) || !Number.isFinite(c.z)) return;
    state.loadedChunks.add(chunkKey(c.x, c.z));
  });
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

  paintBase(ctx, type, BLOCK_COLORS[type] || 0xffffff, 18);
  return canvas;
}

function getFaceMaterial(type, face) {
  const cacheKey = `${type}:${face}`;
  if (materialCache.has(cacheKey)) return materialCache.get(cacheKey);
  const tex = new THREE.CanvasTexture(createTextureCanvas(type, face));
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex,
    roughness: 1,
    metalness: 0,
  });
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
  const existing = meshes.get(type);
  if (existing) blockGroup.remove(existing.mesh);

  const blocks = Array.from(state.blocksByType.get(type) || []);

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
  if (old !== BLOCKS.AIR) rebuildInstanced(old);
  if (block.t !== BLOCKS.AIR) rebuildInstanced(block.t);
}

function applyBlockBatch(blocks) {
  const changed = new Set();
  blocks.forEach((block) => {
    const old = setWorldBlock(block.x, block.y, block.z, block.t);
    if (old !== BLOCKS.AIR) changed.add(old);
    if (block.t !== BLOCKS.AIR) changed.add(block.t);
  });
  changed.forEach((type) => rebuildInstanced(type));
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
  const turbo = Math.min(2600, Math.max(0, queueRemain * 0.35));
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
    for (let i = 0; i < limit; i += 1) {
      const type = dirty[i];
      rebuildInstanced(type);
      state.streamDirtyTypes.delete(type);
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
  changed.forEach((type) => rebuildInstanced(type));
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
      chip.style.background = `#${BLOCK_COLORS[entry.t].toString(16).padStart(6, "0")}`;
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
  const mat = new THREE.MeshStandardMaterial({ color: BLOCK_COLORS[drop.t] || 0xffffff });
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
  const geometry = new THREE.BoxGeometry(0.6, 1.6, 0.6);
  const material = new THREE.MeshStandardMaterial({ color: 0x6ee7b7 });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(player.pos.x, player.pos.y, player.pos.z);
  mesh.userData.id = player.id;
  playerGroup.add(mesh);
  state.players.set(player.id, { ...player, mesh });
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
  if (e.code.startsWith("Digit")) {
    const slot = Number(e.code.replace("Digit", "")) - 1;
    if (slot >= 0 && slot < 9) selectSlot(slot);
  }
});

document.addEventListener("keyup", (e) => {
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
    const text = chatInput.value.trim();
    if (text) {
      if (text.startsWith("/mod") || text.startsWith("/mode")) {
        socketSend({ type: "command", text, playerId: state.playerId });
      } else {
        socketSend({ type: "chat", text, playerId: state.playerId });
      }
      chatInput.value = "";
      canvas.requestPointerLock();
    }
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
  if (!hit) return;
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
    if (!isPlaceable(placeType)) return;
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
  const speed = 6;
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
    const playerHeight = 1.7;
    const radius = 0.3;

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
    const tryY = next.clone().add(new THREE.Vector3(0, velocity.y, 0));
    if (!collidesAt(tryY, radius, playerHeight)) {
      next.y = tryY.y;
      player.onGround = false;
    } else if (velocity.y < 0) {
      player.onGround = true;
      player.velocityY = 0;
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
  processStreamQueue();
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
          const needed = getBreakTime(state.blocks.get(keyFor(hit.x, hit.y, hit.z)) || BLOCKS.STONE);
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

function connect() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${window.location.host}/ws/game/`);

  socket.onopen = () => {
    statusEl.textContent = "Connected";
    socketSend({ type: "hello", clientId });
  };

  socket.onclose = () => {
    statusEl.textContent = "Disconnected - retrying";
    setTimeout(connect, 1000);
  };

  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "init") {
      state.playerId = data.playerId;
      state.worldSize = { ...state.worldSize, ...(data.worldSize || {}) };
      state.blocks.clear();
      state.blocksByType.clear();
      state.loadedChunks.clear();
      state.streamQueue = [];
      state.streamQueueIndex = 0;
      state.streamDirtyTypes.clear();
      state.streamLastFlush = 0;
      state.drops.clear();
      dropGroup.clear();
      applyBlockBatch(data.world || []);
      markChunksLoaded(data.chunks);
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
      }
    }

    if (data.type === "chest_data") {
      if (inventory) {
        inventory.classList.remove("hidden");
      }
      setChest(data.chest);
    }
  };
}

connect();

function isSolid(x, y, z) {
  return state.blocks.has(keyFor(x, y, z));
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
