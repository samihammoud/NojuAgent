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
  <title>Noju</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
      background: #0a0a0f;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
      padding: 32px;
    }

    .icon {
      width: 48px;
      height: 48px;
      opacity: 0.25;
      margin-bottom: 8px;
    }

    h1 {
      font-size: 18px;
      font-weight: 500;
      color: #ffffff;
      letter-spacing: -0.2px;
      opacity: 0.7;
    }

    p {
      font-size: 13px;
      color: #ffffff;
      opacity: 0.3;
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="container">
    <svg class="icon" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <h1>Nothing to preview yet</h1>
    <p>Let's start coding</p>
  </div>
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
