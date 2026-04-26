// Web Worker: builds greedy-meshed chunk geometry + simple lightmap.

const AIR = 0;
const WATER = 16;
const TORCH = 17;

const BLOCK_COLORS = {
  1: [124, 195, 106], // grass
  2: [139, 90, 43], // dirt
  3: [156, 163, 175], // stone
  4: [183, 121, 74], // wood
  5: [76, 175, 80], // leaves
  6: [217, 194, 133], // sand
  7: [181, 82, 59], // brick
  8: [211, 164, 113], // plank
  9: [123, 127, 134], // cobble
  10: [154, 107, 58], // chest
  11: [79, 89, 104], // coal ore
  12: [187, 138, 103], // iron ore
  13: [215, 181, 74], // gold ore
  14: [95, 213, 208], // diamond ore
  15: [63, 67, 73], // bedrock
  16: [59, 130, 246], // water
  17: [242, 201, 76], // torch block
};

function colorFor(t) {
  return BLOCK_COLORS[t] || [220, 220, 220];
}

function isOpaque(t) {
  return t !== AIR && t !== WATER && t !== TORCH && t !== 5; // leaves treated as translucent
}

function blocksLight(t) {
  return isOpaque(t);
}

function idx(x, y, z, cs, h) {
  return x + z * cs + y * cs * cs;
}

function computeLight(vox, cs, h) {
  const light = new Uint8Array(cs * cs * h);

  // Sunlight: top-down columns, 15 until blocked, then 0.
  for (let z = 0; z < cs; z += 1) {
    for (let x = 0; x < cs; x += 1) {
      let sun = 15;
      for (let y = h - 1; y >= 0; y -= 1) {
        const t = vox[idx(x, y, z, cs, h)];
        if (sun > 0 && !blocksLight(t)) {
          light[idx(x, y, z, cs, h)] = sun;
        } else {
          sun = 0;
        }
        if (blocksLight(t)) sun = 0;
      }
    }
  }

  // Torch light BFS (limited).
  const qx = [];
  const qy = [];
  const qz = [];
  const ql = [];
  for (let z = 0; z < cs; z += 1) {
    for (let x = 0; x < cs; x += 1) {
      for (let y = 0; y < h; y += 1) {
        const t = vox[idx(x, y, z, cs, h)];
        if (t === TORCH) {
          const i = idx(x, y, z, cs, h);
          const lv = 14;
          if (lv > light[i]) light[i] = lv;
          qx.push(x); qy.push(y); qz.push(z); ql.push(lv);
        }
      }
    }
  }

  let qi = 0;
  while (qi < qx.length) {
    const x = qx[qi];
    const y = qy[qi];
    const z = qz[qi];
    const lv = ql[qi];
    qi += 1;
    const nlv = lv - 1;
    if (nlv <= 0) continue;
    const nbrs = [
      [x + 1, y, z],
      [x - 1, y, z],
      [x, y + 1, z],
      [x, y - 1, z],
      [x, y, z + 1],
      [x, y, z - 1],
    ];
    for (const [nx, ny, nz] of nbrs) {
      if (nx < 0 || nz < 0 || ny < 0 || nx >= cs || nz >= cs || ny >= h) continue;
      const ti = idx(nx, ny, nz, cs, h);
      const t = vox[ti];
      if (blocksLight(t)) continue;
      if (nlv > light[ti]) {
        light[ti] = nlv;
        qx.push(nx); qy.push(ny); qz.push(nz); ql.push(nlv);
      }
    }
  }

  return light;
}

function pushQuad(out, x0, y0, z0, x1, y1, z1, normal, rgb, shade) {
  // 4 vertices in order, 2 triangles
  const base = out.pos.length / 3;
  let verts;
  // Axis-aware quad construction. Vertical faces (X/Z normals) can use the generic diagonal form,
  // but horizontal faces (Y normals) must expand in XZ to avoid degenerate triangles.
  if (normal[1] !== 0) {
    const y = y0;
    if (normal[1] > 0) {
      // +Y (top): CCW when looking from above.
      verts = [
        [x0, y, z0],
        [x1, y, z0],
        [x1, y, z1],
        [x0, y, z1],
      ];
    } else {
      // -Y (bottom): reverse winding.
      verts = [
        [x0, y, z0],
        [x0, y, z1],
        [x1, y, z1],
        [x1, y, z0],
      ];
    }
  } else {
    verts = [
      [x0, y0, z0],
      [x1, y0, z1],
      [x1, y1, z1],
      [x0, y1, z0],
    ];
  }
  for (const v of verts) {
    out.pos.push(v[0], v[1], v[2]);
    out.nrm.push(normal[0], normal[1], normal[2]);
    out.col.push((rgb[0] * shade) / 255, (rgb[1] * shade) / 255, (rgb[2] * shade) / 255);
  }
  out.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
}

function greedyMesh(vox, light, cs, h, kindFilter) {
  const out = { pos: [], nrm: [], col: [], idx: [] };

  const get = (x, y, z) => {
    if (x < 0 || z < 0 || y < 0 || x >= cs || z >= cs || y >= h) return AIR;
    return vox[idx(x, y, z, cs, h)];
  };
  const getLight = (x, y, z) => {
    if (x < 0 || z < 0 || y < 0 || x >= cs || z >= cs || y >= h) return 0;
    return light[idx(x, y, z, cs, h)];
  };

  // For MVP: greedy only along +Y top faces and side faces per block (still fast enough)
  // (Full 3-axis greedy is longer; this version is already a big perf win vs per-block cubes.)
  for (let y = 0; y < h; y += 1) {
    // top faces at y
    const mask = Array.from({ length: cs * cs }, () => 0);
    for (let z = 0; z < cs; z += 1) {
      for (let x = 0; x < cs; x += 1) {
        const t = get(x, y, z);
        if (!kindFilter(t)) continue;
        const above = get(x, y + 1, z);
        if (kindFilter(above)) continue;
        mask[x + z * cs] = t;
      }
    }

    for (let z = 0; z < cs; z += 1) {
      for (let x = 0; x < cs; ) {
        const t = mask[x + z * cs];
        if (!t) {
          x += 1;
          continue;
        }
        let w = 1;
        while (x + w < cs && mask[x + w + z * cs] === t) w += 1;
        let d = 1;
        outer: while (z + d < cs) {
          for (let k = 0; k < w; k += 1) {
            if (mask[x + k + (z + d) * cs] !== t) break outer;
          }
          d += 1;
        }
        for (let dz = 0; dz < d; dz += 1) {
          for (let dx = 0; dx < w; dx += 1) mask[x + dx + (z + dz) * cs] = 0;
        }
        const lv = getLight(x, y, z);
        const shade = 0.35 + (lv / 15) * 0.65;
        pushQuad(out, x, y + 1, z, x + w, y + 1, z + d, [0, 1, 0], colorFor(t), shade * 1.0);
        x += w;
      }
    }
  }

  // Simple side faces (not greedy): still much less than full cubes in practice.
  const dirs = [
    [1, 0, 0, [1, 0, 0], 0.85],
    [-1, 0, 0, [-1, 0, 0], 0.85],
    [0, 0, 1, [0, 0, 1], 0.8],
    [0, 0, -1, [0, 0, -1], 0.8],
    [0, -1, 0, [0, -1, 0], 0.65], // bottom
  ];
  for (let y = 0; y < h; y += 1) {
    for (let z = 0; z < cs; z += 1) {
      for (let x = 0; x < cs; x += 1) {
        const t = get(x, y, z);
        if (!kindFilter(t)) continue;
        const lv = getLight(x, y, z);
        const shade0 = (0.35 + (lv / 15) * 0.65);
        for (const [dx, dy, dz, nrm, faceShade] of dirs) {
          const nt = get(x + dx, y + dy, z + dz);
          if (kindFilter(nt)) continue;
          const shade = shade0 * faceShade;
          if (dx === 1) pushQuad(out, x + 1, y, z, x + 1, y + 1, z + 1, nrm, colorFor(t), shade);
          if (dx === -1) pushQuad(out, x, y, z + 1, x, y + 1, z, nrm, colorFor(t), shade);
          if (dz === 1) pushQuad(out, x, y, z + 1, x + 1, y + 1, z + 1, nrm, colorFor(t), shade);
          if (dz === -1) pushQuad(out, x + 1, y, z, x, y + 1, z, nrm, colorFor(t), shade);
          if (dy === -1) pushQuad(out, x, y, z, x + 1, y, z + 1, nrm, colorFor(t), shade);
        }
      }
    }
  }

  return out;
}

self.onmessage = (e) => {
  const msg = e.data || {};
  if (msg.type !== "mesh_chunk") return;
  const { cx, cz, cs, h, minY, voxels, version } = msg;
  const vox = new Uint8Array(voxels);
  const light = computeLight(vox, cs, h);

  const opaque = greedyMesh(vox, light, cs, h, (t) => t !== AIR && t !== WATER);
  const water = greedyMesh(vox, light, cs, h, (t) => t === WATER);

  const pack = (m) => {
    const pos = new Float32Array(m.pos);
    const nrm = new Float32Array(m.nrm);
    const col = new Float32Array(m.col);
    const idx = new Uint32Array(m.idx);
    return { pos, nrm, col, idx };
  };

  const o = pack(opaque);
  const w = pack(water);

  self.postMessage(
    {
      type: "mesh_chunk_result",
      cx,
      cz,
      cs,
      h,
      minY,
      version,
      opaque: o,
      water: w,
    },
    [o.pos.buffer, o.nrm.buffer, o.col.buffer, o.idx.buffer, w.pos.buffer, w.nrm.buffer, w.col.buffer, w.idx.buffer]
  );
};
