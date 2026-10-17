import Link from "next/link";
import type { ReactNode } from "react";
import { db } from "@/db/client";
import { AGE, FORMATS, PINTAKASI } from "@/engine/config";
import { BirdSprite } from "./admin/sprites";
import { CoatEgg } from "./home/egg";
import { loadFrontPage, type Lineage, type ShownBird } from "./home/front-page";
import { HOME_CSS } from "./home/styles";
import { Watch } from "./home/watch";

export const dynamic = "force-dynamic";

/**
 * THE FRONT PAGE. The first thing a prospect sees, usually in a demo, and
 * usually someone who has bred real birds. It has one job: make them ask
 * "can I play?", and then hand them the button.
 *
 * Same rule as the Handbook: every number is read from the world or from
 * @/engine/config at render time, never typed.
 */
export default function Home() {
  const fp = loadFrontPage(db());
  const blades = Object.keys(FORMATS).length;
  return (
    <div className="home">
      <style>{HOME_CSS}</style>

      <section className="hero">
        <h1>Pintakasi: Bloodlines</h1>
        <p className="pitch">
          Raise fighting cocks. Read them from how they fight. Breed a line good enough to win a
          Major.
        </p>
        {fp.parade.length > 0 ? (
          <ul className="parade" aria-label="Top birds fighting in the live world">
            {fp.parade.map((b) => (
              <li key={b.id}>
                <span className="perch">
                  <Sprite bird={b} size={56} />
                </span>
                <span className="tag">
                  <b>{b.name}</b>
                  {b.status === "egg" ? "in the egg" : `${b.wins}-${b.losses}`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="ctas">
          <Link className="btn" href="/join">
            Join the alpha
          </Link>
          <a className="btn ghost" href="#watch">
            Watch a fight
          </a>
        </div>
        <ul className="stats" aria-label="The live world today">
          <li>
            <b>Day {fp.dayIndex.toLocaleString()}</b>of the live world
          </li>
          {/* A count of zero says "dead", not "new", so a fresh world leaves it out. */}
          {[
            { n: fp.activeBirds, what: "birds fighting" },
            { n: fp.fightsFought, what: "fights fought" },
            { n: fp.majorsRun, what: "Majors run" },
          ]
            .filter(({ n }) => n > 0)
            .map(({ n, what }) => (
              <li key={what}>
                <b>{n.toLocaleString()}</b>
                {what}
              </li>
            ))}
        </ul>
      </section>

      <section id="watch">
        <h2>Watch a fight</h2>
        <p className="kicker">
          The game plays out every fight blow by blow, from the two birds&apos; stats and a roll of
          the dice. Nobody scripts the result, and nobody can buy it.
        </p>
        <Watch
          replay={{
            timeline: fp.featured.replay.timeline,
            looks: fp.featured.replay.looks,
            stables: fp.featured.replay.stables,
          }}
        />
        <p className="watch-caption">{fp.featured.caption}.</p>
      </section>

      <section>
        <h2>How it works</h2>
        <p className="kicker">Four things to learn. A season to get good at them.</p>
        <ol className="steps">
          <li>
            <h3>Breed</h3>
            <p>
              Pair a retired hen with a retired rooster. The chick takes after both. Only retired
              birds breed, so a career ends before a bloodline begins.
            </p>
            <Link href="/wiki/breeding">Breeding →</Link>
          </li>
          <li>
            <h3>Card the bird</h3>
            <p>
              Each day posts a short list of fights. Pick one, pay the entry, and your bird meets
              other players&apos; birds that night.
            </p>
            <Link href="/wiki/card">The daily card →</Link>
          </li>
          <li>
            <h3>Read the Pit Figures</h3>
            <p>
              You can&apos;t see a fighter&apos;s stats. Every fight gives it a Pit Figure, a score
              for how well it fought. Compare them across the {blades} blades to learn what the bird
              is.
            </p>
            <Link href="/wiki/fighting">Fighting →</Link>
          </li>
          <li>
            <h3>Chase Thursday&apos;s Major</h3>
            <p>
              Any bird age {AGE.FORK} or older can enter for {PINTAKASI.ENTRY_FEE} GP. The purse is
              the biggest in the game. Lose a bout and your bird retires on the spot.
            </p>
            <Link href="/wiki/pintakasi">The Pintakasi →</Link>
          </li>
        </ol>
      </section>

      <section>
        <h2>Bloodlines</h2>
        <p className="kicker">
          If you have bred real birds, you already know this game. You just get to see the results
          faster.
        </p>
        <ul className="facts">
          <li>
            <strong>Stats are fixed at hatch.</strong> No bird trains up. What it is on day one is
            what it is for life.
          </li>
          <li>
            <strong>Stats stay hidden until it retires.</strong> While it fights, you judge it by
            what it does in the ring.
          </li>
          <li>
            <strong>A chick starts at its parents&apos; average.</strong> Both parents are retired,
            so both sheets are open. You can work out the cross before you pay for the cover.
          </li>
          <li>
            <strong>Every line is tracked.</strong> A chick is one generation deeper than its dam.
            {fp.deepestGeneration > 0
              ? ` The deepest line in the world today is ${fp.deepestGeneration} generations deep.`
              : " Every bird in the world today is a founder, so the first lines start now."}
          </li>
        </ul>
        {fp.lineage ? <Family lineage={fp.lineage} /> : <HowALineGrows />}
      </section>

      <section className="claude">
        <h2>You play through Claude</h2>
        <p className="kicker">
          There is no app to install. You connect Claude to the game, in Claude Desktop, claude.ai
          or Claude Code. Then you play by talking to it. Claude reads the card, places your birds,
          and tells you how they did.
        </p>
        <div className="chat" aria-label="An example of playing through Claude">
          <p className="you">
            <span className="who">You</span>
            Which of my hens is ready for a harder class?
          </p>
          <p className="claude-says">
            <span className="who">Claude</span>
            Your grey hen has won four of her last five, and her Pit Figures keep climbing on the
            long blades. I&apos;d move her up and card her on tonight&apos;s gaff fight.
          </p>
        </div>
        <Link className="btn" href="/join">
          Join the alpha
        </Link>
        <p className="seats">Seats are limited. The stewards will be in touch about the buy-in.</p>
      </section>

      <footer className="foot">
        <Link href="/wiki">The Pintakasi Handbook</Link>
        <Link href="/admin">The Stewards&apos; Office</Link>
      </footer>
    </div>
  );
}

function Family({ lineage }: { lineage: Lineage }) {
  const parents = [
    { role: "Sire", bird: lineage.sire },
    { role: "Dam", bird: lineage.dam },
  ];
  return (
    <>
      <div className="tree">
        <div className="parents">
          {parents.map(({ role, bird }) =>
            bird ? <LiveCard key={role} role={role} bird={bird} /> : null
          )}
        </div>
        <span className="arrow" aria-hidden>
          →
        </span>
        <LiveCard role={lineage.role} bird={lineage.bird} star />
      </div>
      <p className="claim">
        {lineage.claim}. Real birds from the live world, read from the stud book.
      </p>
    </>
  );
}

/** An egg shows only its shell; its sex stays hidden until it hatches. */
function Sprite({ bird, size }: { bird: ShownBird; size: number }) {
  if (bird.status === "egg") return <CoatEgg baseCoat={bird.baseCoat} size={size} />;
  return (
    <BirdSprite sex={bird.sex} baseCoat={bird.baseCoat} trimColor={bird.trimColor} size={size} />
  );
}

const STATUS_WORD: Record<ShownBird["status"], string> = {
  egg: "in the egg",
  active: "fighting",
  retired: "retired",
};

function LiveCard({ role, bird, star }: { role: string; bird: ShownBird; star?: boolean }) {
  return (
    <BirdCard
      role={role}
      name={bird.name}
      meta={`Gen ${bird.generation} · ${bird.wins}-${bird.losses} · ${STATUS_WORD[bird.status]}`}
      sprite={<Sprite bird={bird} size={star ? 72 : 48} />}
      star={star}
    />
  );
}

/**
 * The family tree before the world has one: a fresh world has no retirees,
 * so no bird has parents yet. Drawn from what every first cross will be.
 */
function HowALineGrows() {
  return (
    <>
      <div className="tree">
        <div className="parents">
          <BirdCard
            role="Sire"
            name="A retired rooster"
            meta="Gen 0 · stats now open"
            sprite={<BirdSprite sex="male" baseCoat="Grey" trimColor="Red" size={48} />}
          />
          <BirdCard
            role="Dam"
            name="A retired hen"
            meta="Gen 0 · stats now open"
            sprite={<BirdSprite sex="female" baseCoat="Brown" trimColor="Blue" size={48} />}
          />
        </div>
        <span className="arrow" aria-hidden>
          →
        </span>
        <BirdCard
          role="Their chick"
          name="Your first Gen 1"
          meta="Starts at their average · stats hidden"
          sprite={<CoatEgg baseCoat="Grey" size={72} />}
          star
        />
      </div>
      <p className="claim">
        How a line grows. When the first birds in this world retire and breed, a real family from
        the stud book shows here.
      </p>
    </>
  );
}

function BirdCard({
  role,
  name,
  meta,
  sprite,
  star,
}: {
  role: string;
  name: string;
  meta: string;
  sprite: ReactNode;
  star?: boolean;
}) {
  return (
    <div className={star ? "bird-card star" : "bird-card"}>
      <span className="sprite">{sprite}</span>
      <span className="who">
        <span className="role">{role}</span>
        <b>{name}</b>
        {meta}
      </span>
    </div>
  );
}
