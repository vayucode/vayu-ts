# SDK Auth Internalization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move auth logic from middleware into a custom `AuthenticatedHttpLibrary` that handles token injection and 401 retry, making the SDK authenticate seamlessly without requiring `login()`.

**Architecture:** `VayuAuthenticator` manages the JWT token lifecycle (login, decode, expiry check). `AuthenticatedHttpLibrary` wraps the default fetch library, injecting auth headers before each request and retrying once on 401 after a forced token refresh. `ConfigurationService` wires these together via the `httpApi` config option, eliminating the middleware approach entirely.

**Tech Stack:** TypeScript, OpenAPI-generated client (`openapi/`), `jsonwebtoken` for JWT decoding, `node-fetch` for HTTP.

**Spec:** `docs/superpowers/specs/2026-03-10-sdk-auth-internalization-design.md`

---

## Chunk 1: Implementation

### Task 1: Clean up VayuAuthenticator

The existing `authenticator.ts` from the PR is mostly correct. Remove unnecessary public getters that leak internal state.

**Files:**
- Modify: `sdk/services/authenticator.ts`

- [ ] **Step 1: Remove `isAuthenticated` and `needsRefresh` public getters**

These are internal concerns that should not be part of the public surface. `ensureValidToken()` is the only public method consumers need. Keep `token` getter since `ConfigurationService.generateToken()` uses it.

Replace the full file content with:

```typescript
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

  get token(): string | undefined {
    return this.accessToken;
  }

  async ensureValidToken(): Promise<string> {
    if (!this.accessToken || this.expiresAt <= Date.now() + EXPIRATION_THRESHOLD) {
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
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors related to `authenticator.ts`

- [ ] **Step 3: Commit**

```bash
git add sdk/services/authenticator.ts
git commit -m "refactor: clean up VayuAuthenticator public API"
```

---

### Task 2: Create AuthenticatedHttpLibrary

This is the core new file. It wraps `IsomorphicFetchHttpLibrary`, injects auth headers, and retries once on 401.

**Files:**
- Create: `sdk/services/authenticated-http-library.ts`

**Context:**
- `HttpLibrary` interface is defined in `openapi/http/http.ts` — method: `send(request: RequestContext): Observable<ResponseContext>`
- `Observable` is a thin promise wrapper in `openapi/rxjsStub.ts` — `from(promise)` wraps, `.toPromise()` unwraps
- `RequestContext` has `setHeaderParam(key, value)`, `getUrl()`, `getHttpMethod()`, `getHeaders()`, `getBody()`
- `ResponseContext` has `httpStatusCode`, `headers`, `body`
- `IsomorphicFetchHttpLibrary` in `openapi/http/isomorphic-fetch.ts` is the default HTTP transport

- [ ] **Step 1: Create the AuthenticatedHttpLibrary file**

```typescript
import type { HttpLibrary, RequestContext, ResponseContext } from '../../openapi/http/http';
import { IsomorphicFetchHttpLibrary } from '../../openapi/http/isomorphic-fetch';
import type { Observable } from '../../openapi/rxjsStub';
import { from } from '../../openapi/rxjsStub';
import type { VayuAuthenticator } from './authenticator';

export class AuthenticatedHttpLibrary implements HttpLibrary {
  private readonly inner: IsomorphicFetchHttpLibrary;

  constructor(
    private readonly authenticator: VayuAuthenticator,
    private readonly clientId: string,
  ) {
    this.inner = new IsomorphicFetchHttpLibrary();
  }

  send(request: RequestContext): Observable<ResponseContext> {
    return from(this.sendWithRetry(request));
  }

  private async sendWithRetry(request: RequestContext): Promise<ResponseContext> {
    const token = await this.authenticator.ensureValidToken();
    request.setHeaderParam('Authorization', `Bearer ${token}`);
    request.setHeaderParam('x-api-key', this.clientId);

    const response = await this.inner.send(request).toPromise();

    if (response.httpStatusCode === 401) {
      await this.authenticator.authenticate();
      const freshToken = await this.authenticator.ensureValidToken();
      request.setHeaderParam('Authorization', `Bearer ${freshToken}`);
      return this.inner.send(request).toPromise();
    }

    return response;
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add sdk/services/authenticated-http-library.ts
git commit -m "feat: add AuthenticatedHttpLibrary with 401 retry"
```

---

### Task 3: Simplify ConfigurationService

Remove the `promiseMiddleware` block and pass `AuthenticatedHttpLibrary` as `httpApi` instead.

**Files:**
- Modify: `sdk/services/configuration.service.ts:1-97`

- [ ] **Step 1: Replace the configuration service**

The key changes:
1. Remove unused imports (`RequestContext`, `ResponseContext`)
2. Import `AuthenticatedHttpLibrary`
3. Replace `promiseMiddleware` with `httpApi` in the `configuration` getter
4. Remove the `wrapHttpLibrary` import if present

Replace the full file content with:

```typescript
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

  /** @deprecated Authentication is now handled automatically. */
  async generateToken() {
    await this.authenticator.authenticate();

    return {
      accessToken: this.authenticator.token,
      expiresAt: undefined,
    };
  }

  /** @deprecated Authentication is now handled automatically. */
  validateIsLoggedIn() {
    // No-op: login is handled lazily by the AuthenticatedHttpLibrary
  }

  private get configuration(): Configuration {
    return createConfiguration({
      baseServer: this.baseServer,
      httpApi: new AuthenticatedHttpLibrary(this.authenticator, this.clientId),
    });
  }
}
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add sdk/services/configuration.service.ts
git commit -m "refactor: replace middleware with AuthenticatedHttpLibrary"
```

---

### Task 4: Fix exports

Remove the `authenticator` export from `sdk/services/index.ts` — `VayuAuthenticator` and `AuthenticatedHttpLibrary` are internal implementation details.

**Files:**
- Modify: `sdk/services/index.ts`

- [ ] **Step 1: Remove authenticator export**

Replace the full file content with:

```typescript
export * from './configuration.service';
```

- [ ] **Step 2: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: No errors. If any external file imports from `./authenticator` via the barrel export, it will fail here — that's intentional, those imports should be removed.

- [ ] **Step 3: Commit**

```bash
git add sdk/services/index.ts
git commit -m "refactor: remove internal authenticator from public exports"
```

---

### Task 5: Final verification

- [ ] **Step 1: Run full TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Clean pass, zero errors

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: No new lint errors introduced

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Successful build output
