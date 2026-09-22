import { classifyThreadsUrl, normalizeThreadsPostUrl } from './resolve-url.js';

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

function asString(value) {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
}

function asId(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'bigint') {
    return asString(value);
  }
  if (typeof value !== 'object') return null;
  return asString(firstDefined(value.id, value.pk, value.post_id, value.media_id, value.code, value.shortcode));
}

function asBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (value === 0 || value === '0') return false;
  if (value === 1 || value === '1') return true;
  return null;
}

function normalizeTimestamp(value) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const milliseconds = value > 1e12 ? value : value * 1000;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const numeric = Number(value);
  if (typeof value === 'string' && value.trim() && Number.isFinite(numeric)) {
    return normalizeTimestamp(numeric);
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function parseShortcodeFromUrl(value) {
  if (!value) return null;
  try {
    const classified = classifyThreadsUrl(String(value));
    return classified.kind === 'post' ? classified.shortcode : null;
  } catch {
    return null;
  }
}

function normalizePermalink(raw, username, shortcode, fallbackUrl) {
  const candidates = [raw?.permalink, raw?.url, raw?.canonical_url, fallbackUrl];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      if (classifyThreadsUrl(String(candidate)).kind === 'post') {
        return normalizeThreadsPostUrl(String(candidate));
      }
    } catch {
      // Continue to the next candidate.
    }
  }

  if (username && shortcode) {
    return `https://threads.com/@${username.replace(/^@/, '')}/post/${shortcode}`;
  }
  return null;
}

function normalizeText(raw) {
  const candidates = [
    raw?.text,
    raw?.caption?.text,
    typeof raw?.caption === 'string' ? raw.caption : null,
    raw?.body,
    raw?.content?.text,
    raw?.post_text,
    raw?.message
  ];
  for (const value of candidates) {
    const text = asString(value);
    if (text !== null) return text;
  }
  return null;
}

function inferMediaType(raw) {
  const declared = asString(firstDefined(raw?.type, raw?.media_type, raw?.product_type))?.toLowerCase();
  if (declared?.includes('video') || raw?.video_url || Array.isArray(raw?.video_versions)) return 'video';
  if (declared?.includes('image') || declared?.includes('photo') || raw?.image_url || raw?.image_versions2) return 'image';
  return 'unknown';
}

function pushMedia(result, seen, item) {
  if (!item?.url) return;
  const url = asString(item.url);
  if (!url || seen.has(url)) return;
  seen.add(url);
  result.push({
    type: item.type || 'unknown',
    url,
    thumbnail_url: asString(item.thumbnail_url),
    width: Number.isFinite(Number(item.width)) ? Number(item.width) : null,
    height: Number.isFinite(Number(item.height)) ? Number(item.height) : null,
    id: asId(item.id)
  });
}

function collectMedia(raw) {
  const result = [];
  const seen = new Set();
  if (!raw || typeof raw !== 'object') return result;

  const carousel = firstDefined(raw.carousel_media, raw.children?.data, Array.isArray(raw.children) ? raw.children : null);
  if (Array.isArray(carousel) && carousel.length) {
    for (const child of carousel) {
      for (const media of collectMedia(child)) pushMedia(result, seen, media);
    }
    return result;
  }

  const imageCandidate = raw.image_versions2?.candidates?.[0];
  const videoCandidate = raw.video_versions?.[0];
  const directUrl = firstDefined(raw.media_url, raw.video_url, raw.image_url);
  if (directUrl) {
    pushMedia(result, seen, {
      type: inferMediaType(raw),
      url: directUrl,
      thumbnail_url: firstDefined(raw.thumbnail_url, raw.display_url, imageCandidate?.url),
      width: firstDefined(raw.width, raw.original_width, videoCandidate?.width, imageCandidate?.width),
      height: firstDefined(raw.height, raw.original_height, videoCandidate?.height, imageCandidate?.height),
      id: raw
    });
  }

  if (videoCandidate?.url) {
    pushMedia(result, seen, {
      type: 'video',
      url: videoCandidate.url,
      thumbnail_url: firstDefined(raw.thumbnail_url, imageCandidate?.url),
      width: videoCandidate.width,
      height: videoCandidate.height,
      id: raw
    });
  } else if (imageCandidate?.url) {
    pushMedia(result, seen, {
      type: 'image',
      url: imageCandidate.url,
      thumbnail_url: firstDefined(raw.thumbnail_url, raw.display_url),
      width: imageCandidate.width,
      height: imageCandidate.height,
      id: raw
    });
  }

  return result;
}

function normalizeReferencePost(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const username = asString(firstDefined(raw.username, raw.user?.username, raw.owner?.username, raw.author?.username));
  const shortcode = asString(firstDefined(raw.shortcode, raw.code, parseShortcodeFromUrl(firstDefined(raw.permalink, raw.url))));
  const permalink = normalizePermalink(raw, username, shortcode, null);
  const id = asId(raw);
  const text = normalizeText(raw);
  if (!id && !shortcode && !permalink && !text) return null;
  return { id, shortcode, username, text, permalink };
}

export function normalizeThreadsPost(raw, options = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Threads post payload must be an object.');
  }

  const info = firstDefined(raw.text_post_app_info, raw.reply_info, raw.thread_info, {}) || {};
  const username = asString(firstDefined(raw.username, raw.user?.username, raw.owner?.username, raw.author?.username));
  const shortcode = asString(firstDefined(
    raw.shortcode,
    raw.code,
    parseShortcodeFromUrl(firstDefined(raw.permalink, raw.url, raw.canonical_url)),
    options.expectedShortcode
  ));
  const canonicalUrl = normalizePermalink(raw, username, shortcode, options.canonicalUrl || null);
  const replyTo = asId(firstDefined(
    raw.replied_to,
    raw.replied_to_post,
    raw.reply_to,
    raw.reply_to_post,
    raw.replied_to_id,
    info.replied_to,
    info.replied_to_post,
    info.reply_to_post,
    info.replied_to_id
  ));
  const rootPost = asId(firstDefined(
    raw.root_post,
    raw.root_post_id,
    info.root_post,
    info.root_post_id
  ));
  const directReplyCount = Number(firstDefined(
    raw.direct_reply_count,
    raw.reply_count,
    info.direct_reply_count,
    info.reply_count
  ));
  const explicitHasReplies = asBoolean(firstDefined(raw.has_replies, info.has_replies));
  const hasReplies = explicitHasReplies !== null
    ? explicitHasReplies
    : (Number.isFinite(directReplyCount) ? directReplyCount > 0 : null);
  const explicitIsReply = asBoolean(firstDefined(raw.is_reply, info.is_reply));
  const isReply = explicitIsReply !== null ? explicitIsReply : (replyTo ? true : null);

  const id = asId(firstDefined(raw.id, raw.pk, raw.post_id, raw.media_id)) || shortcode;
  if (!shortcode && !id) {
    throw new Error('Threads post payload does not contain a stable post id or shortcode.');
  }

  const post = {
    provider: 'threads',
    canonical_url: canonicalUrl,
    id,
    shortcode,
    username,
    text: normalizeText(raw),
    timestamp: normalizeTimestamp(firstDefined(raw.timestamp, raw.taken_at, raw.created_at, raw.published_at)),
    media: collectMedia(raw),
    is_reply: isReply,
    reply_to: replyTo,
    root_post: rootPost,
    has_replies: hasReplies,
    quoted_post: normalizeReferencePost(firstDefined(raw.quoted_post, info.quoted_post)),
    reposted_post: normalizeReferencePost(firstDefined(raw.reposted_post, raw.repost, info.reposted_post)),
    link_attachment_url: asString(firstDefined(raw.link_attachment_url, info.link_attachment_url)),
    alt_text: asString(firstDefined(raw.alt_text, raw.accessibility_caption)),
    extraction: {
      method: options.method || 'unknown',
      confidence: options.confidence || 'high',
      single_post_complete: true,
      conversation_complete: false
    }
  };

  if (options.expectedShortcode && post.shortcode && post.shortcode !== options.expectedShortcode) {
    const error = new Error(`Extracted Threads post shortcode ${post.shortcode} does not match expected ${options.expectedShortcode}.`);
    error.code = 'THREADS_POST_MISMATCH';
    throw error;
  }

  return post;
}
