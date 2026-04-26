const $ = (id) => document.getElementById(id);

const RECIPES = [
  { cat: "basic", out: "planks", count: 4, in: [{ item: "wood", count: 1 }] },
  { cat: "tools", out: "stick", count: 4, in: [{ item: "planks", count: 2 }] },
  { cat: "tools", out: "torch", count: 4, in: [{ item: "stick", count: 1 }, { item: "planks", count: 1 }] },
  { cat: "basic", out: "chest", count: 1, in: [{ item: "planks", count: 4 }] },
  { cat: "basic", out: "brick", count: 1, in: [{ item: "cobble", count: 4 }] },
  { cat: "food", out: "bread", count: 1, in: [{ item: "wheat", count: 3 }] },
  { cat: "food", out: "apple", count: 1, in: [{ item: "apple", count: 1 }] },
];

function fmt(r) {
  const cost = r.in.map((x) => `${x.item} x${x.count}`).join(", ");
  return `${r.out} x${r.count}  <=  ${cost}  [${r.cat}]`;
}

function render() {
  const q = ($("w-q").value || "").trim().toLowerCase();
  const cat = $("w-cat").value || "all";
  const out = RECIPES.filter((r) => {
    if (cat !== "all" && r.cat !== cat) return false;
    if (!q) return true;
    const hay = `${r.out} ${r.cat} ${r.in.map((x) => x.item).join(" ")}`.toLowerCase();
    return hay.includes(q);
  })
    .map(fmt)
    .join("\n");
  $("w-list").textContent = out || "No matches";
}

$("w-q").addEventListener("input", render);
$("w-cat").addEventListener("change", render);
render();

