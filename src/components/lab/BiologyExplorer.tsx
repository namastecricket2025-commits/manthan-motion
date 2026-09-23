import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Dna, Droplets, HeartPulse, Leaf, Microscope, MousePointer2, PawPrint, Wind } from "lucide-react";
import { SPRING } from "./use-canvas";
import Cell3D from "./bio/Cell3D";
import DnaHelix3D from "./bio/DnaHelix3D";
import HeartAnatomy from "./bio/HeartAnatomy";
import Respiratory from "./bio/Respiratory";
import Excretory from "./bio/Excretory";

type BioTab = "explorer" | "resp" | "excrete" | "dna" | "heart";

const TABS: { key: BioTab; label: string; icon: typeof Dna }[] = [
  { key: "explorer", label: "Cell", icon: Microscope },
  { key: "resp", label: "Respiratory", icon: Wind },
  { key: "excrete", label: "Excretory", icon: Droplets },
  { key: "dna", label: "DNA", icon: Dna },
  { key: "heart", label: "Heart", icon: HeartPulse },
];

/* ── Structural explorer: the WebGL cell cross-section ── */
function ExplorerTab() {
  const [cellType, setCellType] = useState<"animal" | "plant">("animal");

  return (
    <div className="lab-split">
      <div className="lab-stage-pane lab-glass p-2.5 sm:p-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-slate-100">
              {cellType === "plant" ? "Plant cell" : "Animal cell"} — true cross-section
            </p>
            <p className="hidden text-[11px] text-slate-500 sm:block">
              Tap any organelle for its name and job · drag the glowing K⁺ / Ca²⁺ spheres through a cyan channel
            </p>
          </div>
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
                <button key={t.id} type="button" onClick={() => setCellType(t.id)} className="lab-tab !px-3 !py-1.5 text-xs">
                  {active && <motion.span layoutId="cell-type-pill" className="lab-pill" transition={SPRING} />}
                  <Icon className={`relative z-10 h-3.5 w-3.5 ${active ? "text-[#aab3ff]" : "text-slate-500"}`} />
                  <span className="relative z-10">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <Cell3D cellType={cellType} />
      </div>

      <div className="lab-deck-pane lab-glass-deep space-y-3 p-3.5">
        <div className="rounded-xl border border-white/10 bg-black/25 p-2.5">
          <p className="lab-label mb-1.5">Try this</p>
          <ul className="space-y-1 text-[11px] leading-relaxed text-slate-400">
            <li className="flex gap-2">
              <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[#67e8f9]" />
              Drag a violet <b className="text-[#a78bfa]">K⁺</b> or amber <b className="text-[#fbbf24]">Ca²⁺</b> sphere into a cyan channel ring — the membrane flashes as the ion is pumped across.
            </li>
            <li className="flex gap-2">
              <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[#67e8f9]" />
              {cellType === "plant"
                ? "Zoom into a chloroplast to see the grana stacks and the starch grain."
                : "Zoom close on a mitochondrion: the inner membrane folds into cristae that carry the ATP synthase."}
            </li>
            <li className="flex gap-2">
              <MousePointer2 className="mt-0.5 h-3 w-3 shrink-0 text-[#67e8f9]" />
              Orbit with one finger, pinch to zoom, two fingers to pan.
            </li>
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
          {(cellType === "plant"
            ? ["Cell wall — cellulose", "Central vacuole + tonoplast", "5 chloroplasts: grana", "Plasmodesmata ×8", "Rough ER + ribosomes", "Nitochondria ×5"]
            : ["Lipid bilayer ×2 leaflets", "16 nuclear pores", "Rough ER + ribosomes", "5× mitochondria cristae", "Golgi 4-stack + vesicles", "Cytoskeleton MT + actin"]
          ).map((k) => (
            <span key={k} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── shell ── */
export default function BiologyExplorer() {
  const [tab, setTab] = useState<BioTab>("explorer");

  return (
    <div className="lab-col">
      <div className="lab-tabs">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button key={t.key} type="button" onClick={() => setTab(t.key)} className="lab-tab">
              {active && <motion.span layoutId="bio-sub-pill" className="lab-pill" transition={SPRING} />}
              <Icon className={`relative z-10 h-4 w-4 ${active ? "text-[#aab3ff]" : "text-slate-500"}`} />
              <span className="relative z-10">{t.label}</span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {TABS.map((t) =>
          t.key === tab ? (
            <motion.div
              key={t.key}
              className="lab-col"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.26, ease: "easeOut" }}
            >
              {tab === "explorer" && <ExplorerTab />}
              {tab === "resp" && <Respiratory />}
              {tab === "excrete" && <Excretory />}
              {tab === "dna" && <DnaHelix3D />}
              {tab === "heart" && <HeartAnatomy />}
            </motion.div>
          ) : null,
        )}
      </AnimatePresence>
    </div>
  );
}
