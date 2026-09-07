import { Router, Request, Response } from "express";
import { ethers } from "ethers";

const router = Router();

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia.core.chainstack.com";
const MAX_RETRIES = 3;
const CACHE_TTL_MS = 30_000;

// Chainlink LINK Token on Sepolia testnet (pre-deployed, public contract)
const LINK_TOKEN_ADDRESS = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

const DEFAULT_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

interface CacheEntry {
  data: Record<string, unknown>;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(key: string): Record<string, unknown> | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: Record<string, unknown>): void {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

async function withRetry<T>(fn: () => Promise<T>, retries = MAX_RETRIES): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`Attempt ${attempt}/${retries} failed: ${msg}`);
      if (attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
  throw new Error("Unreachable");
}

async function fetchContractData(walletAddress: string) {
  const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC, undefined, {
    batchMaxCount: 1,
  });
  const contract = new ethers.Contract(LINK_TOKEN_ADDRESS, ERC20_ABI, provider);

  const name = (await contract.name()) as string;
  const symbol = (await contract.symbol()) as string;
  const decimals = (await contract.decimals()) as bigint;
  const totalSupply = (await contract.totalSupply()) as bigint;
  const balance = (await contract.balanceOf(walletAddress)) as bigint;
  const blockNumber = await provider.getBlockNumber();

  return {
    success: true,
    network: "Sepolia Testnet",
    blockNumber,
    contract: {
      address: LINK_TOKEN_ADDRESS,
      name,
      symbol,
      decimals: Number(decimals),
      totalSupply: ethers.formatUnits(totalSupply, decimals),
    },
    walletQuery: {
      address: walletAddress,
      balance: ethers.formatUnits(balance, decimals),
      unit: symbol,
    },
    timestamp: new Date().toISOString(),
  };
}

router.post("/AyushApiTest", async (req: Request, res: Response) => {
  try {
    const { address } = req.body as { address?: string };
    const walletAddress = address || DEFAULT_ADDRESS;

    if (!ethers.isAddress(walletAddress)) {
      res.status(400).json({ success: false, error: "Invalid Ethereum address" });
      return;
    }

    const cacheKey = `link_${walletAddress.toLowerCase()}`;
    const cached = getCached(cacheKey);

    if (cached) {
      console.log(`\n--- AyushApiTest: Returning cached response for ${walletAddress} ---`);
      res.json({ ...cached, cached: true });
      return;
    }

    console.log("\n--- AyushApiTest: Fetching on-chain data from Sepolia ---");
    console.log(`RPC: ${SEPOLIA_RPC}`);
    console.log(`Contract: ${LINK_TOKEN_ADDRESS} (LINK Token)`);
    console.log(`Wallet: ${walletAddress}`);

    const result = await withRetry(() => fetchContractData(walletAddress));

    setCache(cacheKey, result);

    console.log("\nResult:");
    console.log(JSON.stringify(result, null, 2));
    console.log("--- AyushApiTest: Done ---\n");

    res.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("AyushApiTest Error:", message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch blockchain data",
      details: message,
    });
  }
});

export { router as ayushApiTestRouter };
