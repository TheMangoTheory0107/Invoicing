// Absolute base URL for links inside emails (invoice links, the payee-confirm link) — these go
// out to an inbox, so they can never be relative. Override with APP_URL if the deployment domain
// ever changes; defaults to the one actually in use so this works with zero extra setup.
export function appBaseUrl(): string {
  return process.env.APP_URL || "https://themangotheory-invoicing.vercel.app";
}
