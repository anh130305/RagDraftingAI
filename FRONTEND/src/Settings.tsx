import React, { useState } from 'react';
import { CheckCheck, ChevronDown, Edit2, LogOut } from 'lucide-react';
import UserShell from './components/UserShell';
import ThemeModeRow from './components/ThemeModeRow';
import SettingsRow from './components/SettingsRow';

function SettingsContent() {
  const [activeTab, setActiveTab] = useState('account');

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar px-6 md:px-12 py-10">
      <div className="max-w-6xl mx-auto grid grid-cols-12 gap-10">
        <div className="col-span-7 space-y-12">
          <section>
            <h2 className="text-4xl font-extrabold font-headline mb-8 tracking-tight">Settings</h2>
            <div className="flex flex-wrap gap-2 p-1 bg-surface-container rounded-full w-max mb-10">
              <button
                onClick={() => setActiveTab('account')}
                className={`ui-pill-tab ${activeTab === 'account' ? 'ui-pill-tab-active' : ''}`}
              >
                Account
              </button>
              <button
                onClick={() => setActiveTab('data')}
                className={`ui-pill-tab ${activeTab === 'data' ? 'ui-pill-tab-active' : ''}`}
              >
                Data &amp; Privacy
              </button>
              <button
                onClick={() => setActiveTab('security')}
                className={`ui-pill-tab ${activeTab === 'security' ? 'ui-pill-tab-active' : ''}`}
              >
                Security
              </button>
            </div>

            <div className="space-y-8">
              {activeTab === 'account' && (
                <>
                  <div className="space-y-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Appearance</h3>
                    <ThemeModeRow />

                    <SettingsRow title="Glassmorphism Effects" description="Enable translucent surface textures">
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input defaultChecked className="sr-only peer" type="checkbox" />
                        <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </div>
                    </SettingsRow>
                  </div>

                  <div className="space-y-4 pt-4">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">General</h3>
                    <SettingsRow title="Language" description="Primary interface language">
                      <div className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface cursor-pointer px-4 py-2 border border-outline-variant/20 rounded-xl">
                        <span className="text-sm font-medium">English (US)</span>
                        <ChevronDown className="w-4 h-4" />
                      </div>
                    </SettingsRow>

                    <SettingsRow title="Auto-Update" description="Keep workspace architect tools up to date">
                      <div className="relative inline-flex items-center cursor-pointer">
                        <input defaultChecked className="sr-only peer" type="checkbox" />
                        <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                      </div>
                    </SettingsRow>
                  </div>
                </>
              )}

              {activeTab === 'data' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Data &amp; Privacy</h3>

                  <SettingsRow title="Telemetry & Usage Analytics" description="Share anonymous usage data to help us improve Obsidian AI models.">
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input defaultChecked className="sr-only peer" type="checkbox" />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </div>
                  </SettingsRow>

                  <SettingsRow title="Export Data" description="Download a complete copy of your workspace data and logs in JSON format.">
                    <button className="px-6 py-2 rounded-full bg-surface-highest text-on-surface text-sm font-bold border border-outline-variant hover:bg-surface-variant transition-all cursor-pointer">
                      Export JSON
                    </button>
                  </SettingsRow>

                  <div className="pt-4 mt-4 border-t border-outline-variant/20">
                    <SettingsRow title="Delete Account" description="Permanently delete your account and all associated data. This action cannot be undone.">
                      <button className="px-6 py-2 rounded-full bg-error/10 text-error text-sm font-bold border border-error/20 hover:bg-error hover:text-on-error transition-all cursor-pointer">
                        Delete Account
                      </button>
                    </SettingsRow>
                  </div>
                </div>
              )}

              {activeTab === 'security' && (
                <div className="space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-4">Security</h3>

                  <SettingsRow title="Two-Factor Authentication (2FA)" description="Add an extra layer of security to your account using an authenticator app.">
                    <div className="relative inline-flex items-center cursor-pointer">
                      <input className="sr-only peer" type="checkbox" />
                      <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
                    </div>
                  </SettingsRow>

                  <SettingsRow title="Change Password" description="Update your account password for enhanced security.">
                    <button className="px-6 py-2 rounded-full bg-surface-highest text-on-surface text-sm font-bold border border-outline-variant hover:bg-surface-variant transition-all cursor-pointer">
                      Update Password
                    </button>
                  </SettingsRow>

                  <SettingsRow title="Active Sessions" description="View and manage active sessions across all your devices.">
                    <button className="px-6 py-2 rounded-full bg-surface-highest text-on-surface text-sm font-bold border border-outline-variant hover:bg-surface-variant transition-all cursor-pointer">
                      Manage Sessions
                    </button>
                  </SettingsRow>
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="col-span-5">
          <div className="sticky top-0 space-y-6">
            <div className="glass-panel p-8 rounded-xl border border-outline-variant/10">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-primary/20 ring-offset-4 ring-offset-background">
                    <img
                      alt="User Profile"
                      className="w-full h-full object-cover"
                      data-alt="Close-up studio portrait of a man with minimalist aesthetic, soft rim lighting, dark high-fashion editorial style"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuBns5ScLKa66Ok8tDJVg5SkfTUAGzeBGqhYQI4dheTUax5wq899jKZlhigJbwcibDRmxQvTDY0DT64a465wPOgiRc8Eke8um_QZxIEbQYime9MclEumbKgiAyLIMIQXOFZjcRW26kdY5Y6moQi5msJRvJ2VYcEbdfQLY2OcFI6QzmfbJp-uIziGNVeWdadP3KWERDvYt3-XDAZS2lIr-b-2wbkmhvoLDwdPmSlPOU2qjSu07eG-XnjESqY0aUScL1hznpGQ1ABLu8hS"
                    />
                  </div>
                  <button className="absolute bottom-1 right-1 bg-primary p-2 rounded-full text-on-primary-fixed shadow-xl">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-2xl font-bold font-headline mb-1">Julian Thorne</h3>
                <p className="text-on-surface-variant text-sm mb-6">julian.thorne@obsidian.arch</p>
                <div className="flex items-center gap-2 px-4 py-1.5 bg-secondary/10 border border-secondary/20 text-secondary rounded-full text-xs font-bold uppercase tracking-widest">
                  <CheckCheck className="w-4 h-4" />
                  Pro Member
                </div>
              </div>

              <div className="mt-10 space-y-6 border-t border-outline-variant/10 pt-8">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-on-surface-variant">Storage</span>
                  <span className="text-sm font-semibold">12.4 GB / 100 GB</span>
                </div>
                <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                  <div className="bg-primary h-full rounded-full" style={{ width: '12.4%' }} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 text-center">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Tokens Used</p>
                    <p className="text-lg font-bold font-headline">1.2M</p>
                  </div>
                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/10 text-center">
                    <p className="text-[10px] uppercase font-bold text-on-surface-variant mb-1">Models Active</p>
                    <p className="text-lg font-bold font-headline">4</p>
                  </div>
                </div>
              </div>

              <button className="w-full mt-10 py-4 bg-surface-container-highest hover:bg-surface-variant transition-colors rounded-xl font-bold text-sm border border-outline-variant/10 flex items-center justify-center gap-2 cursor-pointer">
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  return (
    <UserShell activeNav="settings">
      <SettingsContent />

      <div className="fixed bottom-8 right-8 z-50 flex items-center gap-3 glass-panel px-4 py-2 rounded-full border border-outline-variant/20 shadow-2xl">
        <div className="w-2 h-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(251,180,255,0.8)]" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">System Ready</span>
      </div>
    </UserShell>
  );
}
