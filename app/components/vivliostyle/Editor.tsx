import CodeMirror from "@uiw/react-codemirror";

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Plain VFM text editor — no syntax highlighting is needed for the PoC.
 */
export function Editor({ value, onChange }: EditorProps) {
  return (
    <CodeMirror
      className="h-full overflow-auto text-sm"
      height="100%"
      onChange={onChange}
      theme="light"
      value={value}
    />
  );
}
