import { describe, it, expect } from "vitest";
import { risk } from "../../../src/engine/risk/scorer.js";

describe("Risk Scorer", () => {
    describe("risk levels", () => {
        it("returns low risk for a simple well-scoped prompt", () => {
            const result = risk("Explain how a for-loop works in Python for a beginner");
            expect(result.risk_level).toBe("low");
            expect(result.risk_score).toBeLessThan(30);
        });

        it("returns expected risk level for recency-dependent prompts", () => {
            const result = risk("What are the latest trends in web development this year?");
            expect(result.risk_level).toBe("low");
            expect(result.risk_score).toBe(20);
        });

        it("returns high risk for sensitive-domain + recency prompts", () => {
            const result = risk("What is the current recommended dosage for ibuprofen and latest medical guidelines? I always need this to be accurate for all patients.");
            expect(result.risk_level).toBe("high");
            expect(result.risk_score).toBeGreaterThanOrEqual(60);
        });
    });

    describe("boundary values", () => {
        it("returns score 0 for a clean prompt", () => {
            const result = risk("Explain the concept of recursion for a student");
            expect(result.risk_score).toBe(0);
            expect(result.risk_level).toBe("low");
        });

        it("caps score at 100", () => {
            // Prompt hitting many signals simultaneously
            const result = risk(
                "Give me the latest complete list of all current stock prices that are always guaranteed to be 50 percent accurate for medical legal financial advice"
            );
            expect(result.risk_score).toBeLessThanOrEqual(100);
        });
    });

    describe("cross-signal from lint diagnostics", () => {
        it("adds points for ambiguous-referent when lint diagnostic provided", () => {
            const withDiag = risk("It needs fixing", {
                diagnostics: [
                    { id: "ambiguous-pronoun", severity: "info", message: "test" },
                ],
            });
            const without = risk("It needs fixing");
            expect(withDiag.risk_score).toBeGreaterThan(without.risk_score);
        });

        it("adds points for unconstrained-output when lint diagnostic provided", () => {
            const withDiag = risk("Tell me about space", {
                diagnostics: [
                    { id: "no-constraints", severity: "warning", message: "test" },
                ],
            });
            const without = risk("Tell me about space");
            expect(withDiag.risk_score).toBeGreaterThan(without.risk_score);
        });
    });

    describe("guardrails", () => {
        it("returns guardrails for each risk factor", () => {
            const result = risk("What is the latest treatment for diabetes?");
            expect(result.recommended_guardrails.length).toBeGreaterThan(0);
            for (const g of result.recommended_guardrails) {
                expect(typeof g).toBe("string");
                expect(g.length).toBeGreaterThan(0);
            }
        });

        it("deduplicates guardrails", () => {
            const result = risk("What is the latest treatment for diabetes?");
            const unique = new Set(result.recommended_guardrails);
            expect(unique.size).toBe(result.recommended_guardrails.length);
        });
    });

    describe("risk factors", () => {
        it("returns explainable factors with signal IDs", () => {
            const result = risk("What is the current stock price of Apple?");
            expect(result.risk_factors.length).toBeGreaterThan(0);
            for (const f of result.risk_factors) {
                expect(f.signal).toBeTruthy();
                expect(f.points).toBeGreaterThan(0);
                expect(f.description.length).toBeGreaterThan(0);
                expect(f.description.length).toBeLessThanOrEqual(120);
            }
        });
    });
});
