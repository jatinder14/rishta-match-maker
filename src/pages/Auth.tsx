import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Heart } from "lucide-react";
import { formatAuthErrorMessage, normalizeAuthEmail } from "@/lib/authEmail";

type OAuthProvider = "google" | "apple" | "facebook";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [secondaryBusy, setSecondaryBusy] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("intent") === "register") {
      setIsLogin(false);
    }
  }, [searchParams]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail) {
      toast.error("Enter a valid email address.");
      return;
    }
    setLoading(true);

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) {
        toast.error(formatAuthErrorMessage(error.message));
      } else {
        navigate("/dashboard");
      }
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) {
        toast.error(formatAuthErrorMessage(error.message));
      } else if (data.session) {
        toast.success("You're signed in.");
        navigate("/dashboard");
      } else {
        toast.success("Account created. If email confirmation is on, check your inbox (and spam), then sign in.");
      }
    }
    setLoading(false);
  };

  const resendConfirmation = async () => {
    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail) {
      toast.error("Enter your email above first.");
      return;
    }
    setSecondaryBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: { emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setSecondaryBusy(false);
    if (error) toast.error(formatAuthErrorMessage(error.message));
    else toast.success("Confirmation email sent. Check spam if you do not see it.");
  };

  const sendPasswordReset = async () => {
    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail) {
      toast.error("Enter your email above first.");
      return;
    }
    setSecondaryBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/auth`,
    });
    setSecondaryBusy(false);
    if (error) toast.error(formatAuthErrorMessage(error.message));
    else {
      toast.success("Password reset link sent. Open it from the same device; add this URL to Supabase Auth redirect URLs if needed.");
    }
  };

  const signInWithOAuth = async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    });
    if (error) {
      toast.error(error.message);
      setOauthLoading(null);
      return;
    }
    if (data.url) {
      window.location.assign(data.url);
    } else {
      setOauthLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-2">
            <Heart className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Rishte Wale Sardarji</h1>
          <p className="text-muted-foreground">Matrimonial Profile Manager</p>
        </div>

        <Card className="shadow-[var(--shadow-elevated)]">
          <CardHeader>
            <CardTitle className="text-xl">{isLogin ? "Welcome Back" : "Create Account"}</CardTitle>
            <CardDescription>
              {isLogin
                ? "Use the same email as in Supabase → Authentication → Users. If sign-in fails, confirm your email or use the links below."
                : "Sign up to get started"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button
                type="button"
                variant="outline"
                disabled={!!oauthLoading}
                onClick={() => void signInWithOAuth("google")}
              >
                {oauthLoading === "google" ? "Redirecting…" : "Google"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!!oauthLoading}
                onClick={() => void signInWithOAuth("apple")}
              >
                {oauthLoading === "apple" ? "Redirecting…" : "Apple"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={!!oauthLoading}
                onClick={() => void signInWithOAuth("facebook")}
              >
                {oauthLoading === "facebook" ? "Redirecting…" : "Facebook"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Enable each provider in Supabase Auth → Providers, and add this site URL to redirect allow list.
            </p>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or use email</span>
              </div>
            </div>

            <form onSubmit={handleAuth} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || secondaryBusy || !!oauthLoading}>
                {loading ? "Please wait..." : isLogin ? "Sign In" : "Sign Up"}
              </Button>
            </form>
            {isLogin && (
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-muted-foreground h-auto py-0"
                  disabled={secondaryBusy || loading || !!oauthLoading}
                  onClick={() => void resendConfirmation()}
                >
                  Resend confirmation email
                </Button>
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  className="text-muted-foreground h-auto py-0"
                  disabled={secondaryBusy || loading || !!oauthLoading}
                  onClick={() => void sendPasswordReset()}
                >
                  Forgot password?
                </Button>
              </div>
            )}
            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setIsLogin(!isLogin)}
                className="text-primary hover:underline"
              >
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
