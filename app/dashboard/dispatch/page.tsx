"use client";

import { useEffect, useState } from "react";

interface Load {
  id: string;
  origin: string;
  destination: string;
  pickupDate: string;
  truckType: string;
  rate: number;
  weight?: number;
  shipper: {
    name: string;
  };
}

interface Truck {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity: number;
  gpsDeviceId?: string;
  availabilityStatus: string;
  carrier: {
    name: string;
  };
}

export default function DispatchPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [loading, setLoading] = useState(true);
  const [dispatching, setDispatching] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [loadsRes, trucksRes] = await Promise.all([
        fetch("/api/loads?status=POSTED"),
        fetch("/api/trucks?availabilityStatus=AVAILABLE"),
      ]);

      if (loadsRes.ok) {
        const loadsData = await loadsRes.json();
        setLoads(loadsData.loads || []);
      }

      if (trucksRes.ok) {
        const trucksData = await trucksRes.json();
        setTrucks(trucksData.trucks || []);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDispatch = async () => {
    if (!selectedLoad || !selectedTruck) {
      alert("Please select both a load and a truck");
      return;
    }

    if (selectedLoad.truckType !== selectedTruck.truckType) {
      if (
        !confirm(
          `Truck type mismatch!\nLoad requires: ${selectedLoad.truckType}\nTruck is: ${selectedTruck.truckType}\n\nDo you want to continue anyway?`
        )
      ) {
        return;
      }
    }

    if (!selectedTruck.gpsDeviceId) {
      alert("This truck does not have a GPS device assigned. Please assign one first.");
      return;
    }

    setDispatching(true);
    try {
      const response = await fetch("/api/dispatch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          loadId: selectedLoad.id,
          truckId: selectedTruck.id,
        }),
      });

      if (response.ok) {
        alert("Load successfully dispatched!");
        setSelectedLoad(null);
        setSelectedTruck(null);
        fetchData(); // Refresh the lists
      } else {
        const data = await response.json();
        alert(data.error || "Failed to dispatch load");
      }
    } catch (error) {
      console.error("Failed to dispatch:", error);
      alert("Failed to dispatch load");
    } finally {
      setDispatching(false);
    }
  };

  const getCompatibilityBadge = () => {
    if (!selectedLoad || !selectedTruck) return null;

    const issues: string[] = [];

    if (selectedLoad.truckType !== selectedTruck.truckType) {
      issues.push("Truck type mismatch");
    }

    if (!selectedTruck.gpsDeviceId) {
      issues.push("No GPS device");
    }

    if (selectedLoad.weight && selectedLoad.weight > selectedTruck.capacity) {
      issues.push("Capacity exceeded");
    }

    if (issues.length === 0) {
      return (
        <div className="rounded-md bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            ✓ Compatible - Ready to dispatch
          </p>
        </div>
      );
    }

    return (
      <div className="rounded-md bg-yellow-50 p-4">
        <p className="text-sm font-medium text-yellow-800 mb-2">
          ⚠️ Compatibility Issues:
        </p>
        <ul className="list-disc list-inside text-sm text-yellow-700">
          {issues.map((issue, idx) => (
            <li key={idx}>{issue}</li>
          ))}
        </ul>
      </div>
    );
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dispatch Center</h1>
        <p className="mt-2 text-sm text-gray-600">
          Assign trucks to posted loads
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Available Loads */}
        <div className="lg:col-span-1">
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Available Loads ({loads.length})
              </h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {loads.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">
                  No posted loads available
                </p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {loads.map((load) => (
                    <button
                      key={load.id}
                      onClick={() => setSelectedLoad(load)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedLoad?.id === load.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        {load.origin} → {load.destination}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {load.shipper.name}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                        <span>{load.truckType.replace(/_/g, " ")}</span>
                        <span className="font-semibold text-blue-600">
                          ETB {load.rate.toLocaleString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Available Trucks */}
        <div className="lg:col-span-1">
          <div className="rounded-lg bg-white shadow">
            <div className="border-b border-gray-200 px-4 py-3">
              <h2 className="text-lg font-semibold text-gray-900">
                Available Trucks ({trucks.length})
              </h2>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {trucks.length === 0 ? (
                <p className="p-4 text-sm text-gray-500">
                  No available trucks
                </p>
              ) : (
                <div className="divide-y divide-gray-200">
                  {trucks.map((truck) => (
                    <button
                      key={truck.id}
                      onClick={() => setSelectedTruck(truck)}
                      className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${
                        selectedTruck?.id === truck.id ? "bg-blue-50" : ""
                      }`}
                    >
                      <div className="font-medium text-gray-900">
                        {truck.licensePlate}
                      </div>
                      <div className="mt-1 text-sm text-gray-600">
                        {truck.carrier.name}
                      </div>
                      <div className="mt-2 flex items-center justify-between text-xs">
                        <span className="text-gray-500">
                          {truck.truckType.replace(/_/g, " ")}
                        </span>
                        {truck.gpsDeviceId ? (
                          <span className="text-green-600">✓ GPS</span>
                        ) : (
                          <span className="text-red-600">✗ No GPS</span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Dispatch Panel */}
        <div className="lg:col-span-1">
          <div className="rounded-lg bg-white shadow p-6 sticky top-4">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Dispatch Details
            </h2>

            {!selectedLoad && !selectedTruck ? (
              <p className="text-sm text-gray-500">
                Select a load and a truck to dispatch
              </p>
            ) : (
              <div className="space-y-4">
                {/* Selected Load */}
                {selectedLoad && (
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-2 text-xs font-semibold text-gray-500 uppercase">
                      Selected Load
                    </div>
                    <div className="font-medium text-gray-900">
                      {selectedLoad.origin} → {selectedLoad.destination}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div>Shipper: {selectedLoad.shipper.name}</div>
                      <div>
                        Type: {selectedLoad.truckType.replace(/_/g, " ")}
                      </div>
                      {selectedLoad.weight && (
                        <div>Weight: {selectedLoad.weight.toLocaleString()} kg</div>
                      )}
                      <div>Rate: ETB {selectedLoad.rate.toLocaleString()}</div>
                      <div>
                        Pickup: {new Date(selectedLoad.pickupDate).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                )}

                {/* Selected Truck */}
                {selectedTruck && (
                  <div className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-2 text-xs font-semibold text-gray-500 uppercase">
                      Selected Truck
                    </div>
                    <div className="font-medium text-gray-900">
                      {selectedTruck.licensePlate}
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-gray-600">
                      <div>Carrier: {selectedTruck.carrier.name}</div>
                      <div>
                        Type: {selectedTruck.truckType.replace(/_/g, " ")}
                      </div>
                      <div>
                        Capacity: {selectedTruck.capacity.toLocaleString()} kg
                      </div>
                      <div>
                        GPS:{" "}
                        {selectedTruck.gpsDeviceId ? (
                          <span className="text-green-600">Assigned</span>
                        ) : (
                          <span className="text-red-600">Not assigned</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Compatibility Check */}
                {selectedLoad && selectedTruck && (
                  <div>{getCompatibilityBadge()}</div>
                )}

                {/* Dispatch Button */}
                {selectedLoad && selectedTruck && (
                  <button
                    onClick={handleDispatch}
                    disabled={dispatching}
                    className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
                  >
                    {dispatching ? "Dispatching..." : "Dispatch Load"}
                  </button>
                )}

                {/* Clear Selection */}
                {(selectedLoad || selectedTruck) && (
                  <button
                    onClick={() => {
                      setSelectedLoad(null);
                      setSelectedTruck(null);
                    }}
                    className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
                  >
                    Clear Selection
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
