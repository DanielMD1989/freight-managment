/**
 * Security Dashboard
 * Sprint 9 - Security Hardening
 *
 * Admin dashboard for monitoring security events, blocked IPs, and audit logs
 */

import { Metadata } from "next";
import SecurityDashboardClient from "./SecurityDashboardClient";

export const metadata: Metadata = {
  title: "Security Dashboard | Admin",
  description: "Monitor security events and blocked IPs",
};

export default function SecurityDashboardPage() {
  return <SecurityDashboardClient />;
}
