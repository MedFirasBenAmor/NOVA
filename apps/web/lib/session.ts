export const SESSION_KEY = 'nova.leadId';
export const PROCESSING_KEY = 'nova.processingDocument';

export function readLeadId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(SESSION_KEY);
    window.localStorage.removeItem(PROCESSING_KEY);
  } catch {
    /* storage unavailable */
  }
}

export function hasExistingSession(): boolean {
  return readLeadId() !== null;
}
