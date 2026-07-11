export function safeSameOriginPath(value: string | null): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  if (value === "/signin" || value.startsWith("/signin/") || value.startsWith("/signin?")) {
    return null;
  }
  return value;
}
