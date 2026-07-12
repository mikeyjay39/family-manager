import type {
  ProtonDriveHTTPClient,
  ProtonDriveHTTPClientBlobRequest,
  ProtonDriveHTTPClientJsonRequest,
} from '@protontech/drive-sdk';

import { protonDriveFetch, type ProtonApiSession } from './proton-api.web';

function toAbsoluteUrl(pathOrUrl: string): string {
  if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
    return pathOrUrl;
  }
  return pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
}

export function createDriveHttpClient(session: ProtonApiSession): ProtonDriveHTTPClient {
  return {
    async fetchJson(request: ProtonDriveHTTPClientJsonRequest): Promise<Response> {
      const url = toAbsoluteUrl(request.url);
      const path = url.replace(/^https:\/\/drive-api\.proton\.me/, '');
      const headers = new Headers(request.headers);
      if (request.json !== undefined) {
        headers.set('Content-Type', 'application/json');
      }
      return protonDriveFetch(path, session, {
        method: request.method,
        headers,
        body: request.json !== undefined ? JSON.stringify(request.json) : request.body,
        signal: request.signal,
      });
    },
    async fetchBlob(request: ProtonDriveHTTPClientBlobRequest): Promise<Response> {
      const url = toAbsoluteUrl(request.url);
      const path = url.replace(/^https:\/\/drive-api\.proton\.me/, '');
      return protonDriveFetch(path, session, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: request.signal,
      });
    },
  };
}
