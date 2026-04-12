import type { FileSystemTree } from "@webcontainer/api";

// A self-contained Node.js HTTP server + vanilla JS todo app.
// No npm install needed

const serverJs = /* js */ `
const http = require('http');
const fs   = require('fs');

http.createServer((_req, res) => {
  const html = fs.readFileSync('./index.html', 'utf8');
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(html);
}).listen(3000);
`;

const indexHtml = /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Todo App</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
      background: #f5f5f5;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 48px 16px;
    }

    .card {
      background: #fff;
      border-radius: 12px;
      padding: 32px;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 4px 24px rgba(0,0,0,.08);
    }

    h1 {
      font-size: 22px;
      font-weight: 700;
      color: #111;
      margin-bottom: 24px;
      letter-spacing: -0.3px;
    }

    .input-row {
      display: flex;
      gap: 8px;
      margin-bottom: 24px;
    }

    input {
      flex: 1;
      padding: 10px 14px;
      border: 1.5px solid #e5e7eb;
      border-radius: 8px;
      font-size: 14px;
      outline: none;
      transition: border-color .15s;
      color: #111;
    }
    input:focus { border-color: #6366f1; }
    input::placeholder { color: #aaa; }

    button {
      padding: 10px 18px;
      background: #6366f1;
      color: #fff;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: opacity .15s;
      white-space: nowrap;
    }
    button:hover { opacity: .85; }

    ul { list-style: none; display: flex; flex-direction: column; gap: 8px; }

    li {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 14px;
      color: #374151;
      cursor: pointer;
      transition: background .1s;
      user-select: none;
    }
    li:hover { background: #f9fafb; }
    li.done span.text { text-decoration: line-through; color: #aaa; }

    .checkbox {
      width: 18px;
      height: 18px;
      border-radius: 5px;
      border: 1.5px solid #d1d5db;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 11px;
      color: #fff;
      transition: background .15s, border-color .15s;
    }
    li.done .checkbox {
      background: #6366f1;
      border-color: #6366f1;
    }

    .empty {
      text-align: center;
      color: #aaa;
      font-size: 13.5px;
      padding: 24px 0;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>My Todos</h1>
    <div class="input-row">
      <input id="inp" placeholder="Add a todo..." />
      <button onclick="add()">Add</button>
    </div>
    <ul id="list"></ul>
    <p class="empty" id="empty" style="display:none">No todos yet. Add one above!</p>
  </div>

  <script>
    const todos = [
      { id: 1, text: 'Design landing page', done: false },
      { id: 2, text: 'Set up auth flow', done: true },
      { id: 3, text: 'Write unit tests', done: false },
    ];

    function add() {
      const inp = document.getElementById('inp');
      const text = inp.value.trim();
      if (!text) return;
      todos.unshift({ id: Date.now(), text, done: false });
      inp.value = '';
      render();
    }

    function toggle(id) {
      const t = todos.find(t => t.id === id);
      if (t) t.done = !t.done;
      render();
    }

    function render() {
      const list = document.getElementById('list');
      const empty = document.getElementById('empty');
      empty.style.display = todos.length === 0 ? 'block' : 'none';
      list.innerHTML = todos.map(t => \`
        <li class="\${t.done ? 'done' : ''}" onclick="toggle(\${t.id})">
          <span class="checkbox">\${t.done ? '✓' : ''}</span>
          <span class="text">\${t.text}</span>
        </li>
      \`).join('');
    }

    document.getElementById('inp').addEventListener('keydown', e => {
      if (e.key === 'Enter') add();
    });

    render();
  </script>
</body>
</html>
`;

export const previewFiles: FileSystemTree = {
  "server.js": {
    file: { contents: serverJs },
  },
  "index.html": {
    file: { contents: indexHtml },
  },
};
