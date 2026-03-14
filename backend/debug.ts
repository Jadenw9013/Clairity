import fs from "fs";
import path from "path";
import { lint, risk, intent } from "./src/engine/index.js";

const dir = path.resolve("../tests/golden/quality");
const files = fs.readdirSync(dir).filter(f => f.endsWith(".json"));

for (const f of files) {
    const data = JSON.parse(fs.readFileSync(path.join(dir, f), "utf-8"));
    const p = data.prompt;
    const l = lint(p);
    const r = risk(p, { diagnostics: l.diagnostics });
    const i = intent(p);
    console.log(`\n--- ${f} ---`);
    console.log(JSON.stringify({
        lint_ids: l.diagnostics.map(d => d.id).sort(),
        risk_level: r.risk_level,
        intent: i.intent
    }, null, 2));
}
