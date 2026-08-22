/**
 * Client-only Proton entry. Import this module dynamically from event handlers
 * (not from module scope) so Metro can code-split it for web.
 */
export {
  connectProton,
  disconnectProton,
  getProtonSession,
  uploadToLifeManagerFolder,
} from './index.web';

export { loadPersistedTokens } from './session-store.web';
