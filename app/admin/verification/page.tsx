/**
 * Admin Document Verification Queue Page
 *
 * Review and verify uploaded documents from organizations
 * Sprint 10 - Story 10.4: Document Verification Queue
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import VerificationQueueClient from './VerificationQueueClient';

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
  entityType: 'company' | 'truck';
  entityName: string;
  organization: {
    id: string;
    name: string;
    type: string;
  };
  uploadedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
  verifiedBy: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

interface DocumentsResponse {
  documents: Document[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  statistics: {
    companyDocuments: number;
    truckDocuments: number;
    total: number;
  };
}

/**
 * Fetch documents from admin API
 */
async function getDocuments(
  page: number = 1,
  status: string = 'PENDING',
  entityType: string = 'all'
): Promise<DocumentsResponse | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      page: page.toString(),
      limit: '20',
      status,
      entityType,
    });

    const response = await fetch(`${baseUrl}/api/admin/documents?${params}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch documents:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching documents:', error);
    return null;
  }
}

/**
 * Admin Document Verification Queue Page
 */
export default async function AdminVerificationPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    status?: string;
    entityType?: string;
  }>;
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/admin/verification');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  // Await searchParams (Next.js 15+)
  const params = await searchParams;

  // Get query parameters
  const page = parseInt(params.page || '1');
  const status = params.status || 'PENDING';
  const entityType = params.entityType || 'all';

  // Fetch documents
  const data = await getDocuments(page, status, entityType);

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Document Verification Queue
          </h1>
          <p className="text-gray-600 mt-2">
            Review and verify uploaded documents
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            Failed to load documents. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Document Verification Queue
        </h1>
        <p className="text-gray-600 mt-2">
          Review and verify uploaded documents ({data.statistics.total} total
          pending)
        </p>
      </div>

      {/* Verification Queue Client Component */}
      <VerificationQueueClient
        initialDocuments={data.documents}
        pagination={data.pagination}
        statistics={data.statistics}
        initialStatus={status}
        initialEntityType={entityType}
      />
    </div>
  );
}
