export type OnchainEventSeverity = "info" | "warning" | "error";

export type OnchainEventType =
  | "checkout_prepare_created"
  | "checkout_confirmed"
  | "claim_confirmed"
  | "proof_registered"
  | "proof_registration_requested"
  | "proof_registration_batch_created"
  | "proof_arweave_uploaded"
  | "proof_arweave_confirmed"
  | "proof_registration_failed";

export interface OnchainEvent {
  eventType: OnchainEventType;
  severity?: OnchainEventSeverity;
  actorId?: string | null;
  orderId?: string | null;
  imageId?: string | null;
  txHash?: string | null;
  chainId?: number | null;
  metadata?: Record<string, unknown>;
}

interface OnchainEventInsertRow {
  event_type: OnchainEventType;
  severity: OnchainEventSeverity;
  actor_id: string | null;
  order_id: string | null;
  image_id: string | null;
  tx_hash: string | null;
  chain_id: number | null;
  metadata: Record<string, unknown>;
}

interface OnchainEventInsertResult {
  error: { message?: string } | Error | null;
}

export interface OnchainEventAdminClient {
  from(table: "onchain_events"): {
    insert(row: OnchainEventInsertRow): PromiseLike<OnchainEventInsertResult>;
  };
}

export async function recordOnchainEvent(
  admin: OnchainEventAdminClient,
  event: OnchainEvent,
) {
  try {
    const { error } = await admin.from("onchain_events").insert({
      event_type: event.eventType,
      severity: event.severity ?? "info",
      actor_id: event.actorId ?? null,
      order_id: event.orderId ?? null,
      image_id: event.imageId ?? null,
      tx_hash: event.txHash ?? null,
      chain_id: event.chainId ?? null,
      metadata: event.metadata ?? {},
    });

    if (error) {
      console.error("Failed to record onchain event", {
        eventType: event.eventType,
        error,
      });
    }
  } catch (error) {
    console.error("Failed to record onchain event", {
      eventType: event.eventType,
      error,
    });
  }
}
