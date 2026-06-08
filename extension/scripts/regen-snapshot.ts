/**
 * Regenerates the committed board snapshot (`src/atrium-board.json`) from a live
 * Linear pull, so snapshot-mode (no API key) matches the real board.
 *
 * Run:  ATRIUM_LINEAR_KEY=lin_api_… bun run scripts/regen-snapshot.ts
 *
 * The key is read from the environment only — never committed. Grouping/stage
 * metadata comes from `WAVE_META` in src/board.ts, so update that first when the
 * wave taxonomy changes, then regenerate here.
 */
import { writeFileSync } from "fs";
import { join } from "path";
import { LinearSdkSource } from "../src/linear-source";

const apiKey = process.env.ATRIUM_LINEAR_KEY;
if (!apiKey) {
  console.error("Set ATRIUM_LINEAR_KEY to a Linear personal API key first.");
  process.exit(1);
}

const generatedAt = new Date().toISOString().slice(0, 10);
const board = await new LinearSdkSource({ apiKey, projectName: "Atrium", generatedAt }).load();

const out = join(import.meta.dir, "..", "src", "atrium-board.json");
writeFileSync(out, JSON.stringify(board, null, 2) + "\n");

const tickets = board.waves.reduce((n, w) => n + w.tickets.length, 0);
console.log(`Wrote ${out}`);
console.log(`  ${board.waves.length} waves · ${tickets} tickets · ${board.spikes.length} spikes · generatedAt ${generatedAt}`);
for (const w of board.waves) console.log(`  - ${w.name} [${w.stage}] · ${w.tickets.length} tickets`);
