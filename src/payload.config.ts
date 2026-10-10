import { postgresAdapter } from "@payloadcms/db-postgres";
import { resendAdapter } from "@payloadcms/email-resend";
import { stripePlugin } from "@payloadcms/plugin-stripe";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import { s3Storage } from "@payloadcms/storage-s3";
import path from "path";
import { buildConfig } from "payload";
import sharp from "sharp";
import { fileURLToPath } from "url";

// Webhooks
import { paymentIntentFailed } from "./webhooks/paymentIntentFailed";
import { paymentIntentSucceeded } from "./webhooks/paymentIntentSucceeded";

// Collections
import { Carts } from "./collections/Carts";
import { Categories } from "./collections/Categories";
import { Coupons } from "./collections/Coupons";
import { Media } from "./collections/Media";
import { Orders } from "./collections/Orders";
import { Products } from "./collections/Products";
import { Shipping } from "./collections/Shipping";
import { Users } from "./collections/Users";

// Globals
import { Catalogue } from "./globals/Catalogue";
import { LandingPage } from "./globals/LandingPage";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

// Media storage backend. Defaults to MinIO; set STORAGE_BACKEND=railway to
// read and write the Railway bucket instead. Both configurations stay in place
// so switching back is an env var change.
const useRailwayBucket = process.env.STORAGE_BACKEND === "railway";

export default buildConfig({
  serverURL: process.env.FRONTEND_URL || "http://localhost:3000",
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    components: {
      providers: ["@/components/admin/AdminStyleProvider"],
      views: {
        dashboard: {
          Component: "@/components/admin/Dashboard",
        },
      },
    },
  },
  collections: [
    Products,
    Categories,
    Media,
    Orders,
    Coupons,
    Shipping,
    Users,
    Carts,
  ],
  globals: [Catalogue, LandingPage],
  onInit: (payload) => {
    // node-postgres emits `error` on clients sitting idle in the pool when the
    // connection is closed from the other side. Without a listener this is an
    // unhandled exception; with one, the client is discarded and the next
    // query gets a fresh connection.
    const { pool } = payload.db as unknown as {
      pool?: { on: (event: "error", listener: (err: Error) => void) => void };
    };
    pool?.on("error", (error) => {
      payload.logger.error({ err: error }, "Postgres idle client error");
    });
  },
  editor: lexicalEditor(),
  secret: process.env.PAYLOAD_SECRET || "your-secret-key",
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
  db: postgresAdapter({
    pool: {
      connectionString: process.env.DATABASE_URL || "",
      // Bound the pool - the app container is small and Postgres has a
      // finite connection limit.
      max: 10,
      // Recycle idle connections before the server or the proxy in front of
      // it closes them. A connection dropped server-side and then handed to
      // the next query surfaces as `read ECONNRESET` mid-render.
      idleTimeoutMillis: 30_000,
      // Fail fast instead of hanging a server render on pool exhaustion.
      connectionTimeoutMillis: 10_000,
      // TCP keepalives stop idle sockets being silently dropped in transit.
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      allowExitOnIdle: false,
    },
  }),
  plugins: [
    s3Storage({
      collections: {
        media: {
          generateFileURL: ({ filename }: { filename: string }) => {
            // The Railway bucket is private, so files are served through
            // Payload's own file route on this app.
            if (useRailwayBucket) {
              return `/api/media/file/${encodeURIComponent(filename)}`;
            }
            // MINIO_ENDPOINT may be a private-network address that only the
            // server can reach, so URLs handed to browsers use the public host.
            const publicHost = process.env.NEXT_PUBLIC_BUCKET_HOST;
            const base = publicHost
              ? `https://${publicHost}`
              : process.env.MINIO_ENDPOINT;
            return `${base}/${process.env.MINIO_BUCKET}/${filename}`;
          },
        },
      },
      bucket: (useRailwayBucket
        ? process.env.S3_BUCKET
        : process.env.MINIO_BUCKET) as string,
      config: useRailwayBucket
        ? {
            // Railway buckets use virtual-hosted style URLs.
            forcePathStyle: false,
            endpoint: process.env.S3_ENDPOINT as string,
            credentials: {
              accessKeyId: process.env.S3_ACCESS_KEY_ID as string,
              secretAccessKey: process.env.S3_SECRET_ACCESS_KEY as string,
            },
            region: process.env.S3_REGION || "auto",
          }
        : {
            forcePathStyle: true,
            endpoint: process.env.MINIO_ENDPOINT as string,
            credentials: {
              accessKeyId: process.env.MINIO_ACCESS_KEY as string,
              secretAccessKey: process.env.MINIO_SECRET_KEY as string,
            },
            region: "auto",
          },
    }),
    stripePlugin({
      stripeSecretKey: process.env.STRIPE_API_KEY || "",
      stripeWebhooksEndpointSecret: process.env.STRIPE_WEBHOOKS_ENDPOINT_SECRET,
      rest: false,
      logs: process.env.NODE_ENV === "development",
      webhooks: {
        "payment_intent.succeeded": paymentIntentSucceeded,
        "payment_intent.payment_failed": paymentIntentFailed,
      },
    }),
  ],
  email: resendAdapter({
    apiKey: process.env.RESEND_API_KEY || "",
    defaultFromAddress: "noreply@mail.fosjewels.com",
    defaultFromName: "φως",
  }),
  cors: [process.env.FRONTEND_URL ?? "", "http://localhost:3000"],
  csrf: [process.env.FRONTEND_URL ?? "", "http://localhost:3000"],
  sharp,
});
