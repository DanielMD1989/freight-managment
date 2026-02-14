# 03 - Verification & Documents (VER-xxx)

> **Total Tests:** 16
> **Priority Breakdown:** P0: 4 | P1: 6 | P2: 4 | P3: 2
> **API Endpoints:** `/api/documents/*`, `/api/admin/documents/*`, `/api/admin/verification/*`, `/api/admin/organizations/*/verify`
> **Source Files:** `app/api/documents/*/route.ts`, `app/api/admin/verification/*/route.ts`

---

## A. Document Upload (VER-001 to VER-005)

### VER-001: Upload company document

| Field               | Value                                                                                                                   |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                                                      |
| **Preconditions**   | Logged in as shipper/carrier with organization                                                                          |
| **Steps**           | 1. `POST /api/documents/upload` with multipart form: `{ file, type: "COMPANY_LICENSE", organizationId }`                |
| **Expected Result** | 201 Created. CompanyDocument created with `verificationStatus: PENDING`, `fileName`, `fileUrl`, `fileSize`, `mimeType`. |
| **Status**          |                                                                                                                         |
| **Actual Result**   |                                                                                                                         |

### VER-002: Upload truck document

| Field               | Value                                                                          |
| ------------------- | ------------------------------------------------------------------------------ |
| **Priority**        | P0                                                                             |
| **Preconditions**   | Logged in as carrier, truck exists                                             |
| **Steps**           | 1. `POST /api/documents/upload` with `{ file, type: "REGISTRATION", truckId }` |
| **Expected Result** | 201 Created. TruckDocument created with `verificationStatus: PENDING`.         |
| **Status**          |                                                                                |
| **Actual Result**   |                                                                                |

### VER-003: Upload file exceeding size limit

| Field               | Value                                    |
| ------------------- | ---------------------------------------- |
| **Priority**        | P1                                       |
| **Preconditions**   | SystemSettings `maxFileUploadSizeMb: 10` |
| **Steps**           | 1. Upload file larger than 10MB          |
| **Expected Result** | 400 Bad Request. File too large error.   |
| **Status**          |                                          |
| **Actual Result**   |                                          |

### VER-004: Upload invalid file type

| Field               | Value                                                                    |
| ------------------- | ------------------------------------------------------------------------ |
| **Priority**        | P1                                                                       |
| **Preconditions**   | None                                                                     |
| **Steps**           | 1. Upload `.exe` file                                                    |
| **Expected Result** | 400 Bad Request. Invalid file type error. Only images and PDFs accepted. |
| **Status**          |                                                                          |
| **Actual Result**   |                                                                          |

### VER-005: Upload rate limiting

| Field               | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Priority**        | P2                                                    |
| **Preconditions**   | SystemSettings `rateLimitDocumentUpload: 10` per hour |
| **Steps**           | 1. Upload 11 documents in rapid succession            |
| **Expected Result** | First 10 succeed. 11th returns 429 Too Many Requests. |
| **Status**          |                                                       |
| **Actual Result**   |                                                       |

---

## B. Document Retrieval (VER-006 to VER-008)

### VER-006: List organization documents

| Field               | Value                                                                      |
| ------------------- | -------------------------------------------------------------------------- |
| **Priority**        | P1                                                                         |
| **Preconditions**   | Organization has uploaded documents                                        |
| **Steps**           | 1. `GET /api/documents?organizationId={id}`                                |
| **Expected Result** | 200 OK. List of documents with `type`, `verificationStatus`, `uploadedAt`. |
| **Status**          |                                                                            |
| **Actual Result**   |                                                                            |

### VER-007: Download document

| Field               | Value                                                             |
| ------------------- | ----------------------------------------------------------------- |
| **Priority**        | P1                                                                |
| **Preconditions**   | Document exists                                                   |
| **Steps**           | 1. `GET /api/documents/{id}`                                      |
| **Expected Result** | 200 OK. Document metadata returned. File accessible at `fileUrl`. |
| **Status**          |                                                                   |
| **Actual Result**   |                                                                   |

### VER-008: Cannot access other org's documents

| Field               | Value                                                        |
| ------------------- | ------------------------------------------------------------ |
| **Priority**        | P1                                                           |
| **Preconditions**   | Documents from different org                                 |
| **Steps**           | 1. Login as shipper A 2. Try to access shipper B's documents |
| **Expected Result** | 403 Forbidden. Access denied.                                |
| **Status**          |                                                              |
| **Actual Result**   |                                                              |

---

## C. Admin Verification Workflow (VER-009 to VER-013)

### VER-009: View verification queue

| Field               | Value                                                                                |
| ------------------- | ------------------------------------------------------------------------------------ |
| **Priority**        | P0                                                                                   |
| **Preconditions**   | Logged in as admin, pending documents exist                                          |
| **Steps**           | 1. `GET /api/admin/verification/queue`                                               |
| **Expected Result** | 200 OK. List of documents with `verificationStatus: PENDING`, sorted by upload date. |
| **Status**          |                                                                                      |
| **Actual Result**   |                                                                                      |

### VER-010: Approve company document

| Field               | Value                                                                                         |
| ------------------- | --------------------------------------------------------------------------------------------- |
| **Priority**        | P0                                                                                            |
| **Preconditions**   | Admin logged in, pending company document exists                                              |
| **Steps**           | 1. `PUT /api/admin/verification/{id}` with `{ action: "approve" }`                            |
| **Expected Result** | 200 OK. CompanyDocument `verificationStatus: APPROVED`, `verifiedAt` set, `verifiedById` set. |
| **Status**          |                                                                                               |
| **Actual Result**   |                                                                                               |

### VER-011: Reject company document with reason

| Field               | Value                                                                                           |
| ------------------- | ----------------------------------------------------------------------------------------------- |
| **Priority**        | P1                                                                                              |
| **Preconditions**   | Admin logged in, pending document                                                               |
| **Steps**           | 1. `PUT /api/admin/verification/{id}` with `{ action: "reject", reason: "Illegible document" }` |
| **Expected Result** | 200 OK. `verificationStatus: REJECTED`, `rejectionReason` stored.                               |
| **Status**          |                                                                                                 |
| **Actual Result**   |                                                                                                 |

### VER-012: Verify organization

| Field               | Value                                                                   |
| ------------------- | ----------------------------------------------------------------------- |
| **Priority**        | P1                                                                      |
| **Preconditions**   | Admin logged in, all org documents approved                             |
| **Steps**           | 1. `PUT /api/admin/organizations/{id}/verify` with `{ verified: true }` |
| **Expected Result** | 200 OK. Organization `isVerified: true`, `verifiedAt` set.              |
| **Status**          |                                                                         |
| **Actual Result**   |                                                                         |

### VER-013: Verification status affects access

| Field               | Value                                                                        |
| ------------------- | ---------------------------------------------------------------------------- |
| **Priority**        | P2                                                                           |
| **Preconditions**   | Unverified user logged in                                                    |
| **Steps**           | 1. Login as `unverified@test.com` 2. Try to `POST /api/loads`                |
| **Expected Result** | Blocked by middleware. Redirected to verification-pending page or 403 error. |
| **Status**          |                                                                              |
| **Actual Result**   |                                                                              |

---

## D. Document Types & Edge Cases (VER-014 to VER-016)

### VER-014: All company document types uploadable

| Field               | Value                                                                                                                                          |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                                                                             |
| **Preconditions**   | Logged in with org                                                                                                                             |
| **Steps**           | 1. Upload documents with each type: `COMPANY_LICENSE`, `TIN_CERTIFICATE`, `BUSINESS_REGISTRATION`, `TRADE_LICENSE`, `VAT_CERTIFICATE`, `OTHER` |
| **Expected Result** | All 6 types accepted and stored correctly.                                                                                                     |
| **Status**          |                                                                                                                                                |
| **Actual Result**   |                                                                                                                                                |

### VER-015: All truck document types uploadable

| Field               | Value                                                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| **Priority**        | P2                                                                                                                          |
| **Preconditions**   | Logged in as carrier, truck exists                                                                                          |
| **Steps**           | 1. Upload documents with each type: `TITLE_DEED`, `REGISTRATION`, `INSURANCE`, `ROAD_WORTHINESS`, `DRIVER_LICENSE`, `OTHER` |
| **Expected Result** | All 6 types accepted.                                                                                                       |
| **Status**          |                                                                                                                             |
| **Actual Result**   |                                                                                                                             |

### VER-016: Re-upload after rejection

| Field               | Value                                                                                 |
| ------------------- | ------------------------------------------------------------------------------------- |
| **Priority**        | P3                                                                                    |
| **Preconditions**   | Document previously rejected                                                          |
| **Steps**           | 1. Upload new document for same type after rejection                                  |
| **Expected Result** | New document created with `PENDING` status. Old rejected document remains in history. |
| **Status**          |                                                                                       |
| **Actual Result**   |                                                                                       |
