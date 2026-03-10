# SDK Auth Internalization Design

## Problem

PR #27 extracts auth into `VayuAuthenticator` with lazy token refresh via middleware. The middleware `post` hook refreshes the token on 401 but cannot retry the failed request because `ResponseContext` has no access to the original request or HTTP library. The current request still fails with 401.

Secondary issues: `generateToken()` returns `expiresAt: undefined` (breaking), and `VayuAuthenticator` is exported as public API unnecessarily.

## Solution

Move auth out of middleware into a custom `HttpLibrary` wrapper (`AuthenticatedHttpLibrary`) that has access to both the request and response, enabling 401 retry.

## Architecture

```
Vayu (entry point)
  └─ ConfigurationService (singleton, wires dependencies)
       ├─ VayuAuthenticator (token lifecycle)
       └─ AuthenticatedHttpLibrary (auth injection + 401 retry)
            └─ IsomorphicFetchHttpLibrary (actual HTTP transport)
```

## Components

### VayuAuthenticator (`sdk/services/authenticator.ts`)

Same as PR #27 with minor cleanup:
- Owns `apiKey`, `accessToken`, `expiresAt`
- `ensureValidToken()`: returns cached token or calls `authenticate()` if expired (5-min threshold)
- `authenticate()`: calls `AuthApi.login()`, decodes JWT, stores token + expiry
- No mutex — concurrent refreshes each get a valid token; redundant calls are acceptable

### AuthenticatedHttpLibrary (`sdk/services/authenticated-http-library.ts`)

New file. Wraps `IsomorphicFetchHttpLibrary`:
- `send(request)`: injects auth headers, delegates to inner library
- On 401 response: force-refreshes token, updates request headers, retries **once**
- If retry also 401s, returns the 401 response to the caller

### ConfigurationService (`sdk/services/configuration.service.ts`)

Simplified — no `promiseMiddleware` block. Passes `AuthenticatedHttpLibrary` as `httpApi` to `createConfiguration()`.
- `generateNewClient()`: no longer calls `validateIsLoggedIn()` (auth is lazy)
- `generateToken()`: deprecated, delegates to authenticator
- `validateIsLoggedIn()`: deprecated, no-op

### SDK entry point (`sdk/index.ts`)

Same as PR — `login()` deprecated with `@deprecated` JSDoc tag.

### Exports (`sdk/services/index.ts`)

Do NOT export `VayuAuthenticator` or `AuthenticatedHttpLibrary` — these are internal implementation details.

## Files Changed

| File | Action |
|---|---|
| `sdk/services/authenticator.ts` | Modify (remove public `needsRefresh` getter, keep simple) |
| `sdk/services/authenticated-http-library.ts` | Create |
| `sdk/services/configuration.service.ts` | Simplify (remove middleware, use custom httpApi) |
| `sdk/services/index.ts` | Remove `authenticator` export |
| `sdk/index.ts` | Same as PR (deprecate `login()`) |

## Backward Compatibility

- `login()` still works (deprecated, not removed)
- No changes to public SDK client APIs
- `generateToken()` return type changes (`expiresAt` becomes `undefined`) — already in PR, acceptable since this is internal
