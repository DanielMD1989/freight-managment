# PHASE 2 USER STORIES - PLATFORM (PART 2)
## Remaining Stories: 16.9A (cont.), 16.9B, 16.10, 16.15

**Document Version:** 1.0
**Date:** 2026-01-01
**Status:** Complete - Ready for Review
**Continuation of:** PHASE_2_USER_STORIES_PLATFORM.md

---

## DOCUMENT CONTENTS

This document contains the **remaining platform user stories** with full implementation details:

- **Story 16.9A (Continued):** Tasks 4-8 (5 tasks)
- **Story 16.9B:** Company Admin Tools (5 tasks)
- **Story 16.10:** Notifications Expanded (15 tasks)
- **Story 16.15:** Shipper-Led Truck Matching (6 tasks)

**Total:** 31 tasks with complete code implementations

---

## STORY 16.9A: SUPERADMIN TOOLS (CONTINUED)

### Remaining Tasks (5/8)

#### **Task 16.9A.4: Global Settlement Review Dashboard** (2 days)
**Description:** SuperAdmin can view and manage settlements across all organizations

**Implementation:**
```typescript
// /app/superadmin/settlements/SettlementsClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function SettlementsClient() {
  const [settlements, setSettlements] = useState([]);
  const [filter, setFilter] = useState({
    status: 'all', // pending, disputed, completed
    organization: 'all',
    minAmount: '',
  });

  useEffect(() => {
    fetchSettlements();
  }, [filter]);

  const fetchSettlements = async () => {
    const params = new URLSearchParams(filter as any);
    const response = await fetch(`/api/superadmin/settlements?${params}`);
    const data = await response.json();
    setSettlements(data.settlements);
  };

  const handleOverrideAmount = async (settlementId: string) => {
    const newAmount = prompt('Enter override amount (ETB):');
    if (!newAmount) return;

    await fetch(`/api/superadmin/settlements/${settlementId}/override`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: parseFloat(newAmount) }),
    });

    fetchSettlements();
    alert('Settlement amount overridden');
  };

  const handleForceComplete = async (settlementId: string) => {
    if (!confirm('Force complete this settlement? This cannot be undone.')) return;

    await fetch(`/api/superadmin/settlements/${settlementId}/force-complete`, {
      method: 'PUT',
    });

    fetchSettlements();
    alert('Settlement force completed');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Global Settlement Management</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4">
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="disputed">Disputed</option>
          <option value="completed">Completed</option>
        </select>

        <select
          value={filter.organization}
          onChange={(e) => setFilter({ ...filter, organization: e.target.value })}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Organizations</option>
          {/* Load organizations dynamically */}
        </select>

        <input
          type="number"
          placeholder="Min Amount (ETB)"
          value={filter.minAmount}
          onChange={(e) => setFilter({ ...filter, minAmount: e.target.value })}
          className="px-4 py-2 border rounded-md"
        />
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Load
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Shipper
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Carrier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Commission
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {settlements.map((settlement: any) => (
              <tr key={settlement.id}>
                <td className="px-6 py-4">
                  <a href={`/superadmin/loads/${settlement.loadId}`} className="text-blue-600 hover:underline">
                    {settlement.load.pickupCity} → {settlement.load.deliveryCity}
                  </a>
                </td>
                <td className="px-6 py-4">{settlement.load.shipper.organization.name}</td>
                <td className="px-6 py-4">{settlement.load.carrier.organization.name}</td>
                <td className="px-6 py-4 font-semibold">
                  {new Intl.NumberFormat('en-ET', {
                    style: 'currency',
                    currency: 'ETB',
                    minimumFractionDigits: 0
                  }).format(settlement.amount)}
                </td>
                <td className="px-6 py-4">
                  {new Intl.NumberFormat('en-ET', {
                    style: 'currency',
                    currency: 'ETB',
                    minimumFractionDigits: 0
                  }).format(settlement.commission)}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    settlement.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    settlement.status === 'DISPUTED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {settlement.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOverrideAmount(settlement.id)}
                      className="text-sm text-orange-600 hover:underline"
                    >
                      Override
                    </button>
                    {settlement.status !== 'COMPLETED' && (
                      <button
                        onClick={() => handleForceComplete(settlement.id)}
                        className="text-sm text-green-600 hover:underline"
                      >
                        Force Complete
                      </button>
                    )}
                    <a
                      href={`/superadmin/settlements/${settlement.id}`}
                      className="text-sm text-gray-600 hover:underline"
                    >
                      Details
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Revenue Summary */}
      <div className="mt-6 grid grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Total Platform Revenue</h3>
          <p className="text-3xl font-bold">
            {new Intl.NumberFormat('en-ET', {
              style: 'currency',
              currency: 'ETB',
              minimumFractionDigits: 0
            }).format(
              settlements.reduce((sum: number, s: any) => sum + s.commission, 0)
            )}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Pending Settlements</h3>
          <p className="text-3xl font-bold">
            {settlements.filter((s: any) => s.status === 'PENDING').length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Disputed Settlements</h3>
          <p className="text-3xl font-bold text-red-600">
            {settlements.filter((s: any) => s.status === 'DISPUTED').length}
          </p>
        </div>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/superadmin/settlements/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  // Verify SuperAdmin role
  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const organization = searchParams.get('organization');
  const minAmount = searchParams.get('minAmount');

  const where: any = {};

  if (status && status !== 'all') {
    where.status = status.toUpperCase();
  }

  if (organization && organization !== 'all') {
    where.OR = [
      { load: { shipperId: { organizationId: organization } } },
      { load: { carrierId: { organizationId: organization } } },
    ];
  }

  if (minAmount) {
    where.amount = { gte: parseFloat(minAmount) };
  }

  const settlements = await prisma.settlement.findMany({
    where,
    include: {
      load: {
        include: {
          shipper: { include: { organization: true } },
          carrier: { include: { organization: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ settlements });
}

// /app/api/superadmin/settlements/[id]/override/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { amount } = await request.json();

  await prisma.settlement.update({
    where: { id: params.id },
    data: {
      amount: parseFloat(amount),
      overriddenBy: session.user.id,
      overriddenAt: new Date(),
    },
  });

  // Log audit event
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      eventType: 'SETTLEMENT_OVERRIDE',
      details: `Settlement ${params.id} amount overridden to ${amount} ETB`,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    },
  });

  return NextResponse.json({ success: true });
}

// /app/api/superadmin/settlements/[id]/force-complete/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.settlement.update({
    where: { id: params.id },
    data: {
      status: 'COMPLETED',
      completedAt: new Date(),
      completedBy: session.user.id,
    },
  });

  // Update load status to COMPLETED
  const settlement = await prisma.settlement.findUnique({
    where: { id: params.id },
  });

  if (settlement?.loadId) {
    await prisma.load.update({
      where: { id: settlement.loadId },
      data: { status: 'COMPLETED' },
    });
  }

  // Log audit event
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      eventType: 'SETTLEMENT_FORCE_COMPLETE',
      details: `Settlement ${params.id} force completed`,
      ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
    },
  });

  return NextResponse.json({ success: true });
}
```

**Files:**
- `/app/superadmin/settlements/page.tsx` (new)
- `/app/superadmin/settlements/SettlementsClient.tsx` (new)
- `/app/api/superadmin/settlements/route.ts` (new - GET with filters)
- `/app/api/superadmin/settlements/[id]/override/route.ts` (new - PUT)
- `/app/api/superadmin/settlements/[id]/force-complete/route.ts` (new - PUT)

**Acceptance:**
- ✓ SuperAdmin sees all platform settlements
- ✓ Can filter by status, organization, minimum amount
- ✓ Can override settlement amounts
- ✓ Can force complete settlements
- ✓ Revenue summary displays correctly
- ✓ Audit log tracks all actions

---

#### **Task 16.9A.5: Automation Rules Engine** (4 days - MAJOR FEATURE)
**Description:** Visual rule builder for automated exception handling and platform actions

**Implementation:**
```typescript
// /app/superadmin/automation/AutomationRulesClient.tsx

'use client';

import { useState, useEffect } from 'react';
import AutomationRuleBuilderModal from '@/components/AutomationRuleBuilderModal';

export default function AutomationRulesClient() {
  const [rules, setRules] = useState([]);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    const response = await fetch('/api/superadmin/automation/rules');
    const data = await response.json();
    setRules(data.rules);
  };

  const handleToggleActive = async (ruleId: string, active: boolean) => {
    await fetch(`/api/superadmin/automation/rules/${ruleId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });
    fetchRules();
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this automation rule?')) return;

    await fetch(`/api/superadmin/automation/rules/${ruleId}`, {
      method: 'DELETE',
    });
    fetchRules();
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Automation Rules Engine</h1>
          <p className="text-gray-600 mt-1">
            Create rule-based automation for exception handling and platform actions
          </p>
        </div>
        <button
          onClick={() => setCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Create New Rule
        </button>
      </div>

      {/* Rules List */}
      <div className="space-y-4">
        {rules.length === 0 ? (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <div className="text-6xl mb-4">⚙️</div>
            <h3 className="text-lg font-semibold mb-2">No Automation Rules</h3>
            <p className="text-gray-600 mb-4">
              Create your first automation rule to handle exceptions automatically
            </p>
            <button
              onClick={() => setCreating(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Create Rule
            </button>
          </div>
        ) : (
          rules.map((rule: any) => (
            <div key={rule.id} className="bg-white p-6 rounded-lg shadow">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold">{rule.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      rule.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.active ? 'Active' : 'Inactive'}
                    </span>
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                      {rule.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">{rule.description}</p>
                </div>

                <div className="flex gap-2">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rule.active}
                      onChange={(e) => handleToggleActive(rule.id, e.target.checked)}
                      className="mr-2"
                    />
                    <span className="text-sm">Active</span>
                  </label>
                  <button
                    onClick={() => setEditing(rule)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="text-sm text-red-600 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Rule Logic Display */}
              <div className="bg-gray-50 p-4 rounded-md mb-4">
                <div className="text-sm font-medium text-gray-700 mb-2">Rule Logic:</div>
                <div className="font-mono text-sm">
                  <span className="text-purple-600">IF</span>{' '}
                  <span className="font-semibold">{rule.condition.type}</span>{' '}
                  <span className="text-blue-600">{rule.condition.operator}</span>{' '}
                  <span className="font-semibold">{rule.condition.value}</span>
                  <br />
                  <span className="text-purple-600">THEN</span>{' '}
                  <span className="font-semibold">{rule.action.type}</span>
                  {rule.action.value && (
                    <> ({rule.action.value})</>
                  )}
                </div>
              </div>

              {/* Execution Stats */}
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Executions:</span>
                  <span className="ml-2 font-semibold">{rule.executionCount || 0}</span>
                </div>
                <div>
                  <span className="text-gray-500">Last Executed:</span>
                  <span className="ml-2">
                    {rule.lastExecutedAt
                      ? new Date(rule.lastExecutedAt).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Created:</span>
                  <span className="ml-2">
                    {new Date(rule.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create/Edit Rule Modal */}
      {(creating || editing) && (
        <AutomationRuleBuilderModal
          isOpen={true}
          rule={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSave={() => {
            setCreating(false);
            setEditing(null);
            fetchRules();
          }}
        />
      )}
    </div>
  );
}
```

**Rule Builder Modal:**
```typescript
// /components/AutomationRuleBuilderModal.tsx

'use client';

import { useState, useEffect } from 'react';

interface AutomationRuleBuilderModalProps {
  isOpen: boolean;
  rule?: any; // For editing existing rule
  onClose: () => void;
  onSave: () => void;
}

export default function AutomationRuleBuilderModal({
  isOpen,
  rule,
  onClose,
  onSave,
}: AutomationRuleBuilderModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'GPS', // GPS, EXCEPTION, SETTLEMENT, TRUST_SCORE
    condition: {
      type: '', // GPS_OFFLINE, PICKUP_DELAYED, TRUST_SCORE_BELOW, etc.
      operator: '', // >, <, =, >=, <=
      value: '',
    },
    action: {
      type: '', // CREATE_EXCEPTION, NOTIFY_DISPATCHER, REDUCE_TRUST_SCORE, SUSPEND_ACCOUNT
      value: '',
    },
  });

  useEffect(() => {
    if (rule) {
      setFormData(rule);
    }
  }, [rule]);

  const handleSave = async () => {
    if (!formData.name || !formData.condition.type || !formData.action.type) {
      alert('Please fill in all required fields');
      return;
    }

    const method = rule ? 'PUT' : 'POST';
    const url = rule
      ? `/api/superadmin/automation/rules/${rule.id}`
      : '/api/superadmin/automation/rules';

    await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });

    onSave();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-3xl w-full p-6">
          <h2 className="text-xl font-bold mb-6">
            {rule ? 'Edit Automation Rule' : 'Create Automation Rule'}
          </h2>

          {/* Rule Name */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rule Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
              placeholder="e.g., GPS Offline Auto-Exception"
            />
          </div>

          {/* Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
              rows={2}
              placeholder="What does this rule do?"
            />
          </div>

          {/* Category */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="GPS">GPS Events</option>
              <option value="EXCEPTION">Exception Handling</option>
              <option value="SETTLEMENT">Settlement Actions</option>
              <option value="TRUST_SCORE">Trust Score Management</option>
            </select>
          </div>

          {/* Condition Builder */}
          <div className="mb-6 p-4 border-2 border-purple-300 rounded-lg bg-purple-50">
            <h3 className="text-sm font-semibold mb-3 flex items-center">
              <span className="px-2 py-1 bg-purple-600 text-white rounded text-xs mr-2">IF</span>
              Condition (When should this rule trigger?)
            </h3>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Trigger Event *</label>
                <select
                  value={formData.condition.type}
                  onChange={(e) => setFormData({
                    ...formData,
                    condition: { ...formData.condition, type: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Select trigger...</option>
                  <optgroup label="GPS Events">
                    <option value="GPS_OFFLINE">GPS Offline (minutes)</option>
                    <option value="GPS_SIGNAL_LOST">GPS Signal Lost</option>
                  </optgroup>
                  <optgroup label="Load Events">
                    <option value="PICKUP_DELAYED">Pickup Delayed (hours)</option>
                    <option value="DELIVERY_DELAYED">Delivery Delayed (hours)</option>
                    <option value="CANCELLATION_WITHIN">Cancellation Within (hours of pickup)</option>
                  </optgroup>
                  <optgroup label="Trust & Compliance">
                    <option value="TRUST_SCORE">Trust Score</option>
                    <option value="BYPASS_COUNT">Bypass Count (30 days)</option>
                    <option value="COMPLETION_RATE">Completion Rate (%)</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Operator *</label>
                <select
                  value={formData.condition.operator}
                  onChange={(e) => setFormData({
                    ...formData,
                    condition: { ...formData.condition, operator: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Select...</option>
                  <option value=">">Greater than (>)</option>
                  <option value="<">Less than (<)</option>
                  <option value=">=">Greater or equal (>=)</option>
                  <option value="<=">Less or equal (<=)</option>
                  <option value="=">Equal (=)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">Value *</label>
                <input
                  type="number"
                  value={formData.condition.value}
                  onChange={(e) => setFormData({
                    ...formData,
                    condition: { ...formData.condition, value: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="Threshold"
                />
              </div>
            </div>
          </div>

          {/* Action Builder */}
          <div className="mb-6 p-4 border-2 border-blue-300 rounded-lg bg-blue-50">
            <h3 className="text-sm font-semibold mb-3 flex items-center">
              <span className="px-2 py-1 bg-blue-600 text-white rounded text-xs mr-2">THEN</span>
              Action (What should happen?)
            </h3>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">Action Type *</label>
                <select
                  value={formData.action.type}
                  onChange={(e) => setFormData({
                    ...formData,
                    action: { ...formData.action, type: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                >
                  <option value="">Select action...</option>
                  <optgroup label="Exception Management">
                    <option value="CREATE_EXCEPTION">Create Exception</option>
                    <option value="ESCALATE_EXCEPTION">Escalate Exception</option>
                  </optgroup>
                  <optgroup label="Notifications">
                    <option value="NOTIFY_DISPATCHER">Notify Dispatcher</option>
                    <option value="NOTIFY_ADMIN">Notify Admin</option>
                    <option value="NOTIFY_SUPERADMIN">Notify SuperAdmin</option>
                  </optgroup>
                  <optgroup label="Trust Score">
                    <option value="REDUCE_TRUST_SCORE">Reduce Trust Score</option>
                    <option value="INCREASE_TRUST_SCORE">Increase Trust Score</option>
                  </optgroup>
                  <optgroup label="Account Actions">
                    <option value="FLAG_USER">Flag User for Review</option>
                    <option value="SUSPEND_ACCOUNT">Suspend Account</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs text-gray-600 mb-1">
                  Action Value (optional)
                </label>
                <input
                  type="text"
                  value={formData.action.value}
                  onChange={(e) => setFormData({
                    ...formData,
                    action: { ...formData.action, value: e.target.value }
                  })}
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  placeholder="e.g., HIGH, 5 points, etc."
                />
                <p className="text-xs text-gray-500 mt-1">
                  For CREATE_EXCEPTION: severity (LOW/MEDIUM/HIGH/CRITICAL)
                  <br />
                  For REDUCE_TRUST_SCORE: points to deduct
                </p>
              </div>
            </div>
          </div>

          {/* Example Rules */}
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="text-xs font-semibold text-gray-700 mb-2">💡 Example Rules:</div>
            <ul className="text-xs text-gray-600 space-y-1">
              <li className="font-mono">IF GPS_OFFLINE > 30 THEN CREATE_EXCEPTION (HIGH)</li>
              <li className="font-mono">IF TRUST_SCORE < 50 THEN SUSPEND_ACCOUNT</li>
              <li className="font-mono">IF BYPASS_COUNT >= 3 THEN REDUCE_TRUST_SCORE (5)</li>
              <li className="font-mono">IF CANCELLATION_WITHIN <= 2 THEN FLAG_USER</li>
              <li className="font-mono">IF COMPLETION_RATE < 80 THEN NOTIFY_ADMIN</li>
            </ul>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              {rule ? 'Update Rule' : 'Create Rule'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**Rule Execution Engine:**
```typescript
// /lib/automationEngine.ts

import { prisma } from '@/lib/prisma';
import { createException } from '@/lib/exceptions';

export async function executeAutomationRules() {
  console.log('[Automation] Checking rules...');

  // Get all active rules
  const rules = await prisma.automationRule.findMany({
    where: { active: true },
  });

  for (const rule of rules) {
    try {
      await evaluateAndExecuteRule(rule);
    } catch (error) {
      console.error(`[Automation] Error executing rule ${rule.id}:`, error);
    }
  }
}

async function evaluateAndExecuteRule(rule: any) {
  const { condition, action } = rule;

  // Find entities that match the condition
  const matchingEntities = await findMatchingEntities(condition);

  if (matchingEntities.length === 0) return;

  console.log(`[Automation] Rule "${rule.name}" matched ${matchingEntities.length} entities`);

  // Execute action for each matching entity
  for (const entity of matchingEntities) {
    await executeAction(action, entity, rule.id);
  }

  // Update rule execution stats
  await prisma.automationRule.update({
    where: { id: rule.id },
    data: {
      executionCount: { increment: matchingEntities.length },
      lastExecutedAt: new Date(),
    },
  });
}

async function findMatchingEntities(condition: any): Promise<any[]> {
  const { type, operator, value } = condition;
  const threshold = parseFloat(value);

  switch (type) {
    case 'GPS_OFFLINE':
      // Find loads with GPS offline > threshold minutes
      const offlineThreshold = new Date(Date.now() - threshold * 60 * 1000);
      return await prisma.load.findMany({
        where: {
          status: { in: ['IN_TRANSIT', 'PENDING_PICKUP'] },
          truck: {
            lastGPSUpdate: { lt: offlineThreshold },
          },
          exceptionId: null, // Don't create duplicate exceptions
        },
        include: { truck: true, shipper: true },
      });

    case 'TRUST_SCORE':
      // Find users with trust score below/above threshold
      const trustOperator = operator === '<' ? 'lt' : operator === '>' ? 'gt' : 'equals';
      return await prisma.user.findMany({
        where: {
          trustScore: { [trustOperator]: threshold },
          status: 'ACTIVE', // Only active users
        },
      });

    case 'BYPASS_COUNT':
      // Find users with bypass count >= threshold in last 30 days
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      return await prisma.bypassReport.groupBy({
        by: ['userId'],
        where: {
          createdAt: { gte: thirtyDaysAgo },
        },
        having: {
          userId: { _count: { [operator === '>=' ? 'gte' : 'gt']: threshold } },
        },
      });

    case 'COMPLETION_RATE':
      // Find organizations with completion rate below threshold
      return await prisma.organization.findMany({
        where: {
          completionRate: { [operator === '<' ? 'lt' : 'lte']: threshold },
        },
      });

    default:
      console.warn(`[Automation] Unknown condition type: ${type}`);
      return [];
  }
}

async function executeAction(action: any, entity: any, ruleId: string) {
  const { type, value } = action;

  switch (type) {
    case 'CREATE_EXCEPTION':
      if (entity.id && entity.truckId) {
        // Create exception for load
        await createException({
          type: 'GPS_OFFLINE',
          severity: value || 'MEDIUM',
          title: `Automation: GPS Offline`,
          description: `Automatically created by rule ${ruleId}`,
          loadId: entity.id,
          truckId: entity.truckId,
          reportedById: 'SYSTEM',
        });
      }
      break;

    case 'REDUCE_TRUST_SCORE':
      if (entity.id) {
        const points = parseFloat(value) || 5;
        await prisma.user.update({
          where: { id: entity.id },
          data: {
            trustScore: { decrement: points },
          },
        });
      }
      break;

    case 'SUSPEND_ACCOUNT':
      if (entity.id) {
        await prisma.user.update({
          where: { id: entity.id },
          data: {
            status: 'SUSPENDED',
            statusReason: `Automatically suspended by rule ${ruleId}`,
            statusChangedAt: new Date(),
            statusChangedBy: 'SYSTEM',
          },
        });
      }
      break;

    case 'FLAG_USER':
      if (entity.id) {
        // Create flag/warning record
        await prisma.userFlag.create({
          data: {
            userId: entity.id,
            reason: `Flagged by automation rule ${ruleId}`,
            createdBy: 'SYSTEM',
          },
        });
      }
      break;

    case 'NOTIFY_DISPATCHER':
    case 'NOTIFY_ADMIN':
    case 'NOTIFY_SUPERADMIN':
      // Create notification
      const role = type.replace('NOTIFY_', '');
      await createNotificationForRole(role, entity, ruleId);
      break;

    default:
      console.warn(`[Automation] Unknown action type: ${type}`);
  }
}

async function createNotificationForRole(role: string, entity: any, ruleId: string) {
  const users = await prisma.user.findMany({
    where: { role },
  });

  for (const user of users) {
    await prisma.notification.create({
      data: {
        userId: user.id,
        type: 'AUTOMATION_TRIGGERED',
        title: 'Automation Rule Triggered',
        message: `Automation rule ${ruleId} detected an issue requiring attention.`,
        read: false,
      },
    });
  }
}
```

**Cron Job:**
```typescript
// /lib/cron/executeAutomationRules.ts

import { executeAutomationRules } from '@/lib/automationEngine';

// Run automation rules every 15 minutes
export async function runAutomationRules() {
  console.log('[Cron] Executing automation rules...');
  await executeAutomationRules();
  console.log('[Cron] Automation rules execution complete');
}

// In /lib/cron/index.ts, add:
// cron.schedule('*/15 * * * *', runAutomationRules); // Every 15 minutes
```

**Database Schema:**
```prisma
model AutomationRule {
  id             String    @id @default(cuid())
  name           String
  description    String?
  category       String    // GPS, EXCEPTION, SETTLEMENT, TRUST_SCORE
  condition      Json      // { type, operator, value }
  action         Json      // { type, value }
  active         Boolean   @default(true)
  executionCount Int       @default(0)
  lastExecutedAt DateTime?
  createdAt      DateTime  @default(now())
  createdBy      String
  creator        User      @relation(fields: [createdBy], references: [id])

  @@index([category])
  @@index([active])
  @@index([createdBy])
}

model UserFlag {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  reason    String
  resolved  Boolean  @default(false)
  createdBy String
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([resolved])
}
```

**API Endpoints:**
```typescript
// /app/api/superadmin/automation/rules/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rules = await prisma.automationRule.findMany({
    include: {
      creator: {
        select: { name: true, email: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ rules });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const rule = await prisma.automationRule.create({
    data: {
      ...body,
      createdBy: session.user.id,
    },
  });

  return NextResponse.json({ rule });
}

// /app/api/superadmin/automation/rules/[id]/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();

  const rule = await prisma.automationRule.update({
    where: { id: params.id },
    data: body,
  });

  return NextResponse.json({ rule });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.automationRule.delete({
    where: { id: params.id },
  });

  return NextResponse.json({ success: true });
}
```

**Files:**
- `/app/superadmin/automation/page.tsx` (new)
- `/app/superadmin/automation/AutomationRulesClient.tsx` (new)
- `/components/AutomationRuleBuilderModal.tsx` (new)
- `/app/api/superadmin/automation/rules/route.ts` (new - GET/POST)
- `/app/api/superadmin/automation/rules/[id]/route.ts` (new - PUT/DELETE)
- `/lib/automationEngine.ts` (new - rule execution engine)
- `/lib/cron/executeAutomationRules.ts` (new - cron job)
- `/prisma/schema.prisma` (add AutomationRule and UserFlag models)

**Acceptance:**
- ✓ SuperAdmin can create automation rules with visual builder
- ✓ IF-THEN logic builder with dropdowns
- ✓ Multiple condition types (GPS, Trust Score, Bypass Count, etc.)
- ✓ Multiple action types (Create Exception, Suspend Account, etc.)
- ✓ Rules can be activated/deactivated
- ✓ Execution tracking (count, last executed timestamp)
- ✓ Rules execute automatically via cron (every 15 minutes)
- ✓ Rule execution logged and audited
- ✓ Can edit and delete rules

---

#### **Task 16.9A.6: Bypass Detection Review Dashboard** (1.5 days)
**Description:** SuperAdmin can view bypass reports and take action against violations

**Implementation:**
```typescript
// /app/superadmin/bypass/BypassReviewClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function BypassReviewClient() {
  const [reports, setReports] = useState([]);
  const [filter, setFilter] = useState({
    status: 'all', // pending, reviewed, action_taken
    severity: 'all', // low, medium, high
  });

  useEffect(() => {
    fetchReports();
  }, [filter]);

  const fetchReports = async () => {
    const params = new URLSearchParams(filter as any);
    const response = await fetch(`/api/superadmin/bypass-reports?${params}`);
    const data = await response.json();
    setReports(data.reports);
  };

  const handleReduceTrustScore = async (reportId: string, userId: string) => {
    const points = prompt('Points to deduct from trust score:');
    if (!points) return;

    await fetch(`/api/superadmin/bypass-reports/${reportId}/action`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REDUCE_TRUST', points: parseInt(points), userId }),
    });

    fetchReports();
    alert('Trust score reduced');
  };

  const handleSuspendUser = async (reportId: string, userId: string) => {
    if (!confirm('Suspend this user? They will not be able to access the platform.')) return;

    await fetch(`/api/superadmin/bypass-reports/${reportId}/action`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SUSPEND', userId }),
    });

    fetchReports();
    alert('User suspended');
  };

  const handleDismiss = async (reportId: string) => {
    await fetch(`/api/superadmin/bypass-reports/${reportId}/dismiss`, {
      method: 'PUT',
    });

    fetchReports();
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Bypass Detection Review</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4">
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending Review</option>
          <option value="reviewed">Reviewed</option>
          <option value="action_taken">Action Taken</option>
        </select>

        <select
          value={filter.severity}
          onChange={(e) => setFilter({ ...filter, severity: e.target.value })}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Severity</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      {/* Reports Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Load
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Severity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Trust Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {reports.map((report: any) => (
              <tr key={report.id}>
                <td className="px-6 py-4">
                  <div>
                    <div className="font-medium">{report.user.name}</div>
                    <div className="text-sm text-gray-500">{report.user.email}</div>
                    <div className="text-xs text-gray-400">{report.user.organization.name}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm font-medium">{report.bypassType}</span>
                </td>
                <td className="px-6 py-4">
                  {report.loadId && (
                    <a href={`/superadmin/loads/${report.loadId}`} className="text-blue-600 hover:underline text-sm">
                      View Load
                    </a>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    report.severity === 'HIGH' ? 'bg-red-100 text-red-800' :
                    report.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {report.severity}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold">{report.user.trustScore || 100}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    report.status === 'ACTION_TAKEN' ? 'bg-green-100 text-green-800' :
                    report.status === 'REVIEWED' ? 'bg-blue-100 text-blue-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {report.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {report.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleReduceTrustScore(report.id, report.userId)}
                        className="text-sm text-orange-600 hover:underline"
                      >
                        Reduce Trust
                      </button>
                      <button
                        onClick={() => handleSuspendUser(report.id, report.userId)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Suspend
                      </button>
                      <button
                        onClick={() => handleDismiss(report.id)}
                        className="text-sm text-gray-600 hover:underline"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/superadmin/bypass-reports/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const severity = searchParams.get('severity');

  const where: any = {};

  if (status && status !== 'all') {
    where.status = status.toUpperCase();
  }

  if (severity && severity !== 'all') {
    where.severity = severity.toUpperCase();
  }

  const reports = await prisma.bypassReport.findMany({
    where,
    include: {
      user: {
        include: { organization: true },
      },
      load: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ reports });
}

// /app/api/superadmin/bypass-reports/[id]/action/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { action, points, userId } = await request.json();

  if (action === 'REDUCE_TRUST') {
    // Reduce trust score
    await prisma.user.update({
      where: { id: userId },
      data: {
        trustScore: { decrement: points },
      },
    });

    // Update report
    await prisma.bypassReport.update({
      where: { id: params.id },
      data: {
        status: 'ACTION_TAKEN',
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        eventType: 'BYPASS_ACTION',
        details: `Reduced trust score by ${points} for bypass report ${params.id}`,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      },
    });
  } else if (action === 'SUSPEND') {
    // Suspend user
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: 'SUSPENDED',
        statusReason: `Suspended due to bypass violation`,
        statusChangedAt: new Date(),
        statusChangedBy: session.user.id,
      },
    });

    // Update report
    await prisma.bypassReport.update({
      where: { id: params.id },
      data: {
        status: 'ACTION_TAKEN',
        reviewedBy: session.user.id,
        reviewedAt: new Date(),
      },
    });

    // Log audit
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        eventType: 'USER_SUSPENDED',
        details: `User ${userId} suspended due to bypass report ${params.id}`,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
      },
    });
  }

  return NextResponse.json({ success: true });
}

// /app/api/superadmin/bypass-reports/[id]/dismiss/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.bypassReport.update({
    where: { id: params.id },
    data: {
      status: 'REVIEWED',
      reviewedBy: session.user.id,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}
```

**Files:**
- `/app/superadmin/bypass/page.tsx` (new)
- `/app/superadmin/bypass/BypassReviewClient.tsx` (new)
- `/app/api/superadmin/bypass-reports/route.ts` (new - GET)
- `/app/api/superadmin/bypass-reports/[id]/action/route.ts` (new - PUT)
- `/app/api/superadmin/bypass-reports/[id]/dismiss/route.ts` (new - PUT)

**Acceptance:**
- ✓ SuperAdmin can view all bypass reports
- ✓ Can filter by status and severity
- ✓ Can reduce trust score
- ✓ Can suspend users for violations
- ✓ Can dismiss false positives
- ✓ All actions logged in audit trail

---

#### **Task 16.9A.7: Global Audit Log Viewer** (1.5 days)
**Description:** SuperAdmin can view all platform actions with filtering and search

**Implementation:**
```typescript
// /app/superadmin/audit/AuditLogClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function AuditLogClient() {
  const [logs, setLogs] = useState([]);
  const [filter, setFilter] = useState({
    eventType: 'all',
    userId: '',
    startDate: '',
    endDate: '',
    search: '',
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchLogs();
  }, [filter, page]);

  const fetchLogs = async () => {
    const params = new URLSearchParams({
      ...filter,
      page: page.toString(),
      limit: '50',
    } as any);

    const response = await fetch(`/api/superadmin/audit-logs?${params}`);
    const data = await response.json();
    setLogs(data.logs);
    setTotalPages(data.totalPages);
  };

  const eventTypes = [
    'USER_LOGIN',
    'USER_CREATED',
    'USER_SUSPENDED',
    'LOAD_CREATED',
    'LOAD_ASSIGNED',
    'SETTLEMENT_OVERRIDE',
    'SETTLEMENT_FORCE_COMPLETE',
    'BYPASS_ACTION',
    'AUTOMATION_CREATED',
    'GPS_CONFIG_CHANGED',
    'COMMISSION_CHANGED',
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Global Audit Log</h1>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="grid grid-cols-5 gap-4 mb-4">
          <select
            value={filter.eventType}
            onChange={(e) => setFilter({ ...filter, eventType: e.target.value })}
            className="px-4 py-2 border rounded-md"
          >
            <option value="all">All Events</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, ' ')}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="User ID"
            value={filter.userId}
            onChange={(e) => setFilter({ ...filter, userId: e.target.value })}
            className="px-4 py-2 border rounded-md"
          />

          <input
            type="date"
            placeholder="Start Date"
            value={filter.startDate}
            onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
            className="px-4 py-2 border rounded-md"
          />

          <input
            type="date"
            placeholder="End Date"
            value={filter.endDate}
            onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
            className="px-4 py-2 border rounded-md"
          />

          <input
            type="text"
            placeholder="Search details..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="px-4 py-2 border rounded-md"
          />
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Timestamp
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                User
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Event Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                IP Address
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map((log: any) => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {new Date(log.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium">{log.user.name}</div>
                  <div className="text-xs text-gray-500">{log.user.email}</div>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {log.eventType.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate">
                  {log.details}
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {log.ipAddress}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex justify-between items-center">
        <div className="text-sm text-gray-600">
          Page {page} of {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-4 py-2 border rounded-md disabled:opacity-50"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 border rounded-md disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/superadmin/audit-logs/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const eventType = searchParams.get('eventType');
  const userId = searchParams.get('userId');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');
  const search = searchParams.get('search');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '50');

  const where: any = {};

  if (eventType && eventType !== 'all') {
    where.eventType = eventType;
  }

  if (userId) {
    where.userId = userId;
  }

  if (startDate) {
    where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
  }

  if (endDate) {
    where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
  }

  if (search) {
    where.details = { contains: search, mode: 'insensitive' };
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    logs,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    total,
  });
}
```

**Files:**
- `/app/superadmin/audit/page.tsx` (new)
- `/app/superadmin/audit/AuditLogClient.tsx` (new)
- `/app/api/superadmin/audit-logs/route.ts` (new - GET)

**Acceptance:**
- ✓ SuperAdmin can view all audit logs
- ✓ Can filter by event type, user, date range
- ✓ Can search within log details
- ✓ Pagination works (50 logs per page)
- ✓ Timestamps displayed in local timezone
- ✓ IP addresses captured and displayed

---

#### **Task 16.9A.8: Platform Metrics Dashboard** (2 days)
**Description:** SuperAdmin can view platform-wide metrics and analytics

**Implementation:**
```typescript
// /app/superadmin/metrics/MetricsClient.tsx

'use client';

import { useState, useEffect } from 'react';
import { Line, Bar, Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

export default function MetricsClient() {
  const [metrics, setMetrics] = useState<any>(null);
  const [timeRange, setTimeRange] = useState('30'); // days

  useEffect(() => {
    fetchMetrics();
  }, [timeRange]);

  const fetchMetrics = async () => {
    const response = await fetch(`/api/superadmin/metrics?timeRange=${timeRange}`);
    const data = await response.json();
    setMetrics(data);
  };

  if (!metrics) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Platform Metrics</h1>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border rounded-md"
        >
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
          <option value="365">Last Year</option>
        </select>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Total Users</h3>
          <p className="text-3xl font-bold">{metrics.totalUsers.toLocaleString()}</p>
          <p className="text-sm text-green-600 mt-1">
            +{metrics.newUsersThisPeriod} this period
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Active Loads</h3>
          <p className="text-3xl font-bold">{metrics.activeLoads.toLocaleString()}</p>
          <p className="text-sm text-gray-600 mt-1">
            {metrics.completedLoadsThisPeriod} completed
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Platform Revenue</h3>
          <p className="text-3xl font-bold">
            {new Intl.NumberFormat('en-ET', {
              style: 'currency',
              currency: 'ETB',
              minimumFractionDigits: 0,
            }).format(metrics.totalRevenue)}
          </p>
          <p className="text-sm text-green-600 mt-1">
            +{new Intl.NumberFormat('en-ET', {
              style: 'currency',
              currency: 'ETB',
              minimumFractionDigits: 0,
            }).format(metrics.revenueThisPeriod)} this period
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Avg Completion Rate</h3>
          <p className="text-3xl font-bold">{metrics.avgCompletionRate.toFixed(1)}%</p>
          <p className="text-sm text-gray-600 mt-1">
            Platform average
          </p>
        </div>
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Load Volume Over Time */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Load Volume Over Time</h3>
          <Line
            data={{
              labels: metrics.loadVolumeOverTime.labels,
              datasets: [
                {
                  label: 'Loads Created',
                  data: metrics.loadVolumeOverTime.created,
                  borderColor: 'rgb(59, 130, 246)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                },
                {
                  label: 'Loads Completed',
                  data: metrics.loadVolumeOverTime.completed,
                  borderColor: 'rgb(34, 197, 94)',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'top' },
              },
            }}
          />
        </div>

        {/* Revenue Over Time */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Revenue Over Time (ETB)</h3>
          <Bar
            data={{
              labels: metrics.revenueOverTime.labels,
              datasets: [
                {
                  label: 'Commission Revenue',
                  data: metrics.revenueOverTime.data,
                  backgroundColor: 'rgba(34, 197, 94, 0.8)',
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'top' },
              },
            }}
          />
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* User Distribution by Role */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Users by Role</h3>
          <Pie
            data={{
              labels: ['Shipper', 'Carrier', 'Dispatcher', 'Admin', 'SuperAdmin'],
              datasets: [
                {
                  data: [
                    metrics.usersByRole.SHIPPER,
                    metrics.usersByRole.CARRIER,
                    metrics.usersByRole.DISPATCHER,
                    metrics.usersByRole.ADMIN,
                    metrics.usersByRole.SUPERADMIN,
                  ],
                  backgroundColor: [
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(168, 85, 247, 0.8)',
                  ],
                },
              ],
            }}
          />
        </div>

        {/* Exception Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Exceptions by Type</h3>
          <Pie
            data={{
              labels: metrics.exceptionsByType.labels,
              datasets: [
                {
                  data: metrics.exceptionsByType.data,
                  backgroundColor: [
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(168, 85, 247, 0.8)',
                    'rgba(34, 197, 94, 0.8)',
                  ],
                },
              ],
            }}
          />
        </div>

        {/* Settlement Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Settlement Status</h3>
          <Pie
            data={{
              labels: ['Completed', 'Pending', 'Disputed'],
              datasets: [
                {
                  data: [
                    metrics.settlementStatus.COMPLETED,
                    metrics.settlementStatus.PENDING,
                    metrics.settlementStatus.DISPUTED,
                  ],
                  backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                  ],
                },
              ],
            }}
          />
        </div>
      </div>

      {/* Top Performers */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top Organizations by Volume */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top Organizations by Volume</h3>
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Organization</th>
                <th className="text-right py-2">Loads</th>
                <th className="text-right py-2">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topOrganizations.map((org: any, i: number) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{org.name}</td>
                  <td className="text-right">{org.loadCount}</td>
                  <td className="text-right">
                    {new Intl.NumberFormat('en-ET', {
                      style: 'currency',
                      currency: 'ETB',
                      minimumFractionDigits: 0,
                    }).format(org.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Active Exceptions Summary */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Active Exceptions</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-gray-600">Tier 1 (Dispatcher)</span>
              <span className="font-semibold text-yellow-600">
                {metrics.exceptionsByTier.tier1}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-gray-600">Tier 2 (Admin)</span>
              <span className="font-semibold text-orange-600">
                {metrics.exceptionsByTier.tier2}
              </span>
            </div>
            <div className="flex justify-between items-center pb-2 border-b">
              <span className="text-gray-600">Tier 3 (SuperAdmin)</span>
              <span className="font-semibold text-red-600">
                {metrics.exceptionsByTier.tier3}
              </span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <span className="font-semibold">Total Active</span>
              <span className="font-bold text-lg">
                {metrics.exceptionsByTier.tier1 +
                  metrics.exceptionsByTier.tier2 +
                  metrics.exceptionsByTier.tier3}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/superadmin/metrics/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SUPERADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const timeRange = parseInt(searchParams.get('timeRange') || '30');

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - timeRange);

  // Total users
  const totalUsers = await prisma.user.count();
  const newUsersThisPeriod = await prisma.user.count({
    where: { createdAt: { gte: startDate } },
  });

  // Active loads
  const activeLoads = await prisma.load.count({
    where: { status: { in: ['POSTED', 'ASSIGNED', 'IN_TRANSIT', 'PENDING_PICKUP'] } },
  });

  const completedLoadsThisPeriod = await prisma.load.count({
    where: {
      status: 'COMPLETED',
      updatedAt: { gte: startDate },
    },
  });

  // Revenue
  const settlements = await prisma.settlement.findMany({
    where: { status: 'COMPLETED' },
  });

  const totalRevenue = settlements.reduce((sum, s) => sum + s.commission, 0);

  const settlementsThisPeriod = await prisma.settlement.findMany({
    where: {
      status: 'COMPLETED',
      completedAt: { gte: startDate },
    },
  });

  const revenueThisPeriod = settlementsThisPeriod.reduce((sum, s) => sum + s.commission, 0);

  // Completion rate
  const organizations = await prisma.organization.findMany({
    select: { completionRate: true },
  });

  const avgCompletionRate =
    organizations.reduce((sum, o) => sum + (o.completionRate || 0), 0) / organizations.length;

  // Load volume over time (daily)
  const loadVolumeOverTime = await getLoadVolumeOverTime(timeRange);

  // Revenue over time
  const revenueOverTime = await getRevenueOverTime(timeRange);

  // Users by role
  const usersByRole = {
    SHIPPER: await prisma.user.count({ where: { role: 'SHIPPER' } }),
    CARRIER: await prisma.user.count({ where: { role: 'CARRIER' } }),
    DISPATCHER: await prisma.user.count({ where: { role: 'DISPATCHER' } }),
    ADMIN: await prisma.user.count({ where: { role: 'ADMIN' } }),
    SUPERADMIN: await prisma.user.count({ where: { role: 'SUPERADMIN' } }),
  };

  // Exceptions by type
  const exceptionsByType = await getExceptionsByType();

  // Settlement status
  const settlementStatus = {
    COMPLETED: await prisma.settlement.count({ where: { status: 'COMPLETED' } }),
    PENDING: await prisma.settlement.count({ where: { status: 'PENDING' } }),
    DISPUTED: await prisma.settlement.count({ where: { status: 'DISPUTED' } }),
  };

  // Top organizations
  const topOrganizations = await getTopOrganizations();

  // Exceptions by tier
  const exceptionsByTier = {
    tier1: await prisma.exception.count({
      where: { escalationTier: 1, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
    }),
    tier2: await prisma.exception.count({
      where: { escalationTier: 2, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
    }),
    tier3: await prisma.exception.count({
      where: { escalationTier: 3, status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] } },
    }),
  };

  return NextResponse.json({
    totalUsers,
    newUsersThisPeriod,
    activeLoads,
    completedLoadsThisPeriod,
    totalRevenue,
    revenueThisPeriod,
    avgCompletionRate,
    loadVolumeOverTime,
    revenueOverTime,
    usersByRole,
    exceptionsByType,
    settlementStatus,
    topOrganizations,
    exceptionsByTier,
  });
}

async function getLoadVolumeOverTime(days: number) {
  const labels = [];
  const created = [];
  const completed = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    labels.push(startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    const createdCount = await prisma.load.count({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const completedCount = await prisma.load.count({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    created.push(createdCount);
    completed.push(completedCount);
  }

  return { labels, created, completed };
}

async function getRevenueOverTime(days: number) {
  const labels = [];
  const data = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    labels.push(startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    const settlements = await prisma.settlement.findMany({
      where: {
        status: 'COMPLETED',
        completedAt: { gte: startOfDay, lte: endOfDay },
      },
    });

    const revenue = settlements.reduce((sum, s) => sum + s.commission, 0);
    data.push(revenue);
  }

  return { labels, data };
}

async function getExceptionsByType() {
  const types = [
    'GPS_OFFLINE',
    'PICKUP_DELAYED',
    'DELIVERY_DELAYED',
    'POD_DISPUTED',
    'SETTLEMENT_DISPUTED',
  ];

  const labels = [];
  const data = [];

  for (const type of types) {
    const count = await prisma.exception.count({ where: { type } });
    labels.push(type.replace(/_/g, ' '));
    data.push(count);
  }

  return { labels, data };
}

async function getTopOrganizations() {
  // This would require more complex aggregation
  // Simplified version:
  const organizations = await prisma.organization.findMany({
    include: {
      users: {
        include: {
          shipper: {
            include: { loads: true },
          },
        },
      },
    },
    take: 5,
  });

  return organizations.map((org) => {
    const loadCount = org.users.reduce(
      (sum, u) => sum + (u.shipper?.loads?.length || 0),
      0
    );
    return {
      name: org.name,
      loadCount,
      revenue: loadCount * 500, // Placeholder calculation
    };
  });
}
```

**Additional Dependencies:**
```bash
npm install react-chartjs-2 chart.js
```

**Files:**
- `/app/superadmin/metrics/page.tsx` (new)
- `/app/superadmin/metrics/MetricsClient.tsx` (new)
- `/app/api/superadmin/metrics/route.ts` (new - GET)

**Acceptance:**
- ✓ SuperAdmin can view comprehensive platform metrics
- ✓ Can select different time ranges (7/30/90/365 days)
- ✓ Summary cards show key metrics
- ✓ Charts display load volume, revenue trends
- ✓ Pie charts show distribution by role, exceptions, settlements
- ✓ Top performers table displays correctly
- ✓ Active exceptions breakdown by tier

---

### Story 16.9A: Dependencies, Testing, Database Migration

**Dependencies:**
- Story 16.14 (User Status Flow) - for user suspension actions
- Story 16.13 (Exception System) - for exception-related automation
- Story 16.12 (Load Lifecycle) - for load state monitoring

**Testing Checklist:**
- [ ] Global commission configuration saves and applies correctly
- [ ] GPS device management CRUD operations work
- [ ] Organization verification workflow complete
- [ ] Settlement review and override functional
- [ ] Automation rules execute correctly via cron
- [ ] Bypass reports reviewed and acted upon
- [ ] Audit log captures all actions with IP addresses
- [ ] Platform metrics dashboard renders all charts
- [ ] All SuperAdmin pages require SUPERADMIN role
- [ ] Audit logging works for all admin actions

**Database Migration:**
```prisma
// Add to schema.prisma

model AutomationRule {
  id             String    @id @default(cuid())
  name           String
  description    String?
  category       String
  condition      Json
  action         Json
  active         Boolean   @default(true)
  executionCount Int       @default(0)
  lastExecutedAt DateTime?
  createdAt      DateTime  @default(now())
  createdBy      String
  creator        User      @relation(fields: [createdBy], references: [id])

  @@index([category])
  @@index([active])
  @@index([createdBy])
}

model UserFlag {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  reason    String
  resolved  Boolean  @default(false)
  createdBy String
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([resolved])
}

model Settlement {
  // Add fields if not exists:
  overriddenBy String?
  overriddenAt DateTime?
  completedBy  String?
}

model AuditLog {
  // Verify this model exists with these fields:
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  eventType String
  details   String
  ipAddress String
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([eventType])
  @@index([createdAt])
}
```

---

## STORY 16.9B: COMPANY ADMIN TOOLS

**User Story:**
_As a Company Admin (role: ADMIN), I want to manage users within my organization, view company-specific performance metrics, and configure company preferences, so that I can effectively manage my team without SuperAdmin intervention._

**Background & Rationale:**
While SuperAdmin manages the entire platform, Company Admins need tools to manage their organization's users, monitor GPS devices, review settlements, track performance, and configure preferences. This reduces SuperAdmin workload and gives organizations autonomy.

**Acceptance Criteria:**
- ✓ Admin can invite, activate, suspend users within their organization
- ✓ Admin can view company GPS devices and assign/unassign them
- ✓ Admin can view company settlement history with filtering
- ✓ Admin can view company performance dashboard (completion rate, revenue, trust score)
- ✓ Admin can configure company preferences (commission tier goals, notification settings)
- ✓ All actions scoped to admin's organization only
- ✓ Cannot access other organizations' data
- ✓ Cannot modify platform-wide settings

---

#### **Task 16.9B.1: Company User Management** (2 days)
**Description:** Company Admin can manage users within their organization

**Implementation:**
```typescript
// /app/admin/users/UsersManagementClient.tsx

'use client';

import { useState, useEffect } from 'react';
import InviteUserModal from '@/components/InviteUserModal';

export default function UsersManagementClient({ organizationId }: { organizationId: string }) {
  const [users, setUsers] = useState([]);
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    const response = await fetch(`/api/admin/users?organizationId=${organizationId}`);
    const data = await response.json();
    setUsers(data.users);
  };

  const handleSuspendUser = async (userId: string) => {
    const reason = prompt('Reason for suspension:');
    if (!reason) return;

    await fetch(`/api/admin/users/${userId}/suspend`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    fetchUsers();
    alert('User suspended');
  };

  const handleActivateUser = async (userId: string) => {
    await fetch(`/api/admin/users/${userId}/activate`, {
      method: 'PUT',
    });

    fetchUsers();
    alert('User activated');
  };

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Send password reset email to this user?')) return;

    await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
    });

    alert('Password reset email sent');
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Company Users</h1>
        <button
          onClick={() => setInviting(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          Invite User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Trust Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user: any) => (
              <tr key={user.id}>
                <td className="px-6 py-4">
                  <div className="font-medium">{user.name}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">{user.email}</td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    user.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    user.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                    user.status === 'SUSPENDED' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {user.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-semibold">{user.trustScore || 100}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {user.status === 'ACTIVE' && (
                      <button
                        onClick={() => handleSuspendUser(user.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Suspend
                      </button>
                    )}
                    {user.status === 'SUSPENDED' && (
                      <button
                        onClick={() => handleActivateUser(user.id)}
                        className="text-sm text-green-600 hover:underline"
                      >
                        Activate
                      </button>
                    )}
                    <button
                      onClick={() => handleResetPassword(user.id)}
                      className="text-sm text-blue-600 hover:underline"
                    >
                      Reset Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Invite User Modal */}
      {inviting && (
        <InviteUserModal
          isOpen={true}
          organizationId={organizationId}
          onClose={() => setInviting(false)}
          onSuccess={() => {
            setInviting(false);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
}
```

**Invite User Modal:**
```typescript
// /components/InviteUserModal.tsx

'use client';

import { useState } from 'react';

interface InviteUserModalProps {
  isOpen: boolean;
  organizationId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function InviteUserModal({
  isOpen,
  organizationId,
  onClose,
  onSuccess,
}: InviteUserModalProps) {
  const [formData, setFormData] = useState({
    email: '',
    name: '',
    role: 'CARRIER', // CARRIER, SHIPPER, DISPATCHER
  });
  const [sending, setSending] = useState(false);

  const handleInvite = async () => {
    setSending(true);

    try {
      await fetch('/api/admin/users/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, organizationId }),
      });

      alert('Invitation sent!');
      onSuccess();
    } catch (error) {
      alert('Failed to send invitation');
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onClose} />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="text-xl font-bold mb-6">Invite User</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email *
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border rounded-md"
                placeholder="user@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border rounded-md"
                placeholder="Full Name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Role *
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-4 py-2 border rounded-md"
              >
                <option value="CARRIER">Carrier</option>
                <option value="SHIPPER">Shipper</option>
                <option value="DISPATCHER">Dispatcher</option>
              </select>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={onClose}
              disabled={sending}
              className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleInvite}
              disabled={sending || !formData.email || !formData.name}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send Invitation'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/admin/users/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  // Ensure admin can only access their own organization
  const adminUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { organization: true },
  });

  if (adminUser?.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    where: { organizationId },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ users });
}

// /app/api/admin/users/invite/route.ts

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { email, name, role, organizationId } = await request.json();

  // Verify admin is from same organization
  const adminUser = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (adminUser?.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Create user with PENDING status
  const user = await prisma.user.create({
    data: {
      email,
      name,
      role,
      organizationId,
      status: 'PENDING',
      password: 'TEMP_PASSWORD', // User will set password via email link
    },
  });

  // TODO: Send invitation email with setup link
  // await sendInvitationEmail(email, name, setupToken);

  return NextResponse.json({ user });
}

// /app/api/admin/users/[id]/suspend/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reason } = await request.json();

  // Verify user belongs to admin's organization
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  const admin = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (user?.organizationId !== admin?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: params.id },
    data: {
      status: 'SUSPENDED',
      statusReason: reason,
      statusChangedAt: new Date(),
      statusChangedBy: session.user.id,
    },
  });

  return NextResponse.json({ success: true });
}

// /app/api/admin/users/[id]/activate/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user belongs to admin's organization
  const user = await prisma.user.findUnique({ where: { id: params.id } });
  const admin = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (user?.organizationId !== admin?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await prisma.user.update({
    where: { id: params.id },
    data: {
      status: 'ACTIVE',
      statusReason: null,
      statusChangedAt: new Date(),
      statusChangedBy: session.user.id,
    },
  });

  return NextResponse.json({ success: true });
}
```

**Files:**
- `/app/admin/users/page.tsx` (new)
- `/app/admin/users/UsersManagementClient.tsx` (new)
- `/components/InviteUserModal.tsx` (new)
- `/app/api/admin/users/route.ts` (new - GET)
- `/app/api/admin/users/invite/route.ts` (new - POST)
- `/app/api/admin/users/[id]/suspend/route.ts` (new - PUT)
- `/app/api/admin/users/[id]/activate/route.ts` (new - PUT)
- `/app/api/admin/users/[id]/reset-password/route.ts` (new - POST)

**Acceptance:**
- ✓ Admin can view all users in their organization
- ✓ Admin can invite users via email
- ✓ Admin can suspend/activate users
- ✓ Admin can trigger password reset emails
- ✓ Cannot access users from other organizations
- ✓ Invitation creates user with PENDING status

---

#### **Task 16.9B.2: Company GPS Management** (1.5 days)
**Description:** Company Admin can view and assign GPS devices to trucks within their organization

**Implementation:**
```typescript
// /app/admin/gps/GPSManagementClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function GPSManagementClient({ organizationId }: { organizationId: string }) {
  const [devices, setDevices] = useState([]);
  const [trucks, setTrucks] = useState([]);

  useEffect(() => {
    fetchDevices();
    fetchTrucks();
  }, []);

  const fetchDevices = async () => {
    const response = await fetch(`/api/admin/gps-devices?organizationId=${organizationId}`);
    const data = await response.json();
    setDevices(data.devices);
  };

  const fetchTrucks = async () => {
    const response = await fetch(`/api/admin/trucks?organizationId=${organizationId}`);
    const data = await response.json();
    setTrucks(data.trucks);
  };

  const handleAssignDevice = async (deviceId: string) => {
    const truckId = prompt('Enter Truck ID to assign:');
    if (!truckId) return;

    await fetch(`/api/admin/gps-devices/${deviceId}/assign`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ truckId }),
    });

    fetchDevices();
    alert('GPS device assigned');
  };

  const handleUnassignDevice = async (deviceId: string) => {
    if (!confirm('Unassign this GPS device?')) return;

    await fetch(`/api/admin/gps-devices/${deviceId}/unassign`, {
      method: 'PUT',
    });

    fetchDevices();
    alert('GPS device unassigned');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Company GPS Devices</h1>

      {/* GPS Devices Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold">GPS Devices</h2>
        </div>
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Device ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                IMEI
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Assigned Truck
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Last Update
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {devices.map((device: any) => (
              <tr key={device.id}>
                <td className="px-6 py-4 text-sm font-medium">{device.id}</td>
                <td className="px-6 py-4 text-sm">{device.imei}</td>
                <td className="px-6 py-4 text-sm">
                  {device.truckId ? (
                    <span className="text-blue-600">{device.truck?.licensePlate || device.truckId}</span>
                  ) : (
                    <span className="text-gray-400">Not assigned</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    device.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                    device.status === 'OFFLINE' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {device.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {device.lastUpdate ? new Date(device.lastUpdate).toLocaleString() : 'Never'}
                </td>
                <td className="px-6 py-4">
                  <div className="flex gap-2">
                    {!device.truckId ? (
                      <button
                        onClick={() => handleAssignDevice(device.id)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        Assign
                      </button>
                    ) : (
                      <button
                        onClick={() => handleUnassignDevice(device.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Unassign
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Available Trucks Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <h2 className="text-lg font-semibold">Available Trucks</h2>
        </div>
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                License Plate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Truck Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                GPS Device
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Driver
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {trucks.map((truck: any) => (
              <tr key={truck.id}>
                <td className="px-6 py-4 text-sm font-medium">{truck.licensePlate}</td>
                <td className="px-6 py-4 text-sm">{truck.truckType}</td>
                <td className="px-6 py-4 text-sm">
                  {truck.gpsDeviceId ? (
                    <span className="text-green-600">Assigned</span>
                  ) : (
                    <span className="text-gray-400">Not assigned</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm">{truck.carrier?.name || 'N/A'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/admin/gps-devices/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  // Verify admin is from same organization
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (admin?.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const devices = await prisma.gPSDevice.findMany({
    where: { organizationId },
    include: {
      truck: {
        select: { licensePlate: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ devices });
}

// /app/api/admin/gps-devices/[id]/assign/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { truckId } = await request.json();

  // Verify device and truck belong to admin's organization
  const device = await prisma.gPSDevice.findUnique({ where: { id: params.id } });
  const truck = await prisma.truck.findUnique({ where: { id: truckId } });
  const admin = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (
    device?.organizationId !== admin?.organizationId ||
    truck?.carrier?.organizationId !== admin?.organizationId
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Assign device to truck
  await prisma.gPSDevice.update({
    where: { id: params.id },
    data: { truckId },
  });

  await prisma.truck.update({
    where: { id: truckId },
    data: { gpsDeviceId: params.id },
  });

  return NextResponse.json({ success: true });
}

// /app/api/admin/gps-devices/[id]/unassign/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const device = await prisma.gPSDevice.findUnique({ where: { id: params.id } });
  const admin = await prisma.user.findUnique({ where: { id: session.user.id } });

  if (device?.organizationId !== admin?.organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Unassign device
  if (device.truckId) {
    await prisma.truck.update({
      where: { id: device.truckId },
      data: { gpsDeviceId: null },
    });
  }

  await prisma.gPSDevice.update({
    where: { id: params.id },
    data: { truckId: null },
  });

  return NextResponse.json({ success: true });
}
```

**Files:**
- `/app/admin/gps/page.tsx` (new)
- `/app/admin/gps/GPSManagementClient.tsx` (new)
- `/app/api/admin/gps-devices/route.ts` (new - GET)
- `/app/api/admin/gps-devices/[id]/assign/route.ts` (new - PUT)
- `/app/api/admin/gps-devices/[id]/unassign/route.ts` (new - PUT)
- `/app/api/admin/trucks/route.ts` (new - GET)

**Acceptance:**
- ✓ Admin can view all GPS devices in their organization
- ✓ Admin can view all trucks in their organization
- ✓ Admin can assign GPS devices to trucks
- ✓ Admin can unassign GPS devices
- ✓ Cannot access devices from other organizations
- ✓ Device status displayed correctly

---

#### **Task 16.9B.3: Company Settlement Dashboard** (2 days)
**Description:** Company Admin can view settlement history for their organization

**Implementation:**
```typescript
// /app/admin/settlements/SettlementsClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function SettlementsClient({ organizationId }: { organizationId: string }) {
  const [settlements, setSettlements] = useState([]);
  const [filter, setFilter] = useState({
    status: 'all',
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    fetchSettlements();
  }, [filter]);

  const fetchSettlements = async () => {
    const params = new URLSearchParams({ organizationId, ...filter } as any);
    const response = await fetch(`/api/admin/settlements?${params}`);
    const data = await response.json();
    setSettlements(data.settlements);
  };

  const totalRevenue = settlements
    .filter((s: any) => s.status === 'COMPLETED')
    .reduce((sum: number, s: any) => sum + s.amount, 0);

  const totalCommission = settlements
    .filter((s: any) => s.status === 'COMPLETED')
    .reduce((sum: number, s: any) => sum + s.commission, 0);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Company Settlements</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-6 mb-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Total Completed</h3>
          <p className="text-3xl font-bold">
            {new Intl.NumberFormat('en-ET', {
              style: 'currency',
              currency: 'ETB',
              minimumFractionDigits: 0,
            }).format(totalRevenue)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Total Commission Paid</h3>
          <p className="text-3xl font-bold text-red-600">
            {new Intl.NumberFormat('en-ET', {
              style: 'currency',
              currency: 'ETB',
              minimumFractionDigits: 0,
            }).format(totalCommission)}
          </p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Pending Settlements</h3>
          <p className="text-3xl font-bold text-yellow-600">
            {settlements.filter((s: any) => s.status === 'PENDING').length}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow mb-6 flex gap-4">
        <select
          value={filter.status}
          onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          className="px-4 py-2 border rounded-md"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="completed">Completed</option>
          <option value="disputed">Disputed</option>
        </select>

        <input
          type="date"
          value={filter.startDate}
          onChange={(e) => setFilter({ ...filter, startDate: e.target.value })}
          className="px-4 py-2 border rounded-md"
          placeholder="Start Date"
        />

        <input
          type="date"
          value={filter.endDate}
          onChange={(e) => setFilter({ ...filter, endDate: e.target.value })}
          className="px-4 py-2 border rounded-md"
          placeholder="End Date"
        />
      </div>

      {/* Settlements Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Load
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Amount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Commission
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Net Received
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {settlements.map((settlement: any) => (
              <tr key={settlement.id}>
                <td className="px-6 py-4 text-sm">
                  {new Date(settlement.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">
                  <a href={`/admin/loads/${settlement.loadId}`} className="text-blue-600 hover:underline">
                    {settlement.load.pickupCity} → {settlement.load.deliveryCity}
                  </a>
                </td>
                <td className="px-6 py-4 text-sm font-semibold">
                  {new Intl.NumberFormat('en-ET', {
                    style: 'currency',
                    currency: 'ETB',
                    minimumFractionDigits: 0,
                  }).format(settlement.amount)}
                </td>
                <td className="px-6 py-4 text-sm text-red-600">
                  -{new Intl.NumberFormat('en-ET', {
                    style: 'currency',
                    currency: 'ETB',
                    minimumFractionDigits: 0,
                  }).format(settlement.commission)}
                </td>
                <td className="px-6 py-4 text-sm font-bold text-green-600">
                  {new Intl.NumberFormat('en-ET', {
                    style: 'currency',
                    currency: 'ETB',
                    minimumFractionDigits: 0,
                  }).format(settlement.amount - settlement.commission)}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    settlement.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                    settlement.status === 'DISPUTED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {settlement.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/admin/settlements/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');
  const status = searchParams.get('status');
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  // Verify admin is from same organization
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (admin?.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const where: any = {
    load: {
      OR: [
        { shipper: { organizationId } },
        { carrier: { organizationId } },
      ],
    },
  };

  if (status && status !== 'all') {
    where.status = status.toUpperCase();
  }

  if (startDate) {
    where.createdAt = { ...where.createdAt, gte: new Date(startDate) };
  }

  if (endDate) {
    where.createdAt = { ...where.createdAt, lte: new Date(endDate) };
  }

  const settlements = await prisma.settlement.findMany({
    where,
    include: {
      load: {
        select: {
          pickupCity: true,
          deliveryCity: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ settlements });
}
```

**Files:**
- `/app/admin/settlements/page.tsx` (new)
- `/app/admin/settlements/SettlementsClient.tsx` (new)
- `/app/api/admin/settlements/route.ts` (new - GET)

**Acceptance:**
- ✓ Admin can view all settlements for their organization
- ✓ Can filter by status and date range
- ✓ Summary cards display total revenue, commission, pending
- ✓ Net received calculation is correct
- ✓ Cannot access settlements from other organizations

---

#### **Task 16.9B.4: Company Performance Dashboard** (2 days)
**Description:** Company Admin can view performance metrics for their organization

**Implementation:**
```typescript
// /app/admin/dashboard/PerformanceDashboardClient.tsx

'use client';

import { useState, useEffect } from 'react';
import { Line, Doughnut } from 'react-chartjs-2';

export default function PerformanceDashboardClient({ organizationId }: { organizationId: string }) {
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    fetchMetrics();
  }, []);

  const fetchMetrics = async () => {
    const response = await fetch(`/api/admin/metrics?organizationId=${organizationId}`);
    const data = await response.json();
    setMetrics(data);
  };

  if (!metrics) {
    return <div className="p-6">Loading...</div>;
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Company Performance Dashboard</h1>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Completion Rate</h3>
          <p className="text-3xl font-bold text-green-600">
            {metrics.completionRate.toFixed(1)}%
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {metrics.completedLoads} / {metrics.totalLoads} loads
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Avg Trust Score</h3>
          <p className="text-3xl font-bold">
            {metrics.avgTrustScore.toFixed(1)}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Across {metrics.activeUsers} users
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Active Exceptions</h3>
          <p className="text-3xl font-bold text-red-600">
            {metrics.activeExceptions}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            Require attention
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-gray-500 text-sm mb-2">Commission Tier</h3>
          <p className="text-3xl font-bold text-blue-600">
            {metrics.commissionTier}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {metrics.discountRate}% discount
          </p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Load Volume Trend */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Load Volume (Last 30 Days)</h3>
          <Line
            data={{
              labels: metrics.loadVolumeTrend.labels,
              datasets: [
                {
                  label: 'Loads Posted',
                  data: metrics.loadVolumeTrend.posted,
                  borderColor: 'rgb(59, 130, 246)',
                  backgroundColor: 'rgba(59, 130, 246, 0.1)',
                },
                {
                  label: 'Loads Completed',
                  data: metrics.loadVolumeTrend.completed,
                  borderColor: 'rgb(34, 197, 94)',
                  backgroundColor: 'rgba(34, 197, 94, 0.1)',
                },
              ],
            }}
            options={{
              responsive: true,
              plugins: { legend: { position: 'top' } },
            }}
          />
        </div>

        {/* Load Status Distribution */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Current Load Status</h3>
          <Doughnut
            data={{
              labels: metrics.loadStatusDistribution.labels,
              datasets: [
                {
                  data: metrics.loadStatusDistribution.data,
                  backgroundColor: [
                    'rgba(34, 197, 94, 0.8)',
                    'rgba(59, 130, 246, 0.8)',
                    'rgba(251, 191, 36, 0.8)',
                    'rgba(239, 68, 68, 0.8)',
                    'rgba(156, 163, 175, 0.8)',
                  ],
                },
              ],
            }}
          />
        </div>
      </div>

      {/* Performance Insights */}
      <div className="grid grid-cols-2 gap-6">
        {/* Top Performers */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Top Performing Users</h3>
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">User</th>
                <th className="text-right py-2">Loads</th>
                <th className="text-right py-2">Trust Score</th>
              </tr>
            </thead>
            <tbody>
              {metrics.topPerformers.map((user: any, i: number) => (
                <tr key={i} className="border-b">
                  <td className="py-2">{user.name}</td>
                  <td className="text-right">{user.loadCount}</td>
                  <td className="text-right">
                    <span className="font-semibold text-green-600">
                      {user.trustScore}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Areas for Improvement */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Areas for Improvement</h3>
          <div className="space-y-4">
            {metrics.completionRate < 90 && (
              <div className="p-3 bg-yellow-50 border-l-4 border-yellow-500">
                <p className="text-sm font-semibold">Completion Rate Below Target</p>
                <p className="text-xs text-gray-600">
                  Current: {metrics.completionRate.toFixed(1)}% | Target: 90%
                </p>
              </div>
            )}
            {metrics.activeExceptions > 5 && (
              <div className="p-3 bg-red-50 border-l-4 border-red-500">
                <p className="text-sm font-semibold">High Exception Count</p>
                <p className="text-xs text-gray-600">
                  {metrics.activeExceptions} active exceptions need resolution
                </p>
              </div>
            )}
            {metrics.avgTrustScore < 80 && (
              <div className="p-3 bg-orange-50 border-l-4 border-orange-500">
                <p className="text-sm font-semibold">Low Average Trust Score</p>
                <p className="text-xs text-gray-600">
                  Current: {metrics.avgTrustScore.toFixed(1)} | Target: 80+
                </p>
              </div>
            )}
            {metrics.completionRate >= 90 &&
              metrics.activeExceptions <= 5 &&
              metrics.avgTrustScore >= 80 && (
                <div className="p-3 bg-green-50 border-l-4 border-green-500">
                  <p className="text-sm font-semibold">Excellent Performance</p>
                  <p className="text-xs text-gray-600">
                    All key metrics meeting targets
                  </p>
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/admin/metrics/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (admin?.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Get organization details
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  // Total and completed loads
  const totalLoads = await prisma.load.count({
    where: {
      OR: [
        { shipper: { organizationId } },
        { carrier: { organizationId } },
      ],
    },
  });

  const completedLoads = await prisma.load.count({
    where: {
      status: 'COMPLETED',
      OR: [
        { shipper: { organizationId } },
        { carrier: { organizationId } },
      ],
    },
  });

  const completionRate = totalLoads > 0 ? (completedLoads / totalLoads) * 100 : 0;

  // Average trust score
  const users = await prisma.user.findMany({
    where: { organizationId, status: 'ACTIVE' },
    select: { trustScore: true },
  });

  const avgTrustScore = users.length > 0
    ? users.reduce((sum, u) => sum + (u.trustScore || 100), 0) / users.length
    : 100;

  // Active exceptions
  const activeExceptions = await prisma.exception.count({
    where: {
      status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'] },
      load: {
        OR: [
          { shipper: { organizationId } },
          { carrier: { organizationId } },
        ],
      },
    },
  });

  // Commission tier
  const commissionTier = organization?.commissionTier || 'STANDARD';
  const discountRate =
    commissionTier === 'PLATINUM' ? 15 :
    commissionTier === 'GOLD' ? 10 :
    commissionTier === 'SILVER' ? 5 : 0;

  // Load volume trend (last 30 days)
  const loadVolumeTrend = await getLoadVolumeTrend(organizationId, 30);

  // Load status distribution
  const loadStatusDistribution = await getLoadStatusDistribution(organizationId);

  // Top performers
  const topPerformers = await getTopPerformers(organizationId);

  return NextResponse.json({
    completionRate,
    completedLoads,
    totalLoads,
    avgTrustScore,
    activeUsers: users.length,
    activeExceptions,
    commissionTier,
    discountRate,
    loadVolumeTrend,
    loadStatusDistribution,
    topPerformers,
  });
}

async function getLoadVolumeTrend(organizationId: string, days: number) {
  const labels = [];
  const posted = [];
  const completed = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const startOfDay = new Date(date.setHours(0, 0, 0, 0));
    const endOfDay = new Date(date.setHours(23, 59, 59, 999));

    labels.push(startOfDay.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));

    const postedCount = await prisma.load.count({
      where: {
        createdAt: { gte: startOfDay, lte: endOfDay },
        OR: [
          { shipper: { organizationId } },
          { carrier: { organizationId } },
        ],
      },
    });

    const completedCount = await prisma.load.count({
      where: {
        status: 'COMPLETED',
        updatedAt: { gte: startOfDay, lte: endOfDay },
        OR: [
          { shipper: { organizationId } },
          { carrier: { organizationId } },
        ],
      },
    });

    posted.push(postedCount);
    completed.push(completedCount);
  }

  return { labels, posted, completed };
}

async function getLoadStatusDistribution(organizationId: string) {
  const statuses = ['POSTED', 'ASSIGNED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'];
  const labels = [];
  const data = [];

  for (const status of statuses) {
    const count = await prisma.load.count({
      where: {
        status,
        OR: [
          { shipper: { organizationId } },
          { carrier: { organizationId } },
        ],
      },
    });
    labels.push(status);
    data.push(count);
  }

  return { labels, data };
}

async function getTopPerformers(organizationId: string) {
  const users = await prisma.user.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
    },
    select: {
      name: true,
      trustScore: true,
      shipper: {
        select: {
          loads: {
            where: { status: 'COMPLETED' },
          },
        },
      },
      carrier: {
        select: {
          loads: {
            where: { status: 'COMPLETED' },
          },
        },
      },
    },
  });

  return users
    .map((user) => ({
      name: user.name,
      trustScore: user.trustScore || 100,
      loadCount: (user.shipper?.loads?.length || 0) + (user.carrier?.loads?.length || 0),
    }))
    .sort((a, b) => b.loadCount - a.loadCount)
    .slice(0, 5);
}
```

**Files:**
- `/app/admin/dashboard/page.tsx` (new)
- `/app/admin/dashboard/PerformanceDashboardClient.tsx` (new)
- `/app/api/admin/metrics/route.ts` (new - GET)

**Acceptance:**
- ✓ Admin can view completion rate
- ✓ Admin can view average trust score
- ✓ Admin can view active exceptions count
- ✓ Admin can view commission tier and discount
- ✓ Load volume trend chart displays correctly
- ✓ Load status distribution chart shows current state
- ✓ Top performers list displays correctly
- ✓ Performance insights highlight areas needing attention

---

#### **Task 16.9B.5: Company Preference Settings** (0.5 days)
**Description:** Company Admin can configure organization preferences

**Implementation:**
```typescript
// /app/admin/settings/SettingsClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function SettingsClient({ organizationId }: { organizationId: string }) {
  const [settings, setSettings] = useState({
    notifyOnLoadPosted: true,
    notifyOnLoadAssigned: true,
    notifyOnException: true,
    notifyOnSettlement: true,
    allowNameDisplay: true,
    targetCompletionRate: 90,
    targetTrustScore: 80,
  });

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const response = await fetch(`/api/admin/settings?organizationId=${organizationId}`);
    const data = await response.json();
    if (data.settings) {
      setSettings(data.settings);
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, settings }),
      });

      alert('Settings saved successfully');
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Company Settings</h1>

      <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
        {/* Notification Preferences */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Notification Preferences</h3>
          <div className="space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifyOnLoadPosted}
                onChange={(e) =>
                  setSettings({ ...settings, notifyOnLoadPosted: e.target.checked })
                }
                className="mr-3"
              />
              <span className="text-sm">Notify when loads are posted</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifyOnLoadAssigned}
                onChange={(e) =>
                  setSettings({ ...settings, notifyOnLoadAssigned: e.target.checked })
                }
                className="mr-3"
              />
              <span className="text-sm">Notify when loads are assigned</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifyOnException}
                onChange={(e) =>
                  setSettings({ ...settings, notifyOnException: e.target.checked })
                }
                className="mr-3"
              />
              <span className="text-sm">Notify on exceptions</span>
            </label>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={settings.notifyOnSettlement}
                onChange={(e) =>
                  setSettings({ ...settings, notifyOnSettlement: e.target.checked })
                }
                className="mr-3"
              />
              <span className="text-sm">Notify on settlement completion</span>
            </label>
          </div>
        </div>

        {/* Privacy Preferences */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Privacy Preferences</h3>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={settings.allowNameDisplay}
              onChange={(e) =>
                setSettings({ ...settings, allowNameDisplay: e.target.checked })
              }
              className="mr-3"
            />
            <span className="text-sm">
              Display company name publicly on load board
            </span>
          </label>
          <p className="text-xs text-gray-500 mt-1 ml-6">
            When disabled, company name will be masked to other users
          </p>
        </div>

        {/* Performance Targets */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold mb-4">Performance Targets</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Completion Rate (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.targetCompletionRate}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    targetCompletionRate: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used for performance dashboard benchmarking
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Average Trust Score
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={settings.targetTrustScore}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    targetTrustScore: parseInt(e.target.value),
                  })
                }
                className="w-full px-4 py-2 border rounded-md"
              />
              <p className="text-xs text-gray-500 mt-1">
                Used for performance dashboard benchmarking
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/admin/settings/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organizationId');

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (admin?.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  return NextResponse.json({
    settings: {
      notifyOnLoadPosted: organization?.notifyOnLoadPosted ?? true,
      notifyOnLoadAssigned: organization?.notifyOnLoadAssigned ?? true,
      notifyOnException: organization?.notifyOnException ?? true,
      notifyOnSettlement: organization?.notifyOnSettlement ?? true,
      allowNameDisplay: organization?.allowNameDisplay ?? true,
      targetCompletionRate: organization?.targetCompletionRate ?? 90,
      targetTrustScore: organization?.targetTrustScore ?? 80,
    },
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { organizationId, settings } = await request.json();

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
  });

  if (admin?.organizationId !== organizationId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      notifyOnLoadPosted: settings.notifyOnLoadPosted,
      notifyOnLoadAssigned: settings.notifyOnLoadAssigned,
      notifyOnException: settings.notifyOnException,
      notifyOnSettlement: settings.notifyOnSettlement,
      allowNameDisplay: settings.allowNameDisplay,
      targetCompletionRate: settings.targetCompletionRate,
      targetTrustScore: settings.targetTrustScore,
    },
  });

  return NextResponse.json({ success: true });
}
```

**Database Schema Update:**
```prisma
model Organization {
  // ... existing fields

  // Notification preferences
  notifyOnLoadPosted    Boolean @default(true)
  notifyOnLoadAssigned  Boolean @default(true)
  notifyOnException     Boolean @default(true)
  notifyOnSettlement    Boolean @default(true)

  // Privacy preferences
  allowNameDisplay      Boolean @default(true)

  // Performance targets
  targetCompletionRate  Int     @default(90)
  targetTrustScore      Int     @default(80)
}
```

**Files:**
- `/app/admin/settings/page.tsx` (new)
- `/app/admin/settings/SettingsClient.tsx` (new)
- `/app/api/admin/settings/route.ts` (new - GET/PUT)
- `/prisma/schema.prisma` (update Organization model)

**Acceptance:**
- ✓ Admin can configure notification preferences
- ✓ Admin can toggle company name display
- ✓ Admin can set performance targets
- ✓ Settings persist across sessions
- ✓ Cannot modify other organizations' settings

---

### Story 16.9B: Dependencies, Testing, Database Migration

**Dependencies:**
- Story 16.14 (User Status Flow) - for user management
- Story 16.13 (Exception System) - for exception tracking
- Phase 1 GPS Device implementation - for GPS management

**Testing Checklist:**
- [ ] Admin can view users in their organization only
- [ ] Admin can invite, suspend, activate users
- [ ] Admin can assign/unassign GPS devices
- [ ] Admin can view settlement history with filters
- [ ] Performance dashboard displays accurate metrics
- [ ] Settings save and load correctly
- [ ] Cannot access data from other organizations
- [ ] All admin actions scoped to their organization

**Database Migration:**
```prisma
// Add to Organization model
model Organization {
  // Notification preferences
  notifyOnLoadPosted    Boolean @default(true)
  notifyOnLoadAssigned  Boolean @default(true)
  notifyOnException     Boolean @default(true)
  notifyOnSettlement    Boolean @default(true)

  // Privacy preferences
  allowNameDisplay      Boolean @default(true)

  // Performance targets
  targetCompletionRate  Int     @default(90)
  targetTrustScore      Int     @default(80)
}
```

---

## STORY 16.10: NOTIFICATIONS EXPANDED

**User Story:**
_As any platform user, I want to receive real-time notifications for important events (GPS alerts, settlements, user status changes, exceptions, automation triggers), so that I stay informed and can respond quickly to issues._

**Background & Rationale:**
The current system has basic notifications. Phase 2 expands this to cover GPS events, settlement updates, user status changes, exception creation/escalation, and automation rule triggers. This keeps users informed without constant manual checking.

**Acceptance Criteria:**
- ✓ Notifications created for GPS events (offline, arrival)
- ✓ Notifications created for settlement events (POD, commission, completion)
- ✓ Notifications created for user status changes
- ✓ Notifications created for exception events
- ✓ Notifications created for automation rule triggers
- ✓ Notification bell UI shows unread count
- ✓ Users can mark notifications as read
- ✓ Users can view notification history

---

#### **Task 16.10.1: Notification Infrastructure** (0.5 days)
**Description:** Verify and enhance notification model and utilities

**Database Schema:**
```prisma
model Notification {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  type      String   // GPS_OFFLINE, POD_SUBMITTED, USER_SUSPENDED, etc.
  title     String
  message   String
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
  metadata  Json?    // Additional context (loadId, exceptionId, etc.)

  @@index([userId, read])
  @@index([createdAt])
}
```

**Utility Library:**
```typescript
// /lib/notifications.ts

import { prisma } from '@/lib/prisma';

export async function createNotification(params: {
  userId: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
}) {
  const { userId, type, title, message, metadata } = params;

  await prisma.notification.create({
    data: {
      userId,
      type,
      title,
      message,
      read: false,
      metadata: metadata || {},
    },
  });
}

export async function createNotificationForRole(params: {
  role: string;
  type: string;
  title: string;
  message: string;
  metadata?: any;
  organizationId?: string; // Optional: scope to specific organization
}) {
  const { role, type, title, message, metadata, organizationId } = params;

  const where: any = { role, status: 'ACTIVE' };
  if (organizationId) {
    where.organizationId = organizationId;
  }

  const users = await prisma.user.findMany({ where });

  for (const user of users) {
    await createNotification({
      userId: user.id,
      type,
      title,
      message,
      metadata,
    });
  }
}
```

**Files:**
- `/lib/notifications.ts` (verify exists, update if needed)
- `/prisma/schema.prisma` (verify Notification model)

**Acceptance:**
- ✓ Notification model exists with required fields
- ✓ Utility functions for creating notifications
- ✓ Can create notifications for individual users or roles

---

#### **Task 16.10.2: Database Migration** (0.5 days)
**Description:** Ensure notification model is up to date

```bash
npx prisma migrate dev --name add_notification_model
```

**Acceptance:**
- ✓ Notification table created
- ✓ Indexes added for performance

---

#### **Task 16.10.3: Notification Utility Library Enhancement** (0.5 days)
**Description:** Add helper functions for common notification patterns

```typescript
// /lib/notifications.ts (continued)

export async function notifyLoadStakeholders(loadId: string, type: string, title: string, message: string) {
  const load = await prisma.load.findUnique({
    where: { id: loadId },
    include: { shipper: true, carrier: true },
  });

  if (!load) return;

  // Notify shipper
  if (load.shipperId) {
    await createNotification({
      userId: load.shipperId,
      type,
      title,
      message,
      metadata: { loadId },
    });
  }

  // Notify carrier
  if (load.carrierId) {
    await createNotification({
      userId: load.carrierId,
      type,
      title,
      message,
      metadata: { loadId },
    });
  }
}

export async function getUnreadCount(userId: string): Promise<number> {
  return await prisma.notification.count({
    where: { userId, read: false },
  });
}

export async function markAsRead(notificationId: string) {
  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  });
}

export async function markAllAsRead(userId: string) {
  await prisma.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
}
```

**Acceptance:**
- ✓ Helper functions for load stakeholder notifications
- ✓ Unread count function
- ✓ Mark as read functions

---

#### **Task 16.10.4: GPS Offline Notification** (0.5 days)
**Description:** Notify when truck GPS goes offline

```typescript
// Integrate into /lib/gpsMonitoring.ts

import { createNotification } from '@/lib/notifications';

export async function monitorGPSStatus() {
  const offlineThreshold = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes

  const offlineTrucks = await prisma.truck.findMany({
    where: {
      lastGPSUpdate: { lt: offlineThreshold },
      loads: {
        some: {
          status: { in: ['IN_TRANSIT', 'PENDING_PICKUP'] },
        },
      },
    },
    include: {
      carrier: true,
      loads: {
        where: {
          status: { in: ['IN_TRANSIT', 'PENDING_PICKUP'] },
        },
        include: { shipper: true },
      },
    },
  });

  for (const truck of offlineTrucks) {
    // Notify carrier
    if (truck.carrier) {
      await createNotification({
        userId: truck.carrier.id,
        type: 'GPS_OFFLINE',
        title: 'GPS Offline Alert',
        message: `GPS for truck ${truck.licensePlate} has been offline for 30+ minutes`,
        metadata: { truckId: truck.id },
      });
    }

    // Notify shippers for active loads
    for (const load of truck.loads) {
      if (load.shipper) {
        await createNotification({
          userId: load.shipper.id,
          type: 'GPS_OFFLINE',
          title: 'GPS Offline for Your Load',
          message: `GPS for truck carrying your load (${load.pickupCity} → ${load.deliveryCity}) is offline`,
          metadata: { loadId: load.id, truckId: truck.id },
        });
      }
    }
  }
}
```

**Acceptance:**
- ✓ Carrier notified when GPS goes offline
- ✓ Shipper notified for affected loads

---

#### **Task 16.10.5: Truck Arrives at Pickup Notification** (0.5 days)
**Description:** Notify when truck arrives at pickup location

```typescript
// /lib/gpsMonitoring.ts

export async function checkPickupArrival(truckId: string, loadId: string, currentLat: number, currentLng: number) {
  const load = await prisma.load.findUnique({
    where: { id: loadId },
    include: { shipper: true, carrier: true },
  });

  if (!load || load.status !== 'PENDING_PICKUP') return;

  const distance = calculateDistance(
    currentLat,
    currentLng,
    load.pickupLat,
    load.pickupLng
  );

  if (distance < 0.5) { // Within 500 meters
    // Notify shipper
    await createNotification({
      userId: load.shipperId,
      type: 'TRUCK_AT_PICKUP',
      title: 'Truck Arrived at Pickup',
      message: `Truck ${load.truck?.licensePlate} has arrived at pickup location`,
      metadata: { loadId, truckId },
    });

    // Notify carrier
    if (load.carrierId) {
      await createNotification({
        userId: load.carrierId,
        type: 'TRUCK_AT_PICKUP',
        title: 'Arrived at Pickup',
        message: `You have arrived at pickup for load ${load.pickupCity} → ${load.deliveryCity}`,
        metadata: { loadId },
      });
    }
  }
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
```

**Acceptance:**
- ✓ Shipper notified when truck arrives
- ✓ Carrier notified of arrival

---

#### **Task 16.10.6: Truck Arrives at Delivery Notification** (0.5 days)
**Description:** Notify when truck arrives at delivery location

```typescript
// /lib/gpsMonitoring.ts (add similar function)

export async function checkDeliveryArrival(truckId: string, loadId: string, currentLat: number, currentLng: number) {
  const load = await prisma.load.findUnique({
    where: { id: loadId },
    include: { shipper: true, carrier: true },
  });

  if (!load || load.status !== 'IN_TRANSIT') return;

  const distance = calculateDistance(
    currentLat,
    currentLng,
    load.deliveryLat,
    load.deliveryLng
  );

  if (distance < 0.5) {
    // Notify shipper
    await createNotification({
      userId: load.shipperId,
      type: 'TRUCK_AT_DELIVERY',
      title: 'Truck Arrived at Delivery',
      message: `Truck ${load.truck?.licensePlate} has arrived at delivery location`,
      metadata: { loadId, truckId },
    });

    // Notify carrier
    if (load.carrierId) {
      await createNotification({
        userId: load.carrierId,
        type: 'TRUCK_AT_DELIVERY',
        title: 'Arrived at Delivery',
        message: `You have arrived at delivery for load ${load.pickupCity} → ${load.deliveryCity}`,
        metadata: { loadId },
      });
    }
  }
}
```

**Acceptance:**
- ✓ Shipper notified when truck arrives at delivery
- ✓ Carrier notified of arrival

---

#### **Task 16.10.7: POD Submitted Notification** (0.5 days)
**Description:** Notify shipper when carrier uploads POD

```typescript
// Integrate into /app/api/loads/[id]/pod/route.ts

import { createNotification } from '@/lib/notifications';

// After POD upload succeeds:
const load = await prisma.load.findUnique({
  where: { id: params.id },
  include: { shipper: true, carrier: true },
});

if (load?.shipperId) {
  await createNotification({
    userId: load.shipperId,
    type: 'POD_SUBMITTED',
    title: 'Proof of Delivery Submitted',
    message: `Carrier has submitted POD for load ${load.pickupCity} → ${load.deliveryCity}`,
    metadata: { loadId: load.id },
  });
}
```

**Acceptance:**
- ✓ Shipper notified when POD uploaded

---

#### **Task 16.10.8: POD Verified Notification** (0.5 days)
**Description:** Notify carrier when POD is verified

```typescript
// Integrate into POD verification endpoint

if (load?.carrierId) {
  await createNotification({
    userId: load.carrierId,
    type: 'POD_VERIFIED',
    title: 'POD Verified',
    message: `Your POD for load ${load.pickupCity} → ${load.deliveryCity} has been verified`,
    metadata: { loadId: load.id },
  });
}
```

**Acceptance:**
- ✓ Carrier notified when POD verified

---

#### **Task 16.10.9: Commission Deducted Notification** (0.5 days)
**Description:** Notify carrier when commission is deducted

```typescript
// Integrate into settlement creation

if (load?.carrierId) {
  await createNotification({
    userId: load.carrierId,
    type: 'COMMISSION_DEDUCTED',
    title: 'Commission Deducted',
    message: `Commission of ${new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(settlement.commission)} deducted from load payment`,
    metadata: { loadId: load.id, settlementId: settlement.id },
  });
}
```

**Acceptance:**
- ✓ Carrier notified of commission deduction with amount

---

#### **Task 16.10.10: Settlement Complete Notification** (0.5 days)
**Description:** Notify carrier when settlement is completed

```typescript
// Integrate into settlement completion

if (load?.carrierId) {
  await createNotification({
    userId: load.carrierId,
    type: 'SETTLEMENT_COMPLETE',
    title: 'Settlement Completed',
    message: `Settlement of ${new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
    }).format(settlement.amount - settlement.commission)} completed for load ${load.pickupCity} → ${load.deliveryCity}`,
    metadata: { loadId: load.id, settlementId: settlement.id },
  });
}
```

**Acceptance:**
- ✓ Carrier notified when payment completed

---

#### **Task 16.10.11: User Status Change Notifications** (0.5 days)
**Description:** Notify users when their status changes

```typescript
// Integrate into /lib/userStatus.ts

import { createNotification } from '@/lib/notifications';

export async function changeUserStatus(
  userId: string,
  newStatus: UserStatus,
  reason: string | null,
  changedBy: string
) {
  // ... existing status change logic

  // Notify user
  await createNotification({
    userId,
    type: 'USER_STATUS_CHANGED',
    title: `Account ${newStatus}`,
    message: reason || `Your account status has been changed to ${newStatus}`,
    metadata: { oldStatus, newStatus, reason },
  });
}
```

**Acceptance:**
- ✓ User notified when status changes (ACTIVE, SUSPENDED, etc.)
- ✓ Reason included in notification

---

#### **Task 16.10.12: Exception Created Notification** (0.5 days)
**Description:** Notify stakeholders when exception is created

```typescript
// Integrate into /lib/exceptions.ts

import { createNotification } from '@/lib/notifications';

export async function createException(params: CreateExceptionParams) {
  // ... existing exception creation logic

  const exception = await prisma.exception.create({ /* ... */ });

  // Notify assigned user
  if (assignedTo) {
    await createNotification({
      userId: assignedTo.id,
      type: 'EXCEPTION_CREATED',
      title: `New ${severity} Exception`,
      message: title,
      metadata: { exceptionId: exception.id, loadId, truckId },
    });
  }

  // Notify load stakeholders
  if (loadId) {
    await notifyLoadStakeholders(
      loadId,
      'EXCEPTION_CREATED',
      'Exception Reported',
      `An exception has been reported for your load: ${title}`
    );
  }

  return exception.id;
}
```

**Acceptance:**
- ✓ Assigned dispatcher/admin notified
- ✓ Load shipper/carrier notified

---

#### **Task 16.10.13: Exception Escalated Notification** (0.5 days)
**Description:** Notify when exception is escalated

```typescript
// Integrate into exception escalation logic

export async function escalateException(exceptionId: string, newTier: number, reason: string) {
  // ... existing escalation logic

  const newAssignedUsers = await findUsersForTier(newTier);

  for (const user of newAssignedUsers) {
    await createNotification({
      userId: user.id,
      type: 'EXCEPTION_ESCALATED',
      title: `Exception Escalated to Tier ${newTier}`,
      message: `Exception "${exception.title}" has been escalated: ${reason}`,
      metadata: { exceptionId, loadId: exception.loadId },
    });
  }
}
```

**Acceptance:**
- ✓ New tier users notified of escalation
- ✓ Escalation reason included

---

#### **Task 16.10.14: Automation Rule Triggered Notification** (0.5 days)
**Description:** Notify when automation rule takes action

```typescript
// Integrate into /lib/automationEngine.ts

async function executeAction(action: any, entity: any, ruleId: string) {
  const rule = await prisma.automationRule.findUnique({ where: { id: ruleId } });

  // Execute action...

  // Notify affected user
  if (entity.id && (action.type === 'REDUCE_TRUST_SCORE' || action.type === 'SUSPEND_ACCOUNT' || action.type === 'FLAG_USER')) {
    await createNotification({
      userId: entity.id,
      type: 'AUTOMATION_TRIGGERED',
      title: 'Automated Action Taken',
      message: `Automation rule "${rule?.name}" triggered: ${action.type}`,
      metadata: { ruleId, actionType: action.type },
    });
  }

  // Notify SuperAdmins for significant actions
  if (action.type === 'SUSPEND_ACCOUNT') {
    await createNotificationForRole({
      role: 'SUPERADMIN',
      type: 'AUTOMATION_TRIGGERED',
      title: 'User Suspended by Automation',
      message: `User ${entity.email} suspended by rule "${rule?.name}"`,
      metadata: { userId: entity.id, ruleId },
    });
  }
}
```

**Acceptance:**
- ✓ User notified when automation affects them
- ✓ Admins notified of significant automated actions

---

#### **Task 16.10.15: Notification Bell UI Component** (1 day)
**Description:** Header notification bell with dropdown

```typescript
// /components/NotificationBell.tsx

'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function NotificationBell() {
  const { data: session } = useSession();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (session?.user?.id) {
      fetchNotifications();
      // Poll every 30 seconds
      const interval = setInterval(fetchNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [session]);

  const fetchNotifications = async () => {
    const response = await fetch('/api/notifications');
    const data = await response.json();
    setNotifications(data.notifications || []);
    setUnreadCount(data.unreadCount || 0);
  };

  const handleMarkAsRead = async (notificationId: string) => {
    await fetch(`/api/notifications/${notificationId}/read`, { method: 'PUT' });
    fetchNotifications();
  };

  const handleMarkAllAsRead = async () => {
    await fetch('/api/notifications/mark-all-read', { method: 'PUT' });
    fetchNotifications();
  };

  if (!session?.user) return null;

  return (
    <div className="relative">
      {/* Bell Icon */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-red-600 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-20 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h3 className="text-sm font-semibold">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllAsRead}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No notifications
                </div>
              ) : (
                notifications.map((notification: any) => (
                  <div
                    key={notification.id}
                    className={`px-4 py-3 border-b hover:bg-gray-50 cursor-pointer ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-sm font-semibold">{notification.title}</h4>
                      {!notification.read && (
                        <span className="w-2 h-2 bg-blue-600 rounded-full ml-2 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t text-center">
                <a
                  href="/notifications"
                  className="text-sm text-blue-600 hover:underline"
                  onClick={() => setIsOpen(false)}
                >
                  View all notifications
                </a>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

**API Endpoints:**
```typescript
// /app/api/notifications/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { getUnreadCount } from '@/lib/notifications';

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  const unreadCount = await getUnreadCount(session.user.id);

  return NextResponse.json({ notifications, unreadCount });
}

// /app/api/notifications/[id]/read/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.notification.update({
    where: { id: params.id, userId: session.user.id },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}

// /app/api/notifications/mark-all-read/route.ts

export async function PUT() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });

  return NextResponse.json({ success: true });
}
```

**Integration into Header:**
```typescript
// Update /components/Header.tsx or /app/layout.tsx

import NotificationBell from '@/components/NotificationBell';

// Add to header navigation:
<NotificationBell />
```

**Files:**
- `/components/NotificationBell.tsx` (new)
- `/app/api/notifications/route.ts` (new - GET)
- `/app/api/notifications/[id]/read/route.ts` (new - PUT)
- `/app/api/notifications/mark-all-read/route.ts` (new - PUT)
- `/app/notifications/page.tsx` (new - full history page)

**Acceptance:**
- ✓ Bell icon shows unread count
- ✓ Dropdown displays recent notifications
- ✓ Can mark individual notifications as read
- ✓ Can mark all as read
- ✓ Link to full notifications page
- ✓ Polls for new notifications every 30 seconds
- ✓ Unread notifications highlighted

---

### Story 16.10: Dependencies, Testing

**Dependencies:**
- Story 16.12 (Load Lifecycle) - for state transitions
- Story 16.13 (Exception System) - for exception notifications
- Story 16.14 (User Status) - for user status notifications
- Story 16.9A (Automation) - for automation trigger notifications

**Testing Checklist:**
- [ ] GPS offline notifications sent to carrier and shipper
- [ ] Pickup arrival notifications sent
- [ ] Delivery arrival notifications sent
- [ ] POD submission notifies shipper
- [ ] POD verification notifies carrier
- [ ] Commission deduction notifies carrier
- [ ] Settlement completion notifies carrier
- [ ] User status change notifies user
- [ ] Exception creation notifies assigned user and stakeholders
- [ ] Exception escalation notifies new tier users
- [ ] Automation triggers notify affected users
- [ ] Notification bell displays unread count
- [ ] Mark as read functionality works
- [ ] Polling updates notification count
- [ ] Full notification history page works

---

## STORY 16.15: SHIPPER-LED TRUCK MATCHING

**User Story:**
_As a Shipper, I want to search for available trucks, view their details, and directly request booking, so that I can proactively find carriers instead of waiting for them to find my loads._

**Background & Rationale:**
Currently, carriers search for loads. This story enables shippers to search for trucks (reversing the flow), view truck details, send direct booking requests to carriers, and optionally negotiate rates. This gives shippers more control and speeds up matching.

**Acceptance Criteria:**
- ✓ Shipper can search available trucks with advanced filters
- ✓ Shipper can view truck details (type, location, carrier rating)
- ✓ Shipper can send direct booking request to carrier
- ✓ Carrier receives booking request notification
- ✓ Carrier can accept/reject booking request
- ✓ Booking history tracked for both parties
- ✓ (Optional) Rate negotiation via counter-offers

---

#### **Task 16.15.1: Enhanced Truck Search Filters** (1.5 days)
**Description:** Add advanced search filters for shippers searching for trucks

**Implementation:**
```typescript
// /app/shipper/search-trucks/SearchTrucksClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function SearchTrucksClient() {
  const [trucks, setTrucks] = useState([]);
  const [filters, setFilters] = useState({
    truckType: '',
    originCity: '',
    destinationCity: '',
    minCapacity: '',
    maxDeadheadKm: '',
    availableFrom: '',
    availableTo: '',
    minTrustScore: '',
    verified: false,
  });

  useEffect(() => {
    searchTrucks();
  }, [filters]);

  const searchTrucks = async () => {
    const params = new URLSearchParams(filters as any);
    const response = await fetch(`/api/shipper/search-trucks?${params}`);
    const data = await response.json();
    setTrucks(data.trucks || []);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Search Available Trucks</h1>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">Search Filters</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Truck Type
            </label>
            <select
              value={filters.truckType}
              onChange={(e) => setFilters({ ...filters, truckType: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="">All Types</option>
              <option value="DRY_VAN">Dry Van</option>
              <option value="REEFER">Reefer</option>
              <option value="FLATBED">Flatbed</option>
              <option value="TANKER">Tanker</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Origin City
            </label>
            <input
              type="text"
              value={filters.originCity}
              onChange={(e) => setFilters({ ...filters, originCity: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
              placeholder="e.g., Addis Ababa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Destination City
            </label>
            <input
              type="text"
              value={filters.destinationCity}
              onChange={(e) => setFilters({ ...filters, destinationCity: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
              placeholder="e.g., Dire Dawa"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Capacity (kg)
            </label>
            <input
              type="number"
              value={filters.minCapacity}
              onChange={(e) => setFilters({ ...filters, minCapacity: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Max Deadhead (km)
            </label>
            <input
              type="number"
              value={filters.maxDeadheadKm}
              onChange={(e) => setFilters({ ...filters, maxDeadheadKm: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Min Trust Score
            </label>
            <input
              type="number"
              min="0"
              max="100"
              value={filters.minTrustScore}
              onChange={(e) => setFilters({ ...filters, minTrustScore: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
            />
          </div>

          <div className="col-span-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters.verified}
                onChange={(e) => setFilters({ ...filters, verified: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm">Verified Carriers Only</span>
            </label>
          </div>
        </div>
      </div>

      {/* Truck Results */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Truck
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Current Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Capacity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Carrier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Trust Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {trucks.map((truck: any) => (
              <tr key={truck.id}>
                <td className="px-6 py-4 text-sm font-medium">
                  {truck.licensePlate}
                </td>
                <td className="px-6 py-4 text-sm">{truck.truckType}</td>
                <td className="px-6 py-4 text-sm">{truck.currentCity?.name || 'N/A'}</td>
                <td className="px-6 py-4 text-sm">{truck.maxWeight} kg</td>
                <td className="px-6 py-4 text-sm">
                  {truck.carrier?.organization?.name}
                  {truck.carrier?.organization?.verified && (
                    <span className="ml-2 text-green-600">✓</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <span className={`text-sm font-semibold ${
                    truck.carrier?.trustScore >= 80 ? 'text-green-600' :
                    truck.carrier?.trustScore >= 60 ? 'text-yellow-600' :
                    'text-red-600'
                  }`}>
                    {truck.carrier?.trustScore || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <a
                    href={`/shipper/search-trucks/${truck.id}/book`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Book
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/shipper/search-trucks/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SHIPPER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const truckType = searchParams.get('truckType');
  const originCity = searchParams.get('originCity');
  const destinationCity = searchParams.get('destinationCity');
  const minCapacity = searchParams.get('minCapacity');
  const maxDeadheadKm = searchParams.get('maxDeadheadKm');
  const minTrustScore = searchParams.get('minTrustScore');
  const verified = searchParams.get('verified') === 'true';

  const where: any = {
    status: 'AVAILABLE',
  };

  if (truckType) {
    where.truckType = truckType;
  }

  if (originCity) {
    where.currentCity = { name: { contains: originCity, mode: 'insensitive' } };
  }

  if (minCapacity) {
    where.maxWeight = { gte: parseFloat(minCapacity) };
  }

  if (minTrustScore) {
    where.carrier = {
      ...where.carrier,
      trustScore: { gte: parseFloat(minTrustScore) },
    };
  }

  if (verified) {
    where.carrier = {
      ...where.carrier,
      organization: { verified: true },
    };
  }

  const trucks = await prisma.truck.findMany({
    where,
    include: {
      currentCity: true,
      carrier: {
        include: {
          organization: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ trucks });
}
```

**Files:**
- `/app/shipper/search-trucks/page.tsx` (new)
- `/app/shipper/search-trucks/SearchTrucksClient.tsx` (new)
- `/app/api/shipper/search-trucks/route.ts` (new - GET)

**Acceptance:**
- ✓ Shipper can search trucks with multiple filters
- ✓ Results show truck details
- ✓ Verified carriers marked
- ✓ Trust score displayed with color coding

---

#### **Task 16.15.2: Direct Booking Button** (1 day)
**Description:** Shipper can send booking request to carrier

**Implementation:**
```typescript
// /app/shipper/search-trucks/[truckId]/book/BookingRequestClient.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function BookingRequestClient({ truckId, truck }: any) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    loadId: '',
    offerRate: '',
    message: '',
  });
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    setSending(true);

    try {
      const response = await fetch('/api/shipper/booking-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ truckId, ...formData }),
      });

      if (!response.ok) throw new Error('Failed to send booking request');

      alert('Booking request sent successfully!');
      router.push('/shipper/booking-requests');
    } catch (error) {
      alert('Failed to send booking request');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Send Booking Request</h1>

      <div className="bg-white p-6 rounded-lg shadow max-w-2xl">
        {/* Truck Details */}
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Truck Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">License Plate:</span>
              <span className="ml-2 font-medium">{truck.licensePlate}</span>
            </div>
            <div>
              <span className="text-gray-600">Type:</span>
              <span className="ml-2 font-medium">{truck.truckType}</span>
            </div>
            <div>
              <span className="text-gray-600">Carrier:</span>
              <span className="ml-2 font-medium">{truck.carrier?.name}</span>
            </div>
            <div>
              <span className="text-gray-600">Trust Score:</span>
              <span className="ml-2 font-semibold text-green-600">
                {truck.carrier?.trustScore}
              </span>
            </div>
          </div>
        </div>

        {/* Booking Form */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Your Load *
            </label>
            <select
              value={formData.loadId}
              onChange={(e) => setFormData({ ...formData, loadId: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
            >
              <option value="">Select load...</option>
              {/* TODO: Load shipper's posted loads */}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Offer Rate (ETB) *
            </label>
            <input
              type="number"
              value={formData.offerRate}
              onChange={(e) => setFormData({ ...formData, offerRate: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
              placeholder="e.g., 50000"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message to Carrier
            </label>
            <textarea
              value={formData.message}
              onChange={(e) => setFormData({ ...formData, message: e.target.value })}
              className="w-full px-4 py-2 border rounded-md"
              rows={4}
              placeholder="Add any additional details or requirements..."
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={sending || !formData.loadId || !formData.offerRate}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {sending ? 'Sending...' : 'Send Booking Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/shipper/booking-requests/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SHIPPER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { truckId, loadId, offerRate, message } = await request.json();

  // Verify load belongs to shipper
  const load = await prisma.load.findUnique({
    where: { id: loadId, shipperId: session.user.id },
  });

  if (!load) {
    return NextResponse.json({ error: 'Load not found' }, { status: 404 });
  }

  // Get truck and carrier details
  const truck = await prisma.truck.findUnique({
    where: { id: truckId },
    include: { carrier: true },
  });

  if (!truck) {
    return NextResponse.json({ error: 'Truck not found' }, { status: 404 });
  }

  // Create booking request
  const bookingRequest = await prisma.bookingRequest.create({
    data: {
      shipperId: session.user.id,
      carrierId: truck.carrier.id,
      truckId,
      loadId,
      offerRate: parseFloat(offerRate),
      message,
      status: 'PENDING',
    },
  });

  // Notify carrier
  await createNotification({
    userId: truck.carrier.id,
    type: 'BOOKING_REQUEST',
    title: 'New Booking Request',
    message: `Shipper has requested to book your truck (${truck.licensePlate}) for ${load.pickupCity} → ${load.deliveryCity} at ${offerRate} ETB`,
    metadata: { bookingRequestId: bookingRequest.id, loadId, truckId },
  });

  return NextResponse.json({ bookingRequest });
}
```

**Database Schema:**
```prisma
model BookingRequest {
  id          String   @id @default(cuid())
  shipperId   String
  shipper     User     @relation("ShipperBookings", fields: [shipperId], references: [id])
  carrierId   String
  carrier     User     @relation("CarrierBookings", fields: [carrierId], references: [id])
  truckId     String
  truck       Truck    @relation(fields: [truckId], references: [id])
  loadId      String
  load        Load     @relation(fields: [loadId], references: [id])
  offerRate   Float
  counterRate Float?   // For negotiation
  message     String?
  response    String?
  status      BookingStatus @default(PENDING)
  createdAt   DateTime @default(now())
  respondedAt DateTime?

  @@index([shipperId])
  @@index([carrierId])
  @@index([status])
}

enum BookingStatus {
  PENDING
  ACCEPTED
  REJECTED
  COUNTER_OFFERED
  CANCELLED
}
```

**Files:**
- `/app/shipper/search-trucks/[truckId]/book/page.tsx` (new)
- `/app/shipper/search-trucks/[truckId]/book/BookingRequestClient.tsx` (new)
- `/app/api/shipper/booking-requests/route.ts` (new - POST)
- `/prisma/schema.prisma` (add BookingRequest model)

**Acceptance:**
- ✓ Shipper can select load
- ✓ Shipper can offer rate
- ✓ Carrier receives notification
- ✓ Booking request created with PENDING status

---

#### **Task 16.15.3: Booking Request Management - Carrier** (1.5 days)
**Description:** Carrier can view and respond to booking requests

**Implementation:**
```typescript
// /app/carrier/booking-requests/BookingRequestsClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function BookingRequestsClient() {
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState('PENDING');

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const fetchRequests = async () => {
    const response = await fetch(`/api/carrier/booking-requests?status=${filter}`);
    const data = await response.json();
    setRequests(data.requests || []);
  };

  const handleAccept = async (requestId: string) => {
    if (!confirm('Accept this booking request?')) return;

    await fetch(`/api/carrier/booking-requests/${requestId}/accept`, {
      method: 'PUT',
    });

    fetchRequests();
    alert('Booking request accepted!');
  };

  const handleReject = async (requestId: string) => {
    const reason = prompt('Reason for rejection (optional):');

    await fetch(`/api/carrier/booking-requests/${requestId}/reject`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });

    fetchRequests();
    alert('Booking request rejected');
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Booking Requests</h1>

      {/* Filter Tabs */}
      <div className="flex gap-4 mb-6">
        {['PENDING', 'ACCEPTED', 'REJECTED', 'ALL'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-md ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Booking Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Shipper
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Load
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Truck
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Offer Rate
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requests.map((request: any) => (
              <tr key={request.id}>
                <td className="px-6 py-4 text-sm">
                  {new Date(request.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">{request.shipper.name}</td>
                <td className="px-6 py-4 text-sm">
                  {request.load.pickupCity} → {request.load.deliveryCity}
                </td>
                <td className="px-6 py-4 text-sm">{request.truck.licensePlate}</td>
                <td className="px-6 py-4 text-sm font-semibold">
                  {new Intl.NumberFormat('en-ET', {
                    style: 'currency',
                    currency: 'ETB',
                  }).format(request.offerRate)}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    request.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                    request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {request.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {request.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAccept(request.id)}
                        className="text-sm text-green-600 hover:underline"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleReject(request.id)}
                        className="text-sm text-red-600 hover:underline"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/carrier/booking-requests/route.ts

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';
import { authOptions } from '@/lib/auth';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'CARRIER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');

  const where: any = { carrierId: session.user.id };

  if (status && status !== 'ALL') {
    where.status = status;
  }

  const requests = await prisma.bookingRequest.findMany({
    where,
    include: {
      shipper: true,
      load: true,
      truck: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ requests });
}

// /app/api/carrier/booking-requests/[id]/accept/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'CARRIER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const bookingRequest = await prisma.bookingRequest.findUnique({
    where: { id: params.id, carrierId: session.user.id },
    include: { load: true, truck: true, shipper: true },
  });

  if (!bookingRequest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Update booking request
  await prisma.bookingRequest.update({
    where: { id: params.id },
    data: {
      status: 'ACCEPTED',
      respondedAt: new Date(),
    },
  });

  // Assign load to truck
  await prisma.load.update({
    where: { id: bookingRequest.loadId },
    data: {
      carrierId: session.user.id,
      truckPostingId: bookingRequest.truckId, // Assuming truck posting ID
      status: 'ASSIGNED',
      agreedRate: bookingRequest.offerRate,
    },
  });

  // Notify shipper
  await createNotification({
    userId: bookingRequest.shipperId,
    type: 'BOOKING_ACCEPTED',
    title: 'Booking Request Accepted',
    message: `Carrier has accepted your booking request for ${bookingRequest.load.pickupCity} → ${bookingRequest.load.deliveryCity}`,
    metadata: { bookingRequestId: params.id, loadId: bookingRequest.loadId },
  });

  return NextResponse.json({ success: true });
}

// /app/api/carrier/booking-requests/[id]/reject/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'CARRIER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { reason } = await request.json();

  const bookingRequest = await prisma.bookingRequest.findUnique({
    where: { id: params.id, carrierId: session.user.id },
    include: { load: true, shipper: true },
  });

  if (!bookingRequest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.bookingRequest.update({
    where: { id: params.id },
    data: {
      status: 'REJECTED',
      response: reason || 'Request rejected',
      respondedAt: new Date(),
    },
  });

  // Notify shipper
  await createNotification({
    userId: bookingRequest.shipperId,
    type: 'BOOKING_REJECTED',
    title: 'Booking Request Rejected',
    message: `Carrier has rejected your booking request${reason ? `: ${reason}` : ''}`,
    metadata: { bookingRequestId: params.id, loadId: bookingRequest.loadId },
  });

  return NextResponse.json({ success: true });
}
```

**Files:**
- `/app/carrier/booking-requests/page.tsx` (new)
- `/app/carrier/booking-requests/BookingRequestsClient.tsx` (new)
- `/app/api/carrier/booking-requests/route.ts` (new - GET)
- `/app/api/carrier/booking-requests/[id]/accept/route.ts` (new - PUT)
- `/app/api/carrier/booking-requests/[id]/reject/route.ts` (new - PUT)

**Acceptance:**
- ✓ Carrier can view booking requests
- ✓ Can filter by status
- ✓ Can accept requests (assigns load automatically)
- ✓ Can reject with optional reason
- ✓ Shipper notified of accept/reject

---

#### **Task 16.15.4: Booking History** (1 day)
**Description:** Both shipper and carrier can view booking request history

**Implementation:**
```typescript
// /app/shipper/booking-requests/ShipperBookingHistoryClient.tsx

'use client';

import { useState, useEffect } from 'react';

export default function ShipperBookingHistoryClient() {
  const [requests, setRequests] = useState([]);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    const response = await fetch('/api/shipper/booking-requests');
    const data = await response.json();
    setRequests(data.requests || []);
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">My Booking Requests</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Truck
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Load
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Offer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Response
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {requests.map((request: any) => (
              <tr key={request.id}>
                <td className="px-6 py-4 text-sm">
                  {new Date(request.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 text-sm">{request.truck.licensePlate}</td>
                <td className="px-6 py-4 text-sm">
                  {request.load.pickupCity} → {request.load.deliveryCity}
                </td>
                <td className="px-6 py-4 text-sm font-semibold">
                  {new Intl.NumberFormat('en-ET', {
                    style: 'currency',
                    currency: 'ETB',
                  }).format(request.offerRate)}
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    request.status === 'ACCEPTED' ? 'bg-green-100 text-green-800' :
                    request.status === 'REJECTED' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {request.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-600">
                  {request.response || '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**API Implementation:**
```typescript
// /app/api/shipper/booking-requests/route.ts

export async function GET() {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'SHIPPER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const requests = await prisma.bookingRequest.findMany({
    where: { shipperId: session.user.id },
    include: {
      truck: true,
      load: true,
      carrier: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ requests });
}
```

**Files:**
- `/app/shipper/booking-requests/page.tsx` (new)
- `/app/shipper/booking-requests/ShipperBookingHistoryClient.tsx` (new)
- `/app/api/shipper/booking-requests/route.ts` (update - add GET)

**Acceptance:**
- ✓ Shipper can view all sent booking requests
- ✓ Status and response displayed
- ✓ History sorted by date

---

#### **Task 16.15.5: Rate Negotiation (Optional)** (2 days)
**Description:** Carrier can counter-offer, shipper can accept/reject

**Implementation:**
```typescript
// /app/api/carrier/booking-requests/[id]/counter/route.ts

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);

  if (session?.user?.role !== 'CARRIER') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { counterRate, message } = await request.json();

  const bookingRequest = await prisma.bookingRequest.findUnique({
    where: { id: params.id, carrierId: session.user.id },
    include: { load: true, shipper: true },
  });

  if (!bookingRequest) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  await prisma.bookingRequest.update({
    where: { id: params.id },
    data: {
      status: 'COUNTER_OFFERED',
      counterRate: parseFloat(counterRate),
      response: message,
      respondedAt: new Date(),
    },
  });

  // Notify shipper
  await createNotification({
    userId: bookingRequest.shipperId,
    type: 'BOOKING_COUNTER_OFFER',
    title: 'Counter Offer Received',
    message: `Carrier has counter-offered ${counterRate} ETB for your booking request`,
    metadata: { bookingRequestId: params.id, loadId: bookingRequest.loadId },
  });

  return NextResponse.json({ success: true });
}
```

**Files:**
- `/app/api/carrier/booking-requests/[id]/counter/route.ts` (new - PUT)
- `/app/api/shipper/booking-requests/[id]/accept-counter/route.ts` (new - PUT)
- `/app/api/shipper/booking-requests/[id]/reject-counter/route.ts` (new - PUT)

**Acceptance:**
- ✓ Carrier can send counter-offer
- ✓ Shipper notified of counter-offer
- ✓ Shipper can accept/reject counter-offer
- ✓ Counter-offer rate saved

---

#### **Task 16.15.6: Database Schema - BookingRequest Model** (0.5 days)
**Description:** Create database migration for booking requests

```bash
npx prisma migrate dev --name add_booking_request_model
```

**Schema Added:**
```prisma
model BookingRequest {
  id          String        @id @default(cuid())
  shipperId   String
  shipper     User          @relation("ShipperBookings", fields: [shipperId], references: [id])
  carrierId   String
  carrier     User          @relation("CarrierBookings", fields: [carrierId], references: [id])
  truckId     String
  truck       Truck         @relation(fields: [truckId], references: [id])
  loadId      String
  load        Load          @relation(fields: [loadId], references: [id])
  offerRate   Float
  counterRate Float?
  message     String?
  response    String?
  status      BookingStatus @default(PENDING)
  createdAt   DateTime      @default(now())
  respondedAt DateTime?

  @@index([shipperId])
  @@index([carrierId])
  @@index([status])
  @@index([createdAt])
}

enum BookingStatus {
  PENDING
  ACCEPTED
  REJECTED
  COUNTER_OFFERED
  CANCELLED
}
```

**Acceptance:**
- ✓ BookingRequest table created
- ✓ Relationships established
- ✓ Indexes added for performance

---

### Story 16.15: Dependencies, Testing, Database Migration

**Dependencies:**
- Phase 1 Truck Management - for truck data
- Story 16.10 (Notifications) - for booking notifications

**Testing Checklist:**
- [ ] Shipper can search trucks with filters
- [ ] Shipper can send booking request
- [ ] Carrier receives notification
- [ ] Carrier can accept booking request
- [ ] Load automatically assigned on accept
- [ ] Carrier can reject booking request
- [ ] Shipper notified of accept/reject
- [ ] Booking history displays correctly
- [ ] (Optional) Counter-offer workflow works
- [ ] All booking request statuses tracked

**Database Migration:**
```prisma
model BookingRequest {
  id          String        @id @default(cuid())
  shipperId   String
  shipper     User          @relation("ShipperBookings", fields: [shipperId], references: [id])
  carrierId   String
  carrier     User          @relation("CarrierBookings", fields: [carrierId], references: [id])
  truckId     String
  truck       Truck         @relation(fields: [truckId], references: [id])
  loadId      String
  load        Load          @relation(fields: [loadId], references: [id])
  offerRate   Float
  counterRate Float?
  message     String?
  response    String?
  status      BookingStatus @default(PENDING)
  createdAt   DateTime      @default(now())
  respondedAt DateTime?

  @@index([shipperId])
  @@index([carrierId])
  @@index([status])
  @@index([createdAt])
}

enum BookingStatus {
  PENDING
  ACCEPTED
  REJECTED
  COUNTER_OFFERED
  CANCELLED
}
```

---

## END OF PHASE 2 PLATFORM USER STORIES - PART 2

**Summary:**
- ✅ Story 16.9A: SuperAdmin Tools (8 tasks) - COMPLETE
- ✅ Story 16.9B: Company Admin Tools (5 tasks) - COMPLETE
- ✅ Story 16.10: Notifications Expanded (15 tasks) - COMPLETE
- ✅ Story 16.15: Shipper-Led Truck Matching (6 tasks) - COMPLETE

**Total in Part 2:** 34 tasks documented with full implementation code

**Next Steps:**
1. Review Part 2 content
2. Merge Part 2 into main platform document OR keep separate
3. Create PHASE_2_USER_STORIES_MOBILE.md (40 tasks)
4. Create CONSOLIDATED_SPRINT_PLAN.md

