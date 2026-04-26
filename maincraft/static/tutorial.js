const $ = (id) => document.getElementById(id);

function makeGive() {
  const target = $("t-give-target").value || "@p";
  const item = $("t-give-item").value || "minecraft:torch";
  const count = Math.max(1, Math.min(64, Math.floor(Number($("t-give-count").value || 1))));
  $("t-give-out").textContent = `/give ${target} ${item} ${count}`;
}

function makeTime() {
  const preset = $("t-time-preset").value || "noon";
  $("t-time-out").textContent = `/time set ${preset}`;
}

function makeCommandBlock() {
  const cmd = ($("t-cmd").value || "").trim();
  $("t-cb-out").textContent = cmd ? `Command Block:\n${cmd}` : "Empty";
}

$("t-give-make").addEventListener("click", makeGive);
$("t-time-make").addEventListener("click", makeTime);
$("t-cb").addEventListener("click", makeCommandBlock);
makeGive();
makeTime();
makeCommandBlock();

