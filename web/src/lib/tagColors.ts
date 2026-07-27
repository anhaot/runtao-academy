const TAG_COLOR_PALETTE = [
  'border-sky-200 bg-sky-50 text-sky-700',
  'border-emerald-200 bg-emerald-50 text-emerald-700',
  'border-amber-200 bg-amber-50 text-amber-700',
  'border-rose-200 bg-rose-50 text-rose-700',
  'border-violet-200 bg-violet-50 text-violet-700',
  'border-cyan-200 bg-cyan-50 text-cyan-700',
  'border-lime-200 bg-lime-50 text-lime-700',
  'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
];

function hashTag(tag: string): number {
  let hash = 0;
  for (const char of tag) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash;
}

export function getTagColorClasses(tag: string): string {
  return TAG_COLOR_PALETTE[hashTag(tag) % TAG_COLOR_PALETTE.length];
}
