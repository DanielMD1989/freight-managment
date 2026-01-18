/**
 * Settings Index Page
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Redirects to profile settings by default
 */

import { redirect } from 'next/navigation';

export default function SettingsPage() {
  redirect('/settings/profile');
}
