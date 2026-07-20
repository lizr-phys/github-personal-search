import type { NextRequest } from "next/server";

export function getCanonicalAppUrl(request?: NextRequest): URL {
  const configured = process.env.APP_URL;
  const fallback = request?.nextUrl.origin ?? "http://localhost:3000";
  const url = new URL(configured || fallback);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("APP_URL must use HTTP or HTTPS");
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    process.env.NODE_ENV === "production" &&
    url.protocol !== "https:" &&
    !loopback
  )
    throw new Error("APP_URL must use HTTPS in production");
  return url;
}

export function appUrl(pathname: string, request?: NextRequest): URL {
  return new URL(pathname, getCanonicalAppUrl(request));
}
