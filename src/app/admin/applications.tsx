"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * The alpha's queue, steward view. The office page only renders this when
 * the request carried a valid steward key (see app/doors.ts), because these
 * rows hold contact details and claim links; the public office gets a count.
 */
export interface ApplicationRowUI {
  id: number;
  createdAt: string;
  farmName: string;
  handler: string;
  contact: string;
  country: string | null;
  colors: string;
  background: string | null;
  status: "pending" | "approved" | "declined";
  claimUrl: string | null;
  claimedAt: string | null;
}

export function Applications({
  rows,
  stewardKey,
}: {
  rows: ApplicationRowUI[];
  stewardKey: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function decide(id: number, verdict: "approve" | "decline") {
    setBusy(id);
    setNote(null);
    try {
      const res = await fetch(`/api/alpha/applications/${id}/${verdict}`, {
        method: "POST",
        headers: stewardKey ? { "x-steward-key": stewardKey } : {},
      });
      const body = (await res.json()) as { error?: string; claimUrl?: string };
      if (!res.ok) {
        setNote(`✗ ${body.error ?? `${verdict} failed`}`);
        return;
      }
      setNote(
        body.claimUrl
          ? `Approved. Send the player this link: ${body.claimUrl}`
          : `Application #${id} declined.`
      );
      router.refresh();
    } catch (err) {
      setNote(`✗ ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) return <p className="cardsum">No applications yet.</p>;

  return (
    <section className="apps">
      {note && <p className="apps-note">{note}</p>}
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>applied</th>
            <th>farm</th>
            <th>handler</th>
            <th>contact</th>
            <th>background</th>
            <th>status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{a.id}</td>
              <td>{a.createdAt.slice(0, 16).replace("T", " ")}</td>
              <td>
                {a.country ? `${a.country} ` : ""}
                <b>{a.farmName}</b>
                <div className="dim">{a.colors}</div>
              </td>
              <td>{a.handler}</td>
              <td>{a.contact}</td>
              <td className="apps-bg">{a.background ?? ""}</td>
              <td>
                {a.status}
                {a.status === "approved" && (
                  <div className="dim">
                    {a.claimedAt ? "welcome page opened" : "not opened yet"}
                  </div>
                )}
              </td>
              <td>
                {a.status === "pending" && (
                  <>
                    <button disabled={busy !== null} onClick={() => decide(a.id, "approve")}>
                      Approve
                    </button>{" "}
                    <button disabled={busy !== null} onClick={() => decide(a.id, "decline")}>
                      Decline
                    </button>
                  </>
                )}
                {a.claimUrl && (
                  <button onClick={() => navigator.clipboard.writeText(a.claimUrl ?? "")}>
                    Copy claim link
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
