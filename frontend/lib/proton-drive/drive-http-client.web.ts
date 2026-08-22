import type {
  ProtonDriveHTTPClient,
  ProtonDriveHTTPClientBlobRequest,
  ProtonDriveHTTPClientJsonRequest,
} from '@protontech/drive-sdk';

import { protonDriveFetchUrl, type ProtonApiSession } from './proton-api.web';

export function createDriveHttpClient(session: ProtonApiSession): ProtonDriveHTTPClient {
  return {
    async fetchJson(request: ProtonDriveHTTPClientJsonRequest): Promise<Response> {
      return protonDriveFetchUrl(request.url, session, {
        method: request.method,
        headers: request.headers,
        body: request.json !== undefined ? JSON.stringify(request.json) : request.body,
        signal: request.signal,
      });
    },
    async fetchBlob(request: ProtonDriveHTTPClientBlobRequest): Promise<Response> {
      return protonDriveFetchUrl(request.url, session, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: request.signal,
      });
    },
  };
}
