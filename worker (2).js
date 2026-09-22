/**
 * Cloudflare Worker: shared Facilitator state for "Creating Bespoke Learning Activities"
 *
 * Stores ONE JSON object in KV under the key "state":
 *   { sequence: bool, challenge: bool, studio: bool, showcase: bool, updatedAt: ISOString }
 *
 * Endpoints:
 *   GET  /api/state   -> public, returns the current published-phase state
 *   POST /api/verify  -> body: { passcode } -> 200 if correct, 401 if not
 *   POST /api/state   -> body: { passcode, publishedPhases } -> updates state (passcode checked server-side)
 *
 * Bindings required (set in wrangler.toml / dashboard):
 *   - KV namespace bound as PHASE_KV
 *   - Secret FACILITATOR_PASSCODE (wrangler secret put FACILITATOR_PASSCODE)
 */

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*", // tighten to your GitHub Pages origin if you want to restrict it
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DEFAULT_STATE = {
  sequence: true,
  challenge: false,
  studio: false,
  showcase: false,
  updatedAt: null,
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (url.pathname === "/api/state" && request.method === "GET") {
      const raw = await env.PHASE_KV.get("state");
      const state = raw ? JSON.parse(raw) : DEFAULT_STATE;
      return json(state);
    }

    if (url.pathname === "/api/verify" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }
      if (!body.passcode || body.passcode !== env.FACILITATOR_PASSCODE) {
        return json({ ok: false, error: "Sai mật khẩu" }, 401);
      }
      return json({ ok: true });
    }

    if (url.pathname === "/api/state" && request.method === "POST") {
      let body;
      try {
        body = await request.json();
      } catch {
        return json({ error: "Invalid JSON" }, 400);
      }

      if (!body.passcode || body.passcode !== env.FACILITATOR_PASSCODE) {
        return json({ error: "Sai mật khẩu" }, 401);
      }

      const p = body.publishedPhases || {};
      const newState = {
        sequence: !!p.sequence,
        challenge: !!p.challenge,
        studio: !!p.studio,
        showcase: !!p.showcase,
        updatedAt: new Date().toISOString(),
      };

      await env.PHASE_KV.put("state", JSON.stringify(newState));
      return json(newState);
    }

    return json({ error: "Not found" }, 404);
  },
};
