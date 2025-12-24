import { Suspense } from "react";

import SettingsClient from "./SettingsClient";

export const runtime = "nodejs";

export default function SettingsPage() {
  // Uses client component to read/write settings via /api/settings.
  return (
    <Suspense>
      <SettingsClient />
    </Suspense>
  );
}


