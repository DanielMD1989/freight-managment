"use client";

/**
 * POST TRUCKS Tab Component
 *
 * Main carrier interface for posting trucks and viewing matching loads
 * Sprint 14 - DAT-Style UI Transformation (Phase 4)
 * Updated to match DAT Power UI design
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { StatusTabs, DataTable, AgeIndicator } from "@/components/loadboard-ui";
import { TableColumn, StatusTab } from "@/types/loadboard-ui";
import PlacesAutocomplete from "@/components/PlacesAutocomplete";
import toast from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";
import {
  CarrierUser,
  EthiopianCity,
  Load,
  Truck,
  TruckWithPosting,
  LoadRequest,
  TruckPostingUpdatePayload,
  LoadMatch,
} from "@/types/carrier-loadboard";

interface PostTrucksTabProps {
  user: CarrierUser;
}

type TruckStatus = "POSTED" | "UNPOSTED" | "EXPIRED";
type LoadTab = "all" | "preferred" | "blocked";
type MainTab = "postings" | "matching";

export default function PostTrucksTab({ user }: PostTrucksTabProps) {
  const [trucks, setTrucks] = useState<TruckWithPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<TruckStatus>("POSTED");
  const [activeMainTab, setActiveMainTab] = useState<MainTab>("postings");
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [, setExpandedTruckId] = useState<string | null>(null);
  const [matchingLoads, setMatchingLoads] = useState<Load[]>([]);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TruckPostingUpdatePayload>({});
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [showNewTruckForm, setShowNewTruckForm] = useState(false);
  const [activeLoadTab, setActiveLoadTab] = useState<LoadTab>("all");

  // User's approved trucks (from My Trucks)
  const [approvedTrucks, setApprovedTrucks] = useState<Truck[]>([]);
  const [loadingApprovedTrucks, setLoadingApprovedTrucks] = useState(false);

  // New truck posting form state
  const [newTruckForm, setNewTruckForm] = useState({
    truckId: "",
    availableFrom: "",
    availableTo: "",
    origin: "",
    destination: "",
    declaredDhO: "", // Declared DH-O limit (km) - carrier sets max distance to pickup
    declaredDhD: "", // Declared DH-D limit (km) - carrier sets max distance after delivery
    fullPartial: "FULL",
    lengthM: "",
    weight: "",
    contactPhone: "",
    comments1: "",
    comments2: "",
    // Sprint 15: Google Places coordinates
    originCoordinates: undefined as { lat: number; lng: number } | undefined,
    destinationCoordinates: undefined as
      | { lat: number; lng: number }
      | undefined,
  });

  // Ethiopian cities
  const [ethiopianCities, setEthiopianCities] = useState<EthiopianCity[]>([]);
  const [, setLoadingCities] = useState(false);

  // Note: DH-O, DH-D, F/P filters removed - these are already specified when posting the truck
  // The system auto-calculates distances based on truck location

  // Sprint 18: Load request modal state
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedLoadForRequest, setSelectedLoadForRequest] =
    useState<Load | null>(null);
  const [selectedTruckForRequest, setSelectedTruckForRequest] =
    useState<string>("");
  const [requestNotes, setRequestNotes] = useState("");
  // Note: proposedRate removed - price negotiation happens outside platform
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Track which loads have already been requested by this carrier
  const [requestedLoadIds, setRequestedLoadIds] = useState<Set<string>>(
    new Set()
  );

  /**
   * Reset new truck form to initial state
   */
  const resetNewTruckForm = () => {
    setNewTruckForm({
      truckId: "",
      availableFrom: "",
      availableTo: "",
      origin: "",
      destination: "",
      declaredDhO: "",
      declaredDhD: "",
      fullPartial: "FULL",
      lengthM: "",
      weight: "",
      contactPhone: "",
      comments1: "",
      comments2: "",
      originCoordinates: undefined,
      destinationCoordinates: undefined,
    });
  };

  /**
   * Fetch Ethiopian cities
   */
  const fetchEthiopianCities = async () => {
    setLoadingCities(true);
    try {
      const response = await fetch("/api/ethiopian-locations");
      // L41 FIX: Check response.ok before parsing
      if (!response.ok) {
        console.error("Failed to fetch Ethiopian cities:", response.status);
        return;
      }
      const data = await response.json();
      setEthiopianCities(data.locations || []);
    } catch (error) {
      console.error("Failed to fetch Ethiopian cities:", error);
    } finally {
      setLoadingCities(false);
    }
  };

  /**
   * Fetch user's approved trucks from My Trucks
   */
  const fetchApprovedTrucks = async () => {
    setLoadingApprovedTrucks(true);
    try {
      const response = await fetch(
        "/api/trucks?myTrucks=true&approvalStatus=APPROVED"
      );
      // L41 FIX: Check response.ok before parsing
      if (!response.ok) {
        console.error("Failed to fetch approved trucks:", response.status);
        return;
      }
      const data = await response.json();
      setApprovedTrucks(data.trucks || []);
    } catch (error) {
      console.error("Failed to fetch approved trucks:", error);
    } finally {
      setLoadingApprovedTrucks(false);
    }
  };

  /**
   * Fetch existing load requests to track which loads have already been requested
   */
  const fetchExistingRequests = async () => {
    try {
      const response = await fetch("/api/load-requests?status=PENDING");
      if (response.ok) {
        const data = await response.json();
        const requestedIds = new Set<string>(
          (data.loadRequests || []).map((req: LoadRequest) => req.loadId)
        );
        setRequestedLoadIds(requestedIds);
      }
    } catch (error) {
      console.error("Failed to fetch existing load requests:", error);
    }
  };

  useEffect(() => {
    fetchEthiopianCities();
    fetchApprovedTrucks();
    fetchExistingRequests();
  }, []);

  /**
   * Fetch trucks
   */
  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    try {
      let trucksData: TruckWithPosting[] = [];

      // UNPOSTED requires a different API - fetch trucks without active postings
      if (activeStatus === "UNPOSTED") {
        const response = await fetch(
          `/api/trucks?myTrucks=true&hasActivePosting=false`
        );
        const data = await response.json();
        // Transform truck data to match expected format (add status field)
        trucksData = (data.trucks || []).map((truck: Truck) => ({
          ...truck,
          status: "UNPOSTED" as const,
          matchCount: 0, // Unposted trucks don't have matches
          truck: truck,
        })) as TruckWithPosting[];
      } else {
        // Fetch truck postings for POSTED (ACTIVE) or EXPIRED
        const params = new URLSearchParams();
        params.append("includeMatchCount", "true");
        if (user.organizationId) {
          params.append("organizationId", user.organizationId);
        }

        // Map status - POSTED maps to ACTIVE in the API
        const apiStatus = activeStatus === "POSTED" ? "ACTIVE" : activeStatus;
        params.append("status", apiStatus);

        const response = await fetch(
          `/api/truck-postings?${params.toString()}`
        );
        const data = await response.json();
        trucksData = data.truckPostings || [];
      }

      // Fetch match counts for POSTED/ACTIVE trucks in parallel
      const trucksWithMatchCounts = await Promise.all(
        trucksData.map(async (truck: TruckWithPosting) => {
          if (truck.status === "POSTED" || truck.status === "ACTIVE") {
            try {
              const matchResponse = await fetch(
                `/api/truck-postings/${truck.id}/matching-loads?limit=1`
              );
              const matchData = await matchResponse.json();
              return { ...truck, matchCount: matchData.totalMatches || 0 };
            } catch (error) {
              console.error(
                `Failed to fetch matches for truck ${truck.id}:`,
                error
              );
              return { ...truck, matchCount: 0 };
            }
          }
          return { ...truck, matchCount: 0 };
        })
      );

      // Sort by most recently posted first (smallest age at top)
      const sortedTrucks = trucksWithMatchCounts.sort(
        (a: TruckWithPosting, b: TruckWithPosting) => {
          const dateA = new Date(a.postedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.postedAt || b.createdAt || 0).getTime();
          return dateB - dateA; // Newest first
        }
      );

      setTrucks(sortedTrucks);

      // Fetch counts for each status tab
      const counts: Record<string, number> = {
        POSTED: 0,
        UNPOSTED: 0,
        EXPIRED: 0,
      };

      // Fetch POSTED (ACTIVE postings) and EXPIRED counts from truck-postings API
      const postingStatusPromises = [
        { key: "POSTED", apiStatus: "ACTIVE" },
        { key: "EXPIRED", apiStatus: "EXPIRED" },
      ].map(async ({ key, apiStatus }) => {
        const res = await fetch(
          `/api/truck-postings?organizationId=${user.organizationId}&status=${apiStatus}&limit=1`
        );
        const json = await res.json();
        counts[key] = json.pagination?.total || 0;
      });

      // Fetch UNPOSTED count from trucks API (trucks without active postings)
      const unpostedPromise = async () => {
        const res = await fetch(
          `/api/trucks?myTrucks=true&hasActivePosting=false`
        );
        const json = await res.json();
        counts["UNPOSTED"] = json.pagination?.total || 0;
      };

      await Promise.all([...postingStatusPromises, unpostedPromise()]);
      setStatusCounts(counts);
    } catch (error) {
      console.error("Failed to fetch trucks:", error);
      // L41 FIX: Show error to user
      toast.error("Failed to load trucks. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [activeStatus, user.organizationId]);

  /**
   * COLLAPSED TO SINGLE SOURCE OF TRUTH (2026-02-06)
   * Now delegates to lib/geo.ts:calculateDistanceKm with Math.round wrapper.
   * Preserves original INTEGER return behavior for backward compatibility.
   *
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in kilometers (rounded to integer)
   */

  /**
   * Fetch all matching loads for all posted trucks
   * Shows recent loads with DH-O and DH-D set to 0 (will be calculated when truck is selected)
   */
  const fetchAllMatchingLoads = useCallback(async () => {
    setLoadingMatches(true);
    try {
      // Get all posted trucks
      const postedTrucks = trucks.filter(
        (t) => t.status === "POSTED" || t.status === "ACTIVE"
      );

      if (postedTrucks.length === 0) {
        setMatchingLoads([]);
        setLoadingMatches(false);
        return;
      }

      // Fetch matching loads for each truck
      const allLoadsPromises = postedTrucks.map((truck) =>
        fetch(`/api/truck-postings/${truck.id}/matching-loads?limit=100`)
          .then((res) => res.json())
          .then((data) => {
            // Add truck info to each load for DH calculation
            return (data.matches || []).map((match: LoadMatch) => ({
              ...match,
              truckOrigin: truck.originCity?.name || truck.origin,
              truckDestination:
                truck.destinationCity?.name || truck.destination,
            }));
          })
          .catch((err) => {
            console.error(`Failed to fetch loads for truck ${truck.id}:`, err);
            return [];
          })
      );

      const loadsArrays = await Promise.all(allLoadsPromises);

      // Flatten and deduplicate loads by id
      const allLoads = loadsArrays.flat();
      const uniqueLoads = Array.from(
        new Map(
          allLoads.map((load) => [load.load?.id || load.id, load])
        ).values()
      );

      // Sort by most recent first, then by origin alphabetically
      const sortedLoads = uniqueLoads.sort((a, b) => {
        const loadA = a.load || a;
        const loadB = b.load || b;

        // First: by most recent (newest first)
        const dateA = new Date(loadA.createdAt || 0).getTime();
        const dateB = new Date(loadB.createdAt || 0).getTime();
        if (dateA !== dateB) return dateB - dateA;

        // Second: by pickup city (origin) alphabetically
        const cityA = (loadA.pickupCity || "").toLowerCase();
        const cityB = (loadB.pickupCity || "").toLowerCase();
        return cityA.localeCompare(cityB);
      });

      setMatchingLoads(sortedLoads);
    } catch (error) {
      console.error("Failed to fetch all matching loads:", error);
      setMatchingLoads([]);
    } finally {
      setLoadingMatches(false);
    }
  }, [trucks]);

  /**
   * Fetch matching loads for a specific truck
   * Used when user clicks on a truck row - shows exact matches for that truck
   */
  const fetchMatchingLoadsForTruck = async (truckId: string) => {
    setLoadingMatches(true);
    try {
      const response = await fetch(
        `/api/truck-postings/${truckId}/matching-loads`
      );
      const data = await response.json();
      setMatchingLoads(data.matches || []);
    } catch (error) {
      console.error("Failed to fetch matching loads for truck:", error);
      setMatchingLoads([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  useEffect(() => {
    // Fetch matching loads when trucks are loaded
    if (trucks.length > 0) {
      fetchAllMatchingLoads();
    }
  }, [trucks, fetchAllMatchingLoads]);

  /**
   * Handle DELETE action
   */
  const handleDelete = async (truck: TruckWithPosting) => {
    if (!confirm(`Are you sure you want to delete this truck posting?`)) {
      return;
    }

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error(
          "Failed to get security token. Please refresh and try again."
        );
        return;
      }

      const response = await fetch(`/api/truck-postings/${truck.id}`, {
        method: "DELETE",
        headers: {
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
      });

      if (!response.ok) throw new Error("Failed to delete truck");

      toast.success("Truck posting deleted successfully");
      fetchTrucks();
      if (selectedTruckId === truck.id) {
        setSelectedTruckId(null);
        setMatchingLoads([]);
      }
    } catch (error) {
      console.error("Delete failed:", error);
      toast.error("Failed to delete truck posting");
    }
  };

  /**
   * Check if a truck already has an active posting
   */
  const getActivePostingForTruck = (truckId: string) => {
    return trucks.find(
      (posting) =>
        posting.truckId === truckId &&
        (posting.status === "ACTIVE" || posting.status === "POSTED")
    );
  };

  /**
   * Handle truck selection - pre-fill form with truck data
   * Only unposted trucks appear in the dropdown
   */
  const handleTruckSelection = (truckId: string) => {
    if (!truckId) {
      setNewTruckForm((prev) => ({ ...prev, truckId: "" }));
      return;
    }

    const selectedTruck = approvedTrucks.find((t) => t.id === truckId);
    if (selectedTruck) {
      // Pre-fill some fields from the truck data
      setNewTruckForm((prev) => ({
        ...prev,
        truckId,
        origin: selectedTruck.currentCity || "",
        lengthM: selectedTruck.lengthM ? String(selectedTruck.lengthM) : "",
        weight: selectedTruck.capacity ? String(selectedTruck.capacity) : "",
      }));
    }
  };

  /**
   * Handle new truck form submission
   */
  const handlePostTruck = async () => {
    // Validate required fields
    if (!newTruckForm.truckId) {
      toast("Please select a truck from your fleet");
      return;
    }
    if (
      !newTruckForm.origin ||
      !newTruckForm.availableFrom ||
      !newTruckForm.contactPhone
    ) {
      toast(
        "Please fill in all required fields: Origin, Available Date, and Contact Phone"
      );
      return;
    }

    try {
      const csrfToken = await getCSRFToken();

      const selectedTruck = approvedTrucks.find(
        (t) => t.id === newTruckForm.truckId
      );

      // Look up EthiopianLocation IDs from city names
      const originCity = ethiopianCities.find(
        (c: EthiopianCity) =>
          c.name.toLowerCase() === newTruckForm.origin.toLowerCase()
      );
      const destinationCity = newTruckForm.destination
        ? ethiopianCities.find(
            (c: EthiopianCity) =>
              c.name.toLowerCase() === newTruckForm.destination.toLowerCase()
          )
        : null;

      if (!originCity) {
        toast(
          "Origin city not found in Ethiopian locations. Please select a valid city."
        );
        return;
      }

      // Convert date to ISO datetime format
      const availableFromISO = new Date(
        newTruckForm.availableFrom + "T00:00:00"
      ).toISOString();
      const availableToISO = newTruckForm.availableTo
        ? new Date(newTruckForm.availableTo + "T23:59:59").toISOString()
        : null;

      // Build the payload with all fields including declared DH limits
      const payload = {
        truckId: newTruckForm.truckId,
        originCityId: originCity.id,
        destinationCityId: destinationCity?.id || null,
        availableFrom: availableFromISO,
        availableTo: availableToISO,
        fullPartial: newTruckForm.fullPartial,
        availableLength: newTruckForm.lengthM
          ? parseFloat(newTruckForm.lengthM)
          : null,
        availableWeight: newTruckForm.weight
          ? parseFloat(newTruckForm.weight)
          : null,
        ownerName: selectedTruck?.carrier?.name || null,
        contactName: user.firstName + " " + user.lastName,
        contactPhone: newTruckForm.contactPhone,
        notes:
          (newTruckForm.comments1 + "\n" + newTruckForm.comments2).trim() ||
          null,
        // Declared DH limits (carrier specifies max distances they're willing to accept)
        preferredDhToOriginKm: newTruckForm.declaredDhO
          ? parseFloat(newTruckForm.declaredDhO)
          : null,
        preferredDhAfterDeliveryKm: newTruckForm.declaredDhD
          ? parseFloat(newTruckForm.declaredDhD)
          : null,
      };

      const response = await fetch("/api/truck-postings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        // Show validation details if available
        let errorMessage = errorData.error || "Failed to create truck posting";
        if (errorData.details) {
          errorMessage +=
            "\n\nDetails: " + JSON.stringify(errorData.details, null, 2);
        }
        throw new Error(errorMessage);
      }

      toast.success("Truck posting created successfully!");

      // Reset form
      setNewTruckForm({
        truckId: "",
        availableFrom: "",
        availableTo: "",
        origin: "",
        destination: "",
        declaredDhO: "",
        declaredDhD: "",
        fullPartial: "FULL",
        lengthM: "",
        weight: "",
        contactPhone: "",
        comments1: "",
        comments2: "",
        originCoordinates: undefined,
        destinationCoordinates: undefined,
      });

      setShowNewTruckForm(false);

      // Refresh trucks (matching loads will be fetched automatically via useEffect)
      await fetchTrucks();
    } catch (error: unknown) {
      console.error("Create truck posting error:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create truck posting"
      );
    }
  };

  /**
   * Status tabs configuration - Active, Unposted, Expired
   */
  const statusTabs: StatusTab[] = [
    { key: "POSTED", label: "Active", count: statusCounts.POSTED },
    { key: "UNPOSTED", label: "Unposted", count: statusCounts.UNPOSTED },
    { key: "EXPIRED", label: "Expired", count: statusCounts.EXPIRED },
  ];

  /**
   * Sprint 18: Handle opening the load request modal
   */
  const handleOpenRequestModal = (load: Load) => {
    setSelectedLoadForRequest(load);
    // Pre-select first posted truck
    const postedTrucks = trucks.filter(
      (t) =>
        (t.status === "POSTED" || t.status === "ACTIVE") &&
        t.truck?.approvalStatus === "APPROVED"
    );
    if (postedTrucks.length > 0) {
      setSelectedTruckForRequest(postedTrucks[0].truck?.id || "");
    }
    setRequestNotes("");
    setRequestModalOpen(true);
  };

  /**
   * Sprint 18: Submit load request to shipper
   */
  const handleSubmitLoadRequest = async () => {
    if (!selectedLoadForRequest || !selectedTruckForRequest) {
      toast("Please select a truck for this load request");
      return;
    }

    setSubmittingRequest(true);
    try {
      // Get CSRF token
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error(
          "Failed to get security token. Please refresh and try again."
        );
        setSubmittingRequest(false);
        return;
      }

      const response = await fetch("/api/load-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          loadId: selectedLoadForRequest.id,
          truckId: selectedTruckForRequest,
          notes: requestNotes || undefined,
          // No proposedRate - price negotiation happens outside platform
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to submit load request");
      }

      toast.success(
        "Load request sent to shipper! You will be notified when they respond."
      );

      // Add to requested loads to update button state
      setRequestedLoadIds(
        (prev) => new Set([...prev, selectedLoadForRequest.id])
      );

      setRequestModalOpen(false);
      setSelectedLoadForRequest(null);
      setSelectedTruckForRequest("");
      setRequestNotes("");
    } catch (error: unknown) {
      console.error("Load request error:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to submit load request"
      );
    } finally {
      setSubmittingRequest(false);
    }
  };

  /**
   * Get posted trucks that are approved for requests
   */
  const getApprovedPostedTrucks = () => {
    return trucks.filter(
      (t) =>
        (t.status === "POSTED" || t.status === "ACTIVE") &&
        t.truck?.approvalStatus === "APPROVED"
    );
  };

  /**
   * Helper: Get age color based on hours
   */
  const getAgeStyle = (
    date: string | Date | null
  ): { bg: string; text: string; dot: string } => {
    if (!date) return { bg: "bg-slate-100", text: "text-slate-500", dot: "●" };
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    if (hours < 24)
      return { bg: "bg-green-100", text: "text-green-700", dot: "●" }; // Fresh
    if (hours < 72)
      return { bg: "bg-yellow-100", text: "text-yellow-700", dot: "●" }; // Recent
    return { bg: "bg-slate-100", text: "text-slate-500", dot: "●" }; // Old
  };

  /**
   * Helper: Format age text
   */
  const formatAge = (date: string | Date | null): string => {
    if (!date) return "-";
    const hours = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60);
    if (hours < 1) return "<1h";
    if (hours < 24) return `${Math.floor(hours)}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  /**
   * Helper: Get status badge style
   */
  const getStatusStyle = (status: string): { bg: string; text: string } => {
    switch (status) {
      case "POSTED":
      case "ACTIVE":
        return { bg: "bg-green-100", text: "text-green-700" };
      case "UNPOSTED":
        return { bg: "bg-slate-100", text: "text-slate-600" };
      case "EXPIRED":
        return { bg: "bg-red-100", text: "text-red-700" };
      default:
        return { bg: "bg-slate-100", text: "text-slate-500" };
    }
  };

  /**
   * Truck table columns - Consolidated design
   */
  const truckColumns: TableColumn[] = [
    // Age column with color-coded badge
    {
      key: "age",
      label: "Age",
      width: "60px",
      render: (_, row) => {
        const style = getAgeStyle(row.postedAt || row.createdAt);
        const age = formatAge(row.postedAt || row.createdAt);
        return (
          <span
            className={`${style.bg} ${style.text} rounded px-2 py-1 text-xs font-medium`}
          >
            {style.dot} {age}
          </span>
        );
      },
    },
    // Truck column - Combined plate + type + capacity
    {
      key: "truck",
      label: "Truck",
      width: "180px",
      render: (_, row) => {
        const truck = row.truck;
        const plate = truck?.licensePlate || "N/A";
        const type = (truck?.truckType || row.truckType || "N/A").replace(
          "_",
          " "
        );
        const capacity = truck?.capacity
          ? `${Math.round(truck.capacity / 1000)}T`
          : "";
        return (
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 text-lg text-white">
              🚚
            </div>
            <div>
              <div className="font-bold text-slate-900">{plate}</div>
              <div className="text-sm text-slate-500">
                {type} {capacity && `• ${capacity}`}
              </div>
            </div>
          </div>
        );
      },
    },
    // Route column - Combined origin → destination
    {
      key: "route",
      label: "Route",
      width: "200px",
      render: (_, row) => {
        const origin = row.originCity?.name || "N/A";
        const destination = row.destinationCity?.name || "Any";
        const originRegion = row.originCity?.region || "";
        const destRegion = row.destinationCity?.region || "";
        return (
          <div>
            <div className="text-slate-700">
              {origin} <span className="text-slate-400">→</span> {destination}
            </div>
            {(originRegion || destRegion) && (
              <div className="text-xs text-slate-400">
                {originRegion}
                {originRegion && destRegion && " → "}
                {destRegion}
              </div>
            )}
          </div>
        );
      },
    },
    // Available column - Date range
    {
      key: "available",
      label: "Available",
      width: "120px",
      render: (_, row) => {
        const from = row.availableFrom
          ? new Date(row.availableFrom).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "Now";
        const to = row.availableTo
          ? new Date(row.availableTo).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : "";
        return (
          <span className="text-sm text-slate-700">
            {from}
            {to && ` - ${to}`}
          </span>
        );
      },
    },
    // Type column - FULL/PARTIAL badge
    {
      key: "fullPartial",
      label: "Type",
      width: "80px",
      align: "center" as const,
      render: (value) => {
        const isFull = value === "FULL";
        return (
          <span
            className={`rounded px-2 py-1 text-xs font-semibold ${
              isFull ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700"
            }`}
          >
            {isFull ? "FULL" : "PARTIAL"}
          </span>
        );
      },
    },
    // Status column - Active/Unposted/Expired badge
    {
      key: "status",
      label: "Status",
      width: "90px",
      align: "center" as const,
      render: (value) => {
        const style = getStatusStyle(value);
        const label =
          value === "ACTIVE" || value === "POSTED"
            ? "Active"
            : value === "UNPOSTED"
              ? "Unposted"
              : "Expired";
        return (
          <span
            className={`${style.bg} ${style.text} rounded-full px-3 py-1 text-xs font-semibold uppercase`}
          >
            {label}
          </span>
        );
      },
    },
    // Matches column - Styled button
    {
      key: "matchCount",
      label: "Matches",
      width: "110px",
      align: "center" as const,
      render: (value) => {
        const count = value || 0;
        if (count === 0) {
          return (
            <span className="rounded-md bg-slate-100 px-3 py-1.5 text-sm text-slate-500">
              0 matches
            </span>
          );
        }
        return (
          <span className="cursor-pointer rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white">
            {count} matches →
          </span>
        );
      },
    },
    // Actions column - Edit/Cancel buttons
    {
      key: "actions",
      label: "Actions",
      width: "140px",
      align: "center" as const,
      render: (_, row) => {
        return (
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
              className="rounded bg-sky-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-sky-700"
            >
              Edit
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              className="rounded border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-200"
            >
              Cancel
            </button>
          </div>
        );
      },
    },
  ];

  /**
   * Matching loads table columns
   */
  const loadColumns: TableColumn[] = [
    {
      key: "age",
      label: "Age",
      width: "60px",
      render: (_, row) => <AgeIndicator date={row.postedAt || row.createdAt} />,
    },
    {
      key: "pickupDate",
      label: "Pickup",
      width: "90px",
      render: (value) => (value ? new Date(value).toLocaleDateString() : "N/A"),
    },
    {
      key: "truckType",
      label: "Truck",
      width: "80px",
      render: (value) => value?.replace("_", " ") || "N/A",
    },
    {
      key: "fullPartial",
      label: "F/P",
      width: "40px",
      align: "center" as const,
      render: (value) => (value === "FULL" ? "F" : "P"),
    },
    {
      key: "dhToOriginKm",
      label: "DH-O",
      width: "70px",
      align: "right" as const,
      render: (value, row) => {
        if (!value && value !== 0) return "-";
        // Show green if within declared limits, gray otherwise
        const withinLimits = row.withinDhLimits;
        return (
          <span
            className={`font-medium ${withinLimits ? "text-green-600" : "text-[#064d51]/60"}`}
          >
            {value} km
          </span>
        );
      },
    },
    {
      key: "pickupCity",
      label: "Origin",
      width: "100px",
    },
    {
      key: "tripKm",
      label: "Trip",
      width: "60px",
      align: "right" as const,
      render: (value) => (value ? `${value}` : "-"),
    },
    {
      key: "deliveryCity",
      label: "Destination",
      width: "100px",
    },
    {
      key: "dhAfterDeliveryKm",
      label: "DH-D",
      width: "70px",
      align: "right" as const,
      render: (value, row) => {
        if (!value && value !== 0) return "-";
        // Show green if within declared limits, gray otherwise
        const withinLimits = row.withinDhLimits;
        return (
          <span
            className={`font-medium ${withinLimits ? "text-green-600" : "text-[#064d51]/60"}`}
          >
            {value} km
          </span>
        );
      },
    },
    {
      key: "shipper",
      label: "Company",
      width: "140px",
      render: (_, row) => (
        <span className="cursor-pointer text-[#1e9c99] hover:underline">
          {row.shipper?.name || "N/A"}
        </span>
      ),
    },
    {
      key: "shipperContactPhone",
      label: "Contact",
      width: "110px",
      render: (value) => value || "N/A",
    },
    {
      key: "lengthM",
      label: "Length",
      width: "60px",
      align: "right" as const,
      render: (value) => (value ? `${value}` : "-"),
    },
    {
      key: "weight",
      label: "Weight",
      width: "70px",
      align: "right" as const,
      render: (value) => (value ? `${value} lbs` : "-"),
    },
    // Sprint 18: Request Load button column
    {
      key: "actions",
      label: "Action",
      width: "120px",
      align: "center" as const,
      render: (_, row) => {
        const isRequested = requestedLoadIds.has(row.id);
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isRequested) {
                handleOpenRequestModal(row);
              }
            }}
            disabled={isRequested}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold whitespace-nowrap transition-colors ${
              isRequested
                ? "cursor-not-allowed bg-amber-500 text-white"
                : "bg-[#064d51] text-white hover:bg-[#053d40]"
            }`}
          >
            {isRequested ? "REQUESTED" : "REQUEST LOAD"}
          </button>
        );
      },
    },
  ];

  /**
   * Handle EDIT action
   */
  const handleEdit = async (truck: TruckWithPosting) => {
    // Parse notes to extract comments
    const notesLines = truck.notes?.split("\n") || [];

    // Format dates for date input (YYYY-MM-DD)
    const formatDate = (date: string | Date | null | undefined): string => {
      if (!date) return "";
      try {
        const d = new Date(date);
        return d.toISOString().split("T")[0];
      } catch {
        return "";
      }
    };

    // Ensure the row stays expanded when editing
    setExpandedTruckId(truck.id);
    setEditingTruckId(truck.id);
    setEditForm({
      availableFrom: formatDate(truck.availableFrom),
      availableTo: formatDate(truck.availableTo),
      owner: truck.ownerName || "",
      origin: truck.originCityId || "",
      destination: truck.destinationCityId || "",
      truckType: truck.truck?.truckType || "DRY_VAN",
      fullPartial: truck.fullPartial || "FULL",
      lengthM: truck.availableLength || "",
      weight: truck.availableWeight || "",
      contactPhone: truck.contactPhone || "",
      comments1: notesLines[0] || "",
      comments2: notesLines[1] || "",
      // Declared DH limits
      declaredDhO: truck.preferredDhToOriginKm || "",
      declaredDhD: truck.preferredDhAfterDeliveryKm || "",
    });
  };

  const handleSaveEdit = async () => {
    if (!editingTruckId) return;

    // Find the truck being edited to check its status
    const editingTruck = trucks.find((t) => t.id === editingTruckId);
    const wasUnposted = editingTruck?.status === "UNPOSTED";

    // Build notes from comments, handling undefined values
    const comment1 = editForm.comments1 || "";
    const comment2 = editForm.comments2 || "";
    const notes =
      [comment1, comment2].filter(Boolean).join("\n").trim() || undefined;

    try {
      // Get CSRF token for secure submission
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error(
          "Failed to get security token. Please refresh and try again."
        );
        return;
      }

      // Build update payload
      const updatePayload: TruckPostingUpdatePayload = {
        availableFrom: editForm.availableFrom || undefined,
        availableTo: editForm.availableTo || undefined,
        originCityId: editForm.origin || undefined,
        destinationCityId: editForm.destination || undefined,
        fullPartial: editForm.fullPartial || undefined,
        availableLength: editForm.lengthM
          ? parseFloat(String(editForm.lengthM))
          : null,
        availableWeight: editForm.weight
          ? parseFloat(String(editForm.weight))
          : null,
        ownerName: editForm.owner || undefined,
        contactPhone: editForm.contactPhone || undefined,
        notes,
        // Declared DH limits
        preferredDhToOriginKm: editForm.declaredDhO
          ? parseFloat(String(editForm.declaredDhO))
          : null,
        preferredDhAfterDeliveryKm: editForm.declaredDhD
          ? parseFloat(String(editForm.declaredDhD))
          : null,
      };

      // If currently UNPOSTED, change to ACTIVE when saving
      if (wasUnposted) {
        updatePayload.status = "ACTIVE";
      }

      const response = await fetch(`/api/truck-postings/${editingTruckId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(updatePayload),
      });

      if (!response.ok) throw new Error("Failed to update truck posting");

      toast.success(
        wasUnposted
          ? "Truck updated and posted successfully!"
          : "Truck posting updated successfully!"
      );
      setEditingTruckId(null);
      setEditForm({});

      // If was unposted, switch to POSTED tab (useEffect will fetch)
      if (wasUnposted) {
        setActiveStatus("POSTED");
      } else {
        fetchTrucks();
      }
    } catch (error: unknown) {
      console.error("Update failed:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to update truck posting"
      );
    }
  };

  const handleCancelEdit = () => {
    setEditingTruckId(null);
    setEditForm({});
  };

  /**
   * Truck row actions
   */
  /**
   * Get selected truck's origin for filtering
   */
  /**
   * Filter matching loads based on active tab only
   * API already returns correctly matched loads - no need for city name filtering
   * Sorts by: loads within DH limits first, then DH-O, then by match score
   */
  const filteredMatchingLoads = matchingLoads
    .map((match) => {
      // Extract load from match object (API returns { load: {...}, matchScore: X })
      const load = match.load || match;
      return {
        ...match,
        load: {
          ...load,
          // Preserve DH values and limits flag from match if available
          dhToOriginKm: match.dhToOriginKm ?? load.dhToOriginKm ?? 0,
          dhAfterDeliveryKm:
            match.dhAfterDeliveryKm ?? load.dhAfterDeliveryKm ?? 0,
          withinDhLimits: match.withinDhLimits ?? load.withinDhLimits ?? true,
        },
      };
    })
    .filter(({ load }) => {
      if (!load) return false;

      // Tab filtering (preferred/blocked companies - future feature)
      if (activeLoadTab === "preferred") {
        return false; // TODO: Implement preferred company logic
      }
      if (activeLoadTab === "blocked") {
        return false; // TODO: Implement blocked company logic
      }

      return true;
    })
    .sort((a, b) => {
      // If a truck is selected, sort by within-limits first, then DH-O
      if (selectedTruckId) {
        // First priority: loads within declared DH limits come first
        const aWithin = a.load?.withinDhLimits ?? true;
        const bWithin = b.load?.withinDhLimits ?? true;
        if (aWithin !== bWithin) {
          return aWithin ? -1 : 1;
        }

        // Second: by DH-O (lower is better)
        const dhA = a.load?.dhToOriginKm || 0;
        const dhB = b.load?.dhToOriginKm || 0;
        if (dhA !== dhB) return dhA - dhB;

        // Third: by DH-D (lower is better)
        const dhDA = a.load?.dhAfterDeliveryKm || 0;
        const dhDB = b.load?.dhAfterDeliveryKm || 0;
        if (dhDA !== dhDB) return dhDA - dhDB;
      } else {
        // No truck selected: sort by recency first, then by location
        // First: by most recent posted (newest first)
        const dateA = new Date(
          a.load?.postedAt || a.load?.createdAt || 0
        ).getTime();
        const dateB = new Date(
          b.load?.postedAt || b.load?.createdAt || 0
        ).getTime();
        if (dateA !== dateB) return dateB - dateA;

        // Second: by pickup city (alphabetically for easier scanning)
        const cityA = (a.load?.pickupCity || "").toLowerCase();
        const cityB = (b.load?.pickupCity || "").toLowerCase();
        if (cityA !== cityB) return cityA.localeCompare(cityB);

        // Third: by delivery city
        const destA = (a.load?.deliveryCity || "").toLowerCase();
        const destB = (b.load?.deliveryCity || "").toLowerCase();
        return destA.localeCompare(destB);
      }

      // Fallback: sort by most recent posted first
      const dateA = new Date(
        a.load?.postedAt || a.load?.createdAt || 0
      ).getTime();
      const dateB = new Date(
        b.load?.postedAt || b.load?.createdAt || 0
      ).getTime();
      return dateB - dateA;
    })
    .map((match) => match.load); // Return just the load object for the table

  // Get selected truck details for matching tab header
  const selectedTruckDetails = selectedTruckId
    ? trucks.find((t) => t.id === selectedTruckId)
    : null;

  return (
    <div className="space-y-4 pt-6">
      {/* Main Tab Navigation - Pill Style */}
      <div className="flex w-fit gap-1 rounded-xl bg-slate-200 p-1">
        <button
          onClick={() => setActiveMainTab("postings")}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-all ${
            activeMainTab === "postings"
              ? "bg-white text-sky-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>📋</span>
          My Postings
          <span
            className={`rounded-full px-2 py-0.5 text-sm ${
              activeMainTab === "postings"
                ? "bg-sky-100 text-sky-600"
                : "bg-slate-300 text-slate-600"
            }`}
          >
            {trucks.length}
          </span>
        </button>
        <button
          onClick={() => setActiveMainTab("matching")}
          className={`flex items-center gap-2 rounded-lg px-6 py-3 font-semibold transition-all ${
            activeMainTab === "matching"
              ? "bg-white text-sky-600 shadow-sm"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          <span>🔍</span>
          Matching Loads
          <span
            className={`rounded-full px-2 py-0.5 text-sm ${
              activeMainTab === "matching"
                ? "bg-sky-100 text-sky-600"
                : "bg-slate-300 text-slate-600"
            }`}
          >
            {filteredMatchingLoads.length}
          </span>
        </button>
      </div>

      {/* ============================================================ */}
      {/* TAB 1: MY POSTINGS                                           */}
      {/* ============================================================ */}
      {activeMainTab === "postings" && (
        <>
          {/* Header Row - NEW TRUCK POST on left, Status Tabs on right */}
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowNewTruckForm(!showNewTruckForm)}
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
              NEW TRUCK POST
            </button>

            {/* Status Filter Tabs - Right Side */}
            <StatusTabs
              tabs={statusTabs}
              activeTab={activeStatus}
              onTabChange={(tab) => setActiveStatus(tab as TruckStatus)}
            />
          </div>

          {/* New Truck Posting Form - Clean Organized Layout */}
          {showNewTruckForm && (
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
                      Create New Truck Posting
                    </h3>
                    <p className="text-xs text-slate-500">
                      List your truck for available loads
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    resetNewTruckForm();
                    setShowNewTruckForm(false);
                  }}
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
                {/* Step 1: Select Truck */}
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-semibold text-gray-800 dark:text-gray-200">
                    Step 1: Select Truck from Your Fleet{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  {loadingApprovedTrucks ? (
                    <div className="py-4 text-[#064d51]/60 dark:text-gray-400">
                      Loading your trucks...
                    </div>
                  ) : (
                    (() => {
                      // Filter to only show unposted trucks
                      const unpostedTrucks = approvedTrucks.filter(
                        (truck) => !getActivePostingForTruck(truck.id)
                      );

                      if (approvedTrucks.length === 0) {
                        return (
                          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/30">
                            <p className="text-sm text-yellow-800 dark:text-yellow-300">
                              No approved trucks found. Please add and get a
                              truck approved in{" "}
                              <Link
                                href="/carrier/trucks"
                                className="font-medium underline"
                              >
                                My Trucks
                              </Link>{" "}
                              first.
                            </p>
                          </div>
                        );
                      }

                      if (unpostedTrucks.length === 0) {
                        return (
                          <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/30">
                            <p className="text-sm text-blue-800 dark:text-blue-300">
                              All your trucks are already posted. To edit an
                              existing posting, click on it in the list below.
                            </p>
                          </div>
                        );
                      }

                      return (
                        <select
                          value={newTruckForm.truckId}
                          onChange={(e) => handleTruckSelection(e.target.value)}
                          className="w-full max-w-md rounded-lg border border-[#064d51]/20 bg-white px-4 py-3 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                        >
                          <option value="">-- Select a truck to post --</option>
                          {unpostedTrucks.map((truck) => (
                            <option key={truck.id} value={truck.id}>
                              {truck.licensePlate} -{" "}
                              {truck.truckType?.replace("_", " ")} •{" "}
                              {truck.capacity} kg
                              {truck.currentCity
                                ? ` (📍 ${truck.currentCity})`
                                : ""}
                            </option>
                          ))}
                        </select>
                      );
                    })()
                  )}
                </div>

                {/* Step 2: Posting Details - Only show when truck is selected */}
                {newTruckForm.truckId && (
                  <>
                    <div className="mb-6 border-t border-gray-200 pt-6 dark:border-slate-700">
                      <label className="mb-4 block text-sm font-semibold text-gray-800 dark:text-gray-200">
                        Step 2: Posting Details
                      </label>

                      {/* Row 1: Location & Availability */}
                      <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                        {/* Origin */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Origin (Available At){" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <PlacesAutocomplete
                            value={newTruckForm.origin}
                            onChange={(value, place) => {
                              setNewTruckForm({
                                ...newTruckForm,
                                origin: value,
                                originCoordinates: place?.coordinates,
                              });
                            }}
                            placeholder="Where is truck available?"
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                            countryRestriction={["ET", "DJ"]}
                            types={["(cities)"]}
                          />
                        </div>

                        {/* Destination */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Destination (Preferred)
                          </label>
                          <PlacesAutocomplete
                            value={newTruckForm.destination}
                            onChange={(value, place) => {
                              setNewTruckForm({
                                ...newTruckForm,
                                destination: value,
                                destinationCoordinates: place?.coordinates,
                              });
                            }}
                            placeholder="Anywhere"
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                            countryRestriction={["ET", "DJ"]}
                            types={["(cities)"]}
                          />
                        </div>

                        {/* Available From */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Available From{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={newTruckForm.availableFrom}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                availableFrom: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                            min={new Date().toISOString().split("T")[0]}
                          />
                        </div>

                        {/* Available To */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Available Until
                          </label>
                          <input
                            type="date"
                            value={newTruckForm.availableTo}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                availableTo: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                            min={
                              newTruckForm.availableFrom ||
                              new Date().toISOString().split("T")[0]
                            }
                          />
                        </div>
                      </div>

                      {/* Row 2: Load Details */}
                      <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
                        {/* DH-O (Declared Deadhead to Origin Limit) */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            DH-O Limit (km)
                          </label>
                          <input
                            type="number"
                            value={newTruckForm.declaredDhO}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                declaredDhO: e.target.value,
                              })
                            }
                            placeholder="e.g. 100"
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                            min="0"
                          />
                          <p className="mt-1 text-xs text-[#064d51]/60">
                            Max distance to pickup
                          </p>
                        </div>

                        {/* DH-D (Declared Deadhead after Delivery Limit) */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            DH-D Limit (km)
                          </label>
                          <input
                            type="number"
                            value={newTruckForm.declaredDhD}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                declaredDhD: e.target.value,
                              })
                            }
                            placeholder="e.g. 100"
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                            min="0"
                          />
                          <p className="mt-1 text-xs text-[#064d51]/60">
                            Max distance after delivery
                          </p>
                        </div>

                        {/* F/P */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Full/Partial
                          </label>
                          <select
                            value={newTruckForm.fullPartial}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                fullPartial: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                          >
                            <option value="FULL">Full Load</option>
                            <option value="PARTIAL">Partial</option>
                          </select>
                        </div>

                        {/* Length */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Length (m)
                          </label>
                          <input
                            type="number"
                            value={newTruckForm.lengthM}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                lengthM: e.target.value,
                              })
                            }
                            placeholder="Available length"
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                          />
                        </div>

                        {/* Weight */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Weight (kg)
                          </label>
                          <input
                            type="number"
                            value={newTruckForm.weight}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                weight: e.target.value,
                              })
                            }
                            placeholder="Max capacity"
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                          />
                        </div>

                        {/* Contact Phone */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Contact Phone{" "}
                            <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={newTruckForm.contactPhone}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                contactPhone: e.target.value,
                              })
                            }
                            placeholder="+251-9xx-xxx-xxx"
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                          />
                        </div>
                      </div>

                      {/* Row 3: Comments */}
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Comments{" "}
                            <span className="text-gray-400">
                              ({newTruckForm.comments1.length}/70)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={newTruckForm.comments1}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                comments1: e.target.value.slice(0, 70),
                              })
                            }
                            placeholder="Additional notes for shippers..."
                            maxLength={70}
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                          />
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80 dark:text-gray-300">
                            Additional Comments{" "}
                            <span className="text-gray-400">
                              ({newTruckForm.comments2.length}/70)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={newTruckForm.comments2}
                            onChange={(e) =>
                              setNewTruckForm({
                                ...newTruckForm,
                                comments2: e.target.value.slice(0, 70),
                              })
                            }
                            placeholder="Special equipment, requirements..."
                            maxLength={70}
                            className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-800 dark:text-gray-100"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-end gap-3">
                      <button
                        onClick={() => {
                          resetNewTruckForm();
                          setShowNewTruckForm(false);
                        }}
                        className="rounded-lg border border-[#064d51]/30 px-6 py-2 font-medium text-[#064d51] transition-colors hover:bg-[#064d51]/5"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handlePostTruck}
                        disabled={
                          !newTruckForm.truckId ||
                          !newTruckForm.origin ||
                          !newTruckForm.availableFrom ||
                          !newTruckForm.contactPhone
                        }
                        className="rounded-lg bg-[#064d51] px-6 py-2 font-semibold text-white transition-colors hover:bg-[#053d40] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Post Truck
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Truck Posts Table */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
              <h3 className="flex items-center gap-2 text-lg font-bold text-white">
                <svg
                  className="h-5 w-5 text-teal-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                  />
                </svg>
                {trucks.length} Posted Trucks
              </h3>
              <span className="text-xs text-slate-300">
                Click a truck to see matching loads
              </span>
            </div>
            <DataTable
              columns={truckColumns}
              data={trucks}
              loading={loading}
              emptyMessage="No truck postings found. Click NEW TRUCK POST to create one."
              rowKey="id"
              expandable={true}
              expandedRowIds={editingTruckId ? [editingTruckId] : []}
              onRowClick={(truck) => {
                // Click row → switch to Matching Loads tab and fetch loads for THIS truck
                setSelectedTruckId(truck.id);
                setActiveMainTab("matching");
                fetchMatchingLoadsForTruck(truck.id);
              }}
              renderExpandedRow={(truck) => {
                const isEditing = editingTruckId === truck.id;

                // Only show expanded content when editing - action buttons are now in the row itself
                if (!isEditing) {
                  return null;
                }

                return (
                  <div id={`posting-${truck.id}`} className="p-4">
                    {/* Edit Mode - Professional Form Layout */}
                    <div className="space-y-4">
                      {/* Header with truck info */}
                      <div className="flex items-center justify-between border-b border-gray-200 pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
                            <span className="text-xl">🚛</span>
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-[#064d51]">
                              Edit Truck Posting
                            </h3>
                            <p className="text-xs text-[#064d51]/60">
                              {truck.truck?.licensePlate} •{" "}
                              {(truck.truck?.truckType || "N/A").replace(
                                "_",
                                " "
                              )}{" "}
                              •{" "}
                              {truck.truck?.capacity
                                ? `${truck.truck.capacity} kg`
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancelEdit();
                          }}
                          className="rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                        >
                          <span className="text-lg">✕</span>
                        </button>
                      </div>

                      {/* Form Grid */}
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-5 lg:grid-cols-10">
                        {/* Origin */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            Origin <span className="text-red-500">*</span>
                          </label>
                          <select
                            value={editForm.origin || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                origin: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                          >
                            <option value="">Select city</option>
                            {ethiopianCities.map((city: EthiopianCity) => (
                              <option key={city.id} value={city.id}>
                                {city.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Destination */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            Destination
                          </label>
                          <select
                            value={editForm.destination || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                destination: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                          >
                            <option value="">Anywhere</option>
                            {ethiopianCities.map((city: EthiopianCity) => (
                              <option key={city.id} value={city.id}>
                                {city.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Available From */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            From <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={editForm.availableFrom || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                availableFrom: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                          />
                        </div>

                        {/* Available To */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            Until
                          </label>
                          <input
                            type="date"
                            value={editForm.availableTo || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                availableTo: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                          />
                        </div>

                        {/* Full/Partial */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            Load Type
                          </label>
                          <select
                            value={editForm.fullPartial || "FULL"}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                fullPartial: e.target.value,
                              })
                            }
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                          >
                            <option value="FULL">Full</option>
                            <option value="PARTIAL">Partial</option>
                          </select>
                        </div>

                        {/* DH-O Limit */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            DH-O (km)
                          </label>
                          <input
                            type="number"
                            value={editForm.declaredDhO || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                declaredDhO: e.target.value,
                              })
                            }
                            placeholder="100"
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                            min="0"
                          />
                        </div>

                        {/* DH-D Limit */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            DH-D (km)
                          </label>
                          <input
                            type="number"
                            value={editForm.declaredDhD || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                declaredDhD: e.target.value,
                              })
                            }
                            placeholder="100"
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                            min="0"
                          />
                        </div>

                        {/* Length */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            Length (m)
                          </label>
                          <input
                            type="number"
                            value={editForm.lengthM || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                lengthM: e.target.value,
                              })
                            }
                            placeholder="12"
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                          />
                        </div>

                        {/* Weight */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            Weight (kg)
                          </label>
                          <input
                            type="number"
                            value={editForm.weight || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                weight: e.target.value,
                              })
                            }
                            placeholder="25000"
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                          />
                        </div>

                        {/* Contact Phone */}
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            Phone <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="tel"
                            value={editForm.contactPhone || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                contactPhone: e.target.value,
                              })
                            }
                            placeholder="+251 9XX"
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                          />
                        </div>
                      </div>

                      {/* Comments and Actions Row */}
                      <div className="flex items-end gap-4">
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            Comments{" "}
                            <span className="text-gray-400">
                              ({editForm.comments1?.length || 0}/70)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={editForm.comments1 || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                comments1: e.target.value.slice(0, 70),
                              })
                            }
                            placeholder="Additional notes..."
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                            maxLength={70}
                          />
                        </div>
                        <div className="flex-1">
                          <label className="mb-1 block text-xs font-medium text-[#064d51]/80">
                            Additional{" "}
                            <span className="text-gray-400">
                              ({editForm.comments2?.length || 0}/70)
                            </span>
                          </label>
                          <input
                            type="text"
                            value={editForm.comments2 || ""}
                            onChange={(e) =>
                              setEditForm({
                                ...editForm,
                                comments2: e.target.value.slice(0, 70),
                              })
                            }
                            placeholder="Special requirements..."
                            className="w-full rounded-md border border-[#064d51]/20 bg-white px-3 py-2 text-sm text-[#064d51] focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99]"
                            maxLength={70}
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancelEdit();
                            }}
                            className="rounded-md border border-[#064d51]/20 bg-white px-4 py-2 text-sm font-medium text-[#064d51]/80 transition-colors hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSaveEdit();
                            }}
                            className="rounded-md bg-[#1e9c99] px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#064d51]"
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }}
            />
          </div>
        </>
      )}

      {/* ============================================================ */}
      {/* TAB 2: MATCHING LOADS                                        */}
      {/* ============================================================ */}
      {activeMainTab === "matching" && (
        <>
          {/* Back Button + Selected Truck Info */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
            <button
              type="button"
              onClick={() => {
                setActiveMainTab("postings");
                setSelectedTruckId(null);
              }}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 transition-colors hover:text-sky-600"
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
                  d="M10 19l-7-7m0 0l7-7m-7 7h18"
                />
              </svg>
              ← Back to My Postings
            </button>
            {selectedTruckDetails ? (
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-sky-500 to-sky-700 text-xl text-white">
                  🚚
                </div>
                <div>
                  <div className="text-lg font-bold text-slate-900">
                    {selectedTruckDetails.truck?.licensePlate ||
                      "Unknown Truck"}
                  </div>
                  <div className="text-sm text-slate-500">
                    {(
                      selectedTruckDetails.truck?.truckType ||
                      selectedTruckDetails.truckType ||
                      "N/A"
                    ).replace("_", " ")}
                    {selectedTruckDetails.truck?.capacity &&
                      ` • ${Math.round(selectedTruckDetails.truck.capacity / 1000)}T`}
                    {" • "}
                    {selectedTruckDetails.originCity?.name || "N/A"} →{" "}
                    {selectedTruckDetails.destinationCity?.name || "Any"}
                    {selectedTruckDetails.availableFrom && (
                      <span className="ml-2 text-slate-400">
                        • Available{" "}
                        {new Date(
                          selectedTruckDetails.availableFrom
                        ).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                        {selectedTruckDetails.availableTo &&
                          ` - ${new Date(selectedTruckDetails.availableTo).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTruckId(null);
                    fetchAllMatchingLoads();
                  }}
                  className="ml-4 rounded-md px-3 py-1.5 text-sm text-sky-600 transition-colors hover:bg-sky-50 hover:text-sky-700"
                >
                  Show all trucks
                </button>
              </div>
            ) : (
              <div className="text-sm text-slate-500">
                Showing matches for all posted trucks
              </div>
            )}
          </div>

          {/* Matching Loads Section */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
            {/* Header with Total Count and Tabs */}
            <div className="flex items-center justify-between bg-gradient-to-r from-teal-600 to-teal-500 px-6 py-4">
              <div className="flex items-center gap-4">
                <h3 className="flex items-center gap-2 text-lg font-bold text-white">
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
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                  {filteredMatchingLoads.length} Matching Loads
                  {selectedTruckId && (
                    <span className="ml-2 text-sm font-normal text-teal-100">
                      (for selected truck)
                    </span>
                  )}
                </h3>
                {selectedTruckId && (
                  <button
                    onClick={() => {
                      setSelectedTruckId(null);
                      setExpandedTruckId(null);
                      fetchAllMatchingLoads();
                    }}
                    className="text-xs text-white/80 underline hover:text-white"
                  >
                    Show all loads
                  </button>
                )}
              </div>

              {/* Tabs on the right */}
              <div className="flex gap-2">
                <button
                  onClick={() => setActiveLoadTab("all")}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                    activeLoadTab === "all"
                      ? "bg-white text-teal-700"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  ALL
                </button>
                <button
                  onClick={() => setActiveLoadTab("preferred")}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                    activeLoadTab === "preferred"
                      ? "bg-white text-teal-700"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  PREFERRED
                </button>
                <button
                  onClick={() => setActiveLoadTab("blocked")}
                  className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                    activeLoadTab === "blocked"
                      ? "bg-white text-teal-700"
                      : "bg-white/20 text-white hover:bg-white/30"
                  }`}
                >
                  BLOCKED
                </button>
              </div>
            </div>

            {/* Matching Loads Table */}
            <div className="p-0">
              <DataTable
                columns={loadColumns}
                data={filteredMatchingLoads}
                loading={loadingMatches}
                emptyMessage="No matching loads found. Post a truck to see matching loads."
                rowKey="id"
              />
            </div>
          </div>
        </>
      )}

      {/* Sprint 18: Load Request Modal */}
      {requestModalOpen && selectedLoadForRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                <svg
                  className="h-5 w-5 text-teal-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                Request Load
              </h3>
              <button
                onClick={() => setRequestModalOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
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
              {/* Load Summary */}
              <div className="mb-4 rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-teal-50/30 p-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">
                      Route
                    </div>
                    <div className="font-semibold text-slate-800">
                      {selectedLoadForRequest.pickupCity} →{" "}
                      {selectedLoadForRequest.deliveryCity}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">
                      Shipper
                    </div>
                    <div className="font-semibold text-slate-800">
                      {selectedLoadForRequest.shipper?.name || "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">
                      Truck Type
                    </div>
                    <div className="font-semibold text-slate-800">
                      {selectedLoadForRequest.truckType?.replace("_", " ") ||
                        "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs font-medium text-slate-500">
                      Rate
                    </div>
                    <div className="font-semibold text-teal-600">
                      {selectedLoadForRequest.rate
                        ? `${selectedLoadForRequest.rate} ETB`
                        : "Negotiable"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Truck Selection */}
              <div className="mb-4">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Select Truck *
                </label>
                <select
                  value={selectedTruckForRequest}
                  onChange={(e) => setSelectedTruckForRequest(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 transition-all outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  <option value="">Select a truck...</option>
                  {getApprovedPostedTrucks().map((posting) => (
                    <option key={posting.truck?.id} value={posting.truck?.id}>
                      {posting.truck?.licensePlate} -{" "}
                      {posting.truck?.truckType?.replace("_", " ")} (
                      {posting.originCity?.name || "N/A"})
                    </option>
                  ))}
                </select>
                {getApprovedPostedTrucks().length === 0 && (
                  <p className="mt-1 text-xs text-rose-500">
                    No approved trucks with active postings. Please post a truck
                    first.
                  </p>
                )}
              </div>

              {/* Price Negotiation Info */}
              <div className="mb-4 rounded-xl border border-teal-200 bg-teal-50 p-3">
                <div className="flex items-start gap-2">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-teal-600"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <h4 className="text-sm font-semibold text-teal-800">
                      Price Negotiation
                    </h4>
                    <p className="mt-1 text-xs text-teal-700">
                      You will negotiate the freight rate directly with the
                      shipper after your request is approved. The platform only
                      charges a service fee based on distance.
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Message to Shipper{" "}
                  <span className="font-normal text-slate-400">(Optional)</span>
                </label>
                <textarea
                  value={requestNotes}
                  onChange={(e) => setRequestNotes(e.target.value)}
                  placeholder="Add any notes or special requirements..."
                  rows={3}
                  maxLength={500}
                  className="w-full resize-none rounded-xl border border-slate-200 px-4 py-2.5 transition-all outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                />
                <p className="mt-1 text-xs text-slate-400">
                  {requestNotes.length}/500
                </p>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setRequestModalOpen(false);
                    setSelectedLoadForRequest(null);
                  }}
                  disabled={submittingRequest}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitLoadRequest}
                  disabled={submittingRequest || !selectedTruckForRequest}
                  className="flex-1 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-2.5 font-medium text-white shadow-md shadow-teal-500/25 transition-all hover:from-teal-700 hover:to-teal-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submittingRequest ? "Sending..." : "Send Request"}
                </button>
              </div>

              <p className="mt-4 text-center text-xs text-slate-400">
                The shipper will review your request and can approve or reject
                it.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
