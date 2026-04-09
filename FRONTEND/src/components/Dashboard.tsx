import React from 'react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie
} from 'recharts';
import { Activity, Zap, ShieldCheck, AlertCircle, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { motion } from 'motion/react';

const vramData = [
  { time: '08:00 AM', value: 40 },
  { time: '09:00 AM', value: 35 },
  { time: '10:00 AM', value: 55 },
  { time: '11:00 AM', value: 45 },
  { time: '12:00 PM', value: 70 },
  { time: '01:00 PM', value: 65 },
  { time: '02:00 PM', value: 85 },
  { time: '03:00 PM', value: 40 },
  { time: '04:00 PM', value: 94 },
];

const tokenData = [
  { name: 'A', value: 40 },
  { name: 'B', value: 65 },
  { name: 'C', value: 90 },
  { name: 'D', value: 55 },
  { name: 'E', value: 100 },
  { name: 'F', value: 75 },
  { name: 'G', value: 45 },
  { name: 'H', value: 30 },
  { name: 'I', value: 60 },
  { name: 'J', value: 80 },
];

const deptData = [
  { name: 'Engineering', value: 75, amount: '12.4M', color: '#85adff' },
  { name: 'Marketing', value: 45, amount: '4.1M', color: '#c180ff' },
  { name: 'Product', value: 60, amount: '8.9M', color: '#fbb4ff' },
];

export default function Dashboard() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Nebula Monitoring</h2>
          <p className="text-on-surface-variant font-medium">Real-time inference and hardware orchestration status.</p>
        </div>
        <div className="flex gap-3">
          <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-outline-variant text-xs font-medium">
            <span className="w-2 h-2 bg-tertiary rounded-full animate-pulse shadow-[0_0_8px_rgba(251,180,255,0.6)]"></span>
            Live Feed Active
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-outline-variant text-xs font-medium text-on-surface-variant">
            Last sync: 2s ago
          </div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-6">
        {/* VRAM Chart */}
        <div className="col-span-12 lg:col-span-8 glass-card p-6 rounded-xl flex flex-col h-[400px]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h3 className="text-lg font-bold font-headline">VRAM & GPU Utilization</h3>
              <p className="text-xs text-on-surface-variant">Active across 4 clusters (A100/H100)</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
              Peak: 94.2%
            </span>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={vramData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#85adff" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#85adff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis 
                  dataKey="time" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fill: '#adaaaa', fontSize: 10, fontWeight: 700 }}
                  interval={2}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#1a1919', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                  itemStyle={{ color: '#85adff' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#85adff" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorValue)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RAG Success Rate */}
        <div className="col-span-12 lg:col-span-4 glass-card p-6 rounded-xl flex flex-col items-center justify-between h-[400px]">
          <div className="w-full text-left">
            <h3 className="text-lg font-bold font-headline">RAG Success Rate</h3>
            <p className="text-xs text-on-surface-variant">Retrieval confidence score</p>
          </div>
          
          <div className="relative w-48 h-48 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ value: 91.8 }, { value: 8.2 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={0}
                  dataKey="value"
                  startAngle={90}
                  endAngle={450}
                >
                  <Cell fill="#85adff" stroke="none" />
                  <Cell fill="#262626" stroke="none" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-extrabold font-headline">91.8%</span>
              <span className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Confidence</span>
            </div>
          </div>

          <div className="w-full space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-on-surface-variant">Semantic Hits</span>
                <span className="font-bold">8,420</span>
              </div>
              <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden">
                <div className="h-full bg-primary w-[92%] shadow-[0_0_8px_rgba(133,173,255,0.4)]"></div>
              </div>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-on-surface-variant">Vector Latency</span>
              <span className="font-bold text-secondary">42ms</span>
            </div>
          </div>
        </div>

        {/* Token Consumption */}
        <div className="col-span-12 lg:col-span-7 glass-card p-6 rounded-xl flex flex-col h-[280px]">
          <div className="flex justify-between mb-6">
            <h3 className="text-lg font-bold font-headline">Token Consumption</h3>
            <button className="text-on-surface-variant hover:text-on-surface transition-colors">
              <Activity className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokenData}>
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {tokenData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 4 ? '#85adff' : '#262626'} 
                      className="hover:fill-primary/60 transition-colors cursor-pointer"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Usage by Department */}
        <div className="col-span-12 lg:col-span-5 glass-card p-6 rounded-xl flex flex-col h-[280px]">
          <h3 className="text-lg font-bold font-headline mb-6">Usage by Department</h3>
          <div className="space-y-6">
            {deptData.map((dept) => (
              <div key={dept.name} className="flex items-center gap-4">
                <span className="w-20 text-[10px] font-bold uppercase text-on-surface-variant tracking-wider">{dept.name}</span>
                <div className="flex-1 h-2 bg-surface-highest rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${dept.value}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: dept.color, boxShadow: `0 0 10px ${dept.color}40` }}
                  />
                </div>
                <span className="text-xs font-bold w-12 text-right">{dept.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Alerts/Stats */}
        <div className="col-span-12 lg:col-span-4 glass-card rounded-xl p-6 flex items-center gap-6">
          <div className="w-14 h-14 rounded-full bg-error/10 flex items-center justify-center text-error">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h4 className="font-bold text-on-surface">System Health Alert</h4>
            <p className="text-xs text-on-surface-variant mt-1">Cluster node C-12 reporting high thermal stress.</p>
            <button className="mt-3 text-[10px] font-bold text-error uppercase tracking-widest hover:underline">
              Investigate Node
            </button>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-8 flex flex-wrap gap-6">
          <div className="glass-card px-8 py-6 rounded-xl flex-1 min-w-[200px]">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest mb-2">Active Threads</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold font-headline">1,402</p>
              <span className="text-sm font-bold text-primary flex items-center">
                <ArrowUpRight className="w-4 h-4" />
                12%
              </span>
            </div>
          </div>
          <div className="glass-card px-8 py-6 rounded-xl flex-1 min-w-[200px]">
            <p className="text-[10px] font-bold uppercase text-on-surface-variant tracking-widest mb-2">Inference Latency</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-extrabold font-headline">128ms</p>
              <span className="text-sm font-bold text-secondary flex items-center">
                <ArrowDownRight className="w-4 h-4" />
                8ms
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
