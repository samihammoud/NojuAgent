import os
from supabase import create_client, Client

_client: Client | None = None


def get_client() -> Client:
    global _client
    if _client is None:
        url = os.environ["SUPABASE_URL"]
        key = os.environ["SUPABASE_SERVICE_KEY"]
        _client = create_client(url, key)
    return _client


async def upsert_user(user_id: str, email: str | None = None) -> None:
    get_client().table("users").upsert(
        {"id": user_id, "email": email}
    ).execute()


##ID generation happens in schema
async def create_project(user_id: str, name: str = "My App") -> str:
    """Creates a new project and returns its project_id."""
    result = (
        get_client()
        .table("projects")
        .insert({"user_id": user_id, "name": name})
        .execute()
    )
    return result.data[0]["id"]


async def get_project(project_id: str) -> dict | None:
    """Fetch a project by its id."""
    result = (
        get_client()
        .table("projects")
        .select("id,name,user_id,created_at")
        .eq("id", project_id)
        .limit(1)
        .execute()
    )
    return result.data[0] if result.data else None


async def list_projects(user_id: str) -> list[dict]:
    """List all projects for a user."""
    result = (
        get_client()
        .table("projects")
        .select("id,name,created_at")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return result.data


async def save_files(project_id: str, files: dict[str, str]) -> None:
    """Upsert multiple files for a project. files = {path: content}"""
    if not files:
        return
    client = get_client()
    rows = [
        {"project_id": project_id, "path": path, "content": content}
        for path, content in files.items()
    ]
    client.table("files").upsert(rows, on_conflict="project_id,path").execute()


async def load_files(project_id: str) -> dict[str, str]:
    """Load all files for a project. Returns {path: content}"""
    result = (
        get_client()
        .table("files")
        .select("path,content")
        .eq("project_id", project_id)
        .execute()
    )
    return {row["path"]: row["content"] for row in result.data}


async def list_paths(project_id: str) -> list[str]:
    """Return all file paths for a project (no content)."""
    result = (
        get_client()
        .table("files")
        .select("path")
        .eq("project_id", project_id)
        .execute()
    )
    return sorted(row["path"] for row in result.data)


async def delete_project(project_id: str) -> None:
    client = get_client()
    client.table("messages").delete().eq("project_id", project_id).execute()
    client.table("files").delete().eq("project_id", project_id).execute()
    client.table("projects").delete().eq("id", project_id).execute()


async def append_message(project_id: str, role: str, content) -> None:
    get_client().table("messages").insert(
        {"project_id": project_id, "role": role, "content": content}
    ).execute()


async def load_messages(project_id: str) -> list[dict]:
    result = (
        get_client()
        .table("messages")
        .select("role,content,created_at")
        .eq("project_id", project_id)
        .order("created_at")
        .execute()
    )
    return result.data
