import type { PrivateKey } from '@protontech/drive-sdk';

import { CryptoProxy } from './crypto-setup.web';
import { protonAccountFetch, type ProtonApiSession } from './proton-api.web';
import type { ProtonAccountAddress } from './types';

interface ApiAddressKey {
  ID: string;
  PrivateKey?: string;
  Flags?: number;
  Primary?: number;
}

interface ApiAddress {
  ID: string;
  Email: string;
  Keys: ApiAddressKey[];
  Status?: number;
}

interface AddressesResponse {
  Addresses: ApiAddress[];
}

async function decryptAddressKeys(
  keys: ApiAddressKey[],
  password: string
): Promise<{ id: string; key: PrivateKey }[]> {
  const decrypted: { id: string; key: PrivateKey }[] = [];
  for (const apiKey of keys) {
    if (!apiKey.PrivateKey) {
      continue;
    }
    const key = await CryptoProxy.importPrivateKey({
      armoredKey: apiKey.PrivateKey,
      passphrase: password,
    });
    decrypted.push({ id: apiKey.ID, key });
  }
  return decrypted;
}

function primaryKeyIndex(keys: ApiAddressKey[]): number {
  const primary = keys.findIndex((key) => key.Primary === 1);
  return primary >= 0 ? primary : 0;
}

export async function loadProtonAccountAddresses(
  session: ProtonApiSession,
  password: string
): Promise<ProtonAccountAddress[]> {
  const response = await protonAccountFetch<AddressesResponse>(
    'core/v4/addresses',
    session,
    { method: 'GET' }
  );

  const addresses: ProtonAccountAddress[] = [];
  for (const address of response.Addresses) {
    if (address.Status === 0) {
      continue;
    }
    const keys = await decryptAddressKeys(address.Keys, password);
    if (keys.length === 0) {
      continue;
    }
    addresses.push({
      email: address.Email,
      addressId: address.ID,
      primaryKeyIndex: primaryKeyIndex(address.Keys),
      keys,
    });
  }

  if (addresses.length === 0) {
    throw new Error('No Proton address keys could be unlocked. Check your password.');
  }

  return addresses;
}
