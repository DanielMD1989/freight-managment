/**
 * DAT-Style UI Component Types
 *
 * Type definitions for the DAT-style load board interface components
 * Sprint 14 - DAT-Style UI Transformation
 */

// ============================================================================
// BUTTON TYPES
// ============================================================================

export type DatButtonVariant = 'primary' | 'secondary' | 'destructive' | 'search';
export type DatButtonSize = 'sm' | 'md' | 'lg';

export interface DatActionButtonProps {
  variant: DatButtonVariant;
  size?: DatButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// TAB TYPES
// ============================================================================

export type DatTabKey = 'POST_LOADS' | 'SEARCH_TRUCKS' | 'POST_TRUCKS' | 'SEARCH_LOADS';
export type UserRole = 'SHIPPER' | 'CARRIER' | 'ADMIN';

export interface DatNavTab {
  key: DatTabKey;
  label: string;
  icon?: React.ReactNode;
  roles: UserRole[];
}

export interface DatNavTabsProps {
  userRole: UserRole;
  activeTab: DatTabKey;
  onTabChange: (tab: DatTabKey) => void;
}

export interface DatStatusTab {
  key: string;
  label: string;
  count?: number;
}

export interface DatStatusTabsProps {
  tabs: DatStatusTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

// ============================================================================
// TABLE TYPES
// ============================================================================

export interface DatColumn {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
}

export interface DatRowAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant: DatButtonVariant;
  onClick: (row: any) => void;
  show?: (row: any) => boolean;
  render?: (row: any) => string | React.ReactNode;
}

export interface DatDataTableProps<T = any> {
  columns: DatColumn[];
  data: T[];
  expandable?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  actions?: DatRowAction[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  rowKey?: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export type DatFilterType = 'slider' | 'range-slider' | 'select' | 'date-picker' | 'toggle' | 'text';

export interface DatFilterBase {
  key: string;
  label: string;
  type: DatFilterType;
}

export interface DatSliderFilter extends DatFilterBase {
  type: 'slider';
  min: number;
  max: number;
  unit?: string;
  step?: number;
}

export interface DatRangeSliderFilter extends DatFilterBase {
  type: 'range-slider';
  min: number;
  max: number;
  unit?: string;
  step?: number;
}

export interface DatSelectFilter extends DatFilterBase {
  type: 'select';
  options: Array<{ value: string; label: string }>;
  multiple?: boolean;
}

export interface DatDatePickerFilter extends DatFilterBase {
  type: 'date-picker';
  minDate?: Date;
  maxDate?: Date;
}

export interface DatToggleFilter extends DatFilterBase {
  type: 'toggle';
}

export interface DatTextFilter extends DatFilterBase {
  type: 'text';
  placeholder?: string;
}

export type DatFilter =
  | DatSliderFilter
  | DatRangeSliderFilter
  | DatSelectFilter
  | DatDatePickerFilter
  | DatToggleFilter
  | DatTextFilter;

export interface DatFilterPanelProps {
  title: string;
  filters: DatFilter[];
  values: Record<string, any>;
  onChange: (key: string, value: any) => void;
  onReset: () => void;
}

// ============================================================================
// SAVED SEARCH TYPES
// ============================================================================

export type SavedSearchType = 'LOADS' | 'TRUCKS';

export interface SavedSearchCriteria {
  origin?: string;
  destination?: string;
  truckType?: string[];
  minWeight?: number;
  maxWeight?: number;
  minRate?: number;
  maxRate?: number;
  ageHours?: number;
  minTripKm?: number;
  maxTripKm?: number;
  fullPartial?: 'FULL' | 'PARTIAL' | 'BOTH';
  availableFrom?: string;
  availableTo?: string;
  [key: string]: any;
}

export interface SavedSearch {
  id: string;
  name: string;
  type: SavedSearchType;
  criteria: SavedSearchCriteria;
  createdAt: string;
  updatedAt: string;
}

export interface DatSavedSearchesProps {
  searches: SavedSearch[];
  activeSearchId?: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
  type: SavedSearchType;
}

// ============================================================================
// INLINE EDIT TYPES
// ============================================================================

export interface DatEditField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
}

export interface DatInlineEditProps {
  data: any;
  fields: DatEditField[];
  onSave: (data: any) => Promise<void>;
  onCancel: () => void;
  saving?: boolean;
}

// ============================================================================
// REFERENCE PRICING TYPES
// ============================================================================

export interface ReferencePricing {
  triHaulRate?: number;
  brokerSpotRate?: number;
  currency?: string;
}

export interface DatReferencePricingProps {
  triHaulRate?: number;
  trihaulRate?: number; // Alternative casing for compatibility
  brokerSpotRate?: number;
  ratePerMile?: number;
  ratePerTrip?: number;
  loading?: boolean;
  className?: string;
  currency?: string;
}

// ============================================================================
// RATE ANALYSIS TYPES
// ============================================================================

export interface RateAnalysis {
  ratePerMile: number;
  ratePerTrip: number;
  ageRange?: string;
  marketType?: string;
  currency?: string;
  totalMiles?: number;
  averageSpeed?: number;
  ageHours?: number;
}

export interface DatRateAnalysisProps {
  rateType?: string;
  ratePerMile: number;
  ratePerTrip: number;
  totalMiles?: number;
  averageSpeed?: number;
  ageHours?: number;
  currency?: string;
  onRateBias?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
  links?: {
    utilizesTrip?: string;
    hotAnalysis?: string;
    routeBuilder?: string;
  };
}

// ============================================================================
// COMPANY TYPES
// ============================================================================

export interface CompanyInfo {
  id: string;
  name: string;
  isVerified: boolean;
  isMasked: boolean;
  allowNameDisplay: boolean;
  isPreferred?: boolean;
  isBlocked?: boolean;
  contactEmail?: string;
  email?: string;
  contactPhone?: string;
  phone?: string;
  contactName?: string;
  address?: string;
  location?: string;
  bondDate?: string;
  totalLoads?: number;
  totalTrucks?: number;
  notes?: string;
}

export interface DatCompanyLinkProps {
  companyId: string;
  companyName: string;
  isMasked: boolean;
  isVerified?: boolean;
  onClick?: (companyId: string) => void;
  className?: string;
}

export interface DatCompanyModalProps {
  company: CompanyInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkPreferred?: (companyId: string) => void;
  onMarkBlocked?: (companyId: string) => void;
}

// ============================================================================
// AGE INDICATOR TYPES
// ============================================================================

export interface DatAgeIndicatorProps {
  date: Date | string;
  format?: 'short' | 'long';
  showIcon?: boolean;
  className?: string;
}

// ============================================================================
// CHARACTER COUNTER TYPES
// ============================================================================

export interface DatCharacterCounterProps {
  value: string;
  maxLength: number;
  showCount?: boolean;
  className?: string;
}

// ============================================================================
// EXPANDABLE ROW TYPES
// ============================================================================

export interface DatExpandableRowProps {
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  className?: string;
}

// ============================================================================
// LOAD & TRUCK POSTING TYPES (Enhanced)
// ============================================================================

export interface DatLoad {
  id: string;
  status: 'DRAFT' | 'POSTED' | 'UNPOSTED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED';
  postedAt?: Date;
  createdAt: Date;
  updatedAt: Date;

  // Route
  pickupCity: string;
  deliveryCity: string;
  pickupDate: Date;
  deliveryDate?: Date;
  tripKm: number;

  // Load details
  truckType: string;
  weight: number;
  volume?: number;
  fullPartial: 'FULL' | 'PARTIAL';
  rate: number;
  currency: string;

  // DAT-specific
  isKept: boolean;
  hasAlerts: boolean;
  expiresAt?: Date;
  groupId?: string;

  // Reference
  referencePricing?: ReferencePricing;

  // Shipper
  shipper?: {
    id: string;
    name: string;
    isVerified: boolean;
  };
}

export interface DatTruckPosting {
  id: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'MATCHED';
  postedAt: Date;
  createdAt: Date;
  updatedAt: Date;

  // Availability
  availableFrom: Date;
  availableTo?: Date;

  // Route
  originCity: string;
  destinationCity?: string;

  // Truck details
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  };

  fullPartial: 'FULL' | 'PARTIAL';

  // Contact
  contactName: string;
  contactPhone: string;

  // DAT-specific
  isKept: boolean;

  // Carrier
  carrier?: {
    id: string;
    name: string;
    isVerified: boolean;
  };
}
