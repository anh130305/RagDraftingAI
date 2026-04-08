import React, { useState } from 'react';
import { 
  Settings2, Bot, Thermometer, Terminal, 
  ShieldCheck, Sparkles, CheckCircle2, Info,
  Cpu, Zap, Globe
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

const models = [
  { id: 'llama', name: 'Llama 3.1', desc: "Meta's flagship open model. Optimized for complex reasoning and large context windows.", params: '70B Params', opt: 'FP16', active: true },
  { id: 'mistral', name: 'Mistral Large', desc: "High-performance European model series. Exceptional at multilingual tasks.", params: 'MoE', opt: '8x22B', active: false },
  { id: 'gemma', name: 'Gemma 2', desc: "Google's lightweight efficient models. Best for latency-critical operations.", params: '27B Params', opt: 'TPU Optimized', active: false },
  { id: 'claude', name: 'Claude 3.5 Sonnet', desc: "Anthropic's latest masterpiece. Balanced speed and extreme intelligence.", params: 'API Managed', opt: 'Vision-Enabled', active: false },
];

export default function MLOpsConfig() {
  const [selectedModel, setSelectedModel] = useState('llama');
  const [temperature, setTemperature] = useState(0.7);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <header className="space-y-2">
        <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface">MLOps Configuration</h2>
        <p className="text-on-surface-variant max-w-2xl">Refine your neural architecture. Adjust inference parameters and system-level directives for the Obsidian core models.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Model Selection */}
        <div className="md:col-span-8 glass-card p-8 rounded-xl border border-outline-variant/10 shadow-[0_0_20px_rgba(133,173,255,0.05)]">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <Settings2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl text-on-surface">Model Selection</h3>
                <p className="text-xs text-on-surface-variant font-medium">Choose the underlying LLM architecture</p>
              </div>
            </div>
            <span className="bg-secondary/10 text-secondary text-[10px] px-3 py-1 rounded-full font-bold tracking-widest uppercase border border-secondary/20">
              Stable Release
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {models.map((model) => (
              <label 
                key={model.id}
                className={cn(
                  "relative flex flex-col p-5 rounded-2xl border-2 cursor-pointer transition-all duration-300 group",
                  selectedModel === model.id 
                    ? "bg-surface-high border-primary shadow-lg shadow-primary/5" 
                    : "bg-surface-low border-transparent hover:border-outline-variant/50"
                )}
                onClick={() => setSelectedModel(model.id)}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className={cn("font-bold transition-colors", selectedModel === model.id ? "text-on-surface" : "text-on-surface-variant group-hover:text-on-surface")}>
                    {model.name}
                  </span>
                  {selectedModel === model.id ? (
                    <CheckCircle2 className="w-5 h-5 text-primary fill-primary/10" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-outline-variant/30 group-hover:border-outline-variant/60" />
                  )}
                </div>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-6 flex-1">
                  {model.desc}
                </p>
                <div className="flex gap-2">
                  <span className="text-[9px] px-2 py-0.5 rounded bg-surface-highest text-on-surface-variant border border-outline-variant/10 uppercase tracking-widest font-bold">
                    {model.params}
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-surface-highest text-on-surface-variant border border-outline-variant/10 uppercase tracking-widest font-bold">
                    {model.opt}
                  </span>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Temperature & Context */}
        <div className="md:col-span-4 flex flex-col gap-6">
          <div className="glass-card p-8 rounded-xl border border-outline-variant/10 flex-1">
            <div className="flex items-center gap-3 mb-8">
              <Thermometer className="w-6 h-6 text-tertiary" />
              <h3 className="font-headline font-bold text-lg text-on-surface">Temperature</h3>
            </div>
            
            <div className="space-y-10">
              <div className="flex justify-between items-end">
                <div className="space-y-1">
                  <p className="text-4xl font-extrabold font-headline text-primary">{temperature.toFixed(1)}</p>
                  <p className="text-xs text-on-surface-variant font-medium">
                    {temperature < 0.4 ? 'Precise & Logical' : temperature > 0.7 ? 'Creative & Fluid' : 'Balanced Creativity'}
                  </p>
                </div>
                <Sparkles className="w-10 h-10 text-on-surface-variant/20" />
              </div>

              <div className="relative pt-2">
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-surface-highest rounded-full appearance-none cursor-pointer accent-primary"
                />
                <div className="flex justify-between text-[10px] text-on-surface-variant mt-4 font-mono font-bold uppercase tracking-widest">
                  <span>0.0 (Precise)</span>
                  <span>1.0 (Creative)</span>
                </div>
              </div>

              <div className="flex gap-3 p-4 bg-surface-low rounded-xl border border-outline-variant/10">
                <Info className="w-5 h-5 text-on-surface-variant shrink-0" />
                <p className="text-[11px] text-on-surface-variant leading-relaxed italic">
                  Lower values result in more deterministic outputs, while higher values increase randomness and diversity.
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface rounded-xl p-6 border border-outline-variant/10 shadow-lg">
            <h4 className="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-5">Context Utilization</h4>
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 bg-surface-highest rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '42%' }}
                    className="h-full bg-secondary rounded-full shadow-[0_0_12px_rgba(193,128,255,0.5)]"
                  />
                </div>
                <span className="text-xs font-mono font-bold text-on-surface">42k / 128k</span>
              </div>
              <p className="text-[10px] text-on-surface-variant font-medium leading-relaxed">
                Predicted context window usage for next inference batch based on current configuration.
              </p>
            </div>
          </div>
        </div>

        {/* System Prompt */}
        <div className="md:col-span-12 glass-card p-8 rounded-xl border border-outline-variant/10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-tertiary/10 flex items-center justify-center text-tertiary">
                <Terminal className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-headline font-bold text-xl text-on-surface">Global System Prompt</h3>
                <p className="text-xs text-on-surface-variant font-medium">Define the AI's identity, tone, and foundational constraints</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button className="text-[10px] px-4 py-2 rounded-full border border-outline-variant/20 hover:bg-surface-highest transition-all uppercase tracking-widest font-bold text-on-surface-variant hover:text-on-surface">
                Import Template
              </button>
              <button className="text-[10px] px-4 py-2 rounded-full bg-tertiary/10 text-tertiary hover:bg-tertiary/20 transition-all uppercase tracking-widest font-bold border border-tertiary/20">
                Clear All
              </button>
            </div>
          </div>

          <div className="relative group">
            <textarea 
              rows={8}
              className="w-full bg-surface-low/50 rounded-2xl border border-outline-variant/20 p-8 font-mono text-sm leading-relaxed text-on-surface focus:ring-1 focus:ring-primary/40 focus:border-primary/40 transition-all placeholder:text-on-surface-variant/20 resize-none shadow-inner custom-scrollbar"
              placeholder="You are a professional AI architect with a focus on minimalist efficiency..."
              defaultValue="You are a professional AI architect with a focus on minimalist efficiency. Your primary objective is to provide high-precision technical responses while maintaining a sophisticated, editorial tone. Avoid verbosity and prioritize structural clarity in all outputs."
            />
            <div className="absolute bottom-6 right-6 flex items-center gap-2 text-[10px] text-on-surface-variant font-mono font-bold uppercase tracking-widest">
              <span className="flex h-2 w-2 rounded-full bg-tertiary animate-pulse shadow-[0_0_8px_rgba(251,180,255,0.6)]"></span>
              Live Validator Active
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-low/30 border border-outline-variant/5">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
              <div>
                <h5 className="text-sm font-bold text-on-surface mb-1">Tone Analysis</h5>
                <p className="text-[11px] text-on-surface-variant">Currently set to: <span className="text-primary font-bold">Professional / Technical</span></p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-low/30 border border-outline-variant/5">
              <Sparkles className="w-5 h-5 text-secondary shrink-0" />
              <div>
                <h5 className="text-sm font-bold text-on-surface mb-1">Knowledge Injection</h5>
                <p className="text-[11px] text-on-surface-variant">Contextual grounding: <span className="text-secondary font-bold">Enabled (Obsidian DB)</span></p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-4 rounded-xl bg-surface-low/30 border border-outline-variant/5">
              <Zap className="w-5 h-5 text-error shrink-0" />
              <div>
                <h5 className="text-sm font-bold text-on-surface mb-1">Safety Guardrails</h5>
                <p className="text-[11px] text-on-surface-variant">Compliance level: <span className="text-error font-bold">Strict / HIPAA Mode</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="md:col-span-12 flex justify-end items-center gap-6 pt-4">
          <button className="text-on-surface-variant text-sm font-bold hover:text-on-surface transition-colors uppercase tracking-widest">Discard Changes</button>
          <button className="gradient-primary text-surface font-extrabold px-12 py-4 rounded-full text-sm shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            Save Configuration
          </button>
        </div>
      </div>

      {/* Floating Status */}
      <div className="fixed bottom-8 right-8 flex items-center gap-6 bg-surface-high/80 backdrop-blur-xl px-8 py-4 rounded-full border border-outline-variant/20 shadow-2xl z-50">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.6)]"></span>
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Engine: Online</span>
        </div>
        <div className="h-4 w-px bg-outline-variant/30"></div>
        <div className="flex items-center gap-3">
          <Zap className="w-4 h-4 text-primary" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Latency: 12ms</span>
        </div>
      </div>
    </motion.div>
  );
}
