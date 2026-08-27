import type { PrivateKey } from '@protontech/drive-sdk';

import type { ProtonSessionTokens } from './session-types';

export type { ProtonSessionTokens };

export const PROTON_DRIVE_PROVIDER = 'proton_drive';

export { LIFE_MANAGER_FOLDER_NAME } from './constants';

export interface ProtonStorageUploadResult {
  provider: typeof PROTON_DRIVE_PROVIDER;
  shareId: string;
  nodeId: string;
  filename: string;
  mimeType: string | null;
}

export type ProtonPreviewResult =
  | {
      kind: 'image';
      blob: Blob;
      source: 'thumbnail' | 'file';
      filename: string;
      mimeType: string | null;
    }
  | {
      kind: 'pdf';
      blob: Blob;
      filename: string;
      mimeType: string | null;
    }
  | {
      kind: 'file';
      blob: Blob;
      filename: string;
      mimeType: string | null;
    };

export interface ProtonAddressKey {
  id: string;
  key: PrivateKey;
}

export interface ProtonAccountAddress {
  email: string;
  addressId: string;
  primaryKeyIndex: number;
  keys: ProtonAddressKey[];
}

export interface ProtonActiveSession extends ProtonSessionTokens {
  addresses: ProtonAccountAddress[];
}

export class ProtonDriveNotSupportedError extends Error {
  constructor(message = 'Proton Drive is only available on web.') {
    super(message);
    this.name = 'ProtonDriveNotSupportedError';
  }
}
