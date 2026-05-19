import { describe, expect, it, vi } from "vitest";
import { recordOnchainEvent } from "./events";

function createAdminInsertResult(error: Error | null = null) {
  const insert = vi.fn().mockResolvedValue({ error });
  const from = vi.fn().mockReturnValue({ insert });

  return { admin: { from }, from, insert };
}

describe("recordOnchainEvent", () => {
  it("inserts a compact onchain event row with default info severity", async () => {
    const { admin, from, insert } = createAdminInsertResult();

    await recordOnchainEvent(admin, {
      eventType: "checkout_prepare_created",
      actorId: "8f6d1827-eb66-4d51-b725-0d65ff1d2838",
      orderId: "8ee466f6-77e3-49a7-8733-2393df6f313d",
      imageId: "5bbfacf5-8f84-4a29-812e-01c403a950da",
      txHash: "0x123",
      chainId: 8453,
      metadata: { itemCount: 2 },
    });

    expect(from).toHaveBeenCalledWith("onchain_events");
    expect(insert).toHaveBeenCalledWith({
      event_type: "checkout_prepare_created",
      severity: "info",
      actor_id: "8f6d1827-eb66-4d51-b725-0d65ff1d2838",
      order_id: "8ee466f6-77e3-49a7-8733-2393df6f313d",
      image_id: "5bbfacf5-8f84-4a29-812e-01c403a950da",
      tx_hash: "0x123",
      chain_id: 8453,
      metadata: { itemCount: 2 },
    });
  });

  it("logs insert failures without throwing", async () => {
    const { admin } = createAdminInsertResult(new Error("database unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(recordOnchainEvent(admin, {
      eventType: "checkout_confirmed",
      orderId: "8ee466f6-77e3-49a7-8733-2393df6f313d",
    })).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to record onchain event",
      expect.objectContaining({
        eventType: "checkout_confirmed",
        error: expect.any(Error),
      }),
    );

    consoleError.mockRestore();
  });

  it("logs unexpected failures without throwing", async () => {
    const admin = {
      from: vi.fn().mockImplementation(() => {
        throw new Error("client exploded");
      }),
    };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(recordOnchainEvent(admin, {
      eventType: "proof_registration_failed",
      severity: "error",
    })).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith(
      "Failed to record onchain event",
      expect.objectContaining({
        eventType: "proof_registration_failed",
        error: expect.any(Error),
      }),
    );

    consoleError.mockRestore();
  });
});
