import React, { useState, useRef, useEffect } from 'react';
import { Search, X } from 'lucide-react';

interface GlobalSearchProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export default function GlobalSearch({ onSearch, placeholder = 'Cari postingan, akun, kampanye...' }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setOpen(o => !o); }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition px-3 py-1.5 border border-slate-800 rounded-lg bg-slate-950/50">
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Cari... </span>
        <kbd className="text-[9px] text-slate-600 border border-slate-800 px-1 rounded">Ctrl+K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="flex items-center gap-3 p-4 border-b border-slate-800">
          <Search className="w-4 h-4 text-slate-500 flex-shrink-0" />
          <input ref={inputRef} type="text" value={query} onChange={e => setQuery(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none" />
          <button type="button" onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-400 transition">
            <X className="w-4 h-4" />
          </button>
        </form>
        {query && (
          <div className="p-4 text-xs text-slate-500 text-center">
            Tekan Enter untuk mencari "{query}" di semua data
          </div>
        )}
      </div>
    </div>
  );
}
