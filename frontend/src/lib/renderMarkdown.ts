function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function splitMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim());
}

function isMarkdownTableSeparator(line: string): boolean {
  const cells = splitMarkdownTableRow(line);
  return cells.length > 0 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

export function normalizeAIResponse(text: string): string {
  if (!text) {
    return '';
  }

  let normalized = text.trim();

  normalized = normalized.replace(
    /^(好的[，,。！!\s]*|当然可以[，,。！!\s]*|可以[，,。！!\s]*|没问题[，,。！!\s]*|下面是[：:，,\s]*|以下是[：:，,\s]*)(关于|针对|基于|围绕)?/i,
    (_match, _prefix, contextPrefix = '') => contextPrefix || ''
  );

  normalized = normalized.replace(
    /^(以下是关于.*?(结构化回答|详细说明|回答|分析).*?(?:。|：|:)\s*)/i,
    ''
  );

  normalized = normalized.replace(
    /^(好的[，,。！!\s]*当然可以[，,。！!\s]*|好的[，,。！!\s]*|当然可以[，,。！!\s]*)/i,
    ''
  );

  normalized = normalized.replace(/^[-*]{3,}\s*/m, '');

  return normalized.trim();
}

export function renderSafeMarkdown(text: string, variant: 'compact' | 'rich' = 'rich'): string {
  if (!text) {
    return '';
  }

  const codeBlocks: string[] = [];
  let html = escapeHtml(text).replace(/```(\w*)\n([\s\S]*?)```/g, (_match, _lang, code) => {
    const blockClass = variant === 'compact'
      ? 'bg-slate-800 text-slate-100 p-3 rounded-lg overflow-x-auto my-2 text-sm'
      : 'bg-slate-800 text-slate-100 p-4 rounded-xl overflow-x-auto my-3 text-sm border border-slate-700';
    const block = `<pre class="${blockClass}"><code>${String(code).trim()}</code></pre>`;
    codeBlocks.push(block);
    return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
  });

  html = html.replace(
    /`([^`]+)`/g,
    '<code class="bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded text-sm font-medium">$1</code>'
  );

  const headingClasses =
    variant === 'compact'
      ? {
          h1: 'text-lg font-bold text-gray-900 mt-3 mb-2',
          h2: 'text-base font-semibold text-gray-900 mt-3 mb-2',
          h3: 'text-sm font-semibold text-gray-900 mt-3 mb-1.5',
          h4: 'text-sm font-semibold text-gray-900 mt-2.5 mb-1.5',
        }
      : {
          h1: 'text-xl font-bold text-gray-900 mt-4 mb-3',
          h2: 'text-lg font-semibold text-gray-900 mt-4 mb-2',
          h3: 'text-base font-semibold text-gray-900 mt-4 mb-2',
          h4: 'text-sm font-semibold text-gray-900 mt-4 mb-2',
        };

  html = html
    .replace(/^\s*####\s+(.*)$/gim, `<h4 class="${headingClasses.h4}">$1</h4>`)
    .replace(/^\s*###\s+(.*)$/gim, `<h3 class="${headingClasses.h3}">$1</h3>`)
    .replace(/^\s*##\s+(.*)$/gim, `<h2 class="${headingClasses.h2}">$1</h2>`)
    .replace(/^\s*#\s+(.*)$/gim, `<h1 class="${headingClasses.h1}">$1</h1>`);

  html = html
    .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/\*(\S(?:.*?\S)?)\*/g, '<em class="italic">$1</em>');

  const lines = html.split('\n');
  const result: string[] = [];
  let listItems: string[] = [];
  let inList = false;
  let tableRows: string[][] = [];
  let tableHeader: string[] | null = null;

  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    if (variant === 'compact') {
      result.push('<div class="my-2">');
    } else {
      result.push('<div class="my-2">');
    }
    result.push(...listItems);
    result.push('</div>');
    listItems = [];
  };

  const flushTable = () => {
    if (!tableHeader || tableRows.length === 0) {
      tableHeader = null;
      tableRows = [];
      return;
    }

    const wrapperClass = variant === 'compact' ? 'my-3 overflow-x-auto' : 'my-4 overflow-x-auto';
    const tableClass = variant === 'compact'
      ? 'min-w-full border-collapse rounded-lg overflow-hidden text-sm'
      : 'min-w-full border-collapse rounded-xl overflow-hidden text-sm';
    const thClass = variant === 'compact'
      ? 'border border-gray-200 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-900'
      : 'border border-gray-200 bg-gray-100 px-4 py-2.5 text-left font-semibold text-gray-900';
    const tdClass = variant === 'compact'
      ? 'border border-gray-200 bg-white px-3 py-2 text-gray-700 align-top'
      : 'border border-gray-200 bg-white px-4 py-2.5 text-gray-700 align-top';

    const thead = `<thead><tr>${tableHeader.map((cell) => `<th class="${thClass}">${cell}</th>`).join('')}</tr></thead>`;
    const tbody = `<tbody>${tableRows.map((row) => `<tr>${row.map((cell) => `<td class="${tdClass}">${cell}</td>`).join('')}</tr>`).join('')}</tbody>`;
    result.push(`<div class="${wrapperClass}"><table class="${tableClass}">${thead}${tbody}</table></div>`);

    tableHeader = null;
    tableRows = [];
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const trimmedLine = line.trim();

    if (trimmedLine.includes('|')) {
      const nextLine = lines[index + 1]?.trim() || '';
      if (!tableHeader && nextLine && isMarkdownTableSeparator(nextLine)) {
        if (inList) {
          flushList();
          inList = false;
        }
        tableHeader = splitMarkdownTableRow(trimmedLine);
        index += 1;
        continue;
      }

      if (tableHeader && trimmedLine.includes('|')) {
        tableRows.push(splitMarkdownTableRow(trimmedLine));
        continue;
      }
    } else if (tableHeader) {
      flushTable();
    }

    if (/^\* (.*)/.test(trimmedLine) || /^- (.*)/.test(trimmedLine)) {
      const content = trimmedLine.replace(/^[*-] /, '');
      listItems.push(
        `<div class="flex gap-2 my-1"><span class="text-gray-400">•</span><span class="text-gray-700">${content}</span></div>`
      );
      inList = true;
      continue;
    }

    if (/^\d+\. (.*)/.test(trimmedLine)) {
      const match = trimmedLine.match(/^(\d+)\. (.*)$/);
      if (match) {
        listItems.push(
          `<div class="flex gap-2 my-1"><span class="text-gray-400 min-w-[20px]">${match[1]}.</span><span class="text-gray-700">${match[2]}</span></div>`
        );
      }
      inList = true;
      continue;
    }

    if (trimmedLine === '') {
      if (inList) {
        flushList();
        inList = false;
      }
      if (tableHeader) {
        flushTable();
      }
      continue;
    }

    if (inList) {
      flushList();
      inList = false;
    }

    if (/^(-{3,}|\*{3,})$/.test(trimmedLine)) {
      result.push('<hr class="my-3 border-0 border-t border-gray-200" />');
      continue;
    }

    result.push(trimmedLine);
  }

  flushList();
  flushTable();

  html = result.join('\n');
  html = html.replace(/\n\n+/g, '</p><p class="my-2">').replace(/\n/g, ' ');

  codeBlocks.forEach((block, index) => {
    html = html.replace(`__CODE_BLOCK_${index}__`, block);
  });

  if (!html.startsWith('<h') && !html.startsWith('<p') && !html.startsWith('<pre') && !html.startsWith('<div')) {
    html = `<p class="my-1">${html}</p>`;
  }

  return html;
}

export function renderMultilineText(text: string): string {
  if (!text) {
    return '';
  }

  return escapeHtml(text).replace(/\n/g, '<br/>');
}
