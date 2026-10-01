import { RELATION_TYPE_LIST } from './relation-types.js';

function endpoint(baseUrl, path) {
  return String(baseUrl).replace(/\/+$/u, '') + '/' + String(path).replace(/^\/+/, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson(url, { apiKey, body, timeoutMs = 45000, retries = 2 } = {}) {
  let lastError = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: 'Bearer ' + apiKey } : {})
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs)
      });
      const text = await response.text();
      let payload = null;
      try {
        payload = text ? JSON.parse(text) : {};
      } catch {
        payload = { raw: text };
      }
      if (!response.ok) {
        const message = payload?.error?.message ?? payload?.message ?? text ?? ('HTTP ' + response.status);
        const error = new Error('Model API ' + response.status + ': ' + message);
        error.status = response.status;
        throw error;
      }
      return payload;
    } catch (error) {
      lastError = error;
      const retryable = error?.name === 'TimeoutError'
        || error?.name === 'AbortError'
        || !Number.isFinite(error?.status)
        || error.status === 408
        || error.status === 409
        || error.status === 429
        || error.status >= 500;
      if (!retryable || attempt >= retries) break;
      await sleep(Math.min(1000 * (2 ** attempt), 5000));
    }
  }
  throw lastError ?? new Error('Model API request failed.');
}

export async function createLocalTransformerEmbeddings(texts, {
  model = 'Xenova/multilingual-e5-small'
} = {}) {
  const { pipeline, env } = await import('@huggingface/transformers');
  if (process.env.TRANSFORMERS_CACHE_DIR) env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR;
  const extractor = await pipeline('feature-extraction', model, { dtype: 'q8' });
  const inputs = texts.map((text) => 'query: ' + text);
  const tensor = await extractor(inputs, {
    pooling: 'mean',
    normalize: true,
    truncation: true
  });
  const vectors = tensor.tolist();
  if (!Array.isArray(vectors) || vectors.length !== texts.length) {
    throw new Error('Local embedding model returned ' + (vectors?.length ?? 0) + ' vectors for ' + texts.length + ' inputs.');
  }
  return vectors;
}

function classifierPrompt({ left, right, candidate }) {
  return [
    '判斷兩張私人 Knowledge Card 之間是否存在有用且具體的知識關係。',
    '只根據提供的 Card 內容，不要假設未提供的功能。',
    '允許的 relation type: ' + RELATION_TYPE_LIST.join(', '),
    '',
    '關係定義：',
    '- similar_to: 解決相似問題或架構高度相似。',
    '- alternative_to: 在相同用途下可互相替代。',
    '- complements: 位於不同層次或能力面，但組合後互補。',
    '- integrates_with: 有明確可整合、橋接或互通關係。',
    '- depends_on: 其中一張 Card 的核心能力依賴另一張；只有證據足夠時使用。',
    '- extends: 其中一張 Card 明確建立在另一張之上並擴充其能力；只有證據足夠時使用。',
    '- contrasts_with: 同領域但設計取向、抽象層或方法形成有意義對照。',
    '',
    'direction 規則：',
    '- similar_to / alternative_to / complements / integrates_with / contrasts_with 必須使用 undirected。',
    '- depends_on / extends 必須使用 source_to_target 或 target_to_source。',
    '',
    'Candidate taxonomy score: ' + candidate.taxonomy_score,
    'Candidate semantic score: ' + (candidate.semantic_score ?? 'unavailable'),
    'Candidate combined score: ' + candidate.combined_score,
    '',
    'CARD A / source (' + candidate.source + ')',
    left,
    '',
    'CARD B / target (' + candidate.target + ')',
    right,
    '',
    '若只有非常泛化的共同標籤而沒有實質關係，related 應為 false。confidence 必須介於 0 到 1。reason 使用繁體中文，簡潔說明關係與方向。'
  ].join('\n');
}

export async function classifyRelationWithOpenAICompatible({
  left,
  right,
  candidate,
  baseUrl,
  model,
  apiKey,
  timeoutMs = 45000,
  retries = 2
}) {
  const schema = {
    type: 'object',
    additionalProperties: false,
    required: ['related', 'type', 'direction', 'confidence', 'reason'],
    properties: {
      related: { type: 'boolean' },
      type: { type: 'string', enum: RELATION_TYPE_LIST },
      direction: { type: 'string', enum: ['undirected', 'source_to_target', 'target_to_source'] },
      confidence: { type: 'number' },
      reason: { type: 'string' }
    }
  };

  const payload = await postJson(endpoint(baseUrl, '/chat/completions'), {
    apiKey,
    timeoutMs,
    retries,
    body: {
      model,
      messages: [
        {
          role: 'system',
          content: 'You are a precise knowledge-graph relation classifier. Return only the requested structured output.'
        },
        {
          role: 'user',
          content: classifierPrompt({ left, right, candidate })
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'knowledge_relation',
          strict: true,
          schema
        }
      }
    }
  });

  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.trim().length === 0) {
    throw new Error('Relation classifier returned no message content.');
  }
  return { ...JSON.parse(content), classifier: 'llm' };
}
