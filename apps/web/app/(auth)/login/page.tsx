"use client";

import { useState } from "react";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sparkles, Mail, Shield, Zap, MessageSquare } from "lucide-react";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setError(null);

    try {
      await signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred during sign in"
      );
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen">
      {/* Theme toggle */}
      <div className="absolute top-4 right-4 z-10">
        <ThemeToggle />
      </div>
      
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-primary/10" />
      
      {/* Decorative elements */}
      <div className="absolute top-20 left-20 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
      <div className="absolute bottom-20 right-20 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

      {/* Left side - Branding */}
      <div className="relative hidden w-1/2 flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-semibold">AI Chat</span>
        </div>

        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight">
              Your intelligent
              <br />
              <span className="text-primary">conversation partner</span>
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-md">
              Connect your Google account to unlock powerful AI assistance with access to your contacts and emails.
            </p>
          </div>

          <div className="space-y-4">
            <FeatureItem
              icon={<MessageSquare className="h-5 w-5" />}
              title="Smart Conversations"
              description="Natural language AI that remembers context"
            />
            <FeatureItem
              icon={<Mail className="h-5 w-5" />}
              title="Email Integration"
              description="Search and summarize your Gmail inbox"
            />
            <FeatureItem
              icon={<Shield className="h-5 w-5" />}
              title="Secure & Private"
              description="Your data stays protected with OAuth 2.0"
            />
            <FeatureItem
              icon={<Zap className="h-5 w-5" />}
              title="Real-time Streaming"
              description="Watch responses appear as they're generated"
            />
          </div>
        </div>
      </div>

      {/* Right side - Login form */}
      <div className="relative flex w-full items-center justify-center p-8 lg:w-1/2">
        <div className="w-full max-w-md">
          {/* Mobile logo */}
          <div className="mb-8 flex items-center justify-center gap-3 lg:hidden">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-semibold">AI Chat</span>
          </div>

          {/* Login card */}
          <div className="glass rounded-2xl border border-border/50 p-8 shadow-xl">
            <div className="mb-8 text-center">
              <h2 className="text-2xl font-bold">Welcome back</h2>
              <p className="mt-2 text-muted-foreground">
                Sign in to continue to your AI assistant
              </p>
            </div>

            {error && (
              <div className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
                <p className="font-medium">Sign in failed</p>
                <p className="mt-1 text-destructive/80">{error}</p>
              </div>
            )}

            <Button
              onClick={handleGoogleSignIn}
              disabled={isLoading}
              variant="outline"
              className="w-full h-12 text-base font-medium border-2 hover:bg-accent transition-all duration-200"
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <LoadingSpinner />
                  Connecting...
                </span>
              ) : (
                <span className="flex items-center gap-3">
                  <GoogleIcon />
                  Continue with Google
                </span>
              )}
            </Button>

            <div className="mt-6 flex items-center gap-4">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              By continuing, you agree to our{" "}
              <a href="#" className="text-primary hover:underline">
                Terms of Service
              </a>{" "}
              and{" "}
              <a href="#" className="text-primary hover:underline">
                Privacy Policy
              </a>
            </p>
          </div>

          {/* Trust badges */}
          <div className="mt-8 flex items-center justify-center gap-6 text-muted-foreground">
            <div className="flex items-center gap-2 text-xs">
              <Shield className="h-4 w-4" />
              <span>Secure login</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <Zap className="h-4 w-4" />
              <span>Fast & reliable</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}
