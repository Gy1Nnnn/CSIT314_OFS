/** Parse FastAPI-style `{ detail: string | array }` JSON error bodies. */
export function formatApiError(data) {
  if (data && typeof data === 'object' && 'detail' in data) {
    const detail = data.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((d) =>
          d && typeof d === 'object' && 'msg' in d ? String(d.msg) : '',
        )
        .filter(Boolean)
        .join(' ')
    }
  }
  return 'Request failed'
}

/** When the body is not FastAPI JSON (e.g. proxy 502 HTML), explain instead of a generic message. */
export function formatHttpError(res, rawText, data) {
  const msg = formatApiError(data)
  if (msg !== 'Request failed') return msg
  if (res.status >= 502 && res.status <= 504) {
    return 'Could not reach the API. Start the FastAPI server on port 8000 and open the app with npm run dev (Vite proxies /api).'
  }
  if (res.status === 404) {
    return 'API not found. Use npm run dev so /api is proxied to the backend; do not open index.html from disk without a proxy.'
  }
  const snippet = rawText.slice(0, 200).trim()
  if (snippet && !snippet.startsWith('<')) return snippet
  return `Request failed (HTTP ${res.status}). Start the backend and use the Vite dev server so /api works.`
}
