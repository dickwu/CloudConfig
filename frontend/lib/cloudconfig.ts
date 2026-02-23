export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE";

export type AuthConfig = {
  baseUrl: string;
  clientId: string;
  privateKeyPem: string;
};

const encoder = new TextEncoder();
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function signedJsonRequest<TResponse>(
  auth: AuthConfig,
  method: HttpMethod,
  path: string,
  body?: unknown,
): Promise<TResponse> {
  const normalizedPath = normalizePath(path);
  const normalizedBaseUrl = normalizeBaseUrl(auth.baseUrl);
  const bodyString = body === undefined ? "" : JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1_000).toString();
  const nonce = crypto.randomUUID();
  const canonical = await createCanonical(
    timestamp,
    method,
    normalizedPath,
    nonce,
    bodyString,
  );

  const signature = await signCanonical(auth.privateKeyPem, canonical);
  const headers: Record<string, string> = {
    "X-Client-Id": auth.clientId.trim(),
    "X-Timestamp": timestamp,
    "X-Nonce": nonce,
    "X-Signature": signature,
  };

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${normalizedBaseUrl}${normalizedPath}`, {
    method,
    headers,
    body: bodyString || undefined,
  });

  if (response.status === 204) {
    return undefined as TResponse;
  }

  const raw = await response.text();
  const parsed = parseJsonIfPossible(raw);
  if (!response.ok) {
    const detail =
      typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2);
    throw new Error(`HTTP ${response.status}: ${detail}`);
  }

  return parsed as TResponse;
}

export function ensureAuthConfig(auth: AuthConfig): void {
  if (!auth.baseUrl.trim()) {
    throw new Error("Base URL is required.");
  }
  requireUuid(auth.clientId, "Client ID");
  if (!auth.privateKeyPem.includes("BEGIN PRIVATE KEY")) {
    throw new Error("Private key must be PEM text.");
  }
}

export function requireUuid(value: string, label: string): string {
  const normalized = value.trim();
  if (!uuidPattern.test(normalized)) {
    throw new Error(`${label} must be a valid UUID.`);
  }
  return normalized;
}

export function toPathSegment(value: string): string {
  return encodeURIComponent(value.trim());
}

async function createCanonical(
  timestamp: string,
  method: HttpMethod,
  path: string,
  nonce: string,
  bodyString: string,
): Promise<string> {
  const bodyHash = await sha256Hex(encoder.encode(bodyString));
  return `${timestamp}\n${method}\n${path}\n${nonce}\n${bodyHash}`;
}

async function signCanonical(
  privateKeyPem: string,
  canonical: string,
): Promise<string> {
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKeyPem),
    "Ed25519",
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "Ed25519",
    privateKey,
    toArrayBuffer(encoder.encode(canonical)),
  );
  return bytesToBase64(new Uint8Array(signature));
}

async function sha256Hex(input: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", toArrayBuffer(input));
  return bytesToHex(new Uint8Array(digest));
}

function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}

function pemToBytes(pem: string): ArrayBuffer {
  const body = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replaceAll(/\s+/g, "");
  const binary = atob(body);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return toArrayBuffer(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const value of bytes) {
    binary += String.fromCharCode(value);
  }
  return btoa(binary);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join(
    "",
  );
}

function parseJsonIfPossible(raw: string): unknown {
  if (!raw) {
    return raw;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}
