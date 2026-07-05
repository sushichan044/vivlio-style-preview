import type { RouterContextProvider } from "react-router";
import { createContext } from "react-router";

import type { APIClientFactoryForSSR } from "../server/hono";

// `createContext()` should be executed in React Router's runtime.
// So, placing it here, not in workers/app.ts
function createContextWithAccessor<T>() {
  const ctx = createContext<T>();

  return {
    get: (provider: Readonly<RouterContextProvider>) => provider.get(ctx),
    set: (provider: RouterContextProvider, value: T) => {
      provider.set(ctx, value);
    },
  };
}

type ServerSideMetadataContext = {
  createAPIClientForSSR: APIClientFactoryForSSR;
  /**
   * The origin of the request URL, e.g. "https://example.com"
   */
  origin: string;
};

export const serverSideMetadataContext = createContextWithAccessor<ServerSideMetadataContext>();
