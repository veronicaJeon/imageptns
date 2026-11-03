export default function unavailableSharp(): never {
  throw new Error("Sharp is unavailable in the Cloudflare server worker");
}
