/**
 * Cloudflare Worker: the built app's static assets, plus a thin proxy for the BMKG
 * forecast API.
 *
 * BMKG does not send usable CORS headers, so the browser cannot call it directly.
 * This is the only server-side code in the project and it stays deliberately thin:
 * validate, fetch, cache, add CORS. No parsing -- that lives in src/lib/bmkg.ts,
 * where it is unit-tested.
 *
 * Served at /api/forecast. vite.config.ts mirrors the same path in dev so client
 * code never has to branch on environment.
 *
 * Everything else is handed to the ASSETS binding. Static files are matched before
 * this Worker is woken at all, so serving the app costs no invocation; only a path
 * that matches no built file arrives here.
 *
 * This file targets the Workers runtime, not the browser, so it is excluded from
 * the app's tsconfig and types the request/response surface locally.
 */

const BMKG_ENDPOINT = 'https://api.bmkg.go.id/publik/prakiraan-cuaca'

/**
 * Kemendagri level-IV code, e.g. "31.71.03.1001".
 *
 * Validated before any outbound request so this endpoint cannot be turned into an
 * open proxy for arbitrary URLs.
 */
const ADM4_PATTERN = /^\d{2}\.\d{2}\.\d{2}\.\d{4}$/

/**
 * BMKG publishes twice a day and rate-limits to 60 req/min per IP. Caching at the
 * edge is what keeps a handful of concurrent users from exhausting that budget --
 * it is protection, not a speed optimisation.
 */
const CACHE_SECONDS = 1800

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void
}

declare const caches: { default: Cache }

function json(body: unknown, status: number, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'access-control-allow-origin': '*',
      ...extraHeaders,
    },
  })
}

async function forecast(url: URL, ctx: ExecutionContext): Promise<Response> {
  const adm4 = url.searchParams.get('adm4')

  if (!adm4 || !ADM4_PATTERN.test(adm4)) {
    return json(
      { error: 'Parameter adm4 tidak valid. Format yang benar: 31.71.03.1001' },
      400,
    )
  }

  // Key the cache on the normalised upstream URL, so incidental differences in the
  // incoming request (extra params, ordering) cannot fragment or poison entries.
  const upstream = `${BMKG_ENDPOINT}?adm4=${adm4}`
  const cacheKey = new Request(upstream, { method: 'GET' })
  const cache = caches.default

  const hit = await cache.match(cacheKey)
  if (hit) return hit

  let upstreamRes: Response
  try {
    upstreamRes = await fetch(upstream, {
      headers: { accept: 'application/json' },
      // BMKG 301-redirects unrecognised queries to an HTML page; following that
      // would hand the client a blob of HTML with a 200 status.
      redirect: 'manual',
    })
  } catch {
    return json({ error: 'Tidak dapat menghubungi server BMKG.' }, 502)
  }

  if (upstreamRes.status !== 200) {
    return json(
      { error: `BMKG tidak mengembalikan data untuk kode ${adm4}.` },
      upstreamRes.status === 404 || upstreamRes.status === 301 ? 404 : 502,
    )
  }

  const body = await upstreamRes.text()
  // Guard against BMKG answering 200 with something that is not JSON.
  if (!body.trimStart().startsWith('{')) {
    return json({ error: 'Respons BMKG tidak dikenali.' }, 502)
  }

  const res = json(JSON.parse(body), 200, {
    'cache-control': `public, max-age=${CACHE_SECONDS}`,
    'x-data-source': 'BMKG',
  })

  ctx.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}

/** CORS preflight, in case the app is ever served from a different origin. */
function preflight(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-max-age': '86400',
    },
  })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    // Pages routed by filename; a Worker has to say which paths are its own. Only
    // this one is, and it is matched exactly rather than by prefix so that no other
    // path can be smuggled into the proxy.
    if (url.pathname === '/api/forecast') {
      if (request.method === 'OPTIONS') return preflight()
      if (request.method !== 'GET') {
        return json({ error: 'Metode tidak didukung.' }, 405, { allow: 'GET, OPTIONS' })
      }
      return forecast(url, ctx)
    }

    return env.ASSETS.fetch(request)
  },
}
