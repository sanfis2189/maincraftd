import json
import random
import time
from pathlib import Path
from uuid import uuid4

from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

WORLD_SIZE = {"x": 1064, "y": 132, "z": 1064}
WORLD_MIN_Y = -100
WORLD_MAX_Y = 31
WORLD_SEED = random.randint(1, 2_000_000_000)

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
BLOCK_COAL_ORE = 11
BLOCK_IRON_ORE = 12
BLOCK_GOLD_ORE = 13
BLOCK_DIAMOND_ORE = 14
BLOCK_BEDROCK = 15
ITEM_STICK = 100
ITEM_TORCH = 101

WORLD = {
    "blocks": {},
    "generated_columns": set(),
    "last_broadcast": 0,
}
PLAYERS = {}
REACH_DISTANCE = 5.0
CHUNK_SIZE = 16
VIEW_CHUNK_DIAMETER = 3
VIEW_CHUNK_RADIUS = VIEW_CHUNK_DIAMETER // 2
MIN_VIEW_CHUNK_DIAMETER = 3
MAX_VIEW_CHUNK_DIAMETER = 9
MINE_MAX_DEPTH = 50
WORLD_BORDER_PADDING = 96
PLAYER_PATH = Path(settings.BASE_DIR) / "data" / "players.json"
CHEST_PATH = Path(settings.BASE_DIR) / "data" / "chests.json"
DROPS = {}
CHESTS = {}
PLAYER_STORE = {}


def rand2(x, z):
    h = (x * 73856093) ^ (z * 19349663) ^ (WORLD_SEED * 83492791)
    h = h & 0xFFFFFFFF
    return h / 0xFFFFFFFF


def rand3(x, y, z):
    h = (x * 73856093) ^ (y * 83492791) ^ (z * 19349663) ^ (WORLD_SEED * 2654435761)
    h = h & 0xFFFFFFFF
    return h / 0xFFFFFFFF


def height_at(x, z):
    n1 = rand2(x // 4, z // 4)
    n2 = rand2(x // 12 + 11, z // 12 - 7)
    n3 = rand2(x // 24 - 17, z // 24 + 5)
    base = 6
    hills = int(n1 * 8 + n2 * 9 + n3 * 7)
    return min(WORLD_MAX_Y - 2, base + hills // 3)


def top_block_at(x, z, height):
    biome = rand2(x // 18, z // 18)
    if biome < 0.26 or height <= 4:
        return BLOCK_SAND
    return BLOCK_GRASS


def carve_cave(x, y, z):
    if y > 8:
        return False
    noise = rand3(x // 3, y // 2, z // 3)
    tunnels = rand3((x + 83) // 6, (y - 23) // 4, (z - 47) // 6)
    return noise > 0.985 or tunnels > 0.991


def mineshaft_data_at(x, z):
    cell_size = 48
    cell_x = x // cell_size
    cell_z = z // cell_size
    chance = rand2(cell_x * 13 + 7, cell_z * 17 + 5)
    if chance < 0.8:
        return None
    sx = cell_x * cell_size + 6 + int(rand2(cell_x * 31 + 19, cell_z * 29 + 17) * 35)
    sz = cell_z * cell_size + 6 + int(rand2(cell_x * 41 + 23, cell_z * 37 + 29) * 35)
    return {
        "x": min(WORLD_SIZE["x"] - 2, max(1, sx)),
        "z": min(WORLD_SIZE["z"] - 2, max(1, sz)),
    }


def carve_mineshaft(x, y, z, surface):
    shaft = mineshaft_data_at(x, z)
    if not shaft:
        return False

    dx = abs(x - shaft["x"])
    dz = abs(z - shaft["z"])

    min_mine_y = max(WORLD_MIN_Y + 1, surface - MINE_MAX_DEPTH)
    if dx <= 1 and dz <= 1 and min_mine_y <= y <= surface - 2:
        return True

    if y > surface - 4 or y < min_mine_y + 2:
        return False

    depth = surface - y
    if depth < 8 or depth > MINE_MAX_DEPTH:
        return False

    # horizontal drifts every 12 blocks downward
    if depth % 12 in (0, 1):
        if dx <= 8 and dz <= 1:
            return True
        if dz <= 8 and dx <= 1:
            return True

    return False


def ore_for(x, y, z):
    # Vein-like generation: coarse noise controls cluster zones, fine noise fills blocks inside zones.
    vein = rand3(x // 4 + 17, y // 4 - 11, z // 4 + 29)
    fine = rand3(x + 31, y - 13, z + 47)
    if y <= -70 and vein > 0.905 and fine > 0.48:
        return BLOCK_DIAMOND_ORE
    if y <= -45 and vein > 0.885 and fine > 0.46:
        return BLOCK_GOLD_ORE
    if y <= -20 and vein > 0.865 and fine > 0.43:
        return BLOCK_IRON_ORE
    if vein > 0.84 and fine > 0.4:
        return BLOCK_COAL_ORE
    return BLOCK_STONE


def village_data_for_cell(cell_x, cell_z):
    chance = rand2(cell_x * 67 + 11, cell_z * 71 + 13)
    if chance < 0.86:
        return None
    cell_size = 128
    cx = cell_x * cell_size + 24 + int(rand2(cell_x * 73 + 5, cell_z * 79 + 7) * 80)
    cz = cell_z * cell_size + 24 + int(rand2(cell_x * 83 + 9, cell_z * 89 + 3) * 80)
    if not (12 <= cx < WORLD_SIZE["x"] - 12 and 12 <= cz < WORLD_SIZE["z"] - 12):
        return None
    gy = height_at(cx, cz)
    return {"cx": cx, "cz": cz, "gy": gy}


def villages_for_column(x, z):
    cell_size = 128
    base_cell_x = x // cell_size
    base_cell_z = z // cell_size
    villages = []
    for cx in range(base_cell_x - 1, base_cell_x + 2):
        for cz in range(base_cell_z - 1, base_cell_z + 2):
            village = village_data_for_cell(cx, cz)
            if village:
                villages.append(village)
    return villages


def set_block(blocks, x, y, z, t, fresh):
    if not (0 <= x < WORLD_SIZE["x"] and 0 <= z < WORLD_SIZE["z"] and WORLD_MIN_Y <= y <= WORLD_MAX_Y):
        return
    key = (x, y, z)
    old = blocks.get(key)
    if t == BLOCK_AIR:
        if old is not None:
            blocks.pop(key, None)
            fresh.append({"x": x, "y": y, "z": z, "t": BLOCK_AIR})
        return
    if old != t:
        blocks[key] = t
        fresh.append({"x": x, "y": y, "z": z, "t": t})


def place_house_column(blocks, x, z, gy, ox, oz, sx, sz, fresh):
    hx0 = ox
    hz0 = oz
    hx1 = ox + sx - 1
    hz1 = oz + sz - 1
    if not (hx0 <= x <= hx1 and hz0 <= z <= hz1):
        return

    floor_y = gy + 1
    roof_y = floor_y + 4
    wall_top = floor_y + 3
    mid_x = (hx0 + hx1) // 2

    # clear interior and prep floor
    for y in range(floor_y, roof_y + 1):
        set_block(blocks, x, y, z, BLOCK_AIR, fresh)
    set_block(blocks, x, floor_y, z, BLOCK_PLANK, fresh)

    on_border = x in (hx0, hx1) or z in (hz0, hz1)
    is_door = x == mid_x and z == hz0 and floor_y + 1 <= floor_y + 2

    if on_border:
        for y in range(floor_y + 1, wall_top + 1):
            set_block(blocks, x, y, z, BLOCK_PLANK, fresh)

    # doorway
    if x == mid_x and z == hz0:
        set_block(blocks, x, floor_y + 1, z, BLOCK_AIR, fresh)
        set_block(blocks, x, floor_y + 2, z, BLOCK_AIR, fresh)

    # roof and corners
    set_block(blocks, x, roof_y, z, BLOCK_WOOD, fresh)
    if x in (hx0, hx1) and z in (hz0, hz1):
        set_block(blocks, x, wall_top, z, BLOCK_WOOD, fresh)


def apply_village_column(blocks, x, z, fresh):
    for village in villages_for_column(x, z):
        lx = x - village["cx"]
        lz = z - village["cz"]
        if abs(lx) > 20 or abs(lz) > 20:
            continue

        gy = village["gy"]
        road = abs(lx) <= 1 or abs(lz) <= 1

        # clean air space above the village platform
        for y in range(gy + 1, gy + 8):
            set_block(blocks, x, y, z, BLOCK_AIR, fresh)

        if road:
            set_block(blocks, x, gy, z, BLOCK_COBBLE, fresh)
        else:
            set_block(blocks, x, gy, z, BLOCK_GRASS, fresh)

        # A few simple houses around the cross-road
        house_defs = [
            (-14, -10, 6, 6),
            (8, -10, 7, 6),
            (-4, 8, 8, 6),
        ]
        for ox, oz, sx, sz in house_defs:
            place_house_column(
                blocks,
                x,
                z,
                gy,
                village["cx"] + ox,
                village["cz"] + oz,
                sx,
                sz,
                fresh,
            )

        # central village chest
        if x == village["cx"] and z == village["cz"] + 2:
            set_block(blocks, x, gy + 1, z, BLOCK_CHEST, fresh)
            chest_key = f"{x},{gy + 1},{z}"
            if chest_key not in CHESTS:
                CHESTS[chest_key] = [
                    {"t": BLOCK_COAL_ORE, "c": 8},
                    {"t": BLOCK_IRON_ORE, "c": 5},
                    {"t": BLOCK_PLANK, "c": 12},
                ] + [None] * 24
                save_chests(CHESTS)


def add_tree(blocks, x, y, z, fresh):
    trunk_height = 4
    for i in range(trunk_height):
        ty = y + i
        if ty > WORLD_MAX_Y:
            return
        set_block(blocks, x, ty, z, BLOCK_WOOD, fresh)
    for dx in range(-2, 3):
        for dz in range(-2, 3):
            for dy in range(2):
                nx, ny, nz = x + dx, y + trunk_height - 1 + dy, z + dz
                if 0 <= nx < WORLD_SIZE["x"] and 0 <= nz < WORLD_SIZE["z"] and ny <= WORLD_MAX_Y:
                    if abs(dx) + abs(dz) < 4:
                        set_block(blocks, nx, ny, nz, BLOCK_LEAVES, fresh)


def generate_column(blocks, x, z):
    fresh = []
    surface = height_at(x, z)

    for y in range(WORLD_MIN_Y, surface + 1):
        if carve_cave(x, y, z) or carve_mineshaft(x, y, z, surface):
            continue

        if y == WORLD_MIN_Y:
            block = BLOCK_BEDROCK
        elif y == surface:
            block = top_block_at(x, z, surface)
        elif y >= surface - 3:
            block = BLOCK_DIRT
        else:
            block = ore_for(x, y, z)

        set_block(blocks, x, y, z, block, fresh)

    # trees only on natural grass/sand and away from village center roads
    village_near = any(abs(x - v["cx"]) <= 22 and abs(z - v["cz"]) <= 22 for v in villages_for_column(x, z))
    if not village_near and surface + 6 <= WORLD_MAX_Y and top_block_at(x, z, surface) == BLOCK_GRASS and rand2(x, z) > 0.93:
        add_tree(blocks, x, surface + 1, z, fresh)

    apply_village_column(blocks, x, z, fresh)
    return fresh


def chunk_index(coord):
    return int(coord) // CHUNK_SIZE


def normalize_view_chunk_diameter(value):
    try:
        v = int(value)
    except (TypeError, ValueError):
        v = VIEW_CHUNK_DIAMETER
    v = max(MIN_VIEW_CHUNK_DIAMETER, min(MAX_VIEW_CHUNK_DIAMETER, v))
    if v % 2 == 0:
        v = min(MAX_VIEW_CHUNK_DIAMETER, v + 1)
    return v


def world_border():
    min_x = WORLD_BORDER_PADDING
    max_x = WORLD_SIZE["x"] - 1 - WORLD_BORDER_PADDING
    min_z = WORLD_BORDER_PADDING
    max_z = WORLD_SIZE["z"] - 1 - WORLD_BORDER_PADDING
    return min_x, max_x, min_z, max_z


def within_play_area(x, z):
    min_x, max_x, min_z, max_z = world_border()
    return min_x <= x <= max_x and min_z <= z <= max_z


def clamp_pos_to_play_area(pos):
    min_x, max_x, min_z, max_z = world_border()
    return {
        "x": max(min_x + 0.5, min(max_x + 0.5, pos["x"])),
        "y": pos["y"],
        "z": max(min_z + 0.5, min(max_z + 0.5, pos["z"])),
    }


def chunk_bounds(chunk_x, chunk_z):
    x0 = chunk_x * CHUNK_SIZE
    z0 = chunk_z * CHUNK_SIZE
    x1 = min(WORLD_SIZE["x"] - 1, x0 + CHUNK_SIZE - 1)
    z1 = min(WORLD_SIZE["z"] - 1, z0 + CHUNK_SIZE - 1)
    return x0, x1, z0, z1


def chunk_distance_sq(cx, cz, tx, tz):
    dx = cx - tx
    dz = cz - tz
    return dx * dx + dz * dz


def chunk_coords_in_radius(center_chunk_x, center_chunk_z, radius):
    max_chunk_x = (WORLD_SIZE["x"] - 1) // CHUNK_SIZE
    max_chunk_z = (WORLD_SIZE["z"] - 1) // CHUNK_SIZE
    chunks = set()
    min_cx = max(0, center_chunk_x - radius)
    max_cx = min(max_chunk_x, center_chunk_x + radius)
    min_cz = max(0, center_chunk_z - radius)
    max_cz = min(max_chunk_z, center_chunk_z + radius)
    for cx in range(min_cx, max_cx + 1):
        for cz in range(min_cz, max_cz + 1):
            chunks.add((cx, cz))
    return chunks


def ensure_chunk_generated(chunk_x, chunk_z):
    x0, x1, z0, z1 = chunk_bounds(chunk_x, chunk_z)
    for x in range(x0, x1 + 1):
        for z in range(z0, z1 + 1):
            col_key = (x, z)
            if col_key in WORLD["generated_columns"]:
                continue
            generate_column(WORLD["blocks"], x, z)
            WORLD["generated_columns"].add(col_key)


def ensure_chunks_generated(chunks):
    for chunk_x, chunk_z in chunks:
        ensure_chunk_generated(chunk_x, chunk_z)


def blocks_for_chunks(chunks):
    data = []
    for chunk_x, chunk_z in chunks:
        x0, x1, z0, z1 = chunk_bounds(chunk_x, chunk_z)
        for x in range(x0, x1 + 1):
            for z in range(z0, z1 + 1):
                for y in range(WORLD_MIN_Y, WORLD_MAX_Y + 1):
                    t = WORLD["blocks"].get((x, y, z))
                    if t is not None:
                        data.append({"x": x, "y": y, "z": z, "t": t})
    return data


def serialize_blocks(blocks):
    return [{"x": x, "y": y, "z": z, "t": t} for (x, y, z), t in blocks.items()]


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
    async def _stream_chunks(self, center_chunk_x, center_chunk_z, chunks, batch_size=2):
        if not chunks:
            return
        ordered = sorted(
            chunks,
            key=lambda c: chunk_distance_sq(center_chunk_x, center_chunk_z, c[0], c[1]),
        )
        for i in range(0, len(ordered), batch_size):
            batch = ordered[i : i + batch_size]
            ensure_chunks_generated(batch)
            blocks = blocks_for_chunks(batch)
            if blocks:
                await self.send(
                    text_data=json.dumps(
                        {
                            "type": "chunk_data",
                            "blocks": blocks,
                            "chunks": [{"x": cx, "z": cz} for cx, cz in batch],
                        }
                    )
                )

    async def connect(self):
        await self.channel_layer.group_add("world", self.channel_name)
        await self.accept()
        self.view_chunk_diameter = normalize_view_chunk_diameter(VIEW_CHUNK_DIAMETER)
        self.view_chunk_radius = self.view_chunk_diameter // 2

        spawn_x = WORLD_SIZE["x"] // 2
        spawn_z = WORLD_SIZE["z"] // 2
        spawn_chunk_x = chunk_index(spawn_x)
        spawn_chunk_z = chunk_index(spawn_z)
        target_chunks = chunk_coords_in_radius(spawn_chunk_x, spawn_chunk_z, self.view_chunk_radius)
        center_chunk = {(spawn_chunk_x, spawn_chunk_z)}
        ensure_chunks_generated(center_chunk)
        self.sent_chunks = set(center_chunk)
        init_blocks = blocks_for_chunks(center_chunk)

        self.player_id = str(uuid4())
        spawn_y = height_at(spawn_x, spawn_z) + 3
        PLAYERS[self.player_id] = {
            "id": self.player_id,
            "name": f"Player-{self.player_id[:4]}",
            "pos": {"x": spawn_x + 0.5, "y": spawn_y, "z": spawn_z + 0.5},
            "rot": {"x": 0, "y": 0},
            "mode": 1,
            "inv": normalize_inventory({"1": 10, "2": 10, "4": 5}),
            "clientId": None,
            "last": time.time(),
        }
        self.last_stream_chunk = (spawn_chunk_x, spawn_chunk_z)

        await self.send(
            text_data=json.dumps(
                {
                    "type": "init",
                    "playerId": self.player_id,
                    "world": init_blocks,
                    "chunks": [{"x": cx, "z": cz} for cx, cz in center_chunk],
                    "worldSize": {
                        **WORLD_SIZE,
                        "minY": WORLD_MIN_Y,
                        "maxY": WORLD_MAX_Y,
                        "seed": WORLD_SEED,
                        "chunkSize": CHUNK_SIZE,
                        "visibleChunks": self.view_chunk_diameter,
                        "minVisibleChunks": MIN_VIEW_CHUNK_DIAMETER,
                        "maxVisibleChunks": MAX_VIEW_CHUNK_DIAMETER,
                        "borderMinX": world_border()[0],
                        "borderMaxX": world_border()[1],
                        "borderMinZ": world_border()[2],
                        "borderMaxZ": world_border()[3],
                    },
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
        remaining = target_chunks - center_chunk
        await self._stream_chunks(spawn_chunk_x, spawn_chunk_z, remaining)
        self.sent_chunks = target_chunks

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
            next_pos = msg.get("pos", PLAYERS[player_id]["pos"])
            if isinstance(next_pos, dict):
                next_pos = clamp_pos_to_play_area(next_pos)
            PLAYERS[player_id]["pos"] = next_pos
            PLAYERS[player_id]["rot"] = msg.get("rot", PLAYERS[player_id]["rot"])
            PLAYERS[player_id]["last"] = time.time()

            pos = PLAYERS[player_id]["pos"]
            center_chunk_x = chunk_index(pos["x"])
            center_chunk_z = chunk_index(pos["z"])
            if getattr(self, "last_stream_chunk", None) != (center_chunk_x, center_chunk_z):
                target_chunks = chunk_coords_in_radius(center_chunk_x, center_chunk_z, self.view_chunk_radius)
                ensure_chunks_generated(target_chunks)

                sent_chunks = getattr(self, "sent_chunks", set())
                unsent = target_chunks - sent_chunks
                await self._stream_chunks(center_chunk_x, center_chunk_z, unsent)

                to_unload = sent_chunks - target_chunks
                if to_unload:
                    await self.send(
                        text_data=json.dumps(
                            {
                                "type": "chunk_unload",
                                "chunks": [{"x": cx, "z": cz} for cx, cz in to_unload],
                            }
                        )
                    )

                self.sent_chunks = target_chunks
                self.last_stream_chunk = (center_chunk_x, center_chunk_z)
            await self.channel_layer.group_send(
                "world",
                {
                    "type": "player.update",
                    "player": PLAYERS[player_id],
                },
            )
            return

        if msg_type == "settings_update":
            requested = msg.get("visibleChunks")
            new_diameter = normalize_view_chunk_diameter(requested)
            if new_diameter != self.view_chunk_diameter:
                self.view_chunk_diameter = new_diameter
                self.view_chunk_radius = new_diameter // 2
                player = PLAYERS.get(player_id)
                if player:
                    pos = player["pos"]
                    center_chunk_x = chunk_index(pos["x"])
                    center_chunk_z = chunk_index(pos["z"])
                    target_chunks = chunk_coords_in_radius(center_chunk_x, center_chunk_z, self.view_chunk_radius)
                    ensure_chunks_generated(target_chunks)

                    sent_chunks = getattr(self, "sent_chunks", set())
                    unsent = target_chunks - sent_chunks
                    await self._stream_chunks(center_chunk_x, center_chunk_z, unsent)

                    to_unload = sent_chunks - target_chunks
                    if to_unload:
                        await self.send(
                            text_data=json.dumps(
                                {
                                    "type": "chunk_unload",
                                    "chunks": [{"x": cx, "z": cz} for cx, cz in to_unload],
                                }
                            )
                        )

                    self.sent_chunks = target_chunks
                    self.last_stream_chunk = (center_chunk_x, center_chunk_z)

            await self.send(
                text_data=json.dumps(
                    {
                        "type": "settings_applied",
                        "visibleChunks": self.view_chunk_diameter,
                        "minVisibleChunks": MIN_VIEW_CHUNK_DIAMETER,
                        "maxVisibleChunks": MAX_VIEW_CHUNK_DIAMETER,
                        "borderMinX": world_border()[0],
                        "borderMaxX": world_border()[1],
                        "borderMinZ": world_border()[2],
                        "borderMaxZ": world_border()[3],
                    }
                )
            )
            return

        if msg_type == "block_update":
            block = msg.get("block")
            if block:
                x, y, z, t = block.get("x"), block.get("y"), block.get("z"), block.get("t")
                player = PLAYERS.get(player_id)
                if t != BLOCK_AIR and not is_placeable(t):
                    return

                if x is not None and z is not None:
                    if not within_play_area(x, z):
                        return
                    ensure_chunks_generated({(chunk_index(x), chunk_index(z))})

                if self._valid_block(x, y, z, t) and within_reach(player, x, y, z):
                    if player and player["mode"] == 0:
                        if t == BLOCK_AIR:
                            existing = WORLD["blocks"].get((x, y, z))
                            if existing is None:
                                return
                            if existing == BLOCK_BEDROCK:
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
                                    if entry:
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
        if not (0 <= x < WORLD_SIZE["x"] and WORLD_MIN_Y <= y <= WORLD_MAX_Y and 0 <= z < WORLD_SIZE["z"]):
            return False
        if not within_play_area(x, z):
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
            BLOCK_COAL_ORE,
            BLOCK_IRON_ORE,
            BLOCK_GOLD_ORE,
            BLOCK_DIAMOND_ORE,
            BLOCK_BEDROCK,
        ]:
            return False
        return True

    def _get_player_id(self):
        return getattr(self, "player_id", None)
