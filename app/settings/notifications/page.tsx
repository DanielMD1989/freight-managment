/**
 * Notification Settings Page
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Notification preferences management
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import NotificationSettingsClient from './NotificationSettingsClient';

export default async function NotificationSettingsPage() {
  // Check authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/settings/notifications');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session) {
    redirect('/login?redirect=/settings/notifications');
  }

  // Fetch user notification preferences
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      email: true,
      phone: true,
      notificationPreferences: true,
    },
  });

  if (!user) {
    redirect('/login');
  }

  return (
    <NotificationSettingsClient
      userId={user.id}
      email={user.email}
      phone={user.phone}
      preferences={(user.notificationPreferences as Record<string, boolean>) || {}}
    />
  );
}
