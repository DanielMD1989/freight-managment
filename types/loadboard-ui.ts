/**
 * Load Board UI Component Types
 *
 * Type definitions for the load board interface components
 * Renamed from DAT to proper naming convention
 */

// ============================================================================
// BUTTON TYPES
// ============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'search';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ActionButtonProps {
  variant: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

// ============================================================================
// TAB TYPES
// ============================================================================

export type TabKey = 'POST_LOADS' | 'SEARCH_TRUCKS' | 'POST_TRUCKS' | 'SEARCH_LOADS';
export type UserRole = 'SHIPPER' | 'CARRIER' | 'ADMIN';

export interface NavTab {
  key: TabKey;
  label: string;
  icon?: React.ReactNode;
  roles: UserRole[];
}

export interface NavTabsProps {
  userRole: UserRole;
  activeTab: TabKey;
  onTabChange: (tab: TabKey) => void;
  portalType?: 'shipper' | 'carrier';
}

export interface StatusTab {
  key: string;
  label: string;
  count?: number;
}

export interface StatusTabsProps {
  tabs: StatusTab[];
  activeTab: string;
  onTabChange: (key: string) => void;
}

// ============================================================================
// TABLE TYPES
// ============================================================================

export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: any) => React.ReactNode;
}

export interface RowAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  variant: ButtonVariant;
  onClick: (row: any) => void;
  show?: (row: any) => boolean;
  render?: (row: any) => string | React.ReactNode;
}

export interface DataTableProps<T = any> {
  columns: TableColumn[];
  data: T[];
  expandable?: boolean;
  renderExpandedRow?: (row: T) => React.ReactNode;
  onRowClick?: (row: T) => void;
  selectable?: boolean;
  selectedRows?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  actions?: RowAction[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  rowKey?: string;
}

// ============================================================================
// FILTER TYPES
// ============================================================================

export type FilterType = 'slider' | 'range-slider' | 'select' | 'date-picker' | 'toggle' | 'text';

export interface FilterBase {
  key: string;
  label: string;
  type: FilterType;
}

export interface SliderFilter extends FilterBase {
  type: 'slider';
  min: number;
  max: number;
  unit?: string;
  step?: number;
}

export interface RangeSliderFilter extends FilterBase {
  type: 'range-slider';
  min: number;
  max: number;
  unit?: string;
  step?: number;
}

export interface SelectFilter extends FilterBase {
  type: 'select';
  options: Array<{ value: string; label: string }>;
  multiple?: boolean;
}

export interface DatePickerFilter extends FilterBase {
  type: 'date-picker';
  minDate?: Date;
  maxDate?: Date;
}

export interface ToggleFilter extends FilterBase {
  type: 'toggle';
}

export interface TextFilter extends FilterBase {
  type: 'text';
  placeholder?: string;
}

export type Filter =
  | SliderFilter
  | RangeSliderFilter
  | SelectFilter
  | DatePickerFilter
  | ToggleFilter
  | TextFilter;

export interface FilterPanelProps {
  title: string;
  filters: Filter[];
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

export interface SavedSearchesProps {
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

export interface EditField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'date' | 'textarea';
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
  placeholder?: string;
  required?: boolean;
}

export interface InlineEditProps {
  data: any;
  fields: EditField[];
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

export interface ReferencePricingProps {
  triHaulRate?: number;
  trihaulRate?: number;
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

export interface RateAnalysisProps {
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

export interface CompanyLinkProps {
  companyId: string;
  companyName: string;
  isMasked: boolean;
  isVerified?: boolean;
  onClick?: (companyId: string) => void;
  className?: string;
}

export interface CompanyModalProps {
  company: CompanyInfo | null;
  isOpen: boolean;
  onClose: () => void;
  onMarkPreferred?: (companyId: string) => void;
  onMarkBlocked?: (companyId: string) => void;
}

// ============================================================================
// AGE INDICATOR TYPES
// ============================================================================

export interface AgeIndicatorProps {
  date: Date | string;
  format?: 'short' | 'long';
  showIcon?: boolean;
  className?: string;
}

// ============================================================================
// CHARACTER COUNTER TYPES
// ============================================================================

export interface CharacterCounterProps {
  value: string;
  maxLength: number;
  showCount?: boolean;
  className?: string;
}

// ============================================================================
// EXPANDABLE ROW TYPES
// ============================================================================

export interface ExpandableRowProps {
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  expandedContent: React.ReactNode;
  className?: string;
}

// ============================================================================
// LOAD & TRUCK POSTING TYPES
// ============================================================================

export interface LoadPosting {
  id: string;
  status: 'DRAFT' | 'POSTED' | 'UNPOSTED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED';
  postedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: Date;
  deliveryDate?: Date;
  tripKm: number;
  truckType: string;
  weight: number;
  volume?: number;
  fullPartial: 'FULL' | 'PARTIAL';
  rate: number;
  currency: string;
  isKept: boolean;
  hasAlerts: boolean;
  expiresAt?: Date;
  groupId?: string;
  referencePricing?: ReferencePricing;
  shipper?: {
    id: string;
    name: string;
    isVerified: boolean;
  };
}

export interface TruckPosting {
  id: string;
  status: 'ACTIVE' | 'EXPIRED' | 'CANCELLED' | 'MATCHED';
  postedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  availableFrom: Date;
  availableTo?: Date;
  originCity: string;
  destinationCity?: string;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  fullPartial: 'FULL' | 'PARTIAL';
  contactName: string;
  contactPhone: string;
  isKept: boolean;
  carrier?: {
    id: string;
    name: string;
    isVerified: boolean;
  };
}

// ============================================================================
// BACKWARD COMPATIBILITY - Re-export with old names (deprecated)
// These will be removed in future versions
// ============================================================================

/** @deprecated Use ButtonVariant instead */
export type DatButtonVariant = ButtonVariant;
/** @deprecated Use ButtonSize instead */
export type DatButtonSize = ButtonSize;
/** @deprecated Use ActionButtonProps instead */
export type DatActionButtonProps = ActionButtonProps;
/** @deprecated Use TabKey instead */
export type DatTabKey = TabKey;
/** @deprecated Use NavTab instead */
export type DatNavTab = NavTab;
/** @deprecated Use NavTabsProps instead */
export type DatNavTabsProps = NavTabsProps;
/** @deprecated Use StatusTab instead */
export type DatStatusTab = StatusTab;
/** @deprecated Use StatusTabsProps instead */
export type DatStatusTabsProps = StatusTabsProps;
/** @deprecated Use TableColumn instead */
export type DatColumn = TableColumn;
/** @deprecated Use RowAction instead */
export type DatRowAction = RowAction;
/** @deprecated Use DataTableProps instead */
export type DatDataTableProps<T = any> = DataTableProps<T>;
/** @deprecated Use FilterType instead */
export type DatFilterType = FilterType;
/** @deprecated Use FilterBase instead */
export type DatFilterBase = FilterBase;
/** @deprecated Use SliderFilter instead */
export type DatSliderFilter = SliderFilter;
/** @deprecated Use RangeSliderFilter instead */
export type DatRangeSliderFilter = RangeSliderFilter;
/** @deprecated Use SelectFilter instead */
export type DatSelectFilter = SelectFilter;
/** @deprecated Use DatePickerFilter instead */
export type DatDatePickerFilter = DatePickerFilter;
/** @deprecated Use ToggleFilter instead */
export type DatToggleFilter = ToggleFilter;
/** @deprecated Use TextFilter instead */
export type DatTextFilter = TextFilter;
/** @deprecated Use Filter instead */
export type DatFilter = Filter;
/** @deprecated Use FilterPanelProps instead */
export type DatFilterPanelProps = FilterPanelProps;
/** @deprecated Use SavedSearchesProps instead */
export type DatSavedSearchesProps = SavedSearchesProps;
/** @deprecated Use EditField instead */
export type DatEditField = EditField;
/** @deprecated Use InlineEditProps instead */
export type DatInlineEditProps = InlineEditProps;
/** @deprecated Use ReferencePricingProps instead */
export type DatReferencePricingProps = ReferencePricingProps;
/** @deprecated Use RateAnalysisProps instead */
export type DatRateAnalysisProps = RateAnalysisProps;
/** @deprecated Use CompanyLinkProps instead */
export type DatCompanyLinkProps = CompanyLinkProps;
/** @deprecated Use CompanyModalProps instead */
export type DatCompanyModalProps = CompanyModalProps;
/** @deprecated Use AgeIndicatorProps instead */
export type DatAgeIndicatorProps = AgeIndicatorProps;
/** @deprecated Use CharacterCounterProps instead */
export type DatCharacterCounterProps = CharacterCounterProps;
/** @deprecated Use ExpandableRowProps instead */
export type DatExpandableRowProps = ExpandableRowProps;
/** @deprecated Use LoadPosting instead */
export type DatLoad = LoadPosting;
/** @deprecated Use TruckPosting instead */
export type DatTruckPosting = TruckPosting;
