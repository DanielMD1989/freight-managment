/**
 * Company Settings Client Component
 *
 * Phase 2 - Story 16.9B: Company Admin Tools
 * Task 16.9B.5: Company Preference Settings
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Organization {
  id: string;
  name: string;
  type: string;
  description: string | null;
  contactEmail: string;
  contactPhone: string;
  address: string | null;
  city: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  licenseNumber: string | null;
  taxId: string | null;
  allowNameDisplay: boolean;
  createdAt: string;
}

interface Props {
  organization: Organization;
}

export default function CompanySettingsClient({ organization }: Props) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: organization.name,
    description: organization.description || '',
    contactEmail: organization.contactEmail,
    contactPhone: organization.contactPhone,
    address: organization.address || '',
    city: organization.city || '',
    licenseNumber: organization.licenseNumber || '',
    taxId: organization.taxId || '',
    allowNameDisplay: organization.allowNameDisplay,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasChanges = JSON.stringify({
    name: organization.name,
    description: organization.description || '',
    contactEmail: organization.contactEmail,
    contactPhone: organization.contactPhone,
    address: organization.address || '',
    city: organization.city || '',
    licenseNumber: organization.licenseNumber || '',
    taxId: organization.taxId || '',
    allowNameDisplay: organization.allowNameDisplay,
  }) !== JSON.stringify(formData);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/organizations/${organization.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update settings');
      }

      setSuccess('Settings updated successfully');
      setTimeout(() => setSuccess(null), 3000);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: organization.name,
      description: organization.description || '',
      contactEmail: organization.contactEmail,
      contactPhone: organization.contactPhone,
      address: organization.address || '',
      city: organization.city || '',
      licenseNumber: organization.licenseNumber || '',
      taxId: organization.taxId || '',
      allowNameDisplay: organization.allowNameDisplay,
    });
    setError(null);
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-sm text-rose-800">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-sm text-emerald-800">{success}</p>
        </div>
      )}

      {/* Verification Status */}
      <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#064d51]">
              Verification Status
            </h2>
            <p className="text-sm text-[#064d51]/70 mt-1">
              Verified organizations get priority matching and display a verified badge
            </p>
          </div>
          <div>
            {organization.isVerified ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-emerald-500 text-white">
                <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Verified
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-amber-100 text-amber-800">
                Pending Verification
              </span>
            )}
          </div>
        </div>
        {organization.verifiedAt && (
          <p className="text-xs text-gray-500 mt-2">
            Verified on {new Date(organization.verifiedAt).toLocaleDateString()}
          </p>
        )}
      </div>

      {/* Company Profile Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6">
          <h2 className="text-lg font-semibold text-[#064d51] mb-4">
            Company Profile
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-1">
                Company Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-1">
                Organization Type
              </label>
              <input
                type="text"
                value={organization.type}
                disabled
                className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg bg-[#064d51]/5 text-[#064d51]/70"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-[#064d51] mb-1">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
                placeholder="Brief description of your company..."
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6">
          <h2 className="text-lg font-semibold text-[#064d51] mb-4">
            Contact Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-1">
                Contact Email *
              </label>
              <input
                type="email"
                value={formData.contactEmail}
                onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
                required
                className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-1">
                Contact Phone *
              </label>
              <input
                type="tel"
                value={formData.contactPhone}
                onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                required
                className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-1">
                Address
              </label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-1">
                City
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6">
          <h2 className="text-lg font-semibold text-[#064d51] mb-4">
            Legal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-1">
                License Number
              </label>
              <input
                type="text"
                value={formData.licenseNumber}
                onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[#064d51] mb-1">
                Tax ID
              </label>
              <input
                type="text"
                value={formData.taxId}
                onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                className="w-full px-3 py-2 border border-[#064d51]/20 rounded-lg focus:ring-2 focus:ring-[#1e9c99] focus:border-[#1e9c99]"
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-[#064d51]/10 p-6">
          <h2 className="text-lg font-semibold text-[#064d51] mb-4">
            Privacy Settings
          </h2>
          <div className="flex items-center justify-between p-4 bg-[#f0fdfa] rounded-lg">
            <div>
              <h3 className="text-sm font-medium text-[#064d51]">
                Display Company Name
              </h3>
              <p className="text-sm text-[#064d51]/70">
                Show your company name to other platform users
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.allowNameDisplay}
                onChange={(e) =>
                  setFormData({ ...formData, allowNameDisplay: e.target.checked })
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#064d51]/20 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#1e9c99]/30 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-[#064d51]/20 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1e9c99]"></div>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between bg-[#f0fdfa] p-4 rounded-xl border border-[#064d51]/10">
          <div className="text-sm text-[#064d51]/70">
            {hasChanges ? (
              <span className="text-amber-600 font-medium">You have unsaved changes</span>
            ) : (
              <span>All changes saved</span>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleReset}
              disabled={!hasChanges || loading}
              className="px-4 py-2 border border-[#064d51]/30 rounded-lg text-[#064d51] hover:bg-[#064d51]/5 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={!hasChanges || loading}
              className="px-4 py-2 bg-[#064d51] text-white rounded-lg hover:bg-[#053d40] disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </form>

      {/* Account Info */}
      <div className="bg-[#064d51]/5 rounded-xl p-4 border border-[#064d51]/10">
        <p className="text-xs text-[#064d51]/60">
          Organization created on {new Date(organization.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
