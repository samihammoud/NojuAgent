interface Props {
  content: string | null;
}

export default function CodeEditor({ content }: Props) {
  const lines = content?.split("\n") ?? null;

  return (
    <div className="code-editor">
      <div className="editor-topbar">
        <div className="editor-tabs">
          <span className="editor-tab editor-tab-active">index.html</span>
        </div>
      </div>

      {lines === null ? (
        <div className="editor-empty">
          <div className="preview-spinner" />
          <p className="preview-label" style={{ marginTop: 12 }}>
            Waiting for WebContainer...
          </p>
        </div>
      ) : (
        <div className="editor-body">
          <div className="line-numbers">
            {lines.map((_, i) => (
              <span key={i}>{i + 1}</span>
            ))}
          </div>
          <pre className="editor-code">
            {lines.map((line, i) => (
              <div key={i} className="code-line">
                {line || "\u00a0"}
              </div>
            ))}
          </pre>
        </div>
      )}
    </div>
  );
}
