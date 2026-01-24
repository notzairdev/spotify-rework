"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuthCallback } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";

export default function CallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { processCallback, isProcessing, error } = useAuthCallback();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");

  useEffect(() => {
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const errorParam = searchParams.get("error");

    // Handle Spotify error response
    if (errorParam) {
      setStatus("error");
      return;
    }

    // Missing required params
    if (!code || !state) {
      setStatus("error");
      return;
    }

    // Process the callback
    processCallback(code, state)
      .then(() => {
        setStatus("success");
        // Redirect to home after successful login
        setTimeout(() => {
          router.push("/home");
        }, 1500);
      })
      .catch(() => {
        setStatus("error");
      });
  }, [searchParams, processCallback, router]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center gap-4 py-12">
          {status === "processing" && (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <h2 className="text-xl font-semibold">Signing in...</h2>
              <p className="text-center text-muted-foreground">
                Please wait while we complete your login
              </p>
            </>
          )}

          {status === "success" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/20">
                <CheckIcon className="h-6 w-6 text-green-500" />
              </div>
              <h2 className="text-xl font-semibold">Success!</h2>
              <p className="text-center text-muted-foreground">
                You're now signed in. Redirecting...
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/20">
                <XIcon className="h-6 w-6 text-destructive" />
              </div>
              <h2 className="text-xl font-semibold">Sign in failed</h2>
              <p className="text-center text-muted-foreground">
                {error?.message || searchParams.get("error") || "An error occurred during sign in"}
              </p>
              <button
                onClick={() => router.push("/")}
                className="mt-4 text-primary hover:underline"
              >
                Return to home
              </button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
