import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  Atom,
  Camera,
  Check,
  ChevronRight,
  Copy,
  Dna,
  FlaskConical,
  Gauge,
  HeartPulse,
  Loader2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  ScanSearch,
  Sparkles,
  Volume2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { pickAviaVoice, speakText, stopSpeaking } from "@/components/voice/avia";
import { isSoundEnabled, setSoundEnabled } from "./lab-sound";
import "./lab.css";

type Subject = "physics" | "chemistry" | "biology";

type Chapter = {
  id: string;
  label: string;
  prompt: string;
  formula: string;
  concept: string;
};

type StemSolution = {
  title: string;
  domain: string;
  inputs: string[];
  formulas: string[];
  steps: string[];
  answer: string;
  model: string;
};

const SUBJECTS: Array<{ id: Subject; label: string; icon: typeof Atom; chapters: Chapter[] }> = [
  {
    id: "physics",
    label: "Physics",
    icon: Atom,
    chapters: [
      { id: "mechanics", label: "Mechanics", prompt: "A 2 kg block accelerates at 3 m/s². Find the net force.", formula: "F = ma", concept: "Newton's Second Law" },
      { id: "optics", label: "Optics", prompt: "An object is placed 30 cm from a convex lens of focal length 10 cm. Find the image distance.", formula: "1/f = 1/v − 1/u", concept: "Lens Formula" },
      { id: "waves", label: "Waves", prompt: "A wave has frequency 50 Hz and wavelength 4 m. Find its speed.", formula: "v = fλ", concept: "Wave Equation" },
    ],
  },
  {
    id: "chemistry",
    label: "Chemistry",
    icon: FlaskConical,
    chapters: [
      { id: "molecules", label: "Molecular structure", prompt: "Explain the bonding and shape of H2O.", formula: "H₂O", concept: "Molecular Geometry" },
      { id: "reactions", label: "Reactions", prompt: "Balance the combustion reaction of methane with oxygen.", formula: "CH₄ + 2O₂ → CO₂ + 2H₂O", concept: "Conservation of Atoms" },
      { id: "periodic", label: "Periodic trends", prompt: "Explain why atomic radius decreases across Period 3.", formula: "Z_eff = Z − S", concept: "Effective Nuclear Charge" },
    ],
  },
  {
    id: "biology",
    label: "Biology",
    icon: Dna,
    chapters: [
      { id: "cell", label: "Cell anatomy", prompt: "Explain the function of mitochondria in a eukaryotic cell.", formula: "ATP = energy currency", concept: "Cellular Respiration" },
      { id: "genetics", label: "Genetics", prompt: "Explain how DNA replication produces two identical DNA molecules.", formula: "A → T · T → A", concept: "Base Pairing" },
      { id: "systems", label: "Body systems", prompt: "Explain how the human heart maintains blood circulation.", formula: "CO = HR × SV", concept: "Cardiac Cycle" },
    ],
  },
];

function subjectFor(id: Subject) {
  return SUBJECTS.find((subject) => subject.id === id) ?? SUBJECTS[0];
}

function PhysicsCanvas({ chapter, playing, onToggle }: { chapter: Chapter; playing: boolean; onToggle: () => void }) {
  const [position, setPosition] = useState(18);
  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const delta = Math.min(0.04, (now - last) / 1000);
      last = now;
      setPosition((value) => value >= 78 ? 18 : value + delta * 18);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing]);

  return (
    <div className="stem-visual stem-physics">
      <div className="stem-visual__head">
        <div><span className="stem-visual__eyebrow">Simulation canvas</span><h3>{chapter.label} / vector field</h3></div>
        <button type="button" className="stem-play" onClick={onToggle}>{playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{playing ? "Pause" : "Play"}</button>
      </div>
      <svg viewBox="0 0 640 330" role="img" aria-label="Animated physics vector diagram" className="stem-physics__svg">
        <defs><linearGradient id="stemAxis" x1="0" x2="1"><stop stopColor="#4e9fff" stopOpacity="0"/><stop offset=".5" stopColor="#9cc7ff" stopOpacity=".5"/><stop offset="1" stopColor="#4e9fff" stopOpacity="0"/></linearGradient><filter id="stemGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
        <line x1="36" y1="172" x2="604" y2="172" stroke="url(#stemAxis)" strokeWidth="1" />
        <line x1="320" y1="30" x2="320" y2="300" stroke="url(#stemAxis)" strokeWidth="1" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => <g key={i}><line x1={55 + i * 65} y1="166" x2={55 + i * 65} y2="178" stroke="#b7d5ff55" /><line x1="314" y1={45 + i * 31} x2="326" y2={45 + i * 31} stroke="#b7d5ff55" /></g>)}
        <path d="M54 246 C140 208 196 252 278 208 S430 202 584 150" fill="none" stroke="#5eead4" strokeOpacity=".18" strokeWidth="14" filter="url(#stemGlow)" />
        <path d="M54 246 C140 208 196 252 278 208 S430 202 584 150" fill="none" stroke="#5eead4" strokeWidth="2" filter="url(#stemGlow)" />
        <g transform={`translate(${position * 6.2 + 28} ${250 - position * 0.75})`}>
          <circle r="9" fill="#d7f8ff" opacity=".18" filter="url(#stemGlow)" /><circle r="4.5" fill="#d7f8ff" />
          <line x1="0" y1="0" x2="64" y2="-31" stroke="#7dd3fc" strokeWidth="2" markerEnd="url(#stemArrow)" />
          <line x1="0" y1="0" x2="12" y2="-58" stroke="#f0abfc" strokeWidth="2" markerEnd="url(#stemArrow)" />
        </g>
        <text x="584" y="158" fill="#8ac7ef" fontSize="10">v</text><text x="332" y="46" fill="#c9a6ef" fontSize="10">a</text>
        <defs><marker id="stemArrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0 6 3 0 6Z" fill="#b6e5ff" /></marker></defs>
      </svg>
      <div className="stem-visual__foot"><span><i className="stem-dot stem-dot--cyan" />velocity vector</span><span><i className="stem-dot stem-dot--violet" />acceleration vector</span><strong>{chapter.formula}</strong></div>
    </div>
  );
}

function MoleculeViewer({ formula, chapter }: { formula: string; chapter: Chapter }) {
  const [rotation, setRotation] = useState({ x: -12, y: 18 });
  const [dragging, setDragging] = useState(false);
  const last = useRef({ x: 0, y: 0 });
  const normalised = formula.replace(/\s/g, "").toUpperCase();
  const central = normalised.includes("CH") ? "C" : normalised.includes("CO") ? "C" : normalised.includes("NH") ? "N" : normalised[0] ?? "O";
  const outer = normalised === "H2O" ? ["H", "H"] : normalised === "CO2" ? ["O", "O"] : normalised === "NH3" ? ["H", "H", "H"] : ["O", "H"];
  const start = useRef({ x: 0, y: 0 });
  const onMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setRotation((value) => ({ x: value.x + (event.clientY - last.current.y) * 0.35, y: value.y + (event.clientX - last.current.x) * 0.35 }));
    last.current = { x: event.clientX, y: event.clientY };
  };
  return (
    <div className="stem-visual stem-molecule" onPointerDown={(event) => { setDragging(true); last.current = { x: event.clientX, y: event.clientY }; start.current = last.current; (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId); }} onPointerMove={onMove} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)}>
      <div className="stem-visual__head"><div><span className="stem-visual__eyebrow">3D molecular viewer</span><h3>{formula || "H2O"} / interactive model</h3></div><span className="stem-drag-hint">Drag to rotate</span></div>
      <div className="stem-molecule__stage" style={{ transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)` }}>
        <div className="stem-molecule__orbit" />
        <div className="stem-atom stem-atom--center">{central}</div>
        {outer.map((element, index) => <div key={`${element}-${index}`} className={`stem-atom stem-atom--outer stem-atom--${index}`}>{element}</div>)}
        <div className="stem-molecule__bond stem-molecule__bond--one" /><div className="stem-molecule__bond stem-molecule__bond--two" /><div className="stem-molecule__bond stem-molecule__bond--three" />
      </div>
      <div className="stem-visual__foot"><span><i className="stem-dot stem-dot--violet" />bonding model</span><span><i className="stem-dot stem-dot--cyan" />glowing electron shell</span><strong>{chapter.concept}</strong></div>
    </div>
  );
}

const ANATOMY_HOTSPOTS = [
  { id: "nucleus", label: "Nucleus", detail: "Stores the cell's DNA and coordinates growth and activity.", x: 46, y: 45 },
  { id: "mitochondria", label: "Mitochondria", detail: "Release usable energy as ATP through cellular respiration.", x: 70, y: 32 },
  { id: "membrane", label: "Cell membrane", detail: "Controls what enters and leaves the cell.", x: 30, y: 70 },
];

function AnatomyCanvas({ chapter }: { chapter: Chapter }) {
  const [selected, setSelected] = useState(ANATOMY_HOTSPOTS[0]);
  return (
    <div className="stem-visual stem-anatomy">
      <div className="stem-visual__head"><div><span className="stem-visual__eyebrow">Visual anatomy engine</span><h3>{chapter.label} / interactive cross-section</h3></div><span className="stem-drag-hint">Tap a hotspot</span></div>
      <div className="stem-anatomy__stage">
        <svg viewBox="0 0 640 350" role="img" aria-label="Interactive cell anatomy diagram" className="stem-anatomy__svg">
          <defs><radialGradient id="cellFill"><stop stopColor="#8ff0d2" stopOpacity=".18"/><stop offset=".7" stopColor="#42cda1" stopOpacity=".08"/><stop offset="1" stopColor="#42cda1" stopOpacity=".24"/></radialGradient><filter id="bioGlow"><feGaussianBlur stdDeviation="8" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
          <ellipse cx="320" cy="175" rx="245" ry="122" fill="url(#cellFill)" stroke="#72e3bc" strokeOpacity=".55" strokeWidth="2" />
          <ellipse cx="295" cy="160" rx="88" ry="65" fill="#38bdf8" fillOpacity=".11" stroke="#7dd3fc" strokeOpacity=".55" />
          <path d="M360 109 C405 78 458 92 481 126 C506 162 474 202 425 201 C374 199 338 164 360 109Z" fill="#f0abfc" fillOpacity=".12" stroke="#e879f9" strokeOpacity=".5" />
          <path d="M182 214 C211 171 257 166 279 197 C298 224 264 264 222 257 C187 252 167 239 182 214Z" fill="#fbbf24" fillOpacity=".14" stroke="#fbbf24" strokeOpacity=".55" />
          <path d="M82 126 C135 91 189 91 220 116" fill="none" stroke="#67e8f9" strokeOpacity=".6" strokeDasharray="5 7" />
          <path d="M434 72 C482 82 528 112 543 149" fill="none" stroke="#67e8f9" strokeOpacity=".4" strokeDasharray="5 7" />
          {ANATOMY_HOTSPOTS.map((spot) => <g key={spot.id} onClick={() => setSelected(spot)} className="stem-hotspot"><circle cx={spot.x * 6.4} cy={spot.y * 3.5} r="19" fill="none" stroke="#8ff0d2" strokeOpacity={selected.id === spot.id ? ".95" : ".4"} strokeWidth={selected.id === spot.id ? "2" : "1"} /><circle cx={spot.x * 6.4} cy={spot.y * 3.5} r="5" fill="#d7fff0" filter="url(#bioGlow)" /></g>)}
        </svg>
        <AnimatePresence mode="wait"><motion.div key={selected.id} className="stem-anatomy__label" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}><span>{selected.label}</span><p>{selected.detail}</p></motion.div></AnimatePresence>
      </div>
      <div className="stem-visual__foot"><span><i className="stem-dot stem-dot--green" />organelle hotspots</span><span><i className="stem-dot stem-dot--cyan" />cell membrane</span><strong>{chapter.concept}</strong></div>
    </div>
  );
}

function prepareImage(file: File) {
  return new Promise<{ base64: string; mimeType: string }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const scale = Math.min(1, 1400 / Math.max(image.width, image.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(url); reject(new Error("Image preparation failed")); return; }
      context.fillStyle = "#ffffff"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(image, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve({ base64: canvas.toDataURL("image/jpeg", .86).split(",")[1] ?? "", mimeType: "image/jpeg" });
    };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image could not be opened")); };
    image.src = url;
  });
}

function conceptFor(step: string, subject: Subject, fallback: string) {
  const match = /^\s*\[([^\]]+)\]/.exec(step);
  if (match) return match[1].replace(/[-*_`]/g, "").trim();
  return subject === "physics" ? fallback : subject === "chemistry" ? "Chemical Principle" : "Biological Principle";
}

function cleanStep(step: string) { return step.replace(/^\s*\[[^\]]+\]\s*[-–—:]?\s*/, "").trim(); }

export function StemWorkspace() {
  const solve = useAction(api.stem.stemSolve);
  const [subject, setSubject] = useState<Subject>("physics");
  const current = subjectFor(subject);
  const [chapterId, setChapterId] = useState(current.chapters[0].id);
  const [question, setQuestion] = useState(current.chapters[0].prompt);
  const [solution, setSolution] = useState<StemSolution | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [playing, setPlaying] = useState(subject === "physics");
  const [walking, setWalking] = useState(false);
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(isSoundEnabled());
  const recognitionRef = useRef<AviaSpeechRecognition | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const voiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const chapter = current.chapters.find((entry) => entry.id === chapterId) ?? current.chapters[0];
  const steps = solution?.steps ?? [];
  const cards = useMemo(() => steps.map((step, index) => ({ raw: step, body: cleanStep(step), concept: conceptFor(step, subject, chapter.concept), formula: solution?.formulas[index] ?? (index === 0 ? chapter.formula : "") })), [chapter.concept, chapter.formula, solution, steps, subject]);

  const aviaVoice = useCallback(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voiceRef.current || !voices.includes(voiceRef.current)) voiceRef.current = pickAviaVoice(voices) ?? voices[0] ?? null;
    return voiceRef.current;
  }, []);
  const hush = useCallback(() => { stopSpeaking(); setWalking(false); setSpeakingIndex(null); }, []);
  useEffect(() => () => { recognitionRef.current?.abort(); stopSpeaking(); }, []);
  useEffect(() => { hush(); setSolution(null); setError(null); setQuestion(chapter.prompt); setPlaying(subject === "physics"); }, [chapter.prompt, hush, subject]);
  useEffect(() => { setChapterId(current.chapters[0].id); }, [current.chapters]);

  const switchSubject = (next: Subject) => { setSubject(next); setChapterId(subjectFor(next).chapters[0].id); };
  const readQuestion = useCallback(async (file?: File, typed = question) => {
    if (!typed.trim() && !file) return;
    hush(); setLoading(true); setError(null); setSolution(null);
    try {
      const prepared = file ? await prepareImage(file) : null;
      const result = await solve(prepared ? { question: typed, imageBase64: prepared.base64, mimeType: prepared.mimeType, subject, chapter: chapter.label } : { question: typed, subject, chapter: chapter.label });
      setSolution(result);
    } catch (err) { setError(err instanceof Error ? err.message : "The STEM engine could not read that just now."); }
    finally { setLoading(false); }
  }, [chapter.label, hush, question, solve, subject]);

  const toggleMic = () => {
    if (listening) { recognitionRef.current?.stop(); return; }
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) { setError("This browser does not support speech-to-text."); return; }
    const recognition = new Recognition(); recognition.lang = "en-IN"; recognition.interimResults = true; recognition.continuous = false;
    recognition.onresult = (event: AviaSpeechRecognitionEvent) => { let text = ""; for (let i = 0; i < event.results.length; i += 1) text += event.results[i][0].transcript; setQuestion(text.trim()); };
    recognition.onerror = () => { setListening(false); setError("I did not catch that. Tap the microphone again."); };
    recognition.onend = () => setListening(false); recognitionRef.current = recognition; setListening(true); recognition.start();
  };
  const readCard = (index: number) => { const card = cards[index]; if (!card) return; hush(); setSpeakingIndex(index); speakText(card.body || card.raw, aviaVoice(), () => setSpeakingIndex(null), true); };
  const readAll = () => {
    if (walking) { hush(); return; }
    if (!cards.length) return;
    const script = cards.map((card) => card.body || card.raw); if (solution?.answer) script.push(`Final conclusion: ${solution.answer}`);
    let cursor = 0; setWalking(true);
    const next = () => { if (cursor >= script.length) { setWalking(false); setSpeakingIndex(null); return; } const index = cursor++; setSpeakingIndex(index < cards.length ? index : null); speakText(script[index], aviaVoice(), next, index === 0); };
    next();
  };
  const copySolution = () => { if (!solution) return; void navigator.clipboard?.writeText([solution.title, ...cards.map((card, index) => `${index + 1}. [${card.concept}] ${card.body}`), `Final conclusion: ${solution.answer}`].join("\n")).then(() => { setCopied(true); window.setTimeout(() => setCopied(false), 1600); }).catch(() => setError("Clipboard access was blocked.")); };

  return (
    <div className="stem-root">
      <div className="stem-ambient" aria-hidden /><div className="stem-shell">
        <header className="stem-topbar"><Link to="/dashboard" className="stem-back"><ArrowLeft className="h-3.5 w-3.5" />Dashboard</Link><div className="stem-brand"><span className="stem-brand__mark"><Sparkles className="h-4 w-4" /></span><span>STEM Lab</span><small>visual science studio</small></div><div className="stem-topbar__actions"><button type="button" className="stem-sound" onClick={() => { const next = !soundOn; setSoundOn(next); setSoundEnabled(next); }} aria-label={soundOn ? "Mute STEM sounds" : "Unmute STEM sounds"}>{soundOn ? <Volume2 className="h-4 w-4" /> : <span className="stem-sound-off">×</span>}</button><span className="stem-safe">sandboxed · no real chemicals</span></div></header>
        <nav className="stem-subjects" aria-label="STEM subject navigation">{SUBJECTS.map((entry) => { const Icon = entry.icon; return <button key={entry.id} type="button" className={subject === entry.id ? "is-active" : ""} onClick={() => switchSubject(entry.id)}><Icon className="h-4 w-4" /><span>{entry.label}</span>{subject === entry.id && <motion.span layoutId="stem-subject-underline" />}</button>; })}</nav>
        <div className="stem-chapterbar"><span className="stem-chapterbar__label">Chapter</span>{current.chapters.map((entry) => <button key={entry.id} type="button" className={chapter.id === entry.id ? "is-active" : ""} onClick={() => setChapterId(entry.id)}>{entry.label}<ChevronRight className="h-3 w-3" /></button>)}</div>
        <main className="stem-grid">
          <section className="stem-stage">{subject === "physics" && <PhysicsCanvas chapter={chapter} playing={playing} onToggle={() => setPlaying((value) => !value)} />}{subject === "chemistry" && <MoleculeViewer formula={chapter.formula} chapter={chapter} />}{subject === "biology" && <AnatomyCanvas chapter={chapter} />}</section>
          <section className="stem-engine">
            <div className="stem-engine__head"><div><span className="stem-kicker">Step-by-step AI Engine</span><h1>{chapter.label}</h1></div><div className="stem-voice-badge"><span className="stem-wave"><i /><i /><i /><i /></span><span>AVIA AI STEM Tutor</span></div></div>
            <form className="stem-input" onSubmit={(event) => { event.preventDefault(); void readQuestion(); }}><input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Ask a science question" aria-label="Science question" /><div className="stem-input__tools"><button type="button" className={listening ? "is-live" : ""} onClick={toggleMic} aria-label={listening ? "Stop dictation" : "Dictate the question"}><Mic className="h-4 w-4" /></button><button type="button" onClick={() => fileRef.current?.click()} aria-label="Scan a diagram or notes"><Camera className="h-4 w-4" /></button></div><button type="submit" disabled={loading}>{loading ? <Loader2 className="spin-micro h-4 w-4" /> : <ScanSearch className="h-4 w-4" />}Solve</button></form>
            <input ref={fileRef} className="hidden" type="file" accept="image/*" capture="environment" onChange={(event) => void readQuestion(event.target.files?.[0])} />
            {error && <div className="stem-error"><X className="h-3.5 w-3.5" />{error}</div>}
            {loading ? <div className="stem-loading"><Loader2 className="spin-micro h-5 w-5" /><span>Reading the question and building the working…</span></div> : solution ? <>
              <div className="stem-engine__result-head"><div><span className="stem-kicker">{solution.domain}</span><h2>{solution.title}</h2></div><button type="button" className={walking ? "is-active" : ""} onClick={readAll}>{walking ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{walking ? "Stop walkthrough" : "Listen to full walkthrough"}</button></div>
              <div className="stem-cards">{cards.map((card, index) => <article key={`${card.raw}-${index}`} className="stem-card"><div className="stem-card__formula">{card.formula || <span>{card.body}</span>}</div><div className="stem-card__body"><span className="stem-card__concept">{card.concept}</span><p>{card.body}</p></div><button type="button" className={speakingIndex === index ? "is-speaking" : ""} onClick={() => readCard(index)} aria-label={`Read card ${index + 1} aloud`}><Volume2 className="h-4 w-4" /></button></article>)}</div>
              <div className="stem-conclusion"><div><span className="stem-kicker">Final conclusion</span><p>{solution.answer}</p></div><button type="button" onClick={copySolution}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy Solution"}</button></div>
            </> : <div className="stem-ready"><div className="stem-ready__orb"><Gauge className="h-5 w-5" /></div><strong>Ready for your question</strong><p>Enter a problem, speak it, or scan a diagram. Your visual model and worked solution will meet here.</p></div>}
          </section>
        </main>
        <footer className="stem-footer"><span>Manthan STEM Lab</span><span>Interactive models for revision, not substitutes for a teacher.</span><span><HeartPulse className="h-3.5 w-3.5" /> {subject} workspace</span></footer>
      </div>
    </div>
  );
}

export default StemWorkspace;
