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
import type { ProtonActiveSession, ProtonStorageUploadResult } from './types';
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
