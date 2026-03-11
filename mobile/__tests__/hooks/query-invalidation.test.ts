/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for cross-domain query invalidation (G-M7)
 * Verifies that each mutation hook invalidates all affected query domains.
 */

let capturedMutationOptions: any = null;
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: undefined, isLoading: true, error: null }),
  useMutation: (options: any) => {
    capturedMutationOptions = options;
    return { mutate: jest.fn(), isLoading: false };
  },
  useQueryClient: () => ({
    invalidateQueries: mockInvalidateQueries,
  }),
}));

jest.mock("../../src/services/trip", () => ({
  tripService: {
    getTrips: jest.fn(),
    getTrip: jest.fn(),
    updateTripStatus: jest.fn(),
    cancelTrip: jest.fn(),
    uploadPod: jest.fn(),
    getTripPods: jest.fn(),
    confirmDelivery: jest.fn(),
  },
}));

jest.mock("../../src/services/truck", () => ({
  truckService: {
    getTrucks: jest.fn(),
    getTruck: jest.fn(),
    createTruck: jest.fn(),
    updateTruck: jest.fn(),
    deleteTruck: jest.fn(),
    getTruckPostings: jest.fn(),
    getTruckPosting: jest.fn(),
    createTruckPosting: jest.fn(),
    createTruckRequest: jest.fn(),
    getMyTruckRequests: jest.fn(),
    getTruckRequest: jest.fn(),
    cancelTruckRequest: jest.fn(),
    getReceivedTruckRequests: jest.fn(),
    respondToTruckRequest: jest.fn(),
    getMyTruckPostings: jest.fn(),
    updateTruckPosting: jest.fn(),
    cancelTruckPosting: jest.fn(),
    getMatchingLoadsForPosting: jest.fn(),
    duplicateTruckPosting: jest.fn(),
  },
}));

jest.mock("../../src/services/load", () => ({
  loadService: {
    getLoads: jest.fn(),
    getLoad: jest.fn(),
    createLoad: jest.fn(),
    updateLoad: jest.fn(),
    deleteLoad: jest.fn(),
    createLoadRequest: jest.fn(),
    getLoadRequests: jest.fn(),
    respondToLoadRequest: jest.fn(),
    getReceivedLoadRequests: jest.fn(),
    cancelLoadRequest: jest.fn(),
    getMyLoadRequests: jest.fn(),
  },
}));

jest.mock("../../src/services/match", () => ({
  matchService: {
    getMatchingTrucks: jest.fn(),
    assignTruck: jest.fn(),
    getMatchProposals: jest.fn(),
    respondToProposal: jest.fn(),
  },
}));

jest.mock("../../src/services/dispute", () => ({
  disputeService: {
    getDisputes: jest.fn(),
    getDispute: jest.fn(),
    createDispute: jest.fn(),
  },
}));

import {
  useUpdateTripStatus,
  useCancelTrip,
  useUploadPod,
  useConfirmDelivery,
} from "../../src/hooks/useTrips";
import {
  useDeleteTruck,
  useRespondToTruckRequest,
  useCreateTruckRequest,
  useCancelTruckPosting,
  useCancelTruckRequest,
} from "../../src/hooks/useTrucks";
import {
  useRespondToLoadRequest,
  useCreateLoadRequest,
  useCancelLoadRequest,
} from "../../src/hooks/useLoads";
import {
  useAssignTruck,
  useRespondToProposal,
} from "../../src/hooks/useMatches";
import { useCreateDispute } from "../../src/hooks/useDisputes";

/** Helper: call hook, trigger onSuccess, return invalidated query keys */
function getInvalidatedKeys(hookFn: () => any): string[][] {
  mockInvalidateQueries.mockClear();
  capturedMutationOptions = null;
  hookFn();
  expect(capturedMutationOptions).toBeTruthy();
  capturedMutationOptions.onSuccess();
  return mockInvalidateQueries.mock.calls.map(
    (call: any[]) => call[0].queryKey as string[]
  );
}

function expectKeys(keys: string[][], expected: string[]) {
  const flat = keys.map((k) => k[0]);
  for (const e of expected) {
    expect(flat).toContain(e);
  }
}

describe("Cross-Domain Query Invalidation (G-M7)", () => {
  // --- Trip hooks ---

  it("QI-1: useUpdateTripStatus invalidates trips+loads+truck-postings+wallet+dashboards", () => {
    const keys = getInvalidatedKeys(useUpdateTripStatus);
    expectKeys(keys, [
      "trips",
      "loads",
      "truck-postings",
      "wallet",
      "carrier-dashboard",
      "shipper-dashboard",
    ]);
  });

  it("QI-2: useCancelTrip invalidates trips+loads+truck-postings+wallet+dashboards", () => {
    const keys = getInvalidatedKeys(useCancelTrip);
    expectKeys(keys, [
      "trips",
      "loads",
      "truck-postings",
      "wallet",
      "carrier-dashboard",
      "shipper-dashboard",
    ]);
  });

  it("QI-3: useUploadPod invalidates trips+loads+wallet+carrier-dashboard", () => {
    const keys = getInvalidatedKeys(useUploadPod);
    expectKeys(keys, ["trips", "loads", "wallet", "carrier-dashboard"]);
    // Should NOT invalidate shipper-dashboard (POD upload is carrier-only)
    const flat = keys.map((k) => k[0]);
    expect(flat).not.toContain("shipper-dashboard");
  });

  it("QI-4: useConfirmDelivery invalidates trips+loads+wallet+both dashboards", () => {
    const keys = getInvalidatedKeys(useConfirmDelivery);
    expectKeys(keys, [
      "trips",
      "loads",
      "wallet",
      "carrier-dashboard",
      "shipper-dashboard",
    ]);
  });

  // --- Truck hooks ---

  it("QI-5: useDeleteTruck invalidates trucks+truck-postings+trips", () => {
    const keys = getInvalidatedKeys(useDeleteTruck);
    expectKeys(keys, ["trucks", "truck-postings", "trips"]);
  });

  it("QI-6: useRespondToTruckRequest invalidates requests+postings+trips+loads+dashboards", () => {
    const keys = getInvalidatedKeys(useRespondToTruckRequest);
    expectKeys(keys, [
      "truck-requests",
      "truck-postings",
      "trips",
      "loads",
      "carrier-dashboard",
      "shipper-dashboard",
    ]);
  });

  it("QI-7: useCreateTruckRequest invalidates truck-requests+truck-postings", () => {
    const keys = getInvalidatedKeys(useCreateTruckRequest);
    expectKeys(keys, ["truck-requests", "truck-postings"]);
  });

  it("QI-8: useCancelTruckPosting invalidates postings+requests+trips", () => {
    const keys = getInvalidatedKeys(useCancelTruckPosting);
    expectKeys(keys, ["truck-postings", "truck-requests", "trips"]);
  });

  it("QI-9: useCancelTruckRequest invalidates requests+postings", () => {
    const keys = getInvalidatedKeys(useCancelTruckRequest);
    expectKeys(keys, ["truck-requests", "truck-postings"]);
  });

  // --- Load hooks ---

  it("QI-10: useRespondToLoadRequest invalidates requests+loads+trucks+trips+postings+dashboards", () => {
    const keys = getInvalidatedKeys(useRespondToLoadRequest);
    expectKeys(keys, [
      "load-requests",
      "loads",
      "truck-requests",
      "trips",
      "truck-postings",
      "carrier-dashboard",
      "shipper-dashboard",
    ]);
  });

  it("QI-11: useCreateLoadRequest invalidates load-requests+loads", () => {
    const keys = getInvalidatedKeys(useCreateLoadRequest);
    expectKeys(keys, ["load-requests", "loads"]);
  });

  it("QI-12: useCancelLoadRequest invalidates load-requests+loads", () => {
    const keys = getInvalidatedKeys(useCancelLoadRequest);
    expectKeys(keys, ["load-requests", "loads"]);
  });

  // --- Match hooks ---

  it("QI-13: useAssignTruck invalidates matches+loads+trips+postings+wallet+dashboards", () => {
    const keys = getInvalidatedKeys(useAssignTruck);
    expectKeys(keys, [
      "matching-trucks",
      "loads",
      "trips",
      "truck-postings",
      "wallet",
      "carrier-dashboard",
      "shipper-dashboard",
    ]);
  });

  it("QI-14: useRespondToProposal invalidates proposals+loads+trips+postings+dashboards", () => {
    const keys = getInvalidatedKeys(useRespondToProposal);
    expectKeys(keys, [
      "match-proposals",
      "loads",
      "trips",
      "truck-postings",
      "carrier-dashboard",
      "shipper-dashboard",
    ]);
  });

  // --- Dispute hooks ---

  it("QI-15: useCreateDispute invalidates disputes+loads+trips", () => {
    const keys = getInvalidatedKeys(useCreateDispute);
    expectKeys(keys, ["disputes", "loads", "trips"]);
  });
});
