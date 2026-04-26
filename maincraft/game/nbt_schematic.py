from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable


def _nbt_write_tag_id(tag_type: int) -> bytes:
    return bytes([tag_type])


def _nbt_write_u16(value: int) -> bytes:
    return int(value).to_bytes(2, "big", signed=False)


def _nbt_write_i16(value: int) -> bytes:
    return int(value).to_bytes(2, "big", signed=True)


def _nbt_write_i32(value: int) -> bytes:
    return int(value).to_bytes(4, "big", signed=True)


def _nbt_write_i8(value: int) -> bytes:
    return int(value).to_bytes(1, "big", signed=True)


def _nbt_write_string(value: str) -> bytes:
    b = value.encode("utf-8")
    return _nbt_write_u16(len(b)) + b


def _nbt_named(tag_type: int, name: str, payload: bytes) -> bytes:
    return _nbt_write_tag_id(tag_type) + _nbt_write_string(name) + payload


def _nbt_byte_array(data: bytes) -> bytes:
    return _nbt_write_i32(len(data)) + data


def _nbt_short(value: int) -> bytes:
    return _nbt_write_i16(value)


def _nbt_string(value: str) -> bytes:
    return _nbt_write_string(value)


TAG_End = 0
TAG_Byte = 1
TAG_Short = 2
TAG_Int = 3
TAG_Byte_Array = 7
TAG_String = 8
TAG_Compound = 10


@dataclass(frozen=True)
class Schematic:
    width: int
    height: int
    length: int
    blocks: bytes
    data: bytes
    materials: str = "Alpha"


def build_schematic_nbt(s: Schematic) -> bytes:
    if s.width <= 0 or s.height <= 0 or s.length <= 0:
        raise ValueError("Invalid schematic dimensions")
    total = s.width * s.height * s.length
    if len(s.blocks) != total or len(s.data) != total:
        raise ValueError("Blocks/Data size mismatch")

    payload = b"".join(
        [
            _nbt_named(TAG_Short, "Width", _nbt_short(s.width)),
            _nbt_named(TAG_Short, "Height", _nbt_short(s.height)),
            _nbt_named(TAG_Short, "Length", _nbt_short(s.length)),
            _nbt_named(TAG_String, "Materials", _nbt_string(s.materials)),
            _nbt_named(TAG_Byte_Array, "Blocks", _nbt_byte_array(s.blocks)),
            _nbt_named(TAG_Byte_Array, "Data", _nbt_byte_array(s.data)),
            _nbt_write_tag_id(TAG_End),
        ]
    )
    # Root compound named "Schematic"
    return _nbt_write_tag_id(TAG_Compound) + _nbt_write_string("Schematic") + payload


def encode_blocks_linear(width: int, height: int, length: int, ids: Iterable[int]) -> bytes:
    total = width * height * length
    out = bytearray(total)
    i = 0
    for v in ids:
        if i >= total:
            break
        out[i] = int(v) & 0xFF
        i += 1
    if i != total:
        raise ValueError("Not enough block ids provided")
    return bytes(out)

