export default function Home() {
  return (
    <main style={{ fontFamily: "monospace", padding: "2rem" }}>
      <h1>Pintakasi: Bloodlines</h1>
      <p>Breed, fight, retire. There is no UI — Claude is the game client.</p>
      <ul>
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
