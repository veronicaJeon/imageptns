export interface ContactEmailPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface PhotoRequestInviteEmailPayload {
  photographerEmail: string;
  photographerName: string;
  requestId: string;
  requestTitle: string;
  locationLabel: string | null;
  usageProject?: string | null;
  usageContext?: string | null;
  deadlineAt: string | null;
  budgetLabel: string | null;
}

interface ContactEmailSenders {
  sendConfirmation(payload: Pick<ContactEmailPayload, "name" | "email" | "subject">): Promise<void>;
  notifyOps(payload: ContactEmailPayload): Promise<void>;
}

export async function sendContactEmails(
  payload: ContactEmailPayload,
  senders: ContactEmailSenders,
) {
  const results = await Promise.allSettled([
    senders.sendConfirmation({
      name: payload.name,
      email: payload.email,
      subject: payload.subject,
    }),
    senders.notifyOps(payload),
  ]);

  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      "Contact email delivery failed",
    );
  }
}

export async function sendPhotoRequestInviteEmails(
  payloads: PhotoRequestInviteEmailPayload[],
  sendInvite: (payload: PhotoRequestInviteEmailPayload) => Promise<void>,
) {
  const results = await Promise.allSettled(
    payloads.map((payload) => sendInvite(payload)),
  );

  const failures = results.filter((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failures.length > 0) {
    throw new AggregateError(
      failures.map((failure) => failure.reason),
      "Photo request invite email delivery failed",
    );
  }
}
