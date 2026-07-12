import type { ProtonActiveSession } from './types';

let activeSession: ProtonActiveSession | null = null;

export function setActiveProtonSession(session: ProtonActiveSession | null): void {
  activeSession = session;
}

export function getActiveProtonSession(): ProtonActiveSession | null {
  return activeSession;
}
