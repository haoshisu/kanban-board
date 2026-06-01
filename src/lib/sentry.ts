import * as Sentry from "@sentry/react";

export default function initSentry() {
 Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: false,
  environment: import.meta.env.MODE,
  beforeSend(event) {
   return event;
  },
 });
}
