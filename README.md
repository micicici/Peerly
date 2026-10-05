# P2P Learning Platform

A peer-to-peer learning platform where each account can teach and take lessons. One taught hour equals one credit hour. Booking a lesson spends an hour from the learner's balance and credits the teacher. The classroom runs in the browser: WebRTC carries audio and video, and Socket.io carries call signaling plus the shared whiteboard.

## Tech stack

- Angular 19
- NestJS
- PostgreSQL
- WebRTC
- Socket.io

## Requirements

- Node.js 20 or newer
- npm
- PostgreSQL 14 or newer, running locally

## Database

Create a role and database that match `.env.example`:

```sql
CREATE USER p2p WITH PASSWORD 'p2p';
CREATE DATABASE p2p_learn OWNER p2p;
```

On PostgreSQL 15 and later, connect to `p2p_learn` and grant schema access:

```sql
GRANT ALL ON SCHEMA public TO p2p;
```

The API uses these values when the variables are not set in the environment:

| Variable | Default |
| --- | --- |
| `DATABASE_HOST` | `localhost` |
| `DATABASE_PORT` | `5432` |
| `DATABASE_USER` | `p2p` |
| `DATABASE_PASSWORD` | `p2p` |
| `DATABASE_NAME` | `p2p_learn` |
| `JWT_SECRET` | `dev-only-change-me` |
| `JWT_EXPIRES_IN` | `7d` |
| `PORT` | `3000` |
| `ADMIN_EMAILS` | empty |

`ADMIN_EMAILS` is a comma-separated list. Matching addresses receive the admin role at registration.

Copy `.env.example` to `.env` in the repository root when you need different credentials. The seed script reads that file. The API process does not load it on its own, so export the same variables in the shell before `npm run start:dev` if you change them.

## Install

From the repository root:

```bash
cd backend
npm install
cd ../frontend
npm install
```

## Run

Start PostgreSQL, then use two terminals.

Backend:

```bash
cd backend
npm run start:dev
```

Frontend:

```bash
cd frontend
npm start
```

- API: http://localhost:3000
- Health check: http://localhost:3000/health
- Application: http://localhost:4200

TypeORM `synchronize` is enabled, so the schema is created from the entities on startup. That setting is for local development.

## Sample data

The seed script truncates the database, then inserts demo users, subjects, and offerings. It prints login emails when it finishes. Every demo account uses the same password, shown in that output.

```bash
cd backend
npm run seed
```

## Tests

```bash
cd backend
npm test
cd ../frontend
npm test
```

## Layout

- `backend/` — NestJS API, TypeORM entities, and the Socket.io classroom gateway
- `frontend/` — Angular client
- `.env.example` — local database and JWT settings
