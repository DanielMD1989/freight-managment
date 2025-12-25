/**
 * Document Management Page
 *
 * Upload and manage company documents for verification
 * Sprint 11 - Story 11.5: Document Management
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import DocumentManagementClient from './DocumentManagementClient';

interface Document {
  id: string;
  type: string;
  fileName: string;
  fileUrl: string;
  fileSize: number;
  mimeType: string;
  verificationStatus: string;
  uploadedAt: string;
  verifiedAt: string | null;
  rejectionReason: string | null;
  expiresAt: string | null;
}

/**
 * Fetch company documents
 */
async function getDocuments(organizationId: string): Promise<Document[] | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(
      `${baseUrl}/api/documents?entityType=company&entityId=${organizationId}`,
      {
        headers: {
          Cookie: `session=${sessionCookie.value}`,
        },
        cache: 'no-store',
      }
    );

    if (!response.ok) {
      console.error('Failed to fetch documents:', response.status);
      return null;
    }

    const data = await response.json();
    return data.documents || [];
  } catch (error) {
    console.error('Error fetching documents:', error);
    return null;
  }
}

/**
 * Document Management Page
 */
export default async function DocumentsPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper/documents');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'SHIPPER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/shipper?error=no-organization');
  }

  // Fetch documents
  const documents = await getDocuments(session.organizationId);

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Company Documents</h1>
        <p className="text-gray-600 mt-2">
          Upload and manage your company verification documents
        </p>
      </div>

      {/* Document Management Client Component */}
      <DocumentManagementClient
        initialDocuments={documents || []}
        organizationId={session.organizationId}
      />
    </div>
  );
}
