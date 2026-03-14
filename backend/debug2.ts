import { risk } from "./src/engine/risk/scorer.js";

const result = risk("What is the current recommended dosage for ibuprofen and latest medical guidelines? I need this to be 100% accurate for all patients.");
console.log("Score:", result.risk_score);
console.log("Level:", result.risk_level);
console.log("Factors:", result.risk_factors.map(f => `${f.signal} (${f.points})`));
