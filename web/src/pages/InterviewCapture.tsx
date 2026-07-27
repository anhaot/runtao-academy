import React, { useEffect, useMemo, useState } from 'react';
import { aiApi, categoryApi, questionApi } from '@/api';
import { useAuthStore } from '@/store';
import { Category, InterviewDraft } from '@/types';
import {
  getInterviewDrafts,
  removeInterviewDrafts,
  saveInterviewDraft,
} from '@/lib/offlineStorage';
import { parseQuestionTags } from '@/lib/questionTags';
import { toast } from 'react-hot-toast';
import { BrainCircuit, Check, CloudOff, Plus, Sparkles, Trash2, Upload } from 'lucide-react';

function newDraft(content: string): InterviewDraft {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    content,
    answer: '',
    explanation: '',
    difficulty: 'medium',
    tags: [],
    createdAt: now,
    updatedAt: now,
  };
}

function parseBulkQuestions(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) return [];
  const parts = /\n\s*\n/.test(trimmed) ? trimmed.split(/\n\s*\n/) : trimmed.split('\n');
  return Array.from(new Set(parts.map((part) => part.trim()).filter(Boolean)));
}

export const InterviewCapturePage: React.FC = () => {
  const { user } = useAuthStore();
  const [bulkText, setBulkText] = useState('');
  const [drafts, setDrafts] = useState<InterviewDraft[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState('');
  const [generating, setGenerating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    if (!user) return;
    getInterviewDrafts(user.id)
      .then((items) => {
        setDrafts(items);
        setSelected(new Set(items.map((item) => item.id)));
      })
      .catch((error) => toast.error((error as Error).message));
    categoryApi.getAll().then((response) => setCategories(response.data)).catch(() => undefined);
  }, [user]);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const selectedDrafts = useMemo(() => drafts.filter((draft) => selected.has(draft.id)), [drafts, selected]);
  const readyCount = selectedDrafts.filter((draft) => draft.answer.trim()).length;
  const allSelected = drafts.length > 0 && selectedDrafts.length === drafts.length;

  const addQuestions = async () => {
    if (!user) return;
    const questions = parseBulkQuestions(bulkText);
    if (questions.length === 0) {
      toast.error('请至少填写一道题');
      return;
    }
    const items = questions.map(newDraft);
    await Promise.all(items.map((item) => saveInterviewDraft(user.id, item)));
    setDrafts((current) => [...items, ...current]);
    setSelected((current) => new Set([...current, ...items.map((item) => item.id)]));
    setBulkText('');
    toast.success(`已保存 ${items.length} 道草稿，尚未写入正式题库`);
  };

  const updateDraft = (id: string, patch: Partial<InterviewDraft>) => {
    setDrafts((current) => current.map((draft) => (
      draft.id === id ? { ...draft, ...patch, updatedAt: new Date().toISOString() } : draft
    )));
  };

  const persistDraft = async (id: string) => {
    if (!user) return;
    const draft = drafts.find((item) => item.id === id);
    if (draft) await saveInterviewDraft(user.id, draft);
  };

  const deleteDraft = async (id: string) => {
    if (!confirm('确定要删除这道草稿吗？删除后无法恢复，但不会影响已经入库的题目。')) return;
    await removeInterviewDrafts([id]);
    setDrafts((current) => current.filter((draft) => draft.id !== id));
    setSelected((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    toast.success('草稿已删除');
  };

  const toggleAllDrafts = () => {
    setSelected(allSelected ? new Set() : new Set(drafts.map((draft) => draft.id)));
  };

  const deleteSelectedDrafts = async () => {
    const ids = selectedDrafts.map((draft) => draft.id);
    if (ids.length === 0) {
      toast.error('请先选择要删除的草稿');
      return;
    }
    if (!confirm(`确定要删除选中的 ${ids.length} 道草稿吗？删除后无法恢复，但不会影响已经入库的题目。`)) return;

    setDeleting(true);
    try {
      await removeInterviewDrafts(ids);
      const idSet = new Set(ids);
      setDrafts((current) => current.filter((draft) => !idSet.has(draft.id)));
      setSelected((current) => {
        const next = new Set(current);
        ids.forEach((id) => next.delete(id));
        return next;
      });
      toast.success(`已删除 ${ids.length} 道草稿`);
    } catch (error) {
      toast.error((error as Error).message || '批量删除草稿失败');
    } finally {
      setDeleting(false);
    }
  };

  const generateAnswers = async () => {
    if (!user || selectedDrafts.length === 0) {
      toast.error('请先选择草稿');
      return;
    }
    if (!online) {
      toast.error('当前离线，题目已安全保存在本机，联网后再生成答案');
      return;
    }
    setGenerating(true);
    try {
      let nextDrafts = [...drafts];
      for (let offset = 0; offset < selectedDrafts.length; offset += 20) {
        const batch = selectedDrafts.slice(offset, offset + 20);
        const response = await aiApi.answerDraftsRaw({
          questions: batch.map((draft) => ({
            clientId: draft.id,
            content: draft.content,
            difficulty: draft.difficulty,
          })),
          mode: 'practice',
        });
        const draftMap = new Map(response.data.drafts.map((draft) => [draft.clientId, draft]));
        nextDrafts = nextDrafts.map((draft) => {
          const generated = draftMap.get(draft.id);
          return generated ? {
            ...draft,
            answer: generated.answer,
            explanation: generated.explanation,
            difficulty: generated.difficulty,
            tags: generated.tags,
            updatedAt: new Date().toISOString(),
          } : draft;
        });
      }
      setDrafts(nextDrafts);
      await Promise.all(nextDrafts.filter((draft) => selected.has(draft.id)).map((draft) => saveInterviewDraft(user.id, draft)));
      toast.success(`已为 ${selectedDrafts.length} 道题生成答案，请检查后再入库`);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'AI 生成答案失败');
    } finally {
      setGenerating(false);
    }
  };

  const importToLibrary = async () => {
    const ready = selectedDrafts.filter((draft) => draft.content.trim() && draft.answer.trim());
    if (ready.length === 0) {
      toast.error('所选草稿还没有完整答案');
      return;
    }
    setImporting(true);
    const importedIds: string[] = [];
    try {
      for (const draft of ready) {
        await questionApi.create({
          title: draft.content.slice(0, 100),
          content: draft.content,
          answer: draft.answer,
          explanation: draft.explanation || undefined,
          difficulty: draft.difficulty,
          categoryId: categoryId || undefined,
          tags: draft.tags,
        });
        importedIds.push(draft.id);
      }
      await removeInterviewDrafts(importedIds);
      setDrafts((current) => current.filter((draft) => !importedIds.includes(draft.id)));
      setSelected(new Set());
      toast.success(`已确认并导入 ${importedIds.length} 道题`);
    } catch (error: any) {
      if (importedIds.length > 0) {
        await removeInterviewDrafts(importedIds);
        setDrafts((current) => current.filter((draft) => !importedIds.includes(draft.id)));
      }
      toast.error(error.response?.data?.error || `导入中断，已成功 ${importedIds.length} 道`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page-shell">
      <header className="page-header">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-3 hidden h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 lg:flex"><BrainCircuit size={21} /></div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-950 lg:text-2xl">快速记题</h1>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500 lg:mt-2 lg:text-sm lg:leading-6">题目先存本机草稿，确认答案后再写入正式题库。</p>
          </div>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[11px] font-medium lg:gap-2 lg:px-3 lg:text-xs ${online ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {online ? <Check size={14} /> : <CloudOff size={14} />}{online ? '在线' : '离线草稿模式'}
          </span>
        </div>
      </header>

      <section className="surface-card p-3.5 sm:p-6">
        <label className="mb-2 block text-sm font-semibold text-slate-800">批量记录题目</label>
        <textarea
          value={bulkText}
          onChange={(event) => setBulkText(event.target.value)}
          className="min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 lg:min-h-36 lg:px-4 lg:py-3"
          placeholder={'每行一道题，例如：\nLinux 负载高如何排查？\nKubernetes Pod 一直 Pending 怎么处理？\nRedis 缓存雪崩有哪些治理方式？'}
        />
        <div className="mt-2.5 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
          <p className="text-xs text-slate-500">一行一道；需要多行题干时，用空行分隔每道题。</p>
          <button onClick={addQuestions} className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700 sm:min-h-11 sm:w-auto">
            <Plus size={18} /> 保存到草稿箱
          </button>
        </div>
      </section>

      <section className="space-y-3">
        <div className="rounded-xl border border-slate-200 bg-white p-3 lg:flex lg:flex-wrap lg:items-center lg:justify-between lg:gap-3 lg:rounded-2xl lg:p-4">
          <div>
            <h2 className="font-semibold text-slate-900">草稿箱（{drafts.length}）</h2>
            <p className="text-xs text-slate-500">已选择 {selectedDrafts.length} 道，其中 {readyCount} 道可入库</p>
          </div>
          <div className="mobile-scroll-row mt-3 lg:mt-0 lg:flex lg:flex-wrap lg:overflow-visible">
            <button
              type="button"
              disabled={drafts.length === 0 || deleting}
              onClick={toggleAllDrafts}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 lg:min-h-11 lg:gap-2 lg:px-4 lg:text-sm"
            >
              <Check size={17} /> {allSelected ? '取消全选' : '全选'}
            </button>
            <button
              type="button"
              disabled={selectedDrafts.length === 0 || deleting || generating || importing}
              onClick={deleteSelectedDrafts}
              className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 lg:min-h-11 lg:gap-2 lg:px-4 lg:text-sm"
            >
              <Trash2 size={17} /> {deleting ? '删除中…' : `批量删除 ${selectedDrafts.length}`}
            </button>
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="select-field min-h-10 shrink-0 px-3 pr-9 text-sm lg:min-h-11">
              <option value="">不指定分类</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
            <button disabled={generating || selectedDrafts.length === 0} onClick={generateAnswers} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50 lg:min-h-11 lg:gap-2 lg:px-4 lg:text-sm">
              <Sparkles size={17} /> {generating ? 'AI 生成中…' : 'AI 批量生成答案'}
            </button>
            <button disabled={importing || readyCount === 0} onClick={importToLibrary} className="inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-medium text-white disabled:opacity-50 lg:min-h-11 lg:gap-2 lg:px-4 lg:text-sm">
              <Upload size={17} /> {importing ? '导入中…' : `确认入库 ${readyCount}`}
            </button>
          </div>
        </div>

        {drafts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 lg:rounded-2xl lg:py-14">还没有草稿。现场遇到题目时，只记题干也可以。</div>
        ) : drafts.map((draft, index) => (
          <article key={draft.id} className="rounded-xl border border-slate-200 bg-white p-3 lg:rounded-2xl lg:p-5 lg:shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-3 lg:mb-3">
              <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm font-semibold text-slate-700 lg:min-h-11 lg:gap-3">
                <input type="checkbox" checked={selected.has(draft.id)} onChange={(event) => setSelected((current) => {
                  const next = new Set(current);
                  event.target.checked ? next.add(draft.id) : next.delete(draft.id);
                  return next;
                })} className="h-5 w-5 rounded" /> 第 {index + 1} 题
              </label>
              <button aria-label="删除草稿" onClick={() => deleteDraft(draft.id)} className="min-h-10 min-w-10 rounded-xl p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 lg:min-h-11 lg:min-w-11"><Trash2 className="mx-auto" size={18} /></button>
            </div>
            <div className="space-y-3">
              <textarea value={draft.content} onChange={(event) => updateDraft(draft.id, { content: event.target.value })} onBlur={() => persistDraft(draft.id)} rows={3} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-base outline-none focus:border-violet-500" aria-label={`第 ${index + 1} 题题目`} />
              <textarea value={draft.answer} onChange={(event) => updateDraft(draft.id, { answer: event.target.value })} onBlur={() => persistDraft(draft.id)} rows={5} className="w-full rounded-xl border border-slate-200 bg-emerald-50/40 px-3 py-2 text-base outline-none focus:border-emerald-500" placeholder="答案可留空，稍后使用 AI 生成" aria-label={`第 ${index + 1} 题答案`} />
              <div className="grid gap-3 sm:grid-cols-[160px_1fr]">
                <select value={draft.difficulty} onChange={(event) => updateDraft(draft.id, { difficulty: event.target.value as InterviewDraft['difficulty'] })} onBlur={() => persistDraft(draft.id)} className="select-field min-h-11 px-3 pr-9">
                  <option value="easy">简单</option><option value="medium">中等</option><option value="hard">困难</option>
                </select>
                <input value={draft.tags.join(', ')} onChange={(event) => updateDraft(draft.id, { tags: parseQuestionTags(event.target.value) })} onBlur={() => persistDraft(draft.id)} className="min-h-11 rounded-xl border border-slate-200 px-3 text-base outline-none focus:border-violet-500" placeholder="标签（逗号分隔）" />
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
};
