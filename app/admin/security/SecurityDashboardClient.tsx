/**
 * Security Dashboard Client Component
 * Sprint 9 - Security Hardening
 */

'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Shield, AlertTriangle, Download, XCircle, CheckCircle } from 'lucide-react';

interface SecurityEventDetails {
  [key: string]: string | number | boolean | null | undefined;
}

interface AuditLog {
  id: string;
  eventType: string;
  severity: string;
  userId?: string;
  ipAddress?: string;
  createdAt: string;
  details?: SecurityEventDetails;
}

interface SecurityStats {
  totalEvents: number;
  criticalEvents: number;
  blockedIPs: number;
  failedLogins: number;
}

export default function SecurityDashboardClient() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<SecurityStats>({
    totalEvents: 0,
    criticalEvents: 0,
    blockedIPs: 0,
    failedLogins: 0,
  });
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState({
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchSecurityData();
  }, []);

  async function fetchSecurityData() {
    try {
      setLoading(true);

      // Fetch audit logs
      const logsResponse = await fetch('/api/admin/audit-logs?limit=50');
      const logsData = await logsResponse.json();
      setAuditLogs(logsData.logs || []);

      // Calculate stats from logs
      const logs = logsData.logs || [];
      const criticalEvents = logs.filter((log: AuditLog) => log.severity === 'CRITICAL').length;
      const failedLogins = logs.filter(
        (log: AuditLog) =>
          log.eventType === 'AUTH_LOGIN_FAILURE' || log.eventType === 'BRUTE_FORCE'
      ).length;

      setStats({
        totalEvents: logs.length,
        criticalEvents,
        blockedIPs: 0, // Would need API endpoint
        failedLogins,
      });
    } catch (error) {
      console.error('Error fetching security data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function exportAuditLogs() {
    try {
      const params = new URLSearchParams({
        format: 'csv',
        limit: '1000',
      });

      if (dateFilter.startDate) {
        params.append('startDate', dateFilter.startDate);
      }

      if (dateFilter.endDate) {
        params.append('endDate', dateFilter.endDate);
      }

      const response = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
    } catch (error) {
      console.error('Error exporting audit logs:', error);
    }
  }

  function getSeverityBadge(severity: string) {
    const colors: Record<string, string> = {
      INFO: 'bg-blue-100 text-blue-800',
      WARNING: 'bg-yellow-100 text-yellow-800',
      ERROR: 'bg-orange-100 text-orange-800',
      CRITICAL: 'bg-red-100 text-red-800',
    };

    return (
      <Badge className={colors[severity] || 'bg-gray-100 text-gray-800'}>{severity}</Badge>
    );
  }

  function getEventIcon(eventType: string) {
    if (eventType.includes('FAILURE') || eventType.includes('BLOCKED')) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    if (eventType.includes('SUCCESS')) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-center">Loading security dashboard...</div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8" />
            Security Dashboard
          </h1>
          <p className="text-gray-600 mt-1">Monitor security events and audit logs</p>
        </div>
        <Button onClick={exportAuditLogs} className="flex items-center gap-2">
          <Download className="h-4 w-4" />
          Export Logs
        </Button>
      </div>

      {/* Security Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.totalEvents}</div>
            <p className="text-sm text-gray-600">Total Events (24h)</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-red-600">{stats.criticalEvents}</div>
            <p className="text-sm text-gray-600">Critical Events</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{stats.failedLogins}</div>
            <p className="text-sm text-gray-600">Failed Logins</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-yellow-600">{stats.blockedIPs}</div>
            <p className="text-sm text-gray-600">Blocked IPs</p>
          </CardContent>
        </Card>
      </div>

      {/* Date Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <Input
                type="date"
                value={dateFilter.startDate}
                onChange={(e) =>
                  setDateFilter({ ...dateFilter, startDate: e.target.value })
                }
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-1">End Date</label>
              <Input
                type="date"
                value={dateFilter.endDate}
                onChange={(e) => setDateFilter({ ...dateFilter, endDate: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={fetchSecurityData}>Apply Filters</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Security Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Security Events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>IP Address</TableHead>
                <TableHead>User ID</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {auditLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getEventIcon(log.eventType)}
                      <span className="text-sm">{log.eventType}</span>
                    </div>
                  </TableCell>
                  <TableCell>{getSeverityBadge(log.severity)}</TableCell>
                  <TableCell>
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {log.ipAddress || 'N/A'}
                    </code>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs">
                      {log.userId?.substring(0, 8) || 'N/A'}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div className="max-w-xs truncate text-xs text-gray-600">
                      {JSON.stringify(log.details || {})}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {auditLogs.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No security events found
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
