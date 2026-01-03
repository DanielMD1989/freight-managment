/**
 * Form Validation Utilities
 *
 * Reusable validation functions for load and truck posting forms
 * Sprint 15 - Stories 15.2, 15.3, 15.6: Form Enhancements
 */

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Validate load posting form
 */
export function validateLoadForm(data: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.pickupCity) {
    errors.push({ field: 'pickupCity', message: 'Pickup city is required' });
  }

  if (!data.deliveryCity) {
    errors.push({ field: 'deliveryCity', message: 'Delivery city is required' });
  }

  if (!data.pickupDate) {
    errors.push({ field: 'pickupDate', message: 'Pickup date is required' });
  }

  if (!data.truckType) {
    errors.push({ field: 'truckType', message: 'Truck type is required' });
  }

  if (!data.weight || data.weight <= 0) {
    errors.push({ field: 'weight', message: 'Weight must be greater than 0' });
  }

  if (!data.rate || data.rate <= 0) {
    errors.push({ field: 'rate', message: 'Rate must be greater than 0' });
  }

  // Date validation
  if (data.pickupDate) {
    const pickupDate = new Date(data.pickupDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (pickupDate < today) {
      errors.push({ field: 'pickupDate', message: 'Pickup date cannot be in the past' });
    }
  }

  if (data.deliveryDate && data.pickupDate) {
    const pickupDate = new Date(data.pickupDate);
    const deliveryDate = new Date(data.deliveryDate);

    if (deliveryDate < pickupDate) {
      errors.push({ field: 'deliveryDate', message: 'Delivery date must be after pickup date' });
    }
  }

  // Cargo description
  if (data.cargoDescription && data.cargoDescription.length < 10) {
    errors.push({ field: 'cargoDescription', message: 'Cargo description should be at least 10 characters' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate truck posting form
 */
export function validateTruckForm(data: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Required fields
  if (!data.truckType) {
    errors.push({ field: 'truckType', message: 'Truck type is required' });
  }

  if (!data.currentCity) {
    errors.push({ field: 'currentCity', message: 'Current location is required' });
  }

  if (!data.availableFrom) {
    errors.push({ field: 'availableFrom', message: 'Available from date is required' });
  }

  if (!data.capacity || data.capacity <= 0) {
    errors.push({ field: 'capacity', message: 'Capacity must be greater than 0' });
  }

  // Date validation
  if (data.availableFrom) {
    const availableDate = new Date(data.availableFrom);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (availableDate < today) {
      errors.push({ field: 'availableFrom', message: 'Available date cannot be in the past' });
    }
  }

  if (data.availableTo && data.availableFrom) {
    const fromDate = new Date(data.availableFrom);
    const toDate = new Date(data.availableFrom);

    if (toDate < fromDate) {
      errors.push({ field: 'availableTo', message: 'End date must be after start date' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate search filters
 */
export function validateSearchFilters(filters: any): ValidationResult {
  const errors: ValidationError[] = [];

  // If origin and destination are provided, they should be different
  if (filters.origin && filters.destination && filters.origin === filters.destination) {
    errors.push({ field: 'destination', message: 'Origin and destination must be different' });
  }

  // Date range validation
  if (filters.pickupDateFrom && filters.pickupDateTo) {
    const fromDate = new Date(filters.pickupDateFrom);
    const toDate = new Date(filters.pickupDateTo);

    if (toDate < fromDate) {
      errors.push({ field: 'pickupDateTo', message: 'End date must be after start date' });
    }
  }

  // Numeric validations
  if (filters.minWeight && filters.maxWeight && filters.minWeight > filters.maxWeight) {
    errors.push({ field: 'maxWeight', message: 'Max weight must be greater than min weight' });
  }

  if (filters.minRate && filters.maxRate && filters.minRate > filters.maxRate) {
    errors.push({ field: 'maxRate', message: 'Max rate must be greater than min rate' });
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Get error message for a specific field
 */
export function getFieldError(errors: ValidationError[], field: string): string | null {
  const error = errors.find((e) => e.field === field);
  return error ? error.message : null;
}

/**
 * Check if field has error
 */
export function hasFieldError(errors: ValidationError[], field: string): boolean {
  return errors.some((e) => e.field === field);
}
