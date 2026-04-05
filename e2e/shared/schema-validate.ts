/**
 * E2E payload validator — dev-time guard against schema drift.
 *
 * Call assertValidLoad() inside every ensureLoad() / ensureTrip() /
 * ensureCarrierTrip() / ensurePostedLoad() BEFORE sending the POST.
 * A malformed payload throws immediately with a clear Zod error message
 * instead of surfacing as a cryptic 400 after the fact.
 *
 * The schema here mirrors app/api/loads/route.ts `createLoadSchema`.
 * When a backend round adds/removes required fields from that schema,
 * update this file in the same session (see CLAUDE.md process rule).
 */

import { z } from "zod";
import { TRUCK_TYPE_VALUES } from "@/lib/constants/truckTypes";

const VALID_TRUCK_TYPES = TRUCK_TYPE_VALUES;

/** Minimal required-fields schema for POST /api/loads */
const loadPayloadSchema = z.object({
  pickupCity: z.string().min(2).max(200),
  deliveryCity: z.string().min(2).max(200),
  pickupDate: z.string().min(1),
  deliveryDate: z.string().min(1),
  truckType: z.enum(VALID_TRUCK_TYPES),
  weight: z.number().positive().max(50000),
  cargoDescription: z.string().min(5).max(2000),
  // Required when status=POSTED and not anonymous (blueprint §3)
  shipperContactName: z.string().min(2).max(200),
  shipperContactPhone: z.string().min(10).max(20),
});

/**
 * Assert that a load payload satisfies the required fields.
 * Throws with a descriptive message if validation fails.
 *
 * @param payload - The body object about to be sent to POST /api/loads
 */
export function assertValidLoad(payload: unknown): void {
  const result = loadPayloadSchema.safeParse(payload);
  if (!result.success) {
    throw new Error(
      `[schema-validate] Invalid load payload: ${JSON.stringify(
        result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
        null,
        2
      )}`
    );
  }
}

export { VALID_TRUCK_TYPES };
