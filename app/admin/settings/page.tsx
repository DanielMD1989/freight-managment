'use client';

/**
 * Admin Settings Page
 *
 * Sprint 10 - Story 10.6: System Configuration
 *
 * Allows admins to configure platform settings
 */

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

interface SystemSettings {
  // Rate Limiting
  rateLimitDocumentUpload: number;
  rateLimitTruckPosting: number;
  rateLimitFileDownload: number;
  rateLimitAuthAttempts: number;

  // Match Scores
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

  // File Uploads
  maxFileUploadSizeMb: number;
  maxDocumentsPerEntity: number;

  // General
  platformMaintenanceMode: boolean;
  platformMaintenanceMessage: string | null;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [originalSettings, setOriginalSettings] = useState<SystemSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (settings && originalSettings) {
      setHasChanges(JSON.stringify(settings) !== JSON.stringify(originalSettings));
    }
  }, [settings, originalSettings]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }

      const data = await response.json();
      setSettings(data.settings);
      setOriginalSettings(data.settings);
    } catch (err: any) {
      setError(err.message || 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save settings');
      }

      const data = await response.json();
      setSettings(data.settings);
      setOriginalSettings(data.settings);
      setSuccess(true);
      setHasChanges(false);

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (originalSettings) {
      setSettings({ ...originalSettings });
      setHasChanges(false);
    }
  };

  const updateSetting = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Failed to load settings. Please try refreshing the page.</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-2">Configure platform-wide settings and preferences</p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 bg-green-50 border-green-200">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">Settings saved successfully!</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="rate-limits" className="space-y-6">
        <TabsList>
          <TabsTrigger value="rate-limits">Rate Limits</TabsTrigger>
          <TabsTrigger value="matching">Matching</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="fees">Platform Fees</TabsTrigger>
          <TabsTrigger value="files">File Uploads</TabsTrigger>
          <TabsTrigger value="general">General</TabsTrigger>
        </TabsList>

        {/* Rate Limits Tab */}
        <TabsContent value="rate-limits">
          <Card>
            <CardHeader>
              <CardTitle>Rate Limiting Configuration</CardTitle>
              <CardDescription>Control API request limits to prevent abuse</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="rateLimitDocumentUpload">Document Upload (per hour/user)</Label>
                  <Input
                    id="rateLimitDocumentUpload"
                    type="number"
                    min="1"
                    max="1000"
                    value={settings.rateLimitDocumentUpload}
                    onChange={(e) => updateSetting('rateLimitDocumentUpload', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rateLimitTruckPosting">Truck Posting (per day/carrier)</Label>
                  <Input
                    id="rateLimitTruckPosting"
                    type="number"
                    min="1"
                    max="1000"
                    value={settings.rateLimitTruckPosting}
                    onChange={(e) => updateSetting('rateLimitTruckPosting', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rateLimitFileDownload">File Download (per hour/user)</Label>
                  <Input
                    id="rateLimitFileDownload"
                    type="number"
                    min="1"
                    max="10000"
                    value={settings.rateLimitFileDownload}
                    onChange={(e) => updateSetting('rateLimitFileDownload', parseInt(e.target.value))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rateLimitAuthAttempts">Auth Attempts (per 15 min/IP)</Label>
                  <Input
                    id="rateLimitAuthAttempts"
                    type="number"
                    min="1"
                    max="100"
                    value={settings.rateLimitAuthAttempts}
                    onChange={(e) => updateSetting('rateLimitAuthAttempts', parseInt(e.target.value))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Matching Tab */}
        <TabsContent value="matching">
          <Card>
            <CardHeader>
              <CardTitle>Match Score Thresholds</CardTitle>
              <CardDescription>Configure truck/load matching score thresholds</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="matchScoreMinimum">Minimum Score</Label>
                  <Input
                    id="matchScoreMinimum"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.matchScoreMinimum}
                    onChange={(e) => updateSetting('matchScoreMinimum', parseInt(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">Matches below this won't be shown</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="matchScoreGood">Good Match</Label>
                  <Input
                    id="matchScoreGood"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.matchScoreGood}
                    onChange={(e) => updateSetting('matchScoreGood', parseInt(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">Score for "good" badge</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="matchScoreExcellent">Excellent Match</Label>
                  <Input
                    id="matchScoreExcellent"
                    type="number"
                    min="0"
                    max="100"
                    value={settings.matchScoreExcellent}
                    onChange={(e) => updateSetting('matchScoreExcellent', parseInt(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">Score for "excellent" badge</p>
                </div>
              </div>

              {settings.matchScoreMinimum >= settings.matchScoreGood && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Minimum score must be less than good score</AlertDescription>
                </Alert>
              )}

              {settings.matchScoreGood >= settings.matchScoreExcellent && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Good score must be less than excellent score</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Email Notification Settings</CardTitle>
              <CardDescription>Control when email notifications are sent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="emailNotificationsEnabled">Enable Email Notifications</Label>
                  <p className="text-sm text-gray-500">Master toggle for all email notifications</p>
                </div>
                <Switch
                  id="emailNotificationsEnabled"
                  checked={settings.emailNotificationsEnabled}
                  onCheckedChange={(checked) => updateSetting('emailNotificationsEnabled', checked)}
                />
              </div>

              <div className="border-t pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="emailNotifyDocumentApproval">Document Approval</Label>
                  <Switch
                    id="emailNotifyDocumentApproval"
                    checked={settings.emailNotifyDocumentApproval}
                    onCheckedChange={(checked) => updateSetting('emailNotifyDocumentApproval', checked)}
                    disabled={!settings.emailNotificationsEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="emailNotifyDocumentRejection">Document Rejection</Label>
                  <Switch
                    id="emailNotifyDocumentRejection"
                    checked={settings.emailNotifyDocumentRejection}
                    onCheckedChange={(checked) => updateSetting('emailNotifyDocumentRejection', checked)}
                    disabled={!settings.emailNotificationsEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="emailNotifyLoadAssignment">Load Assignment</Label>
                  <Switch
                    id="emailNotifyLoadAssignment"
                    checked={settings.emailNotifyLoadAssignment}
                    onCheckedChange={(checked) => updateSetting('emailNotifyLoadAssignment', checked)}
                    disabled={!settings.emailNotificationsEnabled}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="emailNotifyPodVerification">POD Verification</Label>
                  <Switch
                    id="emailNotifyPodVerification"
                    checked={settings.emailNotifyPodVerification}
                    onCheckedChange={(checked) => updateSetting('emailNotifyPodVerification', checked)}
                    disabled={!settings.emailNotificationsEnabled}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Platform Fees Tab */}
        <TabsContent value="fees">
          <Card>
            <CardHeader>
              <CardTitle>Platform Commission Rates</CardTitle>
              <CardDescription>Configure commission rates for shippers and carriers</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="shipperCommissionRate">Shipper Commission (%)</Label>
                  <Input
                    id="shipperCommissionRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.shipperCommissionRate}
                    onChange={(e) => updateSetting('shipperCommissionRate', parseFloat(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">Percentage charged to shippers</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="carrierCommissionRate">Carrier Commission (%)</Label>
                  <Input
                    id="carrierCommissionRate"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={settings.carrierCommissionRate}
                    onChange={(e) => updateSetting('carrierCommissionRate', parseFloat(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">Percentage charged to carriers</p>
                </div>
              </div>

              {(settings.shipperCommissionRate + settings.carrierCommissionRate) > 100 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>Total commission rates cannot exceed 100%</AlertDescription>
                </Alert>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-900 font-medium">Total Platform Revenue:</p>
                <p className="text-2xl font-bold text-blue-900 mt-1">
                  {(settings.shipperCommissionRate + settings.carrierCommissionRate).toFixed(2)}%
                </p>
                <p className="text-xs text-blue-700 mt-1">of transaction value</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* File Uploads Tab */}
        <TabsContent value="files">
          <Card>
            <CardHeader>
              <CardTitle>File Upload Limits</CardTitle>
              <CardDescription>Configure file upload restrictions</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="maxFileUploadSizeMb">Max File Size (MB)</Label>
                  <Input
                    id="maxFileUploadSizeMb"
                    type="number"
                    min="1"
                    max="100"
                    value={settings.maxFileUploadSizeMb}
                    onChange={(e) => updateSetting('maxFileUploadSizeMb', parseInt(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">Maximum file size for uploads</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxDocumentsPerEntity">Max Documents per Entity</Label>
                  <Input
                    id="maxDocumentsPerEntity"
                    type="number"
                    min="1"
                    max="50"
                    value={settings.maxDocumentsPerEntity}
                    onChange={(e) => updateSetting('maxDocumentsPerEntity', parseInt(e.target.value))}
                  />
                  <p className="text-sm text-gray-500">Max documents per load/truck/company</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* General Tab */}
        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Platform-wide general configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="platformMaintenanceMode">Maintenance Mode</Label>
                  <p className="text-sm text-gray-500">Put platform in maintenance mode</p>
                </div>
                <Switch
                  id="platformMaintenanceMode"
                  checked={settings.platformMaintenanceMode}
                  onCheckedChange={(checked) => updateSetting('platformMaintenanceMode', checked)}
                />
              </div>

              {settings.platformMaintenanceMode && (
                <div className="space-y-2">
                  <Label htmlFor="platformMaintenanceMessage">Maintenance Message</Label>
                  <Input
                    id="platformMaintenanceMessage"
                    type="text"
                    maxLength={500}
                    value={settings.platformMaintenanceMessage || ''}
                    onChange={(e) => updateSetting('platformMaintenanceMessage', e.target.value)}
                    placeholder="We're performing scheduled maintenance..."
                  />
                </div>
              )}

              <div className="border-t pt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="requireEmailVerification">Require Email Verification</Label>
                    <p className="text-sm text-gray-500">Users must verify email before accessing platform</p>
                  </div>
                  <Switch
                    id="requireEmailVerification"
                    checked={settings.requireEmailVerification}
                    onCheckedChange={(checked) => updateSetting('requireEmailVerification', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="requirePhoneVerification">Require Phone Verification</Label>
                    <p className="text-sm text-gray-500">Users must verify phone number before accessing platform</p>
                  </div>
                  <Switch
                    id="requirePhoneVerification"
                    checked={settings.requirePhoneVerification}
                    onCheckedChange={(checked) => updateSetting('requirePhoneVerification', checked)}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Save/Reset Buttons */}
      <div className="flex justify-between items-center mt-8 pt-6 border-t">
        <div className="text-sm text-gray-600">
          {hasChanges && '● Unsaved changes'}
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={!hasChanges || saving}
          >
            Reset Changes
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || saving}
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
