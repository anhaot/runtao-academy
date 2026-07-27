export const MAX_QUESTION_TAGS = 5;

export function parseQuestionTags(rawTags: string | string[] | null | undefined): string[] {
  if (Array.isArray(rawTags)) {
    return rawTags.map((tag) => String(tag).trim()).filter(Boolean).slice(0, MAX_QUESTION_TAGS);
  }

  if (typeof rawTags !== 'string' || !rawTags.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(rawTags);
    return Array.isArray(parsed)
      ? parsed.map((tag) => String(tag).trim()).filter(Boolean).slice(0, MAX_QUESTION_TAGS)
      : [];
  } catch {
    return rawTags
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, MAX_QUESTION_TAGS);
  }
}
