import React from 'react';
import { ArrowRightLeft, CheckCircle2, Database, HardDrive, Server, ShieldCheck } from 'lucide-react';
import { DatabaseInfo } from '@/types';

interface DatabaseStatusProps {
  dbInfo: DatabaseInfo | null;
  onOpenMigration: () => void;
}

export const DatabaseStatus: React.FC<DatabaseStatusProps> = ({ dbInfo, onOpenMigration }) => {
  if (!dbInfo) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-label="数据库状态加载中">
        <div className="animate-pulse space-y-5">
          <div className="h-16 rounded-xl bg-slate-100" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((item) => <div key={item} className="h-28 rounded-xl bg-slate-100" />)}
          </div>
        </div>
      </section>
    );
  }

  const sourceLabel = dbInfo.runtime?.source === 'profile' ? '系统配置' : '部署环境变量';
  const sourceEnglish = dbInfo.runtime?.source === 'profile' ? 'System profile' : 'Environment variables';
  const protocol = dbInfo.databaseType === 'sqlite' ? 'SQLite' : 'MySQL 兼容协议';
  const protocolEnglish = dbInfo.databaseType === 'sqlite' ? 'SQLite' : 'MySQL compatible';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-emerald-50 p-3 text-emerald-600">
            <Database size={22} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-slate-950">数据库状态</h2>
            <p className="mt-1 text-sm text-slate-500">Database status · 查看当前服务实际连接的数据库</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex w-fit items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold ${
            dbInfo.connected ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}>
            <span className={`h-2 w-2 rounded-full ${dbInfo.connected ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {dbInfo.connected ? '连接正常 · Connected' : '连接异常 · Disconnected'}
          </span>
          <button
            type="button"
            onClick={onOpenMigration}
            data-testid="open-database-migration"
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <ArrowRightLeft size={16} />
            数据库迁移
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-6">
        <div className={`mb-5 flex items-start gap-3 rounded-xl border p-4 ${
          dbInfo.connected
            ? 'border-emerald-100 bg-emerald-50/70 text-emerald-900'
            : 'border-rose-100 bg-rose-50/70 text-rose-900'
        }`}>
          {dbInfo.connected
            ? <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={19} />
            : <Server className="mt-0.5 shrink-0 text-rose-600" size={19} />}
          <div>
            <p className="text-sm font-semibold">{dbInfo.connected ? '数据库服务运行正常' : '数据库连接不可用'}</p>
            <p className="mt-1 text-xs leading-5 opacity-75">
              {dbInfo.connected
                ? '应用已成功连接数据库，可以正常读取和保存题库数据。'
                : '请检查数据库服务和部署环境中的连接参数。'}
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <Server size={16} />
              <span className="text-xs font-medium">数据库引擎 · Engine</span>
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-950">{dbInfo.databaseEngine}</p>
            <p className="mt-1 break-words text-xs leading-5 text-slate-500">{dbInfo.databaseVersion}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <HardDrive size={16} />
              <span className="text-xs font-medium">连接方式 · Connection</span>
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-950">{protocol}</p>
            <p className="mt-1 text-xs text-slate-500">{protocolEnglish}</p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <div className="flex items-center gap-2 text-slate-500">
              <ShieldCheck size={16} />
              <span className="text-xs font-medium">配置来源 · Source</span>
            </div>
            <p className="mt-3 text-lg font-semibold text-slate-950">{sourceLabel}</p>
            <p className="mt-1 text-xs text-slate-500">{sourceEnglish}</p>
          </div>
        </div>

        <p className="mt-5 rounded-xl bg-slate-50 px-4 py-3 text-xs leading-5 text-slate-500">
          当前连接由部署配置统一管理。如需迁移数据，请使用右上角“数据库迁移”，完成校验后再设置重启切换。
        </p>
      </div>
    </section>
  );
};
