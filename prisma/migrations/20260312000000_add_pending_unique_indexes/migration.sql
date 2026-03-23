-- G-M14-3: Partial unique indexes to prevent duplicate PENDING requests
-- for the same (loadId, truckId) pair. Fixes TOCTOU race in findFirst → create pattern.

CREATE UNIQUE INDEX "LoadRequest_pending_unique"
  ON "load_requests" ("loadId", "truckId")
  WHERE status = 'PENDING';

CREATE UNIQUE INDEX "TruckRequest_pending_unique"
  ON "truck_requests" ("loadId", "truckId")
  WHERE status = 'PENDING';

CREATE UNIQUE INDEX "MatchProposal_pending_unique"
  ON "match_proposals" ("loadId", "truckId")
  WHERE status = 'PENDING';
