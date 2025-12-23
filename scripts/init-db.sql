-- Freight Management Platform Database Initialization
-- This script runs when the PostgreSQL container is first created

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search

-- Set timezone
SET timezone = 'UTC';

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE freight_db TO freight_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO freight_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO freight_user;

-- Note: Prisma migrations will create the actual tables
-- This script just sets up the database environment
