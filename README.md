# Backend Ledger API

Backend Ledger is a Node.js + Express + MongoDB API for user authentication, account management, and ledger-based transfers. It stores users, accounts, transaction records, and immutable ledger entries, and it uses JWT access/refresh tokens plus device-aware session tracking.

## Prerequisites

- Node.js installed to run the project (`npm start` / `npm run dev`)
- MongoDB running and reachable via `MONGO_URI` (local MongoDB or MongoDB Atlas)
- A frontend or HTTP client that can send JSON requests and hold cookies for authenticated routes
- Email notifications require Gmail OAuth configuration (`EMAIL_USER`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`)

## Installation

1. In the project root, install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file with the environment variables listed below.
3. Start the API:
   ```bash
   npm start
   ```
4. For development mode with auto-reload:
   ```bash
   npm run dev
   ```

## Environment variables

Set these in a local `.env` file or the deployment environment. Do not add real secrets to this README.

```env
PORT=
CLIENT_URL=
MONGO_URI=
JWT_SECRET=
EMAIL_USER=
CLIENT_ID=
CLIENT_SECRET=
REFRESH_TOKEN=
NODE_ENV=
```

Notes from the code:
- `PORT` defaults to `8000` if unset.
- `CLIENT_URL` is used by CORS.
- `MONGO_URI` is required for the Mongoose connection.
- `JWT_SECRET` signs the JWTs used by the auth flow.
- Email transport uses Gmail OAuth (`EMAIL_USER`, `CLIENT_ID`, `CLIENT_SECRET`, `REFRESH_TOKEN`).

## How the app starts

- `server.js` loads `dotenv` and calls `connectDb()` before listening.
- `app.listen(PORT, ...)` starts the server on `PORT` or `8000`.
- `src/app.js` sets up the HTTP app:
  - `express-rate-limit` with 100 requests per 15-minute window
  - CORS with credentials enabled
  - JSON + URL-encoded parsers
  - cookie parsing
  - `GET /health`
  - mounts `/api/v1` routes

## API endpoints

| Method | Endpoint | Auth required | Request body / params | Notes |
| --- | --- | --- | --- | --- |
| GET | `/health` | No | None | Simple health check |
| POST | `/api/v1/auth/register` | No | `name`, `email`, `password` | Creates a user, starts a session, sets cookies, returns user + access token |
| POST | `/api/v1/auth/login` | No | `email`, `password` | Validates credentials, updates session for same IP/user-agent, sets cookies |
| GET | `/api/v1/auth/logout` | Yes (`verifyUser`) | Cookies only | Blacklists current refresh token and invalidates that session |
| GET | `/api/v1/auth/logout-all` | Yes (`verifyUser`) | Cookies only | The system identifies all active sessions where the user ID matches the current user. For each matching session, it clears the stored refresh token hash by setting it to null and marks the session as revoked. |
| GET | `/api/v1/auth/rotate-token` | No direct session check in code | Cookies: `refresh_token` | Reissues access + refresh cookies |
| POST | `/api/v1/account/create` | Yes (`verifyUser`) | `currency` (optional), `status` (optional) | Defaults to `INR` and `ACTIVE`; prevents duplicate account combos |
| GET | `/api/v1/account/accounts` | Yes (`verifyUser`) | None | Returns accounts owned by the logged-in user |
| GET | `/api/v1/account/balance/:accountId` | Yes (`verifyUser`) | URL param `accountId` | Returns current account balance |
| POST | `/api/v1/transaction/create` | Yes (`verifyUser`) | `fromAccount`, `toAccount`, `amount`, `idempotencyKey` | Performs a transfer with idempotency checks |
| POST | `/api/v1/transaction/initial-funds` | Yes (`verifySystemUser`) | `toAccount`, `amount`, `idempotencyKey` | Special system-user credit route |

## Authentication and session behavior

Auth uses JWT tokens plus per-device session records.

- `register` and `login` generate:
  - access token: 15 minutes
  - refresh token: 7 days
- Cookies set by the app:
  - `access_token`
  - `refresh_token`
- Cookie flags set in code:
  - `httpOnly: true`
  - `secure: true`
  - `sameSite: "strict"`
- `Session` documents store:
  - `userId`
  - `ip`
  - `userAgent`
  - `refreshHash` (bcrypt hash of refresh token)
  - `invoked` flag
- Protected routes use `verifyUser`, which:
  1. reads the access token from cookie or `Authorization: Bearer ...`
  2. reads the refresh token from cookie
  3. checks the refresh token against the blacklist
  4. verifies JWT
  5. loads the user
  6. loads the session using same `userId`, `ip`, and `userAgent`
  7. compares the refresh cookie token with `session.refreshHash`
  8. sets `req.user` before continuing
- `verifySystemUser` adds an extra requirement: the user must have `systemUser: true`.
- `logout` blacklists the current refresh token and marks the current session as `invoked: true` with `refreshHash: null`.
- `logout-all` blacklists all active refresh hashes for the current user and clears cookies.
- `rotate-token` reads the refresh token and reissues new `access_token` and `refresh_token` cookies.

## Transaction and idempotency behavior

The project models money movement with both a `Transaction` record and ledger entries.

- `Transaction` requires:
  - `fromAccount`
  - `toAccount`
  - `amount` (`min: 1`)
  - `idempotencyKey` (unique)
- `Ledger` stores per-account balance movement entries with:
  - `accountId`
  - `transactionId`
  - `amount`
  - `type`: `DEBIT` or `CREDIT`
- `Ledger` entries are intentionally immutable; pre-save hooks block update/delete/replace operations.
- Before creating a transfer, the app checks `Transaction.findOne({ idempotencyKey })`.
- If the same idempotency key already exists, the app returns a status-based response:
  - `SUCCESS` => 200
  - `PENDING` => 200
  - `FAILED` / `REVERSED` => 400
  - other duplicate cases => 400
- For a transfer to proceed, the code enforces:
  - both accounts exist
  - `fromAccount` belongs to the authenticated user
  - both accounts are `ACTIVE`
  - source balance is sufficient
- The transfer is executed in a MongoDB transaction session:
  1. Create a transaction row with status `PENDING`
  2. Create the debit ledger record for the sender
  3. Create the credit ledger record for the receiver
  4. Update the transaction status to `SUCCESS`
  5. Commit the transaction
- Duplicate-key Mongo errors are handled by re-fetching the transaction by `idempotencyKey` and returning the existing result.
- Email notification is attempted after a successful transfer, but email failures are only logged and do not roll back the transfer.

## Account and balance rules

- `Account` fields:
  - `userId`
  - `status`: `ACTIVE`, `FROZEN`, or `CLOSED`
  - `currency`: defaults to `INR`
- `getBalance()` aggregates ledger credits and debits for the account and returns `totalCredit - totalDebit`.
- Duplicate accounts are rejected when the same `userId + currency + status` combination already exists.

## Important limitations and caveats

- This repo contains only the backend API; there is no built-in frontend or admin UI.
- There is no public route in this codebase for creating an account with `systemUser: true`.So you have to change in database for creating a system user
- `initial-funds` is a special system-user fund injection route; it does not create a debit ledger entry for the system user account in the current implementation.
- Email sending is best-effort and does not affect transaction success.
- There is no pagination, filtering, or listing API for transactions beyond the account and balance endpoints shown in this project.

## Summary

This backend exposes a basic ledger system with secure cookie-based authentication, device-aware sessions, immutable ledger accounting, and idempotent transfer processing. It is designed for MongoDB-backed financial operations but does not include a broad admin or audit layer beyond the code shown here.
