import { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { DashboardView } from './components/views/DashboardView';
import { ConfigView } from './components/views/ConfigView';
import { api } from './lib/api';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [config, setConfig] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [techLogs, setTechLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [configRes, statusRes, logsRes] = await Promise.all([
        api.get('/config'),
        api.get('/status'),
        api.get('/logs/technical?limit=50')
      ]);
      setConfig(configRes.data);
      setStatus(statusRes.data);
      setTechLogs(logsRes.data);
    } catch (err) {
      console.error('Error fetching data:', err);
    }
  };

  const handleSaveConfig = async () => {
    setLoading(true);
    try {
      await api.post('/config', config);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus(null), 3000);
    } catch (err) {
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden font-sans selection:bg-blue-500/30">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 p-10 overflow-y-auto relative bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900/50">
        {activeTab === 'dashboard' && (
          <DashboardView 
            status={status} 
            techLogs={techLogs} 
            onRefresh={fetchData} 
          />
        )}
        
        {activeTab === 'config' && (
          <ConfigView 
            config={config} 
            setConfig={setConfig} 
            onSave={handleSaveConfig} 
            loading={loading} 
            saveStatus={saveStatus} 
          />
        )}
        
        {activeTab === 'logs' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-white">System Logs</h2>
              <p className="text-slate-400 text-sm mt-1">Histórico completo de execução técnica em tempo real.</p>
            </div>
            
            <div className="bg-slate-900/80 backdrop-blur rounded-2xl border border-slate-800 p-6 shadow-lg">
              <div className="font-mono text-xs overflow-y-auto max-h-[70vh] space-y-3 pr-2 custom-scrollbar">
                {techLogs.length === 0 ? (
                  <div className="text-slate-500 italic">Aguardando logs...</div>
                ) : techLogs.map((log, i) => (
                  <div key={i} className="flex flex-col sm:flex-row sm:gap-4 border-b border-slate-800/50 pb-3 hover:bg-slate-800/20 p-2 rounded transition-colors">
                    <span className="text-slate-500 whitespace-nowrap mb-1 sm:mb-0">
                      {new Date(log.timestamp).toISOString()}
                    </span>
                    <span className={`font-bold uppercase tracking-wider shrink-0 ${log.errors ? 'text-red-500' : 'text-blue-500'}`}>
                      [{log.intent}]
                    </span>
                    <span className="text-slate-400 break-all leading-relaxed">
                      {JSON.stringify(log.executor)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
