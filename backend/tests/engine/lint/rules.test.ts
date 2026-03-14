import { describe, it, expect } from "vitest";
import { lint } from "../../../src/engine/lint/runner.js";

describe("Lint Rules", () => {
    // vague-prompt
    describe("vague-prompt", () => {
        it("flags short prompts under 15 words", () => {
            const result = lint("Tell me about dogs");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("vague-prompt");
        });

        it("passes prompts with 15+ words", () => {
            const result = lint("Please explain the key differences between React and Vue frameworks for building modern web applications in detail for a beginner audience");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("vague-prompt");
        });
    });

    // no-output-format
    describe("no-output-format", () => {
        it("flags prompts without format keywords", () => {
            const result = lint("Explain how photosynthesis works in the context of biology for a student audience to avoid any confusion and provide clear boundaries");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("no-output-format");
        });

        it("passes when prompt specifies a format", () => {
            const result = lint("List the top 5 programming languages in a bullet format");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("no-output-format");
        });
    });

    // no-constraints
    describe("no-constraints", () => {
        it("flags prompts without constraint words", () => {
            const result = lint("Tell me about machine learning algorithms and their applications in data science today");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("no-constraints");
        });

        it("passes when prompt has constraints", () => {
            const result = lint("Explain machine learning in at most 200 words");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("no-constraints");
        });
    });

    // ambiguous-pronoun
    describe("ambiguous-pronoun", () => {
        it("flags when first sentence starts with dangling pronoun", () => {
            const result = lint("It doesn't work properly. Can you help me fix the login page for my React application please?");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("ambiguous-pronoun");
        });

        it("passes when pronouns have context", () => {
            const result = lint("The login page doesn't work. Can you help me fix it?");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("ambiguous-pronoun");
        });
    });

    // missing-context
    describe("missing-context", () => {
        it("flags prompts without audience or domain context", () => {
            const result = lint("Explain quantum computing and its implications in a structured step-by-step list limited to 500 words");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("missing-context");
        });

        it("passes when audience is specified", () => {
            const result = lint("Explain quantum computing for a beginner");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("missing-context");
        });
    });

    // multiple-questions
    describe("multiple-questions", () => {
        it("flags multiple question marks", () => {
            const result = lint("What is React? How does it compare to Vue? Which one should I learn first?");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("multiple-questions");
        });

        it("passes with single question", () => {
            const result = lint("What is the best approach to learn React?");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("multiple-questions");
        });
    });

    // negative-only
    describe("negative-only", () => {
        it("flags prompts with only negative directives", () => {
            const result = lint("Don't rely on jargon. Avoid technical terms. Never reference documentation.");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("negative-only");
        });

        it("passes when positive directives are present", () => {
            const result = lint("Don't rely on jargon. Write in plain English.");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("negative-only");
        });
    });

    // wall-of-text
    describe("wall-of-text", () => {
        it("flags long text without structure", () => {
            const wall = "a ".repeat(300); // 600 chars, no breaks
            const result = lint(wall);
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("wall-of-text");
        });

        it("passes when structured with line breaks", () => {
            const structured = "a ".repeat(150) + "\n\n" + "b ".repeat(150);
            const result = lint(structured);
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("wall-of-text");
        });
    });

    // missing-language
    describe("missing-language", () => {
        it("flags coding prompts without a language", () => {
            const result = lint("Write a function that sorts an array of objects by date");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("missing-language");
        });

        it("passes when language is specified", () => {
            const result = lint("Write a Python function that sorts a list");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("missing-language");
        });
    });

    // conflicting-instructions
    describe("conflicting-instructions", () => {
        it("flags contradictory directives", () => {
            const result = lint("Write a short and detailed explanation of quantum physics");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).toContain("conflicting-instructions");
        });

        it("passes when directives are consistent", () => {
            const result = lint("Write a detailed and thorough explanation of quantum physics");
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("conflicting-instructions");
        });
    });

    // quality_score
    describe("quality_score", () => {
        it("returns 100 for a well-crafted prompt", () => {
            const result = lint("For a beginner audience, explain the key differences between SQL and NoSQL databases in a bullet list format, limited to 300 words, and include pros and cons for each. Avoid overly technical jargon.");
            expect(result.quality_score).toBe(100);
        });

        it("returns lower score for problematic prompts", () => {
            const result = lint("Tell me stuff");
            expect(result.quality_score).toBeLessThan(100);
        });

        it("never goes below 0", () => {
            const result = lint("x");
            expect(result.quality_score).toBeGreaterThanOrEqual(0);
        });
    });

    // disabledRules option
    describe("options", () => {
        it("respects disabledRules", () => {
            const result = lint("Hi", { disabledRules: ["vague-prompt"] });
            const ids = result.diagnostics.map((d) => d.id);
            expect(ids).not.toContain("vague-prompt");
        });
    });
});
