import { LayoutDashboard, Settings, Terminal } from 'lucide-react';
import { cn } from '../../lib/utils';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'config', label: 'Configurações', icon: Settings },
    { id: 'logs', label: 'Logs do Sistema', icon: Terminal },
  ];

  return (
    <aside className="w-64 border-r border-slate-800 p-6 flex flex-col gap-8 bg-slate-950/50 backdrop-blur-xl">
      <div className="flex items-center gap-3 px-2">
        <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center font-black text-xl italic shadow-lg shadow-blue-500/20">β</div>
        <div>
          <h1 className="font-black text-lg tracking-tighter">BETA <span className="text-blue-500">ADMIN</span></h1>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">v0.3.0</p>
        </div>
      </div>

      <nav className="flex flex-col gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                isActive 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" 
                  : "text-slate-400 hover:bg-slate-900 hover:text-white"
              )}
            >
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto bg-slate-900/50 p-4 rounded-xl border border-slate-800/50">
        <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Sessão Ativa</p>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-slate-300">Conectado ao Localhost</span>
        </div>
      </div>
    </aside>
  );
}
