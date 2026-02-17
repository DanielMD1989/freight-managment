"use client";

/**
 * Corridor Management Client Component
 *
 * Service Fee Implementation - Task 3: Admin UI
 *
 * CRUD operations for corridor pricing with separate shipper/carrier rates
 */

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";

interface Corridor {
  id: string;
  name: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: number;
  direction: "ONE_WAY" | "ROUND_TRIP" | "BIDIRECTIONAL";
  isActive: boolean;
  createdAt: string;
  loadsCount: number;
  // Shipper pricing
  shipperPricePerKm: number;
  shipperPromoFlag: boolean;
  shipperPromoPct: number | null;
  // Carrier pricing
  carrierPricePerKm: number;
  carrierPromoFlag: boolean;
  carrierPromoPct: number | null;
  // Fee preview
  feePreview: {
    shipper: { baseFee: number; discount: number; finalFee: number };
    carrier: { baseFee: number; discount: number; finalFee: number };
    totalPlatformFee: number;
  };
  // Legacy
  pricePerKm: number;
  promoFlag: boolean;
  promoDiscountPct: number | null;
}

interface CorridorFormData {
  name: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: string;
  direction: "ONE_WAY" | "ROUND_TRIP" | "BIDIRECTIONAL";
  // Shipper pricing
  shipperPricePerKm: string;
  shipperPromoFlag: boolean;
  shipperPromoPct: string;
  // Carrier pricing
  carrierPricePerKm: string;
  carrierPromoFlag: boolean;
  carrierPromoPct: string;
  isActive: boolean;
}

const ETHIOPIAN_REGIONS = [
  "Addis Ababa",
  "Afar",
  "Amhara",
  "Benishangul-Gumuz",
  "Dire Dawa",
  "Gambela",
  "Harari",
  "Oromia",
  "Sidama",
  "Somali",
  "Southern Nations, Nationalities, and Peoples",
  "Southwest Ethiopia",
  "Tigray",
  "Djibouti",
];

const DIRECTION_LABELS = {
  ONE_WAY: "One Way",
  ROUND_TRIP: "Round Trip",
  BIDIRECTIONAL: "Bidirectional",
};

const initialFormData: CorridorFormData = {
  name: "",
  originRegion: "",
  destinationRegion: "",
  distanceKm: "",
  direction: "ONE_WAY",
  shipperPricePerKm: "2.50",
  shipperPromoFlag: false,
  shipperPromoPct: "",
  carrierPricePerKm: "1.50",
  carrierPromoFlag: false,
  carrierPromoPct: "",
  isActive: true,
};

export default function CorridorManagementClient() {
  const [corridors, setCorridors] = useState<Corridor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingCorridor, setEditingCorridor] = useState<Corridor | null>(null);
  const [formData, setFormData] = useState<CorridorFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [filterActive, setFilterActive] = useState<
    "all" | "active" | "inactive"
  >("all");

  // Fetch corridors
  const fetchCorridors = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterActive === "active") params.set("isActive", "true");
      if (filterActive === "inactive") params.set("isActive", "false");

      const response = await fetch(`/api/admin/corridors?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch corridors");

      const data = await response.json();
      setCorridors(data.corridors);
    } catch (error) {
      console.error("Error fetching corridors:", error);
      toast.error("Failed to load corridors");
    } finally {
      setLoading(false);
    }
  }, [filterActive, toast]);

  useEffect(() => {
    fetchCorridors();
  }, [fetchCorridors]);

  // Handle form input changes
  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? (e.target as HTMLInputElement).checked : value,
    }));
  };

  // Auto-generate name when regions change
  useEffect(() => {
    if (
      formData.originRegion &&
      formData.destinationRegion &&
      !editingCorridor
    ) {
      setFormData((prev) => ({
        ...prev,
        name: `${formData.originRegion} - ${formData.destinationRegion}`,
      }));
    }
  }, [formData.originRegion, formData.destinationRegion, editingCorridor]);

  // UI-ONLY PREVIEW — NOT AUTHORITATIVE
  //
  // This is a client-side preview for immediate form feedback only.
  // AUTHORITATIVE fee calculation is in lib/serviceFeeCalculation.ts (server-side).
  // The actual fee charged is always computed server-side via the API.
  //
  // Formula mirrors: baseFee = distance × pricePerKm, discount = baseFee × (promoPct / 100)
  const calculatePartyFee = (
    pricePerKm: string,
    promoFlag: boolean,
    promoPct: string
  ) => {
    const distance = parseFloat(formData.distanceKm) || 0;
    const price = parseFloat(pricePerKm) || 0;
    const baseFee = distance * price;
    const discount =
      promoFlag && promoPct ? baseFee * (parseFloat(promoPct) / 100) : 0;
    return {
      baseFee: baseFee.toFixed(2),
      discount: discount.toFixed(2),
      finalFee: (baseFee - discount).toFixed(2),
    };
  };

  // Open create modal
  const handleCreate = () => {
    setEditingCorridor(null);
    setFormData(initialFormData);
    setShowModal(true);
  };

  // Open edit modal
  const handleEdit = (corridor: Corridor) => {
    setEditingCorridor(corridor);
    setFormData({
      name: corridor.name,
      originRegion: corridor.originRegion,
      destinationRegion: corridor.destinationRegion,
      distanceKm: corridor.distanceKm.toString(),
      direction: corridor.direction,
      shipperPricePerKm: corridor.shipperPricePerKm.toString(),
      shipperPromoFlag: corridor.shipperPromoFlag,
      shipperPromoPct: corridor.shipperPromoPct?.toString() || "",
      carrierPricePerKm: corridor.carrierPricePerKm.toString(),
      carrierPromoFlag: corridor.carrierPromoFlag,
      carrierPromoPct: corridor.carrierPromoPct?.toString() || "",
      isActive: corridor.isActive,
    });
    setShowModal(true);
  };

  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        name: formData.name,
        originRegion: formData.originRegion,
        destinationRegion: formData.destinationRegion,
        distanceKm: parseFloat(formData.distanceKm),
        direction: formData.direction,
        // Shipper pricing
        shipperPricePerKm: parseFloat(formData.shipperPricePerKm),
        shipperPromoFlag: formData.shipperPromoFlag,
        shipperPromoPct: formData.shipperPromoPct
          ? parseFloat(formData.shipperPromoPct)
          : null,
        // Carrier pricing
        carrierPricePerKm: parseFloat(formData.carrierPricePerKm),
        carrierPromoFlag: formData.carrierPromoFlag,
        carrierPromoPct: formData.carrierPromoPct
          ? parseFloat(formData.carrierPromoPct)
          : null,
        isActive: formData.isActive,
      };

      const url = editingCorridor
        ? `/api/admin/corridors/${editingCorridor.id}`
        : "/api/admin/corridors";

      const csrfToken = await getCSRFToken();
      const response = await fetch(url, {
        method: editingCorridor ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || "Operation failed");
      }

      toast.success(editingCorridor ? "Corridor updated" : "Corridor created");
      setShowModal(false);
      fetchCorridors();
    } catch (error) {
      console.error("Error saving corridor:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save corridor"
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle corridor active status
  const handleToggleActive = async (corridor: Corridor) => {
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/admin/corridors/${corridor.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({ isActive: !corridor.isActive }),
      });

      if (!response.ok) throw new Error("Failed to update corridor");

      toast.success(
        `Corridor ${corridor.isActive ? "deactivated" : "activated"}`
      );
      fetchCorridors();
    } catch (error) {
      console.error("Error toggling corridor:", error);
      toast.error("Failed to update corridor");
    }
  };

  const shipperPreview = calculatePartyFee(
    formData.shipperPricePerKm,
    formData.shipperPromoFlag,
    formData.shipperPromoPct
  );
  const carrierPreview = calculatePartyFee(
    formData.carrierPricePerKm,
    formData.carrierPromoFlag,
    formData.carrierPromoPct
  );
  const totalPlatformFee = (
    parseFloat(shipperPreview.finalFee) + parseFloat(carrierPreview.finalFee)
  ).toFixed(2);

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg border border-[#064d51]/10 bg-white p-4 shadow">
          <p className="text-sm text-[#064d51]/70">Total Corridors</p>
          <p className="text-2xl font-bold text-[#064d51]">
            {corridors.length}
          </p>
        </div>
        <div className="rounded-lg border border-[#064d51]/10 bg-white p-4 shadow">
          <p className="text-sm text-[#064d51]/70">Active</p>
          <p className="text-2xl font-bold text-[#1e9c99]">
            {corridors.filter((c) => c.isActive).length}
          </p>
        </div>
        <div className="rounded-lg border border-[#064d51]/10 bg-white p-4 shadow">
          <p className="text-sm text-[#064d51]/70">With Promo</p>
          <p className="text-2xl font-bold text-blue-600">
            {
              corridors.filter((c) => c.shipperPromoFlag || c.carrierPromoFlag)
                .length
            }
          </p>
        </div>
        <div className="rounded-lg border border-[#064d51]/10 bg-white p-4 shadow">
          <p className="text-sm text-[#064d51]/70">Total Loads</p>
          <p className="text-2xl font-bold text-purple-600">
            {corridors.reduce((sum, c) => sum + c.loadsCount, 0)}
          </p>
        </div>
      </div>

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <select
            value={filterActive}
            onChange={(e) =>
              setFilterActive(e.target.value as "all" | "active" | "inactive")
            }
            className="rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-[#064d51]"
          >
            <option value="all">All Status</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </div>
        <button
          onClick={handleCreate}
          className="rounded-lg bg-[#1e9c99] px-4 py-2 font-medium text-white hover:bg-[#178784]"
        >
          + Add Corridor
        </button>
      </div>

      {/* Corridors Table */}
      <div className="overflow-hidden rounded-lg border border-[#064d51]/10 bg-white shadow">
        {loading ? (
          <div className="p-8 text-center text-[#064d51]/60">
            Loading corridors...
          </div>
        ) : corridors.length === 0 ? (
          <div className="p-8 text-center text-[#064d51]/60">
            No corridors found. Create your first corridor to start charging
            service fees.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[#064d51]/10">
              <thead className="bg-[#f0fdfa]">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">
                    Corridor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">
                    Distance
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">
                    Shipper Fee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">
                    Carrier Fee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">
                    Total Platform
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-[#064d51]/70 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-[#064d51]/70 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#064d51]/10">
                {corridors.map((corridor) => (
                  <tr key={corridor.id} className="hover:bg-[#f0fdfa]/50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#064d51]">
                        {corridor.name}
                      </div>
                      <div className="text-sm text-[#064d51]/60">
                        {corridor.originRegion} → {corridor.destinationRegion}
                      </div>
                      <div className="mt-1 text-xs text-[#064d51]/50">
                        {DIRECTION_LABELS[corridor.direction]} |{" "}
                        {corridor.loadsCount} loads
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#064d51]">
                      {corridor.distanceKm.toLocaleString()} km
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#064d51]">
                        {corridor.feePreview.shipper.finalFee.toLocaleString()}{" "}
                        ETB
                      </div>
                      <div className="text-xs text-[#064d51]/60">
                        {corridor.shipperPricePerKm.toFixed(2)} ETB/km
                      </div>
                      {corridor.shipperPromoFlag &&
                        corridor.shipperPromoPct && (
                          <div className="text-xs text-green-600">
                            -{corridor.shipperPromoPct}% promo
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#064d51]">
                        {corridor.feePreview.carrier.finalFee.toLocaleString()}{" "}
                        ETB
                      </div>
                      <div className="text-xs text-[#064d51]/60">
                        {corridor.carrierPricePerKm.toFixed(2)} ETB/km
                      </div>
                      {corridor.carrierPromoFlag &&
                        corridor.carrierPromoPct && (
                          <div className="text-xs text-green-600">
                            -{corridor.carrierPromoPct}% promo
                          </div>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-bold text-[#1e9c99]">
                        {corridor.feePreview.totalPlatformFee.toLocaleString()}{" "}
                        ETB
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-1 text-xs ${
                          corridor.isActive
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {corridor.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => handleEdit(corridor)}
                          className="rounded bg-[#1e9c99]/10 px-3 py-1 text-sm text-[#1e9c99] hover:bg-[#1e9c99]/20"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleActive(corridor)}
                          className={`rounded px-3 py-1 text-sm ${
                            corridor.isActive
                              ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              : "bg-green-100 text-green-700 hover:bg-green-200"
                          }`}
                        >
                          {corridor.isActive ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
            <div className="border-b border-[#064d51]/10 p-6">
              <h2 className="text-xl font-bold text-[#064d51]">
                {editingCorridor ? "Edit Corridor" : "Create Corridor"}
              </h2>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 p-6">
              {/* Route */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]">
                    Origin Region *
                  </label>
                  <select
                    name="originRegion"
                    value={formData.originRegion}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-[#064d51]"
                  >
                    <option value="">Select origin...</option>
                    {ETHIOPIAN_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]">
                    Destination Region *
                  </label>
                  <select
                    name="destinationRegion"
                    value={formData.destinationRegion}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-[#064d51]"
                  >
                    <option value="">Select destination...</option>
                    {ETHIOPIAN_REGIONS.map((region) => (
                      <option key={region} value={region}>
                        {region}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Name & Direction & Distance */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]">
                    Corridor Name *
                  </label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    placeholder="e.g., Addis Ababa - Dire Dawa"
                    className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-[#064d51]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]">
                    Direction *
                  </label>
                  <select
                    name="direction"
                    value={formData.direction}
                    onChange={handleInputChange}
                    required
                    className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-[#064d51]"
                  >
                    <option value="ONE_WAY">One Way</option>
                    <option value="ROUND_TRIP">Round Trip</option>
                    <option value="BIDIRECTIONAL">Bidirectional</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-[#064d51]">
                    Distance (km) *
                  </label>
                  <input
                    type="number"
                    name="distanceKm"
                    value={formData.distanceKm}
                    onChange={handleInputChange}
                    required
                    min="1"
                    step="0.1"
                    placeholder="e.g., 453"
                    className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-[#064d51]"
                  />
                </div>
              </div>

              {/* Shipper Pricing */}
              <div className="space-y-4 rounded-lg bg-blue-50 p-4">
                <h3 className="flex items-center gap-2 font-semibold text-[#064d51]">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-500 text-xs text-white">
                    S
                  </span>
                  Shipper Service Fee
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#064d51]">
                      Price per KM (ETB) *
                    </label>
                    <input
                      type="number"
                      name="shipperPricePerKm"
                      value={formData.shipperPricePerKm}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g., 2.50"
                      className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-[#064d51]"
                    />
                  </div>
                  <div className="flex items-center gap-3 md:col-span-2">
                    <input
                      type="checkbox"
                      id="shipperPromoFlag"
                      name="shipperPromoFlag"
                      checked={formData.shipperPromoFlag}
                      onChange={handleInputChange}
                      className="h-4 w-4 rounded border-[#064d51]/30 text-[#1e9c99]"
                    />
                    <label
                      htmlFor="shipperPromoFlag"
                      className="text-sm font-medium text-[#064d51]"
                    >
                      Promo discount
                    </label>
                    {formData.shipperPromoFlag && (
                      <input
                        type="number"
                        name="shipperPromoPct"
                        value={formData.shipperPromoPct}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="%"
                        className="w-20 rounded-lg border border-[#064d51]/20 bg-white px-2 py-1 text-sm text-[#064d51]"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Carrier Pricing */}
              <div className="space-y-4 rounded-lg bg-purple-50 p-4">
                <h3 className="flex items-center gap-2 font-semibold text-[#064d51]">
                  <span className="flex h-6 w-6 items-center justify-center rounded bg-purple-500 text-xs text-white">
                    C
                  </span>
                  Carrier Service Fee
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-[#064d51]">
                      Price per KM (ETB) *
                    </label>
                    <input
                      type="number"
                      name="carrierPricePerKm"
                      value={formData.carrierPricePerKm}
                      onChange={handleInputChange}
                      required
                      min="0"
                      step="0.01"
                      placeholder="e.g., 1.50"
                      className="w-full rounded-lg border border-[#064d51]/20 bg-white px-3 py-2 text-[#064d51]"
                    />
                  </div>
                  <div className="flex items-center gap-3 md:col-span-2">
                    <input
                      type="checkbox"
                      id="carrierPromoFlag"
                      name="carrierPromoFlag"
                      checked={formData.carrierPromoFlag}
                      onChange={handleInputChange}
                      className="h-4 w-4 rounded border-[#064d51]/30 text-[#1e9c99]"
                    />
                    <label
                      htmlFor="carrierPromoFlag"
                      className="text-sm font-medium text-[#064d51]"
                    >
                      Promo discount
                    </label>
                    {formData.carrierPromoFlag && (
                      <input
                        type="number"
                        name="carrierPromoPct"
                        value={formData.carrierPromoPct}
                        onChange={handleInputChange}
                        min="0"
                        max="100"
                        step="0.1"
                        placeholder="%"
                        className="w-20 rounded-lg border border-[#064d51]/20 bg-white px-2 py-1 text-sm text-[#064d51]"
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Active */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="isActive"
                  name="isActive"
                  checked={formData.isActive}
                  onChange={handleInputChange}
                  className="h-4 w-4 rounded border-[#064d51]/30 text-[#1e9c99]"
                />
                <label
                  htmlFor="isActive"
                  className="text-sm font-medium text-[#064d51]"
                >
                  Corridor is active
                </label>
              </div>

              {/* Fee Preview */}
              {formData.distanceKm &&
                (formData.shipperPricePerKm || formData.carrierPricePerKm) && (
                  <div className="rounded-lg border border-[#1e9c99]/20 bg-[#f0fdfa] p-4">
                    <h3 className="mb-3 font-medium text-[#064d51]">
                      Service Fee Preview
                    </h3>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                      {/* Shipper Fee */}
                      <div className="rounded-lg border border-blue-200 bg-white p-3">
                        <div className="mb-1 text-xs font-medium text-blue-600">
                          Shipper Fee
                        </div>
                        <div className="text-lg font-bold text-[#064d51]">
                          {shipperPreview.finalFee} ETB
                        </div>
                        {formData.shipperPromoFlag &&
                          parseFloat(shipperPreview.discount) > 0 && (
                            <div className="text-xs text-green-600">
                              -{shipperPreview.discount} ETB discount
                            </div>
                          )}
                      </div>
                      {/* Carrier Fee */}
                      <div className="rounded-lg border border-purple-200 bg-white p-3">
                        <div className="mb-1 text-xs font-medium text-purple-600">
                          Carrier Fee
                        </div>
                        <div className="text-lg font-bold text-[#064d51]">
                          {carrierPreview.finalFee} ETB
                        </div>
                        {formData.carrierPromoFlag &&
                          parseFloat(carrierPreview.discount) > 0 && (
                            <div className="text-xs text-green-600">
                              -{carrierPreview.discount} ETB discount
                            </div>
                          )}
                      </div>
                      {/* Total Platform */}
                      <div className="rounded-lg border border-[#1e9c99]/30 bg-[#1e9c99]/10 p-3">
                        <div className="mb-1 text-xs font-medium text-[#1e9c99]">
                          Total Platform Revenue
                        </div>
                        <div className="text-xl font-bold text-[#1e9c99]">
                          {totalPlatformFee} ETB
                        </div>
                        <div className="text-xs text-[#064d51]/60">
                          per trip
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Actions */}
              <div className="flex justify-end gap-3 border-t border-[#064d51]/10 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg bg-gray-100 px-4 py-2 text-[#064d51] hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-lg bg-[#1e9c99] px-4 py-2 text-white hover:bg-[#178784] disabled:opacity-50"
                >
                  {submitting
                    ? "Saving..."
                    : editingCorridor
                      ? "Update Corridor"
                      : "Create Corridor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
