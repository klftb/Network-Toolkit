import React, { useState } from 'react';
import { Play, Download, Activity, BarChart2, Wifi, Info } from 'lucide-react';
import { cn, downloadReport } from '../lib/utils';
import { addHistory } from '../lib/history';
import { ToolComponentProps } from '../types';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

interface PingHistoryPoint {
  seq: number;
  timeLabel: string;
  latency?: number;
  alive: boolean;
  raw: string;
}

export function PingTool({ onExportReady }: ToolComponentProps) {
  const [target, setTarget] = useState('google.com');
  const [protocol, setProtocol] = useState<'icmp' | 'tcp' | 'udp'>('icmp');
  const [port, setPort] = useState('80');
  
  // New parameters
  const [count, setCount] = useState('5');
  const [size, setSize] = useState('56');
  const [speed, setSpeed] = useState('1000'); // Interval in ms
  
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{timestamp: string, output: string, alive: boolean}[]>([]);
  const [pingHistory, setPingHistory] = useState<PingHistoryPoint[]>([]);
  
  const activeEventSource = React.useRef<EventSource | null>(null);

  React.useEffect(() => {
    return () => {
      if (activeEventSource.current) {
        activeEventSource.current.close();
      }
    };
  }, []);

  // Helper to extract latency from backend printout strings
  const extractLatency = (line: string): number | undefined => {
    const match = line.match(/time=([\d\.]+)\s*(?:ms)?/i);
    if (match && match[1]) {
      const val = parseFloat(match[1]);
      return !isNaN(val) ? val : undefined;
    }
    return undefined;
  };

  const handleStop = () => {
    if (activeEventSource.current) {
      activeEventSource.current.close();
      activeEventSource.current = null;
    }
    setLoading(false);
  };

  const handlePing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;
    
    setLoading(true);
    setResults([]); // Clear previous terminal results
    setPingHistory([]); // Clear previous chart/stat results
    
    if (activeEventSource.current) {
      activeEventSource.current.close();
    }
    
    try {
      const qs = new URLSearchParams({ target, protocol, port, count, size, speed });
      const eventSource = new EventSource(`/api/ping-stream?${qs.toString()}`);
      activeEventSource.current = eventSource;
      
      let successCount = 0;

      eventSource.onmessage = (event) => {
          const data = JSON.parse(event.data);
          
          if (data.type === 'start') {
              setResults(prev => [...prev, {
                  timestamp: new Date().toLocaleTimeString(),
                  output: data.message,
                  alive: true
              }]);
          } else if (data.type === 'output') {
              const isAlive = data.alive !== undefined ? data.alive : true;
              if (isAlive) successCount++;
              
              const parsedLatency = extractLatency(data.line);

              setPingHistory(prev => {
                const seqMatch = data.line.match(/(?:icmp_seq|seq|tcp_seq)=([0-9]+)/i);
                const seq = seqMatch && seqMatch[1] ? parseInt(seqMatch[1], 10) : (prev.length + 1);
                
                return [...prev, {
                  seq,
                  timeLabel: new Date().toLocaleTimeString(),
                  latency: isAlive && parsedLatency !== undefined ? parsedLatency : undefined,
                  alive: isAlive,
                  raw: data.line
                }];
              });

              setResults(prev => [...prev, {
                  timestamp: new Date().toLocaleTimeString(),
                  output: data.line,
                  alive: isAlive
              }]);
          } else if (data.type === 'error') {
              const parsedLatency = extractLatency(data.line);
              
              setPingHistory(prev => {
                const seqMatch = data.line.match(/(?:icmp_seq|seq|tcp_seq)=([0-9]+)/i);
                const seq = seqMatch && seqMatch[1] ? parseInt(seqMatch[1], 10) : (prev.length + 1);
                return [...prev, {
                  seq,
                  timeLabel: new Date().toLocaleTimeString(),
                  latency: parsedLatency,
                  alive: false,
                  raw: data.line
                }];
              });

              setResults(prev => [...prev, {
                  timestamp: new Date().toLocaleTimeString(),
                  output: data.line,
                  alive: false
              }]);
          } else if (data.type === 'close') {
              eventSource.close();
              setLoading(false);
              setResults(prev => [...prev, {
                  timestamp: new Date().toLocaleTimeString(),
                  output: `Ping finished.`,
                  alive: true
              }]);
              addHistory({
                toolId: 'ping',
                toolName: 'Ping 测试',
                target: target,
                summary: `协议: ${protocol.toUpperCase()}, 连通次数: ${successCount}`
              });
          }
      };
      
      eventSource.onerror = (err) => {
         eventSource.close();
         setLoading(false);
         setResults(prev => [...prev, {
             timestamp: new Date().toLocaleTimeString(),
             output: `Stream Error`,
             alive: false
         }]);
      };
    } catch (err: any) {
      setResults(prev => [...prev, {
        timestamp: new Date().toLocaleTimeString(),
        output: `Error: ${err.message}`,
        alive: false
      }]);
      setLoading(false);
    }
  };

  const handleExport = () => {
    const content = `=== Ping / TCPing Report ===\n` +
      `Target: ${target}\nProtocol: ${protocol.toUpperCase()}${protocol === 'tcp' ? ` (Port: ${port})` : ''}\n\n` +
      results.map(r => `[${r.timestamp}] [${r.alive ? 'OK' : 'FAIL'}]\n${r.output}\n---`).join('\n');
    downloadReport('Ping', content);
  };

  // Compile real-time diagnostic indicators
  const parsedLatencies = pingHistory
    .map(p => p.latency)
    .filter((l): l is number => l !== undefined);

  const totalPackets = pingHistory.length;
  const receivedPackets = pingHistory.filter(p => p.alive).length;
  const lossRate = totalPackets > 0 ? Math.round(((totalPackets - receivedPackets) / totalPackets) * 100) : 0;

  const minLatency = parsedLatencies.length > 0 ? Math.min(...parsedLatencies).toFixed(1) : '-';
  const maxLatency = parsedLatencies.length > 0 ? Math.max(...parsedLatencies).toFixed(1) : '-';
  const avgLatency = parsedLatencies.length > 0 
    ? (parsedLatencies.reduce((sum, val) => sum + val, 0) / parsedLatencies.length).toFixed(1) 
    : '-';

  return (
    <div className="space-y-6">
      {/* Title block */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-slate-800">Ping 工具</h2>
          <p className="text-xs text-slate-500 mt-1">发起到指定目标服务器或域名的 ICMP、TCPing、UDPing 主动网络握手嗅探，实时计算耗时趋势。</p>
        </div>
        <button 
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.05)] rounded-xl transition-colors cursor-pointer border-none"
        >
          <Download className="w-4 h-4" /> 导出报告
        </button>
      </div>

      {/* Configuration Form */}
      <div className="sub-card p-6">
        <form onSubmit={handlePing} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-[13px] font-[600] text-slate-700">目标地址 (IP 或 域名)</label>
              <input 
                type="text" 
                value={target}
                onChange={e => setTarget(e.target.value)}
                placeholder="例如: 8.8.8.8 或 google.com"
                className="w-full px-4 py-2 border-none rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none bg-[rgba(0,0,0,0.02)] text-slate-800 text-[13px]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[13px] font-[600] text-slate-700">协议类型</label>
              <select 
                value={protocol}
                onChange={e => setProtocol(e.target.value as 'icmp' | 'tcp' | 'udp')}
                className="w-full px-4 py-2 border-none rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none bg-[rgba(0,0,0,0.02)] text-slate-800 text-[13px]"
              >
                <option value="icmp">ICMP Ping</option>
                <option value="tcp">TCPing</option>
                <option value="udp">UDPing</option>
              </select>
            </div>
            {(protocol === 'tcp' || protocol === 'udp') && (
              <div className="space-y-1.5">
                <label className="text-[13px] font-[600] text-slate-700">端口</label>
                <input 
                  type="number" 
                  value={port}
                  onChange={e => setPort(e.target.value)}
                  placeholder="80"
                  className="w-full px-4 py-2 border-none rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none bg-[rgba(0,0,0,0.02)] text-slate-800 text-[13px]"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[13px] font-[600] text-slate-700">Ping 次数</label>
              <input 
                type="number" 
                value={count}
                onChange={e => setCount(e.target.value)}
                min="1" max="65535"
                className="w-full px-4 py-2 border-none rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none bg-[rgba(0,0,0,0.02)] text-slate-800 text-[13px]"
              />
            </div>
            {protocol === 'icmp' && (
              <div className="space-y-1.5">
                <label className="text-[13px] font-[600] text-slate-700">包大小 (Bytes)</label>
                <input 
                  type="number" 
                  value={size}
                  onChange={e => setSize(e.target.value)}
                  className="w-full px-4 py-2 border-none rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none bg-[rgba(0,0,0,0.02)] text-slate-800 text-[13px]"
                />
              </div>
            )}
            <div className="space-y-1.5">
              <label className="text-[13px] font-[600] text-slate-700">间隔时间 (ms)</label>
              <select 
                value={speed}
                onChange={e => setSpeed(e.target.value)}
                className="w-full px-4 py-2 border-none rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none bg-[rgba(0,0,0,0.02)] text-slate-800 text-[13px]"
              >
                <option value="100">极速 (100ms)</option>
                <option value="200">快速 (200ms)</option>
                <option value="500">常规 (500ms)</option>
                <option value="1000">标准 (1000ms)</option>
                <option value="2000">缓慢 (2000ms)</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              type="submit"
              disabled={loading || !target}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors cursor-pointer text-[13px] border-none"
            >
              {loading ? <span className="animate-spin text-lg">⟳</span> : <Play className="w-4 h-4" />}
              {loading ? '网络包测试中...' : '开始 Ping'}
            </button>
            {loading && (
              <button 
                type="button"
                onClick={handleStop}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-500/10 text-red-600 rounded-xl font-medium hover:bg-red-500/20 transition-colors cursor-pointer text-[13px] border-none"
              >
                <div className="w-3 h-3 bg-red-600 rounded-sm"></div>
                停止
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Latency Diagnostic KPI Indicators */}
      {pingHistory.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="sub-card p-4.5 flex items-center gap-4">
            <div className="flex-shrink-0 text-slate-700">
              <Activity className="w-[24px] h-[24px]" />
            </div>
            <div>
              <span className="text-[13px] text-[#8E8E93] font-[600] block">平均时延</span>
              <span className="text-xl font-bold font-mono text-slate-800">
                {avgLatency} <span className="text-xs font-normal text-slate-400">ms</span>
              </span>
            </div>
          </div>
          
          <div className="sub-card p-4.5 flex items-center gap-4">
            <div className="flex-shrink-0 text-slate-700">
              <Play className="w-[24px] h-[24px] rotate-90" />
            </div>
            <div>
              <span className="text-[13px] text-[#8E8E93] font-[600] block">最小时延</span>
              <span className="text-xl font-bold font-mono text-slate-800">
                {minLatency} <span className="text-xs font-normal text-slate-400">ms</span>
              </span>
            </div>
          </div>

          <div className="sub-card p-4.5 flex items-center gap-4">
            <div className="flex-shrink-0 text-slate-700">
              <Play className="w-[24px] h-[24px] -rotate-90" />
            </div>
            <div>
              <span className="text-[13px] text-[#8E8E93] font-[600] block">最大时延</span>
              <span className="text-xl font-bold font-mono text-slate-800">
                {maxLatency} <span className="text-xs font-normal text-slate-400">ms</span>
              </span>
            </div>
          </div>

          <div className="sub-card p-4.5 flex items-center gap-4">
            <div className={cn(
              "flex-shrink-0",
              lossRate > 0 ? "text-red-500" : "text-emerald-500"
            )}>
              <Wifi className="w-[24px] h-[24px]" />
            </div>
            <div>
              <span className="text-[13px] text-[#8E8E93] font-[600] block">丢包率</span>
              <span className="text-xl font-bold font-mono text-slate-800">
                {lossRate}% <span className="text-xs font-normal text-slate-400">({totalPackets - receivedPackets}/{totalPackets})</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Latency Area Trend Chart from Recharts */}
      <div className="sub-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-[600] text-slate-800 flex items-center gap-2">
            <BarChart2 className="w-4.5 h-4.5 text-slate-700 animate-pulse" />
            延迟趋势实时绘图 (Latency Trend Chart)
          </h3>
          {pingHistory.length > 0 && (
            <span className="text-xs text-slate-400 font-mono">
              目标: {target} | 协议: {protocol.toUpperCase()}
            </span>
          )}
        </div>
        
        <div className="h-64 sm:h-76 w-full flex items-center justify-center">
          {pingHistory.length === 0 ? (
            <div className="text-center space-y-2">
              <Activity className="w-10 h-10 text-slate-300 mx-auto animate-pulse" />
              <p className="text-sm text-slate-500 font-semibold">等待 Ping 测试数据...</p>
              <p className="text-xs text-slate-400">发起 Ping 操作后，此处将高保真绘制时延抖动曲线</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={pingHistory}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="seq" 
                  tickLine={false}
                  axisLine={false}
                  stroke="#94a3b8" 
                  fontSize={11}
                  tickFormatter={(seq) => `第 ${seq} 次`}
                />
                <YAxis 
                  tickLine={false}
                  axisLine={false}
                  stroke="#94a3b8" 
                  fontSize={11}
                  unit="ms"
                  domain={[0, 'auto']}
                />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload as PingHistoryPoint;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-xl border border-slate-800 shadow-lg text-xs space-y-1 font-sans">
                          <div className="font-bold text-slate-300">第 {data.seq} 次测试</div>
                          <div className="text-slate-400 font-mono">{data.timeLabel}</div>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className={cn(
                              "w-2 h-2 rounded-full",
                              data.alive ? "bg-emerald-500" : "bg-rose-500"
                            )} />
                            <span>
                              状态: <span className={data.alive ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>{data.alive ? '成功' : '失败/超时'}</span>
                            </span>
                          </div>
                          {data.alive && data.latency !== undefined && (
                            <div className="text-indigo-300 font-bold mt-0.5 text-[13px]">
                              延迟: <span className="text-base font-mono stroke-2">{data.latency}</span> ms
                            </div>
                          )}
                          <div className="text-[10px] text-slate-400 font-mono mt-1 pt-1 border-t border-slate-800 max-w-xs truncate">
                            {data.raw}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="latency" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorLatency)" 
                  dot={{ r: 3, strokeWidth: 1.5, fill: "#ffffff", stroke: "#6366f1" }}
                  activeDot={{ r: 5, strokeWidth: 0, fill: "#4f46e5" }}
                  connectNulls={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Terminal View Output */}
      <div className="sub-card overflow-hidden">
        <div className="bg-[rgba(0,0,0,0.02)] px-6 py-4 flex items-center border-b border-[rgba(0,0,0,0.05)]">
          <div className="flex gap-2">
            <div className="w-3 h-3 rounded-full bg-red-400"></div>
            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-400"></div>
          </div>
          <span className="ml-4 text-[11px] font-[600] tracking-wider font-mono text-slate-500 uppercase">Terminal Output</span>
        </div>
        <div className="p-6 font-mono text-[13px] max-h-[400px] overflow-y-auto space-y-2 bg-[#F9F9F9] text-left">
           {results.length === 0 ? (
            <div className="text-[#8E8E93]">等待执行... </div>
          ) : (
            results.map((r, i) => (
              <div key={i} className="text-slate-800">
                <span className="text-[#8E8E93]">[{r.timestamp}]</span>{' '}
                <span className={r.alive ? 'text-emerald-600' : 'text-rose-500'}>
                  {r.output.split('\n').map((line, idx) => (
                    <React.Fragment key={idx}>{line}<br/></React.Fragment>
                  ))}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

