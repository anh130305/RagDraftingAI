import React from 'react';
import { ArrowRight, Grid3X3, Image, Mic, PlusCircle } from 'lucide-react';

interface ChatComposerProps {
  placeholder?: string;
  note?: string;
}

export default function ChatComposer({
  placeholder = 'Message Obsidian Nebula...',
  note = 'Obsidian Nebula can make mistakes. Verify important info.',
}: ChatComposerProps) {
  return (
    <div className="w-full max-w-3xl sticky bottom-4">
      <div className="glass-morphism rounded-full p-2 flex items-center gap-2 border border-outline-variant/15 focus-within:ring-4 focus-within:ring-primary/10 transition-all">
        <button className="p-3 text-on-surface-variant hover:text-primary transition-colors" type="button">
          <PlusCircle className="w-5 h-5" />
        </button>
        <input
          className="flex-1 bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-on-surface-variant font-body py-3 outline-none"
          placeholder={placeholder}
          type="text"
        />
        <div className="flex items-center gap-1 px-2">
          <button className="p-2 text-on-surface-variant hover:text-on-surface transition-colors" type="button">
            <Mic className="w-5 h-5" />
          </button>
          <button className="p-2 text-on-surface-variant hover:text-on-surface transition-colors" type="button">
            <Image className="w-5 h-5" />
          </button>
          <button className="p-2 text-on-surface-variant hover:text-on-surface transition-colors" type="button">
            <Grid3X3 className="w-5 h-5" />
          </button>
        </div>
        <button className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary-container flex items-center justify-center text-on-primary-fixed hover:opacity-90 transition-opacity active:scale-95" type="button">
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
      <p className="text-center text-[10px] text-on-surface-variant/60 mt-4 uppercase tracking-[0.2em] font-label">
        {note}
      </p>
    </div>
  );
}
