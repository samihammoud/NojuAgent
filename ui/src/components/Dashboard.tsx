import { useEffect, useState } from "react";
import { useAuth } from "@clerk/clerk-react";

interface Project {
  id: string;
  name: string;
  created_at: string;
}

interface Props {
  onSelectProject: (projectId: string) => void;
}

export default function Dashboard({ onSelectProject }: Props) {
  const { userId } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [showInput, setShowInput] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/projects?user_id=${userId}`)
      .then((r) => r.json())
      .then((data) => setProjects(data))
      .finally(() => setLoading(false));
  }, [userId]);

  async function createProject() {
    if (!userId || !newName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, name: newName.trim() }),
      });
      const data = await res.json();
      onSelectProject(data.project_id);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Header */}
      <div className="header">
        <div className="header-left">
          <div className="logo">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
                stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="logo-text">Noju</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        paddingTop: 80,
        padding: "80px 24px 24px",
      }}>
        <div style={{ width: "100%", maxWidth: 640 }}>
          <div style={{ marginBottom: 32 }}>
            <h1 style={{ fontSize: 22, fontWeight: 600, color: "var(--text)", marginBottom: 6 }}>
              Your Projects
            </h1>
            <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Select a project to continue or create a new one.
            </p>
          </div>

          {/* New project */}
          {showInput ? (
            <div style={{
              display: "flex",
              gap: 8,
              marginBottom: 24,
            }}>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createProject();
                  if (e.key === "Escape") { setShowInput(false); setNewName(""); }
                }}
                placeholder="Project name"
                style={{
                  flex: 1,
                  background: "var(--surface-2)",
                  border: "1px solid var(--accent)",
                  borderRadius: "var(--radius-sm)",
                  color: "var(--text)",
                  fontSize: 13,
                  padding: "8px 12px",
                  outline: "none",
                  fontFamily: "inherit",
                }}
              />
              <button
                className="btn-primary"
                onClick={createProject}
                disabled={creating || !newName.trim()}
              >
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => { setShowInput(false); setNewName(""); }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn-primary"
              style={{ marginBottom: 24 }}
              onClick={() => setShowInput(true)}
            >
              + New Project
            </button>
          )}

          {/* Project list */}
          {loading ? (
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Loading...</div>
          ) : projects.length === 0 ? (
            <div style={{
              border: "1px dashed var(--border-2)",
              borderRadius: "var(--radius)",
              padding: "40px 24px",
              textAlign: "center",
              color: "var(--text-muted)",
              fontSize: 13,
            }}>
              No projects yet. Create one to get started.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelectProject(p.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "14px 16px",
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "border-color 0.15s",
                    width: "100%",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--border-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                >
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text)", marginBottom: 3 }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                      {new Date(p.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "var(--text-muted)", flexShrink: 0 }}>
                    <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
