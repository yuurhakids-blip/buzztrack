import React, { useState, useEffect } from 'react';
import { Key, Save } from 'lucide-react';

interface SettingsProps {
  showNotification: (type: 'success' | 'error', text: string) => void;
}

export default function Settings({ showNotification }: SettingsProps) {
  const [provider, setProvider] = useState<'Gemini' | 'OpenRouter' | 'Opencode'>(() => 
    (localStorage.getItem('selectedProvider') as any) || 'Gemini'
  );
  const [model, setModel] = useState<string>(() => 
    localStorage.getItem('selectedModel') || ''
  );
  const [models, setModels] = useState<string[]>([]);
  const [apiKeys, setApiKeys] = useState<{ Gemini: string; OpenRouter: string; Opencode: string }>(() => ({
    Gemini: localStorage.getItem('api-key-Gemini') || '',
    OpenRouter: localStorage.getItem('api-key-OpenRouter') || '',
    Opencode: localStorage.getItem('api-key-Opencode') || '',
  }));

  const [modelSearch, setModelSearch] = useState<string>('');
  const [isFetchingModels, setIsFetchingModels] = useState<boolean>(false);

  useEffect(() => {
    // Gunakan proxy backend untuk menghindari CSP (Content Security Policy)
    const fetchModels = async () => {
      setIsFetchingModels(true);
      let available: string[] = [];
      try {
        const modelUrl = provider === 'OpenRouter' ? '/api/proxy/models/openrouter' : provider === 'Gemini' ? `/api/proxy/models/gemini?key=${apiKeys.Gemini}` : `/api/proxy/models/opencode?key=${apiKeys.Opencode}`;
        const resp = await fetch(modelUrl);
        const data = await resp.json();
        
        if (provider === 'OpenRouter') {
          if (data.data) {
            available = data.data
              .sort((a: any, b: any) => {
                const aFree = a.pricing.prompt === '0' && a.pricing.completion === '0';
                const bFree = b.pricing.prompt === '0' && b.pricing.completion === '0';
                return aFree === bFree ? 0 : aFree ? -1 : 1;
              })
              .map((m: any) => m.id);
          }
        } else if (provider === 'Opencode') {
          if (data.models) {
            available = data.models.map((m: any) => m.id);
          }
        } else {
          if (data.models) {
            available = data.models
              .filter((m: any) => m.supportedGenerationMethods.includes('generateContent'))
              .map((m: any) => m.name.replace('models/', ''));
          }
        }
      } catch (err) {
        console.error("Gagal mengambil model via backend:", err);
      }
      // ... sisa fallback
      if (available.length === 0) {
        if (provider === 'Gemini') available = ['gemini-1.5-flash', 'gemini-1.5-pro', 'gemini-2.0-flash', 'gemini/gemini-3.1-flash-lite-preview'];
        else if (provider === 'OpenRouter') available = ['google/gemini-2.0-flash-exp:free', 'deepseek/deepseek-v4-flash:free', 'meta-llama/llama-3.2-3b-instruct:free', 'mistralai/mistral-7b-instruct:free'];
        else if (provider === 'Opencode') available = ['deepseek-v4-flash', 'deepseek-v4-flash-free', 'gemini-3.5-flash', 'gemini-3.1-pro', 'claude-sonnet-4', 'gpt-5.4-mini'];
      }
      
      setModels(available);
      if (!available.includes(model)) setModel(available[0] || '');
      setIsFetchingModels(false);
    };
    fetchModels();
  }, [provider, apiKeys.Gemini, apiKeys.Opencode]);

  const filteredModels = models.filter(m => m.toLowerCase().includes(modelSearch.toLowerCase()));

  const handleSave = () => {
    localStorage.setItem('selectedProvider', provider);
    localStorage.setItem('selectedModel', model);
    localStorage.setItem('api-key-Gemini', apiKeys.Gemini);
    localStorage.setItem('api-key-OpenRouter', apiKeys.OpenRouter);
    localStorage.setItem('api-key-Opencode', apiKeys.Opencode);
    showNotification('success', 'Konfigurasi berhasil disimpan!');
    window.dispatchEvent(new CustomEvent('ai-status-changed'));
  };

  return (
    <div className="max-w-lg mx-auto mt-8 p-6 border border-slate-800 rounded-xl bg-slate-900/60 text-left">
      <h2 className="text-lg font-semibold text-slate-100 flex items-center gap-2 mb-4">
        <Key className="w-5 h-5 text-amber-400" /> Konfigurasi AI Provider
      </h2>
      
      <div className="grid grid-cols-1 gap-4 mb-6">
        <div className="space-y-1.5">
          <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold">Provider</label>
          <select
            value={provider}
            onChange={e => {
              setProvider(e.target.value as any);
              setModel('');
              setModelSearch('');
            }}
            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-[#D4AF37]"
          >
            <option value="Gemini">Gemini</option>
            <option value="OpenRouter">OpenRouter</option>
            <option value="Opencode">Opencode</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold">Model AI</label>
            {isFetchingModels && <span className="text-[9px] font-mono text-amber-500 animate-pulse">Menarik data...</span>}
          </div>
          
          <div className="relative mb-2">
            <input 
              type="text"
              placeholder="Cari model (e.g. gemini, llama, free)..."
              value={modelSearch}
              onChange={(e) => setModelSearch(e.target.value)}
              className="w-full text-[11px] bg-slate-950 border border-slate-800 rounded-lg p-2 text-slate-300 focus:outline-none focus:border-[#D4AF37]/50"
            />
          </div>

          <select
            value={model}
            onChange={e => setModel(e.target.value)}
            className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-[#D4AF37]"
            size={filteredModels.length > 10 ? 6 : undefined}
          >
            {filteredModels.length > 0 ? (
              filteredModels.map(m => <option key={m} value={m}>{m}</option>)
            ) : (
              <option disabled>Tidak ada model ditemukan</option>
            )}
          </select>
          <p className="text-[9px] text-slate-500 font-mono mt-1 italic">
            {filteredModels.length} model tersedia dari {provider}.
          </p>
        </div>
      </div>

      <div className="space-y-3 mb-6">
        {Object.entries(apiKeys).map(([key, val]) => (
          <div key={key}>
            <label className="block text-[11px] font-mono uppercase text-slate-400 font-bold mb-1">API Key {key}</label>
            <input
              type="password"
              value={val}
              onChange={e => setApiKeys({...apiKeys, [key]: e.target.value})}
              placeholder={`Masukkan ${key} key`}
              className="w-full text-xs bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-[#D4AF37]"
            />
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-[#D4AF37]/20 hover:bg-[#D4AF37]/30 text-[#D4AF37] border border-[#D4AF37]/30 font-medium py-2.5 px-4 rounded-lg text-xs transition flex items-center justify-center gap-2"
      >
        <Save className="w-4 h-4" /> Simpan Konfigurasi
      </button>
    </div>
  );
}
