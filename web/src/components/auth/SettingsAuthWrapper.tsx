"use client";

import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./AuthProvider";
import { LoginForm } from "./LoginForm";

function CloudSettingsContent({ children }: { children: React.ReactNode }) {
  // Always render children - auth is handled inline in CloudAuthSection
  // The AuthProvider is now available, so CloudAuthSection can use useAuth()
  return <>{children}</>;
}

export function SettingsAuthWrapper({ children }: { children: React.ReactNode }) {
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
        <CloudSettingsContent>{children}</CloudSettingsContent>
      </AuthProvider>
    );
  }

  return <>{children}</>;
}

