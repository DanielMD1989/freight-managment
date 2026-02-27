/**
 * Types Index - Barrel Export
 *
 * Central export point for all TypeScript types.
 * Import from '@/types' instead of individual files.
 */

// Domain models and enums (canonical source of truth)
export * from "./domain";

// UI component types (re-export with exclusions to avoid conflicts)
// Note: UserRole and TruckPosting are excluded - use domain.ts versions
export type {
  // Button types
  ButtonVariant,
  ButtonSize,
  ActionButtonProps,
  // Tab types
  TabKey,
  NavTab,
  NavTabsProps,
  StatusTab,
  StatusTabsProps,
  // Table types
  TableColumn,
  RowAction,
  DataTableProps,
  // Filter types
  FilterType,
  FilterBase,
  SliderFilter,
  RangeSliderFilter,
  SelectFilter,
  DatePickerFilter,
  ToggleFilter,
  TextFilter,
  Filter,
  FilterPanelProps,
  // Saved search types
  SavedSearchType,
  SavedSearchCriteria,
  SavedSearch,
  SavedSearchesProps,
  // Edit types
  EditField,
  InlineEditProps,
  // Pricing types
  ReferencePricing,
  ReferencePricingProps,
  RateAnalysis,
  RateAnalysisProps,
  // Company types
  CompanyInfo,
  CompanyLinkProps,
  CompanyModalProps,
  // UI display types
  AgeIndicatorProps,
  CharacterCounterProps,
  ExpandableRowProps,
  // Posting types (UI-specific, different from domain)
  LoadPosting,
} from "./loadboard-ui";

// Re-export UI-specific TruckPosting with alias to avoid conflict
export type { TruckPosting as TruckPostingUI } from "./loadboard-ui";
export type { UserRole as UIUserRole } from "./loadboard-ui";
