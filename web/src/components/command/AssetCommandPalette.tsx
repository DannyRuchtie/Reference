"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Command } from "cmdk";

import type { AssetWithAi, CanvasObjectRow } from "@/server/db/types";

function humanizeFilename(name: string) {
  const raw = (name || "").trim();
  if (!raw) return "";

  // Remove extension
  const dot = raw.lastIndexOf(".");
  let base = dot > 0 ? raw.slice(0, dot) : raw;

  // If it's an auto-generated "title--hash" style, keep only the title part.
  const doubleDash = base.indexOf("--");
  if (doubleDash > 0) base = base.slice(0, doubleDash);

  // Remove trailing "-<hex>" slug (common content-addressed suffixes).
  base = base.replace(/-[0-9a-fA-F]{8,}$/g, "");

  // Turn separators into spaces.
  base = base.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();

  // Basic sentence casing.
  if (!base) return raw;
  return base.charAt(0).toUpperCase() + base.slice(1);
}

function shortTitleFromCaption(caption: string) {
  let s = (caption || "").trim();
  if (!s) return "";

  // Strip common verbose prefixes.
  s = s.replace(/^(the|this)\s+(image|photo|picture|video)\s+(depicts|shows|features|captures)\s+/i, "");
  s = s.replace(/^(an?|this)\s+(image|photo|picture|video)\s+(of|showing)\s+/i, "");

  // Prefer first clause.
  const cutIdx = (() => {
    const candidates = [
      s.indexOf("."),
      s.indexOf(";"),
      s.indexOf(":"),
      s.indexOf(" — "),
      s.indexOf(" – "),
      s.indexOf(" - "),
      s.indexOf(", while "),
      s.indexOf(", with "),
      s.indexOf(", featuring "),
    ].filter((i) => i >= 0);
    if (!candidates.length) return -1;
    return Math.min(...candidates);
  })();
  if (cutIdx > 0) s = s.slice(0, cutIdx);

  // Collapse whitespace.
  s = s.replace(/\s+/g, " ").trim();

  // Cap words/chars so it reads like a title.
  const words = s.split(" ").filter(Boolean);
  const MAX_WORDS = 8;
  const MAX_CHARS = 48;
  let out = words.slice(0, MAX_WORDS).join(" ");
  if (out.length > MAX_CHARS) out = out.slice(0, MAX_CHARS).trimEnd();
  if (out !== s) out = out.replace(/[,\-–—:;]+$/g, "").trimEnd() + "…";
  return out;
}

function displayTitle(a: AssetWithAi) {
  const caption = (a.ai_status === "done" ? (a.ai_caption ?? "") : "").trim();
  if (caption) return shortTitleFromCaption(caption) || caption;
  const h = humanizeFilename(a.original_name);
  return h || a.original_name || "Untitled";
}

export function AssetCommandPalette(props: {
  projectId: string;
  objects: CanvasObjectRow[];
  onFocusObjectId: (objectId: string) => void;
  onPlaceAssetAtViewportCenter: (assetId: string) => void;
  onHighlightAsset?: (payload: {
    assetId: string;
    term: string;
    svg: string | null;
    bboxJson: string | null;
  }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<AssetWithAi[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  function isEditableTarget(target: EventTarget | null) {
    const el = target as HTMLElement | null;
    if (!el) return false;
    if (el.isContentEditable) return true;
    const tag = el.tagName?.toLowerCase?.() ?? "";
    if (tag === "input" || tag === "textarea" || tag === "select") return true;
    // Handles nested contenteditable, e.g. editors that wrap the actual editable node.
    if (typeof el.closest === "function" && el.closest('[contenteditable="true"]')) return true;
    return false;
  }

  const objectIdByAssetId = useMemo(() => {
    const m = new Map<string, string>();
    for (const o of props.objects) {
      if (o.type === "image" && o.asset_id) m.set(o.asset_id, o.id);
    }
    return m;
  }, [props.objects]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (e.key === "Escape") setOpen(false);

      const key = e.key.toLowerCase();
      if (!e.repeat && mod && !e.altKey && key === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // F / Cmd+F: open the command palette. (Note: Cmd/Ctrl+F will override the browser's find-in-page.)
      if (!e.repeat && mod && !e.altKey && key === "f") {
        e.preventDefault();
        setOpen(true);
        return;
      }

      if (isEditableTarget(e.target)) return;

      if (!e.repeat && !e.altKey && !e.metaKey && !e.ctrlKey && key === "f") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Desktop menu bridge (Tauri): allow opening/toggling via native menu item.
  useEffect(() => {
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener("moondream:command-palette:toggle", onToggle as EventListener);
    return () => window.removeEventListener("moondream:command-palette:toggle", onToggle as EventListener);
  }, []);

  // Desktop menu bridge (Tauri): explicit "open" (used for Cmd/Ctrl+F).
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("moondream:command-palette:open", onOpen as EventListener);
    return () => window.removeEventListener("moondream:command-palette:open", onOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(async () => {
      const res = await fetch(
        `/api/projects/${props.projectId}/assets/search?q=${encodeURIComponent(
          search
        )}&limit=50&mode=hybrid`
      );
      if (!res.ok) return;
      const data = (await res.json()) as { assets: AssetWithAi[] };
      setResults(data.assets ?? []);
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, search, props.projectId]);

  useEffect(() => {
    if (!open) return;
    const raf = window.requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      el.select();
    });
    return () => window.cancelAnimationFrame(raf);
  }, [open]);

  const items = open ? results : [];

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setOpen(false)} />
      ) : null}
      <div
        className={
          open
            ? "fixed left-1/2 top-16 z-50 w-[720px] max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl"
            : "hidden"
        }
      >
        <Command className="flex flex-col overflow-hidden">
          <div className="border-b border-zinc-900 p-3">
            <Command.Input
              ref={inputRef}
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder="Search assets…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-600"
            />
          </div>

          <Command.List className="max-h-[420px] overflow-auto p-2">
            <Command.Empty className="p-3 text-sm text-zinc-500">
              No results.
            </Command.Empty>

            {items.map((a) => {
              const onCanvas = objectIdByAssetId.get(a.id);
              const title = displayTitle(a);
              const subtitle = a.ai_status && a.ai_status !== "done" ? a.ai_status : "";
              return (
                <Command.Item
                  key={a.id}
                  value={`${a.original_name} ${a.ai_caption ?? ""} ${a.manual_notes ?? ""} ${(() => {
                    try {
                      return a.manual_tags ? (JSON.parse(a.manual_tags) as string[]).join(" ") : "";
                    } catch {
                      return "";
                    }
                  })()}`}
                  onSelect={() => {
                    setOpen(false);
                    if (onCanvas) props.onFocusObjectId(onCanvas);
                    else props.onPlaceAssetAtViewportCenter(a.id);

                    const term = search.trim().split(/\s+/g).filter(Boolean)[0]?.toLowerCase();
                    if (!term) return;
                    if (!props.onHighlightAsset) return;

                    // Best-effort: ask the server for cached segment/bbox for this term.
                    // If missing, just skip highlight (keeps existing UX intact).
                    fetch(
                      `/api/projects/${props.projectId}/assets/${a.id}/segments?term=${encodeURIComponent(
                        term
                      )}`
                    )
                      .then((r) => (r.ok ? r.json() : null))
                      .then((data) => {
                        if (!data) return;
                        props.onHighlightAsset?.({
                          assetId: a.id,
                          term,
                          svg: (data.svg as string | null) ?? null,
                          bboxJson: (data.bboxJson as string | null) ?? null,
                        });
                      })
                      .catch(() => {});
                  }}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-200 aria-selected:bg-zinc-900"
                >
                  <div className="h-10 w-10 shrink-0 rounded bg-zinc-900 overflow-hidden">
                    {a.thumb_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.thumb_url} alt="" className="h-full w-full object-contain" />
                    ) : null}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{title}</div>
                    {subtitle ? (
                      <div className="truncate text-xs text-zinc-500">{subtitle}</div>
                    ) : null}
                  </div>
                </Command.Item>
              );
            })}
          </Command.List>

          <div className="border-t border-zinc-900 p-2 text-xs text-zinc-500" />
        </Command>
      </div>
    </>
  );
}


