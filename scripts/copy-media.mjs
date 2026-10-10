// Copies media objects between the MinIO bucket and the Railway bucket.
// Never deletes or overwrites-with-different-content on the source side; the
// source is only listed and read.
//
// Run with Railway-provided credentials so nothing is written to disk:
//
//   railway run node scripts/copy-media.mjs                 # minio -> railway
//   railway run node scripts/copy-media.mjs --verify        # compare only
//   railway run node scripts/copy-media.mjs --from railway --to minio
//
// Flags:
//   --from / --to   minio | railway (default: minio -> railway)
//   --verify        copy nothing; report missing or size-mismatched objects and
//                   cross-check against the filenames Payload knows about
//   --dry-run       list what would be copied

import {
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  S3Client,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};

const from = option("from", "minio");
const to = option("to", "railway");
const verifyOnly = flag("verify");
const dryRun = flag("dry-run");

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing env var ${name}. Run this through \`railway run\`.`);
    process.exit(1);
  }
  return value;
};

const backends = {
  minio: () => ({
    bucket: required("MINIO_BUCKET"),
    client: new S3Client({
      // MINIO_ENDPOINT can be a private-network address that is unreachable
      // from outside Railway, so prefer the public host when it is set.
      endpoint: process.env.NEXT_PUBLIC_BUCKET_HOST
        ? `https://${process.env.NEXT_PUBLIC_BUCKET_HOST}`
        : required("MINIO_ENDPOINT"),
      forcePathStyle: true,
      region: "auto",
      credentials: {
        accessKeyId: required("MINIO_ACCESS_KEY"),
        secretAccessKey: required("MINIO_SECRET_KEY"),
      },
    }),
  }),
  railway: () => ({
    bucket: required("S3_BUCKET"),
    client: new S3Client({
      endpoint: required("S3_ENDPOINT"),
      forcePathStyle: false,
      region: process.env.S3_REGION || "auto",
      credentials: {
        accessKeyId: required("S3_ACCESS_KEY_ID"),
        secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
      },
    }),
  }),
};

if (!backends[from] || !backends[to] || from === to) {
  console.error("--from and --to must be different and one of: minio, railway");
  process.exit(1);
}

const source = backends[from]();
const target = backends[to]();

async function listAll({ client, bucket }) {
  const objects = new Map();
  let ContinuationToken;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, ContinuationToken }),
    );
    for (const object of page.Contents ?? []) {
      objects.set(object.Key, object.Size);
    }
    ContinuationToken = page.IsTruncated
      ? page.NextContinuationToken
      : undefined;
  } while (ContinuationToken);
  return objects;
}

// Filenames Payload has media documents for, read through the public REST API
// so this works without direct database access.
async function listPayloadFilenames() {
  const base = process.env.FRONTEND_URL;
  if (!base) return null;
  const filenames = new Set();
  let page = 1;
  for (;;) {
    const response = await fetch(
      `${base}/api/media?limit=200&depth=0&page=${page}`,
    );
    if (!response.ok) {
      console.warn(`Could not read ${base}/api/media (${response.status})`);
      return null;
    }
    const body = await response.json();
    for (const doc of body.docs) {
      if (doc.filename) filenames.add(doc.filename);
    }
    if (!body.hasNextPage) break;
    page = body.nextPage;
  }
  return filenames;
}

async function copyObject(key) {
  const head = await source.client.send(
    new HeadObjectCommand({ Bucket: source.bucket, Key: key }),
  );
  const object = await source.client.send(
    new GetObjectCommand({ Bucket: source.bucket, Key: key }),
  );
  await new Upload({
    client: target.client,
    params: {
      Bucket: target.bucket,
      Key: key,
      Body: object.Body,
      ContentType: head.ContentType,
    },
  }).done();
}

console.log(`${from} (${source.bucket}) -> ${to} (${target.bucket})`);

const sourceObjects = await listAll(source);
let targetObjects = await listAll(target);

const pending = [...sourceObjects].filter(
  ([key, size]) => targetObjects.get(key) !== size,
);

console.log(
  `source: ${sourceObjects.size} objects, target: ${targetObjects.size} objects, to copy: ${pending.length}`,
);

if (!verifyOnly) {
  let done = 0;
  for (const [key] of pending) {
    if (dryRun) {
      console.log(`would copy ${key}`);
      continue;
    }
    await copyObject(key);
    done++;
    if (done % 25 === 0 || done === pending.length) {
      console.log(`copied ${done}/${pending.length}`);
    }
  }
  if (!dryRun) targetObjects = await listAll(target);
}

let problems = 0;

for (const [key, size] of sourceObjects) {
  if (!targetObjects.has(key)) {
    console.log(`MISSING in ${to}: ${key}`);
    problems++;
  } else if (targetObjects.get(key) !== size) {
    console.log(
      `SIZE MISMATCH: ${key} (${from} ${size}, ${to} ${targetObjects.get(key)})`,
    );
    problems++;
  }
}

const payloadFilenames = await listPayloadFilenames();
if (payloadFilenames) {
  let unbacked = 0;
  for (const filename of payloadFilenames) {
    if (!targetObjects.has(filename)) {
      console.log(`Payload media document has no object in ${to}: ${filename}`);
      unbacked++;
    }
  }
  console.log(
    `payload media documents: ${payloadFilenames.size}, without object in ${to}: ${unbacked}`,
  );
  problems += unbacked;
} else {
  console.log("Skipped Payload cross-check (FRONTEND_URL not set or unreachable)");
}

const sourceBytes = [...sourceObjects.values()].reduce((a, b) => a + b, 0);
const targetBytes = [...targetObjects.values()].reduce((a, b) => a + b, 0);
console.log(
  `${from}: ${sourceObjects.size} objects / ${sourceBytes} bytes; ${to}: ${targetObjects.size} objects / ${targetBytes} bytes`,
);

if (problems > 0) {
  console.log(`FAILED: ${problems} problem(s)`);
  process.exit(1);
}
console.log("OK: every source object is present in the target with matching size");
