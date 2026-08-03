export default function Home() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Pintakasi: Bloodlines</h1>
      <p>Breed, fight, retire. Claude is the game client; the stewards watch from the office.</p>
      <ul>
        <li>
          Admin view: <a href="/admin">/admin</a> — top-line figures, the unified ledger, fight/farm/bird
          tables
        </li>
        <li>
          MCP endpoint: <code>/api/mcp</code>
        </li>
        <li>
          REST: <code>/api/state</code>, <code>/api/flock</code>, <code>/api/birds/:id</code>, …
        </li>
      </ul>
    </main>
  );
}
