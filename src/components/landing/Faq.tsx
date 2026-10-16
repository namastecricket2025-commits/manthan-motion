import { gsap, prefersReducedMotion, revealConfig } from "@/lib/gsap";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";

/**
 * The questions a student actually asks before uploading anything.
 *
 * Every answer here is a fact the product already states elsewhere — the eight
 * formats and OCR, the five steps, the citation rule, the plan allowances from
 * `src/lib/plans.ts`, the notebook model — gathered in one place instead of
 * being scattered across four sections. Nothing is written to fill the space,
 * and there are no invented numbers: where a plan's price or allowance is
 * quoted, it is the number the pricing table and the server both use.
 *
 * The reveal is a grid-rows transition (`0fr` → `1fr`) rather than a measured
 * max-height: no JS measurement, no magic pixel value to keep in sync, and the
 * row is still in the DOM for search engines and screen readers.
 */

const FAQ: { q: string; a: string }[] = [
  {
    q: "What can I put in?",
    a: "PDF, DOCX, PPTX, TXT, Markdown, HTML, EPUB and images — including photographs of handwritten notes, which are read with OCR. Everything you add stays in the upload queue until you generate, so a wrong file can be taken out first.",
  },
  {
    q: "How long does a study kit take?",
    a: "Under a minute for the documents the app is built for. The five steps run in order and report their own status while they work — parse, summarise, structure, distill, deliver — so you can see which step is holding things up instead of watching an unlabelled spinner.",
  },
  {
    q: "Where do the flashcards and questions come from?",
    a: "From your own uploads. Each card is written against a passage in a source you added and keeps a pointer back to it, so anything that looks wrong can be checked against the original page rather than taken on trust.",
  },
  {
    q: "What does it cost?",
    a: "The free plan runs on 60,000 tokens a day and includes the notebook workspace, the five-step pipeline and every output format. Paid tiers raise the allowance and open the workspaces outside the notebook: the Sprint Pass (₹49 for 7 days) adds Cram Mode, EduVantage (₹199 a month) adds the photo question solver and Math Lab graphs, and Manthan Prime (₹349 a month) adds the full Math Lab suite and the voice tutor.",
  },
  {
    q: "Which classes and syllabi is it for?",
    a: "Classes 8 to 12. Math Lab works in CBSE, NCERT, IB and IGCSE notation, and the photo question solver is written for CBSE and ICSE question sheets and hand-written working.",
  },
  {
    q: "Can I keep more than one subject in there?",
    a: "Yes — notebooks. Each one holds its own sources and its own generated material, so Physics and Chemistry never mix, and the dashboard shows activity across all of them in one place.",
  },
];

export default function Faq() {
  const ref = useRef<HTMLElement | null>(null);
  const [open, setOpen] = useState<number | null>(0);

  useLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    if (prefersReducedMotion()) {
      gsap.set(els, { opacity: 1, y: 0 });
      return;
    }
    const ctx = gsap.context(() => {
      gsap.fromTo(
        els,
        { opacity: 0, y: 22 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.08,
          scrollTrigger: { trigger: root, ...revealConfig },
        },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <section id="faq" ref={ref} className="relative mx-auto max-w-6xl scroll-mt-24 px-4 py-16 sm:px-6 md:py-24">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] lg:gap-14">
        <div data-reveal>
          <h2 className="text-fade font-display text-[30px] font-normal leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[38px]">
            Before you paste your{" "}
            <span className="gradient-text">first chapter</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-text-dim">
            Six things people check before they trust a pipeline with their
            syllabus — and the honest answer to each.
          </p>
        </div>

        {/* One panel, hairline-separated rows: the same "one surface, lines on
            it" treatment as the receipts rail, so the page's dense stretches
            read as a document rather than a deck of cards. */}
        <div data-reveal className="glass-panel card-surface overflow-hidden">
          {FAQ.map((item, index) => {
            const isOpen = open === index;
            return (
              <div
                key={item.q}
                className={cn(index > 0 && "border-t border-[var(--panel-line)]")}
              >
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${index}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${index}`}
                    onClick={() => setOpen(isOpen ? null : index)}
                    className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition-colors duration-150 hover:bg-[color-mix(in_srgb,var(--text-main)_4%,transparent)] sm:px-6 sm:py-5"
                  >
                    <span className="text-[15px] font-medium leading-6 text-foreground">
                      {item.q}
                    </span>
                    <ChevronDown
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 h-4 w-4 shrink-0 text-text-dim transition-transform duration-200 motion-reduce:transition-none",
                        isOpen && "rotate-180",
                      )}
                    />
                  </button>
                </h3>
                <div
                  id={`faq-a-${index}`}
                  role="region"
                  aria-labelledby={`faq-q-${index}`}
                  className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
                  style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
                >
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-[14px] leading-relaxed text-text-dim sm:px-6">
                      {item.a}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
