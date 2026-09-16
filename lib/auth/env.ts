/** Environment lookups. Secrets are read here and nowhere else. */

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

/** Public https origin of this deployment, no trailing slash. */
export function baseUrl(): string {
  const explicit = process.env.PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (vercel) return `https://${vercel}`;
  return "http://localhost:3000";
}

export const RESOURCE_PATH = "/api/mcp";
export const SCOPE = "fantasy:read";
