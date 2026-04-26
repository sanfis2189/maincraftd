import * as THREE from "https://unpkg.com/three@0.160.0/build/three.module.js";

const $ = (id) => document.getElementById(id);

function setTab(name) {
  document.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
  document.querySelectorAll(".panel").forEach((p) => p.classList.toggle("active", p.id === `tab-${name}`));
}

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => setTab(btn.dataset.tab));
});

// Coords
function roundNice(v) {
  return Math.round(v * 100) / 100;
}
function updateCoords() {
  const x = Number($("ow-x").value || 0);
  const z = Number($("ow-z").value || 0);
  $("ow2nether-out").textContent = `x=${roundNice(x / 8)}, z=${roundNice(z / 8)}`;
  const nx = Number($("n-x").value || 0);
  const nz = Number($("n-z").value || 0);
  $("nether2ow-out").textContent = `x=${roundNice(nx * 8)}, z=${roundNice(nz * 8)}`;
}
$("btn-ow2nether").addEventListener("click", updateCoords);
$("btn-nether2ow").addEventListener("click", updateCoords);
updateCoords();

// Resources
function stacksAndRemainder(blocks) {
  const stack = 64;
  const stacks = Math.floor(blocks / stack);
  const rem = blocks % stack;
  return { stacks, rem };
}
function calcBuild() {
  const w = Math.max(1, Math.floor(Number($("b-w").value || 1)));
  const l = Math.max(1, Math.floor(Number($("b-l").value || 1)));
  const h = Math.max(1, Math.floor(Number($("b-h").value || 1)));
  const t = Math.max(1, Math.floor(Number($("b-t").value || 1)));
  const roof = $("b-roof").value;

  // Outer shell: walls only, thickness t.
  const outerPerimeter = 2 * (w + l);
  const wallBlocks = outerPerimeter * h * t;
  const roofBlocks = roof === "flat" ? w * l * t : 0;
  const total = wallBlocks + roofBlocks;

  const a = stacksAndRemainder(total);
  const wA = stacksAndRemainder(wallBlocks);
  const rA = stacksAndRemainder(roofBlocks);

  $("build-out").textContent =
    `Walls: ${wallBlocks} blocks (${wA.stacks} stacks + ${wA.rem}) | ` +
    `Roof: ${roofBlocks} blocks (${rA.stacks} stacks + ${rA.rem}) | ` +
    `Total: ${total} blocks (${a.stacks} stacks + ${a.rem})`;
}
$("btn-build").addEventListener("click", calcBuild);
calcBuild();

// Redstone
function voxFill(el, n, perRow = 24) {
  el.innerHTML = "";
  const cells = Math.max(perRow, Math.min(24 * 10, n));
  for (let i = 0; i < cells; i += 1) {
    const d = document.createElement("div");
    d.className = `voxel ${i < n ? "on" : ""}`;
    el.appendChild(d);
  }
}
function redstoneRepeaterPlan(ticks) {
  // Use as many 4-tick repeaters as possible.
  const plan = [];
  let remain = Math.max(0, Math.floor(ticks));
  while (remain > 0) {
    const step = Math.min(4, remain);
    plan.push(step);
    remain -= step;
  }
  return plan;
}
function calcRedstone() {
  const ticks = Math.max(0, Math.floor(Number($("rs-ticks").value || 0)));
  const plan = redstoneRepeaterPlan(ticks);
  const repeaters = plan.length;
  const seconds = roundNice(ticks * 0.1);
  $("rs-out").textContent = `Ticks: ${ticks} (${seconds}s) | Repeaters: ${repeaters} | Settings: [${plan.join(", ")}]`;
  voxFill($("rs-vox"), repeaters);
}
$("btn-rs").addEventListener("click", calcRedstone);
calcRedstone();

function calcWire() {
  const len = Math.max(0, Math.floor(Number($("wire-len").value || 0)));
  $("wire-out").textContent = `Wire line: ${len} blocks (example delay line)`;
  voxFill($("wire-vox"), len);
}
$("btn-wire").addEventListener("click", calcWire);
calcWire();

// Banner generator (simple preview + template command)
const BN_COLORS = {
  white: "#f4f4f4",
  black: "#1a1a1a",
  red: "#d94a4a",
  blue: "#4a79d9",
  green: "#4ad97a",
  yellow: "#f2c94c",
};

let bannerLayers = [];

function renderBanner() {
  const el = $("bn-preview");
  el.innerHTML = "";
  const base = document.createElement("div");
  base.className = "bn-layer";
  base.style.background = BN_COLORS[bannerLayers[0]?.base || "white"];
  el.appendChild(base);
  bannerLayers.forEach((layer, idx) => {
    if (idx === 0) return;
    const l = document.createElement("div");
    l.className = "bn-layer";
    const col = BN_COLORS[layer.color] || "#111";
    if (layer.pattern === "stripe") {
      l.style.background = `linear-gradient(90deg, transparent 0 42%, ${col} 42% 58%, transparent 58% 100%)`;
    } else if (layer.pattern === "cross") {
      l.style.background = `linear-gradient(90deg, transparent 0 45%, ${col} 45% 55%, transparent 55% 100%), linear-gradient(0deg, transparent 0 45%, ${col} 45% 55%, transparent 55% 100%)`;
    } else if (layer.pattern === "border") {
      l.style.boxShadow = `inset 0 0 0 14px ${col}`;
    } else if (layer.pattern === "circle") {
      l.style.background = `radial-gradient(circle at 50% 55%, ${col} 0 24%, transparent 25% 100%)`;
    }
    el.appendChild(l);
  });

  // Template command (not a full NBT editor, but usable as a starting point).
  const baseName = (bannerLayers[0]?.base || "white").toUpperCase();
  const patterns = bannerLayers
    .slice(1)
    .map((l) => `${l.pattern}:${l.color}`)
    .join(", ");
  $("bn-command").textContent = `/give @p ${baseName}_BANNER{Patterns:[${patterns}]} 1`;
}

function bannerEnsureBase() {
  if (!bannerLayers.length) bannerLayers.push({ base: $("bn-base").value });
  bannerLayers[0].base = $("bn-base").value;
}

$("btn-banner").addEventListener("click", () => {
  bannerEnsureBase();
  renderBanner();
});
$("btn-banner-add").addEventListener("click", () => {
  bannerEnsureBase();
  bannerLayers.push({ pattern: $("bn-pattern").value, color: $("bn-color").value });
  renderBanner();
});
$("btn-banner-clear").addEventListener("click", () => {
  bannerLayers = [];
  renderBanner();
});
bannerEnsureBase();
renderBanner();

// Pixel art
let paSize = 16;
let paData = [];
let paMouseDown = false;

function paBuildGrid() {
  const grid = $("pa-grid");
  paSize = Number($("pa-size").value || 16);
  grid.style.gridTemplateColumns = `repeat(${paSize}, 14px)`;
  paData = Array.from({ length: paSize * paSize }, () => "");
  grid.innerHTML = "";
  for (let i = 0; i < paSize * paSize; i += 1) {
    const cell = document.createElement("div");
    cell.className = "px";
    cell.dataset.i = String(i);
    cell.addEventListener("mousedown", () => {
      paMouseDown = true;
      const col = $("pa-color").value;
      paData[i] = col;
      cell.style.background = col;
    });
    cell.addEventListener("mouseenter", () => {
      if (!paMouseDown) return;
      const col = $("pa-color").value;
      paData[i] = col;
      cell.style.background = col;
    });
    grid.appendChild(cell);
  }
}

document.addEventListener("mouseup", () => {
  paMouseDown = false;
});

$("btn-pa-new").addEventListener("click", () => {
  paBuildGrid();
  $("pa-export").value = "";
});
$("btn-pa-clear").addEventListener("click", () => {
  paData = paData.map(() => "");
  document.querySelectorAll(".px").forEach((c) => (c.style.background = "rgba(255,255,255,0.06)"));
  $("pa-export").value = "";
});
$("btn-pa-export").addEventListener("click", () => {
  $("pa-export").value = JSON.stringify({ size: paSize, pixels: paData }, null, 2);
});
paBuildGrid();

// Skin viewer (simple Steve-like box)
const skinCanvas = $("skin-canvas");
const skinScene = new THREE.Scene();
skinScene.background = new THREE.Color(0x0b0f14);
const skinCam = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
skinCam.position.set(0, 1.2, 2.4);
const skinRenderer = new THREE.WebGLRenderer({ canvas: skinCanvas, antialias: true, powerPreference: "high-performance" });
skinRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));

const skinLight = new THREE.DirectionalLight(0xffffff, 1.0);
skinLight.position.set(2, 3, 2);
skinScene.add(skinLight);
skinScene.add(new THREE.AmbientLight(0xffffff, 0.35));

function makeNearestTextureFromImage(img) {
  const tex = new THREE.Texture(img);
  tex.needsUpdate = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

function makeSteveDemoCanvas() {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#d7b28a";
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = "#4a2f1f";
  ctx.fillRect(0, 0, 32, 16);
  ctx.fillStyle = "#3d6cc4";
  ctx.fillRect(16, 16, 24, 16);
  return c;
}

function skinBox(w, h, d, tex) {
  const mat = new THREE.MeshLambertMaterial({ map: tex });
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
}

const skinGroup = new THREE.Group();
skinScene.add(skinGroup);

function setSkinTexture(tex) {
  skinGroup.clear();
  const head = skinBox(0.6, 0.6, 0.6, tex);
  head.position.set(0, 1.55, 0);
  const body = skinBox(0.65, 0.9, 0.35, tex);
  body.position.set(0, 0.95, 0);
  skinGroup.add(head, body);
}

function resizeSkin() {
  const rect = skinCanvas.getBoundingClientRect();
  const w = Math.max(2, Math.floor(rect.width));
  const h = Math.max(2, Math.floor(rect.height));
  skinRenderer.setSize(w, h, false);
  skinCam.aspect = w / h;
  skinCam.updateProjectionMatrix();
}
window.addEventListener("resize", resizeSkin);
resizeSkin();

let skinYaw = 0;
function skinTick() {
  skinYaw += 0.01;
  skinGroup.rotation.y = skinYaw;
  skinRenderer.render(skinScene, skinCam);
  requestAnimationFrame(skinTick);
}
skinTick();

$("btn-skin-demo").addEventListener("click", () => {
  const tex = makeNearestTextureFromImage(makeSteveDemoCanvas());
  setSkinTexture(tex);
});
$("skin-file").addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const img = new Image();
  img.onload = () => setSkinTexture(makeNearestTextureFromImage(img));
  img.src = URL.createObjectURL(file);
});
$("btn-skin-demo").click();

// Education demo parser
function parseEdu(code) {
  const lines = code.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const ops = [];
  for (const line of lines) {
    if (line.startsWith("#")) continue;
    const parts = line.split(/\s+/);
    const op = parts[0];
    if (op === "box" && parts.length >= 5) {
      ops.push({ op, w: Number(parts[1]), h: Number(parts[2]), l: Number(parts[3]), block: parts[4] });
    } else if (op === "pillar" && parts.length >= 5) {
      ops.push({ op, x: Number(parts[1]), y: Number(parts[2]), z: Number(parts[3]), h: Number(parts[4]), block: parts[5] || "stone" });
    } else {
      ops.push({ op: "unknown", raw: line });
    }
  }
  return ops;
}

$("btn-edu-run").addEventListener("click", () => {
  const ops = parseEdu($("edu-code").value);
  const out = ops
    .map((o) => {
      if (o.op === "box") return `BOX ${o.w}x${o.h}x${o.l} using ${o.block}`;
      if (o.op === "pillar") return `PILLAR at (${o.x},${o.y},${o.z}) height ${o.h} using ${o.block}`;
      return `? ${o.raw}`;
    })
    .join("\n");
  $("edu-out").textContent = out || "No ops";
});

$("btn-edu-demo").addEventListener("click", () => {
  $("edu-code").value = `# Demo:\nbox 9 5 9 stone\npillar 0 0 0 7 oak_log\npillar 8 0 0 7 oak_log\npillar 0 0 8 7 oak_log\npillar 8 0 8 7 oak_log\n`;
});

