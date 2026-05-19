import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ethers } from "ethers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(__dirname, "..", "..");
const contractsRoot = resolve(__dirname, "..");

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim();
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // The script can also be driven entirely by process.env.
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function addressEnv(name) {
  return ethers.getAddress(required(name));
}

loadEnvFile(resolve(workspaceRoot, ".env.local"));

const rpcUrl = required("BASE_RPC_URL");
const privateKey = required("ONCHAIN_OPERATOR_PRIVATE_KEY");
const usdc = addressEnv("NEXT_PUBLIC_USDC_ADDRESS");
const treasury = addressEnv("ONCHAIN_TREASURY_ADDRESS");
const feeBps = Number(process.env.ONCHAIN_PLATFORM_FEE_BPS ?? "2000");

if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
  throw new Error("ONCHAIN_PLATFORM_FEE_BPS must be an integer between 0 and 10000");
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const deployer = new ethers.Wallet(privateKey, provider);
const network = await provider.getNetwork();

if (network.chainId !== 84532n) {
  throw new Error(`Expected Base Sepolia chain id 84532, got ${network.chainId.toString()}`);
}

const artifactPath = resolve(
  contractsRoot,
  "artifacts",
  "contracts",
  "ImagePartnersEscrow.sol",
  "ImagePartnersEscrow.json",
);
const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, deployer);

console.log(`Deploying ImagePartnersEscrow from ${deployer.address}`);
console.log(`USDC: ${usdc}`);
console.log(`Treasury: ${treasury}`);
console.log(`Platform fee bps: ${feeBps}`);

const escrow = await factory.deploy(usdc, treasury, feeBps);
await escrow.waitForDeployment();

const escrowAddress = await escrow.getAddress();
const deploymentTx = escrow.deploymentTransaction();
const deployment = {
  network: "base-sepolia",
  chainId: Number(network.chainId),
  escrowAddress,
  usdc,
  treasury,
  platformFeeBps: feeBps,
  deployer: deployer.address,
  transactionHash: deploymentTx?.hash ?? null,
  deployedAt: new Date().toISOString(),
};

const deploymentsDir = resolve(contractsRoot, "deployments");
mkdirSync(deploymentsDir, { recursive: true });
writeFileSync(
  resolve(deploymentsDir, "base-sepolia.json"),
  `${JSON.stringify(deployment, null, 2)}\n`,
);

console.log("\nDeployment complete.");
console.log(`NEXT_PUBLIC_IMAGEPARTNERS_ESCROW_ADDRESS=${escrowAddress}`);
console.log(`Explorer: https://sepolia.basescan.org/address/${escrowAddress}`);
