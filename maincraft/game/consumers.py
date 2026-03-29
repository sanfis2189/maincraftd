import json
import random
import time
from pathlib import Path
from uuid import uuid4

from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

WORLD_SIZE = {"x": 64, "y": 24, "z": 64}
WORLD_SEED = int(time.time())

BLOCK_AIR = 0
BLOCK_GRASS = 1
BLOCK_DIRT = 2
BLOCK_STONE = 3
BLOCK_WOOD = 4
BLOCK_LEAVES = 5
BLOCK_SAND = 6
BLOCK_BRICK = 7
BLOCK_PLANK = 8
BLOCK_COBBLE = 9
BLOCK_CHEST = 10
ITEM_STICK = 100
ITEM_TORCH = 101

WORLD = {"blocks": None, "last_broadcast": 0}
PLAYERS = {}
REACH_DISTANCE = 5.0
WORLD_PATH = Path(settings.BASE_DIR) / "data" / "world.json"
CHEST_PATH = Path(settings.BASE_DIR) / "data" / "chests.json"
PLAYER_PATH = Path(settings.BASE_DIR) / "data" / "players.json"
DROPS = {}
CHESTS = {}
PLAYER_STORE = {}


def generate_world():
    random.seed(WORLD_SEED)
    blocks = {}
    for x in range(WORLD_SIZE["x"]):
        for z in range(WORLD_SIZE["z"]):
            height = height_at(x, z)
            for y in range(height):
                if y == height - 1:
                    block = top_block_at(x, z, height)
                elif y >= height - 3:
                    block = BLOCK_DIRT
                else:
                    block = BLOCK_STONE
                if not carve_cave(x, y, z):
                    blocks[(x, y, z)] = block
            if height > 4 and rand2(x, z) > 0.86:
                add_tree(blocks, x, height, z)
    return blocks


def add_tree(blocks, x, y, z):
    trunk_height = 3
    for i in range(trunk_height):
        if y + i < WORLD_SIZE["y"]:
            blocks[(x, y + i, z)] = BLOCK_WOOD
    for dx in range(-2, 3):
        for dz in range(-2, 3):
            for dy in range(2):
                nx, ny, nz = x + dx, y + trunk_height - 1 + dy, z + dz
                if 0 <= nx < WORLD_SIZE["x"] and 0 <= nz < WORLD_SIZE["z"] and ny < WORLD_SIZE["y"]:
                    blocks[(nx, ny, nz)] = BLOCK_LEAVES


def rand2(x, z):
    h = (x * 73856093) ^ (z * 19349663) ^ (WORLD_SEED * 83492791)
    h = h & 0xFFFFFFFF
    return h / 0xFFFFFFFF


def rand3(x, y, z):
    h = (x * 73856093) ^ (y * 83492791) ^ (z * 19349663) ^ (WORLD_SEED * 2654435761)
    h = h & 0xFFFFFFFF
    return h / 0xFFFFFFFF


def top_block_at(x, z, height):
    biome = rand2(x // 4, z // 4)
    if biome < 0.3 or height <= 4:
        return BLOCK_SAND
    return BLOCK_GRASS


def height_at(x, z):
    base = 5
    n = rand2(x, z)
    n2 = rand2(x + 7, z + 13)
    n3 = rand2(x - 11, z - 5)
    height = base + int((n * 6 + n2 * 4 + n3 * 2) / 3)
    return max(3, min(WORLD_SIZE["y"] - 2, height))


def carve_cave(x, y, z):
    if y < 3 or y > WORLD_SIZE["y"] - 4:
        return False
    noise = rand3(x // 2, y // 2, z // 2)
    return noise > 0.985


def serialize_blocks(blocks):
    return [
        {"x": x, "y": y, "z": z, "t": t} for (x, y, z), t in blocks.items()
    ]


def save_world(blocks):
    WORLD_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {
        "seed": WORLD_SEED,
        "size": WORLD_SIZE,
        "blocks": serialize_blocks(blocks),
    }
    WORLD_PATH.write_text(json.dumps(data))


def load_world():
    if not WORLD_PATH.exists():
        return None
    try:
        data = json.loads(WORLD_PATH.read_text())
        blocks = {}
        for b in data.get("blocks", []):
            blocks[(b["x"], b["y"], b["z"])] = b["t"]
        return blocks
    except Exception:
        return None


def load_players():
    if not PLAYER_PATH.exists():
        return {}
    try:
        return json.loads(PLAYER_PATH.read_text())
    except Exception:
        return {}


def save_players(data):
    PLAYER_PATH.parent.mkdir(parents=True, exist_ok=True)
    PLAYER_PATH.write_text(json.dumps(data))


def load_chests():
    if not CHEST_PATH.exists():
        return {}
    try:
        return json.loads(CHEST_PATH.read_text())
    except Exception:
        return {}


def save_chests(data):
    CHEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    CHEST_PATH.write_text(json.dumps(data))


CHESTS = load_chests()
PLAYER_STORE = load_players()


def inv_add(inv, block_type, count):
    add_item(inv, block_type, count)


def inv_take(inv, block_type, count):
    return remove_item(inv, block_type, count)


def inv_has(inv, block_type, count):
    return count_item(inv, block_type) >= count


def normalize_inventory(inv):
    if isinstance(inv, list):
        return inv
    if isinstance(inv, dict):
        slots = [None] * 36
        i = 0
        for k, v in inv.items():
            if i >= 36:
                break
            slots[i] = {"t": int(k), "c": int(v)}
            i += 1
        return slots
    return [None] * 36


def count_item(inv, block_type):
    total = 0
    for entry in inv:
        if entry and entry["t"] == block_type:
            total += entry["c"]
    return total


def add_item(inv, block_type, count, max_stack=64):
    for entry in inv:
        if entry and entry["t"] == block_type and entry["c"] < max_stack:
            add = min(max_stack - entry["c"], count)
            entry["c"] += add
            count -= add
            if count == 0:
                return True
    for i in range(len(inv)):
        if inv[i] is None:
            add = min(max_stack, count)
            inv[i] = {"t": block_type, "c": add}
            count -= add
            if count == 0:
                return True
    return False


def remove_item(inv, block_type, count):
    if count_item(inv, block_type) < count:
        return False
    for entry in inv:
        if entry and entry["t"] == block_type:
            take = min(entry["c"], count)
            entry["c"] -= take
            count -= take
            if entry["c"] <= 0:
                entry["c"] = 0
    for i in range(len(inv)):
        if inv[i] and inv[i]["c"] == 0:
            inv[i] = None
    return True


def is_placeable(block_type):
    return block_type is not None and block_type < 100


def within_reach(player, x, y, z):
    if not player:
        return False
    px, py, pz = player["pos"]["x"], player["pos"]["y"], player["pos"]["z"]
    dx = px - (x + 0.5)
    dy = py - (y + 0.5)
    dz = pz - (z + 0.5)
    return (dx * dx + dy * dy + dz * dz) ** 0.5 <= REACH_DISTANCE


def recipe_from_slots(slots):
    filtered = [s for s in slots if s is not None]
    if len(filtered) == 1 and filtered[0] == BLOCK_WOOD:
        return {"out": BLOCK_PLANK, "count": 4, "cost": {BLOCK_WOOD: 1}}
    if len(filtered) == 2 and all(t == BLOCK_PLANK for t in filtered):
        return {"out": ITEM_STICK, "count": 4, "cost": {BLOCK_PLANK: 2}}
    if len(filtered) == 4 and all(t == BLOCK_COBBLE for t in filtered):
        return {"out": BLOCK_BRICK, "count": 1, "cost": {BLOCK_COBBLE: 4}}
    if len(filtered) == 4 and all(t == BLOCK_PLANK for t in filtered):
        return {"out": BLOCK_CHEST, "count": 1, "cost": {BLOCK_PLANK: 4}}
    if len(filtered) == 2 and ITEM_STICK in filtered and BLOCK_PLANK in filtered:
        return {"out": ITEM_TORCH, "count": 4, "cost": {ITEM_STICK: 1, BLOCK_PLANK: 1}}
    return None


def persist_player(player):
    client_id = player.get("clientId")
    if not client_id:
        return
    PLAYER_STORE[client_id] = {"inv": player.get("inv", {})}
    save_players(PLAYER_STORE)


def spawn_drop(block_type, x, y, z):
    drop_id = str(uuid4())
    DROPS[drop_id] = {"id": drop_id, "t": block_type, "x": x, "y": y, "z": z}
    return DROPS[drop_id]


class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        await self.channel_layer.group_add("world", self.channel_name)
        await self.accept()

        if WORLD["blocks"] is None:
            WORLD["blocks"] = load_world() or generate_world()
            save_world(WORLD["blocks"])

        self.player_id = str(uuid4())
        PLAYERS[self.player_id] = {
            "id": self.player_id,
            "name": f"Player-{self.player_id[:4]}",
            "pos": {"x": 8, "y": 8, "z": 8},
            "rot": {"x": 0, "y": 0},
            "mode": 1,
            "inv": normalize_inventory({"1": 10, "2": 10, "4": 5}),
            "clientId": None,
            "last": time.time(),
        }

        await self.send(
            text_data=json.dumps(
                {
                    "type": "init",
                    "playerId": self.player_id,
                    "world": serialize_blocks(WORLD["blocks"]),
                    "worldSize": WORLD_SIZE,
                    "players": list(PLAYERS.values()),
                    "inventory": PLAYERS[self.player_id]["inv"],
                    "drops": list(DROPS.values()),
                }
            )
        )

        await self.channel_layer.group_send(
            "world",
            {
                "type": "player.join",
                "player": PLAYERS[self.player_id],
            },
        )

    async def disconnect(self, close_code):
        player_id = self._get_player_id()
        if player_id and player_id in PLAYERS:
            player = PLAYERS.pop(player_id)
            await self.channel_layer.group_send(
                "world",
                {"type": "player.leave", "playerId": player_id, "player": player},
            )
        await self.channel_layer.group_discard("world", self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return
        msg = json.loads(text_data)
        msg_type = msg.get("type")
        player_id = msg.get("playerId") or self._get_player_id()

        if msg_type == "hello":
            client_id = msg.get("clientId")
            if player_id in PLAYERS and client_id:
                PLAYERS[player_id]["clientId"] = client_id
                if client_id in PLAYER_STORE:
                    PLAYERS[player_id]["inv"] = normalize_inventory(
                        PLAYER_STORE[client_id].get("inv", [])
                    )
                else:
                    PLAYER_STORE[client_id] = {"inv": PLAYERS[player_id]["inv"]}
                    save_players(PLAYER_STORE)
                await self.send(
                    text_data=json.dumps(
                        {"type": "inventory", "inventory": PLAYERS[player_id]["inv"]}
                    )
                )
            return

        if msg_type == "player_update" and player_id in PLAYERS:
            PLAYERS[player_id]["pos"] = msg.get("pos", PLAYERS[player_id]["pos"])
            PLAYERS[player_id]["rot"] = msg.get("rot", PLAYERS[player_id]["rot"])
            PLAYERS[player_id]["last"] = time.time()
            await self.channel_layer.group_send(
                "world",
                {
                    "type": "player.update",
                    "player": PLAYERS[player_id],
                },
            )

        if msg_type == "block_update":
            block = msg.get("block")
            if block:
                x, y, z, t = block.get("x"), block.get("y"), block.get("z"), block.get("t")
                player = PLAYERS.get(player_id)
                if t != BLOCK_AIR and not is_placeable(t):
                    return
                if self._valid_block(x, y, z, t) and within_reach(player, x, y, z):
                    if player and player["mode"] == 0:
                        if t == BLOCK_AIR:
                            existing = WORLD["blocks"].get((x, y, z))
                            if existing is None:
                                return
                            drop = spawn_drop(existing, x, y, z)
                            await self.channel_layer.group_send(
                                "world",
                                {"type": "drop.spawn", "drop": drop},
                            )
                        else:
                            if not inv_has(player["inv"], t, 1):
                                return
                            inv_take(player["inv"], t, 1)
                    if t == BLOCK_AIR:
                        if WORLD["blocks"].get((x, y, z)) == BLOCK_CHEST:
                            chest_key = f"{x},{y},{z}"
                            chest_data = CHESTS.pop(chest_key, None)
                            if chest_data:
                                for entry in chest_data:
                                    drop = spawn_drop(entry["t"], x, y, z)
                                    await self.channel_layer.group_send(
                                        "world",
                                        {"type": "drop.spawn", "drop": drop},
                                    )
                                save_chests(CHESTS)
                        WORLD["blocks"].pop((x, y, z), None)
                    else:
                        WORLD["blocks"][(x, y, z)] = t
                        if t == BLOCK_CHEST:
                            CHESTS[f"{x},{y},{z}"] = [None] * 27
                            save_chests(CHESTS)
                    await self.channel_layer.group_send(
                        "world",
                        {"type": "block.update", "block": block},
                    )
                    if player:
                        await self.send(
                            text_data=json.dumps(
                                {"type": "inventory", "inventory": player["inv"]}
                            )
                        )
                        persist_player(player)
                    save_world(WORLD["blocks"])

        if msg_type == "command":
            text = (msg.get("text") or "").strip()
            if text.startswith("/mod") or text.startswith("/mode"):
                parts = text.split()
                if len(parts) >= 2 and parts[1] in ["0", "1"]:
                    mode = int(parts[1])
                    PLAYERS[player_id]["mode"] = mode
                    await self.send(
                        text_data=json.dumps(
                            {"type": "mode", "mode": mode, "playerId": player_id}
                        )
                    )
                    await self.channel_layer.group_send(
                        "world",
                        {
                            "type": "player.update",
                            "player": PLAYERS[player_id],
                        },
                    )
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "chat",
                                "text": f"Mode changed to {'Creative' if mode == 1 else 'Survival'}",
                                "playerId": player_id,
                                "name": "SYSTEM",
                            }
                        )
                    )
                    await self.send(
                        text_data=json.dumps(
                            {"type": "inventory", "inventory": PLAYERS[player_id]["inv"]}
                        )
                    )
                    persist_player(PLAYERS[player_id])
            return

        if msg_type == "inv_update":
            player = PLAYERS.get(player_id)
            slots = msg.get("slots")
            if player and isinstance(slots, list):
                player["inv"] = normalize_inventory(slots)
                persist_player(player)
                await self.send(
                    text_data=json.dumps(
                        {"type": "inventory", "inventory": player["inv"]}
                    )
                )
            return

        if msg_type == "give":
            player = PLAYERS.get(player_id)
            block_type = msg.get("blockType")
            count = int(msg.get("count", 1))
            if player and player["mode"] == 1 and block_type is not None:
                add_item(player["inv"], int(block_type), count)
                await self.send(
                    text_data=json.dumps(
                        {"type": "inventory", "inventory": player["inv"]}
                    )
                )
                persist_player(player)
            return

        if msg_type == "pickup":
            drop_id = msg.get("dropId")
            player = PLAYERS.get(player_id)
            drop = DROPS.get(drop_id)
            if player and drop and within_reach(player, drop["x"], drop["y"], drop["z"]):
                DROPS.pop(drop_id, None)
                inv_add(player["inv"], drop["t"], 1)
                await self.channel_layer.group_send(
                    "world",
                    {"type": "drop.remove", "dropId": drop_id},
                )
                await self.send(
                    text_data=json.dumps(
                        {"type": "inventory", "inventory": player["inv"]}
                    )
                )
                persist_player(player)
            return

        if msg_type == "chest_open":
            player = PLAYERS.get(player_id)
            x, y, z = msg.get("x"), msg.get("y"), msg.get("z")
            if player and within_reach(player, x, y, z):
                if WORLD["blocks"].get((x, y, z)) == BLOCK_CHEST:
                    chest_id = f"{x},{y},{z}"
                    chest_items = CHESTS.get(chest_id, [None] * 27)
                    if len(chest_items) < 27:
                        chest_items += [None] * (27 - len(chest_items))
                        CHESTS[chest_id] = chest_items
                        save_chests(CHESTS)
                    await self.send(
                        text_data=json.dumps(
                            {"type": "chest_data", "chest": {"id": chest_id, "items": chest_items}}
                        )
                    )
            return

        if msg_type == "chest_take":
            player = PLAYERS.get(player_id)
            chest_id = msg.get("chestId")
            index = msg.get("index")
            if player and chest_id in CHESTS and index is not None:
                items = CHESTS[chest_id]
                if 0 <= index < len(items) and items[index]:
                    entry = items[index]
                    inv_add(player["inv"], entry["t"], entry["c"])
                    items[index] = None
                    CHESTS[chest_id] = items
                    save_chests(CHESTS)
                    await self.send(
                        text_data=json.dumps(
                            {"type": "inventory", "inventory": player["inv"]}
                        )
                    )
                    await self.send(
                        text_data=json.dumps(
                            {"type": "chest_data", "chest": {"id": chest_id, "items": items}}
                        )
                    )
                    persist_player(player)
            return

        if msg_type == "chest_put":
            player = PLAYERS.get(player_id)
            chest_id = msg.get("chestId")
            block_type = msg.get("blockType")
            count = msg.get("count", 1)
            if player and chest_id in CHESTS and block_type is not None:
                if not inv_has(player["inv"], block_type, count):
                    return
                items = CHESTS[chest_id]
                for i in range(27):
                    if i >= len(items):
                        items.append(None)
                    if items[i] is None:
                        items[i] = {"t": block_type, "c": count}
                        inv_take(player["inv"], block_type, count)
                        save_chests(CHESTS)
                        await self.send(
                            text_data=json.dumps(
                                {"type": "inventory", "inventory": player["inv"]}
                            )
                        )
                        await self.send(
                            text_data=json.dumps(
                                {"type": "chest_data", "chest": {"id": chest_id, "items": items}}
                            )
                        )
                        persist_player(player)
                        break
            return

        if msg_type == "craft":
            player = PLAYERS.get(player_id)
            if not player:
                return
            slots = msg.get("slots") or []
            recipe = recipe_from_slots(slots)
            if not recipe:
                return
            if player["mode"] == 0:
                for block_type, count in recipe["cost"].items():
                    if not inv_has(player["inv"], block_type, count):
                        return
                for block_type, count in recipe["cost"].items():
                    inv_take(player["inv"], block_type, count)
                inv_add(player["inv"], recipe["out"], recipe["count"])
            else:
                inv_add(player["inv"], recipe["out"], recipe["count"])
            await self.send(
                text_data=json.dumps(
                    {"type": "inventory", "inventory": player["inv"], "crafted": recipe}
                )
            )
            persist_player(player)
            return

        if msg_type == "chat":
            text = (msg.get("text") or "")[:200]
            if text:
                player = PLAYERS.get(player_id)
                await self.channel_layer.group_send(
                    "world",
                    {
                        "type": "chat.message",
                        "text": text,
                        "playerId": player_id,
                        "name": player["name"] if player else "Player",
                    },
                )

    async def player_join(self, event):
        await self.send(text_data=json.dumps({"type": "player_join", "player": event["player"]}))

    async def player_leave(self, event):
        await self.send(
            text_data=json.dumps(
                {"type": "player_leave", "playerId": event["playerId"]}
            )
        )

    async def player_update(self, event):
        await self.send(text_data=json.dumps({"type": "player_update", "player": event["player"]}))

    async def block_update(self, event):
        await self.send(text_data=json.dumps({"type": "block_update", "block": event["block"]}))

    async def drop_spawn(self, event):
        await self.send(text_data=json.dumps({"type": "drop_spawn", "drop": event["drop"]}))

    async def drop_remove(self, event):
        await self.send(text_data=json.dumps({"type": "drop_remove", "dropId": event["dropId"]}))

    async def chat_message(self, event):
        await self.send(
            text_data=json.dumps(
                {
                    "type": "chat",
                    "text": event["text"],
                    "playerId": event["playerId"],
                    "name": event["name"],
                }
            )
        )

    def _valid_block(self, x, y, z, t):
        if x is None or y is None or z is None or t is None:
            return False
        if not (0 <= x < WORLD_SIZE["x"] and 0 <= y < WORLD_SIZE["y"] and 0 <= z < WORLD_SIZE["z"]):
            return False
        if t not in [
            BLOCK_AIR,
            BLOCK_GRASS,
            BLOCK_DIRT,
            BLOCK_STONE,
            BLOCK_WOOD,
            BLOCK_LEAVES,
            BLOCK_SAND,
            BLOCK_BRICK,
            BLOCK_PLANK,
            BLOCK_COBBLE,
            BLOCK_CHEST,
        ]:
            return False
        return True

    def _get_player_id(self):
        return getattr(self, "player_id", None)
