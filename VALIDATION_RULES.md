# Input Validation Rules Documentation

**Sprint 9 - Story 9.4: Input Validation & Sanitization**
**Date:** 2025-12-25
**Status:** Implemented

---

## Overview

This document outlines all input validation rules implemented across the Freight Management Platform to ensure data integrity, prevent security vulnerabilities, and provide a consistent user experience.

## Security Benefits

- **XSS Prevention**: All text inputs sanitized to remove HTML tags and scripts
- **Path Traversal Prevention**: File names validated to prevent directory traversal attacks
- **SQL Injection Prevention**: ID formats validated (additional layer to Prisma's protection)
- **Data Integrity**: Numeric ranges and date validations ensure valid business data
- **Contact Validation**: Email and phone numbers conform to expected formats

---

## Validation Categories

### 1. Email Validation

**Schema**: `emailSchema` (lib/validation.ts)

**Rules**:
- Must be valid email format (RFC 5322 compliant)
- Minimum length: 5 characters
- Maximum length: 254 characters
- Automatically converted to lowercase
- No consecutive dots allowed
- No leading or trailing dots

**Examples**:
```
✅ Valid:   user@example.com, contact@company.et
❌ Invalid: user..name@example.com, .user@example.com, user@
```

**Used in**: Organization registration, user profiles

---

### 2. Phone Number Validation

**Schema**: `phoneSchema` (lib/validation.ts)

**Rules**:
- Ethiopian phone format required
- Accepts: +251912345678, 0912345678, 912345678
- Minimum: 9 digits
- Maximum: 15 characters
- Spaces and dashes automatically removed

**Pattern**: `^(\+251|0)?9\d{8}$`

**Examples**:
```
✅ Valid:   +251912345678, 0912345678, 912345678
❌ Invalid: 123456789, +1234567890, 812345678
```

**Used in**: Truck postings (contactPhone), organization contact info

---

### 3. File Name Validation

**Function**: `validateFileName()` (lib/validation.ts)

**Rules**:
- Maximum length: 255 characters
- No path traversal: `..`, `/`, `\` not allowed
- No null bytes
- Only alphanumeric, dash, underscore, dot, and space allowed
- Must have file extension
- Consecutive spaces/dots removed during sanitization

**Security**: Prevents directory traversal attacks

**Examples**:
```
✅ Valid:   document.pdf, License_Copy_2024.jpg, My File.png
❌ Invalid: ../../../etc/passwd, file\name.pdf, doc..pdf, file
```

**Used in**: Document upload endpoint

---

### 4. Text Sanitization

**Function**: `sanitizeText()` (lib/validation.ts)

**Rules**:
- Removes all HTML tags
- Removes JavaScript URLs (`javascript:`)
- Removes event handlers (`onclick=`, `onload=`, etc.)
- Normalizes whitespace
- Default max length: 1000 characters
- Trims leading/trailing whitespace

**Security**: Prevents XSS attacks

**Used in**: General text inputs, notes fields

---

### 5. Rejection Reason Sanitization

**Function**: `sanitizeRejectionReason()` (lib/validation.ts)

**Rules**:
- Removes HTML tags
- Removes JavaScript content
- Preserves newlines (unlike sanitizeText)
- Maximum: 500 characters
- Normalizes spaces but keeps line breaks

**Used in**: Document verification rejection reasons

---

### 6. ID Format Validation

**Function**: `validateIdFormat()` (lib/validation.ts)

**Rules**:
- Required (not null/undefined)
- Length: 10-50 characters
- Only alphanumeric and dashes allowed
- No SQL injection patterns (`SELECT`, `DROP`, `--`, `;`, etc.)

**Security**: Prevents SQL injection (additional layer)

**Examples**:
```
✅ Valid:   clxyz123abc456, abc-def-123-456
❌ Invalid: 123; DROP TABLE--, SELECT * FROM users, ../../../
```

**Used in**: All endpoints receiving IDs (documents, trucks, postings, locations)

---

### 7. Numeric Range Validation

#### Weight Schema

**Schema**: `weightSchema` (lib/validation.ts)

**Rules**:
- Must be positive number
- Minimum: 1 kg
- Maximum: 50,000 kg
- Must be finite (not Infinity/NaN)

**Used in**: Truck capacity, load weight, available weight

#### Length Schema

**Schema**: `lengthSchema` (lib/validation.ts)

**Rules**:
- Must be positive number
- Minimum: 0.1 m
- Maximum: 20 m
- Must be finite

**Used in**: Truck length, load dimensions

#### Distance Schema

**Schema**: `distanceSchema` (lib/validation.ts)

**Rules**:
- Must be non-negative (0 allowed)
- Maximum: 2,000 km
- Must be finite

**Used in**: Deadhead distance (preferredDhToOriginKm, preferredDhAfterDeliveryKm)

---

### 8. Date Validation

#### Date Range Validation

**Function**: `validateDateRange()` (lib/validation.ts)

**Rules**:
- Both dates must be valid Date objects
- Start date must be before end date
- Provides clear error messages with field names

**Used in**: Truck postings (availableFrom < availableTo)

#### Future Date Validation

**Function**: `validateFutureDate()` (lib/validation.ts)

**Rules**:
- Date must be valid
- Date cannot be in the past
- Optional `allowToday` parameter (default: true)

**Used in**: Availability dates, expiration dates

---

### 9. File Size Validation

**Function**: `validateFileSize()` (lib/validation.ts)

**Rules**:
- Default maximum: 10 MB
- Configurable via parameter
- Must be positive number

**Used in**: Document upload

---

## Endpoint-Specific Validation

### Document Upload (`/api/documents/upload`)

**Validated**:
- ✅ File name (validateFileName)
- ✅ Entity ID format (validateIdFormat)
- ✅ File type (via magic bytes - fileStorage.ts)
- ✅ File size (MAX_FILE_SIZE = 10MB)
- ✅ Document type enum (CompanyDocumentType | TruckDocumentType)
- ✅ Entity type ('company' | 'truck')

**Security Layers**:
1. Authentication required
2. Authorization (organization ownership)
3. File name validation (path traversal prevention)
4. Magic bytes verification (not just extension)
5. File size limits

---

### Truck Posting (`/api/truck-postings`)

**Validated**:
- ✅ Truck ID format (validateIdFormat)
- ✅ Origin city ID format (validateIdFormat)
- ✅ Destination city ID format (validateIdFormat)
- ✅ Available weight (weightSchema: 1-50,000 kg)
- ✅ Available length (lengthSchema: 0.1-20 m)
- ✅ Deadhead distances (distanceSchema: 0-2,000 km)
- ✅ Contact phone (phoneSchema: Ethiopian format)
- ✅ Contact name (2-100 characters)
- ✅ Owner name (2-100 characters, optional)
- ✅ Notes (max 500 characters)
- ✅ Date range (availableFrom < availableTo)
- ✅ Location existence in database
- ✅ Truck ownership

---

### Document Verification (`/api/admin/verification/[id]`)

**Validated**:
- ✅ Document ID format (validateIdFormat)
- ✅ Entity type ('company' | 'truck')
- ✅ Verification status ('APPROVED' | 'REJECTED')
- ✅ Rejection reason (sanitizeRejectionReason, required if rejected)
- ✅ Expiration date (optional)

**Security**:
- Rejection reasons sanitized to prevent XSS
- HTML tags and scripts removed
- Maximum 500 characters

---

## Testing Guidelines

### Manual Testing

Test each validation rule with:

1. **Valid inputs**: Ensure accepted
2. **Boundary values**: Test min/max limits
3. **Invalid formats**: Ensure rejected with clear error
4. **Malicious inputs**: XSS, path traversal, SQL injection attempts

### Example Test Cases

#### File Name Validation
```javascript
// Valid
validateFileName('document.pdf')           // ✅
validateFileName('License 2024.jpg')       // ✅

// Invalid
validateFileName('../../../etc/passwd')    // ❌ Path traversal
validateFileName('file<script>.pdf')       // ❌ Special chars
validateFileName('a'.repeat(300) + '.pdf') // ❌ Too long
```

#### Phone Number Validation
```javascript
// Valid
phoneSchema.parse('+251912345678')  // ✅
phoneSchema.parse('0912345678')     // ✅
phoneSchema.parse('912345678')      // ✅

// Invalid
phoneSchema.parse('123456789')      // ❌ Wrong format
phoneSchema.parse('+1234567890')    // ❌ Not Ethiopian
```

#### Numeric Range Validation
```javascript
// Weight
weightSchema.parse(1000)       // ✅ 1000 kg
weightSchema.parse(0)          // ❌ Must be positive
weightSchema.parse(60000)      // ❌ Exceeds max

// Length
lengthSchema.parse(5.5)        // ✅ 5.5 m
lengthSchema.parse(0.05)       // ❌ Below min
lengthSchema.parse(25)         // ❌ Exceeds max
```

---

## Error Messages

All validation errors return clear, user-friendly messages:

```json
{
  "error": "File name contains invalid characters"
}
```

```json
{
  "error": "Weight must be between 1 and 50,000 kg"
}
```

```json
{
  "error": "Invalid Ethiopian phone number format"
}
```

---

## Future Enhancements

### Recommended Additions:

1. **Rate-Based Validation**: Prevent rapid-fire submissions
2. **Geolocation Validation**: Verify coordinates are within Ethiopia
3. **Business Hours Validation**: Ensure pickup/delivery times are reasonable
4. **Cross-Field Validation**: E.g., weight doesn't exceed truck capacity
5. **File Content Validation**: Virus scanning integration
6. **Advanced Phone Validation**: Verify number is in service (via API)

---

## Compliance

**Standards Met**:
- ✅ OWASP Input Validation Guidelines
- ✅ RFC 5322 (Email)
- ✅ ISO 8601 (Dates via Zod)
- ✅ WCAG 2.1 AA (Clear error messages)

**Security Frameworks**:
- ✅ Defense in depth (multiple validation layers)
- ✅ Fail secure (reject by default)
- ✅ Principle of least privilege

---

## Implementation Checklist

### Story 9.4 Tasks:

- [x] Create validation utility library (lib/validation.ts)
- [x] Add date range validation (validateDateRange)
- [x] Add file name validation (validateFileName)
- [x] Add numeric range validation (weight, length, distance schemas)
- [x] Add email validation (emailSchema)
- [x] Add phone validation (phoneSchema - Ethiopian format)
- [x] Add text sanitization (sanitizeText, sanitizeRejectionReason)
- [x] Add ID format validation (validateIdFormat)
- [x] Apply to document upload endpoint
- [x] Apply to truck posting endpoint
- [x] Apply to verification endpoint
- [ ] Add comprehensive automated tests (pending)
- [x] Document all rules (this document)

---

**Last Updated:** 2025-12-25
**Maintained By:** Development Team
**Review Frequency:** With each sprint or security audit
