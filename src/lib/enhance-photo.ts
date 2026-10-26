/**
 * Photo clean-up before a vision model reads a question.
 *
 * A phone photo of a worksheet is usually the worst possible input: it is
 * small, slightly out of focus, and shot under a lamp that leaves one side
 * grey. The model then has to guess between `3` and `8`, and a wrong guess is
 * not a cosmetic error — it solves a different problem.
 *
 * This module does the three things that measurably help a reader:
 *
 *   1. **Upscale** anything under ~1600 px on the long edge, so a digit is
 *      several pixels wide instead of two.
 *   2. **Normalise contrast** around the paper's own mid-tone, which flattens
 *      the lamp gradient without turning faint pencil into black.
 *   3. **Unsharp mask** — the sharpen a scanner applies: blur a copy, subtract
 *      it, add the difference back. It restores edges that focus lost and does
 *      not invent detail the way a hard sharpen kernel does.
 *
 * Everything runs in a canvas in the browser, before the upload. Files that are
 * already sharp and large are left untouched (returned byte-for-byte), so the
 * common case costs nothing and loses nothing.
 */

export interface EnhancedPhoto {
  base64: string;
  mimeType: string;
  name: string;
  /** True when the pixels were rewritten. */
  enhanced: boolean;
  /** Laplacian variance of the source — higher is sharper. */
  sharpness: number;
}

const MIN_LONG_EDGE = 1600;
const MAX_LONG_EDGE = 2000;
/** Keep the base64 payload comfortably inside a function-argument limit. */
const MAX_BASE64 = 2_400_000;
/** Below this the photo is soft enough that a resample + unsharp is a win. */
const SOFT_THRESHOLD = 120;

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("That photo could not be read."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That photo could not be decoded."));
    image.src = src;
  });
}

/** Variance of the Laplacian: the standard no-reference sharpness estimate. */
function laplacianVariance(data: Uint8ClampedArray, width: number, height: number): number {
  const step = Math.max(1, Math.floor(Math.min(width, height) / 320));
  let sum = 0;
  let sumSq = 0;
  let count = 0;
  for (let y = step; y < height - step; y += step) {
    for (let x = step; x < width - step; x += step) {
      const index = (y * width + x) * 4;
      const up = ((y - step) * width + x) * 4;
      const down = ((y + step) * width + x) * 4;
      const left = (y * width + (x - step)) * 4;
      const right = (y * width + (x + step)) * 4;
      const grey =
        data[index]! * 0.299 + data[index + 1]! * 0.587 + data[index + 2]! * 0.114;
      const neighbours =
        (data[up]! * 0.299 + data[up + 1]! * 0.587 + data[up + 2]! * 0.114) +
        (data[down]! * 0.299 + data[down + 1]! * 0.587 + data[down + 2]! * 0.114) +
        (data[left]! * 0.299 + data[left + 1]! * 0.587 + data[left + 2]! * 0.114) +
        (data[right]! * 0.299 + data[right + 1]! * 0.587 + data[right + 2]! * 0.114);
      const lap = grey * 4 - neighbours;
      sum += lap;
      sumSq += lap * lap;
      count += 1;
    }
  }
  if (count === 0) return 0;
  const mean = sum / count;
  return sumSq / count - mean * mean;
}

/** Contrast stretch between two robust percentiles of the luminance. */
function stretchContrast(data: Uint8ClampedArray) {
  const histogram = new Uint32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const grey = data[i]! * 0.299 + data[i + 1]! * 0.587 + data[i + 2]! * 0.114;
    histogram[Math.min(255, Math.max(0, Math.round(grey)))]! += 1;
  }
  const total = data.length / 4;
  let low = 0;
  let high = 255;
  let running = 0;
  for (let value = 0; value < 256; value += 1) {
    running += histogram[value]!;
    if (running > total * 0.02) {
      low = value;
      break;
    }
  }
  running = 0;
  for (let value = 255; value >= 0; value -= 1) {
    running += histogram[value]!;
    if (running > total * 0.02) {
      high = value;
      break;
    }
  }
  if (high - low < 24) return; // already flat or almost blank; do not amplify noise
  const scale = 255 / (high - low);
  for (let i = 0; i < data.length; i += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      data[i + channel] = Math.min(255, Math.max(0, (data[i + channel]! - low) * scale));
    }
  }
}

/**
 * Blurred copy, subtracted from the original and added back. A 5-tap box blur
 * is enough at these sizes and keeps the pass linear in the pixel count.
 */
function unsharp(data: Uint8ClampedArray, width: number, height: number, amount: number) {
  const source = new Uint8ClampedArray(data);
  const radius = 1;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      for (let channel = 0; channel < 3; channel += 1) {
        let sum = 0;
        let count = 0;
        for (let dy = -radius; dy <= radius; dy += 1) {
          const sy = y + dy;
          if (sy < 0 || sy >= height) continue;
          for (let dx = -radius; dx <= radius; dx += 1) {
            const sx = x + dx;
            if (sx < 0 || sx >= width) continue;
            sum += source[(sy * width + sx) * 4 + channel]!;
            count += 1;
          }
        }
        const blurred = sum / count;
        const original = source[index + channel]!;
        data[index + channel] = Math.min(
          255,
          Math.max(0, original + (original - blurred) * amount),
        );
      }
    }
  }
}

/**
 * The same clean-up, returned as a File ready for an upload URL.
 *
 * Unchanged images come back as the original File object, so an already-good
 * photo is not re-encoded just to be sent.
 */
export async function enhancePhotoToFile(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const prepared = await enhancePhoto(file);
    if (!prepared.enhanced || !prepared.base64) return file;
    const bytes = Uint8Array.from(atob(prepared.base64), (char) => char.charCodeAt(0));
    return new File([bytes], prepared.name, { type: prepared.mimeType });
  } catch {
    return file;
  }
}

/**
 * Prepare a photo for reading. Never throws: an image the browser cannot decode
 * is sent through unchanged so the caller's normal error path handles it.
 */
export async function enhancePhoto(file: File): Promise<EnhancedPhoto> {
  const fallbackBase64 = async (): Promise<EnhancedPhoto> => {
    const raw = await readAsDataUrl(file);
    const comma = raw.indexOf(",");
    return {
      base64: comma >= 0 ? raw.slice(comma + 1) : "",
      mimeType: file.type || "image/jpeg",
      name: file.name,
      enhanced: false,
      sharpness: 0,
    };
  };

  if (!file.type.startsWith("image/")) return fallbackBase64();

  try {
    const dataUrl = await readAsDataUrl(file);
    const image = await loadImage(dataUrl);
    const longEdge = Math.max(image.naturalWidth, image.naturalHeight);
    if (longEdge === 0) return fallbackBase64();

    const scanCanvas = document.createElement("canvas");
    scanCanvas.width = image.naturalWidth;
    scanCanvas.height = image.naturalHeight;
    const scanContext = scanCanvas.getContext("2d", { willReadFrequently: true });
    if (!scanContext) return fallbackBase64();
    scanContext.drawImage(image, 0, 0);
    const scanData = scanContext.getImageData(0, 0, scanCanvas.width, scanCanvas.height);
    const sharpness = laplacianVariance(scanData.data, scanCanvas.width, scanCanvas.height);

    const needsUpscale = longEdge < MIN_LONG_EDGE;
    const needsSharpen = sharpness < SOFT_THRESHOLD;
    const needsShrink = file.size > 2_200_000;
    if (!needsUpscale && !needsSharpen && !needsShrink) {
      // Already good: send the original bytes and avoid a re-encode.
      return { ...(await fallbackBase64()), sharpness };
    }

    const scale = needsUpscale ? Math.min(3, MIN_LONG_EDGE / longEdge) : 1;
    const width = Math.min(MAX_LONG_EDGE, Math.round(image.naturalWidth * scale));
    const height = Math.min(MAX_LONG_EDGE, Math.round(image.naturalHeight * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return fallbackBase64();
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, 0, 0, width, height);

    const frame = context.getImageData(0, 0, width, height);
    stretchContrast(frame.data);
    unsharp(frame.data, width, height, 0.55);
    context.putImageData(frame, 0, 0);

    let encoded = canvas.toDataURL("image/jpeg", 0.88);
    if (encoded.length > MAX_BASE64) {
      // One more pass at a smaller size rather than handing the caller a
      // payload the backend will reject.
      const smaller = document.createElement("canvas");
      const factor = Math.sqrt(MAX_BASE64 / encoded.length);
      smaller.width = Math.max(1, Math.round(width * factor));
      smaller.height = Math.max(1, Math.round(height * factor));
      const smallContext = smaller.getContext("2d");
      if (smallContext) {
        smallContext.imageSmoothingQuality = "high";
        smallContext.drawImage(canvas, 0, 0, smaller.width, smaller.height);
        encoded = smaller.toDataURL("image/jpeg", 0.82);
      }
    }
    const comma = encoded.indexOf(",");
    return {
      base64: comma >= 0 ? encoded.slice(comma + 1) : "",
      mimeType: "image/jpeg",
      name: file.name.replace(/\.[^.]+$/, "") + "-scan.jpg",
      enhanced: true,
      sharpness,
    };
  } catch {
    return fallbackBase64();
  }
}
