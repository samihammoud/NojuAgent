// Minimal hand-crafted syntax highlighting — no external deps.
// Each token type maps to a CSS class.

interface Token {
  type: "keyword" | "component" | "string" | "comment" | "fn" | "plain" | "punct" | "number";
  text: string;
}

type Line = Token[];

const CODE: Line[] = [
  [{ type: "keyword", text: "import" }, { type: "plain", text: " { " }, { type: "fn", text: "useState" }, { type: "plain", text: " } " }, { type: "keyword", text: "from" }, { type: "string", text: " 'react'" }],
  [{ type: "keyword", text: "import" }, { type: "plain", text: " " }, { type: "string", text: "'./App.css'" }],
  [{ type: "plain", text: "" }],
  [{ type: "keyword", text: "interface" }, { type: "plain", text: " " }, { type: "component", text: "Todo" }, { type: "plain", text: " {" }],
  [{ type: "plain", text: "  id: " }, { type: "keyword", text: "number" }, { type: "plain", text: ";" }],
  [{ type: "plain", text: "  text: " }, { type: "keyword", text: "string" }, { type: "plain", text: ";" }],
  [{ type: "plain", text: "  done: " }, { type: "keyword", text: "boolean" }, { type: "plain", text: ";" }],
  [{ type: "plain", text: "}" }],
  [{ type: "plain", text: "" }],
  [{ type: "keyword", text: "export default function" }, { type: "plain", text: " " }, { type: "component", text: "App" }, { type: "plain", text: "() {" }],
  [{ type: "plain", text: "  " }, { type: "keyword", text: "const" }, { type: "plain", text: " [todos, setTodos] = " }, { type: "fn", text: "useState" }, { type: "plain", text: "<" }, { type: "component", text: "Todo" }, { type: "plain", text: "[]>([])" }],
  [{ type: "plain", text: "  " }, { type: "keyword", text: "const" }, { type: "plain", text: " [input, setInput] = " }, { type: "fn", text: "useState" }, { type: "plain", text: "(" }, { type: "string", text: "''" }, { type: "plain", text: ")" }],
  [{ type: "plain", text: "" }],
  [{ type: "plain", text: "  " }, { type: "keyword", text: "const" }, { type: "plain", text: " " }, { type: "fn", text: "addTodo" }, { type: "plain", text: " = () => {" }],
  [{ type: "plain", text: "    " }, { type: "keyword", text: "if" }, { type: "plain", text: " (!input." }, { type: "fn", text: "trim" }, { type: "plain", text: "()) " }, { type: "keyword", text: "return" }],
  [{ type: "plain", text: "    " }, { type: "fn", text: "setTodos" }, { type: "plain", text: "([...todos, { id: " }, { type: "fn", text: "Date" }, { type: "plain", text: "." }, { type: "fn", text: "now" }, { type: "plain", text: "(), text: input, done: " }, { type: "keyword", text: "false" }, { type: "plain", text: " }])" }],
  [{ type: "plain", text: "    " }, { type: "fn", text: "setInput" }, { type: "plain", text: "(" }, { type: "string", text: "''" }, { type: "plain", text: ")" }],
  [{ type: "plain", text: "  }" }],
  [{ type: "plain", text: "" }],
  [{ type: "plain", text: "  " }, { type: "keyword", text: "return" }, { type: "plain", text: " (" }],
  [{ type: "plain", text: "    <" }, { type: "component", text: "div" }, { type: "plain", text: " className=" }, { type: "string", text: '"container"' }, { type: "plain", text: ">" }],
  [{ type: "plain", text: "      <" }, { type: "component", text: "h1" }, { type: "plain", text: ">My Todos</" }, { type: "component", text: "h1" }, { type: "plain", text: ">" }],
  [{ type: "plain", text: "      <" }, { type: "component", text: "div" }, { type: "plain", text: " className=" }, { type: "string", text: '"input-row"' }, { type: "plain", text: ">" }],
  [{ type: "plain", text: "        <" }, { type: "component", text: "input" }, { type: "plain", text: " value={input} onChange={e => " }, { type: "fn", text: "setInput" }, { type: "plain", text: "(e.target.value)} />" }],
  [{ type: "plain", text: "        <" }, { type: "component", text: "button" }, { type: "plain", text: " onClick={" }, { type: "fn", text: "addTodo" }, { type: "plain", text: "}>Add</" }, { type: "component", text: "button" }, { type: "plain", text: ">" }],
  [{ type: "plain", text: "      </" }, { type: "component", text: "div" }, { type: "plain", text: ">" }],
  [{ type: "plain", text: "      <" }, { type: "component", text: "ul" }, { type: "plain", text: ">" }],
  [{ type: "plain", text: "        {todos." }, { type: "fn", text: "map" }, { type: "plain", text: "(todo => (" }],
  [{ type: "plain", text: "          <" }, { type: "component", text: "li" }, { type: "plain", text: " key={todo.id}>{todo.text}</" }, { type: "component", text: "li" }, { type: "plain", text: ">" }],
  [{ type: "plain", text: "        ))}" }],
  [{ type: "plain", text: "      </" }, { type: "component", text: "ul" }, { type: "plain", text: ">" }],
  [{ type: "plain", text: "    </" }, { type: "component", text: "div" }, { type: "plain", text: ">" }],
  [{ type: "plain", text: "  )" }],
  [{ type: "plain", text: "}" }],
];

export default function CodeEditor() {
  return (
    <div className="code-editor">
      <div className="editor-topbar">
        <div className="editor-tabs">
          <span className="editor-tab editor-tab-active">App.tsx</span>
          <span className="editor-tab">App.css</span>
        </div>
      </div>
      <div className="editor-body">
        <div className="line-numbers">
          {CODE.map((_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>
        <pre className="editor-code">
          {CODE.map((line, i) => (
            <div key={i} className="code-line">
              {line.length === 1 && line[0].text === "" ? (
                <span>&nbsp;</span>
              ) : (
                line.map((token, j) => (
                  <span key={j} className={`tok-${token.type}`}>
                    {token.text}
                  </span>
                ))
              )}
            </div>
          ))}
        </pre>
      </div>
    </div>
  );
}
