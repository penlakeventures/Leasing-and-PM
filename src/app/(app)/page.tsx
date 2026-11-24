import { redirect } from "next/navigation";

// There's no separate Dashboard anymore — Projects is the landing page.
// Units no longer have their own tab (that cross-project list was a
// near-duplicate of what the Tenants page already showed) — a unit is
// reached by drilling into its project instead.
export default function Home() {
  redirect("/projects");
}
