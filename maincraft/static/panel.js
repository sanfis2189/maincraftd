const $ = (id) => document.getElementById(id);

function getToken() {
  return localStorage.getItem("panelToken") || $("p-token").value || "dev";
}

function setToken(t) {
  localStorage.setItem("panelToken", t);
  $("p-token").value = t;
}

async function api(path, body) {
  const res = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Panel-Token": getToken() },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = { ok: false, error: text };
  }
  if (!res.ok || !data.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

function renderPlayers(players) {
  const list = $("p-players");
  const sel = $("p-player");
  sel.innerHTML = "";
  if (!players.length) {
    list.textContent = "No players";
    return;
  }
  list.textContent = players
    .map((p) => `${p.id} ${p.name} (${Math.floor(p.pos?.x || 0)},${Math.floor(p.pos?.y || 0)},${Math.floor(p.pos?.z || 0)})`)
    .join("\n");
  players.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name || p.id;
    sel.appendChild(opt);
  });
}

async function refresh() {
  const res = await fetch("/api/status/", { cache: "no-store" });
  const data = await res.json();
  $("p-online").textContent = `Players: ${data.playerCount || 0} | NPC: ${data.npcCount || 0}`;
  renderPlayers(data.players || []);
}

$("p-save").addEventListener("click", () => setToken($("p-token").value));
$("p-send").addEventListener("click", async () => {
  const name = $("p-name").value || "ADMIN";
  const text = $("p-text").value || "";
  try {
    await api("/api/panel/broadcast/", { name, text });
    $("p-text").value = "";
  } catch (e) {
    alert(String(e.message || e));
  }
});

$("p-give").addEventListener("click", async () => {
  const playerId = $("p-player").value;
  const blockType = Number($("p-block").value || 0);
  const count = Number($("p-count").value || 1);
  try {
    await api("/api/panel/give/", { playerId, blockType, count });
    await refresh();
  } catch (e) {
    alert(String(e.message || e));
  }
});

$("p-time").addEventListener("click", async () => {
  const speedMultiplier = Number($("p-speed").value);
  const progress = Number($("p-prog").value);
  try {
    await api("/api/panel/time/", { speedMultiplier, progress });
  } catch (e) {
    alert(String(e.message || e));
  }
});

setToken(getToken());
refresh();
setInterval(refresh, 2500);

