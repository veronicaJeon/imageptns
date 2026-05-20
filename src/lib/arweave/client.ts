import Arweave from "arweave";

export interface ArweaveTag {
  name: string;
  value: string;
}

export interface ArweaveUploadResult {
  id: string;
  status: number;
}

interface ArweaveJwk {
  kty: string;
  n: string;
  e: string;
  d: string;
  p: string;
  q: string;
  dp: string;
  dq: string;
  qi: string;
}

interface ArweaveGraphQlEdge {
  node: {
    id: string;
    block: { id?: string; height?: number; timestamp?: number } | null;
  };
}

function getArweave() {
  return Arweave.init({
    host: process.env.ARWEAVE_HOST ?? "arweave.net",
    port: Number(process.env.ARWEAVE_PORT ?? 443),
    protocol: process.env.ARWEAVE_PROTOCOL ?? "https",
  });
}

function getArweaveJwk(): ArweaveJwk {
  const raw = process.env.ARWEAVE_JWK;
  if (!raw) throw new Error("ARWEAVE_JWK is not configured");

  try {
    return JSON.parse(raw) as ArweaveJwk;
  } catch {
    throw new Error("ARWEAVE_JWK must be a JSON wallet key");
  }
}

export function assertArweaveConfigured() {
  getArweaveJwk();
}

export async function uploadBufferToArweave(
  data: Buffer,
  contentType: string,
  tags: ArweaveTag[] = [],
): Promise<ArweaveUploadResult> {
  const arweave = getArweave();
  const jwk = getArweaveJwk();
  const tx = await arweave.createTransaction({ data }, jwk);

  tx.addTag("Content-Type", contentType);
  tx.addTag("App-Name", "Image Partners");
  tx.addTag("App-Version", "photo-credential-v1");
  for (const tag of tags) tx.addTag(tag.name, tag.value);

  await arweave.transactions.sign(tx, jwk);
  const response = await arweave.transactions.post(tx);
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Arweave upload failed with status ${response.status}`);
  }

  return { id: tx.id, status: response.status };
}

export async function verifyArweaveTransactions(
  ids: string[],
): Promise<Record<string, { confirmed: boolean; blockHeight: number | null }>> {
  if (ids.length === 0) return {};

  const endpoint = `${process.env.ARWEAVE_PROTOCOL ?? "https"}://${process.env.ARWEAVE_HOST ?? "arweave.net"}/graphql`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: `
        query ImagePartnersTransactions($ids: [ID!]) {
          transactions(ids: $ids) {
            edges {
              node {
                id
                block { height timestamp }
              }
            }
          }
        }
      `,
      variables: { ids },
    }),
  });

  if (!response.ok) {
    throw new Error(`Arweave GraphQL verification failed with status ${response.status}`);
  }

  const payload = await response.json() as {
    data?: { transactions?: { edges?: ArweaveGraphQlEdge[] } };
    errors?: { message?: string }[];
  };
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message ?? "GraphQL error").join(", "));
  }

  const result: Record<string, { confirmed: boolean; blockHeight: number | null }> = {};
  for (const id of ids) result[id] = { confirmed: false, blockHeight: null };

  for (const edge of payload.data?.transactions?.edges ?? []) {
    const height = edge.node.block?.height ?? null;
    result[edge.node.id] = { confirmed: height !== null, blockHeight: height };
  }

  return result;
}
