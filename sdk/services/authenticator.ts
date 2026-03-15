import type { JwtPayload } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import type { BaseServerConfiguration } from '../../openapi';
import { AuthApi, createConfiguration } from '../../openapi';

const EXPIRATION_THRESHOLD_MS = 1000 * 60 * 5;

export class VayuAuthenticator {
  private accessToken: string | undefined;
  private expiresAt: number;

  constructor(
    private readonly apiKey: string,
    private readonly baseServer: BaseServerConfiguration,
  ) {
    this.expiresAt = 0;
  }

  get token(): string | undefined {
    return this.accessToken;
  }

  async ensureValidToken(): Promise<string> {
    if (!this.accessToken || this.expiresAt <= Date.now() + EXPIRATION_THRESHOLD_MS) {
      await this.authenticate();
    }

    if (!this.accessToken) {
      throw new Error('Authentication failed: no access token available');
    }

    return this.accessToken;
  }

  async authenticate(): Promise<void> {
    const authClient = new AuthApi(createConfiguration({
      baseServer: this.baseServer,
    }));

    const login = await authClient.login({
      refreshToken: this.apiKey,
    });

    this.accessToken = login.accessToken;

    const decodedJWT = jwt.decode(this.accessToken) as JwtPayload;

    if (!decodedJWT) {
      throw new Error('Invalid JWT token');
    }

    this.expiresAt = calculateJwtExpirationMs(decodedJWT.exp);
  }
}

function calculateJwtExpirationMs(decodedJwtExpiration?: number): number {
  const expirationSeconds = decodedJwtExpiration != null
    ? decodedJwtExpiration
    : Math.floor(Date.now() / 1000) + 60 * 15;

  return expirationSeconds * 1000;
}
