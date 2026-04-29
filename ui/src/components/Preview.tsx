import { useEffect, useRef, useState } from "react";
import { onBootPhaseChange, onServerUrlChange, type BootPhase } from "../lib/webcontainer";

type Status =
  | { type: "idle" }
  | { type: "installing" }
  | { type: "starting" }
  | { type: "ready"; url: string }
  | { type: "error"; message: string };

function phaseToStatus(phase: BootPhase, url: string | null): Status {
  switch (phase) {
    case "idle":       return { type: "idle" };
    case "installing": return { type: "installing" };
    case "starting":   return { type: "starting" };
    case "ready":      return url ? { type: "ready", url } : { type: "starting" };
    case "error":      return { type: "error", message: "Boot failed" };
  }
}

export default function Preview() {
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const urlRef = useRef("");

  useEffect(() => {
    let phase: BootPhase = "idle";
    let url: string | null = null;

    const recompute = () => setStatus(phaseToStatus(phase, url));

    const unsubPhase = onBootPhaseChange((p) => {
      phase = p;
      recompute();
    });

    const unsubUrl = onServerUrlChange((u) => {
      url = u;
      if (u) urlRef.current = u;
      recompute();
    });

    return () => {
      unsubPhase();
      unsubUrl();
    };
  }, []);

  function statusLabel(): string {
    switch (status.type) {
      case "idle":       return "Waiting for project...";
      case "installing": return "Installing dependencies...";
      case "starting":   return "Starting dev server...";
      default:           return "Loading...";
    }
  }

  function statusSub(): string {
    switch (status.type) {
      case "idle":       return "Pick a project to begin";
      case "installing": return "Running pnpm install";
      case "starting":   return "Running pnpm run dev (Vite)";
      default:           return "";
    }
  }

  return (
    <div className="preview" style={{ width: "100%" }}>
      {/* Browser chrome */}
      <div className="browser-chrome">
        <div className="browser-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>

        <div
          className="browser-actions"
          onClick={() => {
            if (iframeRef.current && urlRef.current) {
              iframeRef.current.src = urlRef.current;
            }
          }}
          title="Reload"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M3.51 15a9 9 0 1 0 .49-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="preview-canvas">
        <iframe
          ref={iframeRef}
          src={status.type === "ready" ? status.url : "about:blank"}
          className="preview-iframe"
          style={{ display: status.type === "ready" ? "block" : "none" }}
          allow="cross-origin-isolated"
          title="Preview"
        />

        {status.type !== "ready" && (
          <div className="preview-loading">
            {status.type === "error" ? (
              <>
                <div className="preview-icon preview-icon-error">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <p className="preview-label">Failed to start</p>
                <p className="preview-sub">{status.message}</p>
              </>
            ) : (
              <>
                <div className="preview-spinner" />
                <p className="preview-label">{statusLabel()}</p>
                <p className="preview-sub">{statusSub()}</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
