"use client";

/**
 * POST LOADS Tab Component
 *
 * Main shipper interface for posting loads and viewing matching trucks
 * Sprint 19 - Redesigned to match Carrier PostTrucksTab pattern
 *
 * Features:
 * - Status tabs (POSTED/UNPOSTED/EXPIRED) with counts
 * - Inline posting form
 * - Expand to see matching trucks with scores
 * - Request truck directly
 * - Edit/Duplicate inline
 */

import React, { useState, useEffect, useCallback } from "react";
import { StatusTabs } from "@/components/loadboard-ui";
import { StatusTab } from "@/types/loadboard-ui";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import toast from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";
import type { Load, TruckMatch } from "@/lib/types/shipper";

// Session user shape (from auth)
interface SessionUser {
  userId: string;
  email?: string;
  role: string;
  status?: string;
  organizationId?: string;
}

// L3 FIX: Add proper TypeScript interfaces
interface EditFormData {
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: string;
  lengthM: string;
  rate: string;
  cargoDescription: string;
  contactPhone: string;
}

interface TruckSearchFilters {
  origin?: string;
  destination?: string;
  [key: string]: string | number | boolean | undefined; // Allow dynamic keys
}

interface PostLoadsTabProps {
  user: SessionUser;
  onSwitchToSearchTrucks?: (filters: TruckSearchFilters) => void;
}

type LoadStatus = "POSTED" | "UNPOSTED" | "EXPIRED";
type MainTab = "postings" | "matching";

const truckTypes = [
  { value: "REFRIGERATED", label: "Reefer" },
  { value: "DRY_VAN", label: "Van" },
  { value: "FLATBED", label: "Flatbed" },
  { value: "CONTAINER", label: "Container" },
  { value: "TANKER", label: "Tanker" },
  { value: "BOX_TRUCK", label: "Box Truck" },
  { value: "LOWBOY", label: "Lowboy" },
  { value: "DUMP_TRUCK", label: "Dump Truck" },
];

const getTruckTypeLabel = (enumValue: string | null | undefined): string => {
  if (!enumValue) return "N/A";
  const found = truckTypes.find((t) => t.value === enumValue);
  return found ? found.label : enumValue.replace("_", " ");
};

export default function PostLoadsTab({
  onSwitchToSearchTrucks,
}: PostLoadsTabProps) {
  // L4-L8: Using interface types where safe, Record for flexible objects
  const [loads, setLoads] = useState<Array<Load & { matchCount?: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<LoadStatus>("POSTED");
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("postings");
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);
  const [matchingTrucks, setMatchingTrucks] = useState<TruckMatch[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [editingLoadId, setEditingLoadId] = useState<string | null>(null);
  // L4 FIX: Properly typed edit form state
  const [editForm, setEditForm] = useState<EditFormData>({
    pickupCity: "",
    deliveryCity: "",
    pickupDate: "",
    deliveryDate: "",
    truckType: "",
    weight: "",
    lengthM: "",
    rate: "",
    cargoDescription: "",
    contactPhone: "",
  });
  const [showNewLoadForm, setShowNewLoadForm] = useState(false);

  // Ethiopian cities
  const [ethiopianCities, setEthiopianCities] = useState<
    Array<{ name: string; id?: string }>
  >([]);

  // New load posting form state
  const [newLoadForm, setNewLoadForm] = useState({
    pickupCity: "",
    deliveryCity: "",
    pickupDate: "",
    deliveryDate: "",
    truckType: "DRY_VAN",
    weight: "",
    lengthM: "",
    cargoDescription: "",
    specialRequirements: "",
    rate: "",
    contactPhone: "",
    pickupCoordinates: undefined as { lat: number; lng: number } | undefined,
    deliveryCoordinates: undefined as { lat: number; lng: number } | undefined,
  });

  // Truck request modal state
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  // L9: Using TruckMatch type for truck selection
  const [selectedTruckForRequest, setSelectedTruckForRequest] =
    useState<TruckMatch | null>(null);
  const [selectedLoadForRequest, setSelectedLoadForRequest] =
    useState<string>("");
  const [requestNotes, setRequestNotes] = useState("");
  const [requestProposedRate, setRequestProposedRate] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Track which trucks have already been requested
  const [requestedTruckIds, setRequestedTruckIds] = useState<Set<string>>(
    new Set()
  );

  /**
   * Fetch Ethiopian cities
   */
  const fetchEthiopianCities = async () => {
    try {
      const response = await fetch("/api/ethiopian-locations");
      // H27 FIX: Check response.ok before parsing
      if (!response.ok) {
        console.error("Failed to fetch Ethiopian cities:", response.status);
        return;
      }
      const data = await response.json();
      setEthiopianCities(data.locations || []);
    } catch (error) {
      console.error("Failed to fetch Ethiopian cities:", error);
    }
  };

  /**
   * Fetch existing truck requests
   */
  const fetchExistingRequests = async () => {
    try {
      const response = await fetch("/api/truck-requests?status=PENDING");
      if (response.ok) {
        const data = await response.json();
        // L10 FIX: Type the truck request mapping
        const requestedIds = new Set<string>(
          (data.truckRequests || []).map(
            (req: { truckId: string }) => req.truckId
          )
        );
        setRequestedTruckIds(requestedIds);
      }
    } catch (error) {
      console.error("Failed to fetch existing truck requests:", error);
    }
  };

  useEffect(() => {
    fetchEthiopianCities();
    fetchExistingRequests();
  }, []);

  /**
   * Fetch loads
   */
  const fetchLoads = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      params.append("myLoads", "true");
      params.append("status", activeStatus);
      params.append("sortBy", "postedAt");
      params.append("sortOrder", "desc");

      const response = await fetch(`/api/loads?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch loads");
      const data = await response.json();
      const loadsData: Load[] = data.loads || [];

      // Fetch match counts for POSTED loads in parallel
      // H29 FIX: Check response.ok for match counts
      // L16 FIX: Properly typed load in map
      const loadsWithMatchCounts = await Promise.all(
        loadsData.map(async (load: Load) => {
          if (load.status === "POSTED") {
            try {
              const matchResponse = await fetch(
                `/api/loads/${load.id}/matching-trucks?limit=1`
              );
              if (!matchResponse.ok) return { ...load, matchCount: 0 };
              const matchData = await matchResponse.json();
              return { ...load, matchCount: matchData.total || 0 };
            } catch {
              return { ...load, matchCount: 0 };
            }
          }
          return { ...load, matchCount: 0 };
        })
      );

      setLoads(loadsWithMatchCounts);

      // Fetch counts for each status tab
      // H30 FIX: Check response.ok for status counts
      const counts: Record<string, number> = {
        POSTED: 0,
        UNPOSTED: 0,
        EXPIRED: 0,
      };
      const statusPromises = ["POSTED", "UNPOSTED", "EXPIRED"].map(
        async (status) => {
          try {
            const res = await fetch(
              `/api/loads?myLoads=true&status=${status}&limit=1`
            );
            if (!res.ok) return;
            const json = await res.json();
            counts[status] = json.pagination?.total || 0;
          } catch {
            // Silently ignore count fetch errors
          }
        }
      );
      await Promise.all(statusPromises);
      setStatusCounts(counts);
    } catch (error) {
      console.error("Failed to fetch loads:", error);
      setFetchError("Failed to load your loads. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeStatus]);

  /**
   * Fetch matching trucks for a load
   */
  const fetchMatchingTrucks = async (loadId: string) => {
    setLoadingMatches(true);
    try {
      const response = await fetch(
        `/api/loads/${loadId}/matching-trucks?minScore=0&limit=50`
      );
      // H28 FIX: Check response.ok before parsing
      if (!response.ok) {
        console.error("Failed to fetch matching trucks:", response.status);
        return [];
      }
      const data = await response.json();
      return data.trucks || [];
    } catch (error) {
      console.error("Failed to fetch matching trucks:", error);
      return [];
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchLoads();
  }, [fetchLoads]);

  /**
   * Handle load row expand - show matching trucks
   * L11 FIX: Properly typed load parameter
   */
  const handleLoadExpand = async (load: Load & { matchCount?: number }) => {
    if (expandedLoadId === load.id) {
      setExpandedLoadId(null);
      setMatchingTrucks([]);
    } else {
      setExpandedLoadId(load.id);
      const trucks = await fetchMatchingTrucks(load.id);
      setMatchingTrucks(trucks);
    }
  };

  /**
   * Handle UNPOST action
   * L13 FIX: Properly typed load parameter
   */
  const handleUnpostLoad = async (load: Load) => {
    if (!confirm("Remove this load from the marketplace?")) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${load.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({ status: "UNPOSTED" }),
      });

      if (!response.ok) throw new Error("Failed to unpost load");

      toast.success("Load removed from marketplace");
      fetchLoads();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to unpost load";
      toast.error(message);
    }
  };

  /**
   * Handle DUPLICATE action
   * L14 FIX: Properly typed load parameter
   */
  const handleDuplicateLoad = async (load: Load) => {
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${load.id}/duplicate`, {
        method: "POST",
        headers: {
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
      });

      if (!response.ok) throw new Error("Failed to duplicate load");

      toast.success("Load duplicated! Edit and post when ready.");
      setActiveStatus("UNPOSTED");
      // L41 FIX: Refresh load list after mutation
      fetchLoads();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to duplicate load";
      toast.error(message);
    }
  };

  /**
   * Handle DELETE action
   * L15 FIX: Properly typed load parameter
   */
  const handleDeleteLoad = async (load: Load) => {
    if (!confirm("Are you sure you want to delete this load?")) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${load.id}`, {
        method: "DELETE",
        headers: {
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
      });

      if (!response.ok) throw new Error("Failed to delete load");

      toast.success("Load deleted successfully");
      fetchLoads();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to delete load";
      toast.error(message);
    }
  };

  /**
   * Handle EDIT action
   * L5 FIX: Properly typed load parameter
   */
  const handleStartEdit = (load: Load & { matchCount?: number }) => {
    setEditingLoadId(load.id);
    setEditForm({
      pickupCity: load.pickupCity || "",
      deliveryCity: load.deliveryCity || "",
      pickupDate: load.pickupDate
        ? new Date(load.pickupDate).toISOString().split("T")[0]
        : "",
      deliveryDate: load.deliveryDate
        ? new Date(load.deliveryDate).toISOString().split("T")[0]
        : "",
      truckType: load.truckType || "DRY_VAN",
      weight: load.weight?.toString() || "",
      lengthM: load.lengthM?.toString() || "",
      cargoDescription: load.cargoDescription || "",
      rate: load.rate?.toString() || "",
      contactPhone: load.shipperContactPhone || "",
    });
  };

  /**
   * Handle SAVE edit
   */
  const handleSaveEdit = async () => {
    if (!editingLoadId) return;

    const editingLoad = loads.find((l) => l.id === editingLoadId);
    const wasUnposted = editingLoad?.status === "UNPOSTED";

    try {
      const csrfToken = await getCSRFToken();

      // L6 FIX: Look up city IDs with proper types
      const pickupCityObj = ethiopianCities.find(
        (c) => c.name.toLowerCase() === editForm.pickupCity.toLowerCase()
      );
      const deliveryCityObj = ethiopianCities.find(
        (c) => c.name.toLowerCase() === editForm.deliveryCity.toLowerCase()
      );

      // L7 FIX: Properly typed update payload
      const updatePayload = {
        pickupCity: editForm.pickupCity,
        deliveryCity: editForm.deliveryCity,
        pickupCityId: pickupCityObj?.id || null,
        deliveryCityId: deliveryCityObj?.id || null,
        pickupDate: editForm.pickupDate
          ? new Date(editForm.pickupDate).toISOString()
          : undefined,
        deliveryDate: editForm.deliveryDate
          ? new Date(editForm.deliveryDate).toISOString()
          : null,
        truckType: editForm.truckType,
        weight: editForm.weight ? parseFloat(editForm.weight) : null,
        lengthM: editForm.lengthM ? parseFloat(editForm.lengthM) : null,
        cargoDescription: editForm.cargoDescription || null,
        rate: editForm.rate ? parseFloat(editForm.rate) : null,
        shipperContactPhone: editForm.contactPhone || null,
        status: undefined as string | undefined,
      };

      // If UNPOSTED, also post it
      if (wasUnposted) {
        updatePayload.status = "POSTED";
      }

      const response = await fetch(`/api/loads/${editingLoadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) throw new Error("Failed to update load");

      toast.success(
        wasUnposted ? "Load updated and posted!" : "Load updated successfully!"
      );
      setEditingLoadId(null);
      setEditForm({
        pickupCity: "",
        deliveryCity: "",
        pickupDate: "",
        deliveryDate: "",
        truckType: "",
        weight: "",
        lengthM: "",
        rate: "",
        cargoDescription: "",
        contactPhone: "",
      });

      if (wasUnposted) {
        setActiveStatus("POSTED");
      } else {
        fetchLoads();
      }
    } catch (error) {
      // L17 FIX: Proper error handling without any
      const message =
        error instanceof Error ? error.message : "Failed to update load";
      toast.error(message);
    }
  };

  const handleCancelEdit = () => {
    setEditingLoadId(null);
    setEditForm({
      pickupCity: "",
      deliveryCity: "",
      pickupDate: "",
      deliveryDate: "",
      truckType: "",
      weight: "",
      lengthM: "",
      rate: "",
      cargoDescription: "",
      contactPhone: "",
    });
  };

  /**
   * Handle new load form submission
   */
  const handleCreateLoad = async () => {
    if (
      !newLoadForm.pickupCity ||
      !newLoadForm.deliveryCity ||
      !newLoadForm.pickupDate ||
      !newLoadForm.truckType
    ) {
      toast(
        "Please fill in required fields: Origin, Destination, Pickup Date, and Truck Type"
      );
      return;
    }

    try {
      const csrfToken = await getCSRFToken();

      // L18 FIX: Look up city IDs with proper types (no any)
      const pickupCityObj = ethiopianCities.find(
        (c) => c.name.toLowerCase() === newLoadForm.pickupCity.toLowerCase()
      );
      const deliveryCityObj = ethiopianCities.find(
        (c) => c.name.toLowerCase() === newLoadForm.deliveryCity.toLowerCase()
      );

      const payload = {
        pickupCity: newLoadForm.pickupCity,
        deliveryCity: newLoadForm.deliveryCity,
        pickupCityId: pickupCityObj?.id || null,
        deliveryCityId: deliveryCityObj?.id || null,
        pickupDate: new Date(newLoadForm.pickupDate).toISOString(),
        deliveryDate: newLoadForm.deliveryDate
          ? new Date(newLoadForm.deliveryDate).toISOString()
          : null,
        truckType: newLoadForm.truckType,
        weight: newLoadForm.weight ? parseFloat(newLoadForm.weight) : null,
        lengthM: newLoadForm.lengthM ? parseFloat(newLoadForm.lengthM) : null,
        cargoDescription: newLoadForm.cargoDescription || null,
        specialRequirements: newLoadForm.specialRequirements || null,
        rate: newLoadForm.rate ? parseFloat(newLoadForm.rate) : null,
        contactPhone: newLoadForm.contactPhone || null,
        status: "POSTED", // Post immediately
      };

      const response = await fetch("/api/loads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create load");
      }

      toast.success("Load posted successfully!");

      // Reset form
      setNewLoadForm({
        pickupCity: "",
        deliveryCity: "",
        pickupDate: "",
        deliveryDate: "",
        truckType: "DRY_VAN",
        weight: "",
        lengthM: "",
        cargoDescription: "",
        specialRequirements: "",
        rate: "",
        contactPhone: "",
        pickupCoordinates: undefined,
        deliveryCoordinates: undefined,
      });

      setShowNewLoadForm(false);
      setActiveStatus("POSTED");
      fetchLoads();
    } catch (error) {
      // L19 FIX: Proper error handling without any
      const message =
        error instanceof Error ? error.message : "Failed to create load";
      toast.error(message);
    }
  };

  /**
   * Handle truck request
   * L9 FIX: Properly typed truck parameter
   */
  const handleOpenRequestModal = (truck: TruckMatch, loadId: string) => {
    setSelectedTruckForRequest(truck);
    setSelectedLoadForRequest(loadId);
    setRequestNotes("");
    setRequestProposedRate("");
    setRequestModalOpen(true);
  };

  const handleSubmitTruckRequest = async () => {
    if (!selectedTruckForRequest || !selectedLoadForRequest) {
      toast("Please select a truck");
      return;
    }

    setSubmittingRequest(true);
    try {
      const csrfToken = await getCSRFToken();

      const response = await fetch("/api/truck-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          truckId:
            selectedTruckForRequest.truck?.id || selectedTruckForRequest.id,
          loadId: selectedLoadForRequest,
          notes: requestNotes || undefined,
          proposedRate: requestProposedRate
            ? parseFloat(requestProposedRate)
            : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send truck request");
      }

      toast.success(
        "Request sent to carrier! You will be notified when they respond."
      );
      // L8 FIX: Handle potentially undefined truck IDs
      const truckId =
        selectedTruckForRequest.truck?.id || selectedTruckForRequest.id;
      if (truckId) {
        setRequestedTruckIds((prev) => new Set([...prev, truckId]));
      }
      setRequestModalOpen(false);
    } catch (error) {
      // L20 FIX: Proper error handling without any
      const message =
        error instanceof Error ? error.message : "Failed to send truck request";
      toast.error(message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  /**
   * Status tabs configuration
   */
  const statusTabs: StatusTab[] = [
    { key: "POSTED", label: "Posted", count: statusCounts.POSTED },
    { key: "UNPOSTED", label: "Unposted", count: statusCounts.UNPOSTED },
    { key: "EXPIRED", label: "Expired", count: statusCounts.EXPIRED },
  ];

  /**
   * Helper: Get age style
   */
  const getAgeStyle = (
    date: string | Date | null
  ): { bg: string; text: string; dot: string } => {
    if (!date) return { bg: "bg-slate-100", text: "text-slate-500", dot: "●" };
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    if (hours < 24)
      return { bg: "bg-green-100", text: "text-green-700", dot: "●" };
    if (hours < 72)
      return { bg: "bg-yellow-100", text: "text-yellow-700", dot: "●" };
    return { bg: "bg-slate-100", text: "text-slate-500", dot: "●" };
  };

  const formatAge = (date: string | Date | null): string => {
    if (!date) return "-";
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return "<1h";
    if (hours < 24) return `${Math.floor(hours)}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  /**
   * Helper: Get match score color
   */
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50";
    if (score >= 60) return "text-teal-600 bg-teal-50";
    if (score >= 40) return "text-amber-600 bg-amber-50";
    return "text-slate-600 bg-slate-50";
  };

  return (
    <div className="space-y-4 pt-6">
      {/* Main Tab Navigation */}
      <div className="flex w-fit gap-1 rounded-xl bg-slate-200 p-1">
        <button
          onClick={() => setActiveMainTab("postings")}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-all ${
            activeMainTab === "postings"
              ? "bg-white text-teal-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>📦</span>
          My Loads
          <span
            className={`rounded-full px-2 py-0.5 text-sm ${
              activeMainTab === "postings"
                ? "bg-teal-100 text-teal-600"
                : "bg-slate-300 text-slate-600"
            }`}
          >
            {loads.length}
          </span>
        </button>
        <button
          onClick={() => setActiveMainTab("matching")}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-all ${
            activeMainTab === "matching"
              ? "bg-white text-teal-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>🚚</span>
          Matching Trucks
          <span
            className={`rounded-full px-2 py-0.5 text-sm ${
              activeMainTab === "matching"
                ? "bg-teal-100 text-teal-600"
                : "bg-slate-300 text-slate-600"
            }`}
          >
            {matchingTrucks.length}
          </span>
        </button>
      </div>

      {/* TAB 1: MY LOADS */}
      {activeMainTab === "postings" && (
        <>
          {/* Header Row */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowNewLoadForm(!showNewLoadForm)}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-teal-500/25 transition-all hover:from-teal-700 hover:to-teal-600"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              POST NEW LOAD
            </button>

            <StatusTabs
              tabs={statusTabs}
              activeTab={activeStatus}
              onTabChange={(tab) => setActiveStatus(tab as LoadStatus)}
            />
          </div>

          {/* New Load Posting Form */}
          {showNewLoadForm && (
            <div className="mb-6 overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-teal-50/30 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 shadow-sm">
                    <svg
                      className="h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">
                      Post New Load
                    </h3>
                    <p className="text-xs text-slate-500">
                      Find trucks for your shipment
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowNewLoadForm(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                {/* Row 1: Route & Dates */}
                <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Origin (Pickup) <span className="text-red-500">*</span>
                    </label>
                    <PlacesAutocomplete
                      value={newLoadForm.pickupCity}
                      onChange={(value, place) => {
                        setNewLoadForm({
                          ...newLoadForm,
                          pickupCity: value,
                          pickupCoordinates: place?.coordinates,
                        });
                      }}
                      placeholder="Pickup city"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                      countryRestriction={["ET", "DJ"]}
                      types={["(cities)"]}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Destination <span className="text-red-500">*</span>
                    </label>
                    <PlacesAutocomplete
                      value={newLoadForm.deliveryCity}
                      onChange={(value, place) => {
                        setNewLoadForm({
                          ...newLoadForm,
                          deliveryCity: value,
                          deliveryCoordinates: place?.coordinates,
                        });
                      }}
                      placeholder="Delivery city"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                      countryRestriction={["ET", "DJ"]}
                      types={["(cities)"]}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Pickup Date <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={newLoadForm.pickupDate}
                      onChange={(e) =>
                        setNewLoadForm({
                          ...newLoadForm,
                          pickupDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                      min={new Date().toISOString().split("T")[0]}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Delivery Date
                    </label>
                    <input
                      type="date"
                      value={newLoadForm.deliveryDate}
                      onChange={(e) =>
                        setNewLoadForm({
                          ...newLoadForm,
                          deliveryDate: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                      min={
                        newLoadForm.pickupDate ||
                        new Date().toISOString().split("T")[0]
                      }
                    />
                  </div>
                </div>

                {/* Row 2: Load Details */}
                <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Truck Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={newLoadForm.truckType}
                      onChange={(e) =>
                        setNewLoadForm({
                          ...newLoadForm,
                          truckType: e.target.value,
                        })
                      }
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    >
                      {truckTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={newLoadForm.weight}
                      onChange={(e) =>
                        setNewLoadForm({
                          ...newLoadForm,
                          weight: e.target.value,
                        })
                      }
                      placeholder="e.g. 15000"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Length (m)
                    </label>
                    <input
                      type="number"
                      value={newLoadForm.lengthM}
                      onChange={(e) =>
                        setNewLoadForm({
                          ...newLoadForm,
                          lengthM: e.target.value,
                        })
                      }
                      placeholder="e.g. 12"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Rate (ETB)
                    </label>
                    <input
                      type="number"
                      value={newLoadForm.rate}
                      onChange={(e) =>
                        setNewLoadForm({ ...newLoadForm, rate: e.target.value })
                      }
                      placeholder="Offered rate"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Contact Phone
                    </label>
                    <input
                      type="tel"
                      value={newLoadForm.contactPhone}
                      onChange={(e) =>
                        setNewLoadForm({
                          ...newLoadForm,
                          contactPhone: e.target.value,
                        })
                      }
                      placeholder="+251-9xx-xxx-xxx"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* Row 3: Description */}
                <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Cargo Description
                    </label>
                    <input
                      type="text"
                      value={newLoadForm.cargoDescription}
                      onChange={(e) =>
                        setNewLoadForm({
                          ...newLoadForm,
                          cargoDescription: e.target.value,
                        })
                      }
                      placeholder="What are you shipping?"
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-600">
                      Special Requirements
                    </label>
                    <input
                      type="text"
                      value={newLoadForm.specialRequirements}
                      onChange={(e) =>
                        setNewLoadForm({
                          ...newLoadForm,
                          specialRequirements: e.target.value,
                        })
                      }
                      placeholder="Temperature control, fragile, etc."
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowNewLoadForm(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateLoad}
                    className="rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-2 text-sm font-bold text-white shadow-sm transition-all hover:from-teal-700 hover:to-teal-600"
                  >
                    POST LOAD
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Error Banner */}
          {fetchError && (
            <div className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <span>{fetchError}</span>
              <button
                onClick={fetchLoads}
                className="ml-3 rounded-lg bg-red-100 px-3 py-1 text-xs font-medium transition-colors hover:bg-red-200"
              >
                Retry
              </button>
            </div>
          )}

          {/* Loads List */}
          {loading ? (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-12 text-center shadow-sm">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-teal-500"></div>
              <p className="mt-3 text-sm text-slate-500">Loading loads...</p>
            </div>
          ) : loads.length === 0 ? (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-12 text-center shadow-sm">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <span className="text-3xl">📦</span>
              </div>
              <h4 className="text-lg font-medium text-slate-800">
                No {activeStatus.toLowerCase()} loads
              </h4>
              <p className="mt-1 text-sm text-slate-500">
                {activeStatus === "POSTED"
                  ? "Post a load to start finding trucks"
                  : `No ${activeStatus.toLowerCase()} loads yet`}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {loads.map((load) => (
                <div
                  key={load.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm"
                >
                  {/* Load Row */}
                  <div
                    className={`cursor-pointer p-4 transition-colors hover:bg-slate-50/50 ${expandedLoadId === load.id ? "bg-slate-50/50" : ""}`}
                    onClick={() => handleLoadExpand(load)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {/* Age Badge */}
                        <span
                          className={`${getAgeStyle(load.postedAt || load.createdAt).bg} ${getAgeStyle(load.postedAt || load.createdAt).text} rounded px-2 py-1 text-xs font-medium`}
                        >
                          {getAgeStyle(load.postedAt || load.createdAt).dot}{" "}
                          {formatAge(load.postedAt || load.createdAt)}
                        </span>

                        {/* Route */}
                        <div className="flex items-center gap-2">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-teal-500 to-teal-700 text-lg text-white">
                            📦
                          </div>
                          <div>
                            <div className="font-bold text-slate-900">
                              {load.pickupCity || "N/A"} →{" "}
                              {load.deliveryCity || "N/A"}
                            </div>
                            <div className="text-sm text-slate-500">
                              {getTruckTypeLabel(load.truckType)} •{" "}
                              {load.weight
                                ? `${(load.weight / 1000).toFixed(1)}T`
                                : "N/A"}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        {/* Pickup Date */}
                        <div className="text-right">
                          <div className="text-xs text-slate-400">Pickup</div>
                          <div className="text-sm font-medium text-slate-700">
                            {load.pickupDate
                              ? new Date(load.pickupDate).toLocaleDateString(
                                  "en-US",
                                  { month: "short", day: "numeric" }
                                )
                              : "N/A"}
                          </div>
                        </div>

                        {/* Match Count Badge */}
                        {load.status === "POSTED" && (
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-bold ${
                              (load.matchCount ?? 0) > 0
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {load.matchCount ?? 0} trucks
                          </span>
                        )}

                        {/* Actions */}
                        <div
                          className="flex items-center gap-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {activeStatus === "UNPOSTED" && (
                            <button
                              onClick={() => handleStartEdit(load)}
                              className="rounded-lg px-3 py-1.5 text-xs font-medium text-teal-600 transition-colors hover:bg-teal-50"
                            >
                              Edit & Post
                            </button>
                          )}
                          {activeStatus === "POSTED" && (
                            <>
                              <button
                                onClick={() => handleStartEdit(load)}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleUnpostLoad(load)}
                                className="rounded-lg px-3 py-1.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-50"
                              >
                                Unpost
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDuplicateLoad(load)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                          >
                            Copy
                          </button>
                          <button
                            onClick={() => handleDeleteLoad(load)}
                            className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>

                        {/* Expand Arrow */}
                        <svg
                          className={`h-5 w-5 text-slate-400 transition-transform ${expandedLoadId === load.id ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content - Matching Trucks */}
                  {expandedLoadId === load.id && (
                    <div className="border-t border-slate-100 bg-slate-50/30">
                      {editingLoadId === load.id ? (
                        /* Edit Form */
                        <div className="p-6">
                          <h4 className="mb-4 text-sm font-semibold text-slate-700">
                            Edit Load
                          </h4>
                          <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                            <div>
                              <label className="mb-1 block text-xs text-slate-500">
                                Origin
                              </label>
                              <PlacesAutocomplete
                                value={editForm.pickupCity}
                                onChange={(value) =>
                                  setEditForm({
                                    ...editForm,
                                    pickupCity: value,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                countryRestriction={["ET", "DJ"]}
                                types={["(cities)"]}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-slate-500">
                                Destination
                              </label>
                              <PlacesAutocomplete
                                value={editForm.deliveryCity}
                                onChange={(value) =>
                                  setEditForm({
                                    ...editForm,
                                    deliveryCity: value,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                                countryRestriction={["ET", "DJ"]}
                                types={["(cities)"]}
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-slate-500">
                                Pickup Date
                              </label>
                              <input
                                type="date"
                                value={editForm.pickupDate}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    pickupDate: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-slate-500">
                                Truck Type
                              </label>
                              <select
                                value={editForm.truckType}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    truckType: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              >
                                {truckTypes.map((type) => (
                                  <option key={type.value} value={type.value}>
                                    {type.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="mb-4 grid grid-cols-3 gap-4">
                            <div>
                              <label className="mb-1 block text-xs text-slate-500">
                                Weight (kg)
                              </label>
                              <input
                                type="number"
                                value={editForm.weight}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    weight: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-slate-500">
                                Rate (ETB)
                              </label>
                              <input
                                type="number"
                                value={editForm.rate}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    rate: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="mb-1 block text-xs text-slate-500">
                                Cargo
                              </label>
                              <input
                                type="text"
                                value={editForm.cargoDescription}
                                onChange={(e) =>
                                  setEditForm({
                                    ...editForm,
                                    cargoDescription: e.target.value,
                                  })
                                }
                                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                              />
                            </div>
                          </div>
                          <div className="flex justify-end gap-3">
                            <button
                              onClick={handleCancelEdit}
                              className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={handleSaveEdit}
                              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                            >
                              {load.status === "UNPOSTED"
                                ? "Save & Post"
                                : "Save Changes"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* Matching Trucks List */
                        <div className="p-4">
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="text-sm font-semibold text-slate-700">
                              🚚 Matching Trucks ({matchingTrucks.length})
                            </h4>
                            {onSwitchToSearchTrucks && (
                              <button
                                onClick={() =>
                                  onSwitchToSearchTrucks({
                                    origin: load.pickupCity ?? undefined,
                                    destination: load.deliveryCity ?? undefined,
                                  })
                                }
                                className="text-xs font-medium text-teal-600 hover:text-teal-700"
                              >
                                Search All Trucks →
                              </button>
                            )}
                          </div>

                          {loadingMatches ? (
                            <div className="py-8 text-center">
                              <div className="inline-block h-6 w-6 animate-spin rounded-full border-b-2 border-teal-500"></div>
                              <p className="mt-2 text-sm text-slate-500">
                                Finding trucks...
                              </p>
                            </div>
                          ) : matchingTrucks.length === 0 ? (
                            <div className="py-8 text-center text-sm text-slate-500">
                              No matching trucks found for this load
                            </div>
                          ) : (
                            <div className="max-h-96 space-y-2 overflow-y-auto">
                              {/* L21 FIX: Use TruckMatch type instead of any */}
                              {matchingTrucks
                                .slice(0, 10)
                                .map((truck: TruckMatch, idx: number) => {
                                  const truckId =
                                    truck.truck?.id || truck.id || "";
                                  const isRequested = truckId
                                    ? requestedTruckIds.has(truckId)
                                    : false;

                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 transition-colors hover:border-slate-200"
                                    >
                                      <div className="flex items-center gap-3">
                                        {/* Match Score */}
                                        <span
                                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${getScoreColor(truck.matchScore || 0)}`}
                                        >
                                          {Math.round(truck.matchScore || 0)}%
                                        </span>

                                        {/* Truck Info */}
                                        <div>
                                          <div className="font-semibold text-slate-800">
                                            {truck.truck?.licensePlate || "N/A"}
                                          </div>
                                          <div className="text-xs text-slate-500">
                                            {getTruckTypeLabel(
                                              truck.truck?.truckType
                                            )}{" "}
                                            •{" "}
                                            {truck.truck?.capacity
                                              ? `${(truck.truck.capacity / 1000).toFixed(0)}T`
                                              : "N/A"}
                                            {truck.carrier?.name &&
                                              ` • ${truck.carrier.name}`}
                                          </div>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-3">
                                        {/* DH-O Distance */}
                                        {truck.dhOriginKm !== undefined && (
                                          <span className="text-xs text-slate-500">
                                            DH-O: {truck.dhOriginKm}km
                                          </span>
                                        )}

                                        {/* Location */}
                                        <span className="text-xs text-slate-400">
                                          📍{" "}
                                          {truck.originCity?.name ||
                                            truck.currentCity ||
                                            "N/A"}
                                        </span>

                                        {/* Request Button */}
                                        {isRequested ? (
                                          <span className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-medium text-emerald-700">
                                            ✓ Requested
                                          </span>
                                        ) : (
                                          <button
                                            onClick={() =>
                                              handleOpenRequestModal(
                                                truck,
                                                load.id
                                              )
                                            }
                                            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-700"
                                          >
                                            Request Truck
                                          </button>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              {matchingTrucks.length > 10 && (
                                <p className="py-2 text-center text-xs text-slate-400">
                                  +{matchingTrucks.length - 10} more trucks
                                  available
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 2: MATCHING TRUCKS (All trucks for all posted loads) */}
      {activeMainTab === "matching" && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
              <span className="text-3xl">🚚</span>
            </div>
            <h4 className="text-lg font-medium text-slate-800">
              Select a load to see matches
            </h4>
            <p className="mt-1 text-sm text-slate-500">
              Click on a posted load in &quot;My Loads&quot; tab to view
              matching trucks
            </p>
          </div>
        </div>
      )}

      {/* Truck Request Modal */}
      {requestModalOpen && selectedTruckForRequest && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setRequestModalOpen(false)}
          />
          <div className="flex min-h-screen items-center justify-center p-4">
            <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="mb-4 text-lg font-semibold text-slate-800">
                Request Truck
              </h3>

              <div className="mb-4 rounded-xl bg-slate-50 p-3">
                <div className="font-semibold text-slate-800">
                  {selectedTruckForRequest.truck?.licensePlate || "N/A"}
                </div>
                <div className="text-sm text-slate-500">
                  {getTruckTypeLabel(selectedTruckForRequest.truck?.truckType)}{" "}
                  • {selectedTruckForRequest.carrier?.name || "Unknown Carrier"}
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Proposed Rate (ETB)
                  </label>
                  <input
                    type="number"
                    value={requestProposedRate}
                    onChange={(e) => setRequestProposedRate(e.target.value)}
                    placeholder="Your offer"
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-teal-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Notes (Optional)
                  </label>
                  <textarea
                    value={requestNotes}
                    onChange={(e) => setRequestNotes(e.target.value)}
                    placeholder="Any special requirements or messages..."
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-teal-500"
                  />
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setRequestModalOpen(false)}
                  className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitTruckRequest}
                  disabled={submittingRequest}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {submittingRequest ? "Sending..." : "Send Request"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
