function hex(buffer) {
  return [...new Uint8Array(buffer)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

async function digest(value) {
  return hex(await crypto.subtle.digest("SHA-256", value));
}

async function inventory(bucket) {
  let cursor;
  let objectCount = 0;
  let totalBytes = 0;
  let smallest = null;

  do {
    const page = await bucket.list({ limit: 1000, cursor });
    for (const object of page.objects) {
      objectCount += 1;
      totalBytes += object.size;
      if (object.size > 0 && (!smallest || object.size < smallest.size)) smallest = object;
    }
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);

  return { objectCount, totalBytes, smallest };
}

const worker = {
  async fetch(request, env) {
    if (!env.RESTORE_DRILL_TOKEN || request.headers.get("authorization") !== `Bearer ${env.RESTORE_DRILL_TOKEN}`) {
      return Response.json({ error: "forbidden" }, { status: 403 });
    }
    if (request.method !== "POST") return Response.json({ error: "method_not_allowed" }, { status: 405 });

    const url = new URL(request.url);
    if (url.pathname === "/seed") {
      const sourceKey = `restore-drill/source-${crypto.randomUUID()}`;
      const bytes = new TextEncoder().encode(`imagepartners-r2-restore-drill:${crypto.randomUUID()}`);
      await env.SOURCE_BUCKET.put(sourceKey, bytes, {
        httpMetadata: { contentType: "application/octet-stream" },
        customMetadata: { purpose: "restore-drill" },
      });
      return Response.json({ ok: true, sourceKey, bytes: bytes.length, sha256: await digest(bytes) });
    }

    if (url.pathname === "/copy") {
      const source = await inventory(env.SOURCE_BUCKET);
      if (!source.smallest) {
        return Response.json({ ok: true, ...source, restored: false });
      }

      const object = await env.SOURCE_BUCKET.get(source.smallest.key);
      if (!object) return Response.json({ error: "source_missing" }, { status: 409 });
      const sourceBytes = await object.arrayBuffer();
      const sourceHash = await digest(sourceBytes);
      const restoreKey = `restore-drill/${crypto.randomUUID()}`;
      await env.TARGET_BUCKET.put(restoreKey, sourceBytes, {
        httpMetadata: object.httpMetadata,
        customMetadata: { sourceHash },
      });
      const restored = await env.TARGET_BUCKET.get(restoreKey);
      if (!restored) return Response.json({ error: "restore_missing" }, { status: 500 });
      const restoredHash = await digest(await restored.arrayBuffer());

      return Response.json({
        ok: sourceHash === restoredHash,
        objectCount: source.objectCount,
        totalBytes: source.totalBytes,
        sampleBytes: source.smallest.size,
        sourceKeyHash: await digest(new TextEncoder().encode(source.smallest.key)),
        sourceHash,
        restoredHash,
        restoreKey,
        restored: true,
      }, { status: sourceHash === restoredHash ? 200 : 500 });
    }

    if (url.pathname === "/cleanup") {
      const body = await request.json();
      if (body.restoreKey != null) {
        if (typeof body.restoreKey !== "string" || !body.restoreKey.startsWith("restore-drill/")) {
          return Response.json({ error: "invalid_restore_key" }, { status: 400 });
        }
        await env.TARGET_BUCKET.delete(body.restoreKey);
      }
      if (body.sourceKey != null) {
        if (typeof body.sourceKey !== "string" || !body.sourceKey.startsWith("restore-drill/source-")) {
          return Response.json({ error: "invalid_source_key" }, { status: 400 });
        }
        await env.SOURCE_BUCKET.delete(body.sourceKey);
      }
      const remaining = await inventory(env.TARGET_BUCKET);
      const sourceSeed = body.sourceKey ? await env.SOURCE_BUCKET.head(body.sourceKey) : null;
      return Response.json({
        ok: remaining.objectCount === 0 && !sourceSeed,
        remainingObjects: remaining.objectCount,
        sourceSeedRemoved: !sourceSeed,
      });
    }

    return Response.json({ error: "not_found" }, { status: 404 });
  },
};

export default worker;
