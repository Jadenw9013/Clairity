import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { lint, risk, intent } from "../../src/engine/index.js";

interface GoldenFixture {
    prompt: string;
    expected: {
        lint_ids: string[];
        risk_level: string;
        intent: string;
    };
}

describe("Golden Regression Suite", () => {
    const fixturesDir = path.resolve(__dirname, "../../../tests/golden/quality");
    const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith(".json"));

    for (const file of files) {
        it(`matches golden expectations for ${file}`, () => {
            const content = fs.readFileSync(path.join(fixturesDir, file), "utf-8");
            const fixture: GoldenFixture = JSON.parse(content);

            // 1. Lint
            const lintResult = lint(fixture.prompt);
            const lintIds = lintResult.diagnostics.map((d) => d.id).sort();
            const expectedLintIds = [...fixture.expected.lint_ids].sort();

            expect(lintIds, `Lint IDs mismatch in ${file}`).toEqual(expectedLintIds);

            // 2. Risk (passing diagnostics for cross-signal)
            const riskResult = risk(fixture.prompt, { diagnostics: lintResult.diagnostics });
            expect(riskResult.risk_level, `Risk level mismatch in ${file}`).toBe(fixture.expected.risk_level);

            // 3. Intent
            const intentResult = intent(fixture.prompt);
            expect(intentResult.intent, `Intent mismatch in ${file}`).toBe(fixture.expected.intent);
        });
    }
});
