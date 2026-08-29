export type {
  ProtonActiveSession,
  ProtonStorageUploadResult,
  ProtonPreviewResult,
} from './types';
export { ProtonDriveNotSupportedError } from './types';

export function isProtonDriveSupported(): boolean {
  return false;
}

export async function connectProton(): Promise<never> {
  throw new Error('Proton Drive is only available on web.');
}

export async function disconnectProton(): Promise<void> {
  // no-op on native
}

export function getProtonSession(): null {
  return null;
}

export async function uploadToLifeManagerFolder(): Promise<never> {
  throw new Error('Proton Drive is only available on web.');
}

export async function fetchProtonThumbnail(): Promise<null> {
  return null;
}

export async function downloadProtonFile(): Promise<never> {
  throw new Error('Proton Drive is only available on web.');
}

export async function resolveProtonPreview(): Promise<never> {
  throw new Error('Proton Drive is only available on web.');
}

export async function triggerBrowserDownload(): Promise<never> {
  throw new Error('Proton Drive is only available on web.');
}

export async function trashProtonFile(): Promise<never> {
  throw new Error('Proton Drive is only available on web.');
}
