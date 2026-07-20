import { Suspense } from "react";

import { PageSkeleton } from "@/components/states";
import { SearchClient } from "./search-client";

export default function SearchPage() {
  return (
    <Suspense fallback={<PageSkeleton cards={4} />}>
      <SearchClient />
    </Suspense>
  );
}
