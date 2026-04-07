const BUILTIN_AI_HOSTS = new Set([
  'api.openai.com',
  'api.deepseek.com',
  'dashscope.aliyuncs.com',
  'ark.cn-beijing.volces.com',
  'aip.baidubce.com',
  'open.bigmodel.cn',
]);

function isPrivateIpv4(hostname: string): boolean {
  const match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return false;
  }

  const [a, b] = [Number(match[1]), Number(match[2])];
  if (a === 10 || a === 127 || a === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function isUnsafeHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  if (
    normalized === 'localhost' ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return true;
  }

  return isPrivateIpv4(normalized);
}

type ValidationMode = 'configure' | 'runtime';

export function validateAIBaseUrl(
  input: string | undefined,
  actor: { role: string },
  isCustom: boolean,
  mode: ValidationMode = 'configure'
): string | undefined {
  const trimmed = input?.trim();
  if (!trimmed) {
    return undefined;
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('AI API 地址格式无效');
  }

  const hostname = parsed.hostname.toLowerCase();
  const isBuiltinHost = BUILTIN_AI_HOSTS.has(hostname);

  if (mode === 'configure' && isCustom && actor.role !== 'admin') {
    throw new Error('自定义 AI 地址仅管理员可配置');
  }

  if (!isBuiltinHost) {
    if (parsed.protocol !== 'https:') {
      throw new Error('自定义 AI 地址仅允许使用 HTTPS');
    }
    if (isUnsafeHostname(hostname)) {
      throw new Error('不允许使用本地、内网或保留地址作为 AI API 地址');
    }
  }

  return parsed.toString().replace(/\/$/, '');
}
