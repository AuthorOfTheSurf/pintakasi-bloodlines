import { desc, eq } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import type { DB } from "@/db/client";
import { alphaApplications, farms, type AlphaApplicationRow, type FarmRow } from "@/db/schema";
import { seedStarterFlock } from "@/db/seed-data";
import { APPLICATION_LIMITS, type FarmColor } from "./config";
import { Farms, assertFarmColors, farmNameTaken, type FarmView } from "./farms";
import { freshSeed } from "./rng";

/**
 * THE ALPHA'S FRONT DOOR (2026-10). Production registration is closed: a
 * person applies, the owner takes the buy-in off-platform, and a steward's
 * approval is what creates the farm. This module is the whole state machine.
 *
 *   pending ──approve──▶ approved   (farm created, claim token minted)
 *      └─────decline──▶ declined
 *
 * Both ends are final. A declined applicant who comes back applies again, so
 * the record of the first answer survives.
 */
export type ApplicationStatus = AlphaApplicationRow["status"];

const NEXT: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  pending: ["approved", "declined"],
  approved: [],
  declined: [],
};

export interface ApplyInput {
  farmName: string;
  handler: string;
  contact: string;
  country?: string;
  primaryColor: string;
  secondaryColor: string;
  background?: string;
}

export interface Approval {
  application: AlphaApplicationRow;
  farm: FarmView;
  apiKey: string;
  claimToken: string;
}

function required(label: string, value: string, max: number): string {
  const v = value.trim();
  if (!v) throw new Error(`${label} is required`);
  if (v.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return v;
}

function optional(label: string, value: string | undefined, max: number): string | null {
  const v = value?.trim() ?? "";
  if (v.length > max) throw new Error(`${label} must be ${max} characters or fewer`);
  return v || null;
}

export class Alpha {
  constructor(private database: DB) {}

  apply(input: ApplyInput): AlphaApplicationRow {
    const farmName = required("Farm name", input.farmName, APPLICATION_LIMITS.farmName);
    const handler = required("Your name", input.handler, APPLICATION_LIMITS.handler);
    const contact = required("A way to reach you", input.contact, APPLICATION_LIMITS.contact);
    const country = optional("Country", input.country, APPLICATION_LIMITS.country);
    const background = optional("Background", input.background, APPLICATION_LIMITS.background);
    assertFarmColors(input.primaryColor, input.secondaryColor);
    // Pending applications hold their name too: two people applying as the
    // same farm would leave the second approval failing for a reason neither
    // could see when they applied.
    if (farmNameTaken(this.database, farmName) || this.pendingNameTaken(farmName))
      throw new Error(`The farm name "${farmName}" is already taken`);

    return this.database
      .insert(alphaApplications)
      .values({
        createdAt: new Date().toISOString(),
        farmName,
        handler,
        contact,
        country,
        primaryColor: input.primaryColor,
        secondaryColor: input.secondaryColor,
        background,
      })
      .returning()
      .get();
  }

  /**
   * Creates the farm through the same two calls the old open door made, so
   * the starting stake comes from the one existing faucet and the GP proof
   * holds. One transaction: if the name was taken between apply and approve,
   * register throws, nothing is written, and the application stays pending.
   */
  approve(id: number): Approval {
    return this.database.transaction((): Approval => {
      const app = this.move(id, "approved");
      const { farm, apiKey } = new Farms(this.database).register({
        name: app.farmName,
        country: app.country ?? undefined,
        primaryColor: app.primaryColor as FarmColor,
        secondaryColor: app.secondaryColor as FarmColor,
        handler: app.handler,
      });
      seedStarterFlock(this.database, farm.id, { seed: freshSeed() });
      // 256 bits: the token is a bearer credential for the farm key, so it
      // gets the key's strength or better, never a guessable counter.
      const claimToken = randomBytes(32).toString("base64url");
      const application = this.database
        .update(alphaApplications)
        .set({
          status: "approved",
          farmId: farm.id,
          claimToken,
          decidedAt: new Date().toISOString(),
        })
        .where(eq(alphaApplications.id, id))
        .returning()
        .get();
      return { application, farm, apiKey, claimToken };
    }) as Approval;
  }

  decline(id: number): AlphaApplicationRow {
    this.move(id, "declined");
    return this.database
      .update(alphaApplications)
      .set({ status: "declined", decidedAt: new Date().toISOString() })
      .where(eq(alphaApplications.id, id))
      .returning()
      .get();
  }

  /** The welcome page's lookup. Only an approved application has a token. */
  byClaimToken(token: string): { application: AlphaApplicationRow; farm: FarmRow } | null {
    if (!token) return null;
    const application = this.database
      .select()
      .from(alphaApplications)
      .where(eq(alphaApplications.claimToken, token))
      .get();
    if (!application?.farmId) return null;
    const farm = this.database.select().from(farms).where(eq(farms.id, application.farmId)).get();
    return farm ? { application, farm } : null;
  }

  /** Stamps the first view of the welcome page; later views leave it alone. */
  markClaimed(id: number): void {
    const app = this.get(id);
    if (app.claimedAt) return;
    this.database
      .update(alphaApplications)
      .set({ claimedAt: new Date().toISOString() })
      .where(eq(alphaApplications.id, id))
      .run();
  }

  list(): AlphaApplicationRow[] {
    return this.database.select().from(alphaApplications).orderBy(desc(alphaApplications.id)).all();
  }

  private get(id: number): AlphaApplicationRow {
    const app = this.database
      .select()
      .from(alphaApplications)
      .where(eq(alphaApplications.id, id))
      .get();
    if (!app) throw new Error(`No application #${id}`);
    return app;
  }

  private move(id: number, to: ApplicationStatus): AlphaApplicationRow {
    const app = this.get(id);
    if (!NEXT[app.status].includes(to))
      throw new Error(`Application #${id} is already ${app.status}; it cannot become ${to}`);
    return app;
  }

  private pendingNameTaken(name: string): boolean {
    const wanted = name.toLowerCase();
    return this.database
      .select({ farmName: alphaApplications.farmName })
      .from(alphaApplications)
      .where(eq(alphaApplications.status, "pending"))
      .all()
      .some((a) => a.farmName.toLowerCase() === wanted);
  }
}
