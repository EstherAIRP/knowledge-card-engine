const RULES = Object.freeze([
  {
    code: 'DOC_PRODUCT_GENERATION',
    pattern: /\b(?:Knowledge Card|Workspace|Card|Taxonomy|Engine)\s+[vV]\d+\b/g,
    message: 'Formal documentation must not use product/contract generation labels such as "Card v1" or "Knowledge Card V2".'
  },
  {
    code: 'DOC_GENERATION_HISTORY',
    pattern: /\b[vV][12]\b.{0,48}(?:相容|保留|改為|欄位|功能|系統|契約|engine|workspace|card|taxonomy)|(?:相容|保留|改為|欄位|功能|系統|契約|engine|workspace|card|taxonomy).{0,48}\b[vV][12]\b/gi,
    message: 'Formal documentation must define the current contract directly instead of depending on generation history.'
  },
  {
    code: 'DOC_TASK_HISTORY',
    pattern: /\bT\d{2}[A-Z]?\b/g,
    message: 'Formal documentation must not depend on development task identifiers.'
  },
  {
    code: 'DOC_PHASE_HISTORY',
    pattern: /\bPhase(?:\s+\d+(?:\.\d+)*)?\b/gi,
    message: 'Formal documentation must not contain development phase history.'
  },
  {
    code: 'DOC_LEGACY_HISTORY',
    pattern: /\blegacy\b|舊版|新版/g,
    message: 'Formal documentation must describe the current system without legacy/old/new generation framing.'
  },
  {
    code: 'DOC_EXTERNAL_DEVELOPMENT_DEPENDENCY',
    pattern: /knowledge-card-development|EstherAIRP\/Knowledge-Card/g,
    message: 'Formal documentation must not require development-history repositories to understand the current runtime.'
  }
]);

export function findCurrentOnlyDocumentationIssues(relativePath, text) {
  const issues = [];
  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match;
    while ((match = rule.pattern.exec(text)) !== null) {
      const line = text.slice(0, match.index).split('\n').length;
      issues.push({
        code: rule.code,
        path: relativePath,
        line,
        match: match[0],
        message: rule.message
      });
      if (match[0].length === 0) rule.pattern.lastIndex += 1;
    }
  }
  return issues;
}
