export type Bench = "physics" | "chemistry" | "biology";

/**
 * Which bench a NCERT science chapter belongs to.
 *
 * The exam syllabus keeps Science as one subject, but the lab has three
 * benches, and the chapter picker filters by this function — so a biology
 * chapter showing up under Physics or Chemistry is this function being wrong.
 *
 * Biology is tested first on purpose. A title like "How do Organisms
 * Reproduce?" matches nothing in the old chemistry list but was falling
 * through to the catch-all, which made it appear under every bench; "The
 * Invisible Living World: Beyond Our Naked Eye" contains the word *eye* and
 * would otherwise be filed as Physics. Chemistry keeps its early claim on
 * "Chemical Effects of Electric Current", which names both subjects.
 *
 * The patterns are anchored to the words a chapter title actually carries, so
 * a title that names nothing specific returns "both" and stays available
 * wherever the student is standing rather than being guessed wrong.
 */
export function chapterBench(chapter: string): Bench | "both" {
  const title = chapter.toLowerCase();

  if (
    /reproduc|organism|cell|tissue|heredity|adolesc|excretory|neural|hormone|blood|circulation|digestion|breath|nephron|photosynth|respiration|germination|pollination|crop|microorganism|conservation|environment|pollution|disease|health|diversity|coordination|living|ecosystem|biodiversity|life process|\blife\b|nutrition/.test(
      title,
    )
  ) {
    return "biology";
  }

  if (
    /chemical|acid|base|salt|metal|non-metal|atom|molecular|molecule|matter|mixture|solution|solvent|solute|compound|combustion|coal|petroleum|carbon|periodic|fibre|electroly|oxidation|reaction/.test(
      title,
    )
  ) {
    return "chemistry";
  }

  if (
    /light|sound|force|motion|gravitation|electric|magnetic|energy|pressure|friction|natural phenomena|current|wave|human eye|\beye\b|mirror|lens|prism|optics|heat|temperature|circuit|velocity|acceleration|pendulum|simple machine|stars|skies|solar/.test(
      title,
    )
  ) {
    return "physics";
  }

  return "both";
}
