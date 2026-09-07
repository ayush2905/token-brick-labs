import { Router, Request, Response } from "express";
import { ethers } from "ethers";

const router = Router();

const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL || "https://ethereum-sepolia.core.chainstack.com";

// Chainlink LINK Token on Sepolia testnet (pre-deployed, public contract)
const LINK_TOKEN_ADDRESS = "0x779877A7B0D9E8603169DdbD7836e478b4624789";

const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address) view returns (uint256)",
];

// Vitalik's public address - just to demo reading a balance
const SAMPLE_ADDRESS = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

router.get("/AyushApiTest", async (_req: Request, res: Response) => {
  try {
    console.log("\n--- AyushApiTest: Fetching on-chain data from Sepolia ---");
    console.log(`RPC: ${SEPOLIA_RPC}`);
    console.log(`Contract: ${LINK_TOKEN_ADDRESS} (LINK Token)`);

    const provider = new ethers.JsonRpcProvider(SEPOLIA_RPC, undefined, {
      batchMaxCount: 1,
    });
    const contract = new ethers.Contract(LINK_TOKEN_ADDRESS, ERC20_ABI, provider);

    const name = await contract.name() as string;
    const symbol = await contract.symbol() as string;
    const decimals = await contract.decimals() as bigint;
    const totalSupply = await contract.totalSupply() as bigint;
    const balance = await contract.balanceOf(SAMPLE_ADDRESS) as bigint;
    const blockNumber = await provider.getBlockNumber();

    const formattedSupply = ethers.formatUnits(totalSupply, decimals);
    const formattedBalance = ethers.formatUnits(balance, decimals);

    const result = {
      success: true,
      network: "Sepolia Testnet",
      blockNumber,
      contract: {
        address: LINK_TOKEN_ADDRESS,
        name,
        symbol,
        decimals: Number(decimals),
        totalSupply: formattedSupply,
      },
      sampleQuery: {
        address: SAMPLE_ADDRESS,
        balance: formattedBalance,
        unit: symbol,
      },
      timestamp: new Date().toISOString(),
    };

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
