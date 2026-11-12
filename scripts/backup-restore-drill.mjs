import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const PAGE_SIZE = 500;
const LOCAL_DB_CONTAINER = "supabase_db_imageptns";
const SNAPSHOT_SCHEMA_VERSION = 1;

function fail(message) {
  throw new Error(message);
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalRows(rows) {
  return [...rows].map((row) => JSON.stringify(row)).sort().join("\n");
}

function safeIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function runPsql(sql) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", LOCAL_DB_CONTAINER, "psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-U", "postgres", "-d", "postgres"],
    { input: sql, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.status !== 0) fail(result.stderr || result.stdout || "psql failed");
  return result.stdout.trim();
}

function localStatus() {
  const output = execFileSync("npx", ["supabase", "status", "-o", "json"], {
    encoding: "utf8",
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(output.slice(output.indexOf("{")));
}

function localTableMetadata() {
  const output = runPsql(`
    select coalesce(json_agg(row_to_json(t)), '[]'::json)::text
    from (
      select c.relname as table_name,
             json_agg(json_build_object(
               'name', a.attname,
               'generated', a.attgenerated <> ''
             ) order by a.attnum) as columns
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = c.oid
      where n.nspname = 'public'
        and c.relkind in ('r', 'p')
        and a.attnum > 0
        and not a.attisdropped
      group by c.relname
      order by c.relname
    ) t;
  `);
  return JSON.parse(output);
}

async function fetchAllRows(client, table) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await client
      .from(table)
      .select("*")
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) fail(`${table}: ${error.message}`);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function listStorageFiles(client, bucket) {
  const files = [];
  const prefixes = [""];
  const visited = new Set();

  while (prefixes.length > 0) {
    const prefix = prefixes.shift();
    if (visited.has(prefix)) continue;
    visited.add(prefix);

    for (let offset = 0; ; offset += PAGE_SIZE) {
      const { data, error } = await client.storage.from(bucket).list(prefix, {
        limit: PAGE_SIZE,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
      if (error) fail(`${bucket}/${prefix}: ${error.message}`);

      for (const item of data ?? []) {
        const path = prefix ? `${prefix}/${item.name}` : item.name;
        if (item.id || item.metadata) {
          files.push({
            path,
            size: Number(item.metadata?.size ?? 0),
            contentType: item.metadata?.mimetype ?? "application/octet-stream",
          });
        } else if (item.name && item.name !== ".emptyFolderPlaceholder") {
          prefixes.push(path);
        }
      }
      if (!data || data.length < PAGE_SIZE) break;
    }
  }
  return files;
}

async function snapshotStorage(production, outputDirectory) {
  const { data: buckets, error } = await production.storage.listBuckets();
  if (error) fail(error.message);
  const storageDirectory = join(outputDirectory, "storage");
  mkdirSync(storageDirectory, { recursive: true, mode: 0o700 });
  const manifest = [];

  for (const bucket of buckets ?? []) {
    const files = await listStorageFiles(production, bucket.id);
    const sample = [...files]
      .filter((file) => file.size > 0)
      .sort((left, right) => left.size - right.size)[0] ?? null;
    const entry = {
      bucket: bucket.id,
      public: Boolean(bucket.public),
      fileSizeLimit: bucket.file_size_limit ?? null,
      allowedMimeTypes: bucket.allowed_mime_types ?? null,
      objectCount: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.size, 0),
      sample: null,
    };

    if (sample) {
      const { data, error: downloadError } = await production.storage.from(bucket.id).download(sample.path);
      if (downloadError) fail(`${bucket.id}/${sample.path}: ${downloadError.message}`);
      const bytes = Buffer.from(await data.arrayBuffer());
      const fileName = `${sha256(`${bucket.id}/${sample.path}`).slice(0, 16)}-${basename(sample.path)}`;
      const localPath = join(storageDirectory, fileName);
      writeFileSync(localPath, bytes, { mode: 0o600 });
      entry.sample = {
        path: sample.path,
        bytes: bytes.length,
        contentType: sample.contentType,
        sha256: sha256(bytes),
        fileName,
      };
    }
    manifest.push(entry);
  }
  return manifest;
}

async function restoreStorage(local, snapshotDirectory, storageManifest) {
  const restored = [];
  for (const bucket of storageManifest) {
    if (!bucket.sample) continue;
    const { error: bucketError } = await local.storage.createBucket(bucket.bucket, {
      public: bucket.public,
      fileSizeLimit: bucket.fileSizeLimit ?? undefined,
      allowedMimeTypes: bucket.allowedMimeTypes ?? undefined,
    });
    if (bucketError && !/already exists/i.test(bucketError.message)) fail(bucketError.message);

    const bytes = readFileSync(join(snapshotDirectory, "storage", bucket.sample.fileName));
    const { error: uploadError } = await local.storage.from(bucket.bucket).upload(bucket.sample.path, bytes, {
      contentType: bucket.sample.contentType,
      upsert: true,
    });
    if (uploadError) fail(`${bucket.bucket}/${bucket.sample.path}: ${uploadError.message}`);
    const { data, error: downloadError } = await local.storage.from(bucket.bucket).download(bucket.sample.path);
    if (downloadError) fail(`${bucket.bucket}/${bucket.sample.path}: ${downloadError.message}`);
    const restoredBytes = Buffer.from(await data.arrayBuffer());
    const restoredHash = sha256(restoredBytes);
    if (restoredHash !== bucket.sample.sha256) fail(`${bucket.bucket} sample hash mismatch`);
    restored.push({ bucket: bucket.bucket, path: bucket.sample.path, sha256: restoredHash });
  }
  return restored;
}

function verifyImageStorageReferences(snapshotDirectory, storageManifest) {
  const images = JSON.parse(readFileSync(join(snapshotDirectory, "table-images.json"), "utf8"));
  const referenceChecks = [];
  for (const bucket of storageManifest) {
    if (!bucket.sample || !["images-original", "images-preview", "images-analysis"].includes(bucket.bucket)) continue;
    const path = bucket.sample.path;
    const referenced = bucket.bucket === "images-original"
      ? images.some((image) => image.storage_path_original === path || image.storage_path_full === path)
      : bucket.bucket === "images-preview"
        ? images.some((image) => image.storage_path_preview === path || `thumbs/${image.storage_path_preview}` === path)
        : images.some((image) => image.storage_path_analysis === path);
    referenceChecks.push({ bucket: bucket.bucket, referenced });
  }
  const unreferenced = referenceChecks.filter((check) => !check.referenced);
  if (unreferenced.length > 0) fail(`Storage reference verification failed: ${JSON.stringify(unreferenced)}`);
  return referenceChecks;
}

function restoreDatabase(snapshotDirectory, manifest, metadata) {
  const tableByName = new Map(metadata.map((table) => [table.table_name, table]));
  const tableNames = manifest.tables.map((table) => table.name).filter((name) => tableByName.has(name));
  const sql = [
    "begin;",
    "set local session_replication_role = replica;",
    `truncate table ${tableNames.map((name) => `public.${safeIdentifier(name)}`).join(", ")} cascade;`,
    "truncate table auth.users cascade;",
  ];

  const profileSnapshot = manifest.tables.find((table) => table.name === "profiles");
  const profiles = profileSnapshot
    ? JSON.parse(readFileSync(join(snapshotDirectory, profileSnapshot.file), "utf8"))
    : [];
  for (const profile of profiles) {
    const id = String(profile.id).replaceAll("'", "''");
    sql.push(`
      insert into auth.users (
        id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new,
        email_change_token_current, reauthentication_token
      ) values (
        '${id}'::uuid, 'authenticated', 'authenticated',
        'restore-drill+${id}@example.invalid', '', now(),
        '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
        now(), now(), '', '', '', '', ''
      );
    `);
  }

  for (const table of manifest.tables) {
    const localTable = tableByName.get(table.name);
    if (!localTable || table.count === 0) continue;
    const rows = JSON.parse(readFileSync(join(snapshotDirectory, table.file), "utf8"));
    const available = new Set(localTable.columns.filter((column) => !column.generated).map((column) => column.name));
    const columns = Object.keys(rows[0]).filter((column) => available.has(column));
    if (columns.length === 0) continue;
    const json = JSON.stringify(rows);
    const tag = `$restore_${sha256(table.name).slice(0, 12)}$`;
    const identifiers = columns.map(safeIdentifier).join(", ");
    sql.push(`
      with records as (
        select * from jsonb_populate_recordset(null::public.${safeIdentifier(table.name)}, ${tag}${json}${tag}::jsonb)
      )
      insert into public.${safeIdentifier(table.name)} (${identifiers})
      select ${identifiers} from records;
    `);
  }

  sql.push("set local session_replication_role = origin;", "commit;");
  runPsql(sql.join("\n"));
}

function publicForeignKeyOrphans() {
  const constraints = JSON.parse(runPsql(`
    select coalesce(json_agg(row_to_json(fk)), '[]'::json)::text
    from (
      select con.conname,
             child_ns.nspname as child_schema,
             child.relname as child_table,
             parent_ns.nspname as parent_schema,
             parent.relname as parent_table,
             json_agg(child_att.attname order by key_position.ordinality) as child_columns,
             json_agg(parent_att.attname order by key_position.ordinality) as parent_columns
      from pg_constraint con
      join pg_class child on child.oid = con.conrelid
      join pg_namespace child_ns on child_ns.oid = child.relnamespace
      join pg_class parent on parent.oid = con.confrelid
      join pg_namespace parent_ns on parent_ns.oid = parent.relnamespace
      join lateral unnest(con.conkey, con.confkey) with ordinality
        as key_position(child_num, parent_num, ordinality) on true
      join pg_attribute child_att on child_att.attrelid = child.oid and child_att.attnum = key_position.child_num
      join pg_attribute parent_att on parent_att.attrelid = parent.oid and parent_att.attnum = key_position.parent_num
      where con.contype = 'f' and child_ns.nspname = 'public'
      group by con.conname, child_ns.nspname, child.relname, parent_ns.nspname, parent.relname
      order by child.relname, con.conname
    ) fk;
  `));

  const failures = [];
  for (const constraint of constraints) {
    const childTable = `${safeIdentifier(constraint.child_schema)}.${safeIdentifier(constraint.child_table)}`;
    const parentTable = `${safeIdentifier(constraint.parent_schema)}.${safeIdentifier(constraint.parent_table)}`;
    const present = constraint.child_columns.map((column) => `c.${safeIdentifier(column)} is not null`).join(" and ");
    const match = constraint.child_columns.map((column, index) => (
      `p.${safeIdentifier(constraint.parent_columns[index])} = c.${safeIdentifier(column)}`
    )).join(" and ");
    const count = Number(runPsql(`select count(*) from ${childTable} c where ${present} and not exists (select 1 from ${parentTable} p where ${match});`));
    if (count > 0) failures.push({ constraint: constraint.conname, count });
  }
  return failures;
}

async function run() {
  const snapshotDirectory = process.argv[2];
  if (!snapshotDirectory) fail("Usage: node scripts/backup-restore-drill.mjs <secure-temp-directory>");
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    fail("Production Supabase URL and service role key are required.");
  }

  mkdirSync(snapshotDirectory, { recursive: true, mode: 0o700 });
  chmodSync(snapshotDirectory, 0o700);
  const startedAt = new Date();
  const production = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const metadata = localTableMetadata();
  const tables = [];

  for (const table of metadata) {
    const rows = await fetchAllRows(production, table.table_name);
    const file = `table-${table.table_name}.json`;
    const path = join(snapshotDirectory, file);
    writeFileSync(path, `${JSON.stringify(rows)}\n`, { mode: 0o600 });
    tables.push({
      name: table.table_name,
      count: rows.length,
      file,
      sha256: sha256(canonicalRows(rows)),
    });
  }

  const storage = await snapshotStorage(production, snapshotDirectory);
  const snapshotCompletedAt = new Date();
  const manifest = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    sourceCapturedAt: snapshotCompletedAt.toISOString(),
    tables,
    storage,
  };
  writeFileSync(join(snapshotDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });

  const status = localStatus();
  const local = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  restoreDatabase(snapshotDirectory, manifest, metadata);
  const storageRestored = await restoreStorage(local, snapshotDirectory, storage);
  const storageReferenceChecks = verifyImageStorageReferences(snapshotDirectory, storage);

  const verificationFailures = [];
  for (const table of tables) {
    const rows = await fetchAllRows(local, table.name);
    const restoredHash = sha256(canonicalRows(rows));
    if (rows.length !== table.count || restoredHash !== table.sha256) {
      verificationFailures.push({ table: table.name, expected: table.count, restored: rows.length });
    }
  }
  const foreignKeyFailures = publicForeignKeyOrphans();
  if (verificationFailures.length > 0 || foreignKeyFailures.length > 0) {
    fail(`Restore verification failed: ${JSON.stringify({ verificationFailures, foreignKeyFailures })}`);
  }

  const completedAt = new Date();
  const result = {
    ok: true,
    sourceCapturedAt: manifest.sourceCapturedAt,
    tableCount: tables.length,
    rowCount: tables.reduce((sum, table) => sum + table.count, 0),
    storageBucketCount: storage.length,
    storageObjectCount: storage.reduce((sum, bucket) => sum + bucket.objectCount, 0),
    storageTotalBytes: storage.reduce((sum, bucket) => sum + bucket.totalBytes, 0),
    restoredStorageSamples: storageRestored.length,
    foreignKeyConstraintsChecked: JSON.parse(runPsql("select count(*)::text from pg_constraint con join pg_namespace n on n.oid=con.connamespace where con.contype='f' and n.nspname='public';")),
    referencedStorageSamples: storageReferenceChecks.length,
    snapshotAgeAtRestoreSeconds: Math.round((completedAt.getTime() - snapshotCompletedAt.getTime()) / 1000),
    snapshotDurationSeconds: Number(((snapshotCompletedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)),
    restoreDurationSeconds: Number(((completedAt.getTime() - snapshotCompletedAt.getTime()) / 1000).toFixed(1)),
    totalDurationSeconds: Number(((completedAt.getTime() - startedAt.getTime()) / 1000).toFixed(1)),
  };
  writeFileSync(join(snapshotDirectory, "result.json"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify(result, null, 2));
}

try {
  await run();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
