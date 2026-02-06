'use client';

/**
 * User Detail Client Component
 *
 * Interactive user detail view with edit functionality
 * Sprint 10 - Story 10.2: User Management
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCSRFToken } from '@/lib/csrfFetch';

interface UserDetail {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
    type: string;
    isVerified: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

const STATUS_OPTIONS = [
  { value: 'REGISTERED', label: 'Registered' },
  { value: 'PENDING_VERIFICATION', label: 'Pending Verification' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'SUSPENDED', label: 'Suspended' },
  { value: 'REJECTED', label: 'Rejected' },
];

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: 'bg-purple-100 text-purple-800',
    SUPER_ADMIN: 'bg-red-100 text-red-800',
    SHIPPER: 'bg-green-100 text-green-800',
    CARRIER: 'bg-yellow-100 text-yellow-800',
    DISPATCHER: 'bg-blue-100 text-blue-800',
    DRIVER: 'bg-gray-100 text-gray-800',
  };
  return colors[role] || 'bg-gray-100 text-gray-800';
}

function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-800',
    REGISTERED: 'bg-blue-100 text-blue-800',
    SUSPENDED: 'bg-red-100 text-red-800',
    REJECTED: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export default function UserDetailClient({
  user,
  currentUserRole,
}: {
  user: UserDetail;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit form state
  const [phone, setPhone] = useState(user.phone || '');
  const [status, setStatus] = useState(user.status);

  // Check if current user can edit this user
  const canEdit = currentUserRole === 'SUPER_ADMIN' ||
    (currentUserRole === 'ADMIN' && !['ADMIN', 'SUPER_ADMIN'].includes(user.role));

  /**
   * Handle save
   */
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const csrfToken = await getCSRFToken();
      const updates: Record<string, string> = {};

      // Only include changed fields
      if (phone !== (user.phone || '')) {
        updates.phone = phone;
      }
      if (status !== user.status) {
        updates.status = status;
      }

      if (Object.keys(updates).length === 0) {
        setError('No changes to save');
        setSaving(false);
        return;
      }

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess('User updated successfully');
        setIsEditing(false);
        router.refresh();
      } else {
        setError(data.error || 'Failed to update user');
      }
    } catch (err) {
      setError('An error occurred while saving');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    setPhone(user.phone || '');
    setStatus(user.status);
    setIsEditing(false);
    setError(null);
  };

  /**
   * Handle delete
   */
  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${user.email}? This action cannot be undone.`)) {
      return;
    }

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      if (response.ok) {
        router.push('/admin/users');
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to delete user');
      }
    } catch (err) {
      setError('An error occurred while deleting');
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* User Info Card */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.email}
            </h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
              {user.role.replace(/_/g, ' ')}
            </span>
            <span className={`px-3 py-1 text-sm font-semibold rounded-full ${getStatusBadgeColor(user.status)}`}>
              {user.status.replace(/_/g, ' ')}
            </span>
          </div>
        </div>

        {/* User Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              Contact Information
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-600">Email</dt>
                <dd className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  {user.email}
                  {user.isEmailVerified && (
                    <span className="text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded-full">
                      Verified
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Phone</dt>
                <dd className="text-sm font-medium text-gray-900 flex items-center gap-2">
                  {isEditing ? (
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Phone number"
                    />
                  ) : (
                    <>
                      {user.phone || 'Not set'}
                      {user.isPhoneVerified && (
                        <span className="text-green-600 text-xs bg-green-100 px-2 py-0.5 rounded-full">
                          Verified
                        </span>
                      )}
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Account Status */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              Account Status
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-600">Status</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {isEditing ? (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(user.status)}`}>
                      {user.status.replace(/_/g, ' ')}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Active</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {user.isActive ? 'Yes' : 'No'}
                </dd>
              </div>
            </dl>
          </div>

          {/* Organization */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              Organization
            </h3>
            {user.organization ? (
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-600">Name</dt>
                  <dd className="text-sm font-medium text-gray-900 flex items-center gap-2">
                    {user.organization.name}
                    {user.organization.isVerified && (
                      <span className="text-blue-600 text-xs bg-blue-100 px-2 py-0.5 rounded-full">
                        Verified
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Type</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {user.organization.type.replace(/_/g, ' ')}
                  </dd>
                </div>
                <div>
                  <a
                    href={`/admin/organizations/${user.organization.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View Organization
                  </a>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-500">No organization</p>
            )}
          </div>

          {/* Timestamps */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              Activity
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-600">Created</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Last Updated</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDate(user.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Last Login</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDate(user.lastLoginAt)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="mt-8 pt-6 border-t border-gray-200 flex justify-between">
            <div>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
                >
                  Edit User
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors font-medium"
            >
              Delete User
            </button>
          </div>
        )}

        {!canEdit && (
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              You do not have permission to edit this user.
            </p>
          </div>
        )}
      </div>

      {/* Back Link */}
      <div>
        <a
          href="/admin/users"
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          ← Back to Users
        </a>
      </div>
    </div>
  );
}
