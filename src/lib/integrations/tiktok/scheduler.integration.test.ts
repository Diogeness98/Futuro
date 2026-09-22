import { afterEach, describe, expect, it } from "vitest";
import { db } from "../../db";
import { catalogSyncDue } from "./scheduler";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const organizations: string[] = [];

describeDb("TikTok scheduler catalog cadence", () => {
  afterEach(async () => {
    if (organizations.length === 0) return;
    await db.organization.deleteMany({
      where: { id: { in: organizations.splice(0) } },
    });
  });

  it("considera catálogo vencido quando nunca houve sincronização", async () => {
    const organization = await db.organization.create({
      data: { name: "Catalog Cadence Test" },
    });
    organizations.push(organization.id);

    await expect(catalogSyncDue(
      organization.id,
      60,
      new Date("2026-09-22T12:00:00Z"),
    )).resolves.toBe(true);
  });

  it("respeita o intervalo desde a última sincronização bem-sucedida", async () => {
    const organization = await db.organization.create({
      data: { name: "Catalog Cadence Existing Test" },
    });
    organizations.push(organization.id);

    await db.activityLog.create({
      data: {
        organizationId: organization.id,
        actorType: "system",
        action: "integration.tiktok.products_synced",
        entityType: "Integration",
        createdAt: new Date("2026-09-22T11:30:00Z"),
      },
    });

    await expect(catalogSyncDue(
      organization.id,
      60,
      new Date("2026-09-22T12:00:00Z"),
    )).resolves.toBe(false);

    await expect(catalogSyncDue(
      organization.id,
      60,
      new Date("2026-09-22T12:31:00Z"),
    )).resolves.toBe(true);
  });
});
