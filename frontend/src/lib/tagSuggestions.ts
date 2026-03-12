import { MAX_QUESTION_TAGS, parseQuestionTags } from './questionTags';

export interface TagSuggestionItem {
  name: string;
  count?: number;
}

export function getTagKeyword(value: string): string {
  const segments = value.split(',');
  return (segments[segments.length - 1] || '').trim().toLowerCase();
}

export function getFilteredTagSuggestions(
  value: string,
  availableTags: TagSuggestionItem[],
  limit = 8
): TagSuggestionItem[] {
  const keyword = getTagKeyword(value);
  if (!keyword) {
    return [];
  }

  const existingTags = new Set(parseQuestionTags(value).map((tag) => tag.toLowerCase()));
  return availableTags
    .filter((tag) => !existingTags.has(tag.name.toLowerCase()))
    .filter((tag) => tag.name.toLowerCase().includes(keyword))
    .slice(0, limit);
}

export function applyTagSuggestion(value: string, tag: string): string {
  const segments = value.split(',');
  const prefix = segments
    .slice(0, -1)
    .map((segment) => segment.trim())
    .filter(Boolean);

  return [...prefix, tag].slice(0, MAX_QUESTION_TAGS).join(', ');
}

export function getSingleValueSuggestions(
  value: string,
  availableTags: TagSuggestionItem[],
  limit = 8
): TagSuggestionItem[] {
  const keyword = value.trim().toLowerCase();
  if (!keyword) {
    return [];
  }

  return availableTags
    .filter((tag) => tag.name.toLowerCase().includes(keyword))
    .slice(0, limit);
}
