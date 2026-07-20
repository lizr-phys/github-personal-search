export function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  return (
    document.cookie
      .split("; ")
      .find((item) => item.startsWith("gps_csrf="))
      ?.split("=")
      .slice(1)
      .join("=") ?? ""
  );
}

export async function apiFetch<T>(
  url: string,
  init: RequestInit = {},
): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(method !== "GET" && method !== "HEAD"
        ? { "x-gps-csrf": getCsrfToken() }
        : {}),
      ...init.headers,
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? `Request failed (${response.status})`,
    );
  return payload;
}
