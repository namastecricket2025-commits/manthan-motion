import { motion } from "framer-motion";
import { Link } from "react-router";
import MeshBackground from "@/components/MeshBackground";

/**
 * 404 — same visual world as the rest of the site: the crimson canvas engine
 * behind a frosted glass card, with theme ink instead of the default grey
 * template colours.
 */
export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative flex min-h-screen flex-col"
    >
      <MeshBackground />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4">
        <div className="glass-panel w-full max-w-md px-6 py-12 text-center sm:px-10">
          <span className="kicker">Off the map</span>
          <h1 className="mt-5 font-display text-5xl font-bold tracking-tight text-foreground">
            404
          </h1>
          <p className="mt-3 text-base leading-relaxed text-text-dim">
            This page could not be found — the link may be old, or the route
            may have moved.
          </p>
          <Link
            to="/"
            className="moving-border mt-8 inline-flex"
          >
            <span className="moving-border__inner inline-flex items-center justify-center rounded-full px-6 py-3 font-display text-sm font-semibold tracking-wide">
              Back to home
            </span>
          </Link>
        </div>
      </div>
    </motion.div>
  );
}
