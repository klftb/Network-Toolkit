import React, { useState, useEffect, useRef } from 'react';
import { Route as RouteIcon, Download, Play, Square, AlertCircle } from 'lucide-react';
import { downloadReport, cn } from '../lib/utils';
import { addHistory } from '../lib/history';
import { ToolComponentProps } from '../types';

interface HopData {
  id: number;
  ip: string;
  host?: string;
  rtt1?: string;
  rtt2?: string;
  rtt3?: string;
  // MTR stats
  sent: number;
  lost: number;
  loss: number; // percentage
  best?: number;
  avg?: number;
  worst?: number;
  last?: number;
}

export function TracertTool({ onExportReady }: ToolComponentProps) {
  const [target, setTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [mtrMode, setMtrMode] = useState(false);
  const [hops, setHops] = useState<HopData[]>([]);
  const [runningMtr, setRunningMtr] = useState(false);

  const hopsRef = useRef<HopData[]>([]);
  const mtrIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    hopsRef.current = hops;
  }, [hops]);

  // Clean up MTR interval on unmount
  useEffect(() => {
    return () => stopMtr();
  }, []);

  const handleTrace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    
    stopMtr();
    setLoading(true);
    setHops([]);
    
    try {
      const eventSource = new EventSource(`/api/traceroute?target=${encodeURIComponent(target)}`);
      
      let finalHopsCount = 0;

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'hop') {
           const h = data.hop;
           setHops(prev => {
             const newHop: HopData = {
               id: h.hop || prev.length + 1,
               ip: h.ip || '*',
               host: h.host || (h.ip ? undefined : '*'),
               rtt1: h.rtt1,
               rtt2: h.rtt2,
               rtt3: h.rtt3,
               sent: h.ip && h.ip !== '*' ? 3 : 0,
               lost: 0,
               loss: 0,
               best: h.ip && h.rtt1 ? parseFloat(h.rtt1) : undefined,
               avg: h.ip && h.rtt1 ? parseFloat(h.rtt1) : undefined,
               worst: h.ip && h.rtt1 ? parseFloat(h.rtt1) : undefined,
               last: h.ip && h.rtt1 ? parseFloat(h.rtt1) : undefined,
             };
             
             const next = [...prev];
             const idx = next.findIndex(x => x.id === newHop.id);
             if (idx > -1) {
                 next[idx] = newHop;
             } else {
                 next.push(newHop);
                 next.sort((a,b) => a.id - b.id);
             }
             finalHopsCount = next.length;
             return next;
           });
        } else if (data.type === 'close') {
           eventSource.close();
           setLoading(false);
           // Trim empty hops trailing at the end if the route reached destination early
           if (data.maxHopReached) {
              setHops(prev => {
                const pruned = prev.filter(h => h.id <= data.maxHopReached);
                finalHopsCount = pruned.length;
                return pruned;
              });
           }
           if (mtrMode) {
              setTimeout(() => {
                 startMtr();
              }, 100);
           }
           
           addHistory({
             toolId: 'tracert',
             toolName: mtrMode ? 'MTR诊断' : '路由追踪',
             target: target,
             summary: `追踪完成，共经过 ${finalHopsCount} 跳`
           });
        } else if (data.type === 'error') {
           console.warn("MTR Error:", data.error);
           eventSource.close();
           setLoading(false);
           setHops(prev => {
              const errHop = { id: prev.length + 1, ip: '', host: data.error, sent: 0, lost: 100, loss: 100 };
              return [...prev, errHop];
           });
        }
      };

      eventSource.onerror = (err) => {
         console.warn("SSE Error:", err);
         eventSource.close();
         setLoading(false);
      };
    } catch (err: any) {
      console.warn("Trace error:", err);
      setLoading(false);
    }
  };

  const startMtr = () => {
    setRunningMtr(true);
    if (mtrIntervalRef.current) clearInterval(mtrIntervalRef.current);
    mtrIntervalRef.current = setInterval(async () => {
      // For each hop with a valid IP, ping it
      const currentHops = hopsRef.current;
      
      for (let i = 0; i < currentHops.length; i++) {
         const hop = currentHops[i];
         if (hop.ip === '*' || !hop.ip) continue;
         
         try {
            const resp = await fetch('/api/ping', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ target: hop.ip, protocol: 'icmp' })
            });
            const data = await resp.json();
            
            setHops(prev => {
               const newHops = [...prev];
               const targetHop = { ...newHops[i] };
               
               targetHop.sent += 1;
               if (!data.alive) {
                  // Packet lost
                  targetHop.lost += 1;
                  targetHop.loss = (targetHop.lost / targetHop.sent) * 100;
               } else {
                  // Packet received
                  const rtt = parseFloat(data.time) || 1; // 1 if <1ms
                  targetHop.last = rtt;
                  
                  if (targetHop.best === undefined || rtt < targetHop.best) targetHop.best = rtt;
                  if (targetHop.worst === undefined || rtt > targetHop.worst) targetHop.worst = rtt;
                  
                  // Moving average approx
                  if (targetHop.avg === undefined) {
                     targetHop.avg = rtt;
                  } else {
                     targetHop.avg = ((targetHop.avg * (targetHop.sent - 1)) + rtt) / targetHop.sent;
                  }
                  
                  // Recalculate loss
                  targetHop.loss = (targetHop.lost / targetHop.sent) * 100;
               }
               
               newHops[i] = targetHop;
               return newHops;
            });
         } catch(e) {
            // Ignore fetch errors during MTR continuous loop
         }
      }
    }, 1500); // ping every 1.5s
  };

  const stopMtr = () => {
    if (mtrIntervalRef.current) clearInterval(mtrIntervalRef.current);
    setRunningMtr(false);
  };

  const handleExport = () => {
    const header = mtrMode 
        ? `HS\\tHost\\tSucc%\\tLoss%\\tSnt\\tLast\\tAvg\\tBest\\tWorst` 
        : `Hop\\tIP Address\\tHost\\tRTT1\\tRTT2\\tRTT3`;
    
    const rows = hops.map(h => {
        if (mtrMode) {
            return `${h.id}\\t${h.ip}\\t${(100 - h.loss).toFixed(1)}%\\t${h.loss.toFixed(1)}%\\t${h.sent}\\t${h.last !== undefined ? h.last.toFixed(1) : '*'}\\t${h.avg !== undefined ? h.avg.toFixed(1) : '*'}\\t${h.best !== undefined ? h.best.toFixed(1) : '*'}\\t${h.worst !== undefined ? h.worst.toFixed(1) : '*'}`;
        } else {
            return `${h.id}\\t${h.ip}\\t${h.host || ''}\\t${h.rtt1 || '*'}\\t${h.rtt2 || '*'}\\t${h.rtt3 || '*'}`;
        }
    });

    const report = `=== ${mtrMode ? 'MTR' : 'TraceRoute'} Report ===\\nTarget: ${target}\\nTime: ${new Date().toLocaleString()}\\n\\n${header}\\n${rows.join('\\n')}`;
    downloadReport(mtrMode ? 'MTR' : 'TraceRoute', report);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-slate-800">路由追踪 (Tracert / MTR)</h2>
        <button 
          onClick={handleExport}
          disabled={hops.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-[rgba(0,0,0,0.02)] border-none rounded-xl hover:bg-[rgba(0,0,0,0.05)] transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> 导出报告
        </button>
      </div>

      <div className="bg-indigo-50 border-none text-indigo-800 p-4 rounded-xl flex gap-3 text-sm">
         <AlertCircle className="w-5 h-5 flex-shrink-0 text-indigo-500" />
         <p>
            <strong>提示：</strong>由于云端执行环境（NAT/防火墙）的网络限制，可能会拦截 ICMP TTL 超时响应导致链路中间节点无法显示 IP（全部为 <code>*</code>）。目标主机的直接探测仍可连通。建议在本地客户端使用 MTR / Tracert 获取完整的路由拓扑。
         </p>
      </div>

      <div className="sub-card p-6">
        <form onSubmit={handleTrace} className="space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="md:w-1/2 space-y-1.5">
              <label className="text-[13px] font-[600] text-slate-700">目标地址 (IP 或 域名)</label>
              <input 
                type="text" 
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="例如: 8.8.8.8 或 google.com"
                className="w-full px-4 py-2.5 border-none rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none bg-[rgba(0,0,0,0.02)] text-slate-800 text-[13px]"
              />
            </div>
            
            <div className="space-y-1.5 flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer h-10 px-4 py-2 border-none rounded-xl hover:bg-[rgba(0,0,0,0.03)] bg-[rgba(0,0,0,0.01)] text-[13px]">
                <input 
                  type="checkbox" 
                  checked={mtrMode} 
                  onChange={(e) => setMtrMode(e.target.checked)}
                  className="rounded border-slate-300 text-slate-800 focus:ring-indigo-500"
                />
                <span className="text-[13px] font-[500] text-slate-700">启用连续诊断 (MTR / WinMTR 模式)</span>
              </label>
            </div>
          </div>
          
          <div className="flex gap-3 pt-2">
             <button 
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors text-[13px] border-none"
             >
                {loading ? <span className="animate-spin text-xl">⟳</span> : <Play className="w-4 h-4" />}
                {loading ? '路由追踪探测中...' : '开始追踪'}
             </button>

             {mtrMode && runningMtr && (
                <button 
                  type="button"
                  onClick={stopMtr}
                  className="flex items-center gap-2 px-6 py-2.5 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors text-[13px] border-none"
               >
                  <Square className="w-4 h-4" fill="currentColor" />
                  停止连续诊断
               </button>
             )}
          </div>
        </form>
      </div>

      <div className="sub-card overflow-hidden min-h-[300px]">
         <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
               <thead className="text-xs text-slate-500 uppercase bg-[#EAEAEA] border-none">
                  <tr>
                     <th className="px-6 py-3">Hop</th>
                     <th className="px-6 py-3 w-1/3">Host / IP</th>
                     {mtrMode ? (
                        <>
                           <th className="px-4 py-3 text-right">Succ%</th>
                           <th className="px-4 py-3 text-right">Loss%</th>
                           <th className="px-4 py-3 text-right">Sent</th>
                           <th className="px-4 py-3 text-right">Last</th>
                           <th className="px-4 py-3 text-right">Avg</th>
                           <th className="px-4 py-3 text-right">Best</th>
                           <th className="px-4 py-3 text-right">Worst</th>
                        </>
                     ) : (
                        <>
                           <th className="px-6 py-3">RTT 1</th>
                           <th className="px-6 py-3">RTT 2</th>
                           <th className="px-6 py-3">RTT 3</th>
                        </>
                     )}
                  </tr>
               </thead>
               <tbody>
                  {hops.length === 0 ? (
                     <tr>
                        <td colSpan={mtrMode ? 8 : 5} className="px-6 py-10 text-center text-slate-500">
                           {loading ? '正在获取链路节点列表...' : '等待开始探测'}
                        </td>
                     </tr>
                  ) : (
                     hops.map((hop, i) => (
                        <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                           <td className="px-6 py-3 font-mono text-slate-500">{hop.id}</td>
                           <td className="px-6 py-3">
                              <div className="font-mono font-medium text-slate-800">{hop.ip}</div>
                              {hop.host && hop.host !== hop.ip && hop.host !== '*' && (
                                 <div className="text-xs text-slate-500 truncate max-w-xs" title={hop.host}>{hop.host}</div>
                              )}
                           </td>
                           {mtrMode ? (
                              <>
                                 <td className={cn(
                                    "px-4 py-3 text-right font-mono",
                                    hop.loss < 100 ? "text-green-600 font-medium" : "text-slate-600"
                                 )}>
                                    {(hop.ip === '*' || !hop.ip) ? '-' : `${(100 - hop.loss).toFixed(1)}%`}
                                 </td>
                                 <td className={cn(
                                    "px-4 py-3 text-right font-mono",
                                    hop.loss > 0 ? (hop.loss > 10 ? "text-red-500 font-medium" : "text-orange-500") : "text-slate-600"
                                 )}>
                                    {(hop.ip === '*' || !hop.ip) ? '(Timeout)' : `${hop.loss.toFixed(1)}%`}
                                 </td>
                                 <td className="px-4 py-3 text-right font-mono text-slate-600">{hop.sent || '-'}</td>
                                 <td className="px-4 py-3 text-right font-mono text-slate-900">{hop.last !== undefined ? `${hop.last.toFixed(0)} ms` : '-'}</td>
                                 <td className="px-4 py-3 text-right font-mono text-slate-600">{hop.avg !== undefined ? `${hop.avg.toFixed(1)}` : '-'}</td>
                                 <td className="px-4 py-3 text-right font-mono text-slate-600">{hop.best !== undefined ? `${hop.best.toFixed(1)}` : '-'}</td>
                                 <td className="px-4 py-3 text-right font-mono text-slate-600">{hop.worst !== undefined ? `${hop.worst.toFixed(1)}` : '-'}</td>
                              </>
                           ) : (
                              <>
                                 <td className="px-6 py-3 font-mono text-slate-600">{hop.rtt1 ? `${hop.rtt1} ms` : '*'}</td>
                                 <td className="px-6 py-3 font-mono text-slate-600">{hop.rtt2 ? `${hop.rtt2} ms` : '*'}</td>
                                 <td className="px-6 py-3 font-mono text-slate-600">{hop.rtt3 ? `${hop.rtt3} ms` : '*'}</td>
                              </>
                           )}
                        </tr>
                     ))
                  )}
               </tbody>
            </table>
         </div>
         {loading && (
             <div className="h-1 w-full bg-indigo-50 overflow-hidden">
                <div className="h-full bg-indigo-500 animate-pulse" style={{ width: '100%', animationDuration: '1s', animationIterationCount: 'infinite' }}></div>
             </div>
         )}
      </div>

    </div>
  );
}
