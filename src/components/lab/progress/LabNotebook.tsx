import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "convex/react";
import { useNavigate } from "react-router";
import {
  BookOpen,
  Check,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  FileText,
  NotebookPen,
  Printer,
  Share2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/convex/_generated/api";
import { ChoiceSelect } from "@/components/ui/choice-select";
import { useAuth } from "@/hooks/use-auth";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  EXPERIMENTS,
  blankContent,
  findExperiment,
  matchesExperiment,
  progressKey,
} from "./catalog";
import {
  downloadLabReport,
  printLabReport,
  type NotebookRow,
  type ProgressRow,
  type RecordRow,
} from "./report";

type Tab = "progress" | "worksheet" | "journal" | "notes";
type Content = ReturnType<typeof blankContent>;

const TABS: Array<{ id: Tab; label: string; icon: typeof BookOpen }> = [
  { id: "progress", label: "Progress", icon: ClipboardCheck },
  { id: "worksheet", label: "Worksheet", icon: FileText },
  { id: "journal", label: "Journal", icon: NotebookPen },
  { id: "notes", label: "Notes", icon: BookOpen },
];

function duration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours} h ${minutes % 60} min`;
}

function StatusChip({ status }: { status: "completed" | "in_progress" | "todo" }) {
  const label = status === "completed" ? "Completed" : status === "in_progress" ? "In progress" : "Not attempted";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium " +
        (status === "completed"
          ? "border-[color-mix(in_srgb,var(--signal)_45%,transparent)] text-[var(--signal)]"
          : status === "in_progress"
            ? "border-[var(--card-border)] text-foreground"
            : "border-[var(--card-border)] text-text-dim")
      }
    >
      {status === "completed" ? <Check className="h-3 w-3" /> : null}
      {label}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--card-border)] px-4 py-6 text-center text-xs leading-relaxed text-text-dim">
      {children}
    </div>
  );
}

export function LabNotebook({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("progress");
  const [selectedKey, setSelectedKey] = useState(EXPERIMENTS[0].key);
  const experiment = findExperiment(selectedKey);

  const progress = useQuery(api.labProgress.overview) ?? [];
  const records = useQuery(api.labRecords.list) ?? [];
  const notebooks = useQuery(api.labNotebooks.list) ?? [];
  const saveWorksheet = useMutation(api.labNotebooks.saveWorksheet);
  const addEntry = useMutation(api.labNotebooks.addEntry);
  const ensureNotes = useMutation(api.labNotebooks.ensureNotes);
  const ensureJournal = useMutation(api.labNotebooks.ensureJournal);
  const share = useMutation(api.labNotebooks.share);
  const revokeShare = useMutation(api.labNotebooks.revokeShare);
  const touch = useMutation(api.labProgress.touch);

  const worksheet = useMemo(
    () =>
      notebooks.find(
        (entry) => entry.kind === "worksheet" && entry.experimentKey === selectedKey,
      ),
    [notebooks, selectedKey],
  );
  const notes = useMemo(
    () => notebooks.find((entry) => entry.kind === "notes"),
    [notebooks],
  );
  const journal = useMemo(
    () =>
      notebooks.find(
        (entry) => entry.kind === "journal" && entry.experimentKey === selectedKey,
      ),
    [notebooks, selectedKey],
  );

  const [content, setContent] = useState<Content>(() => blankContent(experiment));
  const [completed, setCompleted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [journalText, setJournalText] = useState("");
  const [journalBusy, setJournalBusy] = useState(false);
  const [worksheetNote, setWorksheetNote] = useState("");
  const [worksheetNoteBusy, setWorksheetNoteBusy] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [noteBusy, setNoteBusy] = useState(false);
  const [notesCode, setNotesCode] = useState<string | null>(null);
  const [worksheetCode, setWorksheetCode] = useState<string | null>(null);
  const [sharedCode, setSharedCode] = useState("");
  const [sharedLookup, setSharedLookup] = useState("");
  const [sharedText, setSharedText] = useState("");
  const [sharedBusy, setSharedBusy] = useState(false);

  const shared = useQuery(
    api.labNotebooks.getByCode,
    sharedLookup.length === 6 ? { code: sharedLookup } : "skip",
  );

  useEffect(() => {
    if (notes?.shareCode) setNotesCode(notes.shareCode);
  }, [notes?.shareCode]);

  /* The worksheet loads from the server once, but a keystroke must not be
     overwritten by a reactive refresh. The saved id is the key: a new save
     keeps the same id, so typing stays intact. */
  useEffect(() => {
    if (!worksheet) {
      setContent(blankContent(experiment));
      setCompleted(false);
      setWorksheetCode(null);
      return;
    }
    const base = blankContent(experiment);
    const answers = base.answers.map((answer, index) => ({
      question: answer.question,
      answer:
        worksheet.content.answers.find((saved) => saved.question === answer.question)?.answer ??
        worksheet.content.answers[index]?.answer ??
        "",
    }));
    setContent({ ...worksheet.content, answers });
    setCompleted(Boolean(worksheet.completedAt));
    setWorksheetCode(worksheet.shareCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worksheet?.id, selectedKey]);

  useEffect(() => {
    if (!open || tab !== "worksheet") return;
    const started = Date.now();
    const send = (seconds: number) => {
      if (seconds < 2) return;
      void touch({
        key: experiment.key,
        subject: experiment.subject,
        title: experiment.title,
        seconds,
      }).catch(() => undefined);
    };
    const timer = window.setInterval(() => send(20), 20_000);
    return () => {
      window.clearInterval(timer);
      send(Math.floor((Date.now() - started) / 1000));
    };
  }, [open, tab, experiment.key, experiment.subject, experiment.title, touch]);

  const relevantRecords = useMemo(
    () =>
      (records as RecordRow[]).filter((record) =>
        matchesExperiment(progressKey(record.subject, record.title), experiment),
      ),
    [records, experiment],
  );

  const progressRowsFor = (key: string, prefix: string) =>
    (progress as ProgressRow[]).filter(
      (row) => row.key === key || row.key.startsWith(prefix),
    );

  const rowsFor = (key: string, prefix: string) => progressRowsFor(key, prefix);
  const hasReadings = (key: string, prefix: string) =>
    (records as RecordRow[]).some((record) => {
      const recordKey = progressKey(record.subject, record.title);
      return recordKey === key || recordKey.startsWith(prefix);
    });
  const readingsFor = (key: string, prefix: string) =>
    (records as RecordRow[])
      .filter((record) => {
        const recordKey = progressKey(record.subject, record.title);
        return recordKey === key || recordKey.startsWith(prefix);
      })
      .reduce((total, record) => total + record.observations.length, 0);
  const completedCount = EXPERIMENTS.filter((entry) =>
    rowsFor(entry.key, entry.prefix).some((row) => row.status === "completed"),
  ).length;
  const inProgressCount = EXPERIMENTS.filter((entry) => {
    const rows = rowsFor(entry.key, entry.prefix);
    return (
      (rows.length > 0 || hasReadings(entry.key, entry.prefix)) &&
      !rows.some((row) => row.status === "completed")
    );
  }).length;
  const notAttemptedCount = EXPERIMENTS.length - completedCount - inProgressCount;
  const totalTime = (progress as ProgressRow[]).reduce((total, row) => total + row.timeSeconds, 0);
  const totalReadings = (records as RecordRow[]).reduce(
    (total, record) => total + record.observations.length,
    0,
  );
  const totalAnswers = (notebooks as NotebookRow[]).reduce(
    (total, entry) =>
      total + entry.content.answers.filter((answer) => answer.answer.trim()).length,
    0,
  );
  const totalNotes = (notebooks as NotebookRow[]).reduce(
    (total, entry) => total + entry.entries.length,
    0,
  );

  const save = async (markComplete = completed) => {
    setSaving(true);
    try {
      await saveWorksheet({
        notebookId: worksheet?.id,
        experimentKey: experiment.key,
        subject: experiment.subject,
        title: experiment.title,
        content,
        completed: markComplete,
      });
      setCompleted(markComplete);
      toast.success(markComplete ? "Worksheet completed" : "Worksheet saved", {
        description: markComplete
          ? "The experiment is now marked complete in your progress."
          : "Your answers and observations are on your account.",
      });
    } catch (error) {
      toast.error("Could not save the worksheet", {
        description: error instanceof Error ? error.message : "Try again in a moment.",
      });
    } finally {
      setSaving(false);
    }
  };

  const copyReadings = () => {
    if (!relevantRecords.length) {
      toast.message("No saved readings yet", {
        description: "Record a reading at the bench first; it will appear here.",
      });
      return;
    }
    const lines = relevantRecords.flatMap((record) =>
      record.observations.map((row, index) => {
        const values = row.values
          .map((value) => `${value.label} ${value.value}${value.unit ? ` ${value.unit}` : ""}`)
          .join(", ");
        return `${record.title} ${index + 1}: ${values}`;
      }),
    );
    setContent((current) => ({
      ...current,
      observations: [current.observations, ...lines].filter(Boolean).join("\n"),
    }));
    toast.success("Readings copied into observations");
  };

  const shareWorksheet = async () => {
    if (!worksheet) {
      toast.message("Save the worksheet first", {
        description: "A shared notebook needs a saved page.",
      });
      return;
    }
    try {
      const reply = await share({ notebookId: worksheet.id });
      setWorksheetCode(reply.code);
      toast.success("Share code ready", { description: reply.code });
    } catch (error) {
      toast.error("Could not share the worksheet", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Code copied");
    } catch {
      toast.message(`Share code: ${code}`);
    }
  };

  const addWorksheetNote = async () => {
    const text = worksheetNote.trim();
    if (!text || !worksheet) return;
    setWorksheetNoteBusy(true);
    try {
      await addEntry({ notebookId: worksheet.id, text });
      setWorksheetNote("");
      toast.success("Note added to the worksheet");
    } catch (error) {
      toast.error("Could not add the note", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setWorksheetNoteBusy(false);
    }
  };

  const addJournal = async () => {
    const text = journalText.trim();
    if (!text) return;
    setJournalBusy(true);
    try {
      const book = await ensureJournal({
        experimentKey: experiment.key,
        subject: experiment.subject,
        title: experiment.title,
      });
      await addEntry({ notebookId: book.id, text });
      setJournalText("");
      toast.success("Observation saved to the journal");
    } catch (error) {
      toast.error("Could not save the observation", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setJournalBusy(false);
    }
  };

  const addNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteBusy(true);
    try {
      const book = await ensureNotes({});
      await addEntry({ notebookId: book.id, text });
      setNoteText("");
      toast.success("Note saved");
    } catch (error) {
      toast.error("Could not save the note", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setNoteBusy(false);
    }
  };

  const stopSharingWorksheet = async () => {
    if (!worksheet) return;
    try {
      await revokeShare({ notebookId: worksheet.id });
      setWorksheetCode(null);
      toast.success("Worksheet sharing stopped");
    } catch (error) {
      toast.error("Could not stop sharing", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  const shareNotes = async () => {
    try {
      const book = await ensureNotes({});
      const reply = await share({ notebookId: book.id });
      setNotesCode(reply.code);
      toast.success("Personal notebook shared", { description: reply.code });
    } catch (error) {
      toast.error("Could not share the notebook", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  const stopSharingNotes = async () => {
    if (!notes) return;
    try {
      await revokeShare({ notebookId: notes.id });
      setNotesCode(null);
      toast.success("Sharing stopped");
    } catch (error) {
      toast.error("Could not stop sharing", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  const openShared = () => {
    const code = sharedCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
    if (code.length !== 6) {
      toast.message("Enter the six-character share code");
      return;
    }
    setSharedLookup(code);
  };

  const addShared = async () => {
    const text = sharedText.trim();
    if (!text || !sharedLookup) return;
    setSharedBusy(true);
    try {
      await addEntry({ code: sharedLookup, text });
      setSharedText("");
      toast.success("Contribution added to the shared notebook");
    } catch (error) {
      toast.error("Could not add the contribution", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    } finally {
      setSharedBusy(false);
    }
  };

  const reportInput = {
    name: user?.name ?? "Student",
    progress: progress as ProgressRow[],
    records: records as RecordRow[],
    notebooks: notebooks as NotebookRow[],
  };

  const exportReport = (print: boolean) => {
    try {
      if (print) {
        const opened = printLabReport(reportInput);
        if (!opened) throw new Error("The browser blocked the print window.");
        toast.success("Print dialog opened", {
          description: "Choose “Save as PDF” to keep a copy.",
        });
      } else {
        downloadLabReport(reportInput);
        toast.success("Lab report downloaded", {
          description: "Open the HTML in any browser and print it to PDF.",
        });
      }
    } catch (error) {
      toast.error("Could not export the report", {
        description: error instanceof Error ? error.message : "Try again.",
      });
    }
  };

  const openExperiment = (key: string) => {
    setSelectedKey(key);
    setTab("worksheet");
  };

  const sharedEntries = (shared?.entries ?? []).slice().reverse();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full overflow-y-auto border-l border-[var(--card-border)] bg-[var(--panel)] p-0 sm:max-w-3xl"
      >
        <SheetHeader className="border-b border-[var(--card-border)] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-dim">
            STEM Lab
          </p>
          <SheetTitle className="flex items-center gap-2 font-display text-xl">
            <BookOpen className="h-4 w-4" />
            Lab notebook
          </SheetTitle>
          <p className="text-xs leading-relaxed text-text-dim">
            Worksheets, observations, personal notes and a shared margin. Saved
            work is on your account, not in this tab.
          </p>
        </SheetHeader>

        <div className="sticky top-0 z-10 flex flex-wrap gap-1 border-b border-[var(--card-border)] bg-[var(--panel)] px-4 py-2.5">
          {TABS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => setTab(entry.id)}
                aria-pressed={tab === entry.id}
                className={
                  "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11.5px] font-medium transition-colors " +
                  (tab === entry.id
                    ? "border-[color-mix(in_srgb,var(--text-main)_38%,transparent)] bg-[color-mix(in_srgb,var(--text-main)_8%,transparent)] text-foreground"
                    : "border-[var(--card-border)] text-text-dim hover:text-foreground")
                }
              >
                <Icon className="h-3.5 w-3.5" />
                {entry.label}
              </button>
            );
          })}
        </div>

        <div className="px-5 py-5">
          {tab === "progress" ? (
            <div className="flex flex-col gap-5">
              <div className="grid gap-2 sm:grid-cols-4">
                {[
                  { label: "Completed", value: `${completedCount} / ${EXPERIMENTS.length}` },
                  { label: "In progress", value: String(inProgressCount) },
                  { label: "Lab time", value: duration(totalTime) },
                  { label: "Observations", value: String(totalReadings) },
                ].map((card) => (
                  <div key={card.label} className="rounded-xl border border-[var(--card-border)] px-3 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                      {card.label}
                    </p>
                    <p className="mt-1 font-display text-lg font-semibold">{card.value}</p>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 text-[11.5px] text-text-dim sm:grid-cols-3">
                <span>{totalAnswers} answers saved</span>
                <span>{totalNotes} notebook entries</span>
                <span>{notAttemptedCount} not attempted</span>
              </div>

              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[var(--card-border)] px-3 py-3">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-text-dim">
                  Milestones
                </span>
                {[
                  { at: 1, label: "First practical" },
                  { at: 3, label: "Halfway" },
                  { at: EXPERIMENTS.length, label: "All six" },
                ].map((milestone) => (
                  <span
                    key={milestone.label}
                    className={
                      "rounded-full border px-2 py-0.5 text-[10.5px] " +
                      (completedCount >= milestone.at
                        ? "border-[color-mix(in_srgb,var(--signal)_45%,transparent)] text-[var(--signal)]"
                        : "border-[var(--card-border)] text-text-dim")
                    }
                  >
                    {milestone.label}
                  </span>
                ))}
              </div>

              <div className="flex flex-col gap-2">
                {EXPERIMENTS.map((entry) => {
                  const rows = rowsFor(entry.key, entry.prefix);
                  const done = rows.some((row) => row.status === "completed");
                  const touched = rows.length > 0 || hasReadings(entry.key, entry.prefix);
                  const status = done ? "completed" : touched ? "in_progress" : "todo";
                  const entryTime = rows.reduce((total, row) => total + row.timeSeconds, 0);
                  const entryReadings = readingsFor(entry.key, entry.prefix);
                  return (
                    <div
                      key={entry.key}
                      className="flex flex-col gap-2 rounded-xl border border-[var(--card-border)] px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-[12.5px] font-semibold">
                          {entry.title}
                          <StatusChip status={status} />
                        </p>
                        <p className="mt-0.5 text-[11px] text-text-dim">
                          {entry.bench} · {entryReadings} readings
                          {entryTime > 0 ? ` · ${duration(entryTime)}` : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] font-medium text-text-dim transition-colors hover:text-foreground"
                          onClick={() => openExperiment(entry.key)}
                        >
                          {done ? "Review" : touched ? "Continue" : "Open worksheet"}
                        </button>
                        <button
                          type="button"
                          className="rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] font-medium text-text-dim transition-colors hover:text-foreground"
                          onClick={() => {
                            onOpenChange(false);
                            navigate(`/lab?subject=${entry.subject}`);
                          }}
                        >
                          Find bench
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-2 border-t border-[var(--card-border)] pt-4">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11.5px] font-medium"
                  onClick={() => exportReport(false)}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download report
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11.5px] font-medium"
                  onClick={() => exportReport(true)}
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / save as PDF
                </button>
                <span className="self-center text-[10.5px] text-text-dim">
                  Includes completed worksheets, readings and contributions.
                </span>
              </div>
            </div>
          ) : null}

          {tab === "worksheet" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-[220px] flex-1 flex-col gap-1">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                    Practical
                  </span>
                  <ChoiceSelect
                    value={selectedKey}
                    onChange={setSelectedKey}
                    ariaLabel="Practical"
                    placeholder="Choose a practical"
                    options={EXPERIMENTS.map((entry) => ({
                      value: entry.key,
                      label: entry.title,
                    }))}
                  />
                </div>
                <StatusChip status={completed ? "completed" : worksheet ? "in_progress" : "todo"} />
              </div>

              <div className="rounded-xl border border-[var(--card-border)] p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold">{experiment.title}</p>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-full border border-[var(--card-border)] px-2.5 py-1 text-[10.5px] text-text-dim transition-colors hover:text-foreground"
                    onClick={copyReadings}
                  >
                    <Download className="h-3 w-3" />
                    Copy readings from practical notebook
                  </button>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-text-dim">{experiment.blurb}</p>
              </div>

              <div className="grid gap-3">
                {[
                  { key: "aim", label: "Aim" },
                  { key: "apparatus", label: "Apparatus" },
                  { key: "procedure", label: "Procedure" },
                  { key: "observations", label: "Observations" },
                  { key: "conclusion", label: "Conclusion" },
                ].map((field) => (
                  <label key={field.key} className="flex flex-col gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                      {field.label}
                    </span>
                    <textarea
                      value={content[field.key as keyof Content] as string}
                      onChange={(event) =>
                        setContent((current) => ({ ...current, [field.key]: event.target.value }))
                      }
                      rows={field.key === "aim" || field.key === "apparatus" ? 2 : field.key === "observations" || field.key === "procedure" ? 5 : 3}
                      className="w-full resize-y rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-[12px] leading-relaxed text-foreground outline-none focus:border-[var(--signal)]"
                    />
                  </label>
                ))}
              </div>

              <div className="flex flex-col gap-3 rounded-xl border border-[var(--card-border)] p-3.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                  Questions
                </p>
                {experiment.worksheet.questions.map((question, index) => {
                  const answer = content.answers[index]?.answer ?? "";
                  return (
                    <div key={question.question} className="border-t border-[var(--card-border)] pt-3 first:border-0 first:pt-0">
                      <p className="text-[12px] font-medium leading-relaxed">{question.question}</p>
                      <textarea
                        value={answer}
                        rows={2}
                        onChange={(event) =>
                          setContent((current) => ({
                            ...current,
                            answers: current.answers.map((entry, at) =>
                              at === index ? { ...entry, answer: event.target.value } : entry,
                            ),
                          }))
                        }
                        placeholder="Write your answer, then check the model answer."
                        className="mt-1.5 w-full resize-y rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-[12px] leading-relaxed text-foreground outline-none focus:border-[var(--signal)]"
                      />
                      <details className="mt-1.5">
                        <summary className="cursor-pointer text-[10.5px] text-text-dim">
                          Check the model answer
                        </summary>
                        <p className="mt-1 text-[11.5px] leading-relaxed text-text-dim">
                          {question.model}
                        </p>
                      </details>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-main)] px-3 py-2 text-[11.5px] font-semibold text-[var(--panel)] disabled:opacity-50"
                  onClick={() => void save()}
                >
                  {saving ? "Saving…" : "Save worksheet"}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11.5px] font-medium"
                  onClick={() => void save(!completed)}
                >
                  <Check className="h-3.5 w-3.5" />
                  {completed ? "Reopen worksheet" : "Mark complete"}
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11.5px] font-medium"
                  onClick={() => void shareWorksheet()}
                >
                  <Share2 className="h-3.5 w-3.5" />
                  {worksheetCode ? "Share code" : "Share"}
                </button>
                {worksheetCode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => void copyCode(worksheetCode)}
                      className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2.5 py-1 font-mono text-[11px]"
                    >
                      <Copy className="h-3 w-3" />
                      {worksheetCode}
                    </button>
                    <button
                      type="button"
                      onClick={() => void stopSharingWorksheet()}
                      className="text-[10.5px] text-text-dim underline-offset-2 hover:underline"
                    >
                      Stop sharing
                    </button>
                  </>
                ) : null}
              </div>

              <div className="border-t border-[var(--card-border)] pt-3">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                  <Users className="h-3 w-3" />
                  Shared margin
                </p>
                {worksheet?.entries.length ? (
                  <ul className="mt-2 flex flex-col gap-2">
                    {worksheet.entries.slice().reverse().map((entry) => (
                      <li key={entry.id} className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11.5px] leading-relaxed">
                        <span className="font-semibold">{entry.authorName}</span>
                        <span className="ml-1 text-[10px] text-text-dim">
                          {new Date(entry.at).toLocaleString()}
                        </span>
                        <p className="mt-1 whitespace-pre-wrap text-text-dim">{entry.text}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-[11px] text-text-dim">
                    Share the code above; a partner who opens it can add observations
                    here, with their name on each contribution.
                  </p>
                )}
                {worksheet ? (
                  <div className="mt-2 flex flex-col gap-2">
                    <textarea
                      value={worksheetNote}
                      onChange={(event) => setWorksheetNote(event.target.value)}
                      rows={2}
                      placeholder="Add your own note to this worksheet…"
                      className="w-full resize-y rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-[12px] leading-relaxed outline-none focus:border-[var(--signal)]"
                    />
                    <button
                      type="button"
                      onClick={() => void addWorksheetNote()}
                      disabled={worksheetNoteBusy || !worksheetNote.trim()}
                      className="self-start rounded-lg border border-[var(--card-border)] px-3 py-1.5 text-[11px] font-medium disabled:opacity-50"
                    >
                      {worksheetNoteBusy ? "Adding…" : "Add note to shared margin"}
                    </button>
                  </div>
                ) : null}
                <p className="mt-2 text-[10px] leading-relaxed text-text-dim">
                  Replay a bench with its own reset control. Your saved worksheet and
                  readings stay here until you overwrite or delete them.
                </p>
              </div>
            </div>
          ) : null}

          {tab === "journal" ? (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                  Experiment
                </span>
                <ChoiceSelect
                  value={selectedKey}
                  onChange={setSelectedKey}
                  ariaLabel="Experiment"
                  placeholder="Choose an experiment"
                  options={EXPERIMENTS.map((entry) => ({
                    value: entry.key,
                    label: entry.title,
                  }))}
                />
              </div>

              <div className="rounded-xl border border-[var(--card-border)] p-3.5">
                <p className="text-[12px] font-semibold">What did you observe?</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text-dim">
                  Write one observation at a time. It is saved to this experiment's journal
                  and counted in your progress.
                </p>
                <textarea
                  value={journalText}
                  onChange={(event) => setJournalText(event.target.value)}
                  rows={3}
                  placeholder="e.g. At 40× the onion cell wall is a clear double line; the nucleus sits against one wall."
                  className="mt-2 w-full resize-y rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-[12px] leading-relaxed text-foreground outline-none focus:border-[var(--signal)]"
                />
                <button
                  type="button"
                  onClick={() => void addJournal()}
                  disabled={journalBusy || !journalText.trim()}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-main)] px-3 py-2 text-[11.5px] font-semibold text-[var(--panel)] disabled:opacity-50"
                >
                  <NotebookPen className="h-3.5 w-3.5" />
                  {journalBusy ? "Saving…" : "Add observation"}
                </button>
              </div>

              {relevantRecords.length ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                    Recorded readings
                  </p>
                  {relevantRecords.slice(0, 4).map((record) => (
                    <div key={record.title} className="rounded-xl border border-[var(--card-border)] px-3 py-2">
                      <p className="text-[11.5px] font-medium">{record.title}</p>
                      <p className="text-[10.5px] text-text-dim">
                        {record.observations.length} readings
                        {record.measured !== null ? ` · result ${record.measured} ${record.resultUnit ?? ""}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              {journal?.entries.length ? (
                <div className="flex flex-col gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-text-dim">
                    Journal entries
                  </p>
                  {journal.entries.slice().reverse().map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-[var(--card-border)] px-3 py-2 text-[11.5px] leading-relaxed">
                      <p className="text-[10px] text-text-dim">
                        {entry.authorName} · {new Date(entry.at).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{entry.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No journal entries for this experiment yet.</Empty>
              )}
            </div>
          ) : null}

          {tab === "notes" ? (
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-[var(--card-border)] p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <BookOpen className="h-3.5 w-3.5" />
                  Personal laboratory notebook
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text-dim">
                  Formulas, findings and observations that do not belong to one practical.
                  Entries are saved on your account.
                </p>
                <textarea
                  value={noteText}
                  onChange={(event) => setNoteText(event.target.value)}
                  rows={3}
                  placeholder="Write a note…"
                  className="mt-2 w-full resize-y rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-[12px] leading-relaxed text-foreground outline-none focus:border-[var(--signal)]"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void addNote()}
                    disabled={noteBusy || !noteText.trim()}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-main)] px-3 py-2 text-[11.5px] font-semibold text-[var(--panel)] disabled:opacity-50"
                  >
                    <NotebookPen className="h-3.5 w-3.5" />
                    {noteBusy ? "Saving…" : "Add note"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void shareNotes()}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11.5px] font-medium"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    {notesCode ? "Shared" : "Share notebook"}
                  </button>
                  {notesCode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void copyCode(notesCode)}
                        className="inline-flex items-center gap-1 rounded-full border border-[var(--card-border)] px-2.5 py-1 font-mono text-[11px]"
                      >
                        <Copy className="h-3 w-3" />
                        {notesCode}
                      </button>
                      <button
                        type="button"
                        onClick={() => void stopSharingNotes()}
                        className="text-[10.5px] text-text-dim underline-offset-2 hover:underline"
                      >
                        Stop sharing
                      </button>
                    </>
                  ) : null}
                </div>
              </div>

              {notes?.entries.length ? (
                <div className="flex flex-col gap-2">
                  {notes.entries.slice().reverse().map((entry) => (
                    <div key={entry.id} className="rounded-xl border border-[var(--card-border)] px-3 py-2.5 text-[11.5px] leading-relaxed">
                      <p className="text-[10px] text-text-dim">
                        {entry.authorName} · {new Date(entry.at).toLocaleString()}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap">{entry.text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty>No notes yet. The first entry creates the notebook.</Empty>
              )}

              <div className="rounded-xl border border-[var(--card-border)] p-3.5">
                <p className="flex items-center gap-1.5 text-[12px] font-semibold">
                  <Users className="h-3.5 w-3.5" />
                  Open a shared notebook
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text-dim">
                  Enter the six-character code a lab partner gave you. Contributions
                  carry their author's name.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={sharedCode}
                    onChange={(event) => setSharedCode(event.target.value.toUpperCase().slice(0, 6))}
                    placeholder="ABC123"
                    className="w-32 rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 font-mono text-[12px] uppercase tracking-[0.16em] outline-none focus:border-[var(--signal)]"
                  />
                  <button
                    type="button"
                    onClick={openShared}
                    className="rounded-lg border border-[var(--card-border)] px-3 py-2 text-[11.5px] font-medium"
                  >
                    Open
                  </button>
                </div>

                {sharedLookup && shared === undefined ? (
                  <p className="mt-2 text-[11px] text-text-dim">Looking for that notebook…</p>
                ) : null}
                {sharedLookup && shared === null ? (
                  <p className="mt-2 text-[11px] text-text-dim">
                    No notebook has that code, or it is no longer shared.
                  </p>
                ) : null}
                {shared ? (
                  <div className="mt-3 border-t border-[var(--card-border)] pt-3">
                    <p className="text-[12px] font-semibold">{shared.title}</p>
                    <p className="text-[10.5px] text-text-dim">
                      Shared by {shared.ownerName} · {shared.entries.length} contributions
                    </p>
                    {shared.kind === "worksheet" ? (
                      <div className="mt-2 flex flex-col gap-1 rounded-lg border border-[var(--card-border)] px-2.5 py-2 text-[11px] leading-relaxed text-text-dim">
                        {shared.content.aim ? <p><strong className="text-foreground">Aim:</strong> {shared.content.aim}</p> : null}
                        {shared.content.observations ? <p><strong className="text-foreground">Observations:</strong> {shared.content.observations}</p> : null}
                        {shared.content.conclusion ? <p><strong className="text-foreground">Conclusion:</strong> {shared.content.conclusion}</p> : null}
                      </div>
                    ) : null}
                    {shared.entries.length ? (
                      <ul className="mt-2 flex max-h-56 flex-col gap-2 overflow-y-auto">
                        {sharedEntries.map((entry) => (
                          <li key={entry.id} className="rounded-lg border border-[var(--card-border)] px-2.5 py-2 text-[11px] leading-relaxed">
                            <span className="font-semibold">{entry.authorName}</span>
                            <p className="mt-0.5 whitespace-pre-wrap text-text-dim">{entry.text}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-text-dim">No contributions yet.</p>
                    )}
                    <textarea
                      value={sharedText}
                      onChange={(event) => setSharedText(event.target.value)}
                      rows={2}
                      placeholder="Add an observation to the shared notebook…"
                      className="mt-2 w-full resize-y rounded-lg border border-[var(--card-border)] bg-transparent px-3 py-2 text-[12px] outline-none focus:border-[var(--signal)]"
                    />
                    <button
                      type="button"
                      onClick={() => void addShared()}
                      disabled={sharedBusy || !sharedText.trim()}
                      className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[var(--text-main)] px-3 py-2 text-[11.5px] font-semibold text-[var(--panel)] disabled:opacity-50"
                    >
                      <Users className="h-3.5 w-3.5" />
                      {sharedBusy ? "Adding…" : "Contribute"}
                    </button>
                  </div>
                ) : null}
              </div>

              <p className="flex items-center gap-1.5 text-[10px] leading-relaxed text-text-dim">
                <Clock3 className="h-3 w-3" />
                Time is counted while a worksheet is open and while a bench session has
                started, in bounded slices.
              </p>
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default LabNotebook;
