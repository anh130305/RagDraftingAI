import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AreaChart, Area, XAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Activity, AlertCircle, ArrowDownRight, ArrowUpRight,
  Cpu, HardDrive, MemoryStick, Thermometer, Zap, Wifi, WifiOff,
  ThumbsUp, ThumbsDown, Users, UserCheck, UserX, UserPlus,
  MessageSquare,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import * as api from '../lib/api';
import type { SystemStatsResponse, DashboardStatsResponse, VramHistoryPoint } from '../lib/api';

// ── constants ─────────────────────────────────────────────────────────────────
const POLL_SYSTEM_MS = 5_000;    // system stats: 5s when real GPU
const POLL_SYSTEM_MOCK = 60_000;   // system stats: 60s in mock mode
const POLL_DASHBOARD_MS = 30_000;   // dashboard stats: every 30s
const CHART_HISTORY = 20;

// ── helpers ───────────────────────────────────────────────────────────────────
function mbToGb(mb: number) { return (mb / 1024).toFixed(1); }
function fmt(n: number, unit = '') { return `${n.toFixed(1)}${unit}`; }

// ── sub-components ────────────────────────────────────────────────────────────

function StatBadge({ label, value, color = 'text-on-surface' }: {
  label: string; value: string; color?: string;
}) {
  return (
    <div className="flex justify-between items-center text-xs py-1.5">
      <span className="text-on-surface-variant">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  );
}

function MiniGauge({ percent, color = 'var(--primary)' }: { percent: number; color?: string }) {
  return (
    <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden mt-1">
      <motion.div
        className="h-full rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(percent, 100)}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}66` }}
      />
    </div>
  );
}

function StatCard({ icon, label, value, sub, color = 'text-primary' }: {
  icon: React.ReactNode; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl bg-surface-highest/40">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-surface ${color}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">{label}</p>
        <p className="text-xl font-extrabold font-headline text-on-surface">{value}</p>
        {sub && <p className="text-xs text-on-surface-variant">{sub}</p>}
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState<SystemStatsResponse | null>(null);
  const [dashStats, setDashStats] = useState<DashboardStatsResponse | null>(null);
  const [history, setHistory] = useState<VramHistoryPoint[]>([]);
  const [lastSync, setLastSync] = useState<string>('—');
  const [connected, setConnected] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sysTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const dashTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── system stats polling ───────────────────────────────────────────────────
  const fetchSystem = useCallback(async () => {
    try {
      const data = await api.getSystemStats();
      setStats(data);
      setError(null);
      setConnected(true);
      if (!data.is_mock && data.vram_history.length > 0) {
        setHistory(data.vram_history.slice(-CHART_HISTORY));
      }
      const d = new Date(data.collected_at);
      setLastSync(d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      setConnected(false);
      setError(err.message ?? 'Không kết nối được với backend');
    }
  }, []);

  // ── dashboard stats polling ────────────────────────────────────────────────
  const fetchDashboard = useCallback(async () => {
    try {
      const data = await api.getDashboardStats();
      setDashStats(data);
    } catch { /* silently ignore, show stale data */ }
  }, []);

  useEffect(() => {
    fetchSystem();
    fetchDashboard();

    const sysInterval = stats?.is_mock ? POLL_SYSTEM_MOCK : POLL_SYSTEM_MS;
    sysTimer.current = setInterval(fetchSystem, sysInterval);
    dashTimer.current = setInterval(fetchDashboard, POLL_DASHBOARD_MS);

    return () => {
      if (sysTimer.current) clearInterval(sysTimer.current);
      if (dashTimer.current) clearInterval(dashTimer.current);
    };
  }, [fetchSystem, fetchDashboard, stats?.is_mock]);

  // ── derived values ─────────────────────────────────────────────────────────
  const primaryGpu = stats?.gpus?.[0] ?? null;
  const sys = stats?.system;
  const isMock = stats?.is_mock ?? true;
  const vramPct = primaryGpu?.vram_percent ?? 0;
  const gpuUtil = primaryGpu?.gpu_util_percent ?? 0;

  const fb = dashStats?.feedback;
  const ub = dashStats?.users;

  // Feedback donut data
  const feedbackDonutData = fb
    ? [
      { name: 'Thích', value: fb.likes, color: 'var(--primary)' },
      { name: 'Không thích', value: fb.dislikes, color: 'var(--error)' },
      { name: 'Chưa đánh giá', value: fb.no_feedback, color: 'var(--surface-highest)' },
    ]
    : [{ name: 'Chưa có dữ liệu', value: 1, color: 'var(--surface-highest)' }];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline tracking-tight text-on-surface mb-1">
            Giám sát RAG AI
          </h2>
          <p className="text-xs text-on-surface-variant font-medium">
            Phần cứng, phản hồi AI và người dùng.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[10px] font-medium transition-colors ${connected === null ? 'bg-surface border-outline-variant text-on-surface-variant'
              : connected ? 'bg-surface border-outline-variant'
                : 'bg-error/10 border-error/30 text-error'
            }`}>
            {connected === null ? <span className="w-1.5 h-1.5 bg-on-surface-variant rounded-full animate-pulse" />
              : connected ? <Wifi className="w-3 h-3 text-primary" />
                : <WifiOff className="w-3 h-3" />}
            {connected === null ? 'Đang kết nối...'
              : connected ? (isMock ? 'Demo' : 'Dữ liệu thực — LIVE')
                : 'Mất kết nối'}
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-lg border border-outline-variant text-[10px] font-medium text-on-surface-variant">
            Cập nhật: {lastSync}
          </div>
        </div>
      </header>

      {/* ── Error banner ────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-error/10 border border-error/20 text-xs text-error"
          >
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            <span>{error} — Đang hiển thị dữ liệu demo.</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-12 gap-4">

        {/* ── VRAM / GPU Chart ────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-8 glass-card p-6 rounded-xl flex flex-col h-[400px]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold font-headline">Sử dụng VRAM &amp; GPU</h3>
              <p className="text-xs text-on-surface-variant">
                {isMock ? 'Không phát hiện NVIDIA GPU trên máy chủ này' : primaryGpu?.name}
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
              {isMock ? 'N/A' : `Hiện tại: ${fmt(vramPct, '%')}`}
            </span>
          </div>

          {isMock ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 text-on-surface-variant/50">
              <svg className="w-16 h-16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <rect x="2" y="6" width="20" height="12" rx="2" />
                <path d="M6 10h12M6 14h8" strokeLinecap="round" />
                <circle cx="19" cy="12" r="1" fill="currentColor" />
              </svg>
              <p className="text-sm font-medium">Không có dữ liệu GPU</p>
              <p className="text-xs text-center max-w-xs">
                Biểu đồ VRAM chỉ hiển thị khi backend chạy trên máy có NVIDIA GPU và driver CUDA.
              </p>
            </div>
          ) : (
            <div className="flex-1 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <defs>
                    <linearGradient id="colorVram" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="time" axisLine={false} tickLine={false}
                    tick={{ fill: 'var(--on-surface-variant)', fontSize: 10, fontWeight: 700 }}
                    interval="preserveStartEnd"
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--surface)', border: '1px solid var(--outline-variant)', borderRadius: '12px', fontSize: '12px' }}
                    itemStyle={{ color: 'var(--primary)' }}
                    formatter={(v: number) => [`${v.toFixed(1)}%`, 'VRAM']}
                  />
                  <Area type="monotone" dataKey="value" stroke="var(--primary)" strokeWidth={3}
                    fillOpacity={1} fill="url(#colorVram)" isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* ── GPU Detail Card ──────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-4 glass-card p-6 rounded-xl flex flex-col h-[400px]">
          <h3 className="text-lg font-bold font-headline mb-1">Chi tiết GPU</h3>
          <p className="text-xs text-on-surface-variant mb-5">
            {primaryGpu?.name ?? 'Không phát hiện NVIDIA GPU'}
          </p>

          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-on-surface-variant flex items-center gap-1"><MemoryStick className="w-3.5 h-3.5" /> VRAM</span>
              <span className="font-bold">
                {primaryGpu && primaryGpu.vram_total_mb > 0
                  ? `${mbToGb(primaryGpu.vram_used_mb)} / ${mbToGb(primaryGpu.vram_total_mb)} GB`
                  : 'N/A'}
              </span>
            </div>
            <MiniGauge percent={vramPct} />
          </div>

          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-on-surface-variant flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> GPU Util</span>
              <span className="font-bold">{isMock ? 'N/A' : fmt(gpuUtil, '%')}</span>
            </div>
            <MiniGauge percent={gpuUtil} color="var(--secondary)" />
          </div>

          <div className="divide-y divide-outline-variant/20 mb-auto">
            <StatBadge label="Nhiệt độ"
              value={primaryGpu?.temperature_c != null ? `${primaryGpu.temperature_c}°C` : '—'}
              color={primaryGpu?.temperature_c != null && primaryGpu.temperature_c > 80 ? 'text-error' : 'text-on-surface'}
            />
            <StatBadge label="Công suất"
              value={primaryGpu?.power_w != null && primaryGpu.power_limit_w != null
                ? `${primaryGpu.power_w}W / ${primaryGpu.power_limit_w}W` : '—'}
            />
            <StatBadge label="VRAM trống"
              value={primaryGpu && primaryGpu.vram_total_mb > 0 ? `${mbToGb(primaryGpu.vram_free_mb)} GB` : '—'}
            />
          </div>

          {/* CPU quick summary */}
          <div className="pt-4 border-t border-outline-variant/20 space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> CPU</span>
              <span className="font-bold">{sys ? fmt(sys.cpu_percent, '%') : '—'}</span>
            </div>
            <MiniGauge percent={sys?.cpu_percent ?? 0} color="var(--tertiary)" />
            <div className="flex justify-between text-xs mt-1">
              <span className="text-on-surface-variant flex items-center gap-1"><MemoryStick className="w-3.5 h-3.5" /> RAM</span>
              <span className="font-bold">{sys ? `${mbToGb(sys.ram_used_mb)} / ${mbToGb(sys.ram_total_mb)} GB` : '—'}</span>
            </div>
            <MiniGauge percent={sys?.ram_percent ?? 0} color="var(--secondary)" />
          </div>
        </div>

        {/* ── AI Feedback Card ─────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-5 glass-card p-6 rounded-xl flex flex-col">
          <div className="mb-5">
            <h3 className="text-lg font-bold font-headline">Phản hồi AI</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">
              Đánh giá của người dùng trên toàn bộ phản hồi AI
            </p>
          </div>

          <div className="flex items-center gap-6 mb-6">
            {/* Donut chart */}
            <div className="relative w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={feedbackDonutData} cx="50%" cy="50%"
                    innerRadius={36} outerRadius={52}
                    dataKey="value" startAngle={90} endAngle={450} paddingAngle={2}
                  >
                    {feedbackDonutData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} stroke="none" />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-xl font-extrabold font-headline leading-none">
                  {fb ? `${fb.like_rate}%` : '—'}
                </span>
                <span className="text-[9px] text-on-surface-variant font-bold uppercase tracking-wide mt-0.5">
                  Thích
                </span>
              </div>
            </div>

            {/* Legend */}
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                <span className="text-xs text-on-surface-variant flex-1">Thích</span>
                <span className="text-sm font-bold">{fb?.likes ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-error shrink-0" />
                <span className="text-xs text-on-surface-variant flex-1">Không thích</span>
                <span className="text-sm font-bold">{fb?.dislikes ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-surface-highest shrink-0 border border-outline-variant" />
                <span className="text-xs text-on-surface-variant flex-1">Chưa đánh giá</span>
                <span className="text-sm font-bold">{fb?.no_feedback ?? '—'}</span>
              </div>
            </div>
          </div>

          {/* Metric row */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-outline-variant/20">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-primary mb-1">
                <ThumbsUp className="w-4 h-4" />
              </div>
              <p className="text-lg font-extrabold font-headline">{fb ? `${fb.like_rate}%` : '—'}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide font-bold">Tỷ lệ thích</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-error mb-1">
                <ThumbsDown className="w-4 h-4" />
              </div>
              <p className="text-lg font-extrabold font-headline">{fb ? `${fb.dislike_rate}%` : '—'}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide font-bold">Tỷ lệ dislike</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-on-surface-variant mb-1">
                <MessageSquare className="w-4 h-4" />
              </div>
              <p className="text-lg font-extrabold font-headline">{fb?.total_responses ?? '—'}</p>
              <p className="text-[10px] text-on-surface-variant uppercase tracking-wide font-bold">Tổng phản hồi</p>
            </div>
          </div>
        </div>

        {/* ── User Stats Card ──────────────────────────────────────────────── */}
        <div className="col-span-12 lg:col-span-7 glass-card p-6 rounded-xl flex flex-col">
          <div className="mb-5">
            <h3 className="text-lg font-bold font-headline">Người dùng</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">Tổng quan hoạt động tài khoản</p>
          </div>

          <div className="grid grid-cols-2 gap-3 flex-1">
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Tổng người dùng"
              value={ub?.total ?? '—'}
              color="text-primary"
            />
            <StatCard
              icon={<UserCheck className="w-5 h-5" />}
              label="Đang hoạt động"
              value={ub?.active ?? '—'}
              sub={ub ? `${Math.round(ub.active / (ub.total || 1) * 100)}% tổng số` : undefined}
              color="text-secondary"
            />
            <StatCard
              icon={<UserPlus className="w-5 h-5" />}
              label="Mới tháng này"
              value={ub?.new_this_month ?? '—'}
              color="text-tertiary"
            />
            <StatCard
              icon={<UserX className="w-5 h-5" />}
              label="Bị vô hiệu hóa"
              value={ub?.inactive ?? '—'}
              color="text-error"
            />
          </div>

          {/* Activity bar */}
          {ub && ub.total > 0 && (
            <div className="mt-5 pt-4 border-t border-outline-variant/20">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-on-surface-variant font-medium">Tỷ lệ hoạt động</span>
                <span className="font-bold">{Math.round(ub.active / ub.total * 100)}%</span>
              </div>
              <div className="h-2 w-full bg-surface-highest rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.round(ub.active / ub.total * 100)}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                  style={{ background: 'linear-gradient(90deg, var(--primary), var(--secondary))' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Bottom hardware stats ────────────────────────────────────────── */}
        <div className="col-span-12 flex flex-wrap gap-6">
          {primaryGpu?.temperature_c != null && primaryGpu.temperature_c > 80 && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
              className="flex-1 min-w-[280px] glass-card rounded-xl p-6 flex items-center gap-6 border border-error/20"
            >
              <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center text-error">
                <Thermometer className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-bold text-on-surface">Cảnh báo nhiệt độ GPU</h4>
                <p className="text-xs text-on-surface-variant mt-1">
                  GPU đang ở {primaryGpu.temperature_c}°C — vượt ngưỡng an toàn 80°C.
                </p>
              </div>
            </motion.div>
          )}

          <div className="glass-card px-8 py-6 rounded-xl flex-1 min-w-[180px]">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest mb-2">GPU Util</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold font-headline">{isMock ? 'N/A' : fmt(gpuUtil, '%')}</p>
              {!isMock && (
                <span className={`text-sm font-bold flex items-center ${gpuUtil > 50 ? 'text-primary' : 'text-secondary'}`}>
                  {gpuUtil > 50 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                </span>
              )}
            </div>
          </div>

          <div className="glass-card px-8 py-6 rounded-xl flex-1 min-w-[180px]">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest mb-2">RAM</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold font-headline">
                {sys ? `${sys.ram_percent.toFixed(0)}%` : '—'}
              </p>
              <span className="text-sm font-bold text-secondary">
                {sys ? `${mbToGb(sys.ram_used_mb)} GB` : ''}
              </span>
            </div>
          </div>

          <div className="glass-card px-8 py-6 rounded-xl flex-1 min-w-[180px]">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest mb-2">Disk</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold font-headline">
                {sys ? fmt(sys.disk_percent, '%') : '—'}
              </p>
              <span className="text-sm font-bold text-on-surface-variant">
                {sys ? `${sys.disk_used_gb}/${sys.disk_total_gb} GB` : ''}
              </span>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
