/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for trip hooks — all 7 hooks
 */
import { tripService } from "../../src/services/trip";

let capturedOptions: any = null;
let capturedMutationOptions: any = null;
const mockInvalidateQueries = jest.fn();

jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    capturedOptions = options;
    return { data: undefined, isLoading: true, error: null };
  },
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

import {
  useTrips,
  useTrip,
  useUpdateTripStatus,
  useCancelTrip,
  useUploadPod,
  useTripPods,
  useConfirmDelivery,
} from "../../src/hooks/useTrips";

describe("Trip Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    capturedMutationOptions = null;
    mockInvalidateQueries.mockClear();
    jest.clearAllMocks();
  });

  // ---- useTrips ----

  describe("useTrips", () => {
    it('should use queryKey ["trips", params]', () => {
      const params = { status: "IN_TRANSIT", limit: 10 };
      useTrips(params);
      expect(capturedOptions.queryKey).toEqual(["trips", params]);
    });

    it("should call tripService.getTrips as queryFn", () => {
      const params = { page: 2 };
      useTrips(params);
      capturedOptions.queryFn();
      expect(tripService.getTrips).toHaveBeenCalledWith(params);
    });
  });

  // ---- useTrip ----

  describe("useTrip", () => {
    it('should use queryKey ["trips", id]', () => {
      useTrip("trip-1");
      expect(capturedOptions.queryKey).toEqual(["trips", "trip-1"]);
    });

    it("should set enabled: true when id is truthy", () => {
      useTrip("trip-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when id is undefined", () => {
      useTrip(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call tripService.getTrip as queryFn", () => {
      useTrip("trip-1");
      capturedOptions.queryFn();
      expect(tripService.getTrip).toHaveBeenCalledWith("trip-1");
    });
  });

  // ---- useUpdateTripStatus ----

  describe("useUpdateTripStatus", () => {
    it("should pass (id, status, extra) to tripService.updateTripStatus", () => {
      useUpdateTripStatus();
      capturedMutationOptions.mutationFn({
        id: "trip-1",
        status: "IN_TRANSIT",
        extra: { deliveryNotes: "Gate 5" },
      });
      expect(tripService.updateTripStatus).toHaveBeenCalledWith(
        "trip-1",
        "IN_TRANSIT",
        { deliveryNotes: "Gate 5" }
      );
    });

    it("should work without extra param", () => {
      useUpdateTripStatus();
      capturedMutationOptions.mutationFn({
        id: "trip-1",
        status: "PICKUP_PENDING",
      });
      expect(tripService.updateTripStatus).toHaveBeenCalledWith(
        "trip-1",
        "PICKUP_PENDING",
        undefined
      );
    });

    it('should invalidate ["trips"] on success', () => {
      useUpdateTripStatus();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trips"],
      });
    });
  });

  // ---- useCancelTrip ----

  describe("useCancelTrip", () => {
    it("should pass (id, reason) to tripService.cancelTrip", () => {
      useCancelTrip();
      capturedMutationOptions.mutationFn({
        id: "trip-1",
        reason: "Changed plans",
      });
      expect(tripService.cancelTrip).toHaveBeenCalledWith(
        "trip-1",
        "Changed plans"
      );
    });

    it('should invalidate ["trips"] on success', () => {
      useCancelTrip();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trips"],
      });
    });
  });

  // ---- useUploadPod ----

  describe("useUploadPod", () => {
    it("should pass (tripId, formData) to tripService.uploadPod", () => {
      useUploadPod();
      const formData = new FormData();
      capturedMutationOptions.mutationFn({
        tripId: "trip-1",
        formData,
      });
      expect(tripService.uploadPod).toHaveBeenCalledWith("trip-1", formData);
    });

    it('should invalidate ["trips"] on success', () => {
      useUploadPod();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trips"],
      });
    });
  });

  // ---- useTripPods ----

  describe("useTripPods", () => {
    it('should use queryKey ["trips", tripId, "pods"]', () => {
      useTripPods("trip-1");
      expect(capturedOptions.queryKey).toEqual(["trips", "trip-1", "pods"]);
    });

    it("should set enabled: true when tripId is truthy", () => {
      useTripPods("trip-1");
      expect(capturedOptions.enabled).toBe(true);
    });

    it("should set enabled: false when tripId is undefined", () => {
      useTripPods(undefined);
      expect(capturedOptions.enabled).toBe(false);
    });

    it("should call tripService.getTripPods as queryFn", () => {
      useTripPods("trip-1");
      capturedOptions.queryFn();
      expect(tripService.getTripPods).toHaveBeenCalledWith("trip-1");
    });
  });

  // ---- useConfirmDelivery ----

  describe("useConfirmDelivery", () => {
    it("should pass (tripId, notes) to tripService.confirmDelivery", () => {
      useConfirmDelivery();
      capturedMutationOptions.mutationFn({
        tripId: "trip-1",
        notes: "Goods received in good condition",
      });
      expect(tripService.confirmDelivery).toHaveBeenCalledWith(
        "trip-1",
        "Goods received in good condition"
      );
    });

    it("should work without notes", () => {
      useConfirmDelivery();
      capturedMutationOptions.mutationFn({ tripId: "trip-1" });
      expect(tripService.confirmDelivery).toHaveBeenCalledWith(
        "trip-1",
        undefined
      );
    });

    it('should invalidate ["trips"] on success', () => {
      useConfirmDelivery();
      capturedMutationOptions.onSuccess();
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["trips"],
      });
    });
  });
});
