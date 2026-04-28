export default function Header({ onBack }: { onBack: () => void }) {
  return (
    <header className="header">
      <div className="header-left">
        <button
          className="btn-ghost"
          onClick={onBack}
          style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 8px" }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Back
        </button>
        <div className="header-divider" />
        <div className="logo">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
              stroke="var(--accent)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="logo-text">Noju</span>
        </div>
        <div className="header-divider" />
        <span className="project-name">my-app</span>
      </div>

      <div className="header-right">
        <button className="btn-ghost">Share</button>
        <button className="btn-primary">Publish</button>
      </div>
    </header>
  );
}
