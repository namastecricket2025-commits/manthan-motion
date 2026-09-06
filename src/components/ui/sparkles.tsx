import { cn } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

interface SparkleSpec {
  id: string;
  x: number;
  y: number;
  size: number;
  delay: number;
  duration: number;
}

function buildSparkles(count: number, seed: number): SparkleSpec[] {
  // Deterministic pseudo-random so SSR/CSR and re-renders stay stable.
  let s = seed || 1;
  const rand = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  return Array.from({ length: count }, (_, i) => ({
    id: `sp-${i}`,
    x: 8 + rand() * 84,
    y: 10 + rand() * 80,
    size: 8 + rand() * 12,
    delay: rand() * 4,
    duration: 2.8 + rand() * 2.6,
  }));
}

/**
 * Magic UI–style ambient sparkles: a few small SVG four-point stars that
 * twinkle on an independent loop. Purely decorative — disabled under
 * reduced-motion via the global CSS override.
 */
export function Sparkles({
  className,
  count = 8,
  seed = 7,
}: {
  className?: string;
  count?: number;
  seed?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);
  const [h, setH] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setW(entry.contentRect.width);
      setH(entry.contentRect.height);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sparkles = useMemo(() => buildSparkles(count, seed), [count, seed]);

  return (
    <div
      ref={ref}
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      {w > 0 &&
        h > 0 &&
        sparkles.map((sp) => (
          <svg
            key={sp.id}
            className="sparkle absolute"
            style={{
              left: `${(sp.x / 100) * w}px`,
              top: `${(sp.y / 100) * h}px`,
              width: sp.size,
              height: sp.size,
              animationDelay: `${sp.delay}s`,
              animationDuration: `${sp.duration}s`,
            }}
            viewBox="0 0 24 24"
            fill="none"
          >
            <path
              d="M12 1.5c.7 5.2 1.6 6.7 10.5 10.5C13.6 15.8 12.7 17.3 12 22.5 11.3 17.3 10.4 15.8 1.5 12 10.4 8.2 11.3 6.7 12 1.5Z"
              fill="var(--text-main)"
            />
          </svg>
        ))}
    </div>
  );
}

export default Sparkles;
