"use client";

import { useEffect, useRef, useState } from "react";
import { FightViewer } from "../admin/fight-viewer";
import { BirdSprite } from "../admin/sprites";
import type { WatchableReplay } from "./exhibition";

/**
 * The featured fight, held as a poster until it is on screen. FightViewer
 * starts playing the moment it mounts, so mounting it at page load would run
 * the whole fight above the fold-line while the reader is still on the hero.
 * It mounts when the section scrolls into view (which is what the hero's
 * "Watch a fight" link does) or when the poster is clicked.
 */
// Only what the viewer draws. The transcript stays on the server, since it
// would otherwise ride along in the page payload unread.
export function Watch({
  replay,
}: {
  replay: Pick<WatchableReplay, "timeline" | "looks" | "stables">;
}) {
  const [rolling, setRolling] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // The hero's button is a plain "#watch" link, so arriving by it is a hash,
  // and that alone starts the fight. Scrolling down to it gets the observer.
  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === "#watch") setRolling(true);
    };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el || rolling) return;
    const seen = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setRolling(true);
      },
      { threshold: 0.6 }
    );
    seen.observe(el);
    return () => seen.disconnect();
  }, [rolling]);

  if (rolling)
    return (
      <div className="pit">
        <FightViewer timeline={replay.timeline} looks={replay.looks} stables={replay.stables} />
      </div>
    );

  const [a, b] = replay.timeline.corners;
  return (
    <div ref={ref} className="pit">
      <button className="poster" onClick={() => setRolling(true)}>
        <span className="poster-birds">
          <BirdSprite {...replay.looks[0]} size={72} />
          <span className="vs">vs</span>
          <span className="flip">
            <BirdSprite {...replay.looks[1]} size={72} />
          </span>
        </span>
        <span className="poster-names">
          {a.name} vs {b.name}
        </span>
        <span className="btn">▶ Play the fight</span>
      </button>
    </div>
  );
}
