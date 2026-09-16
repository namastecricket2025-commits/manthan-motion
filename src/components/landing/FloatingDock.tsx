import { cn } from "@/lib/utils";
import {
  AnimatePresence,
  motion,
  type MotionValue,
  useMotionValue,
  useSpring,
  useTransform,
} from "motion/react";
import { IconPlus } from "@tabler/icons-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";

export type DockItem = {
  title: string;
  icon: ReactNode;
  href: string;
};

/**
 * Aceternity-style Floating Dock, dressed in Manthan's glass surface language.
 * - Mobile (<md): collapsed trigger button that fans the links out
 *   (up by default; `mobileDirection="down"` for use inside a top navbar).
 * - Desktop (md+): inline pill of icons that magnify by mouse proximity,
 *   with a tooltip on hover.
 */
export function FloatingDock({
  items,
  desktopClassName,
  mobileClassName,
  mobileDirection = "up",
  minSize = 40,
  maxSize = 88,
  minIconSize = 20,
  maxIconSize = 46,
}: {
  items: DockItem[];
  desktopClassName?: string;
  mobileClassName?: string;
  mobileDirection?: "up" | "down";
  /** Desktop magnification bounds (px) — tune for compact placements like a navbar. */
  minSize?: number;
  maxSize?: number;
  minIconSize?: number;
  maxIconSize?: number;
}) {
  return (
    <>
      <FloatingDockDesktop
        items={items}
        className={desktopClassName}
        minSize={minSize}
        maxSize={maxSize}
        minIconSize={minIconSize}
        maxIconSize={maxIconSize}
      />
      <FloatingDockMobile
        items={items}
        className={mobileClassName}
        direction={mobileDirection}
      />
    </>
  );
}

/** Anchor that works for both hash links and SPA routes. */
function DockAnchor({
  href,
  className,
  onClick,
  children,
}: {
  href: string;
  className?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  if (href.startsWith("/")) {
    return (
      <Link to={href} className={className} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

function FloatingDockMobile({
  items,
  className,
  direction = "up",
}: {
  items: DockItem[];
  className?: string;
  direction?: "up" | "down";
}) {
  const [open, setOpen] = useState(false);
  const down = direction === "down";
  const rootRef = useRef<HTMLDivElement>(null);

  // Dismiss on Escape or a tap/click outside the dock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div
            className={cn(
              "absolute inset-x-0 flex flex-col items-center gap-2",
              down ? "top-full mt-2" : "bottom-full mb-2",
            )}
          >
            {items.map((item, idx) => {
              // Items nearest the trigger appear first in both directions.
              const enterDelay = (down ? idx : items.length - 1 - idx) * 0.05;
              const exitDelay = (down ? items.length - 1 - idx : idx) * 0.05;
              return (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: down ? -10 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{
                    opacity: 0,
                    y: down ? -10 : 10,
                    transition: { delay: exitDelay },
                  }}
                  transition={{ delay: enterDelay }}
                >
                  <DockAnchor
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="glass-chip flex h-10 w-10 items-center justify-center text-foreground transition-colors duration-200 hover:text-[var(--signal)]"
                  >
                    <div className="h-4 w-4">{item.icon}</div>
                  </DockAnchor>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="glass-chip btn-ghost inline-flex h-10 w-10 items-center justify-center text-foreground"
      >
        <IconPlus
          className={cn(
            "h-5 w-5 transition-transform duration-300",
            open && "rotate-45",
          )}
          strokeWidth={1.8}
        />
      </button>
    </div>
  );
}

function FloatingDockDesktop({
  items,
  className,
  minSize,
  maxSize,
  minIconSize,
  maxIconSize,
}: {
  items: DockItem[];
  className?: string;
  minSize: number;
  maxSize: number;
  minIconSize: number;
  maxIconSize: number;
}) {
  const mouseX = useMotionValue(Infinity);
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn(
        "glass-chip hidden h-16 items-end gap-3 px-4 pb-3 md:flex",
        className,
      )}
    >
      {items.map((item) => (
        <IconContainer
          mouseX={mouseX}
          key={item.title}
          minSize={minSize}
          maxSize={maxSize}
          minIconSize={minIconSize}
          maxIconSize={maxIconSize}
          {...item}
        />
      ))}
    </motion.div>
  );
}

function IconContainer({
  mouseX,
  title,
  icon,
  href,
  minSize,
  maxSize,
  minIconSize,
  maxIconSize,
}: {
  mouseX: MotionValue<number>;
  title: string;
  icon: ReactNode;
  href: string;
  minSize: number;
  maxSize: number;
  minIconSize: number;
  maxIconSize: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [hovered, setHovered] = useState(false);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const spring = { mass: 0.1, stiffness: 180, damping: 13 };
  const width = useSpring(
    useTransform(distance, [-120, 0, 120], [minSize, maxSize, minSize]),
    spring,
  );
  const height = useSpring(
    useTransform(distance, [-120, 0, 120], [minSize, maxSize, minSize]),
    spring,
  );
  const iconWidth = useSpring(
    useTransform(distance, [-120, 0, 120], [minIconSize, maxIconSize, minIconSize]),
    spring,
  );
  const iconHeight = useSpring(
    useTransform(distance, [-120, 0, 120], [minIconSize, maxIconSize, minIconSize]),
    spring,
  );

  return (
    <DockAnchor href={href} className="relative">
      <motion.div
        ref={ref}
        style={{ width, height }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex items-center justify-center rounded-full border border-transparent text-text-dim transition-colors duration-300 hover:border-[var(--card-border)] hover:text-[var(--signal)]"
      >
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="glass-chip absolute left-1/2 top-full z-50 mt-2 w-fit -translate-x-1/2 whitespace-nowrap px-2.5 py-1 font-display text-xs font-semibold text-foreground"
            >
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div
          style={{ width: iconWidth, height: iconHeight }}
          className="flex items-center justify-center"
        >
          {icon}
        </motion.div>
      </motion.div>
    </DockAnchor>
  );
}
