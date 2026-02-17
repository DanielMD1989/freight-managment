export const TRUCK_TYPES = [
  { value: "FLATBED", label: "Flatbed" },
  { value: "REFRIGERATED", label: "Refrigerated" },
  { value: "TANKER", label: "Tanker" },
  { value: "CONTAINER", label: "Container" },
  { value: "DRY_VAN", label: "Dry Van" },
  { value: "LOWBOY", label: "Lowboy" },
  { value: "DUMP_TRUCK", label: "Dump Truck" },
  { value: "BOX_TRUCK", label: "Box Truck" },
] as const;

export type TruckType = (typeof TRUCK_TYPES)[number]["value"];
