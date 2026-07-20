import { createDatabase } from "./client";

const { client } = createDatabase();

try {
  const tables = [
    "email_deliveries", "subscription_matches", "subscriptions", "learning_logs", "notes", "collection_repositories", "collections",
    "interactions", "exposures", "feed_batches", "feed_queue_items", "feed_queues", "search_results", "search_sessions",
    "user_interest_items", "user_profiles", "auth_accounts", "repository_relations", "repository_embeddings", "repository_documents",
    "repository_snapshots", "repositories", "algorithm_versions", "job_runs", "users"
  ];
  await client.unsafe(`truncate table ${tables.map((table) => `"${table}"`).join(", ")} restart identity cascade`);
  console.log("GPS development database reset. Run pnpm db:seed next.");
} finally {
  await client.end();
}
