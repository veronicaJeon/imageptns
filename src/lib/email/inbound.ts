export const PUBLIC_CONTACT_EMAIL = "contact@imagepartners.kr";
export const DEFAULT_OPS_EMAIL = "imgptns@gmail.com";

function extractAddress(value: string) {
  return (value.match(/<([^>]+)>/)?.[1] ?? value).trim().toLowerCase();
}

export function isPublicContactRecipient(value: string) {
  return extractAddress(value) === PUBLIC_CONTACT_EMAIL;
}

export function eventTargetsPublicContact(event: {
  to?: string[];
  received_for?: string[];
}) {
  return [...(event.to ?? []), ...(event.received_for ?? [])].some(isPublicContactRecipient);
}

export function inboundForwardIdempotencyKey(emailId: string) {
  return `inbound-contact-forward/${emailId}`;
}
