export const MAX_PROMPT_LENGTH = 10000;

/** Validate prompt length. Returns a user-facing error string, or null if valid. */
export function validatePromptLength(prompt: string): string | null {
  if (!prompt || prompt.trim().length === 0) return "Please enter a prompt.";
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return `Prompt exceeds ${MAX_PROMPT_LENGTH.toLocaleString()} character limit.`;
  }
  return null;
}

/** Return color for a score value (green/yellow/red). */
export function scoreColor(value: number): string {
  if (value >= 70) return "#10b981";
  if (value >= 40) return "#f59e0b";
  return "#ef4444";
}

/** Debounce utility for real-time input handling */
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}
