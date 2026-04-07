# 🚛 Freight Management Platform - MVP

[![CI](https://github.com/DanielMD1989/freight-managment/actions/workflows/ci.yml/badge.svg)](https://github.com/DanielMD1989/freight-managment/actions/workflows/ci.yml)
[![E2E Functional](https://github.com/DanielMD1989/freight-managment/actions/workflows/e2e-functional.yml/badge.svg)](https://github.com/DanielMD1989/freight-managment/actions/workflows/e2e-functional.yml)

A comprehensive freight management platform for connecting shippers and carriers in Ethiopia, with real-time GPS tracking, financial management, and marketplace functionality.

## 🌟 Features

### Sprint 1: Foundation ✅

- **Authentication & Authorization**
  - Email/phone + password registration
  - JWT-based authentication with HTTP-only cookies
  - Role-based access control (RBAC)
  - Roles: Shipper, Carrier, 3PL, Driver, Platform Ops, Admin

- **Organization Management**
  - Multi-organization support
  - Organization verification system
  - Automatic financial account creation

### Sprint 2: Marketplace Core ✅

- **Load Management**
  - Create, edit, and delete loads
  - Draft and publish workflow
  - Load lifecycle tracking (events)
  - Anonymous shipper option
  - Auto-save functionality

### Sprint 3: Search & Profiles ✅

- **Truck Management**
  - Fleet management for carriers
  - Truck type and capacity tracking
  - Availability status
  - GPS device assignment

- **Search Functionality**
  - Advanced load search (origin, destination, truck type, date, rate)
  - Truck search with filters

### Sprint 4: GPS Engine ✅

- **Real-time Tracking**
  - GPS device registration
  - Position data ingestion API
  - Live tracking support
  - Signal loss detection
  - Hardware device integration ready

### Sprint 5: Finance Core ✅

- **Wallet System**
  - Organization-level wallets
  - Double-entry ledger system
  - Deposit and withdrawal management
  - Transaction history

- **Escrow Management**
  - Automated escrow on load assignment
  - Platform commission handling
  - Balance validation

### Sprint 6: Admin & Operations ✅

- **Admin Dashboard**
  - System statistics API
  - User management
  - Financial monitoring

- **Dispatch System**
  - Ops-initiated dispatch
  - Carrier self-dispatch
  - Validation checks (truck type, GPS, balance)
  - Escrow funding

## 🛠️ Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Database:** PostgreSQL 15+
- **ORM:** Prisma 7
- **Authentication:** JWT (jose)
- **Styling:** Tailwind CSS
- **Validation:** Zod
- **Containerization:** Docker & Docker Compose

## 📋 Prerequisites

- Node.js 20+ ([Download](https://nodejs.org/))
- Docker & Docker Compose ([Download](https://docs.docker.com/get-docker/))
- Git

## 🚀 Quick Start

### Option 1: Automated Setup (Recommended)

```bash
# Run the automated setup script
chmod +x scripts/setup-dev.sh
./scripts/setup-dev.sh

# Start the development server
npm run dev
```

### Option 2: Manual Setup

```bash
# 1. Start Docker Services
docker-compose -f docker-compose.dev.yml up -d

# 2. Install Dependencies
npm install

# 3. Generate Prisma Client
npm run db:generate

# 4. Run Database Migrations
npm run db:migrate

# 5. Start Development Server
npm run dev

# Access:
# App: http://localhost:3000
# pgAdmin: http://localhost:5050 (admin@freight.local / admin)
```

## 📊 Database Configuration

**Development Database (Docker):**

```
Host: localhost
Port: 5432
Database: freight_db
User: freight_user
Password: freight_password
```

Connection string in `.env.local`:

```env
DATABASE_URL="postgresql://freight_user:freight_password@localhost:5432/freight_db?schema=public"
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server
npm run lint             # Run ESLint
npm run format           # Format with Prettier

# Database
npm run db:generate      # Generate Prisma Client
npm run db:migrate       # Run migrations
npm run db:deploy        # Deploy migrations (production)
npm run db:studio        # Open Prisma Studio

# Docker
docker-compose -f docker-compose.dev.yml up -d     # Start dev services
docker-compose -f docker-compose.dev.yml down      # Stop dev services
```

## 📁 Project Structure

```
freight-management/
├── app/                     # Next.js app directory
│   ├── api/                # API routes
│   │   ├── admin/         # Admin endpoints
│   │   ├── auth/          # Authentication
│   │   ├── dispatch/      # Dispatch system
│   │   ├── financial/     # Wallet & transactions
│   │   ├── gps/           # GPS tracking
│   │   ├── loads/         # Load management
│   │   ├── organizations/ # Organization management
│   │   └── trucks/        # Truck management
│   ├── dashboard/         # Dashboard pages
│   ├── login/             # Login page
│   └── register/          # Registration page
├── lib/                   # Shared libraries
│   ├── auth.ts           # Authentication utilities
│   ├── db.ts             # Prisma client
│   └── rbac/             # RBAC system
├── prisma/               # Database
│   ├── schema.prisma    # Database schema
│   └── migrations/      # Migration files
├── scripts/              # Setup scripts
├── docker-compose.yml    # Production docker config
└── docker-compose.dev.yml # Development docker config
```

## 🌐 API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user

### Organizations

- `POST /api/organizations` - Create organization
- `GET /api/organizations` - List organizations
- `GET /api/organizations/me` - Get my organization
- `PATCH /api/organizations/[id]` - Update organization

### Loads

- `POST /api/loads` - Create load
- `GET /api/loads` - List/search loads
- `GET /api/loads/[id]` - Get load details
- `PATCH /api/loads/[id]` - Update load
- `DELETE /api/loads/[id]` - Delete load

### Trucks

- `POST /api/trucks` - Create truck
- `GET /api/trucks` - List/search trucks

### GPS

- `POST /api/gps/devices` - Register GPS device
- `GET /api/gps/devices` - List GPS devices
- `POST /api/gps/positions` - Receive GPS data
- `GET /api/gps/positions` - Get GPS positions

### Financial

- `GET /api/financial/wallet` - Get wallet balance
- `POST /api/financial/wallet` - Deposit funds
- `POST /api/financial/withdraw` - Request withdrawal

### Dispatch

- `POST /api/dispatch` - Assign truck to load

### Admin

- `GET /api/admin/dashboard` - Get dashboard stats
- `GET /api/admin/users` - List all users
- `PATCH /api/admin/users` - Update user role

## 🔒 Permissions System

| Role                | Key Permissions                                  |
| ------------------- | ------------------------------------------------ |
| **SHIPPER**         | Create/manage loads, wallet operations           |
| **CARRIER**         | Create/manage trucks, accept loads, GPS tracking |
| **LOGISTICS_AGENT** | Combined shipper + carrier permissions           |
| **DRIVER**          | View loads, trucks, GPS                          |
| **PLATFORM_OPS**    | Dispatch, manage disputes, approve withdrawals   |
| **ADMIN**           | All permissions                                  |

## 🐳 Docker Services

### Development

- **PostgreSQL** (5432) - Main database
- **Redis** (6379) - Caching & sessions
- **pgAdmin** (5050) - Database management UI

## 📝 Environment Variables

See `.env.example` for full configuration. Key variables:

```env
DATABASE_URL="postgresql://freight_user:freight_password@localhost:5432/freight_db"
NEXTAUTH_SECRET="your-secret-here"
JWT_SECRET="your-jwt-secret-here"
```

## 🚀 Deployment

### Docker Production

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f app

# Stop
docker-compose down
```

## 📊 Development Progress

**Overall Backend: 90% Complete**

- ✅ Sprint 1: Foundation (64%)
- ✅ Sprint 2: Marketplace Core (80%)
- ✅ Sprint 3: Search & Profiles (69%)
- ✅ Sprint 4: GPS Engine (79%)
- ✅ Sprint 5: Finance Core (81%)
- ✅ Sprint 6: Admin & Stabilization (67%)

See `USER_STORIES_AND_TASKS.md` for detailed tracking.

## 🎯 Next Steps

**Remaining MVP Tasks:**

- [ ] Additional UI components
- [ ] Email notification setup
- [ ] Password reset flow
- [ ] Comprehensive testing

**Phase 2:**

- [ ] Mobile app
- [ ] Advanced analytics
- [ ] Automated settlements
- [ ] Review & rating system

---

**Built for Ethiopian freight transportation 🇪🇹**
