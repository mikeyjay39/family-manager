/**
 * Classifies Proton Drive trash/delete error strings as "already gone"
 * (missing, already trashed, or not found) so callers can treat them as success.
 */
export function isProtonNodeAlreadyGoneError(error: string): boolean {
  const normalized = error.trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes('not found') ||
    normalized.includes('does not exist') ||
    normalized.includes('already trash') ||
    normalized.includes('already been trash') ||
    normalized.includes('no such') ||
    /\b404\b/.test(normalized)
  );
}
