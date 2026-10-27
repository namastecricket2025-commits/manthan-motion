import { SPRING, useStillMotion } from "@/lib/motion";
import { motion, useMotionValue, useSpring, useTransform } from "motion/react";
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type ReactNode,
} from "react";

/**
 * The product frame, with weight behind it.
 *
 * A screenshot in a rectangle is the flattest thing a product page can show,
 * so the frame answers the pointer: it leans a couple of degrees toward the
 * cursor while the surface inside it slides the other way. That counter-slide
 * is the whole effect — it is what makes the panel read as one lit object
 * standing in front of the page instead of a picture pasted onto it.
 *
 * The numbers are small on purpose. 2.4° is about the most a full-width panel
 * can lean before its far corners visibly leave the layout, 1.8° is the same
 * idea on the shorter axis, and the 5px of counter-slide is under the width of
 * the frame's own hairline. All four movements ride the app's one spring
 * (`lib/motion`), so crossing the frame quickly settles with weight instead of
 * snapping, and leaving it lets the frame sit back down on its own.
 *
 * This is not a light. Nothing here glows, brightens or changes colour; the
 * frame's hairline and fill are what you see move, and only while the pointer
 * is over it.
 *
 * Gated three ways, and free when it does not apply: without a real pointer
 * (touch), under reduced motion, or in Motionless Mode no listener is attached
 * and no transform is ever written — the frame renders flat.
 */
export function TiltFrame({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const root = useRef<HTMLDivElement | null>(null);
  const still = useStillMotion();
  const [live, setLive] = useState(false);

  /** Where the pointer sits inside the frame, as −1…1 on each axis. */
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);

  const spring = {
    stiffness: SPRING.stiffness,
    damping: SPRING.damping,
    mass: SPRING.mass,
  };
  const rotateY = useSpring(useTransform(pointerX, [-1, 1], [-2.4, 2.4]), spring);
  const rotateX = useSpring(useTransform(pointerY, [-1, 1], [1.8, -1.8]), spring);
  const slideX = useSpring(useTransform(pointerX, [-1, 1], [5, -5]), spring);
  const slideY = useSpring(useTransform(pointerY, [-1, 1], [4, -4]), spring);

  useEffect(() => {
    if (still) {
      setLive(false);
      return;
    }
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => setLive(fine.matches);
    sync();
    fine.addEventListener("change", sync);
    return () => fine.removeEventListener("change", sync);
  }, [still]);

  const track = (event: PointerEvent<HTMLDivElement>) => {
    const el = root.current;
    if (!el) return;
    const box = el.getBoundingClientRect();
    if (!box.width || !box.height) return;
    pointerX.set(((event.clientX - box.left) / box.width) * 2 - 1);
    pointerY.set(((event.clientY - box.top) / box.height) * 2 - 1);
  };

  /* Leaving lets the springs carry everything back to flat. */
  const rest = () => {
    pointerX.set(0);
    pointerY.set(0);
  };

  return (
    <div
      ref={root}
      style={{ perspective: "1400px" }}
      onPointerMove={live ? track : undefined}
      onPointerLeave={live ? rest : undefined}
    >
      <motion.div
        className={className}
        style={live ? { rotateX, rotateY } : undefined}
      >
        <motion.div style={live ? { x: slideX, y: slideY } : undefined}>
          {children}
        </motion.div>
      </motion.div>
    </div>
  );
}

export default TiltFrame;
