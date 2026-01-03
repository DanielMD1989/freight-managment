/**
 * Notification Preferences Component
 *
 * Phase 2 - Story 15.13: Real-time Notifications
 *
 * Allows users to manage their notification preferences including:
 * - Browser push notification permissions
 * - Email notification preferences
 * - Real-time notification settings
 */

'use client';

import { useState, useEffect } from 'react';
import { useNotificationPermission } from '@/hooks/useWebSocket';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Bell, BellOff, Check, X } from 'lucide-react';

interface NotificationPreference {
  type: string;
  label: string;
  description: string;
  enabled: boolean;
}

export default function NotificationPreferences() {
  const { permission, requestPermission, isSupported } = useNotificationPermission();
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    {
      type: 'GPS_OFFLINE',
      label: 'GPS Offline Alerts',
      description: 'Notify when truck GPS goes offline during active load',
      enabled: true,
    },
    {
      type: 'TRUCK_AT_PICKUP',
      label: 'Pickup Arrival',
      description: 'Notify when truck arrives at pickup location',
      enabled: true,
    },
    {
      type: 'TRUCK_AT_DELIVERY',
      label: 'Delivery Arrival',
      description: 'Notify when truck arrives at delivery location',
      enabled: true,
    },
    {
      type: 'POD_SUBMITTED',
      label: 'POD Submitted',
      description: 'Notify when proof of delivery is submitted',
      enabled: true,
    },
    {
      type: 'COMMISSION_DEDUCTED',
      label: 'Commission Deducted',
      description: 'Notify when commission is deducted from settlement',
      enabled: true,
    },
    {
      type: 'BYPASS_WARNING',
      label: 'Bypass Warnings',
      description: 'Notify about potential route bypasses',
      enabled: true,
    },
  ]);

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      const result = await requestPermission();
      if (result === 'granted') {
        // Show success notification
        new Notification('Notifications Enabled', {
          body: 'You will now receive real-time notifications from Freight Management Platform',
          icon: '/icon-192.png',
        });
      }
    } catch (error) {
      console.error('Failed to request notification permission:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTogglePreference = (type: string) => {
    setPreferences((prev) =>
      prev.map((pref) =>
        pref.type === type ? { ...pref, enabled: !pref.enabled } : pref
      )
    );
  };

  const handleSavePreferences = async () => {
    setIsLoading(true);
    try {
      // TODO: Save preferences to backend API
      const response = await fetch('/api/user/notification-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });

      if (response.ok) {
        console.log('Preferences saved successfully');
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestNotification = () => {
    if (permission === 'granted') {
      new Notification('Test Notification', {
        body: 'This is a test notification from Freight Management Platform',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Browser Notification Permission */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Browser Notifications
          </CardTitle>
          <CardDescription>
            Enable browser notifications to receive real-time alerts
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isSupported && (
            <div className="rounded-md bg-yellow-50 p-4">
              <p className="text-sm text-yellow-800">
                Browser notifications are not supported in your current browser.
              </p>
            </div>
          )}

          {isSupported && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Permission Status
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {permission === 'granted' && 'Notifications are enabled'}
                    {permission === 'denied' && 'Notifications are blocked'}
                    {permission === 'default' && 'Permission not requested'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {permission === 'granted' ? (
                    <div className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-1">
                      <Check className="h-4 w-4 text-green-600" />
                      <span className="text-sm text-green-700">Enabled</span>
                    </div>
                  ) : permission === 'denied' ? (
                    <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-1">
                      <X className="h-4 w-4 text-red-600" />
                      <span className="text-sm text-red-700">Blocked</span>
                    </div>
                  ) : (
                    <Button
                      onClick={handleRequestPermission}
                      disabled={isLoading}
                      size="sm"
                    >
                      Enable Notifications
                    </Button>
                  )}
                </div>
              </div>

              {permission === 'granted' && (
                <div className="flex gap-2">
                  <Button
                    onClick={handleTestNotification}
                    variant="outline"
                    size="sm"
                  >
                    Test Notification
                  </Button>
                </div>
              )}

              {permission === 'denied' && (
                <div className="rounded-md bg-red-50 p-4">
                  <p className="text-sm text-red-800">
                    You have blocked notifications. Please enable them in your browser settings.
                  </p>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Notification Type Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {preferences.map((pref) => (
            <div
              key={pref.type}
              className="flex items-center justify-between space-x-4 rounded-lg border p-4"
            >
              <div className="flex-1 space-y-1">
                <Label htmlFor={pref.type} className="text-sm font-medium">
                  {pref.label}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {pref.description}
                </p>
              </div>
              <Switch
                id={pref.type}
                checked={pref.enabled}
                onCheckedChange={() => handleTogglePreference(pref.type)}
              />
            </div>
          ))}

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSavePreferences}
              disabled={isLoading}
            >
              Save Preferences
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
