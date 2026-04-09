import React from 'react';
import { motion } from 'motion/react';
import { Search, MessageSquare, Mail, Book, ChevronRight, LifeBuoy, FileQuestion, Zap, ShieldCheck } from 'lucide-react';

const categories = [
  { id: 1, title: 'Getting Started', icon: Zap, desc: 'Quick start guides and basic concepts for new users.', count: 12 },
  { id: 2, title: 'Account & Billing', icon: ShieldCheck, desc: 'Manage your subscription, invoices, and team roles.', count: 8 },
  { id: 3, title: 'Model Fine-tuning', icon: Book, desc: 'Advanced tutorials on customizing model behavior.', count: 24 },
  { id: 4, title: 'Troubleshooting', icon: FileQuestion, desc: 'Common errors, API limits, and how to resolve them.', count: 15 },
];

const faqs = [
  "How do I increase my API rate limits?",
  "What is the difference between Llama 3.1 and Mistral Large?",
  "How is data encrypted at rest?",
  "Can I export my fine-tuned weights?",
];

export default function HelpCenter() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-10"
    >
      {/* Hero Section */}
      <div className="relative glass-card rounded-2xl p-12 overflow-hidden border border-outline-variant text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none"></div>
        <div className="absolute -top-24 -left-24 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none"></div>
        <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-secondary/20 blur-[100px] rounded-full pointer-events-none"></div>
        
        <LifeBuoy className="w-12 h-12 text-primary mb-6 relative z-10" />
        <h2 className="text-4xl font-extrabold font-headline tracking-tight text-on-surface mb-4 relative z-10">How can we help you?</h2>
        <p className="text-on-surface-variant max-w-xl mb-8 relative z-10">Search our knowledge base for guides, API references, and troubleshooting articles.</p>
        
        <div className="relative w-full max-w-2xl z-10">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant w-5 h-5" />
          <input 
            type="text" 
            placeholder="Search for articles, tutorials, or error codes..." 
            className="w-full bg-surface-highest/80 backdrop-blur-md border border-outline-variant rounded-full py-4 pl-12 pr-6 text-on-surface focus:ring-2 focus:ring-primary/40 focus:border-primary/40 transition-all shadow-xl placeholder:text-on-surface-variant/50"
          />
        </div>
      </div>

      {/* Categories Grid */}
      <div>
        <h3 className="text-xl font-bold font-headline text-on-surface mb-6">Browse by Category</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {categories.map((cat) => (
            <div key={cat.id} className="glass-card p-6 rounded-xl border border-outline-variant hover:border-primary/30 transition-all cursor-pointer group flex items-start gap-5">
              <div className="w-12 h-12 rounded-xl bg-surface-highest flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                <cat.icon className="w-6 h-6 text-on-surface-variant group-hover:text-primary transition-colors" />
              </div>
              <div className="flex-1">
                <h4 className="text-lg font-bold text-on-surface mb-1 group-hover:text-primary transition-colors">{cat.title}</h4>
                <p className="text-xs text-on-surface-variant leading-relaxed mb-3">{cat.desc}</p>
                <span className="text-[10px] font-bold uppercase tracking-widest text-primary/80">{cat.count} Articles</span>
              </div>
              <ChevronRight className="w-5 h-5 text-on-surface-variant/30 group-hover:text-primary transition-colors self-center" />
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Popular FAQs */}
        <div className="lg:col-span-2 glass-card p-8 rounded-xl border border-outline-variant">
          <h3 className="text-xl font-bold font-headline text-on-surface mb-6">Frequently Asked Questions</h3>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-surface-low border border-outline-variant hover:bg-surface-highest transition-colors cursor-pointer flex justify-between items-center group">
                <span className="text-sm font-medium text-on-surface-variant group-hover:text-on-surface transition-colors">{faq}</span>
                <ChevronRight className="w-4 h-4 text-on-surface-variant/50 group-hover:text-on-surface transition-colors" />
              </div>
            ))}
          </div>
        </div>

        {/* Contact Support */}
        <div className="glass-card p-8 rounded-xl border border-outline-variant flex flex-col justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-tertiary/10 flex items-center justify-center mx-auto mb-6">
            <MessageSquare className="w-8 h-8 text-tertiary" />
          </div>
          <h3 className="text-xl font-bold font-headline text-on-surface mb-2">Still need help?</h3>
          <p className="text-xs text-on-surface-variant mb-8">Our engineering support team is available 24/7 for enterprise customers.</p>
          <button className="w-full py-3 rounded-full bg-surface-highest text-on-surface font-bold border border-outline-variant hover:bg-surface-variant transition-all flex items-center justify-center gap-2 mb-3">
            <MessageSquare className="w-4 h-4" />
            Live Chat
          </button>
          <button className="w-full py-3 rounded-full bg-transparent text-on-surface-variant font-bold hover:text-on-surface transition-all flex items-center justify-center gap-2">
            <Mail className="w-4 h-4" />
            Email Support
          </button>
        </div>
      </div>
    </motion.div>
  );
}
