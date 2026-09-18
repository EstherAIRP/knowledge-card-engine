import http from 'node:http';
import process from 'node:process';
import { createPrivateSiteApp } from './index.js';

const app = createPrivateSiteApp();
const port = Number(process.env.PORT || 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535.');
}

async function bodyFor(request) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined;
  const chunks = [];
  let total = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buffer.length;
    if (total > 64 * 1024) throw new Error('Request body too large.');
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (incoming, outgoing) => {
  try {
    const host = incoming.headers.host || 'localhost';
    const url = new URL(incoming.url || '/', `http://${host}`);
    const headers = new Headers();
    for (const [name, value] of Object.entries(incoming.headers)) {
      if (Array.isArray(value)) {
        for (const item of value) headers.append(name, item);
      } else if (value != null) {
        headers.set(name, String(value));
      }
    }

    const body = await bodyFor(incoming);
    const request = new Request(url, {
      method: incoming.method || 'GET',
      headers,
      body,
      ...(body ? { duplex: 'half' } : {})
    });
    const response = await app(request);

    outgoing.statusCode = response.status;
    const setCookies = typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [];
    for (const [name, value] of response.headers) {
      if (name.toLowerCase() === 'set-cookie') continue;
      outgoing.setHeader(name, value);
    }
    if (setCookies.length) outgoing.setHeader('Set-Cookie', setCookies);
    outgoing.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    outgoing.statusCode = 500;
    outgoing.setHeader('Content-Type', 'application/json; charset=utf-8');
    outgoing.setHeader('Cache-Control', 'no-store');
    outgoing.end(JSON.stringify({ code: 'INTERNAL_ERROR', detail: 'Unexpected server error.' }));
  }
});

server.listen(port, () => {
  console.log(`Knowledge Card private site listening on port ${port}.`);
});
