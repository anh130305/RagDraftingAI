import React from 'react';
import { 
  Upload, Globe, Activity, FileText, X, Rocket, 
  Database, CheckCircle2, AlertCircle, Search
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const ingestions = [
  { id: 1, name: 'Q4_Financial_Audit.pdf', progress: 45, type: 'pdf' },
  { id: 2, name: 'System_Architecture_v2.docx', progress: 82, type: 'docx' },
];

const jobs = [
  { id: 892, name: 'Customer Support Logs v4', progress: 92, status: 'Active', color: 'primary' },
  { id: 891, name: 'Legal_Terms_Repo_2023', progress: 0, status: 'Queued', color: 'tertiary' },
  { id: 890, name: 'Product_Specs_Master', progress: 100, status: 'Complete', color: 'on-surface-variant' },
];

export default function KnowledgeBase() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-2">Knowledge Base Manager</h2>
          <p className="text-on-surface-variant max-w-2xl">Integrate internal data sources through document ingestion, web crawling, and automated vectorization for retrieval-augmented generation.</p>
        </div>
      </header>

      <div className="flex flex-col gap-8">
        {/* Tabs */}
        <div className="flex gap-2 p-1 bg-surface-low rounded-xl self-start border border-outline-variant/10">
          <button className="px-6 py-2.5 rounded-lg bg-surface-highest text-primary font-semibold text-sm transition-all shadow-sm">Upload Docs</button>
          <button className="px-6 py-2.5 rounded-lg text-on-surface-variant hover:text-on-surface font-medium text-sm transition-all">Crawler</button>
          <button className="px-6 py-2.5 rounded-lg text-on-surface-variant hover:text-on-surface font-medium text-sm transition-all">Monitoring</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Upload & Recent */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            <div className="glass-card p-12 rounded-xl border-dashed border-2 border-outline-variant/20 hover:border-primary/40 transition-all group cursor-pointer flex flex-col items-center justify-center text-center min-h-[400px]">
              <div className="w-20 h-20 bg-surface-highest rounded-full flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                <Upload className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-on-surface mb-2">Drag & Drop Knowledge</h3>
              <p className="text-on-surface-variant mb-8 max-w-sm">Support for PDF, DOCX, and TXT files. Max file size 50MB. Files are automatically encrypted and chunked.</p>
              <button className="px-8 py-3 gradient-primary text-surface rounded-full font-bold flex items-center gap-2 hover:opacity-90 transition-opacity">
                <Upload className="w-5 h-5" />
                Select Files
              </button>
            </div>

            <div className="bg-surface rounded-xl p-6 border border-outline-variant/10">
              <div className="flex justify-between items-center mb-6">
                <h4 className="font-bold text-lg text-on-surface">Recent Ingestions</h4>
                <span className="text-[10px] text-primary font-bold bg-primary/10 px-3 py-1 rounded-full uppercase tracking-widest border border-primary/20">
                  3 Files Processing
                </span>
              </div>
              <div className="space-y-4">
                {ingestions.map((file) => (
                  <div key={file.id} className="flex items-center gap-4 p-4 bg-surface-high rounded-xl border border-outline-variant/5">
                    <div className="w-10 h-10 bg-surface-highest rounded-lg flex items-center justify-center">
                      <FileText className={cn("w-6 h-6", file.type === 'pdf' ? "text-red-400" : "text-blue-400")} />
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between mb-2">
                        <span className="text-sm font-medium text-on-surface">{file.name}</span>
                        <span className="text-xs text-on-surface-variant font-bold">{file.progress}%</span>
                      </div>
                      <div className="w-full bg-surface-highest h-1.5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${file.progress}%` }}
                          className="bg-primary h-full shadow-[0_0_8px_rgba(133,173,255,0.4)]"
                        />
                      </div>
                    </div>
                    <button className="text-on-surface-variant hover:text-on-surface transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Crawler & Stats */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-surface rounded-xl p-6 border border-outline-variant/10 shadow-lg">
              <div className="flex items-center gap-3 mb-6">
                <Globe className="w-6 h-6 text-secondary" />
                <h4 className="font-bold text-lg text-on-surface">Web Crawler</h4>
              </div>
              <div className="space-y-5">
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Seed URL</label>
                  <input 
                    type="url" 
                    placeholder="https://docs.example.com"
                    className="w-full bg-surface-high border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary placeholder:text-on-surface-variant/50 transition-all"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest">Crawl Depth</label>
                  <select className="w-full bg-surface-high border-none rounded-xl px-4 py-3 text-sm text-on-surface focus:ring-1 focus:ring-secondary appearance-none cursor-pointer">
                    <option>Single Page Only</option>
                    <option>Max Depth: 2</option>
                    <option>Max Depth: 5</option>
                  </select>
                </div>
                <div className="flex items-center gap-3 py-2">
                  <input type="checkbox" id="render" className="w-4 h-4 rounded border-outline-variant bg-surface-high text-secondary focus:ring-secondary" />
                  <label htmlFor="render" className="text-xs text-on-surface-variant font-medium">Render JavaScript (Headless)</label>
                </div>
                <button className="w-full py-3 bg-surface-highest text-secondary font-bold rounded-xl border border-secondary/20 hover:bg-secondary/10 transition-all flex items-center justify-center gap-2">
                  <Rocket className="w-5 h-5" />
                  Run Crawler
                </button>
              </div>
            </div>

            <div className="bg-surface-low rounded-xl p-6 relative overflow-hidden group border border-outline-variant/5">
              <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-tertiary/10 blur-[80px] rounded-full group-hover:bg-tertiary/20 transition-colors duration-500"></div>
              <h4 className="font-bold text-sm text-on-surface-variant mb-6 flex items-center gap-2">
                <Database className="w-4 h-4" />
                Vector Stats
              </h4>
              <div className="space-y-6 relative z-10">
                <div>
                  <span className="text-4xl font-extrabold tracking-tight text-on-surface">1.2M</span>
                  <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-widest mt-1">Total Embeddings</p>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-on-surface-variant">Storage Capacity</span>
                    <span className="text-tertiary">68%</span>
                  </div>
                  <div className="w-full bg-surface h-1.5 rounded-full overflow-hidden">
                    <div className="bg-tertiary h-full w-[68%] shadow-[0_0_10px_rgba(251,180,255,0.4)]"></div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-full border border-outline-variant/10">
                <div className="w-1.5 h-1.5 rounded-full bg-tertiary animate-pulse"></div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Indexing</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-full border border-outline-variant/10">
                <div className="w-1.5 h-1.5 rounded-full bg-primary"></div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">PostgreSQL Ready</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-surface rounded-full border border-outline-variant/10">
                <div className="w-1.5 h-1.5 rounded-full bg-secondary"></div>
                <span className="text-[9px] font-bold uppercase tracking-widest text-on-surface-variant">Pinecone V2</span>
              </div>
            </div>
          </div>
        </div>

        {/* Jobs List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {jobs.map((job) => (
            <div key={job.id} className="bg-surface rounded-2xl p-6 border border-outline-variant/5 hover:border-outline-variant/20 transition-all">
              <div className="flex justify-between mb-4">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">Vectorization Job #{job.id}</span>
                <span className={cn("text-[10px] font-bold uppercase tracking-widest", `text-${job.color}`)}>{job.status}</span>
              </div>
              <h5 className="text-sm font-semibold text-on-surface mb-4">{job.name}</h5>
              <div className="flex items-center gap-4">
                <div className="flex-1 bg-surface-high h-1 rounded-full overflow-hidden">
                  <div className={cn("h-full transition-all duration-500", `bg-${job.color}`)} style={{ width: `${job.progress}%` }}></div>
                </div>
                <span className="text-xs font-mono text-on-surface-variant">{job.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
