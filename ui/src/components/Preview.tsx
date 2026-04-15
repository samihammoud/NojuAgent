import { useEffect, useRef, useState } from "react";
import { getWebContainer, serverUrlPromise, onBootPhaseChange, type BootPhase } from "../lib/webcontainer";

type Status =
  | { type: "booting" }
  | { type: "installing" }
  | { type: "starting" }
  | { type: "ready"; url: string }
  | { type: "error"; message: string };

function phaseToStatus(phase: BootPhase): Status {
  switch (phase) {
    case "booting":    return { type: "booting" };
    case "installing": return { type: "installing" };
    case "starting":   return { type: "starting" };
    case "error":      return { type: "error", message: "Boot failed" };
    default:           return { type: "booting" };
  }
}

export default function Preview() {
  const [status, setStatus] = useState<Status>({ type: "booting" });
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const urlRef = useRef("");

  useEffect(() => {
    let cancelled = false;

    // Subscribe to boot phase changes for loading UX
    const unsub = onBootPhaseChange((phase) => {
      if (cancelled) return;
      if (phase !== "ready") {
        setStatus(phaseToStatus(phase));
      }
    });

    async function boot() {
      try {
        await getWebContainer();
        if (cancelled) return;

        const url = await serverUrlPromise;
        if (cancelled) return;

        urlRef.current = url;
        setStatus({ type: "ready", url });
      } catch (err) {
        if (!cancelled) {
          setStatus({ type: "error", message: String(err) });
        }
      }
    }

    boot();
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  function statusLabel(): string {
    switch (status.type) {
      case "booting":    return "Starting WebContainer...";
      case "installing": return "Installing dependencies...";
      case "starting":   return "Starting dev server...";
      default:           return "Loading...";
    }
  }

  function statusSub(): string {
    switch (status.type) {
      case "booting":    return "Booting isolated runtime";
      case "installing": return "Running npm install";
      case "starting":   return "Running npm run dev (Vite)";
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
