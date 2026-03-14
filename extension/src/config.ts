// Centralized API configuration for Clairity Extension
// The API_BASE is injected at build time by Vite's `define` option.
// See vite.config.ts for how DEV vs PROD values are set.

const DEV_API_BASE = "http://localhost:3001/v1";
const PROD_API_BASE = "https://clairity-backend.onrender.com/v1";

// __CLAIRITY_DEV__ is replaced at build time by Vite define
declare const __CLAIRITY_DEV__: boolean;
const isDev = typeof __CLAIRITY_DEV__ !== "undefined" && __CLAIRITY_DEV__;

export const API_BASE = isDev ? DEV_API_BASE : PROD_API_BASE;

// Hard guard: dev build must NEVER call production
if (isDev && API_BASE.includes("onrender")) {
    throw new Error(
        "[Clairity] FATAL: Dev build resolved to production URL. Check vite.config.ts define."
    );
}

// Dev-only startup log (never leaks secrets)
if (isDev) {
    console.log(`[Clairity] API Base: ${API_BASE}`);
    console.log(`[Clairity] Mode: DEVELOPMENT`);
}
