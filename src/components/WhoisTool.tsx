import React, { useState } from 'react';
import { Search, Download } from 'lucide-react';
import { downloadReport } from '../lib/utils';
import { addHistory } from '../lib/history';
import { ToolComponentProps } from '../types';

export function WhoisTool({ onExportReady }: ToolComponentProps) {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    
    setLoading(true);
    setResult(null);
    try {
      const response = await fetch(`/api/whois?target=${encodeURIComponent(target)}`);
      const data = await response.json();
      setResult(data.result);
      
      const domainMatch = data.result.match(/Domain Name: (.*?)\n/i) || [];
      const orgMatch = data.result.match(/(Registrant Organization|Organization): (.*?)\n/i) || [];
      const org = orgMatch[2] ? orgMatch[2].trim() : (domainMatch[1] ? domainMatch[1].trim() : '已找到');
      
      addHistory({
        toolId: 'whois',
        toolName: 'Whois 查询',
        target: target,
        summary: `查询成功，结果: ${org.substring(0, 30)}`
      });
    } catch (error) {
      setResult("查询失败，请检查网络或稍后重试。");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    if (!result) return;
    downloadReport('Whois', `=== WHOIS 报告: ${target} ===\n\n${result}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-slate-800">Whois 查询</h2>
        <button 
          onClick={handleExport}
          disabled={!result}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-[rgba(0,0,0,0.02)] border-none rounded-xl hover:bg-[rgba(0,0,0,0.05)] transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> 导出报告
        </button>
      </div>

      <div className="sub-card p-6">
        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-4 mb-2">
          <input 
            type="text" 
            value={target}
            onChange={e => setTarget(e.target.value)}
            placeholder="输入域名或 IP 地址 (例如: google.com)"
            className="flex-1 px-4 py-2.5 border-none rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none bg-[rgba(0,0,0,0.02)] text-slate-800 text-[13px]"
          />
          <button 
            type="submit"
            disabled={loading || !target}
            className="flex items-center justify-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-[600] text-[13px] hover:bg-slate-700 disabled:opacity-50 transition-colors border-none"
          >
            {loading ? <span className="animate-spin text-xl">⟳</span> : <Search className="w-4 h-4" />}
            {loading ? '查询中...' : '查询 Whois'}
          </button>
        </form>
      </div>

      {(result || loading) && (
        <div className="sub-card overflow-hidden mt-4">
          <div className="bg-[rgba(0,0,0,0.02)] px-6 py-4 border-b border-[rgba(0,0,0,0.05)] flex items-center justify-between">
             <span className="text-[11px] font-[600] tracking-wider font-mono text-slate-500 uppercase">WHOIS DATA RECORD</span>
          </div>
          <div className="p-6 font-mono text-[13px] max-h-[600px] overflow-y-auto bg-[#F9F9F9] text-left">
             {loading ? (
               <div className="text-[#8E8E93] animate-pulse">正在从 whois 服务器提取数据...</div>
             ) : (
               <pre className="text-slate-800 whitespace-pre-wrap">{result}</pre>
             )}
          </div>
        </div>
      )}
    </div>
  );
}
