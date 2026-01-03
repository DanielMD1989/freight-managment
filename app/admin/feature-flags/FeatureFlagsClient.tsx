'use client';

/**
 * Feature Flags Client Component
 *
 * Sprint 10 - Story 10.7: Feature Flag System
 */

import { useState } from 'react';

interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  category: 'core' | 'experimental' | 'beta' | 'deprecated';
  rolloutPercentage: number;
  lastModifiedAt: string;
  lastModifiedBy: string;
}

const INITIAL_FLAGS: FeatureFlag[] = [
  {
    id: '1',
    key: 'gps_tracking',
    name: 'GPS Tracking',
    description: 'Enable real-time GPS tracking for trucks',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
  {
    id: '2',
    key: 'real_time_notifications',
    name: 'Real-time Notifications',
    description: 'WebSocket-based real-time notifications',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
  {
    id: '3',
    key: 'auto_settlement',
    name: 'Auto Settlement',
    description: 'Automatically settle loads after delivery confirmation',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
  {
    id: '4',
    key: 'advanced_matching',
    name: 'Advanced Matching Algorithm',
    description: 'ML-based load-truck matching recommendations',
    enabled: false,
    category: 'experimental',
    rolloutPercentage: 0,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
  {
    id: '5',
    key: 'route_optimization',
    name: 'Route Optimization',
    description: 'Suggest optimal routes for multi-stop loads',
    enabled: false,
    category: 'beta',
    rolloutPercentage: 0,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
  {
    id: '6',
    key: 'document_ocr',
    name: 'Document OCR',
    description: 'Automatic extraction of document data using OCR',
    enabled: false,
    category: 'experimental',
    rolloutPercentage: 0,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
  {
    id: '7',
    key: 'sms_notifications',
    name: 'SMS Notifications',
    description: 'Send SMS notifications to users',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
  {
    id: '8',
    key: 'bypass_detection',
    name: 'GPS Bypass Detection',
    description: 'Detect when GPS devices are tampered with',
    enabled: true,
    category: 'core',
    rolloutPercentage: 100,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
  {
    id: '9',
    key: 'dark_mode',
    name: 'Dark Mode',
    description: 'Enable dark mode UI theme',
    enabled: false,
    category: 'beta',
    rolloutPercentage: 0,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
  {
    id: '10',
    key: 'api_v2',
    name: 'API v2 Endpoints',
    description: 'Enable new v2 API endpoints',
    enabled: false,
    category: 'deprecated',
    rolloutPercentage: 0,
    lastModifiedAt: new Date().toISOString(),
    lastModifiedBy: 'System',
  },
];

export default function FeatureFlagsClient() {
  const [flags, setFlags] = useState<FeatureFlag[]>(INITIAL_FLAGS);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState<string | null>(null);

  const handleToggle = async (flagId: string) => {
    setSaving(flagId);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));

    setFlags(prev =>
      prev.map(flag =>
        flag.id === flagId
          ? {
              ...flag,
              enabled: !flag.enabled,
              lastModifiedAt: new Date().toISOString(),
              lastModifiedBy: 'Admin',
            }
          : flag
      )
    );

    setSaving(null);
  };

  const handleRolloutChange = async (flagId: string, percentage: number) => {
    setFlags(prev =>
      prev.map(flag =>
        flag.id === flagId
          ? {
              ...flag,
              rolloutPercentage: percentage,
              lastModifiedAt: new Date().toISOString(),
              lastModifiedBy: 'Admin',
            }
          : flag
      )
    );
  };

  const filteredFlags = flags.filter(flag => {
    if (filterCategory !== 'all' && flag.category !== filterCategory) {
      return false;
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        flag.name.toLowerCase().includes(query) ||
        flag.key.toLowerCase().includes(query) ||
        flag.description.toLowerCase().includes(query)
      );
    }

    return true;
  });

  const getCategoryBadge = (category: FeatureFlag['category']) => {
    const styles = {
      core: 'bg-blue-100 text-blue-800',
      experimental: 'bg-purple-100 text-purple-800',
      beta: 'bg-yellow-100 text-yellow-800',
      deprecated: 'bg-gray-100 text-gray-800',
    };

    const labels = {
      core: 'Core',
      experimental: 'Experimental',
      beta: 'Beta',
      deprecated: 'Deprecated',
    };

    return (
      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${styles[category]}`}>
        {labels[category]}
      </span>
    );
  };

  const stats = {
    total: flags.length,
    enabled: flags.filter(f => f.enabled).length,
    core: flags.filter(f => f.category === 'core').length,
    experimental: flags.filter(f => f.category === 'experimental').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Total Flags</div>
          <div className="text-2xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Enabled</div>
          <div className="text-2xl font-bold text-green-600">{stats.enabled}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Core Features</div>
          <div className="text-2xl font-bold text-blue-600">{stats.core}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Experimental</div>
          <div className="text-2xl font-bold text-purple-600">{stats.experimental}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search flags..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Categories</option>
              <option value="core">Core</option>
              <option value="beta">Beta</option>
              <option value="experimental">Experimental</option>
              <option value="deprecated">Deprecated</option>
            </select>
          </div>
        </div>
      </div>

      {/* Flags List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
        {filteredFlags.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No feature flags found
          </div>
        ) : (
          filteredFlags.map(flag => (
            <div key={flag.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-gray-900">{flag.name}</h3>
                    {getCategoryBadge(flag.category)}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{flag.description}</p>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <code className="bg-gray-100 px-2 py-0.5 rounded">{flag.key}</code>
                    <span>Modified: {new Date(flag.lastModifiedAt).toLocaleDateString()}</span>
                    <span>By: {flag.lastModifiedBy}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  {/* Rollout Percentage */}
                  {flag.enabled && (
                    <div className="text-right">
                      <label className="text-xs text-gray-500 block mb-1">Rollout</label>
                      <select
                        value={flag.rolloutPercentage}
                        onChange={(e) => handleRolloutChange(flag.id, Number(e.target.value))}
                        className="text-sm border border-gray-300 rounded px-2 py-1"
                      >
                        <option value={0}>0%</option>
                        <option value={10}>10%</option>
                        <option value={25}>25%</option>
                        <option value={50}>50%</option>
                        <option value={75}>75%</option>
                        <option value={100}>100%</option>
                      </select>
                    </div>
                  )}

                  {/* Toggle Switch */}
                  <button
                    onClick={() => handleToggle(flag.id)}
                    disabled={saving === flag.id}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${flag.enabled ? 'bg-green-500' : 'bg-gray-300'}
                      ${saving === flag.id ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${flag.enabled ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Warning */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <div className="flex gap-2">
          <span className="text-yellow-600">⚠</span>
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Caution: Feature flag changes take effect immediately
            </p>
            <p className="text-sm text-yellow-700 mt-1">
              Disabling core features may affect platform functionality. Changes are logged in the audit trail.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
