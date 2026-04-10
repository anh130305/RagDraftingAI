import React from 'react';
import { motion } from 'motion/react';
import { Activity, Cpu, HardDrive, Network, Server, AlertTriangle, CheckCircle2, Clock, ShieldAlert } from 'lucide-react';
import { cn } from '../lib/utils';

const metrics = [
  { id: 'cpu', label: 'Tải CPU Toàn cục', value: '42%', icon: Cpu, color: 'primary', status: 'normal' },
  { id: 'mem', label: 'Sử dụng Bộ nhớ', value: '78%', icon: HardDrive, color: 'secondary', status: 'warning' },
  { id: 'net', label: 'I/O Mạng', value: '1.2 GB/s', icon: Network, color: 'tertiary', status: 'normal' },
  { id: 'err', label: 'Tỷ lệ Lỗi', value: '0.01%', icon: Activity, color: 'error', status: 'normal' },
];

const nodes = [
  { id: 'node-01', region: 'us-east-1', status: 'healthy', uptime: '99.99%', load: 45 },
  { id: 'node-02', region: 'us-east-2', status: 'healthy', uptime: '99.95%', load: 62 },
  { id: 'node-03', region: 'eu-west-1', status: 'warning', uptime: '98.50%', load: 89 },
  { id: 'node-04', region: 'ap-south-1', status: 'healthy', uptime: '99.90%', load: 30 },
];

const logs = [
  { id: 1, time: '10:42:05 AM', level: 'INFO', message: 'Đồng bộ trọng số model qua cụm eu-west-1 thành công.' },
  { id: 2, time: '10:38:12 AM', level: 'WARN', message: 'Phát hiện áp lực bộ nhớ cao trên node-03. Đã kích hoạt Auto-scaling.' },
  { id: 3, time: '10:15:00 AM', level: 'ERROR', message: 'Lỗi khi tải nguồn cơ sở tri thức bên ngoài: hết thời gian chờ.' },
  { id: 4, time: '09:55:22 AM', level: 'INFO', message: 'Hoàn thành bảo trì định kỳ cho các phân vùng cơ sở dữ liệu.' },
];

export default function SystemHealth() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Tình trạng Hệ thống</h2>
          <p className="text-on-surface-variant max-w-2xl">Giám sát các chỉ số hạ tầng quan trọng, trạng thái node và sự kiện hệ thống theo thời gian thực.</p>
        </div>
        <div className="flex items-center gap-3 px-5 py-2.5 bg-surface-low border border-outline-variant rounded-full">
          <span className="w-2.5 h-2.5 rounded-full bg-success shadow-[0_0_10px_var(--color-success)] animate-pulse"></span>
          <span className="text-xs font-bold uppercase tracking-widest text-on-surface">Tất cả Hệ thống Hoạt động Tốt</span>
        </div>
      </header>

      {/* Top Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric) => (
          <div key={metric.id} className="glass-card p-6 rounded-xl border border-outline-variant relative overflow-hidden group">
            <div className={cn(
              "absolute -right-6 -top-6 w-24 h-24 rounded-full blur-[40px] opacity-20 group-hover:opacity-40 transition-opacity",
              `bg-${metric.color}`
            )}></div>
            <div className="flex justify-between items-start mb-4 relative z-10">
              <div className={cn("p-2 rounded-lg bg-surface-highest", `text-${metric.color}`)}>
                <metric.icon className="w-5 h-5" />
              </div>
              {metric.status === 'warning' && <AlertTriangle className="w-4 h-4 text-secondary" />}
            </div>
            <div className="relative z-10">
              <p className="text-3xl font-extrabold font-headline text-on-surface">{metric.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mt-1">{metric.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Node Status */}
        <div className="lg:col-span-2 glass-card rounded-xl border border-outline-variant overflow-hidden flex flex-col">
          <div className="p-6 border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" />
              Các Node Hoạt động
            </h3>
            <span className="text-xs text-on-surface-variant font-medium">4 / 4 Đang trực tuyến</span>
          </div>
          <div className="p-6 flex-1">
            <div className="space-y-6">
              {nodes.map((node) => (
                <div key={node.id} className="flex items-center gap-6">
                  <div className="w-12 h-12 rounded-full bg-surface-highest flex items-center justify-center border border-outline-variant shrink-0">
                    {node.status === 'healthy' ? (
                      <CheckCircle2 className="w-6 h-6 text-success" />
                    ) : (
                      <AlertTriangle className="w-6 h-6 text-secondary" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-end mb-2">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface">{node.id}</h4>
                        <p className="text-[10px] text-on-surface-variant uppercase tracking-widest">{node.region}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono text-on-surface">{node.load}% Tải</span>
                      </div>
                    </div>
                    <div className="h-1.5 w-full bg-surface-highest rounded-full overflow-hidden">
                      <div 
                        className={cn("h-full rounded-full", node.status === 'healthy' ? "bg-primary" : "bg-secondary")}
                        style={{ width: `${node.load}%` }}
                      />
                    </div>
                  </div>
                  <div className="hidden sm:block text-right shrink-0 w-24">
                    <p className="text-[10px] text-on-surface-variant uppercase tracking-widest mb-1">Thời gian hoạt động</p>
                    <p className="text-sm font-mono text-on-surface">{node.uptime}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Event Logs */}
        <div className="glass-card rounded-xl border border-outline-variant overflow-hidden flex flex-col">
          <div className="p-6 border-b border-outline-variant flex justify-between items-center">
            <h3 className="font-headline font-bold text-lg text-on-surface flex items-center gap-2">
              <Clock className="w-5 h-5 text-tertiary" />
              Sự kiện Hệ thống
            </h3>
          </div>
          <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
            <div className="space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-4 items-start">
                  <div className={cn(
                    "mt-1 w-2 h-2 rounded-full shrink-0",
                    log.level === 'INFO' ? "bg-primary" : log.level === 'WARN' ? "bg-secondary" : "bg-error"
                  )} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn(
                        "text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                        log.level === 'INFO' ? "bg-primary/10 text-primary" : log.level === 'WARN' ? "bg-secondary/10 text-secondary" : "bg-error/10 text-error"
                      )}>
                        {log.level}
                      </span>
                      <span className="text-[10px] font-mono text-on-surface-variant">{log.time}</span>
                    </div>
                    <p className="text-xs text-on-surface-variant leading-relaxed">{log.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
