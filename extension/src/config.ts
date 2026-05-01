// Centralized API configuration for Clairity Extension
// Defaults to production backend. Developers can override via:
//   VITE_API_BASE_URL=http://localhost:3001/v1

export const API_BASE: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ||
  "https://backend-production-55e8.up.railway.app/v1";

console.log(`[Clairity] API Base: ${API_BASE}`);
