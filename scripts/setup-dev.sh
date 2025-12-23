#!/bin/bash
# Development Environment Setup Script for Freight Management Platform

set -e

echo "🚛 Freight Management Platform - Development Setup"
echo "================================================="
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    echo "   Visit: https://docs.docker.com/get-docker/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    echo "   Visit: https://nodejs.org/"
    exit 1
fi

echo "✅ Prerequisites check passed"
echo ""

# Start Docker services
echo "🐳 Starting Docker services (PostgreSQL, Redis, pgAdmin)..."
docker-compose -f docker-compose.dev.yml up -d

echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 5

# Check if PostgreSQL is ready
until docker exec freight-postgres-dev pg_isready -U freight_user -d freight_db > /dev/null 2>&1; do
    echo "   Waiting for PostgreSQL..."
    sleep 2
done

echo "✅ PostgreSQL is ready"
echo ""

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Generate Prisma Client
echo "🔧 Generating Prisma Client..."
npm run db:generate

# Run database migrations
echo "🗄️  Running database migrations..."
npm run db:migrate

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "📝 Next steps:"
echo "   1. Start the development server: npm run dev"
echo "   2. Access the app: http://localhost:3000"
echo "   3. Access pgAdmin: http://localhost:5050"
echo "      Email: admin@freight.local"
echo "      Password: admin"
echo ""
echo "📊 Database connection:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: freight_db"
echo "   User: freight_user"
echo "   Password: freight_password"
echo ""
echo "🛠️  Useful commands:"
echo "   npm run dev          - Start development server"
echo "   npm run db:studio    - Open Prisma Studio"
echo "   npm run db:migrate   - Run migrations"
echo "   npm run build        - Build for production"
echo ""
