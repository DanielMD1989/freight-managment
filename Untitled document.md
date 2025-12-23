# **1️⃣ CONVERTED DOCUMENT CONTENT**

## **(PDF / DOCX / PPT – SAME STRUCTURE)**

---

## **📘 TECHNICAL REQUIREMENTS DOCUMENT (TRD v2)**

### **Project**

**Digital Freight Platform – Ethiopia**

### **Delivery Model**

**MVP (Phase 1\) → Phase 2 Expansion**

### **Core Principles (LOCKED)**

* Two-sided commission (shipper \+ carrier)

* Two-account financial model (wallets \+ escrow)

* Hardware GPS tracking

* Web-first architecture

* Full auditability

* No re-architecture between phases

---

## **1\. SYSTEM OBJECTIVE**

### **MVP (Phase 1\)**

Deliver a **commercially usable and monetizable digital freight platform** that includes:

* Load & truck marketplace

* Advanced search & refine

* Real-time GPS tracking (hardware)

* Escrow-based freight payments

* Two-sided commission

* Admin & operations control

* Trust & compliance features

**Driver mobile execution is intentionally excluded.**

### **Phase 2**

Add operational execution and intelligence:

* Driver mobile app

* Reviews & ratings

* Lane makers

* Hot market heat maps

* Finance automation

---

## **2\. USER ROLES (ALL PHASES)**

| Role | Description |
| ----- | ----- |
| Shipper | Posts loads, funds escrow |
| Carrier (Company) | Accepts loads, assigns trucks |
| Carrier (Individual) | Single-truck carrier |
| Logistics Agent (3PL) | Acts on behalf of shippers |
| Driver | Executes loads (Phase 2\) |
| Platform Ops | Dispatch, disputes |
| Admin | Full system control |

---

## **3\. MVP FUNCTIONAL SCOPE**

### **3.1 Load Management**

* Auto-saved drafts (KEPT)

* Post / Unpost

* Edit / Delete (before assignment)

* Copy / Duplicate loads

* Dock hours:

  * Pickup dock hours

  * Delivery dock hours

  * Appointment required flag

* Safety notes

* Anonymous shipper option

**Posting Statuses**

* Draft (Kept)

* Posted

* Unposted

* Expired

---

### **3.2 Search & Marketplace**

**Load Search**

* Origin / destination

* Date range

* Truck type

* Rate range

* Weight

* Full / Partial

* Anonymous filter

**Truck Search**

* Truck type

* Capacity

* GPS region

* Availability

---

### **3.3 Company Profiles (Trust Layer)**

* Company details

* Verification badge

* Completed loads count

* Dispute count

* Fleet size (carriers)

(Reviews deferred to Phase 2\)

---

### **3.4 Dispatch (MVP)**

Supports:

* Self-dispatch

* Platform dispatch

**Hard validations**

* Truck compatibility

* GPS assigned

* Escrow funded

* Wallet balances sufficient

---

### **3.5 Financial System (MVP)**

**Accounts**

* Shipper Commission Wallet (org-level)

* Carrier Commission Wallet (org-level)

* Escrow Account

* Platform Revenue Account

**Rules**

* Wallets \= liability

* Escrow \= trust

* Settlement only after POD

* Manual settlement (ops-triggered)

---

### **3.6 GPS Engine (MVP)**

* Hardware GPS only

* IMEI ↔ Truck binding

* Live tracking (10–30 sec)

* Admin global GPS map

* Carrier fleet view

* Signal loss detection

---

### **3.7 Admin & Ops Dashboard**

* Global load grid

* Dispatch override

* Live GPS map

* User & org management

* Wallet & escrow monitoring

* Dispute handling

* Report bad behavior

---

### **3.8 Help Center (MVP)**

* Help / FAQ

* Report bad behavior

* Email \+ phone support

---

## **4\. PHASE 2 FEATURES**

* Driver mobile app (full load packet, POD, offline)

* Reviews & ratings

* Lane makers

* Hot market heat map

* Finance automation (auto payout, refunds)

---

# **2️⃣ MVP-ONLY ER DIAGRAM**

(**Build this first – NO Phase 2 noise**)

`erDiagram`  
  `ORGANIZATIONS ||--o{ USERS : has`  
  `ORGANIZATIONS ||--o{ TRUCKS : owns`  
  `TRUCKS ||--o{ GPS_POSITIONS : generates`  
  `TRUCKS ||--|| GPS_DEVICES : assigned`  
  `ORGANIZATIONS ||--o{ LOADS : posts`  
  `LOADS ||--o{ LOAD_EVENTS : logs`  
  `LOADS ||--o{ DOCUMENTS : has`  
  `LOADS ||--o{ DISPUTES : may_have`

  `ORGANIZATIONS ||--o{ FINANCIAL_ACCOUNTS : owns`  
  `FINANCIAL_ACCOUNTS ||--o{ JOURNAL_LINES : records`  
  `JOURNAL_ENTRIES ||--o{ JOURNAL_LINES : contains`  
  `PAYMENTS_EXTERNAL ||--|| JOURNAL_ENTRIES : triggers`

  `USERS {`  
    `uuid id`  
    `string role`  
    `string phone`  
  `}`

  `LOADS {`  
    `uuid id`  
    `string status`  
    `numeric rate_etb`  
    `string pickup_city`  
    `string destination_city`  
  `}`

  `FINANCIAL_ACCOUNTS {`  
    `uuid id`  
    `enum account_type`  
    `string currency`  
  `}`

✅ This ERD supports:

* Marketplace

* GPS

* Finance

* Admin control  
   ❌ No driver app yet (by design)

---

# **3️⃣ PHASE 2 – DELTA ER DIAGRAM**

(**Only what is ADDED or EXTENDED**)

`erDiagram`  
  `USERS ||--o{ DRIVER_JOBS : assigned`  
  `LOADS ||--|| DRIVER_JOBS : executes`  
  `LOADS ||--o{ REVIEWS : rated`  
  `ORGANIZATIONS ||--o{ REVIEWS : receives`

  `LANE_DEFINITIONS ||--o{ LANE_STATS : aggregates`  
  `GPS_POSITIONS ||--o{ HEATMAP_AGGREGATES : feeds`

  `DRIVER_JOBS {`  
    `uuid id`  
    `enum status`  
    `timestamp started_at`  
    `timestamp completed_at`  
  `}`

  `REVIEWS {`  
    `uuid id`  
    `int rating`  
    `string comment`  
  `}`

  `LANE_DEFINITIONS {`  
    `uuid id`  
    `string origin`  
    `string destination`  
  `}`

✅ Phase 2 **extends** MVP  
 ❌ No schema rewrite  
 ❌ No breaking changes

---

# **4️⃣ DEVELOPER SPRINT BREAKDOWN**

(**REALISTIC – NOT THEORY**)

---

## **🟢 MVP DEVELOPMENT PLAN (12–14 Weeks)**

### **Sprint 1 – Foundation (Week 1–2)**

* Auth & RBAC

* Organizations & users

* Admin scaffolding

* Project setup (CI/CD)

---

### **Sprint 2 – Marketplace Core (Week 3–4)**

* Load CRUD

* Draft / post / unpost

* Edit / delete / copy

* Dock hours

* Anonymous shipper logic

---

### **Sprint 3 – Search & Profiles (Week 5–6)**

* Load search \+ refine box

* Truck posting & search

* Company profiles

* Verification flags

---

### **Sprint 4 – GPS Engine (Week 7–8)**

* GPS ingestion (TCP/UDP)

* IMEI ↔ truck mapping

* Live map (admin \+ carrier)

* Signal loss detection

---

### **Sprint 5 – Finance Core (Week 9–10)**

* Wallets & escrow

* Ledger & journal entries

* Payment provider integration

* Manual settlement

---

### **Sprint 6 – Admin & Stabilization (Week 11–12)**

* Admin dashboards

* Dispatch override

* Disputes

* Reports

* QA hardening

---

## **🔵 PHASE 2 DEVELOPMENT PLAN (8–10 Weeks)**

### **Sprint 7 – Driver App (Weeks 1–3)**

* Driver authentication

* Job list

* Full load packet

* Status updates

---

### **Sprint 8 – POD & Reviews (Weeks 4–5)**

* POD upload

* Review & rating system

---

### **Sprint 9 – Intelligence (Weeks 6–7)**

* Lane makers

* Market analytics

* Heat maps

---

### **Sprint 10 – Finance Automation (Weeks 8–9)**

* Auto payouts

* Refund flows

* Threshold alerts

