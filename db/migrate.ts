import { migrate } from "drizzle-orm/postgres-js/migrator";

import { createDatabase } from "./client";

const { db, client } = createDatabase();

try {
  await client`create extension if not exists vector`;
  await migrate(db, { migrationsFolder: "db/migrations" });
  console.log("GPS database migrations applied.");
} finally {
  await client.end();
}
