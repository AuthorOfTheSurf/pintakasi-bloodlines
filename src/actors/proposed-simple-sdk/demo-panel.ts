/**
 * Live demo: boots a real engine with the chat room + referee, opens the
 * monitor panel, attaches adapters, and drives traffic — including the
 * occasional two-rock round that trips the forgotten-draw bug.
 *
 *   bun src/actors/proposed-simple-sdk/demo-panel.ts
 *   DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/… bun src/actors/proposed-simple-sdk/demo-panel.ts
 */
import { discord, stdout, watch } from "./adapters.ts";
import { ChatRoom, Moderator } from "./chat.ts";
import { testEngine } from "./layer.ts";
import { Referee, type Choice } from "./monitor-demo.ts";
import { startPanel } from "./panel.ts";

const webhookUrl = process.env["DISCORD_WEBHOOK_URL"];
watch(stdout(), ...(webhookUrl ? [discord({ webhookUrl })] : []));
if (!webhookUrl) console.log("(set DISCORD_WEBHOOK_URL to also push reports to Discord)");

const panel = startPanel();
console.log(`monitor panel: ${panel.url}`);

const engine = testEngine(ChatRoom, Moderator, Referee);
const referee = engine.client(Referee).getOrCreate(`arena-${crypto.randomUUID()}`);
const room = engine.client(ChatRoom).getOrCreate(`lobby-${crypto.randomUUID()}`);

await room.Initialize({ name: "Sabungan Lobby" });
await room.Join({ name: "Alice" });
await room.Join({ name: "Bob" });

const CHOICES: Choice[] = ["rock", "paper", "scissors"];
const pick = () => CHOICES[Math.floor(Math.random() * CHOICES.length)]!;

let round = 0;
while (true) {
  round += 1;
  const [alice, bob] = [pick(), pick()];
  try {
    const { winner } = await referee.Play({ alice, bob });
    await room.SendMessage({ sender: winner, text: `round ${round}: my ${winner === "Alice" ? alice : bob} wins!` });
  } catch {
    // the forgotten draw — already reported through the monitor channel
  }
  await new Promise((r) => setTimeout(r, 1500));
}
