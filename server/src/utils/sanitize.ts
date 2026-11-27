const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
const urlPattern = /\bhttps?:\/\/[^\s)"']+/gi;
const phonePattern = /\+?\d[\d\s().-]{7,}\d/g;
const vinPattern = /\b(?![IOQ])[A-HJ-NPR-Z0-9]{17}\b/g;
const secretPattern =
  /(api[_-]?key|token|secret|password)\s*[:=]\s*['"]?([A-Z0-9_\-.]{6,})['"]?/gi;
const bearerPattern = /bearer\s+[A-Z0-9\-._~+/]+=*/gi;

export function sanitizeForAi(input: string): string {
  return input
    .replace(emailPattern, "[REDACTED_EMAIL]")
    .replace(urlPattern, "[REDACTED_URL]")
    .replace(phonePattern, "[REDACTED_PHONE]")
    .replace(vinPattern, "[REDACTED_VIN]")
    .replace(secretPattern, "$1=[REDACTED_SECRET]")
    .replace(bearerPattern, "Bearer [REDACTED_TOKEN]");
}
