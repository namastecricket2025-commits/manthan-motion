import * as THREE from "three";

/* ============================================================
   Procedural texture library for the STEM Lab.

   Everything here is generated on a <canvas> at build-time in the
   browser — no binary assets — so the lab stays a single small
   bundle while still giving meshes real surface detail (muscle
   striations, cartilaginous fibre, alveolar speckle, renal
   striation) instead of flat plastic colours.
   ============================================================ */

/** Deterministic PRNG so every reload paints exactly the same detail. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvas(size: number) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

export interface SurfaceMaps {
  map: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
}

function release(maps: SurfaceMaps) {
  maps.map.dispose();
  maps.bumpMap.dispose();
  maps.roughnessMap?.dispose();
}

/** Dispose every texture produced here from a mesh/material tree. */
export function disposeSurfaceMaps(root: THREE.Object3D) {
  const seen = new Set<THREE.Texture>();
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    const mats = mesh.material
      ? Array.isArray(mesh.material)
        ? mesh.material
        : [mesh.material]
      : [];
    for (const m of mats) {
      const any = m as unknown as Record<string, THREE.Texture | undefined>;
      for (const key of ["map", "bumpMap", "roughnessMap", "normalMap", "emissiveMap"]) {
        const t = any[key];
        if (t && !seen.has(t)) {
          seen.add(t);
          t.dispose();
        }
      }
    }
  });
}

function tex(
  c: HTMLCanvasElement,
  repeat: number,
  opts: { srgb?: boolean; releaseFn?: (m: SurfaceMaps) => void } = {},
) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Speckle noise pass — the difference between "plastic" and "tissue". */
function speckle(ctx: CanvasRenderingContext2D, size: number, count: number, seed: number, alpha = 0.05, light = false) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 0.4 + r() * 1.8;
    const v = Math.floor(r() * 70);
    ctx.fillStyle = light
      ? `rgba(255,255,255,${alpha * (0.4 + r())})`
      : `rgba(${v},${Math.floor(v * 0.4)},${Math.floor(v * 0.35)},${alpha * (0.4 + r())})`;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
}

/* ------------------------------------------------------------------ *
 *  1. Cardiac / skeletal muscle — striated, fibrous, slightly damp
 * ------------------------------------------------------------------ */
export function muscleMaps(opts: { repeat?: number; base?: string; strand?: string; seed?: number } = {}): SurfaceMaps {
  const size = 512;
  const repeat = opts.repeat ?? 2.5;
  const base = opts.base ?? "#8c1c1c";
  const strand = opts.strand ?? "#c2413f";
  const c = canvas(size);
  const ctx = c.getContext("2d")!;
  const r = rng(opts.seed ?? 7);

  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, base);
  g.addColorStop(0.5, strand);
  g.addColorStop(1, base);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  // longitudinal fibre bundles
  for (let i = 0; i < 150; i++) {
    const x = r() * size;
    const h = 0.35 + r() * 0.8;
    const w = 1 + r() * 3.4;
    ctx.strokeStyle = r() > 0.5 ? `rgba(255,190,180,${0.05 + r() * 0.13})` : `rgba(60,10,12,${0.06 + r() * 0.16})`;
    ctx.lineWidth = w;
    ctx.beginPath();
    for (let y = -8; y <= size + 8; y += 16) {
      const wob = Math.sin((y / size) * Math.PI * 4 + i) * (2 + r() * 4);
      if (y === -8) ctx.moveTo(x + wob, y);
      else ctx.lineTo(x + wob, y);
    }
    ctx.stroke();
    void h;
  }
  // intercalated creases across the fibres
  for (let i = 0; i < 60; i++) {
    const y = r() * size;
    ctx.strokeStyle = `rgba(50,8,10,${0.05 + r() * 0.1})`;
    ctx.lineWidth = 0.8 + r() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + (r() - 0.5) * 26, size * 0.7, y + (r() - 0.5) * 26, size, y);
    ctx.stroke();
  }
  speckle(ctx, size, 2600, 11, 0.05);

  // grayscale bump derived from the same field
  const bc = canvas(size);
  const bctx = bc.getContext("2d")!;
  bctx.fillStyle = "#8a8a8a";
  bctx.fillRect(0, 0, size, size);
  const r2 = rng((opts.seed ?? 7) + 5);
  for (let i = 0; i < 170; i++) {
    const x = r2() * size;
    bctx.strokeStyle = r2() > 0.5 ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.26)";
    bctx.lineWidth = 1 + r2() * 3;
    bctx.beginPath();
    for (let y = -8; y <= size + 8; y += 16) {
      const wob = Math.sin((y / size) * Math.PI * 4 + i) * (2 + r2() * 4);
      if (y === -8) bctx.moveTo(x + wob, y);
      else bctx.lineTo(x + wob, y);
    }
    bctx.stroke();
  }
  speckle(bctx, size, 2000, 21, 0.09, true);

  return {
    map: tex(c, repeat),
    bumpMap: tex(bc, repeat, { srgb: false }),
  };
}

/* ------------------------------------------------------------------ *
 *  2. Hyaline cartilage — pale, fibrous, semi-rigid C-rings
 * ------------------------------------------------------------------ */
export function cartilageMaps(repeat = 1.6): SurfaceMaps {
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext("2d")!;
  const r = rng(31);
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, "#cbd5e1");
  g.addColorStop(0.35, "#eef2f7");
  g.addColorStop(0.62, "#dbe4ee");
  g.addColorStop(1, "#b7c4d4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // circumferential fibres (the cartilage matrix)
  for (let i = 0; i < 210; i++) {
    const y = r() * size;
    ctx.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${0.08 + r() * 0.22})` : `rgba(120,140,165,${0.06 + r() * 0.2})`;
    ctx.lineWidth = 0.7 + r() * 2.6;
    ctx.beginPath();
    ctx.moveTo(-6, y);
    ctx.bezierCurveTo(size * 0.3, y + (r() - 0.5) * 22, size * 0.7, y + (r() - 0.5) * 22, size + 6, y);
    ctx.stroke();
  }
  // chondrocyte lacunae
  for (let i = 0; i < 120; i++) {
    const x = r() * size;
    const y = r() * size;
    ctx.fillStyle = `rgba(148,170,196,${0.12 + r() * 0.2})`;
    ctx.beginPath();
    ctx.ellipse(x, y, 2.5 + r() * 3.5, 1.4 + r() * 2.2, r() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, size, 3200, 41, 0.05, true);

  const bc = canvas(size);
  const bctx = bc.getContext("2d")!;
  bctx.fillStyle = "#909090";
  bctx.fillRect(0, 0, size, size);
  const r2 = rng(77);
  for (let i = 0; i < 220; i++) {
    const y = r2() * size;
    bctx.strokeStyle = r2() > 0.5 ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.22)";
    bctx.lineWidth = 0.8 + r2() * 2.4;
    bctx.beginPath();
    bctx.moveTo(-6, y);
    bctx.bezierCurveTo(size * 0.3, y + (r2() - 0.5) * 22, size * 0.7, y + (r2() - 0.5) * 22, size + 6, y);
    bctx.stroke();
  }
  return { map: tex(c, repeat), bumpMap: tex(bc, repeat, { srgb: false }) };
}

/* ------------------------------------------------------------------ *
 *  3. Lung parenchyma — spongy, semi-porous, vascular tissue.
 *     Alveolar pits + capillary web + a porosity roughness map so the
 *     surface reads as soft respiratory tissue, not glossy plastic.
 * ------------------------------------------------------------------ */
export function lungMaps(repeat = 2): SurfaceMaps {
  const size = 1024;
  const c = canvas(size);
  const ctx = c.getContext("2d")!;
  const r = rng(53);
  const g = ctx.createRadialGradient(size / 2, size / 2, size * 0.1, size / 2, size / 2, size * 0.75);
  g.addColorStop(0, "#f6b6bd");
  g.addColorStop(0.55, "#e88b98");
  g.addColorStop(1, "#c76a7c");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // sub-pleural capillary web (the vascular look of living lung)
  for (let i = 0; i < 170; i++) {
    const x0 = r() * size;
    const y0 = r() * size;
    ctx.strokeStyle = `rgba(${168 + Math.floor(r() * 40)},${44 + Math.floor(r() * 30)},${58 + Math.floor(r() * 24)},${0.1 + r() * 0.16})`;
    ctx.lineWidth = 0.7 + r() * 1.7;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    // a branching crawl — capillaries fork as they run
    let x = x0;
    let y = y0;
    let ang = r() * Math.PI * 2;
    for (let s = 0; s < 5; s++) {
      const len = 14 + r() * 34;
      ang += (r() - 0.5) * 1.4;
      x += Math.cos(ang) * len;
      y += Math.sin(ang) * len;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // lobular seams (secondary lobules)
  for (let i = 0; i < 64; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 34 + r() * 78;
    ctx.strokeStyle = `rgba(146,60,80,${0.1 + r() * 0.14})`;
    ctx.lineWidth = 1 + r() * 2.2;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.stroke();
  }
  // alveolar stipple — dense two-tone speckle
  for (let i = 0; i < 15000; i++) {
    const x = r() * size;
    const y = r() * size;
    ctx.fillStyle = r() > 0.5 ? `rgba(255,220,224,${0.05 + r() * 0.14})` : `rgba(150,60,74,${0.04 + r() * 0.12})`;
    ctx.beginPath();
    ctx.arc(x, y, 0.7 + r() * 2.1, 0, Math.PI * 2);
    ctx.fill();
  }
  // alveolar pits — darker porous dimples (the spongy signature)
  for (let i = 0; i < 1500; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 2.5 + r() * 6.5;
    const pg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    pg.addColorStop(0, `rgba(112,38,52,${0.2 + r() * 0.22})`);
    pg.addColorStop(0.7, `rgba(150,70,84,${0.1 + r() * 0.1})`);
    pg.addColorStop(1, "rgba(160,80,92,0)");
    ctx.fillStyle = pg;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }

  // bump: pitted surface — pits are craters, web is raised
  const bc = canvas(size);
  const bctx = bc.getContext("2d")!;
  bctx.fillStyle = "#9a9a9a";
  bctx.fillRect(0, 0, size, size);
  const r2 = rng(97);
  for (let i = 0; i < 4200; i++) {
    const x = r2() * size;
    const y = r2() * size;
    bctx.fillStyle = r2() > 0.5 ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.2)";
    bctx.beginPath();
    bctx.arc(x, y, 0.9 + r2() * 2.4, 0, Math.PI * 2);
    bctx.fill();
  }
  for (let i = 0; i < 1300; i++) {
    const x = r2() * size;
    const y = r2() * size;
    const rad = 2.5 + r2() * 6;
    const dg = bctx.createRadialGradient(x, y, 0, x, y, rad);
    dg.addColorStop(0, "rgba(0,0,0,0.34)");
    dg.addColorStop(1, "rgba(0,0,0,0)");
    bctx.fillStyle = dg;
    bctx.beginPath();
    bctx.arc(x, y, rad, 0, Math.PI * 2);
    bctx.fill();
  }

  // roughness: pores are matt-rough, tissue between them slightly sheened
  const rc = canvas(size);
  const rctx = rc.getContext("2d")!;
  rctx.fillStyle = "#c8c8c8";
  rctx.fillRect(0, 0, size, size);
  const r3 = rng(977);
  for (let i = 0; i < 1300; i++) {
    const x = r3() * size;
    const y = r3() * size;
    const rad = 2.5 + r3() * 6.5;
    const rg = rctx.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, "rgba(255,255,255,0.55)");
    rg.addColorStop(1, "rgba(255,255,255,0)");
    rctx.fillStyle = rg;
    rctx.beginPath();
    rctx.arc(x, y, rad, 0, Math.PI * 2);
    rctx.fill();
  }
  return {
    map: tex(c, repeat),
    bumpMap: tex(bc, repeat, { srgb: false }),
    roughnessMap: tex(rc, repeat, { srgb: false }),
  };
}

/* ------------------------------------------------------------------ *
 *  4. Renal cortex — granular, brownish-red, glomerular speckle
 * ------------------------------------------------------------------ */
export function kidneyCortexMaps(repeat = 2): SurfaceMaps {
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext("2d")!;
  const r = rng(131);
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#a33a48");
  g.addColorStop(0.5, "#c1596a");
  g.addColorStop(1, "#8f2f3f");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  // glomeruli
  for (let i = 0; i < 240; i++) {
    const x = r() * size;
    const y = r() * size;
    const rad = 2 + r() * 5;
    const gg = ctx.createRadialGradient(x, y, 0, x, y, rad);
    gg.addColorStop(0, "rgba(255,205,205,0.55)");
    gg.addColorStop(0.55, "rgba(224,140,150,0.3)");
    gg.addColorStop(1, "rgba(150,40,55,0)");
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(x, y, rad, 0, Math.PI * 2);
    ctx.fill();
  }
  speckle(ctx, size, 3600, 151, 0.06);
  return { map: tex(c, repeat), bumpMap: tex(c, repeat, { srgb: false }) };
}

/* ------------------------------------------------------------------ *
 *  5. Renal medulla — radial striation of collecting ducts
 * ------------------------------------------------------------------ */
export function medullaMaps(repeat = 1): SurfaceMaps {
  const size = 512;
  const c = canvas(size);
  const ctx = c.getContext("2d")!;
  const r = rng(211);
  ctx.fillStyle = "#b4552f";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const x = r() * size;
    ctx.strokeStyle = r() > 0.5 ? `rgba(255,225,190,${0.08 + r() * 0.2})` : `rgba(120,45,25,${0.08 + r() * 0.2})`;
    ctx.lineWidth = 0.9 + r() * 2.4;
    ctx.beginPath();
    ctx.moveTo(x, -6);
    ctx.bezierCurveTo(x + (r() - 0.5) * 18, size * 0.35, x + (r() - 0.5) * 18, size * 0.7, x, size + 6);
    ctx.stroke();
  }
  speckle(ctx, size, 2400, 233, 0.06);

  const bc = canvas(size);
  const bctx = bc.getContext("2d")!;
  bctx.fillStyle = "#909090";
  bctx.fillRect(0, 0, size, size);
  const r2 = rng(257);
  for (let i = 0; i < 260; i++) {
    const x = r2() * size;
    bctx.strokeStyle = r2() > 0.5 ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.24)";
    bctx.lineWidth = 1 + r2() * 2.4;
    bctx.beginPath();
    bctx.moveTo(x, -6);
    bctx.bezierCurveTo(x + (r2() - 0.5) * 18, size * 0.35, x + (r2() - 0.5) * 18, size * 0.7, x, size + 6);
    bctx.stroke();
  }
  return { map: tex(c, repeat), bumpMap: tex(bc, repeat, { srgb: false }) };
}

/* ------------------------------------------------------------------ *
 *  6. Vessel endothelium — faint longitudinal flow lines
 * ------------------------------------------------------------------ */
export function vesselMaps(baseHex: string, repeat = 2): SurfaceMaps {
  const size = 256;
  const c = canvas(size);
  const ctx = c.getContext("2d")!;
  const r = rng(baseHex.length * 97);
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) {
    const y = r() * size;
    ctx.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${0.05 + r() * 0.1})` : `rgba(0,0,0,${0.04 + r() * 0.1})`;
    ctx.lineWidth = 0.6 + r() * 2;
    ctx.beginPath();
    ctx.moveTo(-4, y);
    ctx.bezierCurveTo(size * 0.3, y + (r() - 0.5) * 14, size * 0.7, y + (r() - 0.5) * 14, size + 4, y);
    ctx.stroke();
  }
  const bc = canvas(size);
  const bctx = bc.getContext("2d")!;
  bctx.fillStyle = "#8c8c8c";
  bctx.fillRect(0, 0, size, size);
  const r2 = rng(313);
  for (let i = 0; i < 90; i++) {
    const y = r2() * size;
    bctx.strokeStyle = r2() > 0.5 ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.18)";
    bctx.lineWidth = 0.6 + r2() * 2;
    bctx.beginPath();
    bctx.moveTo(-4, y);
    bctx.bezierCurveTo(size * 0.3, y + (r2() - 0.5) * 14, size * 0.7, y + (r2() - 0.5) * 14, size + 4, y);
    bctx.stroke();
  }
  return { map: tex(c, repeat), bumpMap: tex(bc, repeat, { srgb: false }) };
}

/** Convenience: standard-surface material for anatomy meshes. */
export function tissueMaterial(
  maps: SurfaceMaps,
  opts: { color?: number; roughness?: number; metalness?: number; bumpScale?: number; emissive?: number; emissiveIntensity?: number; opacity?: number; side?: THREE.Side; clearcoat?: number } = {},
) {
  const mat = new THREE.MeshPhysicalMaterial({
    map: maps.map,
    bumpMap: maps.bumpMap,
    roughnessMap: maps.roughnessMap,
    bumpScale: opts.bumpScale ?? 0.035,
    color: opts.color ?? 0xffffff,
    roughness: opts.roughness ?? 0.62,
    metalness: opts.metalness ?? 0.03,
    emissive: opts.emissive ?? 0x000000,
    emissiveIntensity: opts.emissiveIntensity ?? 0,
    transparent: (opts.opacity ?? 1) < 1,
    opacity: opts.opacity ?? 1,
    side: opts.side ?? THREE.FrontSide,
  });
  if (opts.clearcoat) {
    mat.clearcoat = opts.clearcoat;
    mat.clearcoatRoughness = 0.45;
  }
  return mat;
}

export { release as releaseSurfaceMaps };
