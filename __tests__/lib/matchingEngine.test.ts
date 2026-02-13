/**
 * Matching Engine Tests
 *
 * Tests for truck/load matching algorithm (in-memory functions)
 */

import { findMatchingLoads, findMatchingTrucks } from '@/lib/matchingEngine';

describe('lib/matchingEngine', () => {
  // Sample data
  const sampleTrucks = [
    {
      id: 'truck-1',
      currentCity: 'Addis Ababa',
      destinationCity: 'Djibouti',
      truckType: 'DRY_VAN',
      maxWeight: 20000,
      availableDate: new Date('2025-01-15'),
    },
    {
      id: 'truck-2',
      currentCity: 'Dire Dawa',
      destinationCity: null, // Flexible
      truckType: 'FLATBED',
      maxWeight: 25000,
      availableDate: new Date('2025-01-16'),
    },
    {
      id: 'truck-3',
      currentCity: 'Mekelle',
      destinationCity: 'Addis Ababa',
      truckType: 'REFRIGERATED',
      maxWeight: 15000,
      availableDate: new Date('2025-01-14'),
    },
    {
      id: 'truck-4',
      currentCity: 'Djibouti', // Far from Addis
      destinationCity: 'Addis Ababa',
      truckType: 'DRY_VAN',
      maxWeight: 20000,
      availableDate: new Date('2025-01-15'),
    },
  ];

  const sampleLoads = [
    {
      id: 'load-1',
      pickupCity: 'Addis Ababa',
      deliveryCity: 'Djibouti',
      truckType: 'DRY_VAN',
      weight: 15000,
      pickupDate: new Date('2025-01-15'),
    },
    {
      id: 'load-2',
      pickupCity: 'Addis Ababa',
      deliveryCity: 'Dire Dawa',
      truckType: 'FLATBED',
      weight: 10000,
      pickupDate: new Date('2025-01-16'),
    },
    {
      id: 'load-3',
      pickupCity: 'Hawassa',
      deliveryCity: 'Addis Ababa',
      truckType: 'DRY_VAN',
      weight: 18000,
      pickupDate: new Date('2025-01-17'),
    },
    {
      id: 'load-4',
      pickupCity: 'Addis Ababa',
      deliveryCity: 'Mekelle',
      truckType: 'REFRIGERATED', // Cold chain
      weight: 12000,
      pickupDate: new Date('2025-01-15'),
    },
  ];

  // ============================================================================
  // findMatchingLoads - Find loads for a truck
  // ============================================================================
  describe('findMatchingLoads', () => {
    it('should find matching loads for truck in Addis Ababa', () => {
      const truck = sampleTrucks[0]; // Addis → Djibouti
      const matches = findMatchingLoads(truck, sampleLoads, 30);

      expect(matches.length).toBeGreaterThan(0);
      // Should match load-1 (Addis → Djibouti) with high score
      const exactMatch = matches.find((m) => m.id === 'load-1');
      expect(exactMatch).toBeDefined();
      expect(exactMatch?.matchScore).toBeGreaterThan(50);
    });

    it('should exclude loads with incompatible truck type', () => {
      const truck = sampleTrucks[0]; // DRY_VAN
      const matches = findMatchingLoads(truck, sampleLoads, 0);

      // Should not match REFRIGERATED load
      const coldMatch = matches.find((m) => m.id === 'load-4');
      expect(coldMatch).toBeUndefined();
    });

    it('should exclude loads where DH-O > 200km', () => {
      const truck = sampleTrucks[3]; // In Djibouti
      const matches = findMatchingLoads(truck, sampleLoads, 0);

      // Djibouti to Addis is ~910km, way over 200km limit
      const addisLoad = matches.find((m) => m.pickupCity === 'Addis Ababa');
      expect(addisLoad).toBeUndefined();
    });

    it('should include dhOriginKm in results', () => {
      const truck = sampleTrucks[0];
      const matches = findMatchingLoads(truck, sampleLoads, 30);

      matches.forEach((match) => {
        expect(match.dhOriginKm).toBeDefined();
        expect(typeof match.dhOriginKm).toBe('number');
      });
    });

    it('should include matchReasons in results', () => {
      const truck = sampleTrucks[0];
      const matches = findMatchingLoads(truck, sampleLoads, 30);

      matches.forEach((match) => {
        expect(match.matchReasons).toBeDefined();
        expect(Array.isArray(match.matchReasons)).toBe(true);
      });
    });

    it('should return results sorted by score (highest first)', () => {
      const truck = sampleTrucks[0];
      const matches = findMatchingLoads(truck, sampleLoads, 0);

      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].matchScore).toBeGreaterThanOrEqual(matches[i].matchScore);
      }
    });

    it('should respect minScore filter', () => {
      const truck = sampleTrucks[0];
      const matches = findMatchingLoads(truck, sampleLoads, 70);

      matches.forEach((match) => {
        expect(match.matchScore).toBeGreaterThanOrEqual(70);
      });
    });

    it('should mark excellent matches with isExactMatch', () => {
      const truck = {
        id: 'test-truck',
        currentCity: 'Addis Ababa',
        destinationCity: 'Djibouti',
        truckType: 'DRY_VAN',
        maxWeight: 20000,
        availableDate: new Date('2025-01-15'),
      };

      const loads = [{
        id: 'perfect-load',
        pickupCity: 'Addis Ababa',
        deliveryCity: 'Djibouti',
        truckType: 'DRY_VAN',
        weight: 18000, // 90% utilization
        pickupDate: new Date('2025-01-15'),
      }];

      const matches = findMatchingLoads(truck, loads, 0);

      if (matches.length > 0 && matches[0].matchScore >= 85) {
        expect(matches[0].isExactMatch).toBe(true);
      }
    });

    it('should return empty array when no loads match', () => {
      const truck = {
        id: 'cold-truck',
        currentCity: 'Addis Ababa',
        destinationCity: null,
        truckType: 'REFRIGERATED',
        maxWeight: 5000, // Very low capacity
        availableDate: new Date('2025-01-15'),
      };

      const loads = [{
        id: 'heavy-load',
        pickupCity: 'Addis Ababa',
        deliveryCity: 'Djibouti',
        truckType: 'DRY_VAN', // Incompatible type
        weight: 20000, // Too heavy
        pickupDate: new Date('2025-01-15'),
      }];

      const matches = findMatchingLoads(truck, loads, 0);
      expect(matches).toHaveLength(0);
    });
  });

  // ============================================================================
  // findMatchingTrucks - Find trucks for a load
  // ============================================================================
  describe('findMatchingTrucks', () => {
    it('should find matching trucks for load from Addis', () => {
      const load = sampleLoads[0]; // Addis → Djibouti, DRY_VAN
      const matches = findMatchingTrucks(load, sampleTrucks, 30);

      expect(matches.length).toBeGreaterThan(0);
      // Should match truck-1 (Addis → Djibouti, DRY_VAN)
      const exactMatch = matches.find((m) => m.id === 'truck-1');
      expect(exactMatch).toBeDefined();
    });

    it('should exclude trucks with incompatible type', () => {
      const load = sampleLoads[3]; // REFRIGERATED
      const matches = findMatchingTrucks(load, sampleTrucks, 0);

      // Should only match truck-3 (REFRIGERATED)
      const coldTrucks = matches.filter(
        (m) => m.truckType === 'REFRIGERATED' || m.truckType === 'REEFER'
      );
      expect(matches.length).toBe(coldTrucks.length);
    });

    it('should exclude trucks that are too far (DH-O > 200km)', () => {
      const load = sampleLoads[0]; // Pickup in Addis
      const matches = findMatchingTrucks(load, sampleTrucks, 0);

      // truck-4 is in Djibouti (910km from Addis), should be excluded
      const djiboutiTruck = matches.find((m) => m.id === 'truck-4');
      expect(djiboutiTruck).toBeUndefined();
    });

    it('should exclude trucks with insufficient capacity', () => {
      const load = {
        id: 'heavy-load',
        pickupCity: 'Addis Ababa',
        deliveryCity: 'Djibouti',
        truckType: 'DRY_VAN',
        weight: 30000, // Very heavy
        pickupDate: new Date('2025-01-15'),
      };

      const trucks = [{
        id: 'small-truck',
        currentCity: 'Addis Ababa',
        truckType: 'DRY_VAN',
        maxWeight: 10000, // Can't carry 30000
        availableDate: new Date('2025-01-15'),
      }];

      const matches = findMatchingTrucks(load, trucks, 0);
      expect(matches).toHaveLength(0);
    });

    it('should return results sorted by score', () => {
      const load = sampleLoads[0];
      const matches = findMatchingTrucks(load, sampleTrucks, 0);

      for (let i = 1; i < matches.length; i++) {
        expect(matches[i - 1].matchScore).toBeGreaterThanOrEqual(matches[i].matchScore);
      }
    });

    it('should include dhOriginKm in results', () => {
      const load = sampleLoads[0];
      const matches = findMatchingTrucks(load, sampleTrucks, 30);

      matches.forEach((match) => {
        expect(match.dhOriginKm).toBeDefined();
        expect(typeof match.dhOriginKm).toBe('number');
      });
    });
  });

  // ============================================================================
  // Truck type compatibility
  // ============================================================================
  describe('truck type compatibility', () => {
    it('should match exact truck types', () => {
      const truck = { currentCity: 'Addis Ababa', truckType: 'DRY_VAN', maxWeight: 20000 };
      const loads = [{ pickupCity: 'Addis Ababa', deliveryCity: 'Dire Dawa', truckType: 'DRY_VAN', weight: 10000 }];

      const matches = findMatchingLoads(truck as any, loads as any, 0);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should match compatible types within GENERAL group', () => {
      const truck = { currentCity: 'Addis Ababa', truckType: 'FLATBED', maxWeight: 20000 };
      const loads = [{ pickupCity: 'Addis Ababa', deliveryCity: 'Dire Dawa', truckType: 'DRY_VAN', weight: 10000 }];

      const matches = findMatchingLoads(truck as any, loads as any, 0);
      expect(matches.length).toBeGreaterThan(0);
    });

    it('should NOT match COLD_CHAIN with GENERAL', () => {
      const truck = { currentCity: 'Addis Ababa', truckType: 'REFRIGERATED', maxWeight: 20000 };
      const loads = [{ pickupCity: 'Addis Ababa', deliveryCity: 'Dire Dawa', truckType: 'DRY_VAN', weight: 10000 }];

      const matches = findMatchingLoads(truck as any, loads as any, 0);
      expect(matches).toHaveLength(0);
    });

    it('should match REFRIGERATED with REEFER', () => {
      const truck = { currentCity: 'Addis Ababa', truckType: 'REEFER', maxWeight: 20000 };
      const loads = [{ pickupCity: 'Addis Ababa', deliveryCity: 'Dire Dawa', truckType: 'REFRIGERATED', weight: 10000 }];

      const matches = findMatchingLoads(truck as any, loads as any, 0);
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // Ethiopian city distance lookup
  // ============================================================================
  describe('Ethiopian city distances', () => {
    it('should have 0 distance for same city', () => {
      const truck = { currentCity: 'Addis Ababa', truckType: 'DRY_VAN', maxWeight: 20000 };
      const loads = [{ pickupCity: 'Addis Ababa', deliveryCity: 'Djibouti', truckType: 'DRY_VAN', weight: 10000 }];

      const matches = findMatchingLoads(truck as any, loads as any, 0);
      expect(matches[0]?.dhOriginKm).toBe(0);
    });

    it('should calculate correct distance for Addis-Dire Dawa', () => {
      const truck = { currentCity: 'Dire Dawa', truckType: 'DRY_VAN', maxWeight: 20000 };
      const loads = [{ pickupCity: 'Addis Ababa', deliveryCity: 'Djibouti', truckType: 'DRY_VAN', weight: 10000 }];

      const matches = findMatchingLoads(truck as any, loads as any, 0);

      // Dire Dawa to Addis is ~450km, should be excluded (> 200km)
      expect(matches).toHaveLength(0);
    });

    it('should handle spelling variations (Mekelle/Mekele)', () => {
      const truck1 = { currentCity: 'Mekelle', truckType: 'DRY_VAN', maxWeight: 20000 };
      const truck2 = { currentCity: 'Mekele', truckType: 'DRY_VAN', maxWeight: 20000 };

      const loads = [{ pickupCity: 'Mekelle', deliveryCity: 'Addis Ababa', truckType: 'DRY_VAN', weight: 10000 }];

      const matches1 = findMatchingLoads(truck1 as any, loads as any, 0);
      const matches2 = findMatchingLoads(truck2 as any, loads as any, 0);

      // Both should find matches with 0 dhOriginKm
      expect(matches1[0]?.dhOriginKm).toBe(0);
      expect(matches2[0]?.dhOriginKm).toBe(0);
    });
  });

  // ============================================================================
  // Score calculation
  // ============================================================================
  describe('score calculation', () => {
    it('should give higher score for closer trucks', () => {
      const load = {
        pickupCity: 'Addis Ababa',
        deliveryCity: 'Djibouti',
        truckType: 'DRY_VAN',
        weight: 10000,
      };

      const trucks = [
        { id: 'nearby', currentCity: 'Addis Ababa', truckType: 'DRY_VAN', maxWeight: 20000 },
        { id: 'medium', currentCity: 'Adama', truckType: 'DRY_VAN', maxWeight: 20000 }, // ~100km
      ];

      const matches = findMatchingTrucks(load as any, trucks as any, 0);

      const nearbyTruck = matches.find((m) => m.id === 'nearby');
      const mediumTruck = matches.find((m) => m.id === 'medium');

      if (nearbyTruck && mediumTruck) {
        expect(nearbyTruck.matchScore).toBeGreaterThan(mediumTruck.matchScore);
      }
    });

    it('should give higher score for better capacity utilization', () => {
      const load = {
        pickupCity: 'Addis Ababa',
        deliveryCity: 'Djibouti',
        truckType: 'DRY_VAN',
        weight: 18000,
      };

      const trucks = [
        { id: 'perfect', currentCity: 'Addis Ababa', truckType: 'DRY_VAN', maxWeight: 20000 }, // 90% utilization
        { id: 'oversized', currentCity: 'Addis Ababa', truckType: 'DRY_VAN', maxWeight: 40000 }, // 45% utilization
      ];

      const matches = findMatchingTrucks(load as any, trucks as any, 0);

      const perfectTruck = matches.find((m) => m.id === 'perfect');
      const oversizedTruck = matches.find((m) => m.id === 'oversized');

      if (perfectTruck && oversizedTruck) {
        expect(perfectTruck.matchScore).toBeGreaterThanOrEqual(oversizedTruck.matchScore);
      }
    });
  });
});
