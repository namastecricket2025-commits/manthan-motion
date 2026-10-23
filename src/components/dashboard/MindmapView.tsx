import { useMemo, useState } from "react";
import type { MindmapPayload } from "@/components/dashboard/MaterialViews";

/**
 * The mind map, drawn as a measured two-sided tree.
 *
 * The previous version placed labels beside circles at hand-picked offsets, so
 * a link stopped at the node centre while its text floated somewhere else —
 * which is exactly what makes a diagram look sketched rather than drawn. Here
 * every node is a real rounded box whose width is derived from its wrapped
 * text, the links run from one box edge to the next, and the branches are
 * stacked from measured heights. Nothing is positioned by eye, so nothing can
 * drift: every line ends where its box starts.
 */

function wrap(label: string, maxChars: number, maxLines = 3): string[] {
  const text = label.trim();
  if (!text) return [""];
  if (text.length <= maxChars) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length > maxChars && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, maxLines);
}

interface Box {
  lines: string[];
  /** centre of the box */
  x: number;
  y: number;
  w: number;
  h: number;
}

interface BranchBox extends Box {
  side: -1 | 1;
  leaves: Box[];
}

const PAD_X = 12;
const PAD_Y = 9;
const ROOT_GAP = 84;
const COLUMN_GAP = 48;
const LEAF_GAP = 10;
const BLOCK_GAP = 26;

function boxWidth(lines: string[], fontSize: number, min: number) {
  const longest = Math.max(1, ...lines.map((line) => line.length));
  return Math.max(min, Math.min(232, longest * fontSize * 0.56 + PAD_X * 2));
}

function boxHeight(lines: string[], fontSize: number) {
  return lines.length * fontSize * 1.3 + PAD_Y * 2;
}

export function MindmapView({ payload }: { payload: MindmapPayload }) {
  const [fontStep, setFontStep] = useState(1);
  const baseFont = [12, 13.5, 15][fontStep];

  const layout = useMemo(() => {
    const font = baseFont;
    const rootLines = wrap(payload.root, 16, 3);
    const rootW = boxWidth(rootLines, font + 1.5, 136);
    const rootH = boxHeight(rootLines, font + 1.5);

    const prepare = (branch: MindmapPayload["branches"][number], side: -1 | 1): BranchBox => {
      const titleLines = wrap(branch.title, 18, 2);
      const leafLines = branch.children.map((child) => wrap(child, 22, 3));
      const branchW = boxWidth(titleLines, font + 1, 132);
      const leafW = Math.max(120, ...leafLines.map((lines) => boxWidth(lines, font, 0)));
      return {
        lines: titleLines,
        x: 0,
        y: 0,
        w: branchW,
        h: boxHeight(titleLines, font + 1),
        side,
        leaves: leafLines.map((lines) => ({
          lines,
          x: 0,
          y: 0,
          w: leafW,
          h: boxHeight(lines, font),
        })),
      };
    };

    // Alternate sides so a two-branch map reads left/right and a five-branch
    // map stays balanced, instead of piling every branch on one edge.
    const right = payload.branches.filter((_, i) => i % 2 === 0).map((b) => prepare(b, 1));
    const left = payload.branches.filter((_, i) => i % 2 === 1).map((b) => prepare(b, -1));

    const branchColW = Math.max(
      132,
      ...right.map((b) => b.w),
      ...left.map((b) => b.w),
    );
    const leafColW = Math.max(
      120,
      ...right.flatMap((b) => b.leaves.map((leaf) => leaf.w)),
      ...left.flatMap((b) => b.leaves.map((leaf) => leaf.w)),
    );

    const placeSide = (branches: BranchBox[]) => {
      if (!branches.length) return;
      const blocks = branches.map((branch) => {
        const leavesH =
          branch.leaves.reduce((sum, leaf) => sum + leaf.h, 0) +
          Math.max(0, branch.leaves.length - 1) * LEAF_GAP;
        return { branch, height: Math.max(branch.h, leavesH), leavesH };
      });
      const totalH =
        blocks.reduce((sum, block) => sum + block.height, 0) +
        Math.max(0, blocks.length - 1) * BLOCK_GAP;
      let cursor = -totalH / 2;

      for (const block of blocks) {
        const branch = block.branch;
        const side = branch.side;
        const branchX = side * (rootW / 2 + ROOT_GAP + branchColW / 2);
        const leafX = side * (rootW / 2 + ROOT_GAP + branchColW + COLUMN_GAP + leafColW / 2);
        const blockCenter = cursor + block.height / 2;

        branch.x = branchX;
        branch.y = blockCenter;
        branch.w = branchColW;
        branch.h = block.branch.h;

        let leafCursor = blockCenter - block.leavesH / 2;
        for (const leaf of branch.leaves) {
          leaf.x = leafX;
          leaf.y = leafCursor + leaf.h / 2;
          leaf.w = leafColW;
          leafCursor += leaf.h + LEAF_GAP;
        }

        cursor += block.height + BLOCK_GAP;
      }
    };

    placeSide(right);
    placeSide(left);

    const all: BranchBox[] = [...right, ...left];
    const xs: number[] = [-rootW / 2, rootW / 2, 0];
    const ys: number[] = [-rootH / 2, rootH / 2, 0];
    for (const branch of all) {
      xs.push(branch.x - branch.w / 2, branch.x + branch.w / 2);
      ys.push(branch.y - branch.h / 2, branch.y + branch.h / 2);
      for (const leaf of branch.leaves) {
        xs.push(leaf.x - leaf.w / 2, leaf.x + leaf.w / 2);
        ys.push(leaf.y - leaf.h / 2, leaf.y + leaf.h / 2);
      }
    }

    const pad = 26;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;

    return {
      rootLines,
      rootW,
      rootH,
      right,
      left,
      branches: all,
      viewBox: { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
    };
  }, [baseFont, payload.branches, payload.root]);

  const font = baseFont;

  const renderBox = (box: Box, kind: "branch" | "leaf", key: string) => {
    const isBranch = kind === "branch";
    const fontSize = isBranch ? font + 1 : font;
    const firstY = box.y - ((box.lines.length - 1) * fontSize * 1.3) / 2;
    return (
      <g key={key}>
        <rect
          x={box.x - box.w / 2}
          y={box.y - box.h / 2}
          width={box.w}
          height={box.h}
          rx={isBranch ? 14 : 11}
          fill={
            isBranch
              ? "color-mix(in srgb, var(--signal) 12%, var(--card))"
              : "color-mix(in srgb, var(--card) 82%, transparent)"
          }
          stroke={
            isBranch
              ? "color-mix(in srgb, var(--signal) 46%, transparent)"
              : "var(--card-border)"
          }
          strokeWidth={isBranch ? 1.4 : 1}
        />
        <text
          x={box.x}
          y={firstY}
          textAnchor="middle"
          dominantBaseline="central"
          fill={isBranch ? "var(--text-main)" : "var(--text-dim)"}
          style={{
            fontSize,
            fontWeight: isBranch ? 650 : 500,
            letterSpacing: "-0.005em",
          }}
        >
          {box.lines.map((text, i) => (
            <tspan key={i} x={box.x} dy={i === 0 ? 0 : fontSize * 1.3}>
              {text}
            </tspan>
          ))}
        </text>
      </g>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="print-hide flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-text-dim">
          Root idea in the middle — branches on both sides, each leaf in its own
          column.
        </p>
        <div className="flex items-center gap-1.5" role="group" aria-label="Mind map text size">
          {["A−", "A", "A+"].map((label, step) => (
            <button
              key={label}
              type="button"
              aria-pressed={fontStep === step}
              onClick={() => setFontStep(step)}
              className={
                "glass-chip inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold transition-colors " +
                (fontStep === step ? "text-[var(--signal)]" : "text-text-dim")
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`${layout.viewBox.x} ${layout.viewBox.y} ${layout.viewBox.w} ${layout.viewBox.h}`}
          className="mx-auto block h-auto w-full max-w-[980px]"
          role="img"
          aria-label={`Mind map of ${payload.root}`}
          style={{ minWidth: `${Math.min(560, layout.viewBox.w)}px` }}
        >
          {/* Links first: every curve leaves one box edge and lands on another. */}
          {layout.branches.map((branch) => {
            const side = branch.side;
            const rootEdge = side * (layout.rootW / 2);
            const branchInner = branch.x - side * (branch.w / 2);
            const midRoot = (rootEdge + branchInner) / 2;
            const d = `M ${rootEdge} 0 C ${midRoot} 0, ${midRoot} ${branch.y}, ${branchInner} ${branch.y}`;
            return (
              <g key={`branch-link-${branch.lines.join("-")}-${branch.y}`}>
                <path d={d} fill="none" stroke="color-mix(in srgb, var(--signal) 44%, transparent)" strokeWidth="2" />
                {branch.leaves.map((leaf, j) => {
                  const branchOuter = branch.x + side * (branch.w / 2);
                  const leafInner = leaf.x - side * (leaf.w / 2);
                  const mid = (branchOuter + leafInner) / 2;
                  return (
                    <path
                      key={`leaf-link-${j}`}
                      d={`M ${branchOuter} ${branch.y} C ${mid} ${branch.y}, ${mid} ${leaf.y}, ${leafInner} ${leaf.y}`}
                      fill="none"
                      stroke="var(--card-border)"
                      strokeWidth="1.4"
                    />
                  );
                })}
              </g>
            );
          })}

          {layout.branches.map((branch) =>
            branch.leaves.map((leaf, j) => renderBox(leaf, "leaf", `leaf-${branch.lines.join("-")}-${j}`)),
          )}
          {layout.branches.map((branch) => renderBox(branch, "branch", `branch-${branch.lines.join("-")}-${branch.y}`))}

          <rect
            x={-layout.rootW / 2}
            y={-layout.rootH / 2}
            width={layout.rootW}
            height={layout.rootH}
            rx={18}
            fill="var(--signal-strong)"
          />
          <text
            x={0}
            y={0}
            textAnchor="middle"
            dominantBaseline="central"
            fill="var(--primary-foreground)"
            style={{ fontSize: font + 1.5, fontWeight: 700 }}
          >
            {layout.rootLines.map((text, i) => (
              <tspan
                key={i}
                x={0}
                dy={i === 0 ? -((layout.rootLines.length - 1) * (font + 1.5) * 1.28) / 2 : (font + 1.5) * 1.28}
              >
                {text}
              </tspan>
            ))}
          </text>
        </svg>
      </div>
    </div>
  );
}

export default MindmapView;
