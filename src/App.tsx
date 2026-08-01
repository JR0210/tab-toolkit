import './App.css'

function App() {
  return (
    <main className="project-shell">
      <p className="eyebrow">Tab Toolkit</p>
      <h1>Extension foundation</h1>
      <p className="summary">
        A local-first Chrome tab management toolkit. The extension interface and browser
        integrations will be added next.
      </p>
      <dl className="stack" aria-label="Project stack">
        <div>
          <dt>Interface</dt>
          <dd>React 19</dd>
        </div>
        <div>
          <dt>Language</dt>
          <dd>TypeScript 6</dd>
        </div>
        <div>
          <dt>Tooling</dt>
          <dd>Vite 8</dd>
        </div>
      </dl>
    </main>
  )
}

export default App
