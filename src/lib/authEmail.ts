/** Normalize email for Supabase (trim + lowercase). */
export function normalizeAuthEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Map Supabase auth errors to clearer user-facing messages. */
export function formatAuthErrorMessage(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login credentials") || m.includes("invalid_credentials")) {
    return "Wrong email or password — or your email is not confirmed yet. Try “Resend confirmation” below, or reset your password.";
  }
  if (m.includes("email not confirmed")) {
    return "Confirm your email first (check inbox/spam), or use “Resend confirmation” below.";
  }
  if (m.includes("user already registered") || m.includes("already been registered")) {
    return "An account with this email already exists. Switch to Sign in.";
  }
  return message;
}
