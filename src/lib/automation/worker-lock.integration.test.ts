import { afterEach, describe, expect, it } from "vitest";
import { db } from "../db";
import {
  acquireAutomationWorkerLock,
  releaseAutomationWorkerLock,
} from "./worker-lock";

const describeDb = process.env.RUN_DB_TESTS === "1" ? describe : describe.skip;
const organizations: string[] = [];

describeDb("automation worker lock integration", () => {
  afterEach(async () => {
    if (organizations.length === 0) return;
    await db.organization.deleteMany({
      where: { id: { in: organizations.splice(0) } },
    });
  });

  it("permite somente um worker por organização", async () => {
    const organization = await db.organization.create({
      data: { name: "Automation Worker Lock Test" },
    });
    organizations.push(organization.id);

    const first = await acquireAutomationWorkerLock(organization.id);
    const second = await acquireAutomationWorkerLock(organization.id);

    expect(first).toEqual(expect.any(String));
    expect(second).toBeNull();

    if (!first) throw new Error("Lock esperado no teste.");
    expect(await releaseAutomationWorkerLock(organization.id, first)).toBe(true);

    expect(await acquireAutomationWorkerLock(organization.id)).toEqual(expect.any(String));
  });

  it("não permite que o dono antigo libere um lock assumido após expiração", async () => {
    const organization = await db.organization.create({
      data: { name: "Automation Worker Stale Lock Test" },
    });
    organizations.push(organization.id);

    const oldToken = await acquireAutomationWorkerLock(organization.id);
    if (!oldToken) throw new Error("Lock inicial esperado no teste.");

    await db.organization.update({
      where: { id: organization.id },
      data: {
        automationLockedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    });

    const newToken = await acquireAutomationWorkerLock(organization.id, {
      staleMinutes: 15,
    });

    expect(newToken).toEqual(expect.any(String));
    expect(newToken).not.toBe(oldToken);
    expect(await releaseAutomationWorkerLock(organization.id, oldToken)).toBe(false);

    if (!newToken) throw new Error("Novo lock esperado no teste.");
    expect(await releaseAutomationWorkerLock(organization.id, newToken)).toBe(true);
  });
});
