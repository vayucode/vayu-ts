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
