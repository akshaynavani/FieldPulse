/**
 * Seed a demo team: one manager, two reps, Bay Area accounts with contacts, a mix of
 * scheduled/completed visits and deals across every stage. Safe to re-run: it exits
 * early if the demo manager already exists.
 */
import { loadConfig } from "../src/config.js";
import { createPool } from "../src/db.js";
import { PgRepository } from "../src/repositories/pg.js";
import { hashPassword } from "../src/services/passwords.js";
import type { DealStage } from "@fieldpulse/contracts";

const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? "fieldpulse-demo";

const ACCOUNTS = [
  { name: "Golden Gate Grocers", industry: "Grocery", tier: "A", address: "2100 Market St, San Francisco", lat: 37.7671, lng: -122.4294 },
  { name: "Mission Hardware Co", industry: "Hardware", tier: "B", address: "3150 18th St, San Francisco", lat: 37.7618, lng: -122.4148 },
  { name: "Bayview Logistics", industry: "Logistics", tier: "A", address: "1500 Evans Ave, San Francisco", lat: 37.7406, lng: -122.3853 },
  { name: "Oakland Fresh Market", industry: "Grocery", tier: "B", address: "4000 Broadway, Oakland", lat: 37.8286, lng: -122.2559 },
  { name: "Berkeley Bikes", industry: "Retail", tier: "C", address: "2400 Shattuck Ave, Berkeley", lat: 37.8653, lng: -122.2675 },
  { name: "Peninsula Pharmacy", industry: "Healthcare", tier: "A", address: "800 El Camino Real, San Mateo", lat: 37.5630, lng: -122.3255 },
  { name: "Sausalito Marine Supply", industry: "Marine", tier: "C", address: "300 Harbor Dr, Sausalito", lat: 37.8655, lng: -122.4950 },
  { name: "Daly City Diner Group", industry: "Hospitality", tier: "B", address: "100 Serramonte Center, Daly City", lat: 37.6716, lng: -122.4703 },
] as const;

const DEALS: { title: string; amount: number; stage: DealStage; account: number; closeInDays: number }[] = [
  { title: "Cold-chain sensors pilot", amount: 4_500_000, stage: "prospecting", account: 0, closeInDays: 60 },
  { title: "POS refresh — 12 lanes", amount: 9_800_000, stage: "qualified", account: 0, closeInDays: 35 },
  { title: "Inventory scanners", amount: 2_200_000, stage: "proposal", account: 1, closeInDays: 20 },
  { title: "Fleet telematics", amount: 15_000_000, stage: "negotiation", account: 2, closeInDays: 12 },
  { title: "Self-checkout kiosks", amount: 6_400_000, stage: "proposal", account: 3, closeInDays: 40 },
  { title: "Rental fleet tracking", amount: 1_200_000, stage: "closed_won", account: 4, closeInDays: -5 },
  { title: "Rx label printers", amount: 3_300_000, stage: "closed_won", account: 5, closeInDays: -12 },
  { title: "Dock inventory", amount: 900_000, stage: "closed_lost", account: 6, closeInDays: -20 },
  { title: "Kitchen display systems", amount: 5_100_000, stage: "negotiation", account: 7, closeInDays: 25 },
];

const day = 86_400_000;
const isoDate = (d: Date) => d.toISOString().slice(0, 10);

async function main() {
  const config = loadConfig();
  const pool = createPool(config.DATABASE_URL, config.DATABASE_SSL);
  const repo = new PgRepository(pool);

  try {
    if (await repo.findUserByEmail("manager@fieldpulse.dev")) {
      console.info("seed data already present; skipping");
      return;
    }
    const passwordHash = await hashPassword(DEMO_PASSWORD);

    await repo.createUser({
      email: "manager@fieldpulse.dev",
      name: "Morgan Manager",
      role: "manager",
      territory: "Bay Area",
      quarterlyQuotaCents: 60_000_000,
      passwordHash,
    });
    const riley = await repo.createUser({
      email: "riley@fieldpulse.dev",
      name: "Riley Rep",
      role: "rep",
      territory: "San Francisco",
      quarterlyQuotaCents: 30_000_000,
      passwordHash,
    });
    const sam = await repo.createUser({
      email: "sam@fieldpulse.dev",
      name: "Sam Seller",
      role: "rep",
      territory: "East Bay & Peninsula",
      quarterlyQuotaCents: 30_000_000,
      passwordHash,
    });

    const now = new Date();
    const accounts = [];
    for (const [i, a] of ACCOUNTS.entries()) {
      const owner = i % 2 === 0 ? riley : sam;
      const account = await repo.createAccount(owner.id, {
        name: a.name,
        industry: a.industry,
        tier: a.tier,
        address: a.address,
        location: { lat: a.lat, lng: a.lng },
      });
      await repo.addContact(account.id, {
        name: `Buyer at ${a.name.split(" ")[0]}`,
        title: "Purchasing Manager",
        email: `buyer${i}@example.com`,
        phone: `+1-415-555-01${String(i).padStart(2, "0")}`,
      });
      accounts.push(account);

      // One completed visit in the past for most accounts, one scheduled today.
      if (i % 3 !== 2) {
        const past = await repo.scheduleVisit(owner.id, {
          accountId: account.id,
          scheduledAt: new Date(now.getTime() - (10 + i * 7) * day).toISOString(),
          notes: "Quarterly check-in",
        });
        await repo.completeVisit(past.id, {
          completedAt: new Date(now.getTime() - (10 + i * 7) * day + 3_600_000).toISOString(),
          outcome: i % 2 === 0 ? "productive" : "follow_up_needed",
          notes: "Discussed upcoming needs",
          followUpAt: i % 2 === 0 ? null : new Date(now.getTime() - 2 * day).toISOString(),
          checkInLocation: { lat: a.lat, lng: a.lng },
        });
      }
      const today = new Date(now);
      today.setUTCHours(16 + (i % 6), 0, 0, 0);
      await repo.scheduleVisit(owner.id, {
        accountId: account.id,
        scheduledAt: today.toISOString(),
        notes: "",
      });
    }

    for (const d of DEALS) {
      const account = accounts[d.account]!;
      const deal = await repo.createDeal(account.ownerId, {
        accountId: account.id,
        title: d.title,
        amountCents: d.amount,
        currency: "USD",
        expectedCloseDate: isoDate(new Date(now.getTime() + d.closeInDays * day)),
      });
      if (d.stage !== "prospecting") {
        const closed = d.stage === "closed_won" || d.stage === "closed_lost";
        await repo.updateDeal(deal.id, {
          stage: d.stage,
          lostReason: d.stage === "closed_lost" ? "Went with incumbent vendor" : null,
          closedAt: closed ? new Date(now.getTime() + d.closeInDays * day) : null,
        });
      }
    }

    console.info(
      `seeded 3 users, ${accounts.length} accounts, ${DEALS.length} deals. ` +
        `Log in as riley@fieldpulse.dev / sam@fieldpulse.dev / manager@fieldpulse.dev`,
    );
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
