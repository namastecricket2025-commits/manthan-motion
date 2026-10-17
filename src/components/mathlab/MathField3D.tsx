import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useCanvasSize, useRaf, syncViewport, useViewport } from "@/components/lab/use-canvas";
import { settingsRuntime, useResolvedTheme } from "@/lib/app-settings";

/**
 * The math lab's living plane.
 *
 * A single three.js sheet of light that sits *behind* the notebook — a grid of
 * hairlines standing in for the coordinate plane, deformed by a height field
 * whose coefficients come from the chapter the student is currently working
 * on. Switching chapters eases one terrain into the next, so the backdrop
 * visibly changes subject with them rather than cross-fading a picture.
 *
 * Three things drive it, all of them the student's own actions:
 *
 *   • **Chapter** — every plot model owns a shape (a linear tilt, a quadratic
 *     bowl, a trig wave, a hyperbola saddle). The live coefficients chase the
 *     target ones, so the sheet settles instead of snapping.
 *   • **Solve** — `pulse` is a counter. Every press stamps a ripple into the
 *     surface that travels outward and decays: pressing Solve does something
 *     physical, before a word of the answer has arrived.
 *   • **Pointer** — on fine pointers with the cursor field enabled, the whole
 *     plane leans a few degrees toward the cursor.
 *
 * House rules it inherits: the frame loop goes through `useRaf`, so the app's
 * Motionless Mode freezes the clock and the 30/60/uncapped framerate setting
 * is respected; Ambient Intensity scales the layer's opacity live; the loop
 * parks itself when the canvas leaves the viewport or the tab is hidden; and
 * every geometry, material and the renderer are disposed on unmount. There is
 * no network, no key and no user data here — the sheet is decoration, and it
 * is marked `aria-hidden`.
 */

interface Shape {
  /** Wave height. */
  amp: number;
  /** Wave numbers along both axes. */
  kx: number;
  kz: number;
  /** Amount of saddle (hyperbolic) term — makes the sheet twist. */
  swirl: number;
  /** Slope across the sheet — a linear model is mostly tilt. */
  tilt: number;
}

/**
 * One terrain per plot model. Unknown ids fall back to `DEFAULT_SHAPE`, so a
 * new curriculum entry can never leave the field blank.
 */
const SHAPES: Record<string, Shape> = {
  linear: { amp: 2.6, kx: 0.09, kz: 0.02, swirl: 0.1, tilt: 0.62 },
  variation: { amp: 3.6, kx: 0.15, kz: 0.04, swirl: 0.14, tilt: 0.28 },
  quadratic: { amp: 6.2, kx: 0.12, kz: 0.12, swirl: 0.04, tilt: 0 },
  trig: { amp: 5.2, kx: 0.24, kz: 0.19, swirl: 0.1, tilt: 0 },
  ellipse: { amp: 4.4, kx: 0.13, kz: 0.13, swirl: 0.26, tilt: 0.08 },
  tangent: { amp: 4, kx: 0.19, kz: 0.06, swirl: 0.32, tilt: 0.34 },
  circle: { amp: 4.2, kx: 0.17, kz: 0.17, swirl: 0.3, tilt: 0 },
  hyperbola: { amp: 5.4, kx: 0.2, kz: 0.2, swirl: 0.06, tilt: 0.1 },
  sqrt: { amp: 4.8, kx: 0.13, kz: 0.1, swirl: 0.08, tilt: 0.3 },
  reciprocal: { amp: 5.6, kx: 0.1, kz: 0.1, swirl: 0.2, tilt: 0 },
  sequence: { amp: 5, kx: 0.3, kz: 0.05, swirl: 0.12, tilt: 0.2 },
};

const DEFAULT_SHAPE: Shape = { amp: 4.4, kx: 0.16, kz: 0.14, swirl: 0.16, tilt: 0.12 };

/** Half-length of the sheet along each axis, recomputed on resize. */
const SHEET = { w: 120, d: 62 };

/** Themed hairline / glow colours, matching the site tokens. */
const PALETTE = {
  dark: { line: "#fafafa", crest: "#d4d4d8", fade: "#000000" },
  light: { line: "#3a5bc7", crest: "#27418c", fade: "#f6f7fa" },
};

export function MathField3D({
  plotId,
  pulse,
}: {
  /** The active chapter's plot model id — picks the terrain. */
  plotId: string;
  /** Increments on every Solve, stamping a ripple into the sheet. */
  pulse: number;
}) {
  const theme = useResolvedTheme();
  const { ref, size } = useCanvasSize<HTMLCanvasElement>();
  const vp = useViewport();

  const renderer = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const sheet = useRef<THREE.LineSegments | null>(null);
  const crest = useRef<THREE.Points | null>(null);
  const ink = useRef(new THREE.Color(PALETTE.dark.fade));
  const lineColor = useRef(new THREE.Color(PALETTE.dark.line));
  const crestColor = useRef(new THREE.Color(PALETTE.dark.crest));

  /** Live coefficients, eased toward the chapter's target every frame. */
  const live = useRef<Shape>({ ...DEFAULT_SHAPE });
  const target = useRef<Shape>(SHAPES[plotId] ?? DEFAULT_SHAPE);

  /* The chapter's terrain becomes the target the live coefficients chase; the
     easing itself happens in the frame loop, so the sheet settles rather than
     snapping when a student changes chapter. */
  useEffect(() => {
    target.current = SHAPES[plotId] ?? DEFAULT_SHAPE;
  }, [plotId]);

  /** Ripple stamped by Solve: starts at 1 and decays to nothing. */
  const impulse = useRef(0);
  const solveSeen = useRef(pulse);
  const reveal = useRef(0);

  /** Pointer lean, in -1..1, and whether the loop can do any work at all. */
  const pointer = useRef({ x: 0, y: 0, easedX: 0, easedY: 0 });
  const active = useRef(true);

  /** Scratch buffers, sized once per grid. */
  const grid = useMemo(
    () => ({
      segX: typeof window !== "undefined" && window.innerWidth < 760 ? 26 : 38,
      segZ: typeof window !== "undefined" && window.innerWidth < 760 ? 16 : 22,
    }),
    [],
  );
  const heights = useRef(new Float32Array((grid.segX + 1) * (grid.segZ + 1)));

  /* ---------- theme ----------
     Additive light is right over the dark ink and wrong over a light page
     (it would wash the sheet out), so the blend mode travels with the palette
     while the colours themselves stay put. */
  useEffect(() => {
    const palette = theme === "dark" ? PALETTE.dark : PALETTE.light;
    lineColor.current.set(palette.line);
    crestColor.current.set(palette.crest);
    ink.current.set(palette.fade);
    const blend = theme === "dark" ? THREE.AdditiveBlending : THREE.NormalBlending;
    const lines = sheet.current?.material as THREE.LineBasicMaterial | undefined;
    const dots = crest.current?.material as THREE.PointsMaterial | undefined;
    if (lines) {
      lines.blending = blend;
      lines.needsUpdate = true;
    }
    if (dots) {
      dots.blending = blend;
      dots.needsUpdate = true;
    }
  }, [theme]);

  /* ---------- scene (once) ---------- */
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    let gl: THREE.WebGLRenderer;
    try {
      gl = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: "low-power" });
    } catch {
      // No WebGL (old device, blocked context, sandboxed frame): the lab runs
      // exactly as before, just without the backdrop.
      return;
    }
    gl.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    gl.setClearColor(0x000000, 0);
    renderer.current = gl;

    const sc = new THREE.Scene();
    scene.current = sc;
    const cam = new THREE.PerspectiveCamera(40, 1, 0.5, 900);
    cam.position.set(0, 24, 78);
    camera.current = cam;

    const segX = grid.segX;
    const segZ = grid.segZ;

    /* The grid is stored as independent segments (rows first, then columns) so
       the surface reads as graph paper rather than triangulated mesh. */
    const rowSegments = (segX + 1) * segZ;
    const colSegments = (segZ + 1) * segX;
    const segments = rowSegments + colSegments;
    const linePositions = new Float32Array(segments * 2 * 3);
    const lineColors = new Float32Array(segments * 2 * 3);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));
    const lines = new THREE.LineSegments(
      lineGeometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    lines.frustumCulled = false;
    sc.add(lines);
    sheet.current = lines;

    /* Sparse glow at every other grid intersection — the wave crests light up. */
    const stride = 2;
    const pointX = Math.floor(segX / stride) + 1;
    const pointZ = Math.floor(segZ / stride) + 1;
    const pointCount = pointX * pointZ;
    const pointPositions = new Float32Array(pointCount * 3);
    const pointColors = new Float32Array(pointCount * 3);
    const pointGeometry = new THREE.BufferGeometry();
    pointGeometry.setAttribute("position", new THREE.BufferAttribute(pointPositions, 3));
    pointGeometry.setAttribute("color", new THREE.BufferAttribute(pointColors, 3));
    const dots = new THREE.Points(
      pointGeometry,
      new THREE.PointsMaterial({
        size: 2.1,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    dots.frustumCulled = false;
    sc.add(dots);
    crest.current = dots;

    return () => {
      sc.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (!material) return;
        for (const entry of Array.isArray(material) ? material : [material]) entry.dispose();
      });
      gl.dispose();
      renderer.current = null;
      scene.current = null;
      camera.current = null;
      sheet.current = null;
      crest.current = null;
    };
    // Grid resolution is fixed for the life of the canvas; resizing only
    // changes the sheet extents, which are read every frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- pointer lean + viewport parking ---------- */
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const fine = window.matchMedia("(pointer: fine)").matches;

    const onPointerMove = (event: PointerEvent) => {
      if (!fine) return;
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };

    let observer: IntersectionObserver | null = null;
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver(
        (entries) => {
          active.current = (entries[0]?.isIntersecting ?? true) && document.visibilityState === "visible";
        },
        { threshold: 0 },
      );
      observer.observe(canvas);
    }
    const onVisibility = () => {
      active.current = document.visibilityState === "visible";
    };

    if (fine) window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (fine) window.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
    };
  }, [ref]);

  /* ---------- per-frame ---------- */
  useRaf((dt, t) => {
    const gl = renderer.current;
    const sc = scene.current;
    const cam = camera.current;
    const lines = sheet.current;
    const dots = crest.current;
    if (!gl || !sc || !cam || !lines || !dots || !active.current) return;

    /* Frame the sheet to the canvas: recomputed from the live aspect so the
       field always bleeds past all four edges. */
    const { w, h, dpr } = size.current;
    const cssW = w / Math.max(1, dpr);
    const cssH = h / Math.max(1, dpr);
    syncViewport(vp.current, gl, cam, cssW, cssH, false);
    const aspect = cssW > 0 && cssH > 0 ? cssW / cssH : 2;
    SHEET.w = 2 * Math.abs(cam.position.z) * Math.tan((cam.fov * Math.PI) / 360) * aspect * 1.12;
    SHEET.d = 2 * Math.abs(cam.position.z) * Math.tan((cam.fov * Math.PI) / 360) * 1.25;

    const reduce = settingsRuntime.reduceMotion;
    const ambient = settingsRuntime.ambient;

    /* Entrance: the sheet fades and settles in once, on mount. */
    if (reveal.current < 1) reveal.current = Math.min(1, reveal.current + dt * 0.7);
    const ease = 1 - Math.pow(1 - reveal.current, 3);

    /* Coefficients chase the active chapter — this is the "settle" the lab's
       copy promises, made visible. */
    const L = live.current;
    const T = target.current;
    const chase = Math.min(1, dt * (reduce ? 12 : 1.9));
    L.amp += (T.amp - L.amp) * chase;
    L.kx += (T.kx - L.kx) * chase;
    L.kz += (T.kz - L.kz) * chase;
    L.swirl += (T.swirl - L.swirl) * chase;
    L.tilt += (T.tilt - L.tilt) * chase;

    /* A Solve press stamps a ripple that decays over a couple of seconds. */
    if (pulse !== solveSeen.current) {
      solveSeen.current = pulse;
      impulse.current = 1;
    }
    if (impulse.current > 0 && !reduce) impulse.current = Math.max(0, impulse.current - dt * 0.62);

    /* Pointer lean — its own preference, and it settles home when disabled. */
    const p = pointer.current;
    const follow = settingsRuntime.cursorField && !reduce;
    p.easedX += ((follow ? p.x : 0) - p.easedX) * 0.045;
    p.easedY += ((follow ? p.y : 0) - p.easedY) * 0.045;

    const segX = grid.segX;
    const segZ = grid.segZ;
    const radius = Math.max(SHEET.w, SHEET.d) * 0.52;
    const field = heights.current;

    /* 1. Height field on the shared grid. */
    for (let i = 0; i <= segX; i++) {
      const u = (i / segX - 0.5) * SHEET.w;
      const nx = i / segX - 0.5;
      for (let j = 0; j <= segZ; j++) {
        const v = (j / segZ - 0.5) * SHEET.d;

        /* Ground the sheet at its edges so the mask never cuts a wave off. */
        const r = Math.hypot(u, v);
        const edge = Math.min(1, r / radius);
        const fall = 1 - edge * edge * (3 - 2 * edge);

        let y =
          L.amp *
          (Math.sin(L.kx * u + t * 0.62) * Math.cos(L.kz * v - t * 0.44) +
            0.42 * Math.sin((L.kx + L.kz) * 0.5 * (u + v) + t * 0.3) +
            L.swirl * Math.sin(L.kx * u) * Math.sin(L.kz * v));

        y += L.tilt * nx * 9;

        if (impulse.current > 0) {
          y += impulse.current * 3.4 * Math.sin(r * 0.24 - t * 3.2) * Math.exp(-r * 0.021);
        }

        field[i * (segZ + 1) + j] = y * fall * ease;
      }
    }

    /* 2. Write the segment endpoints and colour them by crest height. */
    const linePos = lines.geometry.getAttribute("position") as THREE.BufferAttribute;
    const lineCol = lines.geometry.getAttribute("color") as THREE.BufferAttribute;
    const lp = linePos.array as Float32Array;
    const lc = lineCol.array as Float32Array;
    const lineRgb = lineColor.current;
    const crestRgb = crestColor.current;
    const inkRgb = ink.current;

    let cursor = 0;
    const write = (i: number, j: number) => {
      const u = (i / segX - 0.5) * SHEET.w;
      const v = (j / segZ - 0.5) * SHEET.d;
      const y = field[i * (segZ + 1) + j];
      lp[cursor] = u;
      lp[cursor + 1] = y;
      lp[cursor + 2] = v;

      /* Brightness follows the crest; the outer grid sinks into the page ink
         so the sheet has depth without a fog pass. */
      const crestFactor = Math.min(1, Math.abs(y) / 6.5);
      const dim = 0.24 + 0.76 * (1 - Math.min(1, Math.hypot(u, v) / (radius * 1.5)));
      const hot = crestFactor * dim;
      const r = lineRgb.r + (crestRgb.r - lineRgb.r) * hot;
      const g = lineRgb.g + (crestRgb.g - lineRgb.g) * hot;
      const b = lineRgb.b + (crestRgb.b - lineRgb.b) * hot;
      lc[cursor] = inkRgb.r + (r - inkRgb.r) * dim;
      lc[cursor + 1] = inkRgb.g + (g - inkRgb.g) * dim;
      lc[cursor + 2] = inkRgb.b + (b - inkRgb.b) * dim;
      cursor += 3;
    };

    for (let i = 0; i <= segX; i += 1) {
      for (let j = 0; j < segZ; j += 1) {
        write(i, j);
        write(i, j + 1);
      }
    }
    for (let j = 0; j <= segZ; j += 1) {
      for (let i = 0; i < segX; i += 1) {
        write(i, j);
        write(i + 1, j);
      }
    }
    linePos.needsUpdate = true;
    lineCol.needsUpdate = true;

    /* 3. The glow dots follow the same heights. */
    const pointPos = dots.geometry.getAttribute("position") as THREE.BufferAttribute;
    const pointCol = dots.geometry.getAttribute("color") as THREE.BufferAttribute;
    const pp = pointPos.array as Float32Array;
    const pc = pointCol.array as Float32Array;
    let point = 0;
    for (let i = 0; i <= segX; i += 2) {
      for (let j = 0; j <= segZ; j += 2) {
        const u = (i / segX - 0.5) * SHEET.w;
        const v = (j / segZ - 0.5) * SHEET.d;
        const y = field[i * (segZ + 1) + j];
        pp[point] = u;
        pp[point + 1] = y + 0.6;
        pp[point + 2] = v;
        const glow = Math.min(1, 0.24 + Math.abs(y) / 5.5);
        const dim = 0.2 + 0.8 * (1 - Math.min(1, Math.hypot(u, v) / (radius * 1.4)));
        const r = (lineRgb.r * 0.4 + crestRgb.r * 0.6) * glow;
        const g = (lineRgb.g * 0.4 + crestRgb.g * 0.6) * glow;
        const b = (lineRgb.b * 0.4 + crestRgb.b * 0.6) * glow;
        pc[point] = inkRgb.r + (r - inkRgb.r) * dim;
        pc[point + 1] = inkRgb.g + (g - inkRgb.g) * dim;
        pc[point + 2] = inkRgb.b + (b - inkRgb.b) * dim;
        point += 3;
      }
    }
    pointPos.needsUpdate = true;
    pointCol.needsUpdate = true;

    /* 4. Camera: a slow sway, the pointer lean, and the ink carries Ambient. */
    const sway = reduce ? 0 : Math.sin(t * 0.16) * 0.5;
    cam.position.x = p.easedX * 7 + sway;
    cam.position.y = 24 - p.easedY * 5;
    cam.position.z = 78 - ease * 22;
    cam.lookAt(0, 0.5 + p.easedY * 2, -6 + p.easedX * 2);

    /* Deck tilt toward the cursor keeps the grid bridge-like rather than flat. */
    lines.rotation.z = -p.easedX * 0.05;
    lines.rotation.x = -p.easedY * 0.03;
    dots.rotation.copy(lines.rotation);

    const visible = ambient > 0.02 ? 1 : 0;
    (lines.material as THREE.LineBasicMaterial).opacity = (0.32 + 0.58 * ambient) * ease * visible;
    (dots.material as THREE.PointsMaterial).opacity = (0.3 + 0.55 * ambient) * ease * visible;
    lines.visible = visible > 0;
    dots.visible = visible > 0;

    gl.render(sc, cam);
  });

  return (
    <div className="mathlab-field" aria-hidden="true">
      <canvas ref={ref} className="mathlab-field__canvas" />
    </div>
  );
}

export default MathField3D;
