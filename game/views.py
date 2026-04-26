import json

from django.conf import settings
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render


def index(request):
    return render(request, "index.html")


def tools_portal(request):
    return render(request, "tools/portal.html")


def server_monitor(request):
    return render(request, "tools/monitor.html")


def live_map(request):
    return render(request, "tools/live_map.html")


def schematic_editor(request):
    return render(request, "tools/schematic_editor.html")


def admin_panel(request):
    return render(request, "tools/panel.html")


def tutorial(request):
    return render(request, "tools/tutorial.html")


def wiki(request):
    return render(request, "tools/wiki.html")


def clone_game(request):
    return render(request, "tools/clone.html")


def api_status(request):
    # Best-effort: the game server state lives in the websocket consumer module.
    try:
        from game import consumers

        players = list(consumers.PLAYERS.values())
        world = consumers.WORLD
        npc_count = len(consumers.NPCS)
        seed = consumers.WORLD_SEED
        world_size = consumers.WORLD_SIZE
    except Exception:
        players = []
        npc_count = 0
        seed = None
        world_size = None

    return JsonResponse(
        {
            "ok": True,
            "players": [{"id": p.get("id"), "name": p.get("name"), "pos": p.get("pos")} for p in players],
            "playerCount": len(players),
            "npcCount": npc_count,
            "seed": seed,
            "worldSize": world_size,
        }
    )


def api_chat(request):
    try:
        from game import consumers

        messages = list(getattr(consumers, "CHAT_LOG", []))[-50:]
    except Exception:
        messages = []
    return JsonResponse({"ok": True, "messages": messages})


def _require_panel_token(request) -> bool:
    token = request.headers.get("X-Panel-Token") or request.GET.get("token") or ""
    return token == getattr(settings, "PANEL_TOKEN", "dev")


def api_panel_broadcast(request):
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)
    if not _require_panel_token(request):
        return JsonResponse({"ok": False, "error": "bad token"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        payload = {}
    text = (payload.get("text") or "")[:200]
    name = (payload.get("name") or "ADMIN")[:24]
    if not text:
        return JsonResponse({"ok": False, "error": "empty text"}, status=400)

    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        async_to_sync(layer.group_send)(
            "world",
            {"type": "chat.message", "text": text, "playerId": "admin", "name": name},
        )
    except Exception:
        return JsonResponse({"ok": False, "error": "broadcast failed"}, status=500)

    return JsonResponse({"ok": True})


def api_panel_give(request):
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)
    if not _require_panel_token(request):
        return JsonResponse({"ok": False, "error": "bad token"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        payload = {}

    player_id = payload.get("playerId")
    block_type = payload.get("blockType")
    count = payload.get("count", 1)

    try:
        block_type = int(block_type)
        count = max(1, min(64, int(count)))
    except Exception:
        return JsonResponse({"ok": False, "error": "bad args"}, status=400)

    try:
        from game import consumers

        player = consumers.PLAYERS.get(player_id)
        if not player:
            return JsonResponse({"ok": False, "error": "player not found"}, status=404)
        consumers.add_item(player["inv"], block_type, count)
        consumers.persist_player(player)
    except Exception:
        return JsonResponse({"ok": False, "error": "give failed"}, status=500)

    return JsonResponse({"ok": True})


def api_panel_time(request):
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)
    if not _require_panel_token(request):
        return JsonResponse({"ok": False, "error": "bad token"}, status=403)
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        payload = {}

    speed = payload.get("speedMultiplier")
    progress = payload.get("progress")
    try:
        speed = float(speed) if speed is not None else None
        progress = float(progress) if progress is not None else None
    except Exception:
        return JsonResponse({"ok": False, "error": "bad args"}, status=400)

    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer

        layer = get_channel_layer()
        async_to_sync(layer.group_send)(
            "world",
            {"type": "server.event", "event": "time", "speedMultiplier": speed, "progress": progress},
        )
    except Exception:
        return JsonResponse({"ok": False, "error": "send failed"}, status=500)

    return JsonResponse({"ok": True})


def api_schematic_export(request):
    if request.method != "POST":
        return JsonResponse({"ok": False, "error": "POST required"}, status=405)
    # Export is safe without token, but keep payload size small.
    try:
        payload = json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return JsonResponse({"ok": False, "error": "bad json"}, status=400)

    name = (payload.get("name") or "build")[:40]
    width = int(payload.get("width") or 1)
    height = int(payload.get("height") or 1)
    length = int(payload.get("length") or 1)
    blocks = payload.get("blocks") or []

    # Minimal block ID mapping (classic numeric IDs for .schematic Alpha).
    palette = {
        "air": 0,
        "stone": 1,
        "grass": 2,
        "dirt": 3,
        "cobble": 4,
        "planks": 5,
        "wood": 17,
        "sand": 12,
        "brick": 45,
        "glass": 20,
        "torch": 50,
        "water": 9,
    }

    try:
        ids = []
        for v in blocks:
            if isinstance(v, int):
                ids.append(max(0, min(255, v)))
            else:
                ids.append(palette.get(str(v).lower(), 0))

        from game.nbt_schematic import Schematic, build_schematic_nbt, encode_blocks_linear

        block_bytes = encode_blocks_linear(width, height, length, ids)
        data_bytes = bytes([0]) * (width * height * length)
        nbt = build_schematic_nbt(Schematic(width=width, height=height, length=length, blocks=block_bytes, data=data_bytes))
    except Exception as e:
        return JsonResponse({"ok": False, "error": f"export failed: {e}"}, status=400)

    resp = HttpResponse(nbt, content_type="application/octet-stream")
    resp["Content-Disposition"] = f'attachment; filename="{name}.schematic"'
    return resp
