const OWNER_REPO_PART = /^[A-Za-z0-9_.-]+$/u;

export class SiteConfigError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'SiteConfigError';
    this.code = code;
  }
}

function required(env, name) {
  const value = typeof env?.[name] === 'string' ? env[name].trim() : '';
  if (!value) throw new SiteConfigError('SITE_CONFIG_MISSING', `${name} is required.`);
  return value;
}

function githubPart(value, name) {
  if (!OWNER_REPO_PART.test(value)) {
    throw new SiteConfigError('SITE_CONFIG_INVALID', `${name} is not a valid GitHub owner/repository segment.`);
  }
  return value;
}

function normalizePrivateKey(value) {
  return value.includes('\\n') ? value.replaceAll('\\n', '\n') : value;
}

export function loadSiteConfig(env = process.env) {
  const publicUrlRaw = required(env, 'KC_PUBLIC_URL');
  let publicUrl;
  try {
    publicUrl = new URL(publicUrlRaw);
  } catch {
    throw new SiteConfigError('SITE_CONFIG_INVALID', 'KC_PUBLIC_URL must be an absolute URL.');
  }
  if (publicUrl.protocol !== 'https:' || publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash) {
    throw new SiteConfigError('SITE_CONFIG_INVALID', 'KC_PUBLIC_URL must be an HTTPS origin/base URL without credentials, query, or fragment.');
  }
  publicUrl.pathname = publicUrl.pathname.replace(/\/+$/, '') || '/';

  const sessionSecret = required(env, 'KC_SESSION_SECRET');
  if (Buffer.byteLength(sessionSecret, 'utf8') < 32) {
    throw new SiteConfigError('SITE_CONFIG_INVALID', 'KC_SESSION_SECRET must contain at least 32 UTF-8 bytes.');
  }

  const appId = required(env, 'KC_GITHUB_APP_ID');
  if (!/^[A-Za-z0-9_-]+$/u.test(appId)) {
    throw new SiteConfigError('SITE_CONFIG_INVALID', 'KC_GITHUB_APP_ID has an invalid format.');
  }

  const installationId = required(env, 'KC_GITHUB_INSTALLATION_ID');
  if (!/^\d+$/u.test(installationId)) {
    throw new SiteConfigError('SITE_CONFIG_INVALID', 'KC_GITHUB_INSTALLATION_ID must be a numeric installation id.');
  }

  const workspaceOwner = githubPart(required(env, 'KC_WORKSPACE_OWNER'), 'KC_WORKSPACE_OWNER');
  const workspaceRepo = githubPart(required(env, 'KC_WORKSPACE_REPO'), 'KC_WORKSPACE_REPO');
  const workspaceRef = (typeof env?.KC_WORKSPACE_REF === 'string' ? env.KC_WORKSPACE_REF.trim() : '') || 'main';
  if (workspaceRef.length > 200 || /[\0\r\n]/u.test(workspaceRef)) {
    throw new SiteConfigError('SITE_CONFIG_INVALID', 'KC_WORKSPACE_REF has an invalid format.');
  }

  return Object.freeze({
    publicUrl: publicUrl.toString().replace(/\/$/u, ''),
    sessionSecret,
    githubAppId: appId,
    githubClientId: required(env, 'KC_GITHUB_CLIENT_ID'),
    githubClientSecret: required(env, 'KC_GITHUB_CLIENT_SECRET'),
    githubPrivateKey: normalizePrivateKey(required(env, 'KC_GITHUB_PRIVATE_KEY')),
    githubInstallationId: installationId,
    workspaceOwner,
    workspaceRepo,
    workspaceRef,
    workspaceFullName: `${workspaceOwner}/${workspaceRepo}`
  });
}

export function tryLoadSiteConfig(env = process.env) {
  try {
    return { configured: true, config: loadSiteConfig(env), error: null };
  } catch (error) {
    return {
      configured: false,
      config: null,
      error: error instanceof SiteConfigError ? error : new SiteConfigError('SITE_CONFIG_INVALID', 'Site configuration is invalid.')
    };
  }
}
