import type { JwtPayload } from 'jsonwebtoken';
import jwt from 'jsonwebtoken';
import type { BaseServerConfiguration } from '../../openapi';
import { AuthApi, createConfiguration } from '../../openapi';

const EXPIRATION_THRESHOLD = 1000 * 60 * 5;

export class VayuAuthenticator {
  private accessToken: string | undefined;
  private expiresAt: number;

  constructor(
    private readonly apiKey: string,
    private readonly baseServer: BaseServerConfiguration,
  ) {
    this.expiresAt = 0;
  }

  get isAuthenticated(): boolean {
    return this.accessToken !== undefined;
  }

  get token(): string | undefined {
    return this.accessToken;
  }

  get needsRefresh(): boolean {
    return !this.accessToken || this.expiresAt <= Date.now() + EXPIRATION_THRESHOLD;
  }

  async ensureValidToken(): Promise<string> {
    if (this.needsRefresh) {
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

    this.expiresAt = (decodedJWT.exp ?? Math.floor(Date.now() / 1000) + 60 * 15) * 1000;
  }
}
