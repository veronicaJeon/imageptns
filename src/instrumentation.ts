import type { Instrumentation } from "next";
import { recordOperationalEvent } from "@/lib/monitoring/events";

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const normalizedError = error instanceof Error ? error : new Error(String(error));
  const digest = typeof error === "object" && error && "digest" in error && typeof error.digest === "string"
    ? error.digest
    : null;
  await recordOperationalEvent({
    eventType: "request_error",
    component: "application",
    status: "error",
    route: context.routePath || request.path.split("?")[0],
    statusCode: 500,
    errorCode: digest || normalizedError.name,
    message: normalizedError.message,
    metadata: {
      method: request.method,
      routeType: context.routeType,
      routerKind: context.routerKind,
    },
  });
};
