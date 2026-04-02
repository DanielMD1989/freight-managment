/**
 * Truck Types — Single Source of Truth
 *
 * ALL truck type definitions, compatibility groups, and helpers live here.
 * Every UI dropdown, API validation schema, and matching engine rule
 * must import from this file — never hardcode truck type arrays elsewhere.
 */

export const TRUCK_TYPES = [
  { value: "FLATBED", label: "Flatbed", group: "GENERAL" },
  { value: "REFRIGERATED", label: "Refrigerated", group: "COLD_CHAIN" },
  { value: "TANKER", label: "Tanker", group: "SPECIALIZED" },
  { value: "CONTAINER", label: "Container", group: "GENERAL" },
  { value: "DRY_VAN", label: "Dry Van", group: "GENERAL" },
  { value: "LOWBOY", label: "Lowboy", group: "HEAVY_EQUIPMENT" },
  { value: "DUMP_TRUCK", label: "Dump Truck", group: "BULK" },
  { value: "BOX_TRUCK", label: "Box Truck", group: "GENERAL" },
] as const;

export type TruckType = (typeof TRUCK_TYPES)[number]["value"];

/** Values array for Zod enum validation — derived from TRUCK_TYPES, never hardcode separately */
export const TRUCK_TYPE_VALUES = TRUCK_TYPES.map(
  (t) => t.value
) as unknown as readonly [TruckType, ...TruckType[]];

/**
 * Compatibility groups for Ethiopian freight matching.
 * Trucks in the same group can carry each other's loads.
 * Trucks in different groups are INCOMPATIBLE (hard filter in matching).
 *
 * GENERAL     — DRY_VAN, FLATBED, CONTAINER, BOX_TRUCK (enclosed/open general cargo)
 * COLD_CHAIN  — REFRIGERATED (temperature-controlled)
 * SPECIALIZED — TANKER (liquid/gas transport)
 * HEAVY_EQUIPMENT — LOWBOY (oversize/heavy machinery)
 * BULK        — DUMP_TRUCK (aggregate/construction material)
 */
export const TRUCK_TYPE_COMPATIBILITY: Record<string, readonly string[]> = {
  GENERAL: ["DRY_VAN", "FLATBED", "CONTAINER", "BOX_TRUCK"],
  COLD_CHAIN: ["REFRIGERATED"],
  SPECIALIZED: ["TANKER"],
  HEAVY_EQUIPMENT: ["LOWBOY"],
  BULK: ["DUMP_TRUCK"],
};

/** Get the compatibility group for a truck type, or null if unknown */
export function getTruckTypeGroup(truckType: string): string | null {
  const upper = truckType.toUpperCase();
  for (const [group, types] of Object.entries(TRUCK_TYPE_COMPATIBILITY)) {
    if (types.includes(upper)) return group;
  }
  return null;
}

/**
 * Check if two truck types are compatible for matching.
 * Returns "exact" (same type), "compatible" (same group), or "incompatible" (different groups).
 */
export function areTruckTypesCompatible(
  loadType: string,
  truckType: string
): "exact" | "compatible" | "incompatible" {
  const loadUpper = (loadType || "").toUpperCase();
  const truckUpper = (truckType || "").toUpperCase();

  if (loadUpper === truckUpper) return "exact";

  const loadGroup = getTruckTypeGroup(loadUpper);
  const truckGroup = getTruckTypeGroup(truckUpper);

  if (loadGroup && truckGroup && loadGroup === truckGroup) return "compatible";

  return "incompatible";
}
