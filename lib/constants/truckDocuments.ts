/**
 * Truck Document Requirements — Single Source of Truth
 *
 * Defines which documents are required for truck approval,
 * which have expiry dates, and which need insurance-specific fields.
 *
 * Used by:
 * - AddTruckForm (checklist UI)
 * - Truck detail page (document status)
 * - Admin approval page (completeness check)
 */

export const TRUCK_DOCUMENT_REQUIREMENTS = [
  {
    type: "REGISTRATION" as const,
    label: "Vehicle Registration",
    description: "Official vehicle registration certificate",
    required: true,
    hasExpiry: true,
    hasInsuranceFields: false,
  },
  {
    type: "INSURANCE" as const,
    label: "Insurance Certificate",
    description:
      "Valid third-party liability or comprehensive insurance policy",
    required: true,
    hasExpiry: true,
    hasInsuranceFields: true,
  },
  {
    type: "TITLE_DEED" as const,
    label: "Title Deed / Ownership",
    description: "Proof of truck ownership or lease agreement",
    required: true,
    hasExpiry: false,
    hasInsuranceFields: false,
  },
  {
    type: "ROAD_WORTHINESS" as const,
    label: "Road Worthiness Certificate",
    description: "Annual road worthiness inspection certificate",
    required: true,
    hasExpiry: true,
    hasInsuranceFields: false,
  },
  {
    type: "DRIVER_LICENSE" as const,
    label: "Driver License",
    description: "Valid heavy vehicle driver's license",
    required: false,
    hasExpiry: true,
    hasInsuranceFields: false,
  },
  {
    type: "OTHER" as const,
    label: "Other Document",
    description: "Any additional supporting document",
    required: false,
    hasExpiry: false,
    hasInsuranceFields: false,
  },
] as const;

export type TruckDocumentRequirement =
  (typeof TRUCK_DOCUMENT_REQUIREMENTS)[number];

/** Document types that must be uploaded before admin can approve */
export const REQUIRED_TRUCK_DOCUMENTS = TRUCK_DOCUMENT_REQUIREMENTS.filter(
  (d) => d.required
).map((d) => d.type);

/** Get requirement config for a document type */
export function getDocumentRequirement(
  type: string
): TruckDocumentRequirement | undefined {
  return TRUCK_DOCUMENT_REQUIREMENTS.find((d) => d.type === type);
}
