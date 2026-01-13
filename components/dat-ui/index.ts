/**
 * DAT-Style UI Component Library
 *
 * @deprecated This module is deprecated. Import from '@/components/loadboard-ui' instead.
 *
 * All exports in this file are maintained for backward compatibility.
 * They will be removed in a future version.
 *
 * Migration guide:
 * - DatActionButton -> ActionButton (from loadboard-ui)
 * - DatNavTabs -> NavTabs (from loadboard-ui)
 * - DatDataTable -> DataTable (from loadboard-ui)
 * - etc.
 */

// Core Navigation & Structure
export { default as DatActionButton } from './DatActionButton';
export { default as DatStatusTabs } from './DatStatusTabs';
export { default as DatNavTabs } from './DatNavTabs';
export { default as DatDataTable } from './DatDataTable';
export { default as DatTableSkeleton } from './DatTableSkeleton';

// Search & Filtering
export { default as DatFilterPanel } from './DatFilterPanel';
export { default as DatSavedSearches } from './DatSavedSearches';
export { default as DatEditSearchModal } from './DatEditSearchModal';

// Editing & Input
export { default as DatInlineEdit } from './DatInlineEdit';
export { default as DatCharacterCounter } from './DatCharacterCounter';

// Pricing & Analysis
export { default as DatReferencePricing } from './DatReferencePricing';
export { default as DatRateAnalysis } from './DatRateAnalysis';

// Company & Details
export { default as DatCompanyLink } from './DatCompanyLink';
export { default as DatCompanyModal } from './DatCompanyModal';

// Indicators & Badges
export { default as DatAgeIndicator } from './DatAgeIndicator';

// Re-export types (deprecated)
export * from '@/types/dat-ui';
