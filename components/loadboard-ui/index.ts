/**
 * Load Board UI Components
 *
 * This module exports all load board UI components with proper naming.
 * All DAT naming has been removed in favor of clean, descriptive names.
 */

// Core Components
export { default as ActionButton } from "./ActionButton";
export { default as AgeIndicator } from "./AgeIndicator";
export { default as CharacterCounter } from "./CharacterCounter";
export { default as CompanyLink } from "./CompanyLink";
export { default as CompanyModal } from "./CompanyModal";

// Table Components
export { default as DataTable } from "./DataTable";
export { default as TableSkeleton } from "./TableSkeleton";

// Navigation Components
export { default as NavTabs } from "./NavTabs";
export { default as StatusTabs } from "./StatusTabs";

// Filter Components
export { default as FilterPanel } from "./FilterPanel";
export { default as SavedSearches } from "./SavedSearches";
export { default as EditSearchModal } from "./EditSearchModal";

// Form Components
export { default as InlineEdit } from "./InlineEdit";

// Pricing Components
export { default as ReferencePricing } from "./ReferencePricing";
export { default as RateAnalysis } from "./RateAnalysis";

// Re-export all types
export * from "@/types/loadboard-ui";
