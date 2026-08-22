import type {
  ProtonDriveAccount,
  ProtonDriveAccountAddress,
  PrivateKey,
  PublicKey,
} from '@protontech/drive-sdk';

import type { ProtonAccountAddress } from './types';

function toDriveAddress(address: ProtonAccountAddress): ProtonDriveAccountAddress {
  return {
    email: address.email,
    addressId: address.addressId,
    primaryKeyIndex: address.primaryKeyIndex,
    keys: address.keys.map((entry) => ({
      id: entry.id,
      key: entry.key,
    })),
  };
}

export class LifeManagerProtonAccount implements ProtonDriveAccount {
  constructor(private readonly addresses: ProtonAccountAddress[]) {}

  async getOwnPrimaryAddress(): Promise<ProtonDriveAccountAddress> {
    const primary = this.addresses[0];
    if (!primary) {
      throw new Error('No Proton addresses available.');
    }
    return toDriveAddress(primary);
  }

  async getOwnAddresses(): Promise<ProtonDriveAccountAddress[]> {
    if (this.addresses.length === 0) {
      throw new Error('No Proton addresses available.');
    }
    return this.addresses.map(toDriveAddress);
  }

  async getOwnAddress(emailOrAddressId: string): Promise<ProtonDriveAccountAddress> {
    const match = this.addresses.find(
      (address) =>
        address.email.toLowerCase() === emailOrAddressId.toLowerCase() ||
        address.addressId === emailOrAddressId
    );
    if (!match) {
      throw new Error(`Unknown Proton address: ${emailOrAddressId}`);
    }
    return toDriveAddress(match);
  }

  async hasProtonAccount(email: string): Promise<boolean> {
    return this.addresses.some(
      (address) => address.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getPublicKeys(_email: string): Promise<PublicKey[]> {
    return [];
  }
}

export type { PrivateKey };
