export interface ContactEmailPayload {
  name: string;
  email: string;
  subject: string;
  message: string;
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
