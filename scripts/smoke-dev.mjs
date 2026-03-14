#!/usr/bin/env node
// scripts/smoke-dev.mjs — Clairity dev smoke test (zero deps, Node 18+)
// Usage: node scripts/smoke-dev.mjs
// Requires: backend running at localhost:3001 with SESSION_SECRET set

import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const BASE = "http://localhost:3001/v1";
const EXT_ORIGIN = "chrome-extension://jcknmkajffpgmmbeejangjilblgja";
let passed = 0;
let total = 0;

function fail(label, msg) {
    console.error(`\n❌ FAIL [${label}]: ${msg}`);
    process.exit(1);
}
function ok(label) {
    passed++;
    console.log(`✅ ${label}`);
}
function section(name) {
    total++;
    console.log(`\n--- ${name} ---`);
}

// ─── B1: Backend reachability ────────────────────────────
section("B1: Backend reachability");
try {
    const res = await fetch(`${BASE.replace("/v1", "")}/v1/health`);
    if (!res.ok) fail("B1", `Health returned ${res.status}`);
    ok("Backend reachable at localhost:3001");
} catch (e) {
    fail("B1", `Cannot connect to backend at localhost:3001.\n  → Start it: $env:SESSION_SECRET='clairity-dev-secret-key-32chars!!'; npm run dev --workspace=backend\n  Error: ${e.message}`);
}

// ─── B2: CORS preflight ─────────────────────────────────
section("B2: CORS preflight");
const optRes = await fetch(`${BASE}/session`, {
    method: "OPTIONS",
    headers: {
        "Origin": EXT_ORIGIN,
        "Access-Control-Request-Method": "POST",
    },
});
const acao = optRes.headers.get("access-control-allow-origin");
if (optRes.status !== 204 && optRes.status !== 200) {
    fail("B2", `OPTIONS returned ${optRes.status}, expected 200/204`);
}
if (acao === "*") {
    fail("B2", "CORS returned wildcard * — must be explicit origin");
}
if (acao !== EXT_ORIGIN) {
    fail("B2", `ACAO header is '${acao}', expected '${EXT_ORIGIN}'`);
}
ok(`CORS preflight OK — ACAO: ${acao}`);

// ─── B3: Session creation ───────────────────────────────
section("B3: Session creation");
const sessRes = await fetch(`${BASE}/session`, {
    method: "POST",
    headers: { "Origin": EXT_ORIGIN },
});
if (sessRes.status === 500) {
    const body = await sessRes.text();
    if (body.includes("SESSION_SECRET")) {
        fail("B3", "SESSION_SECRET not set.\n  → Set it: $env:SESSION_SECRET='clairity-dev-secret-key-32chars!!'");
    }
    fail("B3", `Session returned 500: ${body.slice(0, 200)}`);
}
if (sessRes.status !== 201 && sessRes.status !== 200) {
    fail("B3", `Session returned ${sessRes.status}`);
}
const sessJson = await sessRes.json();
if (!sessJson.token || sessJson.token.length < 10) {
    fail("B3", "Session response missing valid token");
}
ok(`Session created — token length: ${sessJson.token.length}, session_id: ${sessJson.session_id ? "present" : "missing"}`);

// ─── B4: Rewrite endpoint ───────────────────────────────
section("B4: Rewrite endpoint");
const rewriteBody = {
    prompt: "help me write better code",
    context: { site: "chatgpt" },
};
const rwRes = await fetch(`${BASE}/rewrite`, {
    method: "POST",
    headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${sessJson.token}`,
        "Origin": EXT_ORIGIN,
    },
    body: JSON.stringify(rewriteBody),
});
if (rwRes.status === 401 || rwRes.status === 403) {
    fail("B4", `Rewrite returned ${rwRes.status} — auth issue. Check token format: Authorization: Bearer <token>`);
}
if (!rwRes.ok) {
    const errText = await rwRes.text();
    fail("B4", `Rewrite returned ${rwRes.status}: ${errText.slice(0, 300)}`);
}
const rwJson = await rwRes.json();
const requiredKeys = ["enhanced_prompt", "score", "changes", "metadata", "request_id"];
const missingKeys = requiredKeys.filter(k => !(k in rwJson));
if (missingKeys.length > 0) {
    fail("B4", `Rewrite response missing keys: ${missingKeys.join(", ")}`);
}
ok(`Rewrite OK — enhanced_prompt length: ${rwJson.enhanced_prompt.length}, score.overall: ${rwJson.score?.overall}, changes: ${rwJson.changes?.length}, request_id: ${rwJson.request_id ? "present" : "missing"}`);

// ─── B5: Extension build artifact checks ────────────────
section("B5: Extension build artifacts");

const SW_PATH = resolve("extension", "dist", "service-worker.js");
const EXT_DIR = resolve("extension");

function viteBuild(mode) {
    const isWin = process.platform === "win32";
    const viteBin = isWin
        ? resolve("node_modules", ".bin", "vite.cmd")
        : resolve("node_modules", ".bin", "vite");
    execSync(`"${viteBin}" build --mode ${mode}`, {
        cwd: EXT_DIR,
        stdio: "pipe",
        timeout: 30000,
    });
}

// B5a: Dev build
console.log("  Building dev...");
try {
    viteBuild("development");
} catch (e) {
    fail("B5", `Dev build failed: ${e.stderr?.toString().slice(0, 300) || e.message?.slice(0, 300)}`);
}
if (!existsSync(SW_PATH)) fail("B5", `service-worker.js not found at ${SW_PATH}`);
const devSW = readFileSync(SW_PATH, "utf-8");

if (!devSW.includes("http://localhost:3001/v1")) {
    fail("B5", "Dev build does NOT contain 'http://localhost:3001/v1'");
}
if (devSW.includes("onrender.com")) {
    fail("B5", "Dev build contains 'onrender.com' — should only appear in prod");
}
if (!devSW.includes("[Clairity]")) {
    fail("B5", "Dev build missing '[Clairity]' debug marker");
}
ok("Dev build: localhost:3001 ✓ | no onrender.com ✓ | debug logs ✓");

// B5b: Prod build
console.log("  Building prod...");
try {
    viteBuild("production");
} catch (e) {
    fail("B5", `Prod build failed: ${e.stderr?.toString().slice(0, 300) || e.message?.slice(0, 300)}`);
}
const prodSW = readFileSync(SW_PATH, "utf-8");

if (!prodSW.includes("onrender.com")) {
    fail("B5", "Prod build does NOT contain 'onrender.com'");
}
if (prodSW.includes("localhost:3001")) {
    fail("B5", "Prod build contains 'localhost:3001' — must not leak in prod");
}
if (prodSW.includes("[Clairity]")) {
    fail("B5", "Prod build contains '[Clairity]' debug logs — must be stripped in prod");
}
ok("Prod build: onrender.com ✓ | no localhost ✓ | no debug logs ✓");

// Rebuild dev so extension/dist is dev-ready for Chrome loading
console.log("  Rebuilding dev for local use...");
try { viteBuild("development"); } catch { /* best effort */ }

// ─── FINAL SUMMARY ─────────────────────────────────────
console.log("\n══════════════════════════════════");
console.log("SMOKE TEST PASS ✅");
console.log(`All ${total} checks passed.`);
console.log("══════════════════════════════════\n");
