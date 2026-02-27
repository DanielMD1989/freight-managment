/**
 * Security Settings Page
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Password, MFA, and session management settings
 */

import { cookies } from "next/headers";
import { verifyToken } from "@/lib/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import SecuritySettingsClient from "./SecuritySettingsClient";

export default async function SecuritySettingsPage() {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session");

  if (!sessionCookie) {
    redirect("/login?redirect=/settings/security");
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect("/login?redirect=/settings/security");
  }

  // Fetch user data with MFA status and sessions
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      lastLoginAt: true,
      mfa: {
        select: {
          enabled: true,
          phone: true,
          recoveryCodesGeneratedAt: true,
          recoveryCodesUsedCount: true,
        },
      },
      sessions: {
        where: {
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          deviceInfo: true,
          ipAddress: true,
          lastSeenAt: true,
          createdAt: true,
        },
        orderBy: { lastSeenAt: "desc" },
        take: 10,
      },
    },
  });

  if (!user) {
    redirect("/login");
  }

  // Get recent security events
  const securityEvents = await db.securityEvent.findMany({
    where: { userId: session.userId },
    select: {
      id: true,
      eventType: true,
      ipAddress: true,
      deviceInfo: true,
      success: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <SecuritySettingsClient
      user={{
        id: user.id,
        email: user.email,
        phone: user.phone,
        lastLoginAt: user.lastLoginAt?.toISOString() || null,
        mfaEnabled: user.mfa?.enabled || false,
        mfaPhone: user.mfa?.phone || null,
        recoveryCodesGeneratedAt:
          user.mfa?.recoveryCodesGeneratedAt?.toISOString() || null,
        recoveryCodesUsedCount: user.mfa?.recoveryCodesUsedCount || 0,
      }}
      sessions={user.sessions.map((s) => ({
        ...s,
        lastSeenAt: s.lastSeenAt.toISOString(),
        createdAt: s.createdAt.toISOString(),
      }))}
      securityEvents={securityEvents.map((e) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
