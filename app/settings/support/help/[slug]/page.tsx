/**
 * Help Topic Page — §14 Settings, Help & Support
 *
 * Dynamic route: /settings/support/help/[slug]
 * Renders help documentation for each topic defined in the blueprint.
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import HelpArticleClient from "./HelpArticleClient";

// Static topic slugs — used for generateStaticParams if needed
const VALID_SLUGS = [
  "getting-started",
  "posting-loads",
  "gps-tracking",
  "payments-settlements",
];

export default async function HelpTopicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/settings/support");
  }

  const session = await verifyToken(sessionCookie.value);
  if (!session) {
    redirect("/login?redirect=/settings/support");
  }

  const { slug } = await params;

  if (!VALID_SLUGS.includes(slug)) {
    notFound();
  }

  return <HelpArticleClient slug={slug} userRole={session.role} />;
}
