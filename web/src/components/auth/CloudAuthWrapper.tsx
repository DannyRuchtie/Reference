"use client";

import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./AuthProvider";
import { LoginForm } from "./LoginForm";

function CloudModeContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"local" | "cloud" | null>(null);
  const [checkingMode, setCheckingMode] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: { settings: { mode?: string } }) => {
        setMode((data.settings.mode as "local" | "cloud") ?? "local");
        setCheckingMode(false);
      })
      .catch(() => {
        setMode("local");
        setCheckingMode(false);
      });
  }, []);

  if (checkingMode) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-400">Loading...</div>;
  }

  if (mode === "cloud") {
    if (loading) {
      return <div className="flex min-h-screen items-center justify-center text-zinc-400">Loading...</div>;
    }
    if (!user) {
      return <LoginForm />;
    }
  }

  return <>{children}</>;
}

export function CloudAuthWrapper({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<"local" | "cloud" | null>(null);
  const [checkingMode, setCheckingMode] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: { settings: { mode?: string } }) => {
        setMode((data.settings.mode as "local" | "cloud") ?? "local");
        setCheckingMode(false);
      })
      .catch(() => {
        setMode("local");
        setCheckingMode(false);
      });
  }, []);

  if (checkingMode) {
    return <div className="flex min-h-screen items-center justify-center text-zinc-400">Loading...</div>;
  }

  if (mode === "cloud") {
    return (
      <AuthProvider>
        <CloudModeContent>{children}</CloudModeContent>
      </AuthProvider>
    );
  }

  return <>{children}</>;
}

