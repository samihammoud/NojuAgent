const MOCK_TODOS = ["Design landing page", "Set up auth flow", "Write unit tests"];

export default function Preview() {
  return (
    <div className="preview">
      {/* Browser chrome */}
      <div className="browser-chrome">
        <div className="browser-dots">
          <span className="dot dot-red" />
          <span className="dot dot-yellow" />
          <span className="dot dot-green" />
        </div>
        <div className="browser-bar">
          <span className="browser-lock">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
          localhost:3000
        </div>
        <div className="browser-actions">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <polyline points="15 3 21 3 21 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="10" y1="14" x2="21" y2="3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* App canvas */}
      <div className="preview-canvas">
        <div className="mock-app">
          <h2 className="mock-title">My Todos</h2>
          <div className="mock-input-row">
            <div className="mock-input">Add a new todo...</div>
            <button className="mock-btn">Add</button>
          </div>
          <ul className="mock-list">
            {MOCK_TODOS.map((todo, i) => (
              <li key={i} className="mock-list-item">
                <span className="mock-checkbox" />
                <span>{todo}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="preview-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path d="M12 8v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          WebContainers not yet connected
        </div>
      </div>
    </div>
  );
}
