import { GRADES } from "../src/components/mathlab/mathlab";
for (const grade of GRADES) {
  const total = grade.chapters.reduce((sum, ch) => sum + ch.cheat.length, 0);
  const thin = grade.chapters.filter((ch) => ch.cheat.length < 4).map((ch) => `${ch.name}(${ch.cheat.length})`);
  console.log(`Grade ${grade.id}: ${grade.chapters.length} chapters, ${total} entries. Thin: ${thin.join(", ") || "none"}`);
}
