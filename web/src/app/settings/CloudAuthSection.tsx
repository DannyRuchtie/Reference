"use client";

import { useEffect, useState, useContext } from "react";
import { InlineLoginForm } from "@/components/auth/InlineLoginForm";
import { AuthContext } from "@/components/auth/AuthProvider";

export function CloudAuthSection() {
  // Safely get auth context - returns undefined if not in provider
  const authContext = useContext(AuthContext);
  
  // If AuthProvider is not available, show a message
  if (!authContext) {
    return (
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
        Initializing Cloud (Pro) authentication...
      </div>
    );
  }
  
  const user = authContext.user;
  const loading = authContext.loading;
  const signOut = authContext.signOut;
  const [localProjectsCount, setLocalProjectsCount] = useState<number | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<string | null>(null);
  const [migrationError, setMigrationError] = useState<string | null>(null);

  useEffect(() => {
    // Check if there are local projects to migrate (only when authenticated)
    if (user && !loading) {
      // Check both local and cloud projects to see which local ones aren't migrated yet
      Promise.all([
        fetch("/api/projects?local=true").then((res) => res.json()),
        fetch("/api/projects").then((res) => res.json()),
      ])
        .then(([localData, cloudData]) => {
          const localProjects = (localData.projects || []) as Array<{ name: string }>;
          const cloudProjects = (cloudData.projects || []) as Array<{ name: string }>;
          const cloudProjectNames = new Set(cloudProjects.map((p) => p.name));
          // Only count local projects that don't have a matching name in cloud
          const unmigratedCount = localProjects.filter((p) => !cloudProjectNames.has(p.name)).length;
          setLocalProjectsCount(unmigratedCount);
        })
        .catch(() => setLocalProjectsCount(0));
    }
  }, [user, loading]);

  if (loading) {
    return (
      <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
        Checking authentication...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
          Cloud (Pro) mode requires authentication. Sign in with your Supabase account to access your projects, or switch back to Local mode.
        </div>
        <div className="rounded-lg border border-zinc-900 bg-zinc-950/50 p-4">
          <div className="mb-3 text-xs font-medium text-zinc-200">Sign in to Cloud (Pro)</div>
          <InlineLoginForm />
        </div>
      </div>
    );
  }

  const handleMigrate = async () => {
    setMigrating(true);
    setMigrationStatus(null);
    setMigrationError(null);
    try {
      const res = await fetch("/api/migration/to-cloud", { method: "POST" });
      const data = (await res.json()) as { message?: string; migrated?: number; errors?: string[] };
      if (!res.ok) throw new Error(data.message || "Migration failed");
      setMigrationStatus(
        `Successfully migrated ${data.migrated ?? 0} project(s).${data.errors?.length ? ` Some errors occurred: ${data.errors.join(", ")}` : ""}`
      );
      setLocalProjectsCount(0);
    } catch (err) {
      setMigrationError(err instanceof Error ? err.message : String(err));
    } finally {
      setMigrating(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-green-900/40 bg-green-950/20 px-3 py-2 text-xs text-green-200">
        Signed in as {user.email || "user"}
      </div>
      <button
        onClick={async () => {
          try {
            await signOut();
          } catch (err) {
            console.error("Sign out error:", err);
          }
        }}
        className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-xs text-zinc-300 hover:bg-zinc-900"
      >
        Sign Out
      </button>
      {localProjectsCount !== null && localProjectsCount > 0 && (
        <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-3">
          <div className="text-xs font-medium text-blue-200">Migrate Local Projects</div>
          <div className="mt-1 text-xs text-blue-300">
            You have {localProjectsCount} local project(s) that can be migrated to Cloud (Pro).
          </div>
          {migrationStatus && (
            <div className="mt-2 rounded-lg border border-green-900/40 bg-green-950/20 px-2 py-1 text-xs text-green-200">
              {migrationStatus}
            </div>
          )}
          {migrationError && (
            <div className="mt-2 rounded-lg border border-red-900/40 bg-red-950/20 px-2 py-1 text-xs text-red-200">
              {migrationError}
            </div>
          )}
          <button
            onClick={handleMigrate}
            disabled={migrating}
            className="mt-2 rounded-md border border-blue-800 bg-blue-950 px-3 py-2 text-xs text-blue-200 hover:bg-blue-900 disabled:opacity-50"
          >
            {migrating ? "Migrating..." : `Migrate ${localProjectsCount} Project(s)`}
          </button>
        </div>
      )}
    </div>
  );
}

