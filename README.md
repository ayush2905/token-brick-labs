# Token Brick Labs - Web3 API Assessment

A Node.js/TypeScript backend that exposes an API endpoint to interact with a pre-deployed smart contract on Ethereum Sepolia testnet.

## What it does

The `AyushApiTest` endpoint connects to the **Chainlink LINK Token** contract (`0x779877A7B0D9E8603169DdbD7836e478b4624789`) on Sepolia testnet and fetches:

- Token name, symbol, decimals
- Total supply
- Token balance for a sample address
- Current block number

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Express.js
- **Blockchain**: ethers.js v6 + Sepolia testnet
- **RPC**: Public RPC (no API key required)

## Quick Start

```bash
# Install dependencies
npm install

# Copy env file
cp .env.example .env

# Run in development mode
npm run dev

# Or build and run
npm run build
npm start
```

## API Endpoints

| Method | Endpoint           | Description                              |
| ------ | ------------------ | ---------------------------------------- |
| GET    | `/api/AyushApiTest` | Fetches LINK token data from Sepolia     |
| GET    | `/api/health`       | Health check                             |

## Test the endpoint

```bash
curl http://localhost:3001/api/AyushApiTest
```

## Example Response

```json
{
  "success": true,
  "network": "Sepolia Testnet",
  "blockNumber": 12345678,
  "contract": {
    "address": "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    "name": "ChainLink Token",
    "symbol": "LINK",
    "decimals": 18,
    "totalSupply": "1000000000.0"
  },
  "sampleQuery": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "balance": "0.0",
    "unit": "LINK"
  },
  "timestamp": "2026-09-07T15:00:00.000Z"
}
```

## Deployment

Deployed on Render. The `render.yaml` blueprint handles build and start commands automatically.

## Environment Variables

| Variable         | Default                                       | Description        |
| ---------------- | --------------------------------------------- | ------------------ |
| `PORT`           | `3001`                                        | Server port        |
| `NODE_ENV`       | `development`                                 | Environment        |
| `SEPOLIA_RPC_URL`| Chainstack Sepolia endpoint                    | Sepolia RPC URL    |
