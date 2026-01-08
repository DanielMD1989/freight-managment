/**
 * Create Organization Page
 * Sprint 1 - Story 1.4: Organization Management
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import OrganizationProfileForm from '@/components/OrganizationProfileForm';

export default async function CreateOrganizationPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <OrganizationProfileForm mode="create" />
    </div>
  );
}
