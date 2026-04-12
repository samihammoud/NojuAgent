import { useState } from "react";
import CodeEditor from "./CodeEditor";
import Preview from "./Preview";

type Tab = "code" | "preview";

export default function WorkspacePanel() {
  const [tab, setTab] = useState<Tab>("code");

  return (
    <section className="workspace">
      <div className="workspace-tabs">
        <button
          className={`workspace-tab ${tab === "code" ? "workspace-tab-active" : ""}`}
          onClick={() => setTab("code")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <polyline points="16 18 22 12 16 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points="8 6 2 12 8 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Code
        </button>
        <button
          className={`workspace-tab ${tab === "preview" ? "workspace-tab-active" : ""}`}
          onClick={() => setTab("preview")}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <rect x="2" y="3" width="20" height="14" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M8 21h8M12 17v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Preview
        </button>
      </div>

      <div className="workspace-content">
        {tab === "code" ? <CodeEditor /> : <Preview />}
      </div>
    </section>
  );
}
