import type { FileSystemTree } from "@webcontainer/api";

export function buildFileSystemTree(files: Record<string, string>): FileSystemTree {
  const tree: FileSystemTree = {};
  for (const [path, content] of Object.entries(files)) {
    const parts = path.split("/");
    let node = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node[parts[i]]) node[parts[i]] = { directory: {} };
      node = (node[parts[i]] as { directory: FileSystemTree }).directory;
    }
    node[parts[parts.length - 1]] = { file: { contents: content } };
  }
  return tree;
}

const packageJson = `{
  "name": "noju-app",
  "private": true,
  "version": "0.0.1",
  "type": "module",
  "scripts": {
    "dev": "vite"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "vite": "^5.4.0"
  }
}
`;

const viteConfig = `import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'react',
  },
  server: { port: 3000 },
});
`;

const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Noju App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
`;

const mainJsx = `import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

createRoot(document.getElementById('root')).render(<App />);
`;

const appJsx = `export default function App() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#0a0a0f',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, Inter, sans-serif',
    }}>
      <div style={{ textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ opacity: 0.25, marginBottom: 16 }}>
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
            stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <h1 style={{ color: '#fff', opacity: 0.7, fontSize: 18, fontWeight: 500, marginBottom: 8 }}>
          Welcome to Noju AI
        </h1>
        <p style={{ color: '#fff', opacity: 0.3, fontSize: 13 }}>Let's start coding</p>
      </div>
    </div>
  );
}
`;

const indexCss = `*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
}
`;

export const previewFiles: FileSystemTree = {
  "package.json": { file: { contents: packageJson } },
  "vite.config.js": { file: { contents: viteConfig } },
  "index.html": { file: { contents: indexHtml } },
  src: {
    directory: {
      "main.jsx": { file: { contents: mainJsx } },
      "App.jsx": { file: { contents: appJsx } },
      "index.css": { file: { contents: indexCss } },
    },
  },
};

// Default content shown in code editor before agent writes anything
export const defaultEditorFiles: Record<string, string> = {
  "src/App.jsx": appJsx,
  "src/main.jsx": mainJsx,
  "src/index.css": indexCss,
  "index.html": indexHtml,
  "vite.config.js": viteConfig,
  "package.json": packageJson,
};
