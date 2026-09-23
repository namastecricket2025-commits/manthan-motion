/**
 * Avia's transcript formatting.
 *
 * Her persona prompt asks the model for a structured, scannable layout:
 * `### Section headers`, `**Step 1: ...**` labels above the math they describe,
 * bolded bullets, and clean spacing between blocks. This module turns that
 * markdown into React nodes for the chat transcript, and provides the inverse
 * for the voice: only the plain spoken sentences go to the synthesiser.
 *
 * Deliberately tiny and dependency-free — the model's output shape is known
 * (headers, bold, bullets, numbered lists, line-separated math), so a small
 * block parser beats pulling in a full markdown runtime.
 */

import type { ReactNode } from "react";

/** True when a line is mostly a formula/derivation rather than prose. */
function isMathLine(line: string): boolean {
  if (/^\s*[-*]\s|^\s*\d+[.)]\s/.test(line)) return false;
  if (/[=]/.test(line)) return true;
  // derivative/integral fragments like "d/dx (x^2)" or "∫ 2x dx"
  return /^\s*(d\/d[a-z]|∫|\bintegrate\b|\bdifferentiate\b)/i.test(line);
}

/**
 * Inline formatting: **bold**, *italic*, `code` and emoji-free plain text.
 * Returns a flat array of React nodes so callers can drop it into any block.
 */
export function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Split on **bold** first, then italics inside each chunk, then code spans.
  const boldParts = text.split(/(\*\*[^*]+\*\*)/g);
  boldParts.forEach((part, bi) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      nodes.push(<strong key={`${keyPrefix}-b${bi}`}>{part.slice(2, -2)}</strong>);
      return;
    }
    const codeParts = part.split(/(`[^`]+`)/g);
    codeParts.forEach((chunk, ci) => {
      if (/^`[^`]+`$/.test(chunk)) {
        nodes.push(<code key={`${keyPrefix}-c${bi}-${ci}`}>{chunk.slice(1, -1)}</code>);
        return;
      }
      const italicParts = chunk.split(/(\*[^*\n]+\*)/g);
      italicParts.forEach((piece, ii) => {
        if (/^\*[^*\n]+\*$/.test(piece)) {
          nodes.push(<em key={`${keyPrefix}-i${bi}-${ci}-${ii}`}>{piece.slice(1, -1)}</em>);
        } else if (piece) {
          nodes.push(piece);
        }
      });
    });
  });
  return nodes;
}

/**
 * Turn one reply into block elements:
 * - `### Header`          → a section heading
 * - `- **X:** y` / `* x`  → bolded bullet list
 * - `1. step` / `1) step` → ordered list
 * - `2x = 12`             → a centred math line
 * - blank line            → block break (visual spacing)
 * Anything else is a paragraph.
 */
export function renderBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let ordered: string[] = [];
  let key = 0;

  const flushBullets = () => {
    if (bullets.length === 0) return;
    blocks.push(
      <ul key={`ul-${key++}`} className="avia-md-list">
        {bullets.map((item, i) => (
          <li key={`li-${key}-${i}`}>{renderInline(item, `li-${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    bullets = [];
  };

  const flushOrdered = () => {
    if (ordered.length === 0) return;
    blocks.push(
      <ol key={`ol-${key++}`} className="avia-md-list avia-md-list--ordered">
        {ordered.map((item, i) => (
          <li key={`oli-${key}-${i}`}>{renderInline(item, `oli-${key}-${i}`)}</li>
        ))}
      </ol>,
    );
    ordered = [];
  };

  const flushAll = () => {
    flushBullets();
    flushOrdered();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    // ### / ## / # headers → section heading
    const header = line.match(/^#{1,4}\s+(.*)$/);
    if (header) {
      flushAll();
      blocks.push(
        <p key={`h-${key++}`} className="avia-md-header">
          {renderInline(header[1], `h-${key}`)}
        </p>,
      );
      continue;
    }

    // bullets: "- item" or "* item" (but not "**bold**" paragraphs)
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushOrdered();
      bullets.push(bullet[1]);
      continue;
    }

    // ordered: "1." or "1)"
    const orderedItem = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (orderedItem) {
      flushBullets();
      ordered.push(orderedItem[1]);
      continue;
    }

    // math line: centred, monospace-tinted, on its own
    if (isMathLine(line)) {
      flushAll();
      blocks.push(
        <p key={`m-${key++}`} className="avia-md-math">
          {renderInline(line.trim(), `m-${key}`)}
        </p>,
      );
      continue;
    }

    flushAll();
    blocks.push(
      <p key={`p-${key++}`} className="avia-md-p">
        {renderInline(line, `p-${key}`)}
      </p>,
    );
  }

  flushAll();
  return blocks;
}

/** Strip markdown structure down to what the speech synthesiser should read. */
export function toSpokenText(text: string): string {
  const lines = text
    .replace(/^#{1,4}\s+/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*\n]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/^\s*\d+[.)]\s+/gm, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines
    .join(" ")
    .replace(/\s+([.!?…])/g, "$1")
    .replace(/\s{2,}/g, " ")
    .trim();
}
