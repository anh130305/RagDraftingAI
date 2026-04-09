import React from 'react';
import { 
  Users, ShieldCheck, Zap, Filter, UserPlus, Search, 
  MoreVertical, Edit2, Trash2, ChevronLeft, ChevronRight,
  CheckCircle2, XCircle
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const users = [
  { id: 1, name: 'Ava Sterling', email: 'ava.sterling@obsidian.ai', role: 'Admin', status: true, avatar: 'https://picsum.photos/seed/ava/100/100' },
  { id: 2, name: 'Marcus Thorne', email: 'm.thorne@obsidian.ai', role: 'Clerical', status: true, avatar: 'https://picsum.photos/seed/marcus/100/100' },
  { id: 3, name: 'Elena Vance', email: 'vance@obsidian.ai', role: 'User', status: false, avatar: 'https://picsum.photos/seed/elena/100/100' },
  { id: 4, name: 'Julian Moss', email: 'j.moss@obsidian.ai', role: 'User', status: true, avatar: 'https://picsum.photos/seed/julian/100/100' },
];

const permissions = [
  { 
    role: 'Admin', 
    color: 'primary', 
    items: [
      { label: 'Global Config Access', active: true },
      { label: 'Billing & User Mgmt', active: true },
      { label: 'Model Deployment', active: true },
    ]
  },
  { 
    role: 'Clerical', 
    color: 'secondary', 
    items: [
      { label: 'View Global Analytics', active: true },
      { label: 'Dataset Labeling', active: true },
      { label: 'No System Config', active: false },
    ]
  },
  { 
    role: 'User', 
    color: 'tertiary', 
    items: [
      { label: 'Personal Dashboards', active: true },
      { label: 'Model Experimentation', active: true },
      { label: 'No User Management', active: false },
    ]
  },
];

export default function UserManagement() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-2">User & Role Management</h2>
          <p className="text-on-surface-variant max-w-lg">Govern access controls, update permissions, and audit user activity across the Obsidian ecosystem.</p>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface border border-outline-variant text-on-surface hover:bg-surface-high transition-colors">
            <Filter className="w-5 h-5" />
            <span className="text-sm font-medium">Filter</span>
          </button>
          <button className="flex items-center gap-2 px-6 py-2.5 rounded-full gradient-primary text-surface font-bold hover:opacity-90 transition-opacity shadow-lg shadow-primary/10">
            <UserPlus className="w-5 h-5" />
            <span className="text-sm">Invite User</span>
          </button>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="glass-card p-6 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">Total Users</p>
            <p className="text-3xl font-headline font-extrabold">1,284</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
            <Users className="w-7 h-7" />
          </div>
        </div>
        <div className="glass-card p-6 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">Active Roles</p>
            <p className="text-3xl font-headline font-extrabold">12</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-secondary/10 flex items-center justify-center text-secondary">
            <ShieldCheck className="w-7 h-7" />
          </div>
        </div>
        <div className="glass-card p-6 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-on-surface-variant text-[10px] uppercase tracking-widest font-bold mb-1">System Load</p>
            <p className="text-3xl font-headline font-extrabold">24%</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary">
            <Zap className="w-7 h-7" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface rounded-xl overflow-hidden border border-outline-variant shadow-xl">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-high">
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">User</th>
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-center">Status</th>
                <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-surface-highest/30 transition-colors group">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <img 
                        src={user.avatar} 
                        alt={user.name} 
                        className="w-10 h-10 rounded-full border border-outline-variant"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{user.name}</p>
                        <p className="text-xs text-on-surface-variant">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <select 
                      defaultValue={user.role}
                      className="bg-surface-low border border-outline-variant rounded-xl px-4 py-2 text-sm text-on-surface focus:ring-1 focus:ring-primary focus:outline-none appearance-none cursor-pointer hover:border-primary/50 transition-colors"
                    >
                      <option value="Admin">Admin</option>
                      <option value="Clerical">Clerical</option>
                      <option value="User">User</option>
                    </select>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-center">
                      <button className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 border",
                        user.status ? "bg-primary/20 border-primary/30" : "bg-surface-highest border-outline-variant"
                      )}>
                        <span className={cn(
                          "inline-block h-4 w-4 transform rounded-full transition duration-200 ease-in-out",
                          user.status ? "translate-x-6 bg-primary" : "translate-x-1 bg-on-surface-variant"
                        )} />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex justify-end gap-2">
                      <button className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-highest rounded-lg transition-all">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button className="p-2 text-on-surface-variant hover:text-error hover:bg-error/10 rounded-lg transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="px-6 py-4 bg-surface-high/50 flex items-center justify-between border-t border-outline-variant">
          <p className="text-xs text-on-surface-variant">
            Showing <span className="text-on-surface font-medium">1-4</span> of <span className="text-on-surface font-medium">1,284</span> users
          </p>
          <div className="flex gap-2">
            <button className="p-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface hover:text-on-surface transition-all disabled:opacity-30" disabled>
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button className="p-2 rounded-lg border border-outline-variant text-on-surface-variant hover:bg-surface hover:text-on-surface transition-all">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Permissions Matrix */}
      <div>
        <h3 className="text-xl font-bold font-headline text-on-surface mb-4">Quick Permissions Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {permissions.map((perm) => (
            <div key={perm.role} className="bg-surface-low p-6 rounded-2xl border border-black/5 dark:border-white/5 border-t-[3px] shadow-sm hover:shadow-md transition-shadow" style={{ borderTopColor: `var(--color-${perm.color})` }}>
              <div className="flex items-center gap-3 mb-6">
                <div className={cn("w-2 h-2 rounded-full shadow-[0_0_8px_currentColor]")} style={{ color: `var(--color-${perm.color})`, backgroundColor: 'currentColor' }} />
                <span className="text-xs font-bold tracking-widest uppercase text-on-surface">{perm.role}</span>
              </div>
              <ul className="space-y-4">
                {perm.items.map((item, idx) => (
                  <li key={idx} className={cn("flex items-center gap-3 text-xs transition-opacity", !item.active && "opacity-40")}>
                    {item.active ? (
                      <CheckCircle2 className="w-4 h-4" style={{ color: `var(--color-${perm.color})` }} />
                    ) : (
                      <XCircle className="w-4 h-4 text-on-surface-variant" />
                    )}
                    <span className="text-on-surface-variant">{item.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
