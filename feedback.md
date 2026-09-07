## Backend Review — RWA Initial POC

### What works

**Route structure is reasonable.** Six route files map cleanly to the domain: assets, validators, transactions, dashboard, auth, IPFS. Each does one thing. Easy to navigate.

**Validation schemas are thorough.** The Joi schemas in `validation.js` cover asset create/update, user registration, purchases, bids, and validator applications with proper type checks, min/max, and enum constraints. The `validate()` factory pattern is clean.

**The data model captures the domain well.** Assets carry tokenization metadata (fractional/whole, token count, price per token), listing type, validation state, owner info, and specs. This is the right shape for an RWA marketplace — it mirrors what the Solidity contracts define on-chain.

**Mock database is functional for a POC.** Filter/search/pagination in `getAllAssets()` works. The seeded data covers multiple categories and statuses. Good enough for demo purposes.

---

### What's broken or incomplete

**1. Auth is not applied where it matters**

Only `/auth/profile` and `/auth/profile PATCH` use `authenticateToken`. Every other mutation is unprotected:

- `POST /assets` — anyone can create assets, owner is `req.user?.id || 'anonymous'`
- `POST /transactions/purchase` — `buyerId` comes from request body, not the JWT
- `POST /transactions/bid` — same, `bidderId` is client-supplied
- `PATCH /transactions/:id` — anyone can change transaction status
- `POST /transactions/refund` — no auth
- `POST /assets/:id/validation-requests` — `requesterId` falls back to `'anonymous'`
- `GET /dashboard/portfolio/:userId` — anyone can read any user's portfolio

For a POC this is understandable, but it means none of the business logic is actually secure. A user can impersonate another user on every write operation.

**2. `authenticateToken` is duplicated**

Defined locally in `routes/auth.js` (lines 170-185) and also in `middleware/auth.js` (lines 4-19). The middleware file exports a full toolkit — `optionalAuth`, `requireRole`, `corsOptions`, `errorHandler`, `requestLogger`, `securityHeaders` — but `server.js` imports none of it.

**3. Validation middleware is selectively applied**

`validateAsset` and `validateAssetUpdate` are used on asset routes. But `validatePurchase`, `validateBid`, `validateUserRegistration`, `validateUserLogin`, `validateValidatorApplication` — all defined, exported, never imported by their respective routes. Transactions route does manual `if (!assetId || !buyerId)` checks instead.

**4. Login falls through to a hardcoded user**

```javascript
const user = Array.from(db.users.values()).find(u => u.email === email) || mockUser;
```

If the email doesn't match any user, it still attempts password comparison against `mockUser` (password: `password`). This means any unknown email + `password` successfully authenticates as `user1`.

**5. Profile update is a mass-assignment vulnerability**

```javascript
const updatedUser = { ...user, ...req.body, updatedAt: new Date() };
```

A client can POST `{"roles": ["admin"], "kyc": {"status": "verified"}}` and it gets spread directly into the user object.

**6. Purchase doesn't verify price**

`transactions.js` line 40: `totalAmount: amount` — the `amount` comes from the request body. There's no check that `amount === tokens * pricePerToken`. A buyer can claim to pay 1 USDT for a 30,000 USDT asset.

**7. `schemas.js` classes are never used**

`User`, `Asset`, `Transaction`, `Validator` classes with methods like `toggleLike()`, `updateStatus()`, `incLoginAttempts()` are defined but never instantiated. The mock database stores plain objects. There's also a type conflict: `likes` is a number in the seeded data but `toggleLike()` treats it as an array.

**8. Services layer is scaffolding**

`BlockchainService`, `EtherscanService`, `CoinGeckoService`, `WebhookService`, `AnalyticsService` — 320 lines across `external.js`. None are imported by any route or `server.js`. Same with `ipfsService.js` — the IPFS route generates fake hashes inline instead of using it.

**9. Dead imports and missing dependencies**

- `server.js` line 6: `const bppc = require('babel-polyfill-plugin-corejs2')` — imported, never used
- `validators.js` line 4: `const {rateLimit} = require('../middleware/rateLimiting')` — imported, never used
- `config/logger.js` uses `winston` which isn't in `package.json`
- `config/index.js` references `locationToken` that's never defined — would throw on import

---

### Design decisions to make

**1. Pick the source of truth for ownership**

Right now there are three places that claim to know who owns what:
- `asset.owner.id` in the mock DB
- The JWT user identity
- The Solidity contract on-chain (if deployed)

For a real product, the chain is the authority. The backend should read ownership from the contract and cache it, not store it independently. For the POC, at minimum `asset.owner.id` should come from the authenticated user's JWT, not from request body.

**2. Decide on the transaction model**

Current flow: client calls `POST /transactions/purchase` → backend creates a pending record → nothing happens after. There's no:
- Payment confirmation step
- Token transfer trigger
- Status progression (pending → confirmed → settled)
- On-chain tx hash linking

The question is: does the backend orchestrate settlement, or does the frontend call the contract directly and the backend just indexes events? Both are valid. Pick one.

**Option A — Backend orchestrates:** Backend holds a signer, calls `RWABMarketplace.purchaseListing()`, waits for receipt, updates the record. Simpler client. Requires the backend to hold a private key (custodial-ish).

**Option B — Backend indexes:** Frontend calls the contract via MetaMask. Backend listens to `ListingPurchased` events and creates transaction records from on-chain data. Non-custodial. Backend is a read layer + event indexer.

**3. Validator workflow needs a state machine**

The validation flow is: request → validator reviews → approve/reject/request-changes. But there's no endpoint for the validator to actually submit their decision. `POST /assets/:id/validation-requests` creates a request, but nobody can resolve it. Add:
- `PATCH /validation-requests/:id` with status transitions
- Restrict it to the assigned validator (role-based)
- Update the asset status when validation completes

**4. IPFS: real or mock?**

If the POC needs to show document storage, wire `ipfsService.js` or use Pinata's API. If not, remove `ipfs-http-client` and `pinata` from `package.json` — they add weight and confusion.

---

### LLD-level improvements

**1. Extract a service layer between routes and database**

Routes currently call `db.createAsset()`, `db.getAssetById()` directly, mix in business logic (checking statuses, calculating amounts), and return. This leads to:
- Business logic scattered across routes
- No reuse (dashboard recalculates stats inline)
- Hard to test

```
routes/assets.js → AssetService → db (or contract)
routes/transactions.js → TransactionService → db + AssetService
routes/dashboard.js → DashboardService → AssetService + TransactionService
```

Each service owns its domain rules: "can this asset be purchased?", "is this bid valid?", "compute portfolio value". Routes become thin HTTP handlers.

**2. Add a state machine for Asset status**

Asset status transitions are implicit. Any route can set any status via `db.updateAsset(id, { status: 'whatever' })`. Define allowed transitions:

```
pending → validated | rejected | action_required
action_required → pending (resubmit)
validated → listed
listed → sold | delisted
```

Enforce this in `AssetService.updateStatus(id, newStatus)` — reject invalid transitions. This prevents an asset going from `pending` to `sold` without validation.

**3. Replace `Object.assign` / spread updates with whitelisted fields**

Every update endpoint (`PATCH /assets/:id`, `PATCH /auth/profile`, `PATCH /transactions/:id`) spreads the entire request body. Define allowed fields per endpoint:

```javascript
const ALLOWED_PROFILE_FIELDS = ['name', 'profile', 'preferences'];
const updates = pick(req.body, ALLOWED_PROFILE_FIELDS);
```

**4. Async error handling**

All routes use try/catch, but Express 4 doesn't catch rejected promises from async handlers. If any `await` inside a route throws, it may crash the process or hang. Either:
- Wrap routes with `express-async-errors` (one-liner import)
- Or use a wrapper: `const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`

**5. DB abstraction for swap-ability**

`MockDatabase` is fine for now, but routes access `db.assets` (the Map) directly in dashboard routes: `Array.from(db.assets.values())`. Encapsulate all access behind methods. When you move to MongoDB/Postgres, you only change the database class, not every route file.

**6. Tokenization calculation integrity**

When a purchase goes through, `availableTokens` should decrease. Currently it doesn't — the purchase creates a transaction record but never mutates the asset. Same for bids: winning a bid doesn't transfer tokens. Wire this:

```
purchase → asset.availableTokens -= tokens
         → if availableTokens === 0, status = 'sold'
```

---

### What to do next (priority order)

1. **Wire auth middleware to all mutation routes.** Import `authenticateToken` from `middleware/auth.js`, apply to POST/PATCH/DELETE routes. Derive user IDs from JWT, not request body.
2. **Apply existing Joi validators to transactions and auth routes.** They're already written — just import and use them.
3. **Add validator decision endpoint.** Let validators approve/reject assets through the API.
4. **Decrement available tokens on purchase.** Close the loop between transactions and asset state.
5. **Remove dead code.** `bppc` import, unused services, `managers.js`, `schemas.js` classes, `config/logger.js` (winston missing).
6. **Extract service layer.** Move business logic out of routes into `services/AssetService.js`, `services/TransactionService.js`.
7. **Add one integration test.** Create asset → request validation → validate → purchase. Prove the lifecycle works end-to-end through the API.
