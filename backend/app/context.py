"""Context window management: stubbing stale file content + sliding window truncation.

compact_messages — walking newest → oldest, the first time we see a path, keep its
content. Every older encounter of that same path gets stubbed. Reads and writes are
treated the same; position in history decides which one wins. A path that appears
only once is always preserved.

tool_result blocks only carry a tool_use_id, so we first build a tool_use_id → path
map, then use it to resolve results during the reverse walk.

truncate_history — caps total messages. Cannot slice mid-turn: a user "tool_result"
message orphaned from its assistant "tool_use" makes the API reject the request.
Safe cut boundaries are plain-text user messages (the start of a user turn).
"""

STUB = "<superseded>"


def compact_messages(messages: list[dict]) -> None:
    tool_paths: dict[str, tuple[str, str]] = {}
    for msg in messages:
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            if block.get("type") == "tool_use" and block.get("name") in ("read_file", "write_file"):
                path = block.get("input", {}).get("path")
                if path:
                    tool_paths[block["id"]] = (block["name"], path)

    seen: set[str] = set()
    for msg in reversed(messages):
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        for block in content:
            btype = block.get("type")
            if btype == "tool_use" and block.get("name") == "write_file":
                path = block.get("input", {}).get("path")
                if not path:
                    continue
                if path in seen:
                    block["input"] = {"path": path, "content": STUB}
                else:
                    seen.add(path)
            elif btype == "tool_result":
                info = tool_paths.get(block.get("tool_use_id"))
                if not info:
                    continue
                name, path = info
                if name != "read_file":
                    continue
                if path in seen:
                    block["content"] = STUB
                else:
                    seen.add(path)


def truncate_history(messages: list[dict], max_messages: int) -> None:
    if len(messages) <= max_messages:
        return

    cut = len(messages) - max_messages
    while cut < len(messages):
        msg = messages[cut]
        if msg["role"] == "user" and isinstance(msg.get("content"), str):
            del messages[:cut]
            return
        cut += 1
