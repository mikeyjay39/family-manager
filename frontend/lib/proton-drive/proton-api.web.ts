import { PROTON_APP_VERSION } from './constants';
import { PROTON_ACCOUNT_API_BASE, PROTON_DRIVE_API_BASE } from './constants';

export interface ProtonApiSession {
  uid: string;
  accessToken: string;
}

export class ProtonApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: number
  ) {
    super(message);
    this.name = 'ProtonApiError';
  }
}

function buildHeaders(session: ProtonApiSession | null, baseUrl: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.protonmail.v1+json',
    'x-pm-appversion': PROTON_APP_VERSION,
    'x-pm-locale': 'en_US',
  };
  if (session) {
    headers['x-pm-uid'] = session.uid;
    headers.Authorization = `Bearer ${session.accessToken}`;
  }
  if (baseUrl.startsWith(PROTON_DRIVE_API_BASE)) {
    headers['x-pm-dohproxy-required'] = '1';
  }
  return headers;
}

/** Merge auth headers with init.headers (Headers objects do not spread into plain objects). */
function mergeFetchHeaders(base: Record<string, string>, extra?: HeadersInit): Headers {
  const merged = new Headers(base);
  if (extra instanceof Headers) {
    extra.forEach((value, key) => merged.set(key, value));
  } else if (Array.isArray(extra)) {
    extra.forEach(([key, value]) => merged.set(key, value));
  } else if (extra) {
    Object.entries(extra).forEach(([key, value]) => {
      if (value !== undefined) {
        merged.set(key, String(value));
      }
    });
  }
  return merged;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as T & { Code?: number; Error?: string; ErrorDescription?: string };
  if (!response.ok) {
    const message =
      (body as { Error?: string }).Error ??
      (body as { ErrorDescription?: string }).ErrorDescription ??
      `Proton API error (${response.status})`;
    throw new ProtonApiError(message, response.status, (body as { Code?: number }).Code);
  }
  return body;
}

export async function protonAccountFetch<T>(
  path: string,
  session: ProtonApiSession | null,
  init: RequestInit = {}
): Promise<T> {
  const url = `${PROTON_ACCOUNT_API_BASE}/${path.replace(/^\//, '')}`;
  const headers = mergeFetchHeaders(buildHeaders(session, PROTON_ACCOUNT_API_BASE), init.headers);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(url, {
    ...init,
    credentials: 'include',
    headers,
  });
  return parseJsonResponse<T>(response);
}

export async function protonDriveFetchUrl(
  url: string,
  session: ProtonApiSession,
  init: RequestInit = {}
): Promise<Response> {
  return fetch(url, {
    ...init,
    credentials: 'include',
    headers: mergeFetchHeaders(buildHeaders(session, PROTON_DRIVE_API_BASE), init.headers),
  });
}

export { PROTON_DRIVE_API_BASE };
