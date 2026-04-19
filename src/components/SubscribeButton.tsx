import { ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";

const CHECKOUT_URL = import.meta.env.VITE_STRIPE_SUBSCRIPTION_CHECKOUT_URL as string | undefined;

export function SubscribeButton({ className }: { className?: string }) {
  if (!CHECKOUT_URL) {
    return (
      <p className="text-xs text-muted-foreground">
        Add <code className="rounded bg-muted px-1">VITE_STRIPE_SUBSCRIPTION_CHECKOUT_URL</code> (Stripe Payment Link or
        Checkout URL for ₹499/month) to enable checkout.
      </p>
    );
  }

  return (
    <Button className={className} asChild>
      <a href={CHECKOUT_URL} target="_blank" rel="noopener noreferrer">
        Subscribe — ₹499 / month <ExternalLink className="ml-2 h-4 w-4" />
      </a>
    </Button>
  );
}
