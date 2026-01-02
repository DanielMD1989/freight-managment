'use client';

/**
 * System Settings Client Component
 *
 * Interactive settings management with tabs and validation
 * Sprint 10 - Story 10.6: System Configuration
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface SystemSettings {
  id: string;
  // Rate Limiting
  rateLimitDocumentUpload: number;
  rateLimitTruckPosting: number;
  rateLimitFileDownload: number;
  rateLimitAuthAttempts: number;

  // Match Score Thresholds
  matchScoreMinimum: number;
  matchScoreGood: number;
  matchScoreExcellent: number;

  // Email Notifications
  emailNotificationsEnabled: boolean;
  emailNotifyDocumentApproval: boolean;
  emailNotifyDocumentRejection: boolean;
  emailNotifyLoadAssignment: boolean;
  emailNotifyPodVerification: boolean;

  // Platform Fees
  shipperCommissionRate: number;
  carrierCommissionRate: number;

  // File Upload Limits
  maxFileUploadSizeMb: number;
  maxDocumentsPerEntity: number;

  // General Settings
  platformMaintenanceMode: boolean;
  platformMaintenanceMessage: string | null;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;

  // Metadata
  lastModifiedBy: string;
  lastModifiedAt: string;
  createdAt: string;
}

type TabType = 'rate-limits' | 'matching' | 'notifications' | 'fees' | 'files' | 'general';

export default function SystemSettingsClient({
  initialSettings,
}: {
  initialSettings: SystemSettings;
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(initialSettings);
  const [activeTab, setActiveTab] = useState<TabType>('rate-limits');
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);

  /**
   * Handle number input change
   */
  const handleNumberChange = (field: keyof SystemSettings, value: string) => {
    const numValue = parseFloat(value);
    if (!isNaN(numValue)) {
      setSettings({ ...settings, [field]: numValue });
    }
  };

  /**
   * Handle boolean input change
   */
  const handleBooleanChange = (field: keyof SystemSettings, checked: boolean) => {
    setSettings({ ...settings, [field]: checked });
  };

  /**
   * Handle string input change
   */
  const handleStringChange = (field: keyof SystemSettings, value: string) => {
    setSettings({ ...settings, [field]: value || null });
  };

  /**
   * Validate settings before save
   */
  const validateSettings = (): string | null => {
    // Validate commission rates
    const totalCommission = settings.shipperCommissionRate + settings.carrierCommissionRate;
    if (totalCommission > 100) {
      return 'Total commission rates cannot exceed 100%';
    }

    // Validate match score thresholds
    if (settings.matchScoreMinimum >= settings.matchScoreGood) {
      return 'Minimum match score must be less than good match score';
    }
    if (settings.matchScoreGood >= settings.matchScoreExcellent) {
      return 'Good match score must be less than excellent match score';
    }

    return null;
  };

  /**
   * Save settings
   */
  const handleSave = async () => {
    const validationError = validateSettings();
    if (validationError) {
      setErrorMessage(validationError);
      setSuccessMessage('');
      return;
    }

    setIsSaving(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      setSuccessMessage('Settings saved successfully');
      router.refresh();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Reset changes
   */
  const handleReset = () => {
    setSettings(initialSettings);
    setErrorMessage('');
    setSuccessMessage('');
  };

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {successMessage && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-green-800 flex items-center gap-2">
            <span className="text-lg">✓</span>
            {successMessage}
          </p>
        </div>
      )}

      {errorMessage && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800 flex items-center gap-2">
            <span className="text-lg">⚠</span>
            {errorMessage}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <TabButton
              active={activeTab === 'rate-limits'}
              onClick={() => setActiveTab('rate-limits')}
            >
              Rate Limits
            </TabButton>
            <TabButton
              active={activeTab === 'matching'}
              onClick={() => setActiveTab('matching')}
            >
              Matching
            </TabButton>
            <TabButton
              active={activeTab === 'notifications'}
              onClick={() => setActiveTab('notifications')}
            >
              Notifications
            </TabButton>
            <TabButton
              active={activeTab === 'fees'}
              onClick={() => setActiveTab('fees')}
            >
              Platform Fees
            </TabButton>
            <TabButton
              active={activeTab === 'files'}
              onClick={() => setActiveTab('files')}
            >
              File Uploads
            </TabButton>
            <TabButton
              active={activeTab === 'general'}
              onClick={() => setActiveTab('general')}
            >
              General
            </TabButton>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Rate Limits Tab */}
          {activeTab === 'rate-limits' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Rate Limiting Configuration</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Control how frequently users can perform certain actions
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NumberInput
                  label="Document Upload Limit"
                  value={settings.rateLimitDocumentUpload}
                  onChange={(val) => handleNumberChange('rateLimitDocumentUpload', val)}
                  helperText="Per hour per user"
                  min={1}
                  max={1000}
                />

                <NumberInput
                  label="Truck Posting Limit"
                  value={settings.rateLimitTruckPosting}
                  onChange={(val) => handleNumberChange('rateLimitTruckPosting', val)}
                  helperText="Per day per carrier"
                  min={1}
                  max={1000}
                />

                <NumberInput
                  label="File Download Limit"
                  value={settings.rateLimitFileDownload}
                  onChange={(val) => handleNumberChange('rateLimitFileDownload', val)}
                  helperText="Per hour per user"
                  min={1}
                  max={10000}
                />

                <NumberInput
                  label="Authentication Attempts"
                  value={settings.rateLimitAuthAttempts}
                  onChange={(val) => handleNumberChange('rateLimitAuthAttempts', val)}
                  helperText="Per 15 minutes per IP"
                  min={1}
                  max={100}
                />
              </div>
            </div>
          )}

          {/* Matching Tab */}
          {activeTab === 'matching' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Match Score Thresholds</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Set thresholds for truck/load match quality ratings
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <NumberInput
                  label="Minimum Score"
                  value={settings.matchScoreMinimum}
                  onChange={(val) => handleNumberChange('matchScoreMinimum', val)}
                  helperText="Minimum score to show match"
                  min={0}
                  max={100}
                />

                <NumberInput
                  label="Good Match Score"
                  value={settings.matchScoreGood}
                  onChange={(val) => handleNumberChange('matchScoreGood', val)}
                  helperText="Good match threshold"
                  min={0}
                  max={100}
                />

                <NumberInput
                  label="Excellent Match Score"
                  value={settings.matchScoreExcellent}
                  onChange={(val) => handleNumberChange('matchScoreExcellent', val)}
                  helperText="Excellent match threshold"
                  min={0}
                  max={100}
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Note:</strong> Scores must be in ascending order (Minimum &lt; Good &lt; Excellent)
                </p>
              </div>
            </div>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Email Notifications</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Configure which email notifications are sent to users
                </p>
              </div>

              <div className="space-y-4">
                <SwitchInput
                  label="Enable Email Notifications"
                  checked={settings.emailNotificationsEnabled}
                  onChange={(checked) => handleBooleanChange('emailNotificationsEnabled', checked)}
                  helperText="Master toggle for all email notifications"
                />

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Notification Types</h4>
                  <div className="space-y-3 ml-4">
                    <SwitchInput
                      label="Document Approval"
                      checked={settings.emailNotifyDocumentApproval}
                      onChange={(checked) => handleBooleanChange('emailNotifyDocumentApproval', checked)}
                      helperText="Notify when documents are approved"
                      disabled={!settings.emailNotificationsEnabled}
                    />

                    <SwitchInput
                      label="Document Rejection"
                      checked={settings.emailNotifyDocumentRejection}
                      onChange={(checked) => handleBooleanChange('emailNotifyDocumentRejection', checked)}
                      helperText="Notify when documents are rejected"
                      disabled={!settings.emailNotificationsEnabled}
                    />

                    <SwitchInput
                      label="Load Assignment"
                      checked={settings.emailNotifyLoadAssignment}
                      onChange={(checked) => handleBooleanChange('emailNotifyLoadAssignment', checked)}
                      helperText="Notify when loads are assigned"
                      disabled={!settings.emailNotificationsEnabled}
                    />

                    <SwitchInput
                      label="POD Verification"
                      checked={settings.emailNotifyPodVerification}
                      onChange={(checked) => handleBooleanChange('emailNotifyPodVerification', checked)}
                      helperText="Notify when proof of delivery is verified"
                      disabled={!settings.emailNotificationsEnabled}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Platform Fees Tab */}
          {activeTab === 'fees' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">Platform Commission Rates</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Set commission rates charged to shippers and carriers
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NumberInput
                  label="Shipper Commission Rate"
                  value={settings.shipperCommissionRate}
                  onChange={(val) => handleNumberChange('shipperCommissionRate', val)}
                  helperText="Percentage charged to shippers"
                  min={0}
                  max={100}
                  step={0.1}
                  suffix="%"
                />

                <NumberInput
                  label="Carrier Commission Rate"
                  value={settings.carrierCommissionRate}
                  onChange={(val) => handleNumberChange('carrierCommissionRate', val)}
                  helperText="Percentage charged to carriers"
                  min={0}
                  max={100}
                  step={0.1}
                  suffix="%"
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Total Commission:</strong>{' '}
                  {(settings.shipperCommissionRate + settings.carrierCommissionRate).toFixed(1)}%
                  {settings.shipperCommissionRate + settings.carrierCommissionRate > 100 && (
                    <span className="text-red-600 ml-2">⚠ Cannot exceed 100%</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {/* File Uploads Tab */}
          {activeTab === 'files' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">File Upload Configuration</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Set limits for file uploads and document storage
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <NumberInput
                  label="Maximum File Size"
                  value={settings.maxFileUploadSizeMb}
                  onChange={(val) => handleNumberChange('maxFileUploadSizeMb', val)}
                  helperText="Maximum size per file in MB"
                  min={1}
                  max={100}
                  suffix="MB"
                />

                <NumberInput
                  label="Maximum Documents Per Entity"
                  value={settings.maxDocumentsPerEntity}
                  onChange={(val) => handleNumberChange('maxDocumentsPerEntity', val)}
                  helperText="Max documents per organization/user"
                  min={1}
                  max={50}
                />
              </div>
            </div>
          )}

          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">General Settings</h3>
                <p className="text-sm text-gray-600 mb-6">
                  Platform-wide general configuration
                </p>
              </div>

              <div className="space-y-6">
                <SwitchInput
                  label="Maintenance Mode"
                  checked={settings.platformMaintenanceMode}
                  onChange={(checked) => handleBooleanChange('platformMaintenanceMode', checked)}
                  helperText="Enable to put platform in maintenance mode"
                />

                {settings.platformMaintenanceMode && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Maintenance Message
                    </label>
                    <textarea
                      value={settings.platformMaintenanceMessage || ''}
                      onChange={(e) => handleStringChange('platformMaintenanceMessage', e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      rows={3}
                      placeholder="Message to display during maintenance..."
                      maxLength={500}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {settings.platformMaintenanceMessage?.length || 0} / 500 characters
                    </p>
                  </div>
                )}

                <div className="border-t border-gray-200 pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Verification Requirements</h4>
                  <div className="space-y-3">
                    <SwitchInput
                      label="Require Email Verification"
                      checked={settings.requireEmailVerification}
                      onChange={(checked) => handleBooleanChange('requireEmailVerification', checked)}
                      helperText="Users must verify email before accessing platform"
                    />

                    <SwitchInput
                      label="Require Phone Verification"
                      checked={settings.requirePhoneVerification}
                      onChange={(checked) => handleBooleanChange('requirePhoneVerification', checked)}
                      helperText="Users must verify phone number before accessing platform"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow p-6">
        <div className="text-sm text-gray-600">
          {hasChanges ? (
            <span className="text-yellow-600 font-medium">⚠ You have unsaved changes</span>
          ) : (
            <span>All changes saved</span>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={!hasChanges || isSaving}
            className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges || isSaving}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <span className="inline-block animate-spin">⟳</span>
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div className="bg-gray-50 rounded-lg p-4 text-xs text-gray-600">
        <div className="flex justify-between">
          <span>Last modified: {new Date(settings.lastModifiedAt).toLocaleString()}</span>
          <span>Last modified by: {settings.lastModifiedBy}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Tab Button Component
 */
function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        px-6 py-3 text-sm font-medium border-b-2 transition-colors
        ${
          active
            ? 'border-blue-500 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
        }
      `}
    >
      {children}
    </button>
  );
}

/**
 * Number Input Component
 */
function NumberInput({
  label,
  value,
  onChange,
  helperText,
  min,
  max,
  step = 1,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
  helperText?: string;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          min={min}
          max={max}
          step={step}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
            {suffix}
          </span>
        )}
      </div>
      {helperText && <p className="text-xs text-gray-500 mt-1">{helperText}</p>}
    </div>
  );
}

/**
 * Switch Input Component
 */
function SwitchInput({
  label,
  checked,
  onChange,
  helperText,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  helperText?: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`
          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
          ${checked ? 'bg-blue-600' : 'bg-gray-200'}
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
      >
        <span
          className={`
            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </button>
      <div className="flex-1">
        <label className={`block text-sm font-medium ${disabled ? 'text-gray-400' : 'text-gray-700'}`}>
          {label}
        </label>
        {helperText && (
          <p className={`text-xs mt-1 ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
            {helperText}
          </p>
        )}
      </div>
    </div>
  );
}
