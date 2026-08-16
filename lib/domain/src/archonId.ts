import { randomUUID } from "node:crypto";

/**
 * ARCHON ID standard: `AR-<OBJECTTYPE>-<uuid>`.
 * Immutable once assigned; server-generated only.
 */
export function generateArchonId(objectType: string): string {
  const slug = objectType
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
  return `AR-${slug || "OBJECT"}-${randomUUID()}`;
}

export function isArchonId(value: string): boolean {
  return /^AR-[A-Z0-9]{1,12}-[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(
    value,
  );
}
