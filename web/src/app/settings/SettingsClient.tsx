"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { ROUTE_FADE_MS, dispatchRouteFadeEnd, dispatchRouteFadeStart } from "@/lib/routeFade";

type Settings = {
  ai: {
    endpoint?: string;
  };
};

type AiProgress = {
  counts: { pending: number; processing: number; done: number; failed: number; total: number };
  worker: {
    logAvailable: boolean;
    lastLogAt: string | null;
    currentAssetId: string | null;
    currentFile: string | null;
    recentLines: string[];
  };
};

type StationStatus = {
  endpoint: string;
  host: string;
  port: number;
  reachable: boolean;
  installed: boolean;
  startedByApp: boolean;
  logPath: string;
};

export default function SettingsClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const projectId = sp?.get("projectId") ?? null;

  const [isTauri, setIsTauri] = useState(false);

  const [transitionState, setTransitionState] = useState<"enter" | "entered" | "exit">("enter");
  const exitTimerRef = useRef<number | null>(null);
  const isExitingRef = useRef(false);
  const projectIdRef = useRef<string | null>(projectId);

  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryMsg, setRetryMsg] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState(false);

  const [aiProgress, setAiProgress] = useState<AiProgress | null>(null);
  const [station, setStation] = useState<StationStatus | null>(null);
  const [stationBusy, setStationBusy] = useState(false);
  const [stationErr, setStationErr] = useState<string | null>(null);

  const [settings, setSettings] = useState<Settings>({
    ai: {},
  });
  const [defaults, setDefaults] = useState<{
    moondreamEndpoint: string;
  }>({
    moondreamEndpoint: "http://localhost:2023/v1",
  });

  useEffect(() => {
    // Avoid touching `window` during SSR.
    setIsTauri(typeof window !== "undefined" && !!(window as any)?.__TAURI__?.invoke);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/settings");
      if (!res.ok) return;
      const data = (await res.json()) as {
        settings: Settings;
        defaults: { moondreamEndpoint: string };
      };
      if (cancelled) return;
      setSettings(data.settings);
      setDefaults(data.defaults);
      setLoaded(true);
    })().catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
  }, []);

  const tauriInvoke = async <T,>(cmd: string, args?: Record<string, unknown>): Promise<T> => {
    const w = window as any;
    if (!w?.__TAURI__?.invoke) throw new Error("Tauri API not available (not running in desktop app).");
    return (await w.__TAURI__.invoke(cmd, args ?? {})) as T;
  };

  // Desktop-only: Moondream Station status (auto-refresh).
  useEffect(() => {
    if (!isTauri) return;

    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const endpoint = (settings.ai.endpoint?.trim() || defaults.moondreamEndpoint).trim();
        const st = await tauriInvoke<StationStatus>("station_status", { endpoint });
        if (cancelled) return;
        setStation(st);
      } catch {
        // ignore (desktop only)
      } finally {
        if (cancelled) return;
        timer = window.setTimeout(tick, 2500);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTauri, settings.ai.endpoint, defaults.moondreamEndpoint]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | null = null;

    const tick = async () => {
      try {
        const res = await fetch("/api/ai/progress", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as AiProgress;
        if (cancelled) return;
        setAiProgress(data);
      } catch {
        // ignore
      } finally {
        if (cancelled) return;
        timer = window.setTimeout(tick, 2000);
      }
    };

    tick();
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    projectIdRef.current = projectId;
  }, [projectId]);

  // If we arrived via a route fade (e.g. opening Settings from the board), allow the overlay to fade away.
  useEffect(() => {
    dispatchRouteFadeEnd();
  }, []);

  // Fade in on mount.
  useEffect(() => {
    const raf = window.requestAnimationFrame(() => setTransitionState("entered"));
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const navigateBack = () => {
    const pid = projectIdRef.current;
    const back = pid ? `/projects/${pid}` : "/";
    router.push(back);
  };

  const requestExit = () => {
    if (isExitingRef.current) return;
    isExitingRef.current = true;
    dispatchRouteFadeStart();
    setTransitionState("exit");
    if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
    exitTimerRef.current = window.setTimeout(() => {
      exitTimerRef.current = null;
      navigateBack();
    }, ROUTE_FADE_MS);
  };

  // Cleanup (unmount) only: don't cancel our exit timer just because state changes.
  useEffect(() => {
    return () => {
      if (exitTimerRef.current) window.clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    };
  }, []);

  // Allow closing via Escape with the same fade-out.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      requestExit();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const saveAi = async () => {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const endpoint = settings.ai.endpoint?.trim() || undefined;

      const payload: Settings = {
        ai: {
          endpoint,
        },
      };
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      setSaved(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 overflow-auto text-zinc-50">
      {/* Backdrop */}
      <div
        className={`pointer-events-none fixed inset-0 bg-black transition-opacity duration-200 ease-out motion-reduce:transition-none ${
          transitionState === "entered" || transitionState === "exit" ? "opacity-100" : "opacity-0"
        }`}
      />

      <div
        className={`relative mx-auto max-w-3xl px-6 py-10 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none ${
          transitionState === "entered" ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Settings</div>
            <div className="mt-1 text-sm text-zinc-500">Desktop settings apply after restart.</div>
          </div>
          <button
            onClick={() => {
              requestExit();
            }}
            className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            Back
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950 p-4">
          <div className="text-sm font-medium">AI</div>
          <div className="mt-1 text-xs text-zinc-500">
            Configure the Moondream Station endpoint used by the bundled worker. Desktop settings apply after restart.
          </div>

          {error ? <div className="mt-4 text-sm text-red-400">{error}</div> : null}
          {saved ? (
            <div className="mt-4 rounded-lg border border-amber-900/40 bg-amber-950/20 px-3 py-2 text-sm text-amber-200">
              Saved. Close and reopen the app to apply endpoint changes.
            </div>
          ) : null}

          <div className="mt-4 space-y-4">
            <div>
              <div className="mb-1 text-xs text-zinc-500">Moondream Station endpoint</div>
              <input
                value={settings.ai.endpoint ?? ""}
                onChange={(e) => setSettings((s) => ({ ...s, ai: { ...s.ai, endpoint: e.target.value } }))}
                placeholder={defaults.moondreamEndpoint}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 outline-none"
              />
              <div className="mt-2 text-[11px] text-zinc-600">
                Examples: <span className="text-zinc-400">http://127.0.0.1:2021/v1</span> or{" "}
                <span className="text-zinc-400">http://localhost:2023/v1</span>. If{" "}
                <span className="text-zinc-400">localhost</span> gives issues, prefer{" "}
                <span className="text-zinc-400">127.0.0.1</span>.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                disabled={!loaded || saving}
                onClick={() => saveAi()}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save endpoint"}
              </button>

              <button
                disabled={!projectId}
                onClick={async () => {
                  if (!projectId) return;
                  setError(null);
                  setRetryMsg(null);
                  setRetryBusy(true);
                  try {
                    const res = await fetch(`/api/projects/${projectId}/ai/retry`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({}),
                    });
                    if (!res.ok) throw new Error("Retry failed");
                    const data = (await res.json().catch(() => null)) as { changes?: number } | null;
                    const changes = data?.changes ?? 0;
                    setRetryMsg(changes > 0 ? `Retried ${changes} asset(s).` : "No failed assets to retry.");
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setRetryBusy(false);
                  }
                }}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
              >
                {retryBusy ? "Retrying…" : "Retry failed AI (this project)"}
              </button>

              {!projectId ? (
                <div className="text-xs text-zinc-600">Open Settings from inside a project to enable this.</div>
              ) : null}
            </div>

            {retryMsg ? <div className="text-xs text-zinc-500">{retryMsg}</div> : null}

            <div className="mt-6 rounded-lg border border-zinc-900 bg-zinc-950 px-3 py-3">
              <div className="text-xs font-medium text-zinc-200">Worker activity</div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-zinc-500">
                <div>
                  Pending: <span className="text-zinc-200">{aiProgress ? aiProgress.counts.pending : "—"}</span>
                </div>
                <div>
                  Processing: <span className="text-zinc-200">{aiProgress ? aiProgress.counts.processing : "—"}</span>
                </div>
                <div>
                  Done: <span className="text-zinc-200">{aiProgress ? aiProgress.counts.done : "—"}</span>
                </div>
                <div>
                  Failed: <span className="text-zinc-200">{aiProgress ? aiProgress.counts.failed : "—"}</span>
                </div>
              </div>

              <div className="mt-2 text-xs text-zinc-500">
                {aiProgress?.worker.currentFile ? (
                  <>
                    Currently processing: <span className="text-zinc-200">{aiProgress.worker.currentFile}</span>
                  </>
                ) : aiProgress?.worker.logAvailable ? (
                  <>Worker is idle (no “processing …” line in recent logs).</>
                ) : (
                  <>Worker log not found (desktop-only; this is expected in some dev setups).</>
                )}
              </div>

              {aiProgress?.worker.lastLogAt ? (
                <div className="mt-1 text-[11px] text-zinc-600">
                  Last worker output: <span className="text-zinc-400">{aiProgress.worker.lastLogAt}</span>
                </div>
              ) : null}

              {aiProgress?.worker.logAvailable ? (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-200">
                    Recent worker log
                  </summary>
                  <pre className="mt-2 max-h-56 overflow-auto rounded-md border border-zinc-900 bg-black/40 p-2 text-[11px] leading-relaxed text-zinc-300">
                    {(aiProgress?.worker.recentLines || []).join("\n")}
                  </pre>
                </details>
              ) : null}
            </div>

            {isTauri ? (
              <div className="mt-4 rounded-lg border border-zinc-900 bg-zinc-950 px-3 py-3">
                <div className="text-xs font-medium text-zinc-200">Moondream Station</div>
                <div className="mt-1 text-xs text-zinc-500">
                  If you normally run Station from Terminal, the desktop app can start it for you.
                </div>

                <div className="mt-2 text-xs text-zinc-500">
                  Endpoint:{" "}
                  <span className="text-zinc-200">
                    {(settings.ai.endpoint?.trim() || defaults.moondreamEndpoint).trim()}
                  </span>
                </div>

                <div className="mt-2 flex items-center gap-3">
                  <button
                    disabled={stationBusy}
                    onClick={async () => {
                      setStationErr(null);
                      setStationBusy(true);
                      try {
                        const endpoint = (settings.ai.endpoint?.trim() || defaults.moondreamEndpoint).trim();
                        const st = await tauriInvoke<StationStatus>("station_start", { endpoint });
                        setStation(st);
                      } catch (e) {
                        setStationErr((e as Error).message);
                      } finally {
                        setStationBusy(false);
                      }
                    }}
                    className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    {stationBusy ? "Starting…" : "Start Station"}
                  </button>

                  <button
                    disabled={stationBusy}
                    onClick={async () => {
                      setStationErr(null);
                      setStationBusy(true);
                      try {
                        const st = await tauriInvoke<StationStatus>("station_stop");
                        setStation(st);
                      } catch (e) {
                        setStationErr((e as Error).message);
                      } finally {
                        setStationBusy(false);
                      }
                    }}
                    className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900 disabled:opacity-50"
                  >
                    Stop (if started by app)
                  </button>
                </div>

                <div className="mt-2 text-xs text-zinc-500">
                  Status:{" "}
                  <span className={station?.reachable ? "text-emerald-300" : "text-zinc-300"}>
                    {station?.reachable ? "Reachable" : "Not reachable"}
                  </span>
                  {station?.installed === false ? (
                    <>
                      {" "}
                      <span className="text-amber-300">(`moondream-station` not found)</span>
                    </>
                  ) : null}
                </div>

                {station?.logPath ? (
                  <div className="mt-1 text-[11px] text-zinc-600">
                    Station logs: <span className="text-zinc-400">{station.logPath}</span>
                  </div>
                ) : null}

                {!station?.installed ? (
                  <div className="mt-2 text-[11px] text-zinc-600">
                    Install (once):{" "}
                    <span className="text-zinc-400">python3 -m pip install --user moondream-station</span>
                  </div>
                ) : null}

                {stationErr ? <div className="mt-2 text-xs text-red-400">{stationErr}</div> : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}


