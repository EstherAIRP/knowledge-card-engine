import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';

export const PUBLIC_WEB_LIMITS = Object.freeze({
  max_redirects: 3,
  max_html_bytes: 4 * 1024 * 1024,
  max_text_bytes: 512 * 1024,
  min_text_characters: 240,
  timeout_ms: 12000
});

function webError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// Never fetch credentials, IP literals, non-standard ports or internal-looking hosts.
export function assertSafePublicWebUrl(rawUrl) {
  let url;
  try { url = new URL(rawUrl); } catch {
    throw webError('SOURCE_URL_INVALID', 'Web source URL is invalid.');
  }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) {
    throw webError('SOURCE_URL_INVALID', 'Web source must use HTTP(S) without credentials or a custom port.');
  }
  const host = url.hostname.toLowerCase();
  if (isIP(host) || host.startsWith('[') || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(host)
      || host.split('.').some((part) => part.startsWith('-') || part.endsWith('-'))
      || /\.(?:localhost|local|internal|lan|test|invalid|example|arpa)$/i.test(host)) {
    throw webError('SOURCE_URL_INVALID', 'Web source must have a public DNS hostname.');
  }
  return url;
}

export function isPublicWebAddress(address, family) {
  if (family === 4 && isIP(address) === 4) {
    const [a, b, c] = address.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 0 || (b === 168) || (b === 88 && c === 99))) return false;
    if (a === 192 && b === 0 && c === 2) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (family === 6 && isIP(address) === 6) {
    const value = address.toLowerCase();
    const first = Number.parseInt(value.split(':')[0], 16);
    // Only native global-unicast IPv6. Reject transition, documentation and local ranges.
    return first >= 0x2000 && first < 0x4000
      && !/^2001:(?:0:|db8:|10:|20:)/.test(value)
      && !/^2002:/.test(value);
  }
  return false;
}

export async function resolvePublicWebAddress(host, lookupImpl = lookup) {
  let addresses;
  try {
    addresses = await lookupImpl(host, { all: true });
  } catch {
    throw webError('INGESTION_EXECUTION_FAILED', 'Public web hostname could not be resolved.');
  }
  if (!Array.isArray(addresses) || addresses.length === 0 ||
      addresses.some((item) => !isPublicWebAddress(item.address, item.family))) {
    throw webError('SOURCE_ACCESS_DENIED', 'Web hostname resolved to a non-public network address.');
  }
  return addresses[0];
}

async function requestOnce(url, address) {
  return new Promise((resolve, reject) => {
    const requester = url.protocol === 'https:' ? httpsRequest : httpRequest;
    const req = requester(url, {
      method: 'GET',
      agent: false,
      family: address.family,
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      headers: {
        accept: 'text/html,application/xhtml+xml',
        'accept-encoding': 'identity',
        'user-agent': 'KnowledgeCardEngine/1.0 (+public-html-ingestion)'
      }
    }, (res) => {
      const status = res.statusCode || 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        const location = res.headers.location;
        res.resume();
        resolve({ redirect: location || null });
        return;
      }
      if (status === 404 || status === 410) {
        res.resume();
        reject(webError('SOURCE_NOT_FOUND', 'Public web document was not found.'));
        return;
      }
      if (status === 401 || status === 403) {
        res.resume();
        reject(webError('SOURCE_ACCESS_DENIED', 'Public web document requires authorization.'));
        return;
      }
      if (status === 429 || status >= 500) {
        res.resume();
        reject(webError('INGESTION_EXECUTION_FAILED', 'Public web server is temporarily unavailable.'));
        return;
      }
      if (status < 200 || status >= 300) {
        res.resume();
        reject(webError('SOURCE_FETCH_FAILED', 'Public web server returned HTTP ' + status + '.'));
        return;
      }
      const contentType = String(res.headers['content-type'] || '').toLowerCase();
      const encoding = String(res.headers['content-encoding'] || 'identity').toLowerCase();
      if (!/^(text\/html|application\/xhtml\+xml)(?:\s*;|$)/.test(contentType)
          || !['identity', ''].includes(encoding)
          || /charset\s*=\s*["']?(?!utf-8\b|utf8\b)[^;"'\s]+/i.test(contentType)) {
        res.resume();
        reject(webError('SOURCE_PROVIDER_UNSUPPORTED', 'Only uncompressed UTF-8 HTML documents are supported.'));
        return;
      }
      const declaredBytes = Number(res.headers['content-length'] || 0);
      if (declaredBytes > PUBLIC_WEB_LIMITS.max_html_bytes) {
        res.resume();
        reject(webError('SOURCE_INCOMPLETE', 'HTML document exceeds the accepted size limit.'));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', (chunk) => {
        size += chunk.length;
        if (size > PUBLIC_WEB_LIMITS.max_html_bytes) {
          res.destroy(webError('SOURCE_INCOMPLETE', 'HTML document exceeds the accepted size limit.'));
        } else {
          chunks.push(chunk);
        }
      });
      res.on('error', reject);
      res.on('end', () => {
        try {
          const html = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
          resolve({ html });
        } catch {
          reject(webError('SOURCE_INCOMPLETE', 'HTML document is not valid UTF-8.'));
        }
      });
    });
    req.setTimeout(PUBLIC_WEB_LIMITS.timeout_ms, () => {
      req.destroy(webError('INGESTION_EXECUTION_FAILED', 'Public web request timed out.'));
    });
    req.on('error', (cause) => reject(cause?.code === 'SOURCE_INCOMPLETE' || cause?.code === 'INGESTION_EXECUTION_FAILED'
      ? cause : webError('INGESTION_EXECUTION_FAILED', 'Public web request failed.')));
    req.end();
  });
}

// Every redirect gets independent DNS validation. The socket uses the validated IP,
// so the client cannot resolve a different address between the check and connection.
export async function fetchPublicHtml(rawUrl, { lookupImpl = lookup } = {}) {
  let current = String(rawUrl);
  for (let redirects = 0; redirects <= PUBLIC_WEB_LIMITS.max_redirects; redirects += 1) {
    const url = assertSafePublicWebUrl(current);
    const address = await resolvePublicWebAddress(url.hostname, lookupImpl);
    const result = await requestOnce(url, address);
    if (!Object.hasOwn(result, 'redirect')) {
      return { finalUrl: url.toString(), html: result.html };
    }
    if (!result.redirect || redirects === PUBLIC_WEB_LIMITS.max_redirects) {
      throw webError('SOURCE_FETCH_FAILED', 'Public web document has an invalid or excessive redirect chain.');
    }
    current = new URL(result.redirect, url).toString();
  }
  throw webError('SOURCE_FETCH_FAILED', 'Public web redirect limit exceeded.');
}

function decodeEntities(input) {
  const entities = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    ndash: '–', mdash: '—', hellip: '…', rsquo: '’', lsquo: '‘',
    rdquo: '”', ldquo: '“', bull: '•', copy: '©'
  };
  return input.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (_match, name) => {
    if (name[0] === '#') {
      const code = name[1]?.toLowerCase() === 'x'
        ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff)
        ? String.fromCodePoint(code) : ' ';
    }
    return entities[name.toLowerCase()] || _match;
  });
}

function plainText(markup) {
  return decodeEntities(markup
    .replace(/<\/?(?:br|hr)\b[^>]*\/?>/gi, '\n')
    .replace(/<\/(?:h[1-6]|p|div|li|section|article|main|pre|tr|table|blockquote)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
  ).split(/\r?\n/).map((line) => line.replace(/[\t \u00a0]+/g, ' ').trim())
    .filter(Boolean).join('\n').trim();
}

export function extractPublicHtml(html) {
  if (typeof html !== 'string' || !html.trim()) {
    throw webError('SOURCE_INCOMPLETE', 'Public web document is empty.');
  }
  const titleHtml = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '';
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:script|style|noscript|svg|iframe|template)\b[^>]*>[\s\S]*?<\/(?:script|style|noscript|svg|iframe|template)\s*>/gi, ' ')
    .replace(/<(?:nav|footer|aside|form)\b[^>]*>[\s\S]*?<\/(?:nav|footer|aside|form)\s*>/gi, ' ')
    .replace(/<button\b[^>]*>[\s\S]*?<\/button\s*>/gi, ' ');
  const regions = [...cleaned.matchAll(/<(main|article)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)];
  const region = regions.sort((a, b) => b[2].length - a[2].length)[0]?.[2]
    || /<body\b[^>]*>([\s\S]*?)<\/body\s*>/i.exec(cleaned)?.[1]
    || cleaned;
  const title = plainText(/<h1\b[^>]*>([\s\S]*?)<\/h1\s*>/i.exec(region)?.[1]
    || titleHtml).split('\n')[0]?.trim();
  const text = plainText(region);
  if (!title || text.length < PUBLIC_WEB_LIMITS.min_text_characters ||
      Buffer.byteLength(text, 'utf8') > PUBLIC_WEB_LIMITS.max_text_bytes) {
    throw webError('SOURCE_INCOMPLETE', 'Public web document has no verifiable title and sufficiently complete body.');
  }
  return { title, text };
}
