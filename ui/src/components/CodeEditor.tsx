import Editor from "@monaco-editor/react";

interface Props {
  content: string | null;
}

export default function CodeEditor({ content }: Props) {
  return (
    <div className="code-editor">
      <div className="editor-topbar">
        <div className="editor-tabs">
          <span className="editor-tab editor-tab-active">index.html</span>
        </div>
      </div>

      <div style={{ height: "calc(100% - 36px)", overflow: "hidden" }}>
        <Editor
          height="100%"
          defaultLanguage="html"
          value={content ?? ""}
          theme="vs-dark"
          options={{
            readOnly: true,
            minimap: { enabled: false },
            fontSize: 13,
            fontFamily: "'Monaco', 'Menlo', 'Courier New', monospace",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
            renderLineHighlight: "none",
            overviewRulerLanes: 0,
            hideCursorInOverviewRuler: true,
            scrollbar: {
              vertical: "auto",
              horizontal: "auto",
            },
          }}
        />
      </div>
    </div>
  );
}
