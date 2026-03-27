/**
 * Mobile GPS Batch Ingest API (§11 M1)
 *
 * POST /api/tracking/ingest/batch
 *
 * Blueprint §11: "Mobile app GPS — Fallback. Carrier app sends location via
 * POST /api/tracking/ingest/batch."
 *
 * This route delegates to the existing /api/gps/batch handler which already
 * implements carrier auth, truck ownership, GPS position creation, and
 * truck location updates. No logic duplication needed.
 */

export { POST } from "@/app/api/gps/batch/route";
