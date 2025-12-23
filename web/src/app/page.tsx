import { redirect } from "next/navigation";

import HomeClient from "./HomeClient";
import { getLastOpenedProjectId } from "@/server/db/appState";

export default async function Home(props: {
  searchParams: Promise<{ choose?: string | string[] }>;
}) {
  const sp = await props.searchParams;
  const choose = sp?.choose === "1" || (Array.isArray(sp?.choose) && sp?.choose[0] === "1");

  // In the desktop app, the port changes on every launch, so browser localStorage can't be used.
  // Store the "last opened project" in SQLite and server-redirect on launch.
  if (!choose) {
    const last = getLastOpenedProjectId();
    if (last) redirect(`/projects/${last}`);
  }

  return <HomeClient />;
}
