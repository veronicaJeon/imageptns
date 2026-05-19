export const IMAGE_PARTNERS_ESCROW_ABI = [
  {
    type: "function",
    name: "registerAsset",
    stateMutability: "nonpayable",
    inputs: [
      { name: "assetId", type: "bytes32" },
      { name: "contentHash", type: "bytes32" },
      { name: "photographer", type: "address" },
      { name: "metadataURI", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "purchase",
    stateMutability: "nonpayable",
    inputs: [
      { name: "orderId", type: "bytes32" },
      { name: "assetIds", type: "bytes32[]" },
      { name: "photographers", type: "address[]" },
      { name: "grossAmounts", type: "uint256[]" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "claim",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "event",
    name: "AssetRegistered",
    inputs: [
      { name: "assetId", type: "bytes32", indexed: true },
      { name: "contentHash", type: "bytes32", indexed: true },
      { name: "photographer", type: "address", indexed: true },
      { name: "metadataURI", type: "string", indexed: false },
    ],
  },
  {
    type: "event",
    name: "PurchaseCompleted",
    inputs: [
      { name: "orderId", type: "bytes32", indexed: true },
      { name: "buyer", type: "address", indexed: true },
      { name: "grossAmount", type: "uint256", indexed: false },
      { name: "platformFee", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "photographer", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const;

export const ERC20_ABI = [
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
] as const;
