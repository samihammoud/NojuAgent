import Editor from "@monaco-editor/react";

interface Props {
  files: Record<string, string>;
  activeFile: string;
  onSelectFile: (path: string) => void;
  onLoadFile: (path: string) => Promise<string>;
}

function getLanguage(path: string): string {
  if (path.endsWith(".jsx") || path.endsWith(".js")) return "javascript";
  if (path.endsWith(".tsx") || path.endsWith(".ts")) return "typescript";
  if (path.endsWith(".css")) return "css";
  if (path.endsWith(".html")) return "html";
  if (path.endsWith(".json")) return "json";
  return "plaintext";
}

function getIndent(path: string): number {
  return (path.match(/\//g) || []).length;
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path;
}

export default function CodeEditor({ files, activeFile, onSelectFile, onLoadFile }: Props) {
  const sortedFiles = Object.keys(files).sort();

  async function handleSelect(path: string) {
    onSelectFile(path);
    await onLoadFile(path);
  }

  return (
    <div className="code-editor">
      <div className="editor-topbar">
        <div className="editor-tabs">
          <span className="editor-tab editor-tab-active">
            {getFileName(activeFile)}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", height: "calc(100% - 36px)" }}>
        {/* File tree */}
        <div className="file-tree">
          {sortedFiles.map((path) => (
            <div
              key={path}
              className={`file-tree-item ${path === activeFile ? "file-tree-item-active" : ""}`}
              style={{ paddingLeft: `${8 + getIndent(path) * 12}px` }}
              onClick={() => handleSelect(path)}
              title={path}
            >
              {getFileName(path)}
            </div>
          ))}
        </div>

        {/* Monaco editor */}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <Editor
            height="100%"
            language={getLanguage(activeFile)}
            value={files[activeFile] ?? ""}
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
              scrollbar: { vertical: "auto", horizontal: "auto" },
            }}
          />
        </div>
      </div>
    </div>
  );
}
