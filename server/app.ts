import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { languageDetector } from "hono/language";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import { createRequestHandler, RouterContextProvider } from "react-router";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore virtual module provided by React Router at build time
import * as build from "virtual:react-router/server-build";

import { serverSideMetadataContext } from "../app/context.server";
import { localOrigin, prodOrigin } from "../shared/url";
import { createAPIClient, honoFactory } from "./hono";
import { apiRoutes } from "./routes/api";

const app = honoFactory.createApp();

if (import.meta.env.DEV) {
  app.use("*", logger());
}

// Set variables expected by honoFactory
app.use(
  "*",
  secureHeaders(),
  cors({
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    credentials: true,
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    origin: [localOrigin, prodOrigin],
  }),
  csrf({
    origin: [localOrigin, prodOrigin],
  }),
  languageDetector({
    caches: false,
    fallbackLanguage: "ja",
    // using cookie breaks behavior of better-auth session management
    order: ["header", "path", "querystring"],
    supportedLanguages: ["en", "ja"],
  }),

  async (c, next) => {
    c.set("createAPIClientForSSR", (headers) => {
      return createAPIClient(new URL("/api", c.req.url).toString(), {
        init: {
          // propagate cookies for session management
          headers,
        },
      });
    });

    await next();
  },
);
app.get("/health", (c) => {
  return c.json({ status: "ok" });
});
app.route("/api", apiRoutes);

const reactRouterHandler = createRequestHandler(build, import.meta.env.MODE);
app.all("*", async (c) => {
  const rrCtx = new RouterContextProvider();

  serverSideMetadataContext.set(rrCtx, {
    createAPIClientForSSR: c.get("createAPIClientForSSR"),
    origin: new URL(c.req.url).origin,
  });

  return reactRouterHandler(c.req.raw, rrCtx);
});

app.onError((err, c) => {
  console.error(err);

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  return c.json({ message: "Internal Server Error" }, 500);
});

/**
 * @package
 */
export default app;
