'use client';

import { useState, useEffect } from 'react';
import GpsStatusBadge from '@/components/GpsStatusBadge';

interface GpsDevice {
  id: string;
  imei: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SIGNAL_LOST' | 'MAINTENANCE' | 'OFFLINE';
  lastSeenAt: string | null;
  createdAt: string;
  truck: {
    id: string;
    licensePlate: string;
    carrier: {
      id: string;
      name: string;
    };
  } | null;
}

export default function GpsManagementClient() {
  const [devices, setDevices] = useState<GpsDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchDevices();
  }, [filterStatus]);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (filterStatus && filterStatus !== 'all') {
        params.append('status', filterStatus);
      }

      const response = await fetch(`/api/gps/devices?${params}`);

      if (!response.ok) {
        throw new Error('Failed to fetch GPS devices');
      }

      const data = await response.json();
      setDevices(data.devices || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyGps = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/gps/devices/${deviceId}/verify`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to verify GPS device');
      }

      fetchDevices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const handleRemoveDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to remove this GPS device?')) {
      return;
    }

    try {
      const response = await fetch(`/api/gps/devices/${deviceId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to remove GPS device');
      }

      fetchDevices();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  const filteredDevices = devices.filter(device => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesIMEI = device.imei.toLowerCase().includes(query);
      const matchesPlate = device.truck?.licensePlate.toLowerCase().includes(query);
      const matchesCarrier = device.truck?.carrier.name.toLowerCase().includes(query);

      return matchesIMEI || matchesPlate || matchesCarrier;
    }
    return true;
  });

  const getStatusCounts = () => {
    return {
      all: devices.length,
      ACTIVE: devices.filter(d => d.status === 'ACTIVE').length,
      INACTIVE: devices.filter(d => d.status === 'INACTIVE').length,
      SIGNAL_LOST: devices.filter(d => d.status === 'SIGNAL_LOST').length,
      OFFLINE: devices.filter(d => d.status === 'OFFLINE').length,
      MAINTENANCE: devices.filter(d => d.status === 'MAINTENANCE').length,
    };
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading GPS devices...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error}</p>
        <button
          onClick={fetchDevices}
          className="mt-2 text-red-600 hover:text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Total Devices</div>
          <div className="text-2xl font-bold text-gray-900">{statusCounts.all}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Active</div>
          <div className="text-2xl font-bold text-green-600">{statusCounts.ACTIVE}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Signal Lost</div>
          <div className="text-2xl font-bold text-red-600">{statusCounts.SIGNAL_LOST}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Offline</div>
          <div className="text-2xl font-bold text-gray-600">{statusCounts.OFFLINE}</div>
        </div>
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm text-gray-600">Maintenance</div>
          <div className="text-2xl font-bold text-yellow-600">{statusCounts.MAINTENANCE}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by IMEI, license plate, or carrier..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="SIGNAL_LOST">Signal Lost</option>
              <option value="OFFLINE">Offline</option>
              <option value="MAINTENANCE">Maintenance</option>
            </select>
            <button
              onClick={fetchDevices}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* GPS Devices Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                IMEI
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Truck
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Carrier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Last Seen
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Registered
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredDevices.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                  No GPS devices found
                </td>
              </tr>
            ) : (
              filteredDevices.map((device) => (
                <tr key={device.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {device.imei}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {device.truck ? (
                      <a
                        href={`/admin/trucks/${device.truck.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {device.truck.licensePlate}
                      </a>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {device.truck?.carrier ? (
                      <a
                        href={`/admin/organizations/${device.truck.carrier.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {device.truck.carrier.name}
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <GpsStatusBadge lastSeenAt={device.lastSeenAt ? new Date(device.lastSeenAt) : null} />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {device.lastSeenAt
                      ? new Date(device.lastSeenAt).toLocaleString()
                      : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {device.createdAt
                      ? new Date(device.createdAt).toLocaleDateString()
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleVerifyGps(device.id)}
                      className="text-blue-600 hover:text-blue-700 mr-3"
                    >
                      Verify
                    </button>
                    <button
                      onClick={() => handleRemoveDevice(device.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
