import { useDeferredValue, useState } from "react";

import { Editor } from "./Editor";
import { Preview } from "./Preview";
import { usePreviewBlobUrl } from "./usePreviewBlobUrl";

const INITIAL_VFM = `# Hello, Vivliostyle

Start writing **VFM** here — the preview on the right updates as you type.
`;

export default function EditorWorkbench() {
  const [value, setValue] = useState(INITIAL_VFM);
  // The preview pipeline (VFM -> HTML -> Blob -> typeset) is expensive, so it
  // consumes a deferred value. The editor itself binds to `value` directly so
  // typing never lags behind the deferred preview work.
  const deferredValue = useDeferredValue(value);
  const blobUrl = usePreviewBlobUrl(deferredValue);

  return (
    <div className="grid h-dvh grid-cols-2 divide-x divide-slate-300 bg-white text-slate-900">
      <Editor onChange={setValue} value={value} />
      <Preview blobUrl={blobUrl} />
    </div>
  );
}
