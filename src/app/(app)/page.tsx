import { redirect } from "next/navigation";

// There's no separate Dashboard anymore — Units is the landing page, and
// the pending-work counts that used to live here (Needs a reply, Renewals
// due, Open tickets, Active leads) are now badges on their own nav tabs
// instead, visible from every page rather than only this one. The
// Security-deposit/Rent-overdue lists moved onto the Units page itself,
// next to the units they're actually about.
export default function Home() {
  redirect("/units");
}
