-- wipe-db.sql
-- Truncate every application table, cascade through FK chains, reset sequences.
-- Run with: psql "$DATABASE_URL" -f scripts/wipe-db.sql
-- WARNING: This deletes ALL rows. Schema and migrations are untouched.

TRUNCATE TABLE
  "AutomationRuleExecution", "AutomationRule",
  "Notification", "SavedSearch",
  "TruckDocument", "CompanyDocument",
  "LoadRequest", "TruckRequest", "MatchProposal",
  "TruckPosting",
  "RouteCache", "Corridor",
  "GpsPosition", "GpsDevice",
  "TripPod", "Trip",
  "LoadEscalation", "LoadEvent", "Load",
  "WalletDeposit", "WithdrawalRequest", "JournalLine", "JournalEntry", "FinancialAccount",
  "Dispute", "Report",
  "Document",
  "AuditLog", "SecurityEvent",
  "DeviceToken", "Session", "UserMFA", "PasswordResetToken", "Invitation",
  "Truck",
  "EthiopianLocation",
  "SystemSettings", "SystemConfig",
  "User",
  "Organization"
RESTART IDENTITY CASCADE;
