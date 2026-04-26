const canvas = document.getElementById("c-canvas");
const ctx = canvas.getContext("2d");

const W = 48;
const H = 32;
const cell = 16;

const world = Array.from({ length: W * H }, () => null);
const player = { x: 6, y: 6, vx: 0, vy: 0 };
let brush = "#7cc36a";

function idx(x, y) {
  return x + y * W;
}

function resize() {
  canvas.width = W * cell;
  canvas.height = H * cell;
}

function gen() {
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const ground = y > H - 6;
      world[idx(x, y)] = ground ? (y === H - 6 ? "#7cc36a" : "#8b5a2b") : null;
      if (ground && Math.random() < 0.02) world[idx(x, y - 1)] = "#d3a471";
      if (ground && Math.random() < 0.01) world[idx(x, y - 1)] = "#9ca3af";
    }
  }
}

function reset() {
  for (let i = 0; i < world.length; i += 1) world[i] = null;
  player.x = 6;
  player.y = 6;
  gen();
}

function solidAt(x, y) {
  if (x < 0 || y < 0 || x >= W || y >= H) return true;
  return Boolean(world[idx(x, y)]);
}

function draw() {
  ctx.fillStyle = "#0b0f14";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const c = world[idx(x, y)];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x * cell, y * cell, cell, cell);
    }
  }
  ctx.fillStyle = "#6ee7b7";
  ctx.fillRect(player.x * cell, player.y * cell, cell, cell);
}

const keys = new Set();
window.addEventListener("keydown", (e) => keys.add(e.code));
window.addEventListener("keyup", (e) => keys.delete(e.code));

function tick() {
  const speed = 0.08;
  const dx = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0);
  const dy = (keys.has("KeyS") ? 1 : 0) - (keys.has("KeyW") ? 1 : 0);

  let nx = player.x + dx * speed;
  let ny = player.y + dy * speed;

  // Simple collision: player occupies 1 cell.
  const tx = Math.round(nx);
  const ty = Math.round(ny);
  if (!solidAt(tx, Math.round(player.y))) player.x = nx;
  if (!solidAt(Math.round(player.x), ty)) player.y = ny;

  draw();
  requestAnimationFrame(tick);
}

canvas.addEventListener("contextmenu", (e) => e.preventDefault());
canvas.addEventListener("mousedown", (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * W);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * H);
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (e.button === 2) {
    world[idx(x, y)] = null;
  } else {
    world[idx(x, y)] = brush;
  }
});

document.querySelectorAll(".c-block").forEach((b) => {
  b.addEventListener("click", () => {
    brush = b.dataset.col || brush;
  });
});

document.getElementById("c-reset").addEventListener("click", reset);
document.getElementById("c-gen").addEventListener("click", () => {
  gen();
});

resize();
reset();
tick();

