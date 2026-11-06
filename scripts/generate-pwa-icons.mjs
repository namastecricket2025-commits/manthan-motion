/*
 * Home-screen icons for the installable app.
 *
 * The mark is the same geometry as `public/favicon.svg`: one large disc, the
 * bar, one small disc. Drawing it here means the icons stay exact at every
 * size and the project needs no image dependency. Run:
 *
 *   bun scripts/generate-pwa-icons.mjs
 *
 * Outputs (public/icons):
 *   icon-192.png            rounded tile, purpose "any"
 *   icon-512.png            rounded tile, purpose "any"
 *   icon-maskable-512.png   full bleed, mark inside Android's safe circle
 *   apple-touch-icon.png    full bleed, iOS applies its own mask
 */

import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "public/icons";
const INK = [247, 243, 234]; // warm white, the mark's ink
const SS = 4; // supersampling factor for clean circles at 192px

const MARK = {
  // Bounding box of the favicon path, in the 64-unit viewBox.
  minX: 6.5,
  maxX: 57.2,
  minY: 13,
  maxY: 51,
  big: { x: 25.5, y: 32, r: 19 },
  bar: { x: 41, y: 29.8, w: 7, h: 4.4, r: 1.6 },
  small: { x: 51, y: 32, r: 6.2 },
};
const MARK_W = MARK.maxX - MARK.minX;
const MARK_CX = (MARK.minX + MARK.maxX) / 2;
const MARK_CY = (MARK.minY + MARK.maxY) / 2;

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Signed distance to a rounded rectangle, centred at (cx, cy). */
function roundedRectDistance(x, y, cx, cy, halfW, halfH, radius) {
  const qx = Math.abs(x - cx) - halfW + radius;
  const qy = Math.abs(y - cy) - halfH + radius;
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qy, 0));
  const inside = Math.min(Math.max(qx, qy), 0);
  return outside + inside - radius;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i++) {
    crc ^= buffer[i];
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeBuffer, data]));
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  typeBuffer.copy(chunk, 4);
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc, 8 + data.length);
  return chunk;
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter: none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Render one icon at `size` CSS px. `maskable` fills the square and keeps the
 * mark in the central safe circle; otherwise the tile has rounded corners and
 * a transparent surround.
 */
function renderIcon(size, { maskable = false, rounded = true, markRatio = 0.56 } = {}) {
  const W = size * SS;
  const pixels = new Float32Array(W * W * 4); // premultiplied RGBA
  const markScale = (markRatio * size) / MARK_W;
  const radius = maskable || !rounded ? 0 : size * 0.225;

  const tileCx = W / 2;
  const tileCy = W / 2;
  const markCx = W / 2;
  const markCy = W / 2;

  // Geometry in supersampled pixels, measured from the mark's own centre.
  const toX = (x) => markCx + (x - MARK_CX) * markScale * SS;
  const toY = (y) => markCy + (y - MARK_CY) * markScale * SS;
  const bigR = MARK.big.r * markScale * SS;
  const smallR = MARK.small.r * markScale * SS;
  const barR = MARK.bar.r * markScale * SS;
  const barHalfW = (MARK.bar.w * markScale * SS) / 2;
  const barHalfH = (MARK.bar.h * markScale * SS) / 2;
  const barCx = toX(MARK.bar.x + MARK.bar.w / 2);
  const barCy = toY(MARK.bar.y + MARK.bar.h / 2);

  for (let y = 0; y < W; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const px = x + 0.5;
      const py = y + 0.5;

      // A soft warm light behind the mark, falling to near-black at the edge.
      const nx = (px - W / 2) / (W / 2);
      const ny = (py - W / 2) / (W / 2);
      const distance = Math.min(1, Math.hypot(nx, ny));
      const light = 1 - smoothstep(0.08, 1, distance);
      const bgR = 9 + 20 * light;
      const bgG = 9 + 17 * light;
      const bgB = 10 + 13 * light;

      // Tile alpha: a rounded square for "any", full bleed otherwise.
      let alpha = 1;
      if (maskable || !rounded) {
        alpha = 1;
      } else {
        const d = roundedRectDistance(
          px,
          py,
          tileCx,
          tileCy,
          W / 2,
          W / 2,
          radius * SS,
        );
        alpha = d <= 0 ? 1 : 0;
      }

      let r = bgR;
      let g = bgG;
      let b = bgB;

      // The mark, in ink, clipped to the tile's rounded shape.
      if (alpha > 0) {
        const inBig = Math.hypot(px - toX(MARK.big.x), py - toY(MARK.big.y)) <= bigR;
        const inSmall =
          Math.hypot(px - toX(MARK.small.x), py - toY(MARK.small.y)) <= smallR;
        const inBar =
          roundedRectDistance(px, py, barCx, barCy, barHalfW, barHalfH, barR) <= 0;
        if (inBig || inSmall || inBar) {
          r = INK[0];
          g = INK[1];
          b = INK[2];
        }
      }

      pixels[i] = (r / 255) * alpha;
      pixels[i + 1] = (g / 255) * alpha;
      pixels[i + 2] = (b / 255) * alpha;
      pixels[i + 3] = alpha;
    }
  }

  // Downsample the supersampled buffer; premultiplied averages avoid dark or
  // light fringes around the rounded corners.
  const out = Buffer.alloc(size * size * 4);
  const samples = SS * SS;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * W + (x * SS + sx)) * 4;
          r += pixels[i];
          g += pixels[i + 1];
          b += pixels[i + 2];
          a += pixels[i + 3];
        }
      }
      r /= samples;
      g /= samples;
      b /= samples;
      a /= samples;
      const o = (y * size + x) * 4;
      out[o] = a > 0 ? Math.round((r / a) * 255) : 0;
      out[o + 1] = a > 0 ? Math.round((g / a) * 255) : 0;
      out[o + 2] = a > 0 ? Math.round((b / a) * 255) : 0;
      out[o + 3] = Math.round(a * 255);
    }
  }

  return encodePng(size, size, out);
}

mkdirSync(OUT, { recursive: true });

const files = [
  ["icon-192.png", renderIcon(192)],
  ["icon-512.png", renderIcon(512)],
  ["icon-maskable-512.png", renderIcon(512, { maskable: true, markRatio: 0.5 })],
  [
    "apple-touch-icon.png",
    renderIcon(180, { rounded: false, markRatio: 0.58 }),
  ],
];

for (const [name, bytes] of files) {
  writeFileSync(`${OUT}/${name}`, bytes);
  console.log(`${OUT}/${name}  ${bytes.length} bytes`);
}
