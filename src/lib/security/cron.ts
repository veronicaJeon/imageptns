type AuthorizedCronRequest = {
  authorized: true;
};

type UnauthorizedCronRequest = {
  authorized: false;
  status: 401 | 503;
  error: string;
};

export type CronAuthorizationResult = AuthorizedCronRequest | UnauthorizedCronRequest;

export function authorizeCronRequest(headers: Headers, cronSecret = process.env.CRON_SECRET): CronAuthorizationResult {
  if (!cronSecret) {
    return { authorized: false, status: 503, error: "CRON_SECRET is not configured" };
  }

  if (headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return { authorized: false, status: 401, error: "Unauthorized" };
  }

  return { authorized: true };
}
