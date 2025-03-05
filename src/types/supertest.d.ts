import { type Http2ServerRequest, type Http2ServerResponse } from 'http2';
import { type App as OriginalApp } from 'supertest/types.d.ts';

declare module 'supertest' {
  export type App =
    | OriginalApp
    | ((request: Http2ServerRequest, response: Http2ServerResponse) => Promise<void>);
}
