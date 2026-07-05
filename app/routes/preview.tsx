import { lazy, Suspense } from "react";

import { useIsHydrated } from "../hooks/useIsHydrated";
import type { Route } from "./+types/preview";

// `EditorWorkbench` statically imports CodeMirror and `@vivliostyle/react`
// (which touches `window`/DOM through `@vivliostyle/core` at import time).
// Loading it via a dynamic import means it's never evaluated during SSR.
const EditorWorkbench = lazy(() => import("../components/vivliostyle/EditorWorkbench"));

export const meta: Route.MetaFunction = () => {
  return [
    { title: "Vivliostyle Preview" },
    {
      content: "noindex, nofollow",
      name: "robots",
    },
  ];
};

export default function PreviewRoute() {
  const hydrated = useIsHydrated();

  if (!hydrated) {
    return (
      <div className="grid h-dvh place-items-center bg-white text-slate-900">Loading editor…</div>
    );
  }

  return (
    <Suspense fallback={null}>
      <EditorWorkbench />
    </Suspense>
  );
}
