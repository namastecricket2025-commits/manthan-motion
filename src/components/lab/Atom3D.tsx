import { useRef } from "react";
import { useCanvasSize, useRaf, useWheelZoom, clamp } from "./use-canvas";

interface Atom3DProps {
  z: number;
  shells: number[];
  symbol: string;
  orbitals: boolean;
}

interface Cam {
  yaw: number;
  pitch: number;
  dist: number;
  panX: number;
  panY: number;
}

/**
 * Interactive 3D atom — a lightweight canvas projection engine.
 * Left-drag rotates, wheel zooms, right-drag pans (two-finger pinch on touch).
 * Electrons orbit on tilted shells; a toggle overlays quantum probability
 * clouds (s-sphere + p-dumbbells) around the nucleus.
 */
export default function Atom3D({ z, shells, symbol, orbitals }: Atom3DProps) {
  const { ref, size } = useCanvasSize<HTMLCanvasElement>();
  const cam = useRef<Cam>({ yaw: 0.65, pitch: 0.32, dist: 300, panX: 0, panY: 0 });
  const props = useRef({ z, shells, orbitals });
  props.current = { z, shells, orbitals };

  // pointer bookkeeping (multi-touch aware)
  const pointers = useRef(new Map<number, { x: number; y: number; button: number }>());
  const drag = useRef<{ mode: "rot" | "pan" | "pinch"; lastDist: number } | null>(null);

  useWheelZoom(ref, (dy) => {
    const c = cam.current;
    c.dist = clamp(c.dist * (dy > 0 ? 1.09 : 0.92), 170, 560);
  });

  useRaf((dt, t) => {
    const canvas = ref.current;
    if (!canvas) return;
    const { w, h, dpr } = size.current;
    if (!w || !h) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { z: Z, shells: SH, orbitals: orb } = props.current;

    const c = cam.current;
    if (!drag.current) c.yaw += dt * 0.1; // idle auto-rotate

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const cx = w / 2 + c.panX;
    const cy = h / 2 + c.panY;

    const cosP = Math.cos(c.pitch);
    const sinP = Math.sin(c.pitch);
    const cosY = Math.cos(c.yaw);
    const sinY = Math.sin(c.yaw);
    const F = 640;

    const project = (x: number, y: number, zz: number) => {
      // pitch about X
      const y1 = y * cosP - zz * sinP;
      const z1 = y * sinP + zz * cosP;
      // yaw about Y
      const x2 = x * cosY + z1 * sinY;
      const z2 = -x * sinY + z1 * cosY;
      const s = F / (F + c.dist + z2);
      return { x: cx + x2 * s, y: cy - y1 * s, s, z2 };
    };

    const p0 = project(0, 0, 0);

    // ---- nucleus glow ----
    const nucR = 12 + Math.min(5, Z * 0.035);
    const grad = ctx.createRadialGradient(p0.x, p0.y, 1, p0.x, p0.y, nucR * 2.6);
    grad.addColorStop(0, "rgba(255,255,255,0.95)");
    grad.addColorStop(0.35, "rgba(255,100,124,0.9)");
    grad.addColorStop(1, "rgba(255,59,92,0)");
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, nucR * 2.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "#ffd9de";
    ctx.beginPath();
    ctx.arc(p0.x, p0.y, nucR, 0, Math.PI * 2);
    ctx.fill();

    // ---- orbital rings (projected ellipses) ----
    const ringPts: { x: number; y: number; s: number; z2: number }[][] = [];
    SH.forEach((_, si) => {
      const r = 42 + 26 * si;
      const tilt = 0.55 * Math.sin(si * 2.35 + 0.7);
      const pts: { x: number; y: number; s: number; z2: number }[] = [];
      const N = 48;
      for (let i = 0; i < N; i++) {
        const th = (i / N) * Math.PI * 2;
        const x = r * Math.cos(th);
        const y = r * Math.sin(th) * Math.cos(tilt);
        const zz = r * Math.sin(th) * Math.sin(tilt);
        pts.push(project(x, y, zz));
      }
      ringPts.push(pts);
    });
    // draw rings far → near by average depth
    const order = ringPts
      .map((pts, i) => ({ i, z: pts.reduce((a, p) => a + p.z2, 0) / pts.length }))
      .sort((a, b) => b.z - a.z);
    for (const { i } of order) {
      ctx.strokeStyle = "rgba(148,163,184,0.35)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      const pts = ringPts[i];
      pts.forEach((p, j) => (j === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
    }

    // ---- electrons ----
    const electrons: { x: number; y: number; s: number; z2: number }[] = [];
    SH.forEach((count, si) => {
      const r = 42 + 26 * si;
      const tilt = 0.55 * Math.sin(si * 2.35 + 0.7);
      const dir = si % 2 === 0 ? 1 : -1;
      const speed = 0.9 + 0.28 * si;
      for (let i = 0; i < count; i++) {
        const th = (i / count) * Math.PI * 2 + t * speed * dir + si * 0.7;
        const x = r * Math.cos(th);
        const y = r * Math.sin(th) * Math.cos(tilt);
        const zz = r * Math.sin(th) * Math.sin(tilt);
        electrons.push(project(x, y, zz));
      }
    });
    electrons.sort((a, b) => b.z2 - a.z2);
    for (const e of electrons) {
      const er = 3.4 * e.s;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const eg = ctx.createRadialGradient(e.x, e.y, 0.5, e.x, e.y, er * 3);
      eg.addColorStop(0, "rgba(255,255,255,1)");
      eg.addColorStop(0.4, "rgba(103,232,249,0.95)");
      eg.addColorStop(1, "rgba(34,211,238,0)");
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(e.x, e.y, er * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // ---- quantum orbital clouds ----
    if (orb && SH.length > 0) {
      const rMax = 42 + 26 * (SH.length - 1);
      // s-cloud: translucent sphere
      const sc = project(0, 0, 0);
      const sR = rMax * 0.46 * sc.s;
      const sg = ctx.createRadialGradient(sc.x, sc.y, 1, sc.x, sc.y, sR);
      sg.addColorStop(0, "rgba(167,139,250,0.28)");
      sg.addColorStop(1, "rgba(167,139,250,0)");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.arc(sc.x, sc.y, sR, 0, Math.PI * 2);
      ctx.fill();

      // p-dumbbells along x, y, z
      const lobes: { ax: number; ay: number; az: number }[] = [
        { ax: 1, ay: 0, az: 0 },
        { ax: 0, ay: 1, az: 0 },
        { ax: 0, ay: 0, az: 1 },
      ];
      const pR = rMax * 0.36;
      for (const L of lobes) {
        for (const sgn of [1, -1]) {
          const pc = project(L.ax * pR * sgn, L.ay * pR * sgn, L.az * pR * sgn);
          const lr = pR * 0.52 * pc.s;
          const lg = ctx.createRadialGradient(pc.x, pc.y, 1, pc.x, pc.y, lr);
          lg.addColorStop(0, "rgba(255,59,92,0.30)");
          lg.addColorStop(1, "rgba(255,59,92,0)");
          ctx.fillStyle = lg;
          ctx.beginPath();
          ctx.ellipse(pc.x, pc.y, lr, lr * 0.8, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    // ---- label ----
    ctx.fillStyle = "rgba(148,163,184,0.85)";
    ctx.font = "600 12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textAlign = "center";
    ctx.fillText(`${symbol} · Z = ${Z} · scale ${Math.round((F / (F + c.dist)) * 100)}%`, cx, h - 10);
  });

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      drag.current = {
        mode: "pinch",
        lastDist: Math.hypot(a.x - b.x, a.y - b.y),
      };
    } else {
      drag.current = { mode: e.button === 2 ? "pan" : "rot", lastDist: 0 };
    }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    const d = drag.current;
    if (!d) return;
    const c = cam.current;
    if (d.mode === "pinch" && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      c.dist = clamp(c.dist * (d.lastDist > 0 ? dist / d.lastDist : 1), 170, 560);
      d.lastDist = dist;
    } else if (d.mode === "rot") {
      c.yaw += dx * 0.008;
      c.pitch = clamp(c.pitch + dy * 0.008, -1.25, 1.25);
    } else {
      c.panX += dx;
      c.panY += dy;
    }
  };
  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) drag.current = null;
  };

  return (
    <div className="relative">
      <canvas
        ref={ref}
        className="h-64 w-full cursor-grab touch-none rounded-2xl bg-[radial-gradient(circle_at_50%_40%,#16233b_0%,#0b1120_75%)] ring-1 ring-white/5 active:cursor-grabbing sm:h-72"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onContextMenu={(e) => e.preventDefault()}
      />
      <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 text-[9px] tracking-wide text-slate-400">
        DRAG rotate · SCROLL zoom · RIGHT-DRAG pan
      </span>
    </div>
  );
}