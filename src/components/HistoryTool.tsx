import React, { useEffect, useState } from 'react';
import { getHistory, HistoryEntry, clearHistory } from '../lib/history';
import { Trash2, Clock, Globe, Search, ShieldCheck, Activity, Zap, Route, Network, MapPin } from 'lucide-react';
import { ToolId } from '../types';

interface HistoryToolProps {
  setCurrentTool: (t: ToolId) => void;
}

export function HistoryTool({ setCurrentTool }: HistoryToolProps) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(getHistory());
    const handleUpdate = () => setHistory(getHistory());
    window.addEventListener('history_updated', handleUpdate);
    return () => window.removeEventListener('history_updated', handleUpdate);
  }, []);

  const handleClear = () => {
    if (confirm('确定要清空所有本机测试记录吗？')) {
      clearHistory();
    }
  };

  const getIcon = (toolId: string) => {
    switch(toolId) {
      case 'ping': return <Network className="w-4 h-4 text-indigo-500" />;
      case 'tracert': return <Route className="w-4 h-4 text-sky-500" />;
      case 'portscan': return <ShieldCheck className="w-4 h-4 text-emerald-500" />;
      case 'subnet': return <Activity className="w-4 h-4 text-orange-500" />;
      case 'whois': return <Globe className="w-4 h-4 text-blue-500" />;
      case 'speedtest': return <Zap className="w-4 h-4 text-purple-500" />;
      case 'myip': return <MapPin className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="sub-card overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-[rgba(0,0,0,0.05)] flex justify-between items-center bg-[rgba(0,0,0,0.02)]">
        <div>
          <h2 className="text-[14px] font-[600] text-slate-800 flex items-center gap-2">
            <Clock className="w-5 h-5 text-slate-700" />
            测试记录追踪
          </h2>
          <p className="text-[11px] text-[#8E8E93] mt-1">本地保存的最近网络测试历史</p>
        </div>
        {history.length > 0 && (
          <button 
            onClick={handleClear}
            className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 px-3 py-1.5 rounded-[6px] text-[11px] font-[600] transition-colors flex items-center gap-2 border-none"
          >
            <Trash2 className="w-3.5 h-3.5" /> 清空记录
          </button>
        )}
      </div>

      <div className="p-0">
        {history.length === 0 ? (
          <div className="p-12 text-center text-[#8E8E93]">
            <Clock className="w-12 h-12 mx-auto mb-3 opacity-20" />
            <p className="text-[13px]">暂无测试记录</p>
          </div>
        ) : (
          <ul className="divide-y divide-[rgba(0,0,0,0.05)]">
            {history.map(entry => (
              <li key={entry.id} className="p-4 hover:bg-[rgba(0,0,0,0.02)] transition-colors flex flex-col md:flex-row md:items-center gap-4 group">
                <div className="flex-1 flex items-start gap-4">
                  <div className="mt-1 bg-white p-2 rounded-[6px] shadow-xs border border-[rgba(0,0,0,0.05)]">
                    {getIcon(entry.toolId)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-[600] text-slate-800">{entry.toolName}</span>
                      <span className="text-[10px] text-[#8E8E93] bg-[rgba(0,0,0,0.04)] px-2 py-0.5 rounded-[4px] font-mono">
                        {new Date(entry.timestamp).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-[13px] font-mono text-slate-600 mt-1.5">
                      目标: {entry.target || 'N/A'}
                    </div>
                    <div className="text-[11px] text-[#8E8E93] mt-1 line-clamp-2">
                      {entry.summary}
                    </div>
                  </div>
                </div>
                <div>
                  <button 
                    onClick={() => setCurrentTool(entry.toolId as ToolId)}
                    className="text-[11px] font-[600] text-slate-700 bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.05)] border-none px-4 py-2 rounded-[6px] transition-colors opacity-0 group-hover:opacity-100"
                  >
                    再次测试
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
