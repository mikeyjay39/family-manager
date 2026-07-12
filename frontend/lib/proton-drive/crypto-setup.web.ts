import '@protontech/crypto/polyfill';

import { CryptoProxy } from '@protontech/crypto';
import { CryptoWorkerPool } from './crypto-worker-pool.web';

let cryptoReadyPromise: Promise<void> | null = null;

export async function ensureProtonCryptoReady(): Promise<void> {
  if (!cryptoReadyPromise) {
    cryptoReadyPromise = (async () => {
      const cores =
        typeof navigator !== 'undefined' && navigator.hardwareConcurrency
          ? navigator.hardwareConcurrency
          : 1;
      await CryptoWorkerPool.init({
        poolSize: Math.min(cores, 2),
        openpgpConfigOptions: {
          allowInsecureDecryptionWithSigningKeys: true,
        },
      });
      CryptoProxy.setEndpoint(CryptoWorkerPool, async () => {
        await CryptoWorkerPool.destroy();
      });
    })().catch((error) => {
      cryptoReadyPromise = null;
      throw error;
    });
  }
  await cryptoReadyPromise;
}

export { CryptoProxy };
