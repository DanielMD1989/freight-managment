/**
 * Settlement Automation Client Component
 *
 * Client-side dashboard for settlement automation monitoring
 */

'use client';

import { useEffect, useState } from 'react';
import { getCSRFToken } from '@/lib/csrfFetch';

interface SettlementStats {
  pendingPODSubmission: number;
  pendingPODVerification: number;
  readyForSettlement: number;
  settled: number;
  disputes: number;
}

interface AutomationResult {
  action: string;
  autoVerifiedCount?: number;
  settledCount?: number;
}

export default function SettlementAutomationClient() {
  const [stats, setStats] = useState<SettlementStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastRun, setLastRun] = useState<string | null>(null);
  const [result, setResult] = useState<AutomationResult | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/settlement-automation');

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
      } else {
        console.error('Failed to fetch stats');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const runAutomation = async (action: 'auto-verify' | 'process-settlements' | 'full') => {
    if (!confirm(`Run settlement automation (${action})?`)) {
      return;
    }

    try {
      setRunning(true);
      setResult(null);

      const csrfToken = await getCSRFToken();
      const response = await fetch(
        `/api/admin/settlement-automation?action=${action}`,
        { method: 'POST', headers: { ...(csrfToken && { 'X-CSRF-Token': csrfToken }) } }
      );

      if (response.ok) {
        const data = await response.json();
        setStats(data.stats);
        setResult(data.result);
        setLastRun(data.timestamp);
        alert(
          `Automation complete!\n${action === 'auto-verify' ? 'Auto-verified: ' + data.result.autoVerifiedCount : action === 'process-settlements' ? 'Settled: ' + data.result.settledCount : 'Auto-verified: ' + data.result.autoVerifiedCount + ', Settled: ' + data.result.settledCount}`
        );
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to run automation'}`);
      }
    } catch (error: any) {
      alert('Failed to run automation');
      console.error('Automation error:', error);
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="text-gray-600 mt-4">Loading settlement statistics...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-red-800 font-semibold mb-2">Error</h3>
        <p className="text-red-700">Failed to load settlement statistics</p>
        <button
          onClick={fetchStats}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Manual Controls
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => runAutomation('auto-verify')}
            disabled={running}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Auto-Verify Expired PODs
          </button>
          <button
            onClick={() => runAutomation('process-settlements')}
            disabled={running}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Process Ready Settlements
          </button>
          <button
            onClick={() => runAutomation('full')}
            disabled={running}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Run Full Automation
          </button>
          <button
            onClick={fetchStats}
            disabled={running}
            className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            Refresh Stats
          </button>
        </div>
        {lastRun && (
          <p className="text-sm text-gray-500 mt-3">
            Last run: {new Date(lastRun).toLocaleString()}
          </p>
        )}
      </div>

      {/* Last Run Result */}
      {result && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="font-semibold text-green-900 mb-2">
            ✓ Last Automation Result
          </h3>
          <div className="text-sm text-green-800">
            <p>Action: {result.action}</p>
            {result.autoVerifiedCount !== undefined && (
              <p>Auto-verified PODs: {result.autoVerifiedCount}</p>
            )}
            {result.settledCount !== undefined && (
              <p>Processed settlements: {result.settledCount}</p>
            )}
          </div>
        </div>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {/* Pending POD Submission */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending POD Submission</p>
              <p className="text-3xl font-bold text-yellow-600 mt-1">
                {stats.pendingPODSubmission}
              </p>
            </div>
            <svg
              className="w-12 h-12 text-yellow-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
              <path
                fillRule="evenodd"
                d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Delivered, awaiting carrier POD upload
          </p>
        </div>

        {/* Pending POD Verification */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Verification</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">
                {stats.pendingPODVerification}
              </p>
            </div>
            <svg
              className="w-12 h-12 text-orange-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Auto-verifies after 24 hours
          </p>
        </div>

        {/* Ready for Settlement */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ready for Settlement</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">
                {stats.readyForSettlement}
              </p>
            </div>
            <svg
              className="w-12 h-12 text-blue-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
              <path
                fillRule="evenodd"
                d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            POD verified, processing service fees
          </p>
        </div>

        {/* Settled */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Settled</p>
              <p className="text-3xl font-bold text-green-600 mt-1">
                {stats.settled}
              </p>
            </div>
            <svg
              className="w-12 h-12 text-green-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Service fees deducted successfully
          </p>
        </div>

        {/* Disputes */}
        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Disputes</p>
              <p className="text-3xl font-bold text-red-600 mt-1">
                {stats.disputes}
              </p>
            </div>
            <svg
              className="w-12 h-12 text-red-200"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Settlement failed, requires manual review
          </p>
        </div>
      </div>

      {/* Information Panel */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-3">
          How Settlement Automation Works
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span className="font-bold">1.</span>
            <span>
              When a load is delivered, carrier uploads Proof of Delivery (POD)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">2.</span>
            <span>
              Shipper has 24 hours to verify POD (check delivery confirmation)
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">3.</span>
            <span>
              If shipper doesn't respond within 24 hours, POD is automatically
              verified
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">4.</span>
            <span>
              Once POD is verified, corridor-based service fees are deducted from
              wallets
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="font-bold">5.</span>
            <span>
              Settlement status changes to "PAID" and platform revenue is recorded
            </span>
          </li>
        </ul>
        <div className="mt-4 p-3 bg-blue-100 rounded">
          <p className="text-sm text-blue-900">
            <strong>Note:</strong> Run automation manually or schedule it via cron
            job for automatic processing. Recommended: Run every 30 minutes.
          </p>
        </div>
      </div>
    </div>
  );
}
