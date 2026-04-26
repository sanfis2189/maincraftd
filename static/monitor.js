const $ = (id) => document.getElementById(id);

function setDot(ok) {
  const dot = $("mon-dot");
  dot.classList.remove("good", "bad");
  dot.classList.add(ok ? "good" : "bad");
}

function renderPlayers(players) {
  const box = $("mon-players");
  if (!Array.isArray(players) || !players.length) {
    box.textContent = "No players online";
    return;
  }
  box.textContent = players
    .map((p) => {
      const pos = p.pos ? `(${Math.floor(p.pos.x)}, ${Math.floor(p.pos.y)}, ${Math.floor(p.pos.z)})` : "";
      return `${p.name || "Player"} ${pos}`;
    })
    .join("\n");
}

async function refresh() {
  $("mon-state").textContent = "Loading...";
  setDot(false);
  try {
    const res = await fetch("/api/status/", { cache: "no-store" });
    const data = await res.json();
    const ok = Boolean(data.ok);
    setDot(ok);
    $("mon-state").textContent = ok ? `Online (${data.playerCount || 0})` : "Offline";
    renderPlayers(data.players || []);
  } catch (err) {
    setDot(false);
    $("mon-state").textContent = "Offline";
    $("mon-players").textContent = String(err?.message || err);
  }
}

function init() {
  $("mon-host").textContent = window.location.host;
  $("mon-refresh").addEventListener("click", refresh);
  $("mon-copy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(window.location.host);
    } catch (_) {
      // ignore
    }
  });

  const savedMap = localStorage.getItem("mapUrl") || "";
  $("map-url").value = savedMap;
  $("map-apply").addEventListener("click", () => {
    const url = $("map-url").value.trim();
    localStorage.setItem("mapUrl", url);
    $("map-frame").src = url;
  });
  if (savedMap) $("map-frame").src = savedMap;

  // Demo shop
  let balance = 0;
  const log = (msg) => {
    const el = $("shop-log");
    el.textContent = `${msg}\n${el.textContent || ""}`.slice(0, 2000);
  };
  $("shop-login").addEventListener("click", () => {
    balance = 150;
    $("shop-balance").textContent = `Balance: ${balance}`;
    log(`Login OK: ${$("shop-user").value || "Player"}`);
  });
  $("shop-buy").addEventListener("click", () => {
    const item = $("shop-item").value;
    const qty = Math.max(1, Math.floor(Number($("shop-qty").value || 1)));
    const price = item === "torch" ? 2 : item === "bread" ? 6 : 3;
    const cost = price * qty;
    if (balance < cost) {
      log(`Not enough funds. Need ${cost}, have ${balance}`);
      return;
    }
    balance -= cost;
    $("shop-balance").textContent = `Balance: ${balance}`;
    log(`Bought ${item} x${qty} for ${cost}`);
  });

  refresh();
  setInterval(refresh, 2500);
}

init();

