import { describe, it, expect } from "vitest";
import { intent } from "../../../src/engine/index.js";

describe("Intent Detection", () => {
    describe("classification", () => {
        it("detects coding intent", () => {
            const result = intent("Write a function that validates user input");
            expect(result.intent).toBe("coding");
        });

        it("detects writing intent", () => {
            const result = intent("Draft a professional email to my manager about the project delay");
            expect(result.intent).toBe("writing");
        });

        it("detects research intent", () => {
            const result = intent("Compare the advantages and disadvantages of solar vs wind energy");
            expect(result.intent).toBe("research");
        });

        it("detects career intent", () => {
            const result = intent("Help me improve my resume for a senior developer job interview");
            expect(result.intent).toBe("career");
        });

        it("falls back to general for ambiguous prompts", () => {
            const result = intent("Help me with something");
            expect(result.intent).toBe("general");
        });
    });

    describe("confidence scoring", () => {
        it("returns high confidence for clear intent", () => {
            const result = intent("Write a Python function that implements binary search algorithm with recursive approach and deploy to production");
            expect(result.confidence).toBeGreaterThanOrEqual(60);
        });

        it("returns low confidence for general prompts", () => {
            const result = intent("Help me with something");
            expect(result.confidence).toBeLessThan(60);
        });

        it("confidence is between 0 and 100", () => {
            const prompts = [
                "x",
                "Write a function",
                "Help me with my resume for a job interview at Google as a senior developer",
            ];
            for (const p of prompts) {
                const result = intent(p);
                expect(result.confidence).toBeGreaterThanOrEqual(0);
                expect(result.confidence).toBeLessThanOrEqual(100);
            }
        });
    });

    describe("clarifying questions", () => {
        it("returns questions when confidence < 60", () => {
            const result = intent("Help me with something");
            expect(result.confidence).toBeLessThan(60);
            expect(result.clarifying_questions.length).toBeGreaterThan(0);
            expect(result.clarifying_questions.length).toBeLessThanOrEqual(3);
        });

        it("returns no questions when confidence >= 60", () => {
            const result = intent("Write a Python function that implements binary search algorithm with recursive approach and deploy to production");
            expect(result.confidence).toBeGreaterThanOrEqual(60);
            expect(result.clarifying_questions).toHaveLength(0);
        });

        it("questions are plain English strings", () => {
            const result = intent("Hello");
            for (const q of result.clarifying_questions) {
                expect(typeof q).toBe("string");
                expect(q.endsWith("?")).toBe(true);
            }
        });
    });
});
