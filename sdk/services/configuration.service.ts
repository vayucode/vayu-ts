import type { BaseServerConfiguration, Configuration } from '../../openapi';
import { createConfiguration, server1, server2, ServerConfiguration } from '../../openapi';
import { getRequiredEnvVar } from '../utils';
import { VayuAuthenticator } from './authenticator';
import { AuthenticatedHttpLibrary } from './authenticated-http-library';

const CLIENT_ID_ENV_VAR_NAME = 'CLIENT_ID';
const BASE_URLS_MAP = new Map<string, BaseServerConfiguration>([
  ['https://connect.withvayu.com', server1],
  ['https://staging-connect.withvayu.com', server2],
]);

/* eslint-disable no-underscore-dangle */
export class ConfigurationService {
  private static _instance: ConfigurationService | null = null;

  static get instance(): ConfigurationService {
    if (!ConfigurationService._instance) {
      throw new Error('ConfigurationService not initialized');
    }

    return ConfigurationService._instance;
  }

  static initialize(apiKey: string, baseServer: BaseServerConfiguration) {
    if (ConfigurationService._instance) {
      throw new Error('ConfigurationService already initialized');
    }

    ConfigurationService._instance = new ConfigurationService(apiKey, baseServer);

    return ConfigurationService._instance;
  }

  static generateServerConfiguration(baseUrl?: string): BaseServerConfiguration {
    if (!baseUrl) {
      return server1;
    }

    const baseServer = BASE_URLS_MAP.get(baseUrl);

    return baseServer ?? new ServerConfiguration<{}>(baseUrl, {});
  }

  private readonly authenticator: VayuAuthenticator;
  private readonly clientId: string;

  constructor(
    apiKey: string,
    private baseServer: BaseServerConfiguration,
  ) {
    this.authenticator = new VayuAuthenticator(apiKey, baseServer);
    this.clientId = getRequiredEnvVar(CLIENT_ID_ENV_VAR_NAME);
  }

  generateNewClient<T extends { new(config: Configuration): InstanceType<T> }>(ClientClass: T): InstanceType<T> {
    return new ClientClass(this.configuration);
  }

  /** @deprecated Authentication is now handled automatically.
   *  Note: expiresAt is no longer returned — use authenticator directly if needed. */
  async generateToken() {
    await this.authenticator.authenticate();

    return {
      accessToken: this.authenticator.token,
      expiresAt: undefined,
    };
  }

  /** @deprecated Authentication is now handled automatically. */
  validateIsLoggedIn() {
    // No-op: login is handled lazily by authenticator
  }

  private get configuration(): Configuration {
    return createConfiguration({
      baseServer: this.baseServer,
      httpApi: new AuthenticatedHttpLibrary(this.authenticator, this.clientId),
    });
  }
}
