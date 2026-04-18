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

type TruckStatus = "POSTED" | "UNPOSTED" | "MATCHED" | "EXPIRED";
// Matching Loads tab removed — it was a passive read-only list with no actions.

export default function PostTrucksTab({ user }: PostTrucksTabProps) {
  const [trucks, setTrucks] = useState<TruckWithPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<TruckStatus>("POSTED");
  // Tab state removed — only "postings" tab remains
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [, setExpandedTruckId] = useState<string | null>(null);
  // matchingLoads state removed — Matching Loads tab deleted
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TruckPostingUpdatePayload>({});
  // loadingMatches removed
  const [showNewTruckForm, setShowNewTruckForm] = useState(false);

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

  // Load request modal moved to SearchLoadsTab — removed from here

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

  // fetchExistingRequests removed — load requests handled in SearchLoadsTab

  useEffect(() => {
    fetchEthiopianCities();
    fetchApprovedTrucks();
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

      // Batch fetch match counts (single request instead of N+1)
      const activePostingIds = trucksData
        .filter(
          (t: TruckWithPosting) =>
            t.status === "POSTED" || t.status === "ACTIVE"
        )
        .map((t: TruckWithPosting) => t.id);

      let truckMatchCounts: Record<string, number> = {};
      if (activePostingIds.length > 0) {
        try {
          const csrfToken = await getCSRFToken();
          const batchRes = await fetch(
            "/api/truck-postings/batch-match-counts",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(csrfToken && { "X-CSRF-Token": csrfToken }),
              },
              credentials: "include",
              body: JSON.stringify({ postingIds: activePostingIds }),
            }
          );
          if (batchRes.status === 402) {
            const errData = await batchRes.json();
            toast.error(
              errData.error ||
                "Insufficient wallet balance for marketplace access."
            );
          } else if (batchRes.ok) {
            const batchData = await batchRes.json();
            truckMatchCounts = batchData.counts || {};
          }
        } catch {
          // Fallback: all counts stay 0
        }
      }

      const trucksWithMatchCounts = trucksData.map(
        (truck: TruckWithPosting) => ({
          ...truck,
          matchCount: truckMatchCounts[truck.id] || 0,
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
        MATCHED: 0,
        EXPIRED: 0,
      };

      // Fetch POSTED (ACTIVE), MATCHED, and EXPIRED counts from truck-postings API
      const postingStatusPromises = [
        { key: "POSTED", apiStatus: "ACTIVE" },
        { key: "MATCHED", apiStatus: "MATCHED" },
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

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

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
   * Status tabs configuration - Active, Active Trips, Unposted, Expired
   */
  const statusTabs: StatusTab[] = [
    { key: "POSTED", label: "Active", count: statusCounts.POSTED },
    { key: "MATCHED", label: "Active Trips", count: statusCounts.MATCHED },
    { key: "UNPOSTED", label: "Unposted", count: statusCounts.UNPOSTED },
    { key: "EXPIRED", label: "Expired", count: statusCounts.EXPIRED },
  ];

  // Load request modal + handleOpenRequestModal + handleSubmitLoadRequest
  // removed — load requests are handled in SearchLoadsTab

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
   * Matching loads table columns — removed (tab deleted)
   */

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

      // Convert date-only inputs (from <input type="date">) to ISO datetimes.
      // The PATCH /api/truck-postings/[id] schema requires z.string().datetime()
      // which mandates full ISO 8601 with a time component. Sending the bare
      // "YYYY-MM-DD" string fails Zod validation → 400 → "Failed to update
      // truck posting" toast. (Mirror of the shipper loadboard fix.)
      const toIsoDateTime = (
        dateOnly: string | undefined
      ): string | undefined => {
        if (!dateOnly) return undefined;
        // already an ISO datetime?
        if (dateOnly.includes("T")) return dateOnly;
        return new Date(`${dateOnly}T00:00:00`).toISOString();
      };

      // Build update payload
      const updatePayload: TruckPostingUpdatePayload = {
        availableFrom: toIsoDateTime(editForm.availableFrom),
        availableTo: toIsoDateTime(editForm.availableTo),
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

      if (!response.ok) {
        // Surface the actual API error so the user sees what failed
        const body = await response.json().catch(() => ({}));
        const message =
          body.error ||
          (body.details && JSON.stringify(body.details)) ||
          "Failed to update truck posting";
        throw new Error(message);
      }

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
  return (
    <div className="space-y-4 pt-6">
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

      {/* New Truck Posting Form — Modal Overlay */}
      {showNewTruckForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => {
            resetNewTruckForm();
            setShowNewTruckForm(false);
          }}
        >
          <div
            className="w-full max-w-3xl overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-teal-50/30 px-6 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
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
                  <h3 className="text-base font-semibold text-slate-800 dark:text-white">
                    Create New Truck Posting
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    List your truck for available loads
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  resetNewTruckForm();
                  setShowNewTruckForm(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300"
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
                            No approved trucks found. Please add and get a truck
                            approved in{" "}
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
                          Available From <span className="text-red-500">*</span>
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
                        <p className="mt-1 text-xs text-[#064d51]/60 dark:text-slate-400">
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
                        <p className="mt-1 text-xs text-[#064d51]/60 dark:text-slate-400">
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
                          Contact Phone <span className="text-red-500">*</span>
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
                      className="rounded-lg border border-[#064d51]/30 px-6 py-2 font-medium text-[#064d51] transition-colors hover:bg-[#064d51]/5 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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
                      className="rounded-lg bg-teal-600 px-6 py-2 font-semibold text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Post Truck
                    </button>
                  </div>
                </>
              )}
            </div>
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
            setSelectedTruckId(selectedTruckId === truck.id ? null : truck.id);
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
                          {(truck.truck?.truckType || "N/A").replace("_", " ")}{" "}
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
      {/* Matching Loads tab removed — load requests handled in SearchLoadsTab */}
    </div>
  );
}
