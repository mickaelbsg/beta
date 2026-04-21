import { Activity, Database, RefreshCw, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

interface DashboardViewProps {
  status: any;
  techLogs: any[];
  onRefresh: () => void;
}

export function DashboardView({ status, techLogs, onRefresh }: DashboardViewProps) {
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-white">Dashboard Overview</h2>
          <p className="text-slate-400 text-sm mt-1">Monitoramento em tempo real do sistema Beta.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Card */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-6 rounded-2xl shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-xl">
              <Activity className="text-blue-500" size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Status do Sistema</p>
              <p className="text-2xl font-black text-green-500 tracking-tight">ONLINE</p>
            </div>
          </div>
        </div>

        {/* Vault Card */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-6 rounded-2xl shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <Database className="text-purple-500" size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Obsidian Vault</p>
              <p className={cn(
                "text-2xl font-black tracking-tight",
                status?.obsidian?.exists ? "text-purple-400" : "text-red-500"
              )}>
                {status?.obsidian?.exists ? 'CONECTADO' : 'ERRO'}
              </p>
            </div>
          </div>
        </div>

        {/* Uptime Card */}
        <div className="bg-slate-900/80 backdrop-blur border border-slate-800 p-6 rounded-2xl shadow-sm hover:border-slate-700 transition-colors">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-xl">
              <RefreshCw className="text-orange-500" size={24} />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-1">Uptime</p>
              <div className="flex items-baseline gap-1">
                <p className="text-2xl font-black text-white tracking-tight">{Math.floor(status?.uptime / 60) || 0}</p>
                <span className="text-slate-500 font-medium">min</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-slate-900/80 backdrop-blur rounded-2xl border border-slate-800 overflow-hidden shadow-lg mt-8">
        <div className="p-5 border-b border-slate-800/80 flex justify-between items-center bg-slate-900/50">
          <h3 className="font-bold text-white flex items-center gap-2">
            <Terminal size={18} className="text-slate-400" /> 
            Logs Recentes
          </h3>
          <button 
            onClick={onRefresh} 
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-all active:scale-95"
            title="Atualizar logs"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-950/40 text-slate-400 border-b border-slate-800/80">
              <tr>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Timestamp</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Evento</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Provedor</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Latência</th>
                <th className="p-4 font-semibold text-xs tracking-wider uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {techLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500 italic">
                    Nenhum log encontrado.
                  </td>
                </tr>
              ) : techLogs.slice(0, 8).map((log, i) => (
                <tr key={i} className="hover:bg-slate-800/40 transition-colors group">
                  <td className="p-4 text-slate-500 font-mono text-xs">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </td>
                  <td className="p-4 font-medium text-slate-300 group-hover:text-white transition-colors">
                    {log.intent}
                  </td>
                  <td className="p-4 text-slate-400">
                    <span className="bg-slate-800 px-2 py-1 rounded-md text-xs">
                      {log.executor?.provider || 'N/A'}
                    </span>
                  </td>
                  <td className="p-4 text-slate-400 font-mono text-xs">
                    {log.latency_ms}ms
                  </td>
                  <td className="p-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-md text-[10px] uppercase font-bold tracking-wider",
                      log.errors 
                        ? "bg-red-500/10 text-red-500 border border-red-500/20" 
                        : "bg-green-500/10 text-green-500 border border-green-500/20"
                    )}>
                      {log.errors ? 'Falha' : 'Sucesso'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
