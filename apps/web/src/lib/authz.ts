function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function parseOwnerEmails(configuredOwners: string): Set<string> {
  return new Set(
    configuredOwners.split(",").map(normalizeEmail).filter(Boolean),
  );
}

export function isOwnerEmail(
  candidate: string | null | undefined,
  configuredOwners: string,
): boolean {
  return candidate
    ? parseOwnerEmails(configuredOwners).has(normalizeEmail(candidate))
    : false;
}
