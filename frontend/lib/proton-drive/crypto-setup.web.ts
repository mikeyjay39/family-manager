import '@protontech/crypto/polyfill';

import { CryptoProxy } from '@protontech/crypto';
import { Api as CryptoApi } from '@protontech/crypto/proxy/endpoint/api.ts';

let cryptoReadyPromise: Promise<void> | null = null;
let mainThreadApi: CryptoApi | null = null;

/**
 * Metro/Expo web cannot bundle Proton's worker pool (it relies on import.meta.url).
 * Run CryptoProxy on the main thread instead; fine for connect + occasional uploads.
 */
export async function ensureProtonCryptoReady(): Promise<void> {
  if (!cryptoReadyPromise) {
    cryptoReadyPromise = (async () => {
      CryptoApi.init({});
      mainThreadApi = new CryptoApi();
      CryptoProxy.setEndpoint(mainThreadApi, async (endpoint) => {
        await endpoint.clearKeyStore();
        mainThreadApi = null;
      });
    })().catch((error) => {
      cryptoReadyPromise = null;
      throw error;
    });
  }
  await cryptoReadyPromise;
}

export { CryptoProxy };
