const $ = (id) => document.getElementById(id);

const gridEl = $("se-grid");
const wEl = $("se-w");
const lEl = $("se-l");
const hEl = $("se-h");
const yEl = $("se-y");
const blockEl = $("se-block");
const nameEl = $("se-name");
const jsonEl = $("se-json");

let W = 16;
let L = 16;
let H = 8;
let Y = 0;
let brush = "stone";
let mouseDown = false;

// Linear order for .schematic: index = x + z*W + y*W*L
let vox = [];

const COLOR = {
  air: "rgba(255,255,255,0.06)",
  stone: "#9ca3af",
  dirt: "#8b5a2b",
  grass: "#7cc36a",
  cobble: "#7b7f86",
  planks: "#d3a471",
  wood: "#b7794a",
  sand: "#d9c285",
  brick: "#b5523b",
  glass: "rgba(180,220,255,0.35)",
  torch: "#f2c94c",
  water: "rgba(80,140,255,0.35)",
};

function idx(x, z, y) {
  return x + z * W + y * W * L;
}

function clamp() {
  W = Math.max(1, Math.min(64, Math.floor(Number(wEl.value || 1))));
  L = Math.max(1, Math.min(64, Math.floor(Number(lEl.value || 1))));
  H = Math.max(1, Math.min(32, Math.floor(Number(hEl.value || 1))));
  Y = Math.max(0, Math.min(H - 1, Math.floor(Number(yEl.value || 0))));
  yEl.value = String(Y);
}

function newSchem() {
  clamp();
  vox = Array.from({ length: W * L * H }, () => "air");
  buildGrid();
  renderLayer();
}

function buildGrid() {
  gridEl.innerHTML = "";
  gridEl.style.gridTemplateColumns = `repeat(${W}, 14px)`;
  for (let z = 0; z < L; z += 1) {
    for (let x = 0; x < W; x += 1) {
      const cell = document.createElement("div");
      cell.className = "px";
      cell.dataset.x = String(x);
      cell.dataset.z = String(z);
      cell.addEventListener("mousedown", (e) => {
        mouseDown = true;
        paintCell(cell, e.shiftKey);
      });
      cell.addEventListener("mouseenter", (e) => {
        if (!mouseDown) return;
        paintCell(cell, e.shiftKey);
      });
      gridEl.appendChild(cell);
    }
  }
}

function paintCell(cell, erase) {
  const x = Number(cell.dataset.x);
  const z = Number(cell.dataset.z);
  const v = erase ? "air" : brush;
  vox[idx(x, z, Y)] = v;
  cell.style.background = COLOR[v] || COLOR.air;
}

function renderLayer() {
  const cells = Array.from(gridEl.querySelectorAll(".px"));
  let i = 0;
  for (let z = 0; z < L; z += 1) {
    for (let x = 0; x < W; x += 1) {
      const v = vox[idx(x, z, Y)];
      cells[i].style.background = COLOR[v] || COLOR.air;
      i += 1;
    }
  }
}

window.addEventListener("mouseup", () => {
  mouseDown = false;
});

$("se-new").addEventListener("click", newSchem);
yEl.addEventListener("input", () => {
  clamp();
  renderLayer();
});
blockEl.addEventListener("change", () => {
  brush = blockEl.value;
});
$("se-erase").addEventListener("click", () => {
  brush = "air";
  blockEl.value = "air";
});

function exportJson() {
  clamp();
  const out = {
    name: nameEl.value || "build",
    width: W,
    length: L,
    height: H,
    blocks: vox,
  };
  jsonEl.value = JSON.stringify(out, null, 2);
  return out;
}

$("se-export-json").addEventListener("click", exportJson);

async function exportSchem() {
  const data = exportJson();
  // Server accepts blocks as strings or numeric IDs.
  const res = await fetch("/api/schematic/export/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: data.name, width: data.width, height: data.height, length: data.length, blocks: data.blocks }),
  });
  if (!res.ok) {
    const msg = await res.text();
    alert(msg);
    return;
  }
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${data.name}.schematic`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

$("se-export-schem").addEventListener("click", () => {
  exportSchem().catch((e) => alert(String(e?.message || e)));
});

newSchem();

