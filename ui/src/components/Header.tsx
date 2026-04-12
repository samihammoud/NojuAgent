export default function Header() {
  return (
    <header className="header">
      <div className="header-left">
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
