export function formatStructuredDraftText(value: string) {
  const text = String(value || '').trim();
  if (!text) return '';

  const normalized = `\n${text}`
    .replace(/([；;])\s*/g, '$1\n')
    .replace(/([。！？])\s*(?=(?:第[一二三四五六七八九十]|\d+[.)、]|[①②③④⑤⑥⑦⑧⑨⑩]|首先|其次|然后|最后))/g, '$1\n')
    .replace(/([：:])\s*(?=[*-]\s+\S)/g, '$1\n')
    .replace(/([。！？；;])\s*(?=[*-]\s+\S)/g, '$1\n')
    .replace(/(\n[*-][^\n]+?)\s+([*-]\s+\S)/g, '$1\n$2')
    .replace(/\s*(?=(?:第[一二三四五六七八九十]|\d+[.)、]|[①②③④⑤⑥⑦⑧⑨⑩]|首先|其次|然后|最后))/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();

  return normalized;
}
