import { CryptoProxy, VERIFICATION_STATUS } from '@protontech/crypto';
import { computeKeyPassword } from '@protontech/crypto/srp';
import type { PrivateKey } from '@protontech/drive-sdk';

import { ensureProtonCryptoReady } from './crypto-setup.web';
import { protonAccountFetch, type ProtonApiSession } from './proton-api.web';
import type { ProtonAccountAddress } from './types';

interface ApiKey {
  ID: string;
  PrivateKey?: string;
  Token?: string;
  Signature?: string;
  Activation?: string;
  Primary?: number;
  Active?: number;
  Flags?: number;
}

interface ApiUser {
  Keys: ApiKey[];
  OrganizationPrivateKey?: string;
}

interface KeySaltEntry {
  ID: string;
  KeySalt: string;
}

interface ApiAddress {
  ID: string;
  Email: string;
  Keys: ApiKey[];
  Status?: number;
}

interface DecryptedKeyPair {
  ID: string;
  privateKey: PrivateKey;
  publicKey: unknown;
  Primary?: number;
  Flags?: number;
}

function splitKeys(keys: DecryptedKeyPair[]) {
  return keys.reduce<{
    privateKeys: PrivateKey[];
    publicKeys: unknown[];
  }>(
    (acc, { privateKey, publicKey }) => {
      acc.privateKeys.push(privateKey);
      acc.publicKeys.push(publicKey);
      return acc;
    },
    { privateKeys: [], publicKeys: [] }
  );
}

function primaryKeyIndex(keys: ApiKey[]): number {
  const primary = keys.findIndex((key) => key.Primary === 1);
  return primary >= 0 ? primary : 0;
}

async function decryptMemberToken(
  token: string,
  privateKeys: PrivateKey[],
  publicKeys: unknown[]
): Promise<string> {
  const { data: decryptedToken, verificationStatus } = await CryptoProxy.decryptMessage({
    armoredMessage: token,
    decryptionKeys: privateKeys,
    verificationKeys: publicKeys,
  });

  if (verificationStatus !== VERIFICATION_STATUS.SIGNED_AND_VALID) {
    throw new Error('Signature verification failed');
  }

  return String(decryptedToken);
}

async function decryptAddressKeyToken(options: {
  Token: string;
  Signature: string;
  privateKeys: PrivateKey[];
  publicKeys: unknown[];
}): Promise<string> {
  const { data: decryptedToken, verificationStatus } = await CryptoProxy.decryptMessage({
    armoredMessage: options.Token,
    armoredSignature: options.Signature,
    decryptionKeys: options.privateKeys,
    verificationKeys: options.publicKeys,
  });

  if (verificationStatus !== VERIFICATION_STATUS.SIGNED_AND_VALID) {
    throw new Error('Signature verification failed');
  }

  return String(decryptedToken);
}

async function getAddressKeyPassword(
  addressKey: ApiKey,
  userKeysPair: ReturnType<typeof splitKeys>,
  keyPassword: string
): Promise<string> {
  if (addressKey.Activation) {
    return decryptMemberToken(
      addressKey.Activation,
      userKeysPair.privateKeys,
      userKeysPair.publicKeys
    );
  }

  if (addressKey.Token && addressKey.Signature) {
    return decryptAddressKeyToken({
      Token: addressKey.Token,
      Signature: addressKey.Signature,
      privateKeys: userKeysPair.privateKeys,
      publicKeys: userKeysPair.publicKeys,
    });
  }

  return keyPassword;
}

async function getDecryptedUserKey(
  key: ApiKey,
  keyPassword: string
): Promise<DecryptedKeyPair | null> {
  if (!key.PrivateKey) {
    return null;
  }

  const privateKey = await CryptoProxy.importPrivateKey({
    armoredKey: key.PrivateKey,
    passphrase: keyPassword,
  });
  const publicKey = await CryptoProxy.importPublicKey({ armoredKey: key.PrivateKey });

  return {
    ID: key.ID,
    privateKey,
    publicKey,
    Primary: key.Primary,
    Flags: key.Flags,
  };
}

async function getDecryptedUserKeys(userKeys: ApiKey[], keyPassword: string): Promise<DecryptedKeyPair[]> {
  const activeKeys = userKeys.filter((key) => key.Active !== 0);
  if (activeKeys.length === 0) {
    return [];
  }

  const [primaryKey, ...restKeys] = activeKeys;
  const primaryKeyResult = await getDecryptedUserKey(primaryKey, keyPassword).catch(() => null);
  if (!primaryKeyResult) {
    return [];
  }

  const restKeyResults = await Promise.all(
    restKeys.map((restKey) => getDecryptedUserKey(restKey, keyPassword).catch(() => null))
  );

  return [primaryKeyResult, ...restKeyResults.filter((key): key is DecryptedKeyPair => key !== null)];
}

async function getDecryptedAddressKey(
  addressKey: ApiKey,
  addressKeyPassword: string
): Promise<{ id: string; key: PrivateKey } | null> {
  if (!addressKey.PrivateKey) {
    return null;
  }

  const key = await CryptoProxy.importPrivateKey({
    armoredKey: addressKey.PrivateKey,
    passphrase: addressKeyPassword,
  });

  return { id: addressKey.ID, key };
}

async function deriveKeyPassword(
  user: ApiUser,
  loginPassword: string,
  keySalts: KeySaltEntry[]
): Promise<string> {
  const primaryKey = user.Keys.find((key) => key.Primary === 1) ?? user.Keys[0];
  if (!primaryKey) {
    throw new Error('Proton user has no keys.');
  }

  const saltEntry = keySalts.find(({ ID }) => ID === primaryKey.ID);
  if (!saltEntry?.KeySalt) {
    return loginPassword;
  }

  return computeKeyPassword(loginPassword, saltEntry.KeySalt);
}

async function getDecryptedAddressKeysForAddress(
  addressKeys: ApiKey[],
  userKeysPair: ReturnType<typeof splitKeys>,
  keyPassword: string
): Promise<{ id: string; key: PrivateKey }[]> {
  if (addressKeys.length === 0 || userKeysPair.privateKeys.length === 0) {
    return [];
  }

  const [primaryKey, ...restKeys] = addressKeys;
  const primaryPassword = await getAddressKeyPassword(primaryKey, userKeysPair, keyPassword);
  const primaryKeyResult = await getDecryptedAddressKey(primaryKey, primaryPassword).catch(() => null);
  if (!primaryKeyResult) {
    return [];
  }

  const restKeyResults = await Promise.all(
    restKeys.map(async (restKey) => {
      const password = await getAddressKeyPassword(restKey, userKeysPair, keyPassword);
      return getDecryptedAddressKey(restKey, password).catch(() => null);
    })
  );

  return [primaryKeyResult, ...restKeyResults.filter((key): key is { id: string; key: PrivateKey } => key !== null)];
}

export async function loadProtonAccountAddresses(
  session: ProtonApiSession,
  loginPassword: string
): Promise<ProtonAccountAddress[]> {
  await ensureProtonCryptoReady();

  const [userResponse, saltsResponse, addressesResponse] = await Promise.all([
    protonAccountFetch<{ User: ApiUser }>('core/v4/users', session, { method: 'GET' }),
    protonAccountFetch<{ KeySalts: KeySaltEntry[] }>('core/v4/keys/salts', session, { method: 'GET' }),
    protonAccountFetch<{ Addresses: ApiAddress[] }>('core/v4/addresses', session, { method: 'GET' }),
  ]);

  const keyPassword = await deriveKeyPassword(
    userResponse.User,
    loginPassword,
    saltsResponse.KeySalts ?? []
  );

  const userKeys = await getDecryptedUserKeys(userResponse.User.Keys ?? [], keyPassword);
  if (userKeys.length === 0) {
    throw new Error('Could not unlock Proton user keys. Check your login password.');
  }

  const userKeysPair = splitKeys(userKeys);
  const addresses: ProtonAccountAddress[] = [];

  for (const address of addressesResponse.Addresses ?? []) {
    if (address.Status === 0) {
      continue;
    }

    const keys = await getDecryptedAddressKeysForAddress(
      address.Keys ?? [],
      userKeysPair,
      keyPassword
    );
    if (keys.length === 0) {
      continue;
    }

    addresses.push({
      email: address.Email,
      addressId: address.ID,
      primaryKeyIndex: primaryKeyIndex(address.Keys ?? []),
      keys,
    });
  }

  if (addresses.length === 0) {
    throw new Error('No Proton address keys could be unlocked. Check your login password.');
  }

  return addresses;
}
