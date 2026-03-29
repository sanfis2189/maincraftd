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
  [BLOCKS.STICK]: "Stick",
  [BLOCKS.TORCH]: "Torch",
};

const state = {
  playerId: null,
  worldSize: { x: 32, y: 16, z: 32 },
  blocks: new Map(),
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

const clock = new THREE.Clock();
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b0f14, 10, 60);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(8, 8, 8);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x0b0f14);

const ambient = new THREE.AmbientLight(0xffffff, 0.55);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(10, 20, 5);
scene.add(sun);

const playerGroup = new THREE.Group();
scene.add(playerGroup);

const blockGroup = new THREE.Group();
scene.add(blockGroup);
const dropGroup = new THREE.Group();
scene.add(dropGroup);

const geometry = new THREE.BoxGeometry(1, 1, 1);
const meshes = new Map();

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
  return `${x},${y},${z}`;
}

function rebuildInstanced(type) {
  const existing = meshes.get(type);
  if (existing) blockGroup.remove(existing.mesh);

  const blocks = [];
  state.blocks.forEach((t, key) => {
    if (t === type) {
      const [x, y, z] = key.split(",").map(Number);
      blocks.push({ x, y, z });
    }
  });

  const material = new THREE.MeshStandardMaterial({ color: BLOCK_COLORS[type] });
  const instanced = new THREE.InstancedMesh(geometry, material, blocks.length || 1);
  instanced.count = blocks.length;
  instanced.userData.type = type;
  const matrix = new THREE.Matrix4();
  blocks.forEach((b, i) => {
    matrix.makeTranslation(b.x, b.y, b.z);
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
  state.blocks.set(keyFor(x, y, z), type);
}

function removeBlock(x, y, z) {
  state.blocks.delete(keyFor(x, y, z));
}

function updateBlock(block) {
  const key = keyFor(block.x, block.y, block.z);
  const old = state.blocks.get(key) || BLOCKS.AIR;
  if (block.t === BLOCKS.AIR) {
    state.blocks.delete(key);
  } else {
    state.blocks.set(key, block.t);
  }
  if (old !== BLOCKS.AIR) rebuildInstanced(old);
  if (block.t !== BLOCKS.AIR) rebuildInstanced(block.t);
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
const mouse = new THREE.Vector2();

function getIntersect() {
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(blockGroup.children, false);
  if (!hits.length) return null;
  const hit = hits[0];
  const type = hit.object.userData.type;
  const list = meshes.get(type)?.blocks || [];
  const b = list[hit.instanceId];
  if (!b) return null;
  return { ...b, t: type, normal: hit.face?.normal };
}

function getBreakTime(type) {
  switch (type) {
    case BLOCKS.STONE:
    case BLOCKS.COBBLE:
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

  camera.position.copy(next);
  camera.rotation.set(pitch, yaw, 0, "YXZ");
}

let lastNet = 0;
function tick() {
  const dt = clock.getDelta();
  updateCamera(dt);
  renderer.render(scene, camera);

  if (breakState.active && state.mode === 0) {
    const hit = getIntersect();
    if (!hit) {
      breakState.active = false;
    } else {
      const key = `${hit.x},${hit.y},${hit.z}`;
      if (key !== breakState.key) {
        breakState.active = false;
      } else {
        const needed = getBreakTime(state.blocks.get(key) || BLOCKS.STONE);
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
          if (breakBar) breakBar.classList.add("hidden");
          playBreakSound();
        }
      }
    }
  } else if (breakBar) {
    breakBar.classList.add("hidden");
  }

  if (state.drops.size > 0) {
    state.drops.forEach((drop) => {
      const dist = camera.position.distanceTo(drop.mesh.position);
      if (dist < 1.5) {
        socketSend({ type: "pickup", playerId: state.playerId, dropId: drop.id });
      }
    });
  }

  if (state.playerId && performance.now() - lastNet > 60) {
    socketSend({
      type: "player_update",
      playerId: state.playerId,
      pos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
      rot: { x: pitch, y: yaw },
    });
    lastNet = performance.now();
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
      state.worldSize = data.worldSize;
      state.blocks.clear();
      state.drops.clear();
      dropGroup.clear();
      data.world.forEach((b) => addBlock(b.x, b.y, b.z, b.t));
      rebuildAll();
      state.mode = data.players.find((p) => p.id === state.playerId)?.mode ?? 1;
      if (data.inventory) setInventory(data.inventory);
      if (data.drops) {
        data.drops.forEach(spawnDrop);
      }
      data.players.forEach(addPlayer);
      statusEl.textContent = `Players: ${data.players.length}`;
      tick();
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
  return state.blocks.has(`${x},${y},${z}`);
}

function collidesAt(pos, radius, height) {
  const minX = Math.floor(pos.x - radius);
  const maxX = Math.floor(pos.x + radius);
  const minZ = Math.floor(pos.z - radius);
  const maxZ = Math.floor(pos.z + radius);
  const footY = pos.y - height;
  const minY = Math.floor(footY);
  const maxY = Math.floor(footY + height);
  for (let x = minX; x <= maxX; x += 1) {
    for (let z = minZ; z <= maxZ; z += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        if (isSolid(x, y, z)) return true;
      }
    }
  }
  return false;
}
