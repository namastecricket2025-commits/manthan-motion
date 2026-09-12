import { useEffect, useRef } from "react";
import * as THREE from "three";
import { syncViewport, useCanvasSize, useRaf, useViewport, useWheelZoom, clamp } from "./use-canvas";

interface Atom3DProps {
  z: number;
  shells: number[];
  symbol: string;
  orbitals: boolean;
}

const MAX_RINGS = 7;
const POOL = 36; // max electrons per shell pool (N shell = 32)

function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 1, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/**
 * Interactive 3D atom built on three.js — left-drag rotates, wheel zooms,
 * right-drag pans, two-finger pinch zooms on touch. Electrons are additive
 * glow sprites on tilted orbital rings; the quantum-orbital toggle overlays
 * translucent s-spheres and p-dumbbell probability clouds.
 */
export default function Atom3D({ z, shells, symbol, orbitals }: Atom3DProps) {
  const { ref, size } = useCanvasSize<HTMLCanvasElement>();
  const vp = useViewport();
  const ren = useRef<THREE.WebGLRenderer | null>(null);
  const scene = useRef<THREE.Scene | null>(null);
  const camera = useRef<THREE.PerspectiveCamera | null>(null);
  const atom = useRef<THREE.Group | null>(null);
  const nucleus = useRef<THREE.Mesh | null>(null);
  const rings = useRef<THREE.LineLoop[]>([]);
  const electrons = useRef<THREE.Group[][]>([]);
  const orbitalsG = useRef<THREE.Group | null>(null);

  const cam = useRef({ yaw: 0.65, pitch: 0.32, dist: 340, panX: 0, panY: 0 });
  const p = useRef({ z, shells, orbitals });
  p.current = { z, shells, orbitals };
  const dragging = useRef(false);

  /* ---------- scene setup (once) ---------- */
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000, 0);
    const sc = new THREE.Scene();
    const cam3 = new THREE.PerspectiveCamera(45, 1, 1, 2000);
    cam3.position.set(0, 0, 340);
    const grp = new THREE.Group();
    grp.rotation.order = "YXZ";
    sc.add(grp);
    ren.current = renderer;
    scene.current = sc;
    camera.current = cam3;
    atom.current = grp;

    sc.add(new THREE.AmbientLight(0xffffff, 0.6));
    const pl = new THREE.PointLight(0xff3b5c, 2.2, 420);
    sc.add(pl);

    // nucleus
    const nuc = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshStandardMaterial({ color: 0xff5c76, emissive: 0xff2e55, emissiveIntensity: 0.9, roughness: 0.25 }),
    );
    grp.add(nuc);
    nucleus.current = nuc;
    pl.position.copy(nuc.position);

    // shell rings
    for (let i = 0; i < MAX_RINGS; i++) {
      const r = 42 + 26 * i;
      const geo = new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 97 }, (_, k) => {
          const th = (k / 96) * Math.PI * 2;
          return new THREE.Vector3(r * Math.cos(th), r * Math.sin(th), 0);
        }),
      );
      const ring = new THREE.LineLoop(
        geo,
        new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35 }),
      );
      ring.rotation.x = 0.55 * Math.sin(i * 2.35 + 0.7);
      grp.add(ring);
      rings.current.push(ring);
    }

    // electron pool: glow sprite + white core per ring
    const glowTex = makeGlowTexture();
    const ringsArr: THREE.Group[][] = [];
    for (let i = 0; i < MAX_RINGS; i++) {
      const pool: THREE.Group[] = [];
      for (let j = 0; j < POOL; j++) {
        const el = new THREE.Group();
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: glowTex,
            color: 0x67e8f9,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            transparent: true,
          }),
        );
        sprite.scale.setScalar(11);
        el.add(sprite);
        const core = new THREE.Mesh(
          new THREE.SphereGeometry(1.5, 12, 12),
          new THREE.MeshBasicMaterial({ color: 0xe0faff }),
        );
        el.add(core);
        el.visible = false;
        grp.add(el);
        pool.push(el);
      }
      ringsArr.push(pool);
    }
    electrons.current = ringsArr;

    // quantum orbital clouds (unit size; scaled per frame)
    const og = new THREE.Group();
    const sCloud = new THREE.Mesh(
      new THREE.SphereGeometry(1, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xa78bfa,
        transparent: true,
        opacity: 0.1,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    og.add(sCloud);
    const lobeMat = new THREE.MeshBasicMaterial({
      color: 0xff3b5c,
      transparent: true,
      opacity: 0.16,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    const axes: [number, number, number][] = [
      [1, 0, 0],
      [0, 1, 0],
      [0, 0, 1],
    ];
    for (const [ax, ay, az] of axes) {
      for (const sgn of [1, -1]) {
        const lobe = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 24), lobeMat);
        lobe.position.set(ax * sgn * 0.62, ay * sgn * 0.62, az * sgn * 0.62);
        og.add(lobe);
      }
    }
    og.visible = false;
    grp.add(og);
    orbitalsG.current = og;

    return () => {
      sc.traverse((obj) => {
        if (obj instanceof THREE.Sprite) {
          if (obj.material.map) obj.material.map.dispose();
          obj.material.dispose();
          return;
        }
        const mesh = obj as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
        if (mat) {
          for (const m of Array.isArray(mat) ? mat : [mat]) {
            if ("map" in m && (m as { map?: THREE.Texture }).map) {
              (m as { map?: THREE.Texture }).map!.dispose();
            }
            m.dispose();
          }
        }
      });
      glowTex.dispose();
      renderer.dispose();
      ren.current = null;
      scene.current = null;
      camera.current = null;
      atom.current = null;
      nucleus.current = null;
      rings.current = [];
      electrons.current = [];
      orbitalsG.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- per-frame render ---------- */
  useRaf((dt, t) => {
    const renderer = ren.current;
    const sc = scene.current;
    const cam3 = camera.current;
    const grp = atom.current;
    if (!renderer || !sc || !cam3 || !grp) return;

    const c = cam.current;
    if (!dragging.current) c.yaw += dt * 0.1; // idle auto-rotate
    grp.rotation.y = c.yaw;
    grp.rotation.x = c.pitch;

    const { w, h, dpr } = size.current;
    const cssW = w / Math.max(1, dpr);
    const cssH = h / Math.max(1, dpr);
    // size only on a real box change, never mid-drag (canvas.width resets the buffer)
    syncViewport(vp.current, renderer, cam3, cssW, cssH, dragging.current !== null);
    cam3.position.set(c.panX, c.panY, c.dist);

    const P = p.current;
    // nucleus
    if (nucleus.current) nucleus.current.scale.setScalar(11 + Math.min(5, P.z * 0.03));

    // rings + electrons
    P.shells.forEach((count, si) => {
      const ring = rings.current[si];
      if (ring) ring.visible = true;
      const pool = electrons.current[si];
      if (!pool) return;
      const r = 42 + 26 * si;
      const tilt = 0.55 * Math.sin(si * 2.35 + 0.7);
      const dir = si % 2 === 0 ? 1 : -1;
      const speed = 0.9 + 0.28 * si;
      const n = Math.min(POOL, count);
      for (let j = 0; j < POOL; j++) {
        const el = pool[j];
        if (j < n) {
          const th = (j / n) * Math.PI * 2 + t * speed * dir + si * 0.7;
          el.position.set(r * Math.cos(th), r * Math.sin(th) * Math.cos(tilt), r * Math.sin(th) * Math.sin(tilt));
          el.visible = true;
        } else {
          el.visible = false;
        }
      }
    });
    for (let si = P.shells.length; si < MAX_RINGS; si++) {
      if (rings.current[si]) rings.current[si].visible = false;
      const pool = electrons.current[si];
      if (pool) for (const el of pool) el.visible = false;
    }

    // orbitals
    if (orbitalsG.current) {
      orbitalsG.current.visible = P.orbitals && P.shells.length > 0;
      const rMax = 42 + 26 * (P.shells.length - 1);
      orbitalsG.current.children.forEach((child, i) => {
        if (i === 0) {
          child.scale.setScalar(rMax * 0.46);
        } else {
          const ax = (i - 1) % 3;
          const sgn = (i - 1) % 2 === 0 ? 1 : -1;
          const rl = rMax * 0.4;
          const s = new THREE.Vector3(1, 1, 1);
          s.setComponent(ax, 1.8);
          child.scale.copy(s).multiplyScalar(rl);
          const pos = new THREE.Vector3();
          pos.setComponent(ax, sgn * rMax * 0.55);
          child.position.copy(pos);
        }
      });
    }

    renderer.render(sc, cam3);
  });

  /* ---------- interaction ---------- */
  const pointers = useRef(new Map<number, { x: number; y: number; button: number }>());
  const pinch = useRef(0);

  useWheelZoom(ref, (dy) => {
    const c = cam.current;
    c.dist = clamp(c.dist * (dy > 0 ? 1.09 : 0.92), 180, 620);
  });

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = Math.hypot(a.x - b.x, a.y - b.y);
    }
    dragging.current = true;
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY, button: e.button });
    const c = cam.current;
    if (pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch.current > 0) c.dist = clamp(c.dist * (dist / pinch.current), 180, 620);
      pinch.current = dist;
    } else if (prev.button === 2) {
      c.panX += dx * 0.5;
      c.panY -= dy * 0.5;
    } else {
      c.yaw += dx * 0.008;
      c.pitch = clamp(c.pitch + dy * 0.008, -1.25, 1.25);
    }
  };
  const endPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) dragging.current = false;
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
        {symbol} · Z = {z} · DRAG rotate · SCROLL zoom · RIGHT-DRAG pan
      </span>
    </div>
  );
}