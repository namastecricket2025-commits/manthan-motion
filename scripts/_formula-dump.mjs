import { GRADES } from "../src/components/mathlab/mathlab.ts";
for (const g of GRADES) {
  console.log(`\n=== Grade ${g.id} ===`);
  for (const ch of g.chapters) {
    console.log(`- ${ch.name}: ${ch.cheat.map(c => c.title).join(" | ")}`);
  }
}
