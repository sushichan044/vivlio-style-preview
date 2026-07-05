import { stringify } from "@vivliostyle/vfm";
import { useEffect, useState } from "react";
import config from "virtual:vivliostyle-config";

/**
 * Converts VFM markdown into a full HTML document (with the target project's theme CSS linked in
 * `<head>`, exactly as vivliostyle-cli does) and exposes it as a Blob URL for
 * `@vivliostyle/react`'s `Renderer` to load.
 */
export function usePreviewBlobUrl(markdown: string): string | undefined {
  const [url, setUrl] = useState<string>();

  useEffect(() => {
    const html = stringify(markdown, {
      ...config.vfmOptions,
      language: config.language,
      style: config.themeCssUrls,
      title: config.title,
    });
    const next = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    setUrl(next);

    return () => {
      URL.revokeObjectURL(next);
    };
  }, [markdown]);

  return url;
}
