import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  User, Shield, Key, CreditCard, Bell, Save, 
  Plus, Copy, CheckCircle2, Laptop, Smartphone,
  AlertTriangle
} from 'lucide-react';
import { cn } from '../lib/utils';

const tabs = [
  { id: 'general', label: 'General Profile', icon: User },
  { id: 'security', label: 'Security & Access', icon: Shield },
  { id: 'api', label: 'API Keys', icon: Key },
  { id: 'billing', label: 'Billing & Usage', icon: CreditCard },
  { id: 'notifications', label: 'Notifications', icon: Bell },
];

const apiKeys = [
  { id: 1, name: 'Production Cluster', key: 'sk-obs_...9f82', created: 'Oct 12, 2023', lastUsed: '2 mins ago' },
  { id: 2, name: 'Development Env', key: 'sk-obs_...3a1b', created: 'Nov 05, 2023', lastUsed: '1 day ago' },
];

const sessions = [
  { id: 1, device: 'MacBook Pro 16"', location: 'San Francisco, CA', ip: '192.168.1.42', active: true, icon: Laptop },
  { id: 2, device: 'iPhone 14 Pro', location: 'San Francisco, CA', ip: '10.0.0.15', active: false, icon: Smartphone },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [copied, setCopied] = useState<number | null>(null);

  const handleCopy = (id: number) => {
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header>
        <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Settings</h2>
        <p className="text-on-surface-variant max-w-2xl">Manage your account preferences, security configurations, and workspace billing.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-3 space-y-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-medium",
                activeTab === tab.id 
                  ? "bg-surface-highest text-on-surface shadow-md" 
                  : "text-on-surface-variant hover:bg-surface-high hover:text-on-surface"
              )}
            >
              <tab.icon className={cn("w-5 h-5", activeTab === tab.id ? "text-primary" : "text-on-surface-variant")} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="lg:col-span-9 space-y-6">
          
          {/* General Tab */}
          {activeTab === 'general' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="glass-card p-8 rounded-2xl border border-outline-variant">
                <h3 className="text-xl font-bold font-headline text-on-surface mb-6">Profile Information</h3>
                
                <div className="flex items-center gap-6 mb-8">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-outline-variant relative group cursor-pointer">
                    <img 
                      src="https://picsum.photos/seed/admin/200/200" 
                      alt="Profile" 
                      className="w-full h-full object-cover group-hover:opacity-50 transition-opacity"
                    />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs font-bold text-on-surface">Change</span>
                    </div>
                  </div>
                  <div>
                    <button className="px-5 py-2 rounded-full bg-surface-highest text-on-surface text-sm font-bold border border-outline-variant hover:bg-surface-variant transition-all mb-2">
                      Upload New Avatar
                    </button>
                    <p className="text-xs text-on-surface-variant">JPG, GIF or PNG. Max size of 2MB.</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Full Name</label>
                    <input 
                      type="text" 
                      defaultValue="Adrian Valerius"
                      className="w-full bg-surface-high border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Email Address</label>
                    <input 
                      type="email" 
                      defaultValue="adrian.v@obsidian.ai"
                      className="w-full bg-surface-high border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Role</label>
                    <input 
                      type="text" 
                      defaultValue="Admin Stratos"
                      disabled
                      className="w-full bg-surface-low border-none rounded-xl px-4 py-3 text-sm text-on-surface-variant opacity-70 cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Workspace</label>
                    <input 
                      type="text" 
                      defaultValue="Obsidian Core"
                      className="w-full bg-surface-high border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-primary transition-all"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <button className="gradient-primary text-surface font-extrabold px-8 py-3 rounded-full text-sm shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-2">
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </motion.div>
          )}

          {/* API Keys Tab */}
          {activeTab === 'api' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="glass-card p-8 rounded-2xl border border-outline-variant">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-xl font-bold font-headline text-on-surface">API Keys</h3>
                    <p className="text-xs text-on-surface-variant mt-1">Manage keys for authenticating with the Obsidian API.</p>
                  </div>
                  <button className="px-5 py-2.5 rounded-full bg-surface-highest text-primary font-bold text-sm border border-outline-variant hover:bg-surface-variant transition-all flex items-center gap-2">
                    <Plus className="w-4 h-4" />
                    Create New Key
                  </button>
                </div>

                <div className="bg-surface rounded-xl overflow-hidden border border-outline-variant">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-high border-b border-outline-variant">
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Name</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Secret Key</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Created</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Last Used</th>
                        <th className="px-6 py-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant">
                      {apiKeys.map((key) => (
                        <tr key={key.id} className="hover:bg-surface-highest/30 transition-colors">
                          <td className="px-6 py-4 text-sm font-medium text-on-surface">{key.name}</td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono text-on-surface-variant bg-surface-low px-2 py-1 rounded">{key.key}</code>
                              <button 
                                onClick={() => handleCopy(key.id)}
                                className="text-on-surface-variant hover:text-on-surface transition-colors"
                              >
                                {copied === key.id ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-xs text-on-surface-variant">{key.created}</td>
                          <td className="px-6 py-4 text-xs text-on-surface-variant">{key.lastUsed}</td>
                          <td className="px-6 py-4 text-right">
                            <button className="text-xs font-bold text-error hover:text-error/80 transition-colors uppercase tracking-widest">Revoke</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="glass-card p-8 rounded-2xl border border-outline-variant">
                <h3 className="text-xl font-bold font-headline text-on-surface mb-6">Two-Factor Authentication</h3>
                <div className="flex items-center justify-between p-6 bg-surface-low rounded-xl border border-outline-variant">
                  <div>
                    <h4 className="text-sm font-bold text-on-surface mb-1">Authenticator App</h4>
                    <p className="text-xs text-on-surface-variant">Use an app like Google Authenticator to get 2FA codes.</p>
                  </div>
                  <button className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary/20 border border-primary/30 transition-colors duration-200">
                    <span className="translate-x-6 inline-block h-4 w-4 transform rounded-full bg-primary transition duration-200 ease-in-out" />
                  </button>
                </div>
              </div>

              <div className="glass-card p-8 rounded-2xl border border-outline-variant">
                <h3 className="text-xl font-bold font-headline text-on-surface mb-6">Active Sessions</h3>
                <div className="space-y-4">
                  {sessions.map((session) => (
                    <div key={session.id} className="flex items-center justify-between p-4 bg-surface-high rounded-xl border border-outline-variant">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-lg bg-surface-highest flex items-center justify-center">
                          <session.icon className="w-5 h-5 text-on-surface-variant" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-on-surface">{session.device}</h4>
                            {session.active && (
                              <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded">Current</span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant mt-1">{session.location} • {session.ip}</p>
                        </div>
                      </div>
                      {!session.active && (
                        <button className="text-xs font-bold text-on-surface-variant hover:text-error transition-colors uppercase tracking-widest">Revoke</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {/* Billing Tab (Placeholder) */}
          {activeTab === 'billing' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="glass-card p-8 rounded-2xl border border-outline-variant">
                <div className="flex justify-between items-start mb-8">
                  <div>
                    <h3 className="text-xl font-bold font-headline text-on-surface mb-2">Current Plan</h3>
                    <p className="text-sm text-on-surface-variant">You are currently on the <span className="text-secondary font-bold">Enterprise Tier</span>.</p>
                  </div>
                  <button className="px-5 py-2.5 rounded-full bg-surface-highest text-on-surface font-bold text-sm border border-outline-variant hover:bg-surface-variant transition-all">
                    Manage Billing
                  </button>
                </div>

                <div className="p-6 bg-surface-low rounded-xl border border-outline-variant">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-widest text-on-surface-variant mb-1">Compute Usage</h4>
                      <p className="text-2xl font-extrabold font-headline text-on-surface">842 <span className="text-sm text-on-surface-variant font-medium">/ 1000 hrs</span></p>
                    </div>
                    <span className="text-sm font-bold text-secondary">84.2%</span>
                  </div>
                  <div className="h-2 w-full bg-surface-highest rounded-full overflow-hidden">
                    <div className="h-full bg-secondary w-[84.2%] shadow-[0_0_10px_rgba(193,128,255,0.4)]" />
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-3">Resets in 12 days on Nov 1, 2023.</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Notifications Tab (Placeholder) */}
          {activeTab === 'notifications' && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <div className="glass-card p-8 rounded-2xl border border-outline-variant">
                <h3 className="text-xl font-bold font-headline text-on-surface mb-6">Notification Preferences</h3>
                <div className="space-y-4">
                  {[
                    { title: 'System Alerts', desc: 'Critical infrastructure and node health alerts.', active: true },
                    { title: 'Billing Updates', desc: 'Invoices, usage warnings, and payment issues.', active: true },
                    { title: 'Model Training', desc: 'Notifications when fine-tuning jobs complete.', active: false },
                    { title: 'Security Logs', desc: 'New logins, API key creation, and role changes.', active: true },
                  ].map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 bg-surface-low rounded-xl border border-outline-variant">
                      <div>
                        <h4 className="text-sm font-bold text-on-surface mb-1">{item.title}</h4>
                        <p className="text-xs text-on-surface-variant">{item.desc}</p>
                      </div>
                      <button className={cn(
                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 border",
                        item.active ? "bg-primary/20 border-primary/30" : "bg-surface-highest border-outline-variant"
                      )}>
                        <span className={cn(
                          "inline-block h-4 w-4 transform rounded-full transition duration-200 ease-in-out",
                          item.active ? "translate-x-6 bg-primary" : "translate-x-1 bg-on-surface-variant"
                        )} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

        </div>
      </div>
    </motion.div>
  );
}
