import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { db } from "@/db/client";
import { Farms } from "@/engine/farms";
import { FARM_COOKIE } from "../session";
import { farmPageData } from "./data";
import { FarmApp } from "./farm-app";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Your farm · Pintakasi",
  robots: { index: false, follow: false },
};

/** What a failed sign-in says, keyed by the `?signin=` the session route sends back. */
const SIGNIN_ERRORS: Record<string, string> = {
  empty: "Paste your farm key first.",
  unknown: "That key does not open any farm. Check it and try again.",
};

/**
 * The farm page. The cookie is the only door: no cookie, or a key that no
 * longer opens a farm, gets the sign-in form and nothing else. There is no
 * sole-farm shortcut here (the API keeps one for local dev), because on a
 * page the shortcut would hand a stranger the only farm in a fresh world.
 */
export default async function FarmPage({
  searchParams,
}: {
  searchParams: Promise<{ signin?: string }>;
}) {
  const key = (await cookies()).get(FARM_COOKIE)?.value;
  const database = db();
  let farmId: string | null = null;
  if (key) {
    try {
      farmId = new Farms(database).byKey(key).id;
    } catch {
      farmId = null;
    }
  }
  if (!farmId) {
    const { signin } = await searchParams;
    // Called, not mounted, so the form is plain markup in the tree the server sends.
    return signInForm(signin ? (SIGNIN_ERRORS[signin] ?? null) : null);
  }
  return <FarmApp data={farmPageData(database, farmId)} />;
}

function signInForm(error: string | null) {
  return (
    <main className="signin">
      <h1>Open your farm</h1>
      <p>
        Paste the farm key from your welcome page. It starts with <code>fk_</code>. This browser
        will remember it until you sign out.
      </p>
      <form method="post" action="/api/session" className="signin-form">
        <label htmlFor="farm-key">Farm key</label>
        <input
          id="farm-key"
          name="key"
          type="password"
          autoComplete="current-password"
          required
          spellCheck={false}
        />
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn">
          Open my farm
        </button>
      </form>
      <p className="dim">
        No farm yet? <Link href="/join">Apply for the alpha</Link>. New to the game? Read{" "}
        <Link href="/wiki">the Handbook</Link>.
      </p>
    </main>
  );
}
