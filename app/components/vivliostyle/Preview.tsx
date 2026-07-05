import { Renderer } from "@vivliostyle/react";
import { useState } from "react";

interface PreviewProps {
  blobUrl: string | undefined;
}

export function Preview({ blobUrl }: PreviewProps) {
  const [page, setPage] = useState(1);

  if (!blobUrl) {
    return null;
  }

  return (
    <div className="flex size-full flex-col divide-y">
      <div>
        <button
          onClick={() => {
            setPage((p) => Math.max(1, p - 1));
          }}
        >
          Prev
        </button>
        <span className="mx-2">{page}</span>
        <button
          onClick={() => {
            setPage((p) => p + 1);
          }}
        >
          Next
        </button>
      </div>

      <Renderer page={page} fitToScreen source={blobUrl} />
    </div>
  );
}
