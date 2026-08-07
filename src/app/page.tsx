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
          The Handbook: <a href="/wiki">/wiki</a> — the player-facing rules, every number read live
          from the engine
        </li>
        <li>
          MCP endpoint: <code>/api/mcp?key=fk_dev</code>
        </li>
        <li>
          REST: <code>/api/state</code>, <code>/api/flock</code>, <code>/api/birds/:id</code>, … —
          all of them need <code>?key=fk_dev</code> (or an <code>x-farm-key</code> header), because
          a seeded world holds twenty farms and the server will not guess which one is yours
        </li>
      </ul>
    </main>
  );
}
