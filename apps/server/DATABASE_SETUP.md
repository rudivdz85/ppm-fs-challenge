# Database Setup Guide

This guide explains how to set up and use the hierarchical permission system database.

## Prerequisites

- PostgreSQL 12+ installed and running
- Node.js 16+ installed
- npm or yarn package manager

## Quick Start

1. **Create Database**
   ```bash
   createdb ppm_challenge
   ```

2. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Run Migrations and Seed Data**
   ```bash
   npm run db:reset
   ```

## Environment Configuration

### Database Connection

The application supports two connection methods:

**Method 1: Connection String (Recommended)**
```env
DATABASE_URL=postgresql://username:password@localhost:5432/ppm_challenge
```

**Method 2: Individual Parameters**
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ppm_challenge
DB_USER=postgres
DB_PASSWORD=your_password
```

### Required Environment Variables

```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/ppm_challenge

# Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
BCRYPT_SALT_ROUNDS=12

# Application
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

## Database Operations

### Migration Commands

| Command | Description |
|---------|-------------|
| `npm run migrate` | Run all pending migrations |
| `npm run migrate:reset` | Drop all tables and re-run migrations |
| `npm run migrate:status` | Show migration status |

### Seed Data Commands

| Command | Description |
|---------|-------------|
| `npm run seed` | Populate database with development data |
| `npm run seed:status` | Show current database status |

### Combined Commands

| Command | Description |
|---------|-------------|
| `npm run db:reset` | Full reset: migrate + seed |

## Database Schema

### Tables Overview

1. **hierarchy_structures** - Hierarchical organization units
2. **users** - User accounts with base hierarchy assignment
3. **permissions** - Role-based access control for hierarchies
4. **migrations_log** - Migration execution tracking

### Hierarchy Structure

The seeded data creates this hierarchy:

```
🌍 Australia (National)
├── 🏙️ Sydney (City)
│   ├── 🏘️ Bondi (Suburb)
│   ├── 🏘️ Manly (Suburb)
│   └── 🏘️ Parramatta (Suburb)
└── 🏙️ Melbourne (City)
    ├── 🏘️ St Kilda (Suburb)
    └── 🏘️ Richmond (Suburb)
```

### Test Users and Credentials

| User | Email | Password | Base Location | Role |
|------|-------|----------|---------------|------|
| National Administrator | admin@australia.gov.au | SecurePass123! | Australia | Admin (all) |
| Sydney Manager | manager@sydney.nsw.gov.au | SydneyManager2024! | Sydney | Manager (Sydney+) |
| Melbourne Manager | manager@melbourne.vic.gov.au | MelbManager2024! | Melbourne | Manager (Melbourne+) |
| Bondi Staff | staff@bondi.nsw.gov.au | BondiStaff2024! | Bondi | Read (Bondi only) |
| Manly Staff | staff@manly.nsw.gov.au | ManlyStaff2024! | Manly | Read (Manly only) |
| St Kilda Staff | staff@stkilda.vic.gov.au | StKildaStaff2024! | St Kilda | Read (St Kilda only) |
| Test User | test@example.com | TestUser2024! | Bondi | Mixed permissions |

### Permission Roles

- **admin**: Full access (create, read, update, delete)
- **manager**: Management access (create, read, update)
- **read**: Read-only access

### Permission Inheritance

Permissions can be set to inherit to descendant hierarchies:
- National admin → Access to all cities and suburbs
- City manager → Access to city and all its suburbs
- Local staff → Access only to their specific suburb

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure PostgreSQL is running
   - Check credentials in .env file
   - Verify database exists

2. **Migration Fails**
   - Check database permissions
   - Ensure PostgreSQL extensions are available (uuid-ossp, ltree)
   - Run `npm run migrate:reset` to start fresh

3. **Seed Data Issues**
   - Ensure migrations ran successfully first
   - Check for existing data conflicts
   - Run `npm run db:reset` for clean start

### Manual Database Setup

If automatic setup fails, create the database manually:

```sql
-- Create database
CREATE DATABASE ppm_challenge;

-- Connect to database
\c ppm_challenge;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "ltree";
```

### Checking Database Status

```bash
# Check migration status
npm run migrate:status

# Check seed data status
npm run seed:status

# View database structure
psql ppm_challenge -c "\dt"  # List tables
psql ppm_challenge -c "\d+ hierarchy_structures"  # Table details
```

## Development Workflow

1. **Initial Setup**
   ```bash
   npm run db:reset
   ```

2. **Making Schema Changes**
   - Create new migration file in `src/database/migrations/`
   - Use format: `XXX_description.sql`
   - Run: `npm run migrate`

3. **Updating Seed Data**
   - Modify `src/database/seeds/dev-seed.ts`
   - Run: `npm run seed`

4. **Testing Changes**
   ```bash
   npm run db:reset  # Fresh start
   npm test          # Run tests
   ```

## Production Deployment

### Environment Setup

```env
NODE_ENV=production
DATABASE_URL=postgresql://user:pass@host:5432/prod_db
JWT_SECRET=secure-production-secret-minimum-32-characters
BCRYPT_SALT_ROUNDS=14
DB_POOL_MAX=10
CORS_ORIGIN=https://yourdomain.com
LOG_LEVEL=warn
```

### Database Migration

```bash
# Production migration (no seed data)
NODE_ENV=production npm run migrate
```

**⚠️ Warning**: Never run seed commands in production as they clear existing data.

## Security Considerations

1. **Environment Variables**
   - Use strong, unique JWT secrets in production
   - Store sensitive credentials securely
   - Never commit .env files to version control

2. **Database Security**
   - Use connection pooling limits
   - Enable SSL for production connections
   - Regularly update PostgreSQL

3. **Password Security**
   - All passwords are bcrypt hashed
   - Salt rounds configurable via BCRYPT_SALT_ROUNDS
   - Minimum 12 rounds recommended for production

## API Integration

Once the database is set up, the API endpoints will be available:

- `POST /api/auth/login` - User authentication
- `GET /api/hierarchies` - List hierarchies with user permissions
- `GET /api/users` - List users (with proper permissions)
- `POST /api/permissions` - Grant permissions (admin only)
- `DELETE /api/permissions/:id` - Revoke permissions

See the API documentation for detailed endpoint specifications.