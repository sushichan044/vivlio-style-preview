declare module "virtual:vivliostyle-config" {
  import type { StringifyMarkdownOptions } from "@vivliostyle/vfm";

  interface VivliostylePreviewConfig {
    themeCssUrls: string[];
    language?: string;
    title?: string;
    vfmOptions?: StringifyMarkdownOptions;
  }

  const config: VivliostylePreviewConfig;
  export default config;
}
