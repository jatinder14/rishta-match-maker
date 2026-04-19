/** Official Rishte Wale Sardarji desk email (support, sign-in default, footer). Override with `VITE_DEFAULT_APP_EMAIL`. */
export function defaultAppEmail(): string {
  const fromEnv = (import.meta.env.VITE_DEFAULT_APP_EMAIL as string | undefined)?.trim();
  return fromEnv || "rishtewalesardarji@gmail.com";
}
