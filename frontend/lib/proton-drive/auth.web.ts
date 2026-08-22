import { getSrp } from '@protontech/crypto/srp';

import { ensureProtonCryptoReady } from './crypto-setup.web';
import { protonAccountFetch, ProtonApiError, type ProtonApiSession } from './proton-api.web';
import type { ProtonSessionTokens } from './types';

interface AuthInfoResponse {
  Version: number;
  Modulus: string;
  ServerEphemeral: string;
  Salt: string;
  Username?: string;
  SRPSession?: string;
}

interface AuthResponse {
  Code: number;
  UID: string;
  AccessToken: string;
  RefreshToken: string;
  ServerProof?: string;
  '2FA'?: {
    Enabled: number;
  };
}

const TWO_FA_REQUIRED = 8002;

export interface ConnectProtonOptions {
  email: string;
  password: string;
  mailboxPassword?: string;
  totp?: string;
}

export async function authenticateProton({
  email,
  password,
  totp,
}: ConnectProtonOptions): Promise<ProtonSessionTokens> {
  const username = email.trim();

  await ensureProtonCryptoReady();

  const info = await protonAccountFetch<AuthInfoResponse>('core/v4/auth/info', null, {
    method: 'POST',
    body: JSON.stringify({
      Username: username,
      Intent: 'Proton',
    }),
  });

  const srpSession = info.SRPSession;
  if (!srpSession) {
    throw new Error('Proton auth info did not include an SRP session.');
  }

  const srp = await getSrp(info, { username, password }, info.Version);

  let authResponse: AuthResponse;
  const authBody: Record<string, unknown> = {
    Username: username,
    ClientEphemeral: srp.clientEphemeral,
    ClientProof: srp.clientProof,
    SRPSession: srpSession,
    PersistentCookies: 1,
  };
  if (totp?.trim()) {
    authBody.TwoFactorCode = totp.trim();
  }

  try {
    authResponse = await protonAccountFetch<AuthResponse>('core/v4/auth', null, {
      method: 'POST',
      body: JSON.stringify(authBody),
    });
  } catch (error) {
    if (error instanceof ProtonApiError && error.code === TWO_FA_REQUIRED) {
      if (!totp?.trim()) {
        throw new Error('Two-factor authentication code is required.');
      }
      authResponse = await protonAccountFetch<AuthResponse>('core/v4/auth/2fa', null, {
        method: 'POST',
        body: JSON.stringify({
          TwoFactorCode: totp.trim(),
        }),
      });
    } else {
      throw error;
    }
  }

  if (authResponse.ServerProof && authResponse.ServerProof !== srp.expectedServerProof) {
    throw new Error('Proton server proof verification failed.');
  }

  return {
    uid: authResponse.UID,
    email: username,
    accessToken: authResponse.AccessToken,
    refreshToken: authResponse.RefreshToken,
  };
}

export function toApiSession(tokens: ProtonSessionTokens): ProtonApiSession {
  return {
    uid: tokens.uid,
    accessToken: tokens.accessToken,
  };
}
