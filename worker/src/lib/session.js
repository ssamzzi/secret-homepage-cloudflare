const COOKIE_NAME = "shp_session";
const encoder = new TextEncoder();

function toBase64Url(input) {
  const bytes = typeof input === "string" ? encoder.encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function importSigningKey(secret) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function signPayload(payloadText, secret) {
  const key = await importSigningKey(secret);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadText));
  return toBase64Url(new Uint8Array(signature));
}

function parseCookies(request) {
  const cookieHeader = request.headers.get("cookie") || "";
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf("=");
        if (index < 0) return [item, ""];
        return [item.slice(0, index), item.slice(index + 1)];
      }),
  );
}

function makeSetCookie(value, maxAgeSeconds = 60 * 60 * 24 * 30) {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    `Max-Age=${maxAgeSeconds}`,
  ];
  return parts.join("; ");
}

export async function readSession(request, env) {
  const cookies = parseCookies(request);
  const raw = cookies[COOKIE_NAME];
  if (!raw || !env.SESSION_SECRET) {
    return { authenticated: false, currentUser: null };
  }

  const parts = raw.split(".");
  if (parts.length !== 2) {
    return { authenticated: false, currentUser: null };
  }

  try {
    const payloadText = new TextDecoder().decode(fromBase64Url(parts[0]));
    const expectedSignature = await signPayload(payloadText, env.SESSION_SECRET);
    if (expectedSignature !== parts[1]) {
      return { authenticated: false, currentUser: null };
    }
    const payload = JSON.parse(payloadText);
    return {
      authenticated: Boolean(payload.authenticated),
      currentUser: payload.currentUser || null,
    };
  } catch {
    return { authenticated: false, currentUser: null };
  }
}

export async function createSessionSetCookie(env, payload) {
  const payloadText = JSON.stringify({
    authenticated: Boolean(payload.authenticated),
    currentUser: payload.currentUser || null,
    issuedAt: new Date().toISOString(),
  });
  const payloadPart = toBase64Url(payloadText);
  const signature = await signPayload(payloadText, env.SESSION_SECRET);
  return makeSetCookie(`${payloadPart}.${signature}`);
}

export function clearSessionSetCookie() {
  return makeSetCookie("", 0);
}
