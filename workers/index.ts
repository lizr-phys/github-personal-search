import { Worker } from "bullmq";
import IORedis from "ioredis";

import { handleJob, type JobName } from "../src/server/jobs/handlers";

const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  console.log(JSON.stringify({ level: "info", event: "worker_inline_mode", message: "REDIS_URL is not configured; Route Handlers use inline job handlers." }));
  process.exit(0);
}

const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
const worker = new Worker(
  "gps",
  async (job) => handleJob(job.name as JobName, job.data as Record<string, unknown>),
  { connection, concurrency: 4, limiter: { max: 20, duration: 1000 } }
);

worker.on("completed", (job) => console.log(JSON.stringify({ level: "info", event: "job_completed", id: job.id, name: job.name })));
worker.on("failed", (job, error) => console.error(JSON.stringify({ level: "error", event: "job_failed", id: job?.id, name: job?.name, message: error.message })));

async function shutdown() {
  await worker.close();
  await connection.quit();
}
process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
