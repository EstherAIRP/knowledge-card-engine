export class HttpError extends Error {
  constructor(status, code, message, options = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.clearSession = options.clearSession === true;
  }
}

export function noStoreHeaders(extra = {}) {
  return {
    'Cache-Control': 'no-store',
    ...extra
  };
}

export function jsonResponse(status, payload, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: noStoreHeaders({
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    })
  });
}

export function htmlResponse(status, html, headers = {}) {
  return new Response(html, {
    status,
    headers: noStoreHeaders({
      'Content-Type': 'text/html; charset=utf-8',
      ...headers
    })
  });
}

export function redirectResponse(location, status = 302, cookies = []) {
  const headers = new Headers(noStoreHeaders({
    Location: location,
    'Referrer-Policy': 'no-referrer'
  }));
  for (const cookie of cookies) headers.append('Set-Cookie', cookie);
  return new Response(null, { status, headers });
}

export function methodNotAllowed(allowed) {
  return jsonResponse(405, {
    code: 'METHOD_NOT_ALLOWED',
    detail: 'Method not allowed.'
  }, { Allow: allowed.join(', ') });
}

export function errorResponse(error) {
  if (error instanceof HttpError) {
    return jsonResponse(error.status, { code: error.code, detail: error.message });
  }
  return jsonResponse(500, { code: 'INTERNAL_ERROR', detail: 'Unexpected server error.' });
}
