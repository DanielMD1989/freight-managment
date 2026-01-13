/**
 * Load Board UI Components
 *
 * This module exports all load board UI components with proper naming.
 * Backward compatibility is maintained via re-exports from old DAT names.
 */

// New components with proper naming
export { default as ActionButton } from './ActionButton';
export { default as AgeIndicator } from './AgeIndicator';
export { default as CharacterCounter } from './CharacterCounter';
export { default as CompanyLink } from './CompanyLink';

// Re-export from old DAT components (backward compatibility - will be removed in future)
// These allow gradual migration without breaking existing imports
export { default as DataTable } from '../dat-ui/DatDataTable';
export { default as FilterPanel } from '../dat-ui/DatFilterPanel';
export { default as NavTabs } from '../dat-ui/DatNavTabs';
export { default as StatusTabs } from '../dat-ui/DatStatusTabs';
export { default as SavedSearches } from '../dat-ui/DatSavedSearches';
export { default as InlineEdit } from '../dat-ui/DatInlineEdit';
export { default as ReferencePricing } from '../dat-ui/DatReferencePricing';
export { default as RateAnalysis } from '../dat-ui/DatRateAnalysis';
export { default as CompanyModal } from '../dat-ui/DatCompanyModal';
export { default as TableSkeleton } from '../dat-ui/DatTableSkeleton';
export { default as EditSearchModal } from '../dat-ui/DatEditSearchModal';

// Deprecated exports (aliased to old names for backward compatibility)
/** @deprecated Use ActionButton instead */
export { default as DatActionButton } from '../dat-ui/DatActionButton';
/** @deprecated Use AgeIndicator instead */
export { default as DatAgeIndicator } from '../dat-ui/DatAgeIndicator';
/** @deprecated Use CharacterCounter instead */
export { default as DatCharacterCounter } from '../dat-ui/DatCharacterCounter';
/** @deprecated Use CompanyLink instead */
export { default as DatCompanyLink } from '../dat-ui/DatCompanyLink';
/** @deprecated Use CompanyModal instead */
export { default as DatCompanyModal } from '../dat-ui/DatCompanyModal';
/** @deprecated Use DataTable instead */
export { default as DatDataTable } from '../dat-ui/DatDataTable';
/** @deprecated Use FilterPanel instead */
export { default as DatFilterPanel } from '../dat-ui/DatFilterPanel';
/** @deprecated Use NavTabs instead */
export { default as DatNavTabs } from '../dat-ui/DatNavTabs';
/** @deprecated Use StatusTabs instead */
export { default as DatStatusTabs } from '../dat-ui/DatStatusTabs';
/** @deprecated Use SavedSearches instead */
export { default as DatSavedSearches } from '../dat-ui/DatSavedSearches';
/** @deprecated Use InlineEdit instead */
export { default as DatInlineEdit } from '../dat-ui/DatInlineEdit';
/** @deprecated Use ReferencePricing instead */
export { default as DatReferencePricing } from '../dat-ui/DatReferencePricing';
/** @deprecated Use RateAnalysis instead */
export { default as DatRateAnalysis } from '../dat-ui/DatRateAnalysis';
/** @deprecated Use TableSkeleton instead */
export { default as DatTableSkeleton } from '../dat-ui/DatTableSkeleton';
/** @deprecated Use EditSearchModal instead */
export { default as DatEditSearchModal } from '../dat-ui/DatEditSearchModal';

// Re-export all types
export * from '@/types/loadboard-ui';
