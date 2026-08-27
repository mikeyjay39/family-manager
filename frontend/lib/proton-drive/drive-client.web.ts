import {
  MemoryCache,
  NodeType,
  OpenPGPCryptoWithCryptoProxy,
  ProtonDriveClient,
  type MaybeNode,
  type NodeEntity,
  type UploadMetadata,
} from '@protontech/drive-sdk';
import { getSrp } from '@protontech/crypto/srp';

import { LifeManagerProtonAccount } from './account-provider.web';
import { toApiSession } from './auth.web';
import { ensureProtonCryptoReady, CryptoProxy } from './crypto-setup.web';
import { createDriveHttpClient } from './drive-http-client.web';
import { LIFE_MANAGER_FOLDER_NAME } from './constants';
import { splitNodeUid } from './node-uid';
import {
  getActiveProtonSession as readActiveSession,
  setActiveProtonSession as writeActiveSession,
} from './session-state.web';
import type { ProtonActiveSession, ProtonPreviewResult, ProtonStorageUploadResult } from './types';
import { PROTON_DRIVE_PROVIDER as PROVIDER } from './types';

let driveClient: ProtonDriveClient | null = null;

function unwrapNode(maybeNode: MaybeNode): NodeEntity {
  if (!maybeNode.ok) {
    throw new Error('Proton Drive returned a degraded node.');
  }
  return maybeNode.value;
}

async function createDriveClient(session: ProtonActiveSession): Promise<ProtonDriveClient> {
  await ensureProtonCryptoReady();
  const apiSession = toApiSession(session);
  const openPGPCryptoModule = new OpenPGPCryptoWithCryptoProxy(CryptoProxy);
  const srpModule = {
    getSrp: async (
      version: number,
      modulus: string,
      serverEphemeral: string,
      salt: string,
      password: string
    ) => {
      const result = await getSrp(
        { Version: version, Modulus: modulus, ServerEphemeral: serverEphemeral, Salt: salt },
        { password }
      );
      return {
        expectedServerProof: result.expectedServerProof,
        clientProof: result.clientProof,
        clientEphemeral: result.clientEphemeral,
      };
    },
    getSrpVerifier: async () => {
      throw new Error('SRP verifier generation is not supported in life-manager.');
    },
    computeKeyPassword: async () => {
      throw new Error('Key password computation is not supported in life-manager.');
    },
  };

  return new ProtonDriveClient({
    httpClient: createDriveHttpClient(apiSession),
    entitiesCache: new MemoryCache(),
    cryptoCache: new MemoryCache(),
    account: new LifeManagerProtonAccount(session.addresses),
    openPGPCryptoModule,
    srpModule,
    config: {
      clientUid: `life-manager-${session.uid}`,
    },
  });
}

async function getClient(): Promise<ProtonDriveClient> {
  const activeSession = readActiveSession();
  if (!activeSession) {
    throw new Error('Connect to Proton Drive before uploading files.');
  }
  if (!driveClient) {
    driveClient = await createDriveClient(activeSession);
  }
  return driveClient;
}

async function findChildFolder(
  client: ProtonDriveClient,
  parentUid: string,
  name: string
): Promise<NodeEntity | null> {
  for await (const child of client.iterateFolderChildren(parentUid, { type: NodeType.Folder })) {
    if (!child.ok) {
      continue;
    }
    if (child.value.name === name && child.value.type === NodeType.Folder) {
      return child.value;
    }
  }
  return null;
}

async function ensureLifeManagerFolder(client: ProtonDriveClient): Promise<string> {
  const root = await client.getMyFilesRootFolder();
  const rootNode = unwrapNode(root);
  const existing = await findChildFolder(client, rootNode.uid, LIFE_MANAGER_FOLDER_NAME);
  if (existing) {
    return existing.uid;
  }
  const created = await client.createFolder(rootNode.uid, LIFE_MANAGER_FOLDER_NAME);
  return unwrapNode(created).uid;
}

export function setActiveProtonSession(session: ProtonActiveSession | null): void {
  writeActiveSession(session);
  driveClient = null;
}

export { readActiveSession as getActiveProtonSession };

function resolveUploadFilename(file: File, fallbackName?: string): string {
  const fromFile = file.name?.trim();
  if (fromFile) {
    return fromFile;
  }
  const fromPicker = fallbackName?.trim();
  if (fromPicker) {
    return fromPicker;
  }
  const extension = file.type?.split('/')[1];
  return extension ? `upload.${extension}` : 'upload';
}

export async function uploadFileToLifeManagerFolder(
  file: File,
  onProgress?: (uploadedBytes: number) => void,
  fallbackFilename?: string
): Promise<ProtonStorageUploadResult> {
  const client = await getClient();
  const folderUid = await ensureLifeManagerFolder(client);
  const filename = resolveUploadFilename(file, fallbackFilename);
  const metadata: UploadMetadata = {
    expectedSize: file.size,
    mimeType: file.type || 'application/octet-stream',
  };

  const uploader = await client.getFileUploader(folderUid, filename, metadata);
  const controller = await uploader.uploadFromFile(file, [], onProgress);
  const { nodeUid } = await controller.completion();
  const { shareId, nodeId } = splitNodeUid(nodeUid);

  return {
    provider: PROVIDER,
    shareId,
    nodeId,
    filename,
    mimeType: file.type || null,
  };
}

export async function getProtonNodeUrl(nodeUid: string): Promise<string | null> {
  try {
    const client = await getClient();
    return await client.experimental.getNodeUrl(nodeUid);
  } catch {
    return null;
  }
}

export function buildNodeUid(shareId: string, nodeId: string): string {
  return `${shareId}~${nodeId}`;
}

/**
 * Fetch a decrypted Proton Drive thumbnail for a node, if one exists.
 * Returns null when the node has no thumbnail or the download fails.
 */
export async function fetchProtonThumbnail(
  shareId: string,
  nodeId: string
): Promise<Blob | null> {
  try {
    const client = await getClient();
    const nodeUid = buildNodeUid(shareId, nodeId);
    for await (const result of client.iterateThumbnails([nodeUid])) {
      if (result.ok) {
        // Drive thumbnails are JPEG-encoded preview images.
        return new Blob([result.thumbnail.buffer.slice(
          result.thumbnail.byteOffset,
          result.thumbnail.byteOffset + result.thumbnail.byteLength
        ) as ArrayBuffer], { type: 'image/jpeg' });
      }
      return null;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Download and decrypt the full file for a Proton Drive node into a Blob.
 *
 * The Drive SDK may throw IntegrityError after writing decrypted bytes when
 * manifest/signature verification fails. Per SDK contract, check
 * `isDownloadCompleteWithSignatureIssues()` and keep the bytes (with a warning).
 */
export async function downloadProtonFile(
  shareId: string,
  nodeId: string,
  mimeType?: string | null
): Promise<Blob> {
  const client = await getClient();
  const nodeUid = buildNodeUid(shareId, nodeId);
  const downloader = await client.getFileDownloader(nodeUid);
  const chunks: Uint8Array[] = [];
  const stream = new WritableStream<Uint8Array>({
    write(chunk) {
      chunks.push(chunk);
    },
  });
  const controller = downloader.downloadToStream(stream);
  try {
    await controller.completion();
  } catch (error) {
    if (controller.isDownloadCompleteWithSignatureIssues() && chunks.length > 0) {
      console.warn(
        'Proton Drive download completed with signature verification issues; using decrypted bytes anyway.',
        error
      );
    } else {
      throw error;
    }
  }

  const totalLength = chunks.reduce((sum, c) => sum + c.byteLength, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new Blob(
    [merged.buffer.slice(merged.byteOffset, merged.byteOffset + merged.byteLength) as ArrayBuffer],
    {
      type: mimeType?.trim() || 'application/octet-stream',
    }
  );
}

/**
 * Load a modal preview for a Proton-backed document.
 *
 * ```
 * DocumentList (view modal)
 *   -> resolveProtonPreview(shareId, nodeId, mime, filename)
 *        -> fetchProtonThumbnail
 *             |-- ok --> image (thumbnail)
 *             +-- miss/err
 *                   -> downloadProtonFile
 *                        |-- image/* --> image (file)
 *                        |-- application/pdf --> pdf
 *                        +-- else --> file card (+ blob for Download)
 *   [Download] -> reuse full-file blob if cached / downloadProtonFile -> browser save
 * ```
 */
export async function resolveProtonPreview(
  shareId: string,
  nodeId: string,
  mimeType: string | null,
  filename: string
): Promise<ProtonPreviewResult> {
  const thumbnail = await fetchProtonThumbnail(shareId, nodeId);
  if (thumbnail) {
    return {
      kind: 'image',
      blob: thumbnail,
      source: 'thumbnail',
      filename,
      mimeType: mimeType ?? thumbnail.type,
    };
  }

  const fileBlob = await downloadProtonFile(shareId, nodeId, mimeType);
  const resolvedMime = (mimeType || fileBlob.type || '').toLowerCase();
  if (resolvedMime.startsWith('image/')) {
    return {
      kind: 'image',
      blob: fileBlob,
      source: 'file',
      filename,
      mimeType: mimeType ?? (fileBlob.type || null),
    };
  }
  if (resolvedMime === 'application/pdf') {
    return {
      kind: 'pdf',
      blob: fileBlob,
      filename,
      mimeType: mimeType ?? 'application/pdf',
    };
  }
  return {
    kind: 'file',
    blob: fileBlob,
    filename,
    mimeType: mimeType ?? (fileBlob.type || null),
  };
}

/** Trigger a browser "Save as" for a decrypted Proton file blob (web only). */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename || 'download';
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
