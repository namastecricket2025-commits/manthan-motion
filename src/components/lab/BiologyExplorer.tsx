import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dna, Droplets, HeartPulse, Leaf, Microscope, PawPrint, Wind } from "lucide-react";
import { SPRING } from "./use-canvas";
import Cell3D from "./bio/Cell3D";
import DnaHelix3D from "./bio/DnaHelix3D";
import HeartAnatomy from "./bio/HeartAnatomy";
import Respiratory from "./bio/Respiratory";
import Excretory from "./bio/Excretory";

type BioTab = "explorer" | "resp" | "excrete" | "dna" | "heart";

/* ── Structural explorer now delegates to the full WebGL Cell3D ── */
function ExplorerTab() {
  const [cellType, setCellType] = useState<"animal" | "plant">("animal");

  return (
    <div className="space-y-3">
      {/* toggle header */}
      <div className="lab-glass p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-100">
              Structural explorer — true cross-section
            </p>
            <p className="max-w-[620px] text-[11px] leading-relaxed text-slate-500">
              Microscopy-grade 3D: lipid bilayer, nuclear pores, folded rough ER,
              cristae-packed mitochondria, Golgi stacks &amp; cytoskeleton mesh.
              {cellType === "plant" ? " Plant mode adds wall, central vacuole & chloroplast thylakoids." : " Switch to plant to compare."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="lab-tabs !p-1">
              {(
                [
                  { id: "animal", label: "Animal", icon: PawPrint },
                  { id: "plant", label: "Plant", icon: Leaf },
                ] as const
              ).map((t) => {
                const active = cellType === t.id;
                const Icon = t.icon;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCellType(t.id)}
                    className="lab-tab !px-3.5 !py-1.5 text-xs"
                  >
                    {active && <motion.span layoutId="cell-type-pill" className="lab-pill" transition={SPRING} />}
                    <Icon className={`relative z-10 h-3.5 w-3.5 ${active ? "text-[#ff647c]" : "text-slate-500"}`} />
                    <span className="relative z-10">{t.label}</span>
                  </button>
                );
              })}
            </div>
            <span className="hidden items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-2.5 py-1 text-[11px] text-slate-500 sm:inline-flex">
              <Microscope className="h-3 w-3 text-[#67e8f9]" />
              WebGL · Three.js
            </span>
          </div>
        </div>

        <Cell3D cellType={cellType} />

        {/* post-canvas teaching strip */}
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-bold tracking-wide text-[#67e8f9]">MEMBRANE</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Double leaflet + exposed phospholipid heads (180 instances). Drag the violet <b className="text-[#a78bfa]">K⁺</b> or amber{" "}
              <b className="text-[#fbbf24]">Ca²⁺</b> spheres through a cyan channel ring to trigger the transport ripple.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-bold tracking-wide text-[#a78bfa]">NUCLEUS</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Envelope is double-walled with 16 nuclear pores (torus + pore). Inside: chromatin blobs &amp; a pink nucleolus. Rough ER sheets fold
              directly off the outer envelope, studded with paired ribosome subunits.
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
            <p className="text-[11px] font-bold tracking-wide text-[#f87171]">ENERGY &amp; TRANSPORT</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Five mitochondria each with matrix, inter-membrane space &amp; stacked cristae lamellae (visible at close orbit). Stacked Golgi
              cisternae bud vesicles; microtubules radiate from centrosome, actin belt lines the cortex.
            </p>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {[
            "Lipid bilayer ×2",
            "16 nuclear pores",
            "Rough ER + ribosomes",
            "Smooth ER network",
            "5× mitochondria cristae",
            "Golgi 4-stack",
            "Cytoskeleton MT",
            "3 ion channels",
            "2 ion species · 10 spheres",
          ].map((k) => (
            <span key={k} className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[10px] leading-none text-slate-400">
              {k}
            </span>
          ))}
          {cellType === "plant" && (
            <>
              {["Cell wall (wireframe)", "Central vacuole · tonoplast", "5 chloroplasts: grana + stroma", "Plasmodesmata ×8"].map((k) => (
                <span key={k} className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-1 text-[10px] leading-none text-emerald-200">
                  {k}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── shell ── */
export default function BiologyExplorer() {
  const [tab, setTab] = useState<BioTab>("explorer");
  return (
    <div className="space-y-4">
      <div className="lab-tabs">
        {(
          [
            { key: "explorer", label: "Cell", icon: Microscope },
            { key: "resp", label: "Respiratory", icon: Wind },
            { key: "excrete", label: "Excretory", icon: Droplets },
            { key: "dna", label: "DNA", icon: Dna },
            { key: "heart", label: "Heart", icon: HeartPulse },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className="lab-tab">
              {active && <motion.span layoutId="bio-sub-pill" className="lab-pill" transition={SPRING} />}
              <Icon className={`relative z-10 h-4 w-4 ${active ? "text-[#ff647c]" : "text-slate-500"}`} />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {tab === "explorer" && (
          <motion.div
            key="explorer"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <ExplorerTab />
          </motion.div>
        )}
        {tab === "resp" && (
          <motion.div
            key="resp"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <Respiratory />
          </motion.div>
        )}
        {tab === "excrete" && (
          <motion.div
            key="excrete"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <Excretory />
          </motion.div>
        )}
        {tab === "dna" && (
          <motion.div
            key="dna"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <DnaHelix3D />
          </motion.div>
        )}
        {tab === "heart" && (
          <motion.div
            key="heart"
            initial={{ opacity: 0, y: 14, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            <HeartAnatomy />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
