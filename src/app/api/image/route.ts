import { isIP } from "node:net";
import { lookup } from "node:dns/promises";

import { NextResponse, type NextRequest } from "next/server";

const ALLOWED_HOSTS = new Set([
  "opengraph.githubassets.com",
  "raw.githubusercontent.com",
  "user-images.githubusercontent.com",
  "avatars.githubusercontent.com",
  "github.com",
]);

function privateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0
    );
  }
  return (
    address === "::1" ||
    address.startsWith("fc") ||
    address.startsWith("fd") ||
    address.startsWith("fe80") ||
    address === "::"
  );
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url");
  if (!raw)
    return NextResponse.json(
      { error: { code: "MISSING_URL", message: "Missing image URL" } },
      { status: 400 },
    );
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return NextResponse.json(
      { error: { code: "INVALID_URL", message: "Invalid image URL" } },
      { status: 400 },
    );
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname))
    return NextResponse.json(
      { error: { code: "BLOCKED_HOST", message: "Image host is not allowed" } },
      { status: 403 },
    );
  const addresses = await lookup(url.hostname, { all: true });
  if (addresses.some((item) => privateAddress(item.address)))
    return NextResponse.json(
      {
        error: {
          code: "PRIVATE_ADDRESS",
          message: "Private addresses are blocked",
        },
      },
      { status: 403 },
    );
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(url, {
      redirect: "error",
      signal: controller.signal,
      headers: { "User-Agent": "github-personal-search/1.0" },
    });
    if (!response.ok)
      return NextResponse.json(
        { error: { code: "UPSTREAM", message: "Image fetch failed" } },
        { status: 502 },
      );
    const type = response.headers.get("content-type") ?? "";
    const length = Number.parseInt(
      response.headers.get("content-length") ?? "0",
      10,
    );
    const allowedTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/gif",
      "image/avif",
    ]);
    const normalizedType = type.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (!allowedTypes.has(normalizedType) || length > 5 * 1024 * 1024)
      return NextResponse.json(
        { error: { code: "INVALID_IMAGE", message: "Invalid image response" } },
        { status: 415 },
      );
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 5 * 1024 * 1024)
      return NextResponse.json(
        { error: { code: "TOO_LARGE", message: "Image exceeds size limit" } },
        { status: 413 },
      );
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": normalizedType,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
        "Content-Length": String(bytes.byteLength),
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}
