import { CheckCircle2, AlertCircle, Save, Database } from 'lucide-react';
import { cn } from '../../lib/utils';

interface ConfigViewProps {
  config: any;
  setConfig: (config: any) => void;
  onSave: () => void;
  loading: boolean;
  saveStatus: string | null;
}

export function ConfigView({ config, setConfig, onSave, loading, saveStatus }: ConfigViewProps) {
  if (!config) return <div className="animate-pulse text-slate-500">Carregando configurações...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-end mb-8 sticky top-0 bg-slate-950/80 backdrop-blur-md py-4 z-10 border-b border-slate-800">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Configurações</h2>
          <p className="text-slate-400 text-sm mt-1">Gerencie chaves de API e comportamentos do sistema.</p>
        </div>
        <div className="flex items-center gap-4">
          {saveStatus === 'success' && (
            <span className="text-green-500 flex items-center gap-1.5 text-sm font-medium animate-in slide-in-from-right-4">
              <CheckCircle2 size={16} /> Salvo com sucesso!
            </span>
          )}
          {saveStatus === 'error' && (
            <span className="text-red-500 flex items-center gap-1.5 text-sm font-medium animate-in slide-in-from-right-4">
              <AlertCircle size={16} /> Erro ao salvar
            </span>
          )}
          <button
            onClick={onSave}
            disabled={loading}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <Save size={18} /> {loading ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2">Provedores de IA</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {config?.providers?.map((p: any, idx: number) => (
            <div key={p.id} className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-sm hover:border-slate-700 transition-colors group">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]",
                    p.enabled ? "bg-green-500 shadow-green-500/50" : "bg-slate-600"
                  )} />
                  <h3 className="font-bold text-lg text-white">{p.name}</h3>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded-md uppercase font-bold tracking-wider">
                    {p.type}
                  </span>
                </div>
                
                {/* Custom Toggle Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={p.enabled}
                    onChange={(e) => {
                      const newProviders = [...config.providers];
                      newProviders[idx].enabled = e.target.checked;
                      setConfig({ ...config, providers: newProviders });
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-slate-300 peer-checked:after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600 border border-slate-700"></div>
                </label>
              </div>

              <div className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 uppercase font-bold tracking-wider ml-1">API Key</label>
                  <input
                    type="password"
                    value={p.apiKey}
                    onChange={(e) => {
                      const newProviders = [...config.providers];
                      newProviders[idx].apiKey = e.target.value;
                      setConfig({ ...config, providers: newProviders });
                    }}
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    placeholder="sk-..."
                  />
                </div>

                {p.type === 'omniroute' && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-2">
                    <label className="text-xs text-slate-400 uppercase font-bold tracking-wider ml-1">Base URL</label>
                    <input
                      type="text"
                      value={p.baseUrl}
                      onChange={(e) => {
                        const newProviders = [...config.providers];
                        newProviders[idx].baseUrl = e.target.value;
                        setConfig({ ...config, providers: newProviders });
                      }}
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                      placeholder="https://api.omniroute.io/v1"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6 pt-6">
        <h3 className="text-lg font-bold text-white border-b border-slate-800 pb-2 flex items-center gap-2">
          <Database size={18} className="text-blue-500" />
          Estratégia de Fallback (Roteamento)
        </h3>
        
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6">
          <p className="text-sm text-slate-400 mb-6">O ActionLayer tentará executar as requisições na ordem definida abaixo. Em caso de falha de conexão ou rate-limit, o sistema tentará o próximo automaticamente.</p>

          <div className="space-y-3">
            {config?.models?.sort((a: any, b: any) => a.priority - b.priority).map((m: any, idx: number) => (
              <div key={m.id} className="flex items-center gap-4 bg-slate-950/80 p-4 rounded-xl border border-slate-800/80 hover:border-slate-700 transition-colors">
                <div className="bg-slate-800 text-slate-300 w-8 h-8 rounded-lg flex items-center justify-center font-black shadow-inner shadow-black/50">
                  {idx + 1}
                </div>
                <div className="flex-1 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-white">{m.name}</p>
                    <p className="text-xs text-slate-500 uppercase tracking-widest mt-0.5">{m.providerId}</p>
                  </div>
                  <span className={cn(
                    "text-[10px] px-3 py-1 rounded-md font-bold tracking-wider uppercase border",
                    m.isFallback 
                      ? "bg-orange-500/10 text-orange-400 border-orange-500/20" 
                      : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                  )}>
                    {m.isFallback ? 'Fallback' : 'Principal'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
