import { honoFactory } from "../../hono";

const app = honoFactory.createApp();

export const apiRoutes = app.get("/dev/health", (c) => {
  return c.json({ status: "ok" });
});

export type APIRoutes = typeof apiRoutes;
