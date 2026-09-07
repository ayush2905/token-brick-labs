# Token Brick Labs - Web3 API Assessment

Node.js/TypeScript backend that interacts with a pre-deployed smart contract on Ethereum Sepolia testnet via a REST API endpoint.

## Overview

This project demonstrates Web3 integration by reading on-chain data from the **Chainlink LINK Token** ERC-20 contract deployed on Sepolia testnet.

**Contract:** [`0x779877A7B0D9E8603169DdbD7836e478b4624789`](https://sepolia.etherscan.io/address/0x779877A7B0D9E8603169DdbD7836e478b4624789)

**Data fetched:**
- Token metadata (name, symbol, decimals)
- Total supply
- LINK balance for a sample wallet address
- Current block number

## Tech Stack

| Layer      | Technology                  |
| ---------- | --------------------------- |
| Runtime    | Node.js + TypeScript        |
| Framework  | Express.js                  |
| Blockchain | ethers.js v6                |
| Network    | Ethereum Sepolia (testnet)  |
| RPC        | Chainstack                  |
| Hosting    | Render (free tier)          |

## Prerequisites

- Node.js >= 18
- npm

## Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/ayush2905/token-brick-labs.git
cd token-brick-labs

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env
# Edit .env and add your Sepolia RPC URL (e.g. from Chainstack, Alchemy, or Infura)

# 4. Build and start
npm run build
npm start
```

The server starts on `http://localhost:3001`.

## API Endpoints

### `GET /api/AyushApiTest`

Fetches LINK token data from Sepolia testnet.

```bash
curl http://localhost:3001/api/AyushApiTest
```

**Response:**

```json
{
  "success": true,
  "network": "Sepolia Testnet",
  "blockNumber": 11654940,
  "contract": {
    "address": "0x779877A7B0D9E8603169DdbD7836e478b4624789",
    "name": "ChainLink Token",
    "symbol": "LINK",
    "decimals": 18,
    "totalSupply": "1000000000.0"
  },
  "sampleQuery": {
    "address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    "balance": "67.111000000000101",
    "unit": "LINK"
  },
  "timestamp": "2026-09-07T15:07:43.332Z"
}
```

### `GET /api/health`

Health check endpoint.

```bash
curl http://localhost:3001/api/health
```

## Environment Variables

| Variable         | Required | Description                                      |
| ---------------- | -------- | ------------------------------------------------ |
| `PORT`           | No       | Server port (default: `3001`)                    |
| `NODE_ENV`       | No       | Environment (default: `development`)             |
| `SEPOLIA_RPC_URL`| Yes      | Sepolia RPC endpoint (Chainstack, Alchemy, etc.) |

## Project Structure

```
token-brick-labs/
├── src/
│   ├── server.ts                # Express app setup and middleware
│   └── routes/
│       └── ayushApiTest.ts      # AyushApiTest endpoint - smart contract interaction
├── .env.example                 # Environment variable template
├── render.yaml                  # Render deployment blueprint
├── tsconfig.json                # TypeScript configuration
├── package.json
└── README.md
```

## Deployment (Render)

1. Push this repo to GitHub
2. Go to [render.com](https://render.com) → **New** → **Web Service**
3. Connect the GitHub repository
4. Set build command: `npm install && npm run build`
5. Set start command: `npm start`
6. Add environment variable: `SEPOLIA_RPC_URL` = your Chainstack/Alchemy endpoint
7. Select the **Free** plan and deploy

A `render.yaml` blueprint is included for automatic configuration.

## Author

Ayush Agrawal
