/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
  /** Stripe Payment Link or Checkout URL for ₹499/month subscription */
  readonly VITE_STRIPE_SUBSCRIPTION_CHECKOUT_URL?: string;
  /** Override default desk email (default: rishtewalesardarji@gmail.com) */
  readonly VITE_DEFAULT_APP_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
