import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, isAbsolute, join, resolve as resolvePath } from "node:path";
import { pathToFileURL } from "node:url";

// `@vivliostyle/cli/schema` is the only public entry point exposing the
// normalized config schema — the config-loading/theme-resolution functions
// themselves (`loadVivliostyleConfig`, `resolveTaskConfig`, `locateThemePath`)
// are internal to vivliostyle-cli, so we replicate the minimal parts we need.
import { VivliostyleConfigSchema } from "@vivliostyle/cli/schema";
import type { StringifyMarkdownOptions } from "@vivliostyle/vfm";
import * as v from "valibot";
import type { Plugin } from "vite";

import { localOrigin } from "../shared/url";

const VIRTUAL_MODULE_ID = "virtual:vivliostyle-config";
const RESOLVED_VIRTUAL_MODULE_ID = `\0${VIRTUAL_MODULE_ID}`;
const THEME_ASSET_PREFIX = "/@vivliostyle-theme/";

const CONFIG_FILE_CANDIDATES = [
  "vivliostyle.config.js",
  "vivliostyle.config.mjs",
  "vivliostyle.config.cjs",
];

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".otf": "font/otf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

interface ResolvedVivliostyleConfig {
  themeCssUrls: string[];
  language?: string;
  title?: string;
  vfmOptions?: StringifyMarkdownOptions;
}

interface ThemeConfigLike {
  specifier: string;
  import?: string | string[];
}

interface ClassifiedThemeAsset {
  /**
   * Absolute http(s) URL of the CSS to link, already accounting for any dev-server mount.
   */
  url: string;
  /**
   * Populated when the theme's directory needs to be served over the dev server.
   */
  mount?: { dir: string; id: string };
}

/**
 * Locates the `vivliostyle.config.js` to preview. `target` may point directly at a config file, or
 * at a project directory containing one.
 */
function locateConfigFile(target: string): string {
  const stat = statSync(target);
  if (stat.isFile()) {
    return target;
  }
  for (const candidate of CONFIG_FILE_CANDIDATES) {
    const candidatePath = join(target, candidate);
    if (existsSync(candidatePath)) {
      return candidatePath;
    }
  }
  throw new Error(
    `No vivliostyle.config.{js,mjs,cjs} found in ${target}. Set VIVLIOSTYLE_PROJECT to a project directory or a config file path.`,
  );
}

/**
 * Strips an npm version range suffix from a package specifier, e.g. `@scope/pkg@1` -> `@scope/pkg`.
 */
function stripVersionRange(specifier: string): string {
  const scopedMatch = /^(@[^/]+\/[^@]+)(?:@.+)?$/.exec(specifier);
  if (scopedMatch?.[1]) {
    return scopedMatch[1];
  }
  const unscopedMatch = /^([^@]+)(?:@.+)?$/.exec(specifier);
  return unscopedMatch?.[1] ?? specifier;
}

function slugifySpecifier(specifier: string): string {
  return specifier.replaceAll(/[^\w-]+/g, "-").replaceAll(/^-+|-+$/g, "");
}

/**
 * Minimal re-implementation of vivliostyle-cli's `locateThemePath` (src/processor/compile.ts) —
 * that function is internal, so we replicate only the classification logic needed to link theme CSS
 * from a live preview: URI passthrough, local `.css` file, or npm/local package resolved via
 * package.json (`vivliostyle.theme.style ?? style ?? main`).
 */
function classifyThemeAsset(
  theme: ThemeConfigLike,
  targetProjectDir: string,
): ClassifiedThemeAsset {
  const { specifier } = theme;

  if (/^https?:\/\//.test(specifier)) {
    return { url: specifier };
  }

  if (specifier.endsWith(".css")) {
    const cssPath = resolvePath(targetProjectDir, specifier);
    if (!existsSync(cssPath)) {
      throw new Error(`Theme CSS file not found: ${cssPath} (specifier: "${specifier}")`);
    }
    const mountId = slugifySpecifier(specifier);
    return {
      mount: { dir: targetProjectDir, id: mountId },
      url: `${localOrigin}${THEME_ASSET_PREFIX}${mountId}/${specifier}`,
    };
  }

  // npm package, or a local package directory (relative/absolute specifier).
  const isLocalPath = specifier.startsWith(".") || isAbsolute(specifier);
  const pkgDir = isLocalPath
    ? resolvePath(targetProjectDir, specifier)
    : join(targetProjectDir, "node_modules", stripVersionRange(specifier));

  const pkgJsonPath = join(pkgDir, "package.json");
  if (!existsSync(pkgJsonPath)) {
    throw new Error(
      `Theme package not found at ${pkgDir} (specifier: "${specifier}"). ` +
        `Make sure the theme is installed in the target project's node_modules.`,
    );
  }
  const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
    main?: string;
    style?: string;
    vivliostyle?: { theme?: { style?: string | string[] } };
  };

  const cssRelPaths = [
    theme.import ?? pkgJson.vivliostyle?.theme?.style ?? pkgJson.style ?? pkgJson.main,
  ].flat();
  const cssRelPath = cssRelPaths.find((path): path is string => Boolean(path));
  if (!cssRelPath) {
    throw new Error(
      `Could not determine a style file for theme package at ${pkgDir} (specifier: "${specifier}").`,
    );
  }

  const mountId = slugifySpecifier(specifier);
  return {
    mount: { dir: pkgDir, id: mountId },
    url: `${localOrigin}${THEME_ASSET_PREFIX}${mountId}/${cssRelPath}`,
  };
}

/**
 * Dev-only Vite plugin that resolves a real Vivliostyle project's config (theme CSS, language, VFM
 * options) and exposes it to the browser preview via `virtual:vivliostyle-config`, since the config
 * loading/theme resolution vivliostyle-cli performs is Node-only (fs, npm installs) and can't run
 * in the browser or on the Cloudflare Workers production runtime.
 */
export function vivliostyleConfig(): Plugin {
  const themeMounts = new Map<string, string>();
  let cachedConfig: Promise<ResolvedVivliostyleConfig> | undefined;

  const targetProjectDir = resolvePath(
    process.cwd(),
    process.env["VIVLIOSTYLE_PROJECT"] ?? "dev/fixtures/sample-project",
  );
  const configPath = locateConfigFile(targetProjectDir);

  async function resolveConfig(): Promise<ResolvedVivliostyleConfig> {
    // Cache-bust so editing the target's vivliostyle.config.js is picked up
    // without restarting this dev server.
    const mod = (await import(`${pathToFileURL(configPath).href}?t=${Date.now()}`)) as {
      default: unknown;
    };
    const { tasks } = v.parse(VivliostyleConfigSchema, mod.default);
    const [task] = tasks;
    if (!task) {
      throw new Error(`${configPath} does not define any build task.`);
    }

    themeMounts.clear();
    const themeCssUrls = (task.theme ?? []).map((theme) => {
      const asset = classifyThemeAsset(theme, targetProjectDir);
      if (asset.mount) {
        themeMounts.set(asset.mount.id, asset.mount.dir);
      }
      return asset.url;
    });

    return {
      language: task.language,
      themeCssUrls,
      title: task.title,
      vfmOptions: task.vfm,
    };
  }

  function getConfig() {
    cachedConfig ??= resolveConfig();
    return cachedConfig;
  }

  return {
    apply: "serve",
    configureServer(server) {
      // Populate theme mounts eagerly so the static-asset middleware works
      // even before the browser has requested the virtual module.
      void getConfig();

      server.middlewares.use(THEME_ASSET_PREFIX, (req, res, next) => {
        // Connect strips THEME_ASSET_PREFIX from req.url when mounted this way.
        const [mountId, ...rest] = (req.url ?? "").replace(/^\//, "").split("/");
        const relPath = rest.join("/");
        if (!mountId || !relPath || relPath.includes("..")) {
          res.statusCode = 400;
          res.end("Invalid theme asset path");
          return;
        }

        const dir = themeMounts.get(mountId);
        if (!dir) {
          next();
          return;
        }

        const filePath = join(dir, relPath);
        if (!existsSync(filePath)) {
          res.statusCode = 404;
          res.end("Not found");
          return;
        }

        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader(
          "Content-Type",
          CONTENT_TYPES[extname(filePath)] ?? "application/octet-stream",
        );
        res.end(readFileSync(filePath));
      });

      server.watcher.add(configPath);
      server.watcher.on("change", (changedPath) => {
        if (changedPath !== configPath) {
          return;
        }
        cachedConfig = undefined;
        void getConfig();
        const mod = server.moduleGraph.getModuleById(RESOLVED_VIRTUAL_MODULE_ID);
        if (mod) {
          void server.reloadModule(mod);
        }
      });
    },
    async load(id) {
      if (id !== RESOLVED_VIRTUAL_MODULE_ID) {
        return;
      }
      const config = await getConfig();
      return `export default ${JSON.stringify(config)};`;
    },
    name: "project:vivliostyle-config",
    resolveId(id) {
      if (id === VIRTUAL_MODULE_ID) {
        return RESOLVED_VIRTUAL_MODULE_ID;
      }
      return;
    },
  };
}
