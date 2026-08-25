import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = process.cwd();
const evaluationRoot = resolve(process.env.SEMANTIC_EVALUATION_ROOT || join(root, ".semantic-evaluation"));
const manifest = JSON.parse(await readFile(join(root, "evals/semantic-smoke-manifest.json"), "utf8"));

function parseEnv(contents) {
  const values = {};
  for (const line of contents.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    values[match[1]] = value;
  }
  return values;
}

const localEnvironment = parseEnv(await readFile(resolve(process.env.SEMANTIC_EVALUATION_ENV || join(root, ".env.local")), "utf8"));
const credentials = {
  nvidia: process.env.NVIDIA_API_KEY || localEnvironment.NVIDIA_API_KEY,
  voyage: process.env.VOYAGE_API_KEY || localEnvironment.VOYAGE_API_KEY,
};
for (const [provider, key] of Object.entries(credentials)) {
  if (!key) throw new Error(`${provider.toUpperCase()}_API_KEY is not configured`);
}

async function imageDataUrl(path) {
  return `data:image/jpeg;base64,${(await readFile(path)).toString("base64")}`;
}

async function postJson(url, apiKey, body, { timeoutMs = 120_000, maxAttempts = 3 } = {}) {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const startedAt = performance.now();
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const text = await response.text();
      let payload;
      try { payload = JSON.parse(text); } catch { payload = {}; }
      if (!response.ok) {
        const message = payload.detail ?? payload.message ?? payload.error?.message ?? "request failed";
        const error = new Error(`${response.status} ${String(message).slice(0, 500)}`);
        error.status = response.status;
        throw error;
      }
      return { payload, latencyMs: performance.now() - startedAt, attempts: attempt + 1 };
    } catch (error) {
      lastError = error;
      if (attempt === maxAttempts - 1 || (error.status && error.status < 500 && error.status !== 429)) break;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 500 * (2 ** attempt)));
    }
  }
  throw lastError;
}

function cosine(left, right) {
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  return dot / Math.sqrt(leftMagnitude * rightMagnitude);
}

function rank(query, corpus) {
  return corpus.map((item) => ({ id: item.id, score: cosine(query, item.embedding) }))
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
}

function evaluate(runs) {
  let top1 = 0;
  let recall5 = 0;
  let reciprocalRank = 0;
  for (const run of runs) {
    const rankIndex = run.ranked.findIndex((item) => item.id === run.relevantId);
    if (rankIndex === 0) top1 += 1;
    if (rankIndex >= 0 && rankIndex < 5) recall5 += 1;
    if (rankIndex >= 0) reciprocalRank += 1 / (rankIndex + 1);
  }
  return {
    queries: runs.length,
    top1Accuracy: top1 / runs.length,
    recallAt5: recall5 / runs.length,
    meanReciprocalRank: reciprocalRank / runs.length,
    runs,
  };
}

async function inChunks(label, inputs, chunkSize, callback, delayMs = 350) {
  const embeddings = [];
  let latencyMs = 0;
  for (let offset = 0; offset < inputs.length; offset += chunkSize) {
    process.stderr.write(`${label}: ${offset + 1}-${Math.min(offset + chunkSize, inputs.length)}/${inputs.length}\n`);
    const result = await callback(inputs.slice(offset, offset + chunkSize));
    embeddings.push(...result.embeddings);
    latencyMs += result.latencyMs;
    if (offset + chunkSize < inputs.length) await new Promise((resolvePromise) => setTimeout(resolvePromise, delayMs));
  }
  return { embeddings, latencyMs };
}

const corpus = await Promise.all(manifest.corpus.map(async (item) => ({
  ...item,
  dataUrl: await imageDataUrl(join(evaluationRoot, "corpus", item.file)),
})));
const imageQueries = await Promise.all(manifest.imageQueries.map(async (item) => ({
  ...item,
  dataUrl: await imageDataUrl(join(evaluationRoot, "queries", item.file)),
})));
const report = {
  generatedAt: new Date().toISOString(),
  corpusSize: corpus.length,
  providers: {},
  reranker: {
    status: "excluded",
    reason: "Observed 6.65 second latency exceeded the 1.5 second interactive-search budget",
  },
  generativeSmoke: {},
  excludedModels: [
    { model: "google/gemma-4-31b-it", reason: "20.58 second caption latency exceeded the 5 second budget" },
    { model: "google/gemma-4-26b-a4b-it", reason: "Hosted endpoint returned 404" },
    { model: "meta/llama-3.2-90b-vision-instruct", reason: "Timed out at 60 seconds" },
  ],
};

let previousVoyageRequestAt = 0;
async function voyageEmbed(contents, inputType) {
  const minimumInterval = Number(process.env.VOYAGE_MIN_INTERVAL_MS || 21_000);
  const waitMs = Math.max(0, minimumInterval - (Date.now() - previousVoyageRequestAt));
  if (waitMs > 0) await new Promise((resolvePromise) => setTimeout(resolvePromise, waitMs));
  previousVoyageRequestAt = Date.now();
  const response = await postJson("https://api.voyageai.com/v1/multimodalembeddings", credentials.voyage, {
    inputs: contents.map((content) => ({ content })),
    model: "voyage-multimodal-3.5",
    input_type: inputType,
    output_dimension: 512,
    output_dtype: "float",
  });
  return { embeddings: response.payload.data.map((item) => item.embedding), latencyMs: response.latencyMs };
}

async function nvidiaEmbed(inputs, inputType, modality) {
  const response = await postJson("https://integrate.api.nvidia.com/v1/embeddings", credentials.nvidia, {
    input: inputs,
    model: "nvidia/llama-nemotron-embed-vl-1b-v2",
    modality: [modality],
    input_type: inputType,
    encoding_format: "float",
    truncate: "NONE",
  });
  return { embeddings: response.payload.data.map((item) => item.embedding), latencyMs: response.latencyMs };
}

try {
  const documentVectors = await inChunks("voyage corpus", corpus.map((item) => [{ type: "image_base64", image_base64: item.dataUrl }]), 4, (items) => voyageEmbed(items, "document"));
  const corpusVectors = corpus.map((item, index) => ({ id: item.id, embedding: documentVectors.embeddings[index] }));
  const korean = await voyageEmbed(corpus.map((item) => [{ type: "text", text: item.ko }]), "query");
  const english = await voyageEmbed(corpus.map((item) => [{ type: "text", text: item.en }]), "query");
  const images = await inChunks("voyage image queries", imageQueries.map((item) => [{ type: "image_base64", image_base64: item.dataUrl }]), 4, (items) => voyageEmbed(items, "query"));
  report.providers.voyage = {
    status: "completed", model: "voyage-multimodal-3.5", dimensions: 512,
    koreanTextToImage: evaluate(corpus.map((item, index) => ({ relevantId: item.id, ranked: rank(korean.embeddings[index], corpusVectors).slice(0, 5) }))),
    englishTextToImage: evaluate(corpus.map((item, index) => ({ relevantId: item.id, ranked: rank(english.embeddings[index], corpusVectors).slice(0, 5) }))),
    imageToImage: evaluate(imageQueries.map((item, index) => ({ relevantId: item.relevantId, ranked: rank(images.embeddings[index], corpusVectors).slice(0, 5) }))),
  };
} catch (error) {
  report.providers.voyage = { status: "failed", error: error.message };
}

try {
  const documentVectors = await inChunks("nvidia corpus", corpus.map((item) => item.dataUrl), 1, (items) => nvidiaEmbed(items, "passage", "image"));
  const corpusVectors = corpus.map((item, index) => ({ id: item.id, embedding: documentVectors.embeddings[index] }));
  const korean = await inChunks("nvidia Korean queries", corpus.map((item) => item.ko), 1, (items) => nvidiaEmbed(items, "query", "text"));
  const english = await inChunks("nvidia English queries", corpus.map((item) => item.en), 1, (items) => nvidiaEmbed(items, "query", "text"));
  report.providers.nvidia = {
    status: "completed", model: "nvidia/llama-nemotron-embed-vl-1b-v2", dimensions: documentVectors.embeddings[0].length,
    koreanTextToImage: evaluate(corpus.map((item, index) => ({ relevantId: item.id, ranked: rank(korean.embeddings[index], corpusVectors).slice(0, 5) }))),
    englishTextToImage: evaluate(corpus.map((item, index) => ({ relevantId: item.id, ranked: rank(english.embeddings[index], corpusVectors).slice(0, 5) }))),
    imageToImage: { status: "unsupported" },
  };
} catch (error) {
  report.providers.nvidia = { status: "failed", error: error.message };
}

if (!process.argv.includes("--skip-generative")) {
  const models = ["nvidia/nemotron-3-nano-omni-30b-a3b-reasoning"];
  for (const model of models) {
    try {
      const response = await postJson("https://integrate.api.nvidia.com/v1/chat/completions", credentials.nvidia, {
        model,
        messages: [{ role: "user", content: [
          { type: "text", text: "Identify the main subject. Reply with exactly one lowercase label from: apple, mug, bicycle, forest, ocean, kitchen, succulent, lake." },
          { type: "image_url", image_url: { url: imageQueries[0].dataUrl } },
        ] }],
        temperature: 0,
        max_tokens: 32,
      }, { timeoutMs: 60_000, maxAttempts: 1 });
      const answer = String(response.payload.choices?.[0]?.message?.content ?? "").trim().toLowerCase();
      report.generativeSmoke[model] = { status: "completed", expected: "apple", answer: answer.slice(0, 80), exact: answer === "apple", latencyMs: response.latencyMs };
    } catch (error) {
      report.generativeSmoke[model] = { status: "failed", error: error.message };
    }
  }
}

await mkdir(evaluationRoot, { recursive: true });
await writeFile(join(evaluationRoot, "smoke-report.json"), `${JSON.stringify(report, null, 2)}\n`, { mode: 0o600 });
const publicSummary = structuredClone(report);
for (const provider of Object.values(publicSummary.providers)) {
  for (const track of ["koreanTextToImage", "englishTextToImage", "imageToImage"]) {
    if (provider?.[track]?.runs) delete provider[track].runs;
  }
}
console.log(JSON.stringify(publicSummary, null, 2));
