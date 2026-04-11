import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Activity, Cpu, HardDrive, Network,
  AlertTriangle, Search, Filter, RefreshCw,
  ChevronLeft, ChevronRight, FileText, UserPlus, LogIn, Trash2, Database, KeyRound, Download
} from 'lucide-react';
import { cn } from '../lib/utils';
import * as api from '../lib/api';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';



const auditActionLabels: Record<string, string> = {
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  upload_document: 'Tải lên Tài liệu',
  download_document: 'Tải xuống Tài liệu',
  delete_document: 'Xóa Tài liệu',
  query: 'Truy vấn RAG',
  create_session: 'Tạo Phiên',
  delete_session: 'Xóa Phiên',
  update_user: 'Cập nhật User'
};

const getActionConfig = (action: string) => {
  switch (action) {
    case 'login': return { icon: LogIn, color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' };
    case 'logout': return { icon: LogIn, color: 'text-on-surface-variant', bg: 'bg-surface-high', border: 'border-outline-variant' };
    case 'upload_document': return { icon: FileText, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' };
    case 'download_document': return { icon: Download, color: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/20' };
    case 'delete_document': return { icon: Trash2, color: 'text-error', bg: 'bg-error/10', border: 'border-error/20' };
    case 'query': return { icon: Database, color: 'text-tertiary', bg: 'bg-tertiary/10', border: 'border-tertiary/20' };
    case 'update_user': return { icon: UserPlus, color: 'text-secondary', bg: 'bg-secondary/10', border: 'border-secondary/20' };
    case 'create_session': return { icon: Activity, color: 'text-primary', bg: 'bg-primary/5', border: 'border-primary/10' };
    default: return { icon: KeyRound, color: 'text-on-surface-variant', bg: 'bg-surface-high', border: 'border-outline-variant' };
  }
};

export default function SystemHealth() {
  const [logs, setLogs] = useState<api.AuditLogResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Chart Data
  const [chartData, setChartData] = useState<any[]>([]);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('');
  const [page, setPage] = useState(1);
  const limit = 20;

  useEffect(() => {
    // Fetch stats for chart (aggregated from recent 500 logs)
    const fetchChartStats = async () => {
      try {
        const res = await api.getAuditLogs({ limit: 500 });
        const counts: Record<string, number> = {};
        res.items.forEach(log => {
          counts[log.action] = (counts[log.action] || 0) + 1;
        });

        const data = Object.entries(counts).map(([action, count]) => {
          const label = auditActionLabels[action] || action;
          let fill = '#8b5cf6'; // default primary
          if (action === 'delete_document' || action === 'delete_session') fill = '#ef4444';
          if (action === 'login' || action === 'upload_document') fill = '#22c55e';
          if (action === 'query') fill = '#3b82f6';
          return { name: label, count, fill };
        });

        data.sort((a, b) => b.count - a.count);
        setChartData(data);
      } catch (err) {
        console.error("Failed to fetch chart stats:", err);
      }
    };
    fetchChartStats();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * limit;
      const params: Record<string, any> = { skip, limit };
      if (actionFilter) params.action = actionFilter;

      const res = await api.getAuditLogs(params);
      setLogs(res.items);
      setTotal(res.total);
    } catch (err: any) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line
  }, [page, actionFilter]);

  const totalPages = Math.ceil(total / limit);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface mb-1">Tình trạng Hệ thống (Audit)</h2>
          <p className="text-xs text-on-surface-variant max-w-2xl font-medium">Giám sát các chỉ số hạ tầng quan trọng và theo dõi nhật ký hoạt động trên toàn hệ thống.</p>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-surface text-on-surface-variant font-bold rounded-xl border border-outline-variant flex items-center gap-2 text-xs shadow-sm">
            <span className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_10px_var(--color-success)] animate-pulse"></span>
            Hệ thống Hoạt động Tốt
          </div>
        </div>
      </header>

      {/* Audit Logs Chart */}
      <div className="glass-card p-6 pb-2 rounded-2xl border border-outline-variant h-[320px] mb-8">
        <h3 className="font-bold text-on-surface mb-6 flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" />
          Phân bổ Tần suất Hành động (500 bản ghi gần nhất)
        </h3>
        <ResponsiveContainer width="100%" height="80%">
          <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'var(--color-on-surface-variant)' }} />
            <Tooltip
              cursor={{ fill: 'rgba(255,255,255,0.02)' }}
              contentStyle={{ backgroundColor: 'var(--color-surface)', border: '1px solid var(--color-outline-variant)', borderRadius: '12px', fontSize: '12px', color: 'var(--color-on-surface)' }}
              itemStyle={{ fontWeight: 'bold' }}
            />
            <Bar dataKey="count" name="Số lượt" radius={[4, 4, 0, 0]} barSize={40} maxBarSize={60}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Audit Logs Data Table */}
      <div className="glass-card flex flex-col rounded-2xl border border-outline-variant overflow-hidden">
        {/* Toolbar */}
        <div className="p-4 border-b border-outline-variant bg-surface flex flex-wrap lg:flex-nowrap items-center justify-between gap-4">
          <div className="flex items-center gap-4 w-full lg:w-auto">
            <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2 shrink-0">
              <Activity className="w-5 h-5 text-primary" />
              Nhật ký Audit
              <span className="text-xs font-mono bg-surface-high px-2 py-0.5 rounded-full text-on-surface-variant ml-2 border border-outline-variant">
                {total}
              </span>
            </h3>
            <div className="h-6 w-px bg-outline-variant hidden lg:block"></div>

            <div className="relative min-w-[200px]">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Filter className="h-4 w-4 text-on-surface-variant" />
              </div>
              <select
                value={actionFilter}
                onChange={(e) => {
                  setActionFilter(e.target.value);
                  setPage(1);
                }}
                className="w-full pl-9 pr-8 py-2 bg-surface-high border border-outline-variant rounded-xl text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary appearance-none outline-none font-medium"
              >
                <option value="">Tất cả Hành động</option>
                {Object.entries(auditActionLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full lg:w-auto">
            <button
              onClick={fetchLogs}
              className="px-4 py-2 border border-outline-variant rounded-xl text-on-surface text-sm font-bold bg-surface hover:bg-surface-high transition-colors flex items-center gap-2 shrink-0"
            >
              <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
              <span>Làm mới</span>
            </button>
          </div>
        </div>

        {/* Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-low border-b border-outline-variant/50">
                <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Thời gian</th>
                <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">Hành động</th>
                <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">User ID</th>
                <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest whitespace-nowrap">IP / Nguồn</th>
                <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest w-[30%]">Tài nguyên / Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30 text-sm">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse bg-surface/50">
                    <td className="px-5 py-4"><div className="h-4 w-24 bg-surface-high rounded"></div></td>
                    <td className="px-5 py-4"><div className="h-6 w-32 bg-surface-high rounded-full"></div></td>
                    <td className="px-5 py-4"><div className="h-4 w-40 bg-surface-high rounded"></div></td>
                    <td className="px-5 py-4"><div className="h-4 w-24 bg-surface-high rounded"></div></td>
                    <td className="px-5 py-4"><div className="h-4 w-full bg-surface-high rounded"></div></td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-on-surface-variant">
                    <Database className="w-10 h-10 mx-auto mb-3 opacity-20" />
                    <p className="font-bold">Không tìm thấy bản ghi Audit nào</p>
                    <p className="text-xs mt-1 opacity-70">Thử thay đổi bộ lọc hoặc tải lại trang.</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const conf = getActionConfig(log.action);

                  return (
                    <tr key={log.id} className="hover:bg-surface-highest/30 transition-colors group">
                      <td className="px-5 py-3 align-top">
                        <div className="font-mono text-xs text-on-surface-variant mt-1.5 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('vi-VN')}
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-bold", conf.bg, conf.border, conf.color)}>
                          <conf.icon className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[120px]">{auditActionLabels[log.action] || log.action}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 align-top">
                        <code className="text-[11px] font-mono bg-surface-high/50 text-on-surface px-1.5 py-0.5 rounded border border-outline-variant/30 text-nowrap">
                          {log.user_name ? log.user_name : log.user_id ? `${log.user_id.split('-')[0]}...` : 'System'}
                        </code>
                      </td>
                      <td className="px-5 py-3 align-top text-xs text-on-surface-variant">
                        {log.ip_address || '-'}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <div className="text-xs space-y-1.5">
                          {log.resource_type && (
                            <div className="font-bold text-on-surface">
                              [{log.resource_type}] {log.resource_id ? <span className="font-mono text-[10px] text-on-surface-variant leading-none">{log.resource_id.split('-')[0]}</span> : ''}
                            </div>
                          )}
                          {log.detail && (
                            <pre className="text-[10px] text-on-surface-variant bg-surface-low p-2 rounded-lg border border-outline-variant overflow-x-auto custom-scrollbar max-w-sm lg:max-w-md">
                              {JSON.stringify(log.detail, null, 2)}
                            </pre>
                          )}
                          {!log.resource_type && !log.detail && (
                            <span className="text-on-surface-variant opacity-50 italic">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Footer/Pagination */}
        <div className="p-4 border-t border-outline-variant bg-surface-low flex flex-wrap gap-4 items-center justify-between">
          <p className="text-xs text-on-surface-variant font-medium">
            Hiển thị <strong className="text-on-surface">{logs.length}</strong> kết quả trên trang này
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface text-on-surface hover:bg-surface-high disabled:opacity-50 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="flex items-center px-4 font-mono text-xs font-bold bg-surface-high rounded-lg border border-outline-variant">
              {page} / {totalPages || 1}
            </div>
            <button
              disabled={page >= totalPages || loading}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-outline-variant bg-surface text-on-surface hover:bg-surface-high disabled:opacity-50 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
