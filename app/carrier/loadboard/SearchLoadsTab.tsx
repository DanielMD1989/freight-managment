"use client";

/**
 * SEARCH LOADS Tab Component - DAT Power Style
 *
 * Carrier interface for searching available loads
 * Sprint 14 - DAT-Style UI Transformation
 * Updated: Sprint 19 - Responsive DataTable integration
 */

import React, { useState, useEffect, useMemo } from "react";
import {
  AgeIndicator,
  SavedSearches,
  EditSearchModal,
} from "@/components/loadboard-ui";
import DataTable from "@/components/loadboard-ui/DataTable";
import {
  TableColumn,
  RowAction,
  StatusTab,
  SavedSearch,
  SavedSearchCriteria,
} from "@/types/loadboard-ui";
import LoadRequestModal from "./LoadRequestModal";
import { getCSRFToken } from "@/lib/csrfFetch";
import { TRUCK_TYPES } from "@/lib/constants/truckTypes";
import {
  CarrierUser,
  EthiopianCity,
  Load,
  LoadRequest,
  LoadFilterValues,
  TruckPosting,
} from "@/types/carrier-loadboard";

interface SearchLoadsTabProps {
  user: CarrierUser;
}

type ResultsFilter = "all" | "PREFERRED" | "BLOCKED";

export default function SearchLoadsTab({}: SearchLoadsTabProps) {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState<ResultsFilter>("all");
  const [ethiopianCities, setEthiopianCities] = useState<EthiopianCity[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [showSearchForm, setShowSearchForm] = useState(false);

  // Saved searches state
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string | null>(
    null
  );
  const [, setLoadingSavedSearches] = useState(false);
  const [editingSearch, setEditingSearch] = useState<SavedSearch | null>(null);

  // Load request modal state
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [pendingRequestLoadIds, setPendingRequestLoadIds] = useState<
    Set<string>
  >(new Set());

  // G-M16-2: Carrier's active truck postings for DH filter
  const [carrierPostings, setCarrierPostings] = useState<TruckPosting[]>([]);
  // G-W12-6: Wallet gate error
  const [walletError, setWalletError] = useState<string | null>(null);

  // Search form state
  const [filterValues, setFilterValues] = useState<LoadFilterValues>({
    truckType: "",
    truckTypeMode: "ANY",
    origin: "",
    destination: "",
    availDate: "",
    fullPartial: "",
    length: "",
    weight: "",
    truckPostingId: "",
  });

  /**
   * Fetch pending load requests to track button states
   */
  const fetchPendingLoadRequests = async () => {
    try {
      const response = await fetch("/api/load-requests?status=PENDING");
      if (response.ok) {
        const data = await response.json();
        const loadIds = new Set<string>(
          (data.loadRequests || []).map((req: LoadRequest) => req.loadId)
        );
        setPendingRequestLoadIds(loadIds);
      }
    } catch (error) {
      console.error("Failed to fetch pending load requests:", error);
    }
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

  useEffect(() => {
    fetchEthiopianCities();
    fetchSavedSearches();
    fetchPendingLoadRequests();
    // G-M16-2: Fetch carrier's active postings for DH selector
    fetchCarrierPostings();
  }, []);

  /**
   * Fetch carrier's active truck postings for DH filter selector
   */
  const fetchCarrierPostings = async () => {
    try {
      const response = await fetch(
        "/api/truck-postings?myPostings=true&status=ACTIVE&limit=50"
      );
      if (response.ok) {
        const data = await response.json();
        setCarrierPostings(data.postings || []);
      }
    } catch (error) {
      console.error("Failed to fetch carrier postings:", error);
    }
  };

  /**
   * Fetch saved searches for LOADS
   */
  const fetchSavedSearches = async () => {
    setLoadingSavedSearches(true);
    try {
      const response = await fetch("/api/saved-searches?type=LOADS");
      // L41 FIX: Check response.ok before parsing
      if (!response.ok) {
        console.error("Failed to fetch saved searches:", response.status);
        return;
      }
      const data = await response.json();
      setSavedSearches(data.searches || []);
    } catch (error) {
      console.error("Failed to fetch saved searches:", error);
    } finally {
      setLoadingSavedSearches(false);
    }
  };

  /**
   * Save current search criteria
   */
  const handleSaveSearch = async () => {
    const name = prompt("Enter a name for this search:");
    if (!name) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/saved-searches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          name,
          type: "LOADS",
          criteria: filterValues,
        }),
      });

      if (response.ok) {
        await fetchSavedSearches();
        alert("Search saved successfully!");
      } else {
        throw new Error("Failed to save search");
      }
    } catch (error) {
      console.error("Failed to save search:", error);
      alert("Failed to save search. Please try again.");
    }
  };

  /**
   * Select and apply a saved search
   */
  const handleSelectSavedSearch = (searchId: string) => {
    const search = savedSearches.find((s) => s.id === searchId);
    if (!search) return;

    // Apply saved criteria to filter values, mapping fields as needed
    const criteria = search.criteria || {};
    setFilterValues((prev) => ({
      ...prev,
      truckType: Array.isArray(criteria.truckType)
        ? criteria.truckType[0] || ""
        : criteria.truckType || "",
      origin: criteria.origin || "",
      destination: criteria.destination || "",
      fullPartial: criteria.fullPartial || "",
      weight: criteria.maxWeight?.toString() || "",
    }));
    setActiveSavedSearchId(searchId);

    // Automatically trigger search
    fetchLoads();
  };

  /**
   * Delete a saved search
   */
  const handleDeleteSavedSearch = async (searchId: string) => {
    if (!confirm("Are you sure you want to delete this saved search?")) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: "DELETE",
        headers: { ...(csrfToken && { "X-CSRF-Token": csrfToken }) },
      });

      if (response.ok) {
        await fetchSavedSearches();
        if (activeSavedSearchId === searchId) {
          setActiveSavedSearchId(null);
        }
      } else {
        throw new Error("Failed to delete search");
      }
    } catch (error) {
      console.error("Failed to delete search:", error);
      alert("Failed to delete search. Please try again.");
    }
  };

  /**
   * Edit a saved search - open modal
   */
  const handleEditSavedSearch = (searchId: string) => {
    const search = savedSearches.find((s) => s.id === searchId);
    if (!search) return;
    setEditingSearch(search);
  };

  /**
   * Handle saving edited search from modal
   */
  const handleSaveEditedSearch = async (
    id: string,
    updates: {
      name?: string;
      criteria?: SavedSearchCriteria;
      alertsEnabled?: boolean;
    }
  ) => {
    await updateSavedSearch(id, updates);
  };

  /**
   * Update saved search
   */
  const updateSavedSearch = async (
    searchId: string,
    updates: {
      name?: string;
      criteria?: SavedSearchCriteria;
      alertsEnabled?: boolean;
    }
  ) => {
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/saved-searches/${searchId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        await fetchSavedSearches();
      } else {
        throw new Error("Failed to update search");
      }
    } catch (error) {
      console.error("Failed to update search:", error);
      alert("Failed to update search. Please try again.");
    }
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (
    key: string,
    value: string | number | boolean
  ) => {
    setFilterValues({ ...filterValues, [key]: value });
  };

  /**
   * Handle filter reset
   */
  const handleFilterReset = () => {
    setFilterValues({
      truckType: "",
      truckTypeMode: "ANY",
      origin: "",
      destination: "",
      availDate: "",
      fullPartial: "",
      length: "",
      weight: "",
      truckPostingId: "",
    });
  };

  /**
   * Handle successful load request sent
   * L41 FIX: Refresh load list after request to get real server state
   */
  const handleLoadRequestSent = (loadId: string) => {
    setPendingRequestLoadIds((prev) => new Set([...prev, loadId]));
    // Refresh pending requests to ensure state is accurate
    fetchPendingLoadRequests();
  };

  /**
   * Fetch loads based on filters — DH filtering is now server-side via truckPostingId
   */
  const fetchLoads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("status", "POSTED,SEARCHING,OFFERED");

      if (filterValues.truckType) {
        params.append("truckType", filterValues.truckType);
      }
      if (filterValues.origin) {
        params.append("pickupCity", filterValues.origin);
      }
      if (filterValues.destination) {
        params.append("deliveryCity", filterValues.destination);
      }
      if (filterValues.availDate) {
        params.append("pickupFrom", filterValues.availDate);
      }
      if (filterValues.fullPartial) {
        params.append("fullPartial", filterValues.fullPartial);
      }
      if (filterValues.length) {
        params.append("minLength", filterValues.length);
      }
      if (filterValues.weight) {
        params.append("minWeight", filterValues.weight);
      }
      // G-M16-4: Pass truckPostingId for server-side DH filtering
      if (filterValues.truckPostingId) {
        params.append("truckPostingId", filterValues.truckPostingId);
      }

      const response = await fetch(`/api/loads?${params.toString()}`);
      if (response.status === 402) {
        const data = await response.json();
        setLoads([]);
        setWalletError(
          data.error ||
            "Insufficient wallet balance for marketplace access. Please top up your wallet."
        );
        return;
      }
      if (!response.ok) {
        throw new Error("Failed to fetch loads");
      }
      setWalletError(null);
      const data = await response.json();
      // Deduplicate loads by ID to prevent duplicates
      const loadMap = new Map<string, Load>();
      (data.loads || []).forEach((l: Load) => loadMap.set(l.id, l));
      setLoads(Array.from(loadMap.values()));
    } catch (error) {
      console.error("Failed to fetch loads:", error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Truck types list from shared constant (matches Prisma enum)
   */
  const truckTypes = useMemo(
    () =>
      TRUCK_TYPES.map((t) => ({
        value: t.value,
        label: t.label,
        code: t.value.slice(0, 2).toUpperCase(),
      })),
    []
  );

  /**
   * Get display label for truck type enum value
   */
  /**
   * Table columns configuration (memoized)
   */
  const columns: TableColumn[] = useMemo(() => {
    const getTruckTypeLabel = (
      enumValue: string | null | undefined
    ): string => {
      if (!enumValue) return "N/A";
      const found = truckTypes.find((t) => t.value === enumValue);
      return found ? found.label : enumValue.replace("_", " ");
    };
    return [
      {
        key: "age",
        label: "Age",
        width: "80px",
        render: (_: unknown, row: Load) => (
          <AgeIndicator date={row.postedAt || row.createdAt || ""} />
        ),
      },
      {
        key: "pickupDate",
        label: "Pickup",
        sortable: true,
        render: (value: string) =>
          value
            ? new Date(value).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            : "N/A",
      },
      {
        key: "truckType",
        label: "Truck",
        sortable: true,
        render: (value: string) => getTruckTypeLabel(value),
      },
      {
        key: "fullPartial",
        label: "F/P",
        width: "60px",
        align: "center" as const,
        render: (value: string) => (value === "FULL" ? "F" : "P"),
      },
      {
        key: "dhToOriginKm",
        label: "DH-O",
        width: "70px",
        sortable: true,
        align: "right" as const,
        render: (value: number) => (value ? `${value}km` : "—"),
      },
      {
        key: "pickupCity",
        label: "Origin",
        sortable: true,
        render: (value: string) => (
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {value || "N/A"}
          </span>
        ),
      },
      {
        key: "tripKm",
        label: "Trip",
        width: "70px",
        align: "right" as const,
        render: (value: number) => (value ? `${value}km` : "—"),
      },
      {
        key: "deliveryCity",
        label: "Destination",
        sortable: true,
        render: (value: string) => (
          <span className="font-medium text-slate-800 dark:text-slate-100">
            {value || "N/A"}
          </span>
        ),
      },
      {
        key: "dhAfterDeliveryKm",
        label: "DH-D",
        width: "70px",
        sortable: true,
        align: "right" as const,
        render: (value: number) => (value ? `${value}km` : "—"),
      },
      {
        key: "shipper",
        label: "Company",
        render: (_: unknown, row: Load) => (
          <span className="cursor-pointer font-medium text-teal-600 hover:underline dark:text-teal-400">
            {row.shipper?.name || "Anonymous"}
          </span>
        ),
      },
      {
        key: "weight",
        label: "Weight",
        width: "90px",
        align: "right" as const,
        sortable: true,
        render: (value: number) =>
          value ? `${value.toLocaleString()}kg` : "N/A",
      },
      {
        key: "shipperServiceFee",
        label: "Service Fee",
        width: "110px",
        align: "right" as const,
        sortable: true,
        render: (value: number, row: Load) => (
          <span className="font-medium text-teal-600 dark:text-teal-400">
            {value
              ? `${value.toLocaleString()} ETB`
              : row.tripKm
                ? `~${Math.round(row.tripKm * 15)} ETB`
                : "—"}
          </span>
        ),
      },
    ];
  }, [truckTypes]);

  /**
   * Table actions configuration (memoized)
   */
  const tableActions: RowAction[] = useMemo(
    () => [
      {
        key: "request",
        label: "Request",
        variant: "primary",
        icon: (
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
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
        ),
        onClick: (row: Load) => {
          setSelectedLoad(row);
          setShowRequestModal(true);
        },
        show: (row: Load) => !pendingRequestLoadIds.has(row.id),
      },
      {
        key: "pending",
        label: "Pending",
        variant: "secondary",
        disabled: true, // Status indicator - request already sent
        onClick: () => {}, // No action needed - just shows status
        show: (row: Load) => pendingRequestLoadIds.has(row.id),
      },
    ],
    [pendingRequestLoadIds]
  );

  /**
   * Results tabs configuration
   */
  const resultsTabs: StatusTab[] = [
    { key: "all", label: "ALL" },
    { key: "PREFERRED", label: "PREFERRED" },
    { key: "BLOCKED", label: "BLOCKED" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Search Loads</h2>
          <p className="text-sm text-slate-500">
            Find available loads matching your trucks
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowSearchForm(!showSearchForm)}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold shadow-sm transition-all ${
              showSearchForm
                ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
                : "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25 hover:from-teal-700 hover:to-teal-600"
            }`}
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            {showSearchForm ? "Hide Search" : "New Load Search"}
          </button>

          {showSearchForm && (
            <button
              onClick={handleSaveSearch}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
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
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Save Search
            </button>
          )}
        </div>
      </div>

      {/* Saved Searches Panel */}
      {savedSearches.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-teal-50/30 px-6 py-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <svg
                className="h-4 w-4 text-teal-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
                />
              </svg>
              Saved Searches ({savedSearches.length})
            </h3>
          </div>
          <div className="p-4">
            <SavedSearches
              searches={savedSearches}
              activeSearchId={activeSavedSearchId}
              onSelect={handleSelectSavedSearch}
              onDelete={handleDeleteSavedSearch}
              onEdit={handleEditSavedSearch}
              type="LOADS"
            />
          </div>
        </div>
      )}

      {/* Inline Search Form - Only show when toggled */}
      {showSearchForm && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          {/* Header Row */}
          <div className="grid grid-cols-12 gap-2 bg-gradient-to-r from-slate-800 to-slate-700 px-4 py-3 text-xs font-semibold text-white">
            <div>Truck</div>
            <div>Origin</div>
            <div>Destination</div>
            <div>Avail</div>
            <div className="col-span-2">Posting (DH Filter)</div>
            <div>F/P</div>
            <div>Length</div>
            <div>Weight</div>
            <div className="col-span-3"></div>
          </div>

          {/* Editable Search Row */}
          <div className="grid grid-cols-12 items-center gap-2 bg-gradient-to-r from-slate-50 to-teal-50/30 px-4 py-4 text-xs">
            {/* Truck Type with ANY/ONLY */}
            <div className="flex flex-col gap-1">
              <div className="flex gap-1">
                <button
                  onClick={() => handleFilterChange("truckTypeMode", "ANY")}
                  className={`flex-1 rounded-md px-2 py-0.5 text-xs font-bold transition-colors ${
                    filterValues.truckTypeMode === "ANY"
                      ? "bg-teal-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  ANY
                </button>
                <button
                  onClick={() => handleFilterChange("truckTypeMode", "ONLY")}
                  className={`flex-1 rounded-md px-2 py-0.5 text-xs font-bold transition-colors ${
                    filterValues.truckTypeMode === "ONLY"
                      ? "bg-teal-600 text-white"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  ONLY
                </button>
              </div>
              <select
                value={filterValues.truckType || ""}
                onChange={(e) =>
                  handleFilterChange("truckType", e.target.value)
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
              >
                <option value="">Select Type</option>
                {truckTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Origin */}
            <div>
              <select
                value={filterValues.origin || ""}
                onChange={(e) => handleFilterChange("origin", e.target.value)}
                disabled={loadingCities}
                className="w-full rounded border border-[#064d51]/20 bg-white px-2 py-1.5 text-xs"
                style={{ minHeight: "32px" }}
              >
                <option value="">
                  {loadingCities ? "Loading..." : "Any Origin"}
                </option>
                {ethiopianCities.map((city) => (
                  <option key={city.id} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Destination */}
            <div>
              <select
                value={filterValues.destination || ""}
                onChange={(e) =>
                  handleFilterChange("destination", e.target.value)
                }
                disabled={loadingCities}
                className="w-full rounded border border-[#064d51]/20 bg-white px-2 py-1.5 text-xs"
                style={{ minHeight: "32px" }}
              >
                <option value="">
                  {loadingCities ? "Loading..." : "Anywhere"}
                </option>
                {ethiopianCities.map((city) => (
                  <option key={city.id} value={city.name}>
                    {city.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Avail Date */}
            <div>
              <input
                type="date"
                value={filterValues.availDate || ""}
                onChange={(e) =>
                  handleFilterChange("availDate", e.target.value)
                }
                className="w-full rounded border border-[#064d51]/20 bg-white px-2 py-1 text-xs"
              />
            </div>

            {/* G-M16-3: TruckPosting selector for server-side DH filtering */}
            <div className="col-span-2">
              <select
                value={filterValues.truckPostingId || ""}
                onChange={(e) =>
                  handleFilterChange("truckPostingId", e.target.value)
                }
                className="w-full rounded border border-[#064d51]/20 bg-white px-2 py-1.5 text-xs"
                style={{ minHeight: "32px" }}
              >
                <option value="">No DH Filter</option>
                {carrierPostings.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.truck?.licensePlate ?? "Truck"} ({p.origin ?? "?"} →{" "}
                    {p.destination ?? "?"})
                  </option>
                ))}
              </select>
            </div>

            {/* F/P */}
            <div>
              <select
                value={filterValues.fullPartial || ""}
                onChange={(e) =>
                  handleFilterChange("fullPartial", e.target.value)
                }
                className="w-full rounded border border-[#064d51]/20 bg-white px-2 py-1 text-xs"
              >
                <option value="">Both</option>
                <option value="FULL">Full</option>
                <option value="PARTIAL">Partial</option>
              </select>
            </div>

            {/* Length */}
            <div>
              <input
                type="number"
                value={filterValues.length || ""}
                onChange={(e) => handleFilterChange("length", e.target.value)}
                placeholder="m"
                className="w-full rounded border border-[#064d51]/20 bg-white px-2 py-1 text-xs"
              />
            </div>

            {/* Weight */}
            <div>
              <input
                type="number"
                value={filterValues.weight || ""}
                onChange={(e) => handleFilterChange("weight", e.target.value)}
                placeholder="kg"
                className="w-full rounded border border-[#064d51]/20 bg-white px-2 py-1 text-xs"
              />
            </div>

            {/* Action Buttons */}
            <div className="col-span-3 flex justify-end gap-2">
              <button
                onClick={fetchLoads}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:from-teal-700 hover:to-teal-600"
              >
                <svg
                  className="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Search
              </button>
              <button
                onClick={handleFilterReset}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Wallet Gate Warning */}
      {walletError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center gap-3">
            <svg
              className="h-5 w-5 flex-shrink-0 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                {walletError}
              </p>
              <a
                href="/carrier/wallet"
                className="mt-1 inline-block text-sm text-teal-600 underline hover:text-teal-700"
              >
                Go to Wallet →
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Results Section Header */}
      <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-teal-600 to-teal-500 px-4 py-3">
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
          {loads.length} {loads.length === 1 ? "Load" : "Loads"} Found
        </h3>
        <div className="flex gap-2">
          {resultsTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as ResultsFilter)}
              className={`rounded-lg px-4 py-1.5 text-xs font-bold transition-colors ${
                activeFilter === tab.key
                  ? "bg-white text-teal-700"
                  : "bg-white/20 text-white hover:bg-white/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results Table - Responsive DataTable */}
      <DataTable
        columns={columns}
        data={loads}
        loading={loading}
        actions={tableActions}
        rowKey="id"
        responsiveCardView={true}
        cardTitleColumn="pickupCity"
        cardSubtitleColumn="deliveryCity"
        emptyMessage="No loads found. Try adjusting your search filters."
        className="rounded-t-none"
      />

      {/* Edit Search Modal */}
      <EditSearchModal
        search={editingSearch}
        isOpen={!!editingSearch}
        onClose={() => setEditingSearch(null)}
        onSave={handleSaveEditedSearch}
        cities={ethiopianCities.map((city) => ({
          name: city.name,
          region: city.region,
        }))}
        type="LOADS"
      />

      {/* Load Request Modal */}
      <LoadRequestModal
        isOpen={showRequestModal}
        onClose={() => {
          setShowRequestModal(false);
          setSelectedLoad(null);
        }}
        load={selectedLoad}
        onRequestSent={handleLoadRequestSent}
      />
    </div>
  );
}
