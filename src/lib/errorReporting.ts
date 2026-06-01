import * as Sentry from "@sentry/react";

type ErrorContext = Record<string, boolean | number | string | null | undefined>;

export const captureAppError = (error: unknown, context: ErrorContext) => {
 Sentry.withScope((scope) => {
  if (context.area) {
   scope.setTag("area", String(context.area));
  }

  if (context.action) {
   scope.setTag("action", String(context.action));
  }

  scope.setContext("app", context);
  Sentry.captureException(error);
 });
};

export const setErrorReportingUser = (user: { id: string } | null) => {
 if (!user) {
  Sentry.setUser(null);
  return;
 }

 Sentry.setUser({
  id: user.id.startsWith("local-") ? "local-user" : user.id,
 });
};
