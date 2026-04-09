import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Code, Terminal, FileJson, Copy, CheckCircle2, BookOpen, Layers, ChevronRight, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';

const navSections = [
  {
    title: 'Getting Started',
    items: ['Introduction', 'Authentication', 'Quick Start Guide']
  },
  {
    title: 'Core Concepts',
    items: ['Models & Endpoints', 'Context Windows', 'Embeddings']
  },
  {
    title: 'API Reference',
    items: ['REST API', 'Webhooks', 'Rate Limits', 'Error Codes']
  }
];

export default function Documentation() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col lg:flex-row gap-8 h-full"
    >
      {/* Doc Sidebar */}
      <div className="w-full lg:w-64 shrink-0 space-y-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-xl font-bold font-headline text-on-surface">Docs</h2>
        </div>

        <div className="space-y-6">
          {navSections.map((section, idx) => (
            <div key={idx}>
              <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">{section.title}</h4>
              <ul className="space-y-1">
                {section.items.map((item, itemIdx) => (
                  <li key={itemIdx}>
                    <button className={cn(
                      "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors",
                      item === 'Authentication' 
                        ? "bg-surface-highest text-primary font-medium" 
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-low"
                    )}>
                      {item}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      {/* Doc Content */}
      <div className="flex-1 glass-card rounded-2xl p-8 lg:p-12 border border-outline-variant/10 overflow-y-auto custom-scrollbar">
        <div className="max-w-3xl">
          <div className="flex items-center gap-2 text-xs text-on-surface-variant mb-6 font-medium">
            <span>Getting Started</span>
            <ChevronRight className="w-3 h-3" />
            <span className="text-primary">Authentication</span>
          </div>

          <h1 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-4">Authentication</h1>
          <p className="text-on-surface-variant leading-relaxed mb-8 text-lg">
            The Obsidian AI API uses API keys to authenticate requests. You can view and manage your API keys in the <span className="text-primary cursor-pointer hover:underline">Settings</span> dashboard.
          </p>

          <div className="space-y-8">
            <section>
              <h3 className="text-xl font-bold font-headline text-on-surface mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-secondary" />
                Bearer Token
              </h3>
              <p className="text-on-surface-variant leading-relaxed mb-4 text-sm">
                Authentication to the API is performed via HTTP Bearer Auth. Provide your API key as the bearer token value in the Authorization header.
              </p>
              
              <div className="relative group rounded-xl overflow-hidden border border-outline-variant/20 bg-[#0a0a0a]">
                <div className="flex items-center justify-between px-4 py-2 bg-surface-highest border-b border-outline-variant/20">
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest">cURL</span>
                  <button 
                    onClick={handleCopy}
                    className="p-1.5 rounded-md hover:bg-surface-variant text-on-surface-variant transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-sm font-mono text-on-surface-variant">
                    <code className="language-bash">
                      <span className="text-primary">curl</span> https://api.obsidian.ai/v1/models \<br/>
                      {'  '}-H <span className="text-secondary">"Authorization: Bearer OBS_SECRET_KEY"</span>
                    </code>
                  </pre>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-bold font-headline text-on-surface mb-4">API Key Security</h3>
              <div className="p-5 rounded-xl bg-surface-low border-l-4 border-l-tertiary">
                <h4 className="text-sm font-bold text-on-surface mb-2">Keep your keys safe</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Your API keys carry many privileges, so be sure to keep them secure! Do not share your secret API keys in publicly accessible areas such as GitHub, client-side code, and so forth.
                </p>
              </div>
            </section>

            <section>
              <h3 className="text-xl font-bold font-headline text-on-surface mb-4">SDK Initialization</h3>
              <p className="text-on-surface-variant leading-relaxed mb-4 text-sm">
                If you are using our official Node.js or Python SDKs, authentication is handled automatically when you initialize the client.
              </p>
              
              <div className="relative rounded-xl overflow-hidden border border-outline-variant/20 bg-[#0a0a0a]">
                <div className="flex items-center px-4 py-2 bg-surface-highest border-b border-outline-variant/20 gap-4">
                  <span className="text-[10px] font-mono text-primary uppercase tracking-widest border-b border-primary pb-1">Node.js</span>
                  <span className="text-[10px] font-mono text-on-surface-variant uppercase tracking-widest pb-1 cursor-pointer hover:text-on-surface">Python</span>
                </div>
                <div className="p-4 overflow-x-auto">
                  <pre className="text-sm font-mono text-on-surface-variant">
                    <code className="language-javascript">
                      <span className="text-tertiary">import</span> {'{'} Obsidian {'}'} <span className="text-tertiary">from</span> <span className="text-secondary">'obsidian-ai'</span>;<br/><br/>
                      <span className="text-primary">const</span> client = <span className="text-tertiary">new</span> Obsidian({'{'}<br/>
                      {'  '}apiKey: process.env.<span className="text-on-surface">OBSIDIAN_API_KEY</span>,<br/>
                      {'}'});
                    </code>
                  </pre>
                </div>
              </div>
            </section>
          </div>
          
          <div className="mt-12 pt-8 border-t border-outline-variant/10 flex justify-between items-center">
            <button className="text-sm text-on-surface-variant hover:text-on-surface transition-colors flex items-center gap-2">
              <ChevronRight className="w-4 h-4 rotate-180" />
              Introduction
            </button>
            <button className="text-sm text-primary hover:text-primary-container transition-colors flex items-center gap-2 font-medium">
              Quick Start Guide
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
