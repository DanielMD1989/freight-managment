'use client';

/**
 * DAT Company Modal Component
 *
 * Company details modal/drawer with verification status and actions
 * Sprint 14 - DAT-Style UI Transformation
 */

import React from 'react';
import { DatCompanyModalProps } from '@/types/dat-ui';

export default function DatCompanyModal({
  isOpen,
  onClose,
  company,
  onMarkPreferred,
  onMarkBlocked,
}: DatCompanyModalProps) {
  if (!isOpen || !company) return null;

  /**
   * Format date
   */
  const formatDate = (date: Date | string | null | undefined): string => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString();
  };

  /**
   * Handle backdrop click
   */
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4 flex items-center justify-between rounded-t-lg">
          <h2 className="text-xl font-semibold">{company.name}</h2>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Verification Status */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Verification Status</h3>
            <div className="flex items-center gap-2">
              {company.isVerified ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  ✓ Verified
                </span>
              ) : (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                  Not Verified
                </span>
              )}
              {company.bondDate && (
                <span className="text-sm text-gray-600">
                  Bond Date: {formatDate(company.bondDate)}
                </span>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Contact Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              {company.contactName && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Contact:</span>
                  <span className="font-medium">{company.contactName}</span>
                </div>
              )}
              {company.phone && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium">{company.phone}</span>
                </div>
              )}
              {company.email && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium">{company.email}</span>
                </div>
              )}
              {company.location && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Location:</span>
                  <span className="font-medium">{company.location}</span>
                </div>
              )}
            </div>
          </div>

          {/* Stats */}
          {(company.totalLoads !== undefined || company.totalTrucks !== undefined) && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Activity Stats</h3>
              <div className="grid grid-cols-2 gap-4">
                {company.totalLoads !== undefined && (
                  <div className="bg-blue-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-blue-600">{company.totalLoads}</div>
                    <div className="text-sm text-gray-600">Total Loads</div>
                  </div>
                )}
                {company.totalTrucks !== undefined && (
                  <div className="bg-green-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">{company.totalTrucks}</div>
                    <div className="text-sm text-gray-600">Total Trucks</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Preference Status */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Preference</h3>
            <div className="flex gap-2">
              {company.isPreferred ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                  ⭐ Preferred
                </span>
              ) : (
                <button
                  onClick={() => onMarkPreferred && onMarkPreferred(company.id)}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Mark as Preferred
                </button>
              )}
              {company.isBlocked ? (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-red-100 text-red-800">
                  🚫 Blocked
                </span>
              ) : (
                <button
                  onClick={() => onMarkBlocked && onMarkBlocked(company.id)}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-md text-sm font-medium transition-colors"
                >
                  Block Company
                </button>
              )}
            </div>
          </div>

          {/* Notes */}
          {company.notes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700">{company.notes}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end rounded-b-lg border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
