import type { RouteConfig } from "@react-router/dev/routes";
import { index, layout, route } from "@react-router/dev/routes";

export default [
  layout("./routes/_layout.tsx", [index("./routes/_index.tsx")]),
  route("preview", "./routes/preview.tsx"),
] satisfies RouteConfig;
