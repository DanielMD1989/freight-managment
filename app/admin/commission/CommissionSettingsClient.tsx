'use client';

import { useState, useEffect } from 'react';

interface CommissionRates {
  current: {
    shipperRate: number;
    carrierRate: number;
    totalRate: number;
  };
  history: Array<{
    id: string;
    shipperRate: number;
    carrierRate: number;
    effectiveFrom: string;
    effectiveTo: string | null;
    isActive: boolean;
    createdAt: string;
  }>;
}

export default function CommissionSettingsClient() {
  const [rates, setRates] = useState<CommissionRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [shipperRate, setShipperRate] = useState('');
  const [carrierRate, setCarrierRate] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRates();
  }, []);

  const fetchRates = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/admin/commission-rates');

      if (!response.ok) {
        throw new Error('Failed to fetch commission rates');
      }

      const data = await response.json();
      setRates(data);
      setShipperRate(data.current.shipperRate.toString());
      setCarrierRate(data.current.carrierRate.toString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);

      const response = await fetch('/api/admin/commission-rates', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          shipperRate: parseFloat(shipperRate),
          carrierRate: parseFloat(carrierRate),
          effectiveFrom: effectiveDate || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update commission rates');
      }

      await fetchRates();
      setIsEditing(false);
      setEffectiveDate('');
      alert('Commission rates updated successfully!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (rates) {
      setShipperRate(rates.current.shipperRate.toString());
      setCarrierRate(rates.current.carrierRate.toString());
      setEffectiveDate('');
    }
    setIsEditing(false);
    setError(null);
  };

  const totalRate = parseFloat(shipperRate || '0') + parseFloat(carrierRate || '0');

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading commission settings...</p>
        </div>
      </div>
    );
  }

  if (!rates) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">{error || 'Failed to load commission rates'}</p>
        <button
          onClick={fetchRates}
          className="mt-2 text-red-600 hover:text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Rates Card */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900">Current Commission Rates</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit Rates
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shipper Commission Rate
            </label>
            {isEditing ? (
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={shipperRate}
                  onChange={(e) => setShipperRate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-3 text-gray-500">%</span>
              </div>
            ) : (
              <div className="text-3xl font-bold text-blue-600">
                {rates.current.shipperRate}%
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Carrier Commission Rate
            </label>
            {isEditing ? (
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={carrierRate}
                  onChange={(e) => setCarrierRate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <span className="absolute right-3 top-3 text-gray-500">%</span>
              </div>
            ) : (
              <div className="text-3xl font-bold text-green-600">
                {rates.current.carrierRate}%
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Total Platform Rate
            </label>
            <div className={`text-3xl font-bold ${isEditing ? 'text-gray-700' : 'text-purple-600'}`}>
              {isEditing ? totalRate.toFixed(2) : rates.current.totalRate}%
            </div>
          </div>
        </div>

        {isEditing && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Effective Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-sm text-gray-500 mt-1">
              Leave empty to apply immediately
            </p>
          </div>
        )}

        {isEditing && (
          <div className="flex gap-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Rate Change History */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-6">Rate Change History</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shipper Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Carrier Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effective From
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Effective To
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {rates.history.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                    No rate change history
                  </td>
                </tr>
              ) : (
                rates.history.map((rate) => (
                  <tr key={rate.id} className={rate.isActive ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rate.shipperRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {rate.carrierRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {(rate.shipperRate + rate.carrierRate).toFixed(2)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {rate.effectiveFrom ? new Date(rate.effectiveFrom).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {rate.effectiveTo ? new Date(rate.effectiveTo).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {rate.isActive ? (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          Active
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          Inactive
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Revenue Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-3">
          How Commission Works
        </h3>
        <div className="space-y-2 text-sm text-blue-800">
          <p>
            <strong>Shipper Commission ({rates.current.shipperRate}%):</strong> Deducted from the load price when a shipper posts a load.
          </p>
          <p>
            <strong>Carrier Commission ({rates.current.carrierRate}%):</strong> Deducted from the payment when a carrier completes a delivery.
          </p>
          <p>
            <strong>Example:</strong> For a load priced at 10,000 ETB:
          </p>
          <ul className="list-disc list-inside ml-4">
            <li>Shipper pays: 10,{(10000 * (1 + rates.current.shipperRate / 100)).toFixed(0)} ETB (including {rates.current.shipperRate}% commission)</li>
            <li>Carrier receives: {(10000 * (1 - rates.current.carrierRate / 100)).toFixed(0)} ETB (after {rates.current.carrierRate}% commission)</li>
            <li>Platform revenue: {(10000 * (rates.current.shipperRate + rates.current.carrierRate) / 100).toFixed(0)} ETB</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
