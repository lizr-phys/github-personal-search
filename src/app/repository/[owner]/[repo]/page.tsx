import { RepositoryDetailClient } from "./repository-detail-client";

export default async function RepositoryPage({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const values = await params;
  return <RepositoryDetailClient owner={values.owner} repo={values.repo} />;
}
