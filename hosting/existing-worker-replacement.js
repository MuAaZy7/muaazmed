// Drop-in replacement for the existing muaazmed-login route Worker.
// Keeps the existing GitHub Pages origin. No ASSETS binding required.
const SITE = "https://muaazmed.com";
const SUPABASE_URL = "https://iljabiojmcrvvhhninsk.supabase.co";
const PUBLIC_KEY = "sb_publishable_Rw5N5iPomjtsVdAg1Luy_w_dIzfAb41";
const COOKIE = "__Host-med_session";
const PUBLIC = new Set([
  "/account.html", "/assets/account.js", "/assets/account.css"
]);
const NO_STORE = {
  "Cache-Control": "private, no-store",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "same-origin"
};

function reply(body, status = 200, extra = {}) {
  return new Response(body, {status, headers: {...NO_STORE, ...extra}});
}
function sessionCookie(request) {
  return (request.headers.get("Cookie") || "").split(";")
    .map(s => s.trim()).find(s => s.startsWith(COOKIE + "="))
    ?.slice(COOKIE.length + 1) || "";
}
async function activeMember(token) {
  if (!token || token.length > 3800 ||
      !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return false;
  try {
    const response = await fetch(SUPABASE_URL + "/rest/v1/rpc/member_status", {
      method: "POST",
      headers: {apikey: PUBLIC_KEY, Authorization: "Bearer " + token,
        "Content-Type": "application/json"},
      body: "{}"
    });
    return response.ok && (await response.json())?.active === true;
  } catch { return false; }
}
async function origin(request) {
  const headers = new Headers(request.headers);
  headers.delete("Cookie");
  headers.delete("Authorization");
  const response = await fetch(new Request(request, {headers, redirect: "manual"}));
  const out = new Headers(response.headers);
  for (const [k, v] of Object.entries(NO_STORE)) out.set(k, v);
  out.delete("Set-Cookie");
  return new Response(response.body, {status: response.status, headers: out});
}
export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (url.origin !== SITE) {
      if (!["GET", "HEAD"].includes(request.method)) return reply("Use muaazmed.com", 403);
      return reply(null, 302, {Location: SITE + path + url.search});
    }
    if (path === "/_auth/session" || path === "/_auth/logout") {
      if (request.method !== "POST" || request.headers.get("Origin") !== SITE)
        return reply("Forbidden", 403);
      if (path === "/_auth/logout")
        return reply("OK", 200, {"Set-Cookie": COOKIE + "=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0"});
      const token = (request.headers.get("Authorization") || "").match(/^Bearer (.+)$/)?.[1] || "";
      if (!await activeMember(token)) return reply("Active membership required", 403);
      return reply("OK", 200, {"Set-Cookie": COOKIE + "=" + token + "; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=3600"});
    }
    if (!["GET", "HEAD"].includes(request.method)) return reply("Method not allowed", 405);
    if (path === "/backend-config.js") {
      return reply("window.MED_BACKEND=" + JSON.stringify({
        url: SUPABASE_URL, publishableKey: PUBLIC_KEY, protectedHosting: true
      }) + ";", 200, {"Content-Type": "application/javascript; charset=utf-8"});
    }
    if (PUBLIC.has(path)) return origin(request);
    if (!await activeMember(sessionCookie(request))) {
      if (request.headers.get("Sec-Fetch-Dest") === "document" ||
          request.headers.get("Accept")?.includes("text/html")) {
        return reply(null, 302, {Location: "/account.html?next=" + encodeURIComponent(path + url.search)});
      }
      return reply("Active membership required", 403);
    }
    return origin(request);
  }
};
