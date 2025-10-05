# PPM FS Challenge

A full-stack TypeScript application demonstrating Permission and Hierarchy Management with a monorepo structure.

## 🏗️ Architecture

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS
- **Backend**: Express.js + TypeScript + Node.js
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Shared Packages**: TypeScript types and configurations
- **Containerization**: Docker + Docker Compose

## 🚀 Quick Start

### Prerequisites

- **Node.js** >= 16.0.0
- **npm** >= 8.0.0
- **Docker** and **Docker Compose** (for containerized setup)

### Option 1: Docker Setup (Recommended)

#### Production Build
```bash
# Clone the repository
git clone https://github.com/rudivdz85/ppm-fs-challenge.git
cd ppm-fs-challenge

# Build and start all services
docker-compose up --build

# Access the application
# Frontend: http://localhost
# Backend API: http://localhost:3000
# Database: localhost:5432
```

#### Development with Hot Reload
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up --build

# Access the application
# Frontend: http://localhost:5173
# Backend API: http://localhost:3000
# Database: localhost:5432
```

### Option 2: Local Development Setup

#### 1. Install Dependencies
```bash
# Install all workspace dependencies
npm install

# Build shared types package
npm run build:types
```

#### 2. Database Setup
```bash
# Start only PostgreSQL and Redis
docker-compose up postgres redis -d

# Or install and configure PostgreSQL locally
# Database: ppm_challenge
# User: postgres
# Password: postgres
```

#### 3. Environment Configuration
```bash
# Server environment
cp apps/server/.env.example apps/server/.env

# Client environment (if needed)
cp apps/client/.env.example apps/client/.env
```

#### 4. Start Development Servers
```bash
# Start both client and server
npm run dev

# Or start individually
npm run dev:server  # Backend on :3000
npm run dev:client  # Frontend on :5173
```

## 🐳 Docker Commands

### Production
```bash
# Build and start all services
docker-compose up --build

# Start in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Remove volumes (careful: deletes data)
docker-compose down -v
```

### Development
```bash
# Start development environment
docker-compose -f docker-compose.dev.yml up --build

# Rebuild specific service
docker-compose -f docker-compose.dev.yml up --build server

# View service logs
docker-compose -f docker-compose.dev.yml logs -f client
```

### Useful Docker Commands
```bash
# View running containers
docker ps

# Access container shell
docker exec -it ppm-server /bin/sh
docker exec -it ppm-postgres psql -U postgres -d ppm_challenge

# Clean up Docker resources
docker system prune -a
docker volume prune
```

## 📁 Project Structure

```
ppm-fs-challenge/
├── apps/
│   ├── client/                 # React frontend
│   │   ├── src/
│   │   ├── Dockerfile
│   │   └── package.json
│   └── server/                 # Express backend
│       ├── src/
│       ├── Dockerfile
│       └── package.json
├── packages/
│   ├── types/                  # Shared TypeScript types
│   └── config/                 # Shared configurations
├── docker/
│   └── init-db/               # Database initialization
├── docker-compose.yml          # Production setup
├── docker-compose.dev.yml      # Development setup
└── package.json               # Workspace configuration
```

## 🛠️ Available Scripts

### Root Workspace
```bash
npm run dev              # Start both client and server
npm run build           # Build all packages
npm run build:types     # Build shared types only
npm run dev:server      # Start server only
npm run dev:client      # Start client only
npm run lint           # Lint all packages
npm run test           # Test all packages
npm run format         # Format code with Prettier
```

### Individual Packages
```bash
# Server (apps/server)
npm run dev            # Development with hot reload
npm run build          # Build for production
npm run start          # Start production build

# Client (apps/client)
npm run dev            # Development server
npm run build          # Build for production
npm run preview        # Preview production build

# Types (packages/types)
npm run build          # Compile TypeScript definitions
npm run dev            # Watch mode compilation
```

## 🗃️ Database

### Schema Overview
- **users**: User accounts and profiles
- **roles**: User roles with hierarchical levels
- **permissions**: Granular permissions system
- **hierarchies**: Organizational structures
- **Junction tables**: Many-to-many relationships

### Default Data
- **Admin User**: `admin@ppm-challenge.local`
- **Roles**: Super Admin, Admin, Manager, User, Guest
- **Permissions**: User management, role assignment, system administration

### Database Access
```bash
# Connect to PostgreSQL (Docker)
docker exec -it ppm-postgres psql -U postgres -d ppm_challenge

# Connect to PostgreSQL (local)
psql -h localhost -U postgres -d ppm_challenge
```

## 🔧 Configuration

### Environment Variables

**Server (.env)**
```env
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ppm_challenge
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
```

**Client (.env)**
```env
VITE_API_URL=http://localhost:3000
```

## 🚦 API Endpoints

### Health Check
```bash
GET /health
```

### Authentication (Planned)
```bash
POST /auth/login
POST /auth/register
POST /auth/refresh
POST /auth/logout
```

### Users (Planned)
```bash
GET    /users
POST   /users
GET    /users/:id
PUT    /users/:id
DELETE /users/:id
```

## 🧪 Development Workflow

1. **Feature Development**
   - Import shared types from `@ppm/types`
   - Follow established patterns in client/server
   - Use TypeScript strict mode
   - Follow ESLint and Prettier configurations

2. **Database Changes**
   - Add migration scripts to `docker/init-db/`
   - Update type definitions in `packages/types/`
   - Rebuild types package: `npm run build:types`

3. **Testing**
   - Run linting: `npm run lint`
   - Run tests: `npm run test`
   - Format code: `npm run format`

## 🔍 Monitoring & Health Checks

All services include health checks:

- **Server**: `GET /health`
- **Client**: HTTP 200 response
- **PostgreSQL**: `pg_isready`
- **Redis**: `redis-cli ping`

Monitor with:
```bash
docker-compose ps
docker-compose logs -f [service-name]
```

## 📝 Logging

- **Development**: Console output with colors
- **Production**: Structured JSON logs
- **Docker**: Centralized logging via Docker Compose

## 🛡️ Security Features (planned)

- Helmet.js security headers
- CORS configuration
- Content Security Policy
- SQL injection prevention
- Input validation
- Rate limiting


## 🔗 Links

- [Project Repository](https://github.com/rudivdz85/ppm-fs-challenge)
- [Docker Hub](https://hub.docker.com/) (for base images)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)

---

For detailed documentation, see [PROJECT_GUIDE.txt](./PROJECT_GUIDE.txt)