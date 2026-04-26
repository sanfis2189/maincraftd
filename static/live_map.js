const canvas = document.getElementById("lm-canvas");
const statusEl = document.getElementById("lm-status");
const legendEl = document.getElementById("lm-legend");
const connectBtn = document.getElementById("lm-connect");
const followBtn = document.getElementById("lm-follow");
const zoomInBtn = document.getElementById("lm-zoom-in");
const zoomOutBtn = document.getElementById("lm-zoom-out");

const ctx = canvas.getContext("2d");
const state = {
  socket: null,
  connected: false,
  world: { x: 0, z: 0, chunkSize: 16, minY: -100, maxY: 31, visibleChunks: 3 },
  players: new Map(),
  follow: false,
  zoom: 8, // pixels per block
  originX: 0,
  originZ: 0,
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  const w = Math.max(2, Math.floor(rect.width));
  const h = Math.max(2, Math.floor(rect.height));
  canvas.width = w;
  canvas.height = h;
}

window.addEventListener("resize", () => {
  resize();
  draw();
});

function setStatus(s) {
  statusEl.textContent = s;
}

function drawGrid() {
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const daylight = 0.65;
  ctx.fillStyle = `rgb(${Math.floor(10 + 18 * daylight)},${Math.floor(14 + 20 * daylight)},${Math.floor(20 + 28 * daylight)})`;
  ctx.fillRect(0, 0, w, h);

  const px = state.zoom;
  const cx = w / 2;
  const cz = h / 2;

  ctx.strokeStyle = "rgba(255,255,255,0.06)";
  ctx.lineWidth = 1;

  const step = state.world.chunkSize * px;
  for (let x = (cx % step); x < w; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let z = (cz % step); z < h; z += step) {
    ctx.beginPath();
    ctx.moveTo(0, z);
    ctx.lineTo(w, z);
    ctx.stroke();
  }

  // Border
  if (state.world.borderMinX !== undefined) {
    const minX = state.world.borderMinX;
    const maxX = state.world.borderMaxX;
    const minZ = state.world.borderMinZ;
    const maxZ = state.world.borderMaxZ;
    ctx.strokeStyle = "rgba(242,201,76,0.55)";
    ctx.lineWidth = 2;
    const x0 = cx + (minX - state.originX) * px;
    const x1 = cx + (maxX - state.originX) * px;
    const z0 = cz + (minZ - state.originZ) * px;
    const z1 = cz + (maxZ - state.originZ) * px;
    ctx.strokeRect(x0, z0, x1 - x0, z1 - z0);
  }
}

function drawPlayers() {
  const w = canvas.width;
  const h = canvas.height;
  const px = state.zoom;
  const cx = w / 2;
  const cz = h / 2;
  const you = Array.from(state.players.values()).find((p) => p.isSelf);
  if (state.follow && you?.pos) {
    state.originX = you.pos.x;
    state.originZ = you.pos.z;
  }

  state.players.forEach((p) => {
    if (!p.pos) return;
    const x = cx + (p.pos.x - state.originX) * px;
    const z = cz + (p.pos.z - state.originZ) * px;
    ctx.fillStyle = p.isSelf ? "rgba(110,231,183,0.95)" : "rgba(155,231,255,0.92)";
    ctx.beginPath();
    ctx.arc(x, z, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.font = "12px ui-monospace, Menlo, Consolas, monospace";
    ctx.fillText(p.name || "Player", x + 10, z + 4);
  });
}

function draw() {
  resize();
  drawGrid();
  drawPlayers();
  legendEl.textContent =
    `Zoom: ${state.zoom}px/block\n` +
    `Players: ${state.players.size}\n` +
    `Follow: ${state.follow ? "ON" : "OFF"}\n` +
    `Origin: x=${Math.floor(state.originX)}, z=${Math.floor(state.originZ)}\n`;
}

function connect() {
  if (state.socket) {
    try {
      state.socket.close();
    } catch (_) {
      // ignore
    }
  }
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  const url = `${protocol}://${window.location.host}/ws/game/?clientId=live-map`;
  setStatus("Connecting...");
  const socket = new WebSocket(url);
  state.socket = socket;

  socket.onopen = () => {
    state.connected = true;
    setStatus("Connected");
    socket.send(JSON.stringify({ type: "hello", clientId: "live-map" }));
  };
  socket.onclose = () => {
    state.connected = false;
    setStatus("Disconnected");
  };
  socket.onerror = () => {
    setStatus("WS error");
  };
  socket.onmessage = (event) => {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch (_) {
      return;
    }
    if (data.type === "init") {
      state.players.clear();
      state.world = { ...state.world, ...(data.worldSize || {}) };
      (data.players || []).forEach((p) => {
        state.players.set(p.id, { id: p.id, name: p.name, pos: p.pos, isSelf: p.id === data.playerId });
      });
      const self = state.players.get(data.playerId);
      if (self?.pos) {
        state.originX = self.pos.x;
        state.originZ = self.pos.z;
      }
      draw();
    }
    if (data.type === "player_join") {
      state.players.set(data.player.id, { ...data.player, isSelf: false });
      draw();
    }
    if (data.type === "player_leave") {
      state.players.delete(data.playerId);
      draw();
    }
    if (data.type === "player_update") {
      const p = data.player;
      const cur = state.players.get(p.id) || { id: p.id, isSelf: false };
      state.players.set(p.id, { ...cur, name: p.name || cur.name, pos: p.pos || cur.pos });
      draw();
    }
  };
}

connectBtn.addEventListener("click", connect);
followBtn.addEventListener("click", () => {
  state.follow = !state.follow;
  followBtn.textContent = `Follow: ${state.follow ? "ON" : "OFF"}`;
  draw();
});
zoomInBtn.addEventListener("click", () => {
  state.zoom = Math.min(32, state.zoom + 2);
  draw();
});
zoomOutBtn.addEventListener("click", () => {
  state.zoom = Math.max(2, state.zoom - 2);
  draw();
});

let dragging = false;
let lastX = 0;
let lastZ = 0;
canvas.addEventListener("mousedown", (e) => {
  dragging = true;
  lastX = e.clientX;
  lastZ = e.clientY;
});
window.addEventListener("mouseup", () => {
  dragging = false;
});
window.addEventListener("mousemove", (e) => {
  if (!dragging || state.follow) return;
  const dx = e.clientX - lastX;
  const dz = e.clientY - lastZ;
  lastX = e.clientX;
  lastZ = e.clientY;
  state.originX -= dx / state.zoom;
  state.originZ -= dz / state.zoom;
  draw();
});

draw();

