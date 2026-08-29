import { clearPersistedTokens, loadPersistedTokens, persistTokens } from './session-store.web';
import { getActiveProtonSession } from './session-state.web';
import type { ConnectProtonOptions } from './auth.web';
import type { ProtonActiveSession, ProtonStorageUploadResult } from './types';

export type { ProtonActiveSession, ProtonStorageUploadResult, ProtonPreviewResult } from './types';
export type { ConnectProtonOptions } from './auth.web';
export { ProtonDriveNotSupportedError } from './types';

export function isProtonDriveSupported(): boolean {
  return true;
}

export function getProtonSession(): ProtonActiveSession | null {
  return getActiveProtonSession();
}

export async function connectProton(options: ConnectProtonOptions): Promise<ProtonActiveSession> {
  const { authenticateProton, toApiSession } = await import('./auth.web');
  const { loadProtonAccountAddresses } = await import('./keys.web');

  const tokens = await authenticateProton(options);
  const password = options.mailboxPassword?.trim() || options.password;
  const addresses = await loadProtonAccountAddresses(toApiSession(tokens), password);
  const session: ProtonActiveSession = {
    ...tokens,
    addresses,
  };
  const { setActiveProtonSession: resetDriveSession } = await import('./drive-client.web');
  resetDriveSession(session);
  await persistTokens(tokens);
  return session;
}

export async function disconnectProton(): Promise<void> {
  const { setActiveProtonSession: resetDriveSession } = await import('./drive-client.web');
  resetDriveSession(null);
  await clearPersistedTokens();
}

export async function restoreProtonSessionFromStorage(
  password: string
): Promise<ProtonActiveSession | null> {
  const { toApiSession } = await import('./auth.web');
  const { loadProtonAccountAddresses } = await import('./keys.web');

  const tokens = await loadPersistedTokens();
  if (!tokens) {
    return null;
  }
  const addresses = await loadProtonAccountAddresses(toApiSession(tokens), password);
  const session: ProtonActiveSession = { ...tokens, addresses };
  const { setActiveProtonSession: resetDriveSession } = await import('./drive-client.web');
  resetDriveSession(session);
  return session;
}

export async function uploadToLifeManagerFolder(
  file: File,
  onProgress?: (uploadedBytes: number) => void,
  fallbackFilename?: string
): Promise<ProtonStorageUploadResult> {
  const { uploadFileToLifeManagerFolder } = await import('./drive-client.web');
  return uploadFileToLifeManagerFolder(file, onProgress, fallbackFilename);
}

export async function buildNodeUid(shareId: string, nodeId: string): Promise<string> {
  const { buildNodeUid: build } = await import('./drive-client.web');
  return build(shareId, nodeId);
}

export async function getProtonNodeUrl(nodeUid: string): Promise<string | null> {
  const { getProtonNodeUrl: getUrl } = await import('./drive-client.web');
  return getUrl(nodeUid);
}

export async function fetchProtonThumbnail(
  shareId: string,
  nodeId: string
): Promise<Blob | null> {
  const { fetchProtonThumbnail: fetchThumb } = await import('./drive-client.web');
  return fetchThumb(shareId, nodeId);
}

export async function downloadProtonFile(
  shareId: string,
  nodeId: string,
  mimeType?: string | null
): Promise<Blob> {
  const { downloadProtonFile: download } = await import('./drive-client.web');
  return download(shareId, nodeId, mimeType);
}

export async function resolveProtonPreview(
  shareId: string,
  nodeId: string,
  mimeType: string | null,
  filename: string
): Promise<import('./types').ProtonPreviewResult> {
  const { resolveProtonPreview: resolve } = await import('./drive-client.web');
  return resolve(shareId, nodeId, mimeType, filename);
}

export async function triggerBrowserDownload(blob: Blob, filename: string): Promise<void> {
  const { triggerBrowserDownload: trigger } = await import('./drive-client.web');
  trigger(blob, filename);
}

export async function trashProtonFile(shareId: string, nodeId: string): Promise<void> {
  const { trashProtonFile: trash } = await import('./drive-client.web');
  return trash(shareId, nodeId);
}
