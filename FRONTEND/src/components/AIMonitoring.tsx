import { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Activity,
  Zap,
  Clock,
  ThumbsUp,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import { getAIMonitoringStats, AIMonitoringResponse } from '../lib/api';
import { useToast } from '../lib/ToastContext';

export default function AIMonitoring() {
  const [stats, setStats] = useState<AIMonitoringResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(7);
  const { showToast } = useToast();

  const fetchStats = async (period: number = days) => {
    setLoading(true);
    try {
      const data = await getAIMonitoringStats(period);
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch AI monitoring stats:', err);
      showToast('Không thể tải dữ liệu theo dõi AI.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats(days);
  }, [days]);

  const COLORS = {
    success: '#10b981', // green-500
    error: '#ef4444',   // red-500
    primary: '#3b82f6', // blue-500
    secondary: '#8b5cf6' // violet-500
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-on-surface-variant font-medium">Đang tải phân tích AI...</p>
      </div>
    );
  }

  const feedbackData = [
    { name: 'Thích', value: stats?.summary.interaction_stats.likes || 0, color: COLORS.success },
    { name: 'Không thích', value: stats?.summary.interaction_stats.dislikes || 0, color: COLORS.error },
    { name: 'Không ý kiến', value: (stats?.summary.total_queries || 0) - (stats?.summary.interaction_stats.total_feedback || 0), color: '#94a3b8' }
  ];

  return (
    <div className="space-y-6">
      {/* Header with Range Filter & Refresh */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-on-surface">Theo dõi hiệu năng AI (QoS)</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Giám sát chất lượng, độ trễ và sự hài lòng. Đang xem dữ liệu <strong>{days} ngày</strong> gần nhất.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Range Selector */}
          <div className="flex bg-surface-highest rounded-xl p-1 border border-outline-variant/10">
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  days === d 
                    ? 'bg-primary text-on-primary-fixed shadow-md' 
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                {d}N
              </button>
            ))}
          </div>

          <button
            onClick={() => fetchStats(days)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-surface-highest hover:bg-surface-container rounded-xl transition-all font-bold text-sm border border-outline-variant/10"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Cập nhật
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KpiCard
          label="Tỉ lệ thành công"
          value={`${stats?.summary.success_rate || 100}%`}
          trend={stats?.summary.success_rate && stats.summary.success_rate > 95 ? "Tốt" : "Cần lưu ý"}
          icon={Zap}
          color="text-primary"
        />
        <KpiCard
          label="Độ trễ trung bình"
          value={`${stats?.summary.avg_latency_ms || 0}ms`}
          trend="Thời gian thực"
          icon={Clock}
          color="text-secondary"
        />
        <KpiCard
          label="Tỉ lệ hài lòng"
          value={`${stats?.summary.user_satisfaction || 0}%`}
          trend="Dựa trên feedback"
          icon={ThumbsUp}
          color="text-success"
        />
        <KpiCard
          label="Tỉ lệ lỗi"
          value={`${stats?.summary.error_rate || 0}%`}
          trend={stats?.summary.error_rate === 0 ? "Tuyệt vời" : "Đang xử lý"}
          icon={AlertTriangle}
          color="text-error"
        />
      </div>

      {/* Main Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latency Trend Chart */}
        <div className="lg:col-span-2 p-6 glass-card rounded-2xl">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Xu hướng độ trễ phản hồi ({days} ngày)
            </h3>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.trends || []}>
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.1}/>
                    <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} opacity={0.4} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} label={{ value: 'ms', angle: -90, position: 'insideLeft', offset: 10 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#fff', borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area
                  type="monotone"
                  dataKey="avgLatency"
                  name="Độ trễ"
                  stroke={COLORS.primary}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorLatency)"
                  animationDuration={1500}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Feedback Chart */}
        <div className="p-6 glass-card rounded-2xl flex flex-col">
          <h3 className="font-bold mb-6 flex items-center gap-2">
            <Activity className="w-4 h-4 text-secondary" />
            Phản hồi người dùng
          </h3>
          <div className="flex-1 min-h-[250px] relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={feedbackData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {feedbackData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold">{stats?.summary.user_satisfaction}%</span>
              <span className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">Hài lòng</span>
            </div>
          </div>
          <div className="space-y-2 mt-4">
            {feedbackData.map((item) => (
              <div key={item.name} className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm font-medium">{item.name}</span>
                </div>
                <span className="text-sm font-bold">{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 3: Success vs Error Bar Chart */}
      <div className="p-6 glass-card rounded-2xl">
        <h3 className="font-bold mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4 text-on-surface" />
          Phân tích lưu lượng & Lỗi
        </h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats?.trends || []}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.4} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend />
              <Bar dataKey="queries" name="Thành công" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
              <Bar dataKey="errors" name="Lỗi" fill={COLORS.error} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, trend, icon: Icon, color }: any) {
  return (
    <div className="p-5 glass-card rounded-2xl hover:border-primary/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-2.5 rounded-xl bg-surface-container group-hover:bg-primary/10 transition-colors ${color}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-1">{label}</p>
        <h4 className="text-2xl font-bold text-on-surface">{value}</h4>
        <p className={`text-[11px] font-bold mt-2 ${color} opacity-80`}>{trend}</p>
      </div>
    </div>
  );
}
