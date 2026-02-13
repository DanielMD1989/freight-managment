/**
 * Load State Machine Tests
 *
 * Tests for load lifecycle state transitions
 */

import {
  LoadStatus,
  VALID_TRANSITIONS,
  ROLE_PERMISSIONS,
  isValidTransition,
  canRoleSetStatus,
  getValidNextStates,
  validateStateTransition,
  getStatusDescription,
} from '@/lib/loadStateMachine';

describe('lib/loadStateMachine', () => {
  // ============================================================================
  // isValidTransition - State transition validation
  // ============================================================================
  describe('isValidTransition', () => {
    describe('DRAFT transitions', () => {
      it('should allow DRAFT → POSTED', () => {
        expect(isValidTransition(LoadStatus.DRAFT, LoadStatus.POSTED)).toBe(true);
      });

      it('should allow DRAFT → CANCELLED', () => {
        expect(isValidTransition(LoadStatus.DRAFT, LoadStatus.CANCELLED)).toBe(true);
      });

      it('should NOT allow DRAFT → IN_TRANSIT', () => {
        expect(isValidTransition(LoadStatus.DRAFT, LoadStatus.IN_TRANSIT)).toBe(false);
      });
    });

    describe('POSTED transitions', () => {
      it('should allow POSTED → SEARCHING', () => {
        expect(isValidTransition(LoadStatus.POSTED, LoadStatus.SEARCHING)).toBe(true);
      });

      it('should allow POSTED → OFFERED', () => {
        expect(isValidTransition(LoadStatus.POSTED, LoadStatus.OFFERED)).toBe(true);
      });

      it('should allow POSTED → ASSIGNED', () => {
        expect(isValidTransition(LoadStatus.POSTED, LoadStatus.ASSIGNED)).toBe(true);
      });

      it('should allow POSTED → UNPOSTED', () => {
        expect(isValidTransition(LoadStatus.POSTED, LoadStatus.UNPOSTED)).toBe(true);
      });

      it('should allow POSTED → CANCELLED', () => {
        expect(isValidTransition(LoadStatus.POSTED, LoadStatus.CANCELLED)).toBe(true);
      });

      it('should allow POSTED → EXPIRED', () => {
        expect(isValidTransition(LoadStatus.POSTED, LoadStatus.EXPIRED)).toBe(true);
      });
    });

    describe('IN_TRANSIT transitions', () => {
      it('should allow IN_TRANSIT → DELIVERED', () => {
        expect(isValidTransition(LoadStatus.IN_TRANSIT, LoadStatus.DELIVERED)).toBe(true);
      });

      it('should allow IN_TRANSIT → EXCEPTION', () => {
        expect(isValidTransition(LoadStatus.IN_TRANSIT, LoadStatus.EXCEPTION)).toBe(true);
      });

      it('should NOT allow IN_TRANSIT → CANCELLED directly (business decision)', () => {
        expect(isValidTransition(LoadStatus.IN_TRANSIT, LoadStatus.CANCELLED)).toBe(false);
      });
    });

    describe('terminal states', () => {
      it('CANCELLED should have no valid transitions', () => {
        expect(isValidTransition(LoadStatus.CANCELLED, LoadStatus.POSTED)).toBe(false);
        expect(isValidTransition(LoadStatus.CANCELLED, LoadStatus.DRAFT)).toBe(false);
      });

      it('COMPLETED can only transition to EXCEPTION', () => {
        expect(isValidTransition(LoadStatus.COMPLETED, LoadStatus.EXCEPTION)).toBe(true);
        expect(isValidTransition(LoadStatus.COMPLETED, LoadStatus.CANCELLED)).toBe(false);
      });
    });

    describe('EXCEPTION recovery', () => {
      it('should allow EXCEPTION → SEARCHING', () => {
        expect(isValidTransition(LoadStatus.EXCEPTION, LoadStatus.SEARCHING)).toBe(true);
      });

      it('should allow EXCEPTION → ASSIGNED', () => {
        expect(isValidTransition(LoadStatus.EXCEPTION, LoadStatus.ASSIGNED)).toBe(true);
      });

      it('should allow EXCEPTION → CANCELLED', () => {
        expect(isValidTransition(LoadStatus.EXCEPTION, LoadStatus.CANCELLED)).toBe(true);
      });

      it('should allow EXCEPTION → COMPLETED', () => {
        expect(isValidTransition(LoadStatus.EXCEPTION, LoadStatus.COMPLETED)).toBe(true);
      });
    });

    describe('EXPIRED/UNPOSTED recovery', () => {
      it('should allow EXPIRED → POSTED', () => {
        expect(isValidTransition(LoadStatus.EXPIRED, LoadStatus.POSTED)).toBe(true);
      });

      it('should allow UNPOSTED → POSTED', () => {
        expect(isValidTransition(LoadStatus.UNPOSTED, LoadStatus.POSTED)).toBe(true);
      });
    });
  });

  // ============================================================================
  // canRoleSetStatus - Role-based permissions
  // ============================================================================
  describe('canRoleSetStatus', () => {
    describe('SHIPPER permissions', () => {
      it('SHIPPER can set DRAFT', () => {
        expect(canRoleSetStatus('SHIPPER', LoadStatus.DRAFT)).toBe(true);
      });

      it('SHIPPER can set POSTED', () => {
        expect(canRoleSetStatus('SHIPPER', LoadStatus.POSTED)).toBe(true);
      });

      it('SHIPPER can set CANCELLED', () => {
        expect(canRoleSetStatus('SHIPPER', LoadStatus.CANCELLED)).toBe(true);
      });

      it('SHIPPER can set UNPOSTED', () => {
        expect(canRoleSetStatus('SHIPPER', LoadStatus.UNPOSTED)).toBe(true);
      });

      it('SHIPPER cannot set IN_TRANSIT', () => {
        expect(canRoleSetStatus('SHIPPER', LoadStatus.IN_TRANSIT)).toBe(false);
      });

      it('SHIPPER cannot set DELIVERED', () => {
        expect(canRoleSetStatus('SHIPPER', LoadStatus.DELIVERED)).toBe(false);
      });
    });

    describe('CARRIER permissions', () => {
      it('CARRIER can set ASSIGNED', () => {
        expect(canRoleSetStatus('CARRIER', LoadStatus.ASSIGNED)).toBe(true);
      });

      it('CARRIER can set PICKUP_PENDING', () => {
        expect(canRoleSetStatus('CARRIER', LoadStatus.PICKUP_PENDING)).toBe(true);
      });

      it('CARRIER can set IN_TRANSIT', () => {
        expect(canRoleSetStatus('CARRIER', LoadStatus.IN_TRANSIT)).toBe(true);
      });

      it('CARRIER can set DELIVERED', () => {
        expect(canRoleSetStatus('CARRIER', LoadStatus.DELIVERED)).toBe(true);
      });

      it('CARRIER cannot set POSTED', () => {
        expect(canRoleSetStatus('CARRIER', LoadStatus.POSTED)).toBe(false);
      });

      it('CARRIER cannot set CANCELLED', () => {
        expect(canRoleSetStatus('CARRIER', LoadStatus.CANCELLED)).toBe(false);
      });
    });

    describe('DISPATCHER permissions', () => {
      it('DISPATCHER can set SEARCHING', () => {
        expect(canRoleSetStatus('DISPATCHER', LoadStatus.SEARCHING)).toBe(true);
      });

      it('DISPATCHER can set OFFERED', () => {
        expect(canRoleSetStatus('DISPATCHER', LoadStatus.OFFERED)).toBe(true);
      });

      it('DISPATCHER can set EXCEPTION', () => {
        expect(canRoleSetStatus('DISPATCHER', LoadStatus.EXCEPTION)).toBe(true);
      });

      it('DISPATCHER cannot set DELIVERED', () => {
        expect(canRoleSetStatus('DISPATCHER', LoadStatus.DELIVERED)).toBe(false);
      });
    });

    describe('ADMIN permissions', () => {
      it('ADMIN can set any status', () => {
        Object.values(LoadStatus).forEach((status) => {
          expect(canRoleSetStatus('ADMIN', status)).toBe(true);
        });
      });
    });

    describe('SUPER_ADMIN permissions', () => {
      it('SUPER_ADMIN can set any status', () => {
        Object.values(LoadStatus).forEach((status) => {
          expect(canRoleSetStatus('SUPER_ADMIN', status)).toBe(true);
        });
      });
    });

    describe('unknown role', () => {
      it('unknown role cannot set any status', () => {
        expect(canRoleSetStatus('UNKNOWN', LoadStatus.POSTED)).toBe(false);
        expect(canRoleSetStatus('UNKNOWN', LoadStatus.IN_TRANSIT)).toBe(false);
      });
    });
  });

  // ============================================================================
  // getValidNextStates
  // ============================================================================
  describe('getValidNextStates', () => {
    it('should return valid next states for DRAFT', () => {
      const next = getValidNextStates(LoadStatus.DRAFT);
      expect(next).toContain(LoadStatus.POSTED);
      expect(next).toContain(LoadStatus.CANCELLED);
      expect(next).not.toContain(LoadStatus.IN_TRANSIT);
    });

    it('should return empty array for CANCELLED', () => {
      const next = getValidNextStates(LoadStatus.CANCELLED);
      expect(next).toHaveLength(0);
    });

    it('should return valid recovery states for EXCEPTION', () => {
      const next = getValidNextStates(LoadStatus.EXCEPTION);
      expect(next).toContain(LoadStatus.SEARCHING);
      expect(next).toContain(LoadStatus.ASSIGNED);
      expect(next).toContain(LoadStatus.CANCELLED);
      expect(next).toContain(LoadStatus.COMPLETED);
    });
  });

  // ============================================================================
  // validateStateTransition - Combined validation
  // ============================================================================
  describe('validateStateTransition', () => {
    it('should return valid for allowed transition by role', () => {
      const result = validateStateTransition('DRAFT', 'POSTED', 'SHIPPER');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should return invalid for disallowed transition', () => {
      const result = validateStateTransition('DRAFT', 'IN_TRANSIT', 'SHIPPER');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    it('should return invalid when role cannot set status', () => {
      // Transition is valid, but role cannot set it
      const result = validateStateTransition('ASSIGNED', 'IN_TRANSIT', 'SHIPPER');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('SHIPPER cannot set status');
    });

    it('should return invalid for IN_TRANSIT → CANCELLED', () => {
      const result = validateStateTransition('IN_TRANSIT', 'CANCELLED', 'ADMIN');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid transition');
    });

    it('should allow ADMIN to set any valid transition', () => {
      const result = validateStateTransition('EXCEPTION', 'CANCELLED', 'ADMIN');
      expect(result.valid).toBe(true);
    });
  });

  // ============================================================================
  // getStatusDescription
  // ============================================================================
  describe('getStatusDescription', () => {
    it('should return description for DRAFT', () => {
      expect(getStatusDescription(LoadStatus.DRAFT)).toContain('not yet posted');
    });

    it('should return description for IN_TRANSIT', () => {
      expect(getStatusDescription(LoadStatus.IN_TRANSIT)).toContain('in transit');
    });

    it('should return description for COMPLETED', () => {
      expect(getStatusDescription(LoadStatus.COMPLETED)).toContain('POD');
    });

    it('should return unknown for invalid status', () => {
      expect(getStatusDescription('INVALID' as LoadStatus)).toBe('Unknown status');
    });
  });

  // ============================================================================
  // Workflow scenarios
  // ============================================================================
  describe('complete workflow scenarios', () => {
    it('should support happy path: DRAFT → POSTED → ASSIGNED → IN_TRANSIT → DELIVERED → COMPLETED', () => {
      expect(isValidTransition(LoadStatus.DRAFT, LoadStatus.POSTED)).toBe(true);
      expect(isValidTransition(LoadStatus.POSTED, LoadStatus.ASSIGNED)).toBe(true);
      expect(isValidTransition(LoadStatus.ASSIGNED, LoadStatus.IN_TRANSIT)).toBe(true);
      expect(isValidTransition(LoadStatus.IN_TRANSIT, LoadStatus.DELIVERED)).toBe(true);
      expect(isValidTransition(LoadStatus.DELIVERED, LoadStatus.COMPLETED)).toBe(true);
    });

    it('should support exception recovery: IN_TRANSIT → EXCEPTION → COMPLETED', () => {
      expect(isValidTransition(LoadStatus.IN_TRANSIT, LoadStatus.EXCEPTION)).toBe(true);
      expect(isValidTransition(LoadStatus.EXCEPTION, LoadStatus.COMPLETED)).toBe(true);
    });

    it('should support cancellation via exception: IN_TRANSIT → EXCEPTION → CANCELLED', () => {
      // Cannot cancel directly from IN_TRANSIT
      expect(isValidTransition(LoadStatus.IN_TRANSIT, LoadStatus.CANCELLED)).toBe(false);
      // Must go through EXCEPTION
      expect(isValidTransition(LoadStatus.IN_TRANSIT, LoadStatus.EXCEPTION)).toBe(true);
      expect(isValidTransition(LoadStatus.EXCEPTION, LoadStatus.CANCELLED)).toBe(true);
    });

    it('should support reposting expired loads', () => {
      expect(isValidTransition(LoadStatus.EXPIRED, LoadStatus.POSTED)).toBe(true);
    });
  });
});
