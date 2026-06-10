import React, { useState } from 'react';
import { Gauge, Download, ArrowDown, ArrowUp, Globe, Server, CheckCircle2, RefreshCw, Activity, Laptop, Wifi, ShieldCheck, ShieldAlert } from 'lucide-react';
import { downloadReport, cn } from '../lib/utils';
import { addHistory } from '../lib/history';
import { ToolComponentProps } from '../types';

export function SpeedTest({ onExportReady }: ToolComponentProps) {
  const [activeTab, setActiveTab] = useState<'bandwidth' | 'website'>('bandwidth');
  const [testNode, setTestNode] = useState<string>('telecom');

  // Website Diagnostic State
  const [webTesting, setWebTesting] = useState(false);
  const [webResults, setWebResults] = useState<{
    id: string;
    name: string;
    host: string;
    port: number;
    category: "domestic" | "global";
    alive?: boolean;
    latency?: number;
    error?: string;
  }[]>([]);

  const startWebsiteTest = async () => {
    setWebTesting(true);
    setWebResults([]);
    try {
      const resp = await fetch('/api/website-test');
      if (resp.ok) {
        const data = await resp.json();
        setWebResults(data.results || []);

        const domesticAlive = (data.results || []).filter((r: any) => r.category === 'domestic' && r.alive).length;
        const globalAlive = (data.results || []).filter((r: any) => r.category === 'global' && r.alive).length;
        addHistory({
          toolId: 'speedtest-web',
          toolName: '常用网站连通性',
          target: '国内外常用网站及云服务',
          summary: `国内畅通 ${domesticAlive}/5，国外及云业务 ${globalAlive}/6`
        });
      } else {
        alert('无法获取测试数据，请稍后重试');
      }
    } catch (err: any) {
      alert('连接诊断服务端失败: ' + err.message);
    } finally {
      setWebTesting(false);
    }
  };

  const handleExport = () => {
    if (activeTab === 'website') {
      if (webResults.length === 0) {
        alert('没有连通性检测结果，请先开始诊断。');
        return;
      }
      let report = `=== 常用网站与多云业务联通性诊断报告 ===\n` +
        `生成时间: ${new Date().toLocaleString()}\n\n` +
        `=== 总体连通状态 ===\n` +
        `国内主流网站: ${webResults.filter(w => w.category === 'domestic' && w.alive).length} / ${webResults.filter(w => w.category === 'domestic').length} 正常\n` +
        `多云及M365服务: ${webResults.filter(w => w.category === 'global' && w.alive).length} / ${webResults.filter(w => w.category === 'global').length} 正常\n\n` +
        `=== 各网站/服务诊断细节 ===\n`;

      webResults.forEach(res => {
        report += `[${res.category === 'domestic' ? '国内主流' : '多云/MS'}] ${res.name} (${res.host}): ` +
          `${res.alive ? `正常 / 握手耗时: ${res.latency}ms` : `异常 / 原因: ${res.error || '超时'}`}\n`;
      });
      downloadReport('WebsiteConnectivityReport', report);
    }
  };

  // Helper latency color styling
  const getLatencyStyle = (ms?: number) => {
    if (ms === undefined) return { badge: "bg-slate-100 text-slate-500", text: "text-slate-400" };
    if (ms < 50) return { badge: "bg-emerald-500/10 text-emerald-700 border border-emerald-250/30", text: "text-emerald-600 font-bold" };
    if (ms < 150) return { badge: "bg-teal-500/10 text-teal-700 border border-teal-200/50", text: "text-teal-600" };
    if (ms < 300) return { badge: "bg-amber-500/10 text-amber-700 border border-amber-250/30", text: "text-amber-600" };
    return { badge: "bg-rose-500/10 text-rose-700 border border-rose-250", text: "text-rose-600 font-semibold" };
  };

  const domesticList = webResults.filter(w => w.category === 'domestic');
  const globalList = webResults.filter(w => w.category === 'global');

  const domesticAliveCount = domesticList.filter(w => w.alive).length;
  const globalAliveCount = globalList.filter(w => w.alive).length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">网络测速与联通分析 (Speed Test & Site Health)</h2>
          <p className="text-xs text-slate-500 mt-1">支持宽带、延迟测速，以及国内核心网站、海外公有云/M365等多维度网络感知诊断。</p>
        </div>
        <button 
          onClick={handleExport}
          disabled={activeTab === 'bandwidth' || webResults.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-700 bg-[rgba(0,0,0,0.02)] border-none rounded-xl hover:bg-[rgba(0,0,0,0.05)] transition-colors disabled:opacity-50 shadow-xs"
        >
          <Download className="w-4 h-4 text-slate-500" /> 导出报告
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-none bg-slate-50/50 p-1.5 rounded-xl">
        <button
          onClick={() => setActiveTab('bandwidth')}
          className={cn(
            "flex-1 md:flex-initial px-6 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-150 flex items-center justify-center gap-2 border-none",
            activeTab === 'bandwidth'
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800 bg-transparent"
          )}
        >
          <Gauge className="w-4 h-4" /> 宽带速率测试
        </button>
        <button
          onClick={() => setActiveTab('website')}
          className={cn(
            "flex-1 md:flex-initial px-6 py-2.5 text-[13px] font-semibold rounded-xl transition-all duration-150 flex items-center justify-center gap-2 border-none",
            activeTab === 'website'
              ? "bg-white text-indigo-600 shadow-sm"
              : "text-slate-500 hover:text-slate-800 bg-transparent"
          )}
        >
          <Globe className="w-4 h-4" /> 网页及公有云连通性诊断
        </button>
      </div>

      {activeTab === 'bandwidth' ? (
        <div className="sub-card flex flex-col flex-1 overflow-hidden min-h-[650px] bg-slate-50 relative">
          
          <div className="flex border-b border-slate-200 bg-white px-4 py-3 items-center justify-between shadow-sm z-10 relative">
             <div className="flex items-center gap-2">
                <Server className="w-5 h-5 text-indigo-500" />
                <span className="font-semibold text-slate-800">内嵌测速引擎</span>
             </div>
             
             <div className="flex items-center gap-3">
                <span className="text-[13px] text-slate-500 font-medium">当前测速节点:</span>
                <div className="relative">
                    <select 
                       value={testNode}
                       onChange={(e) => {
                          const extSites: Record<string, string> = {
                              'speedtest': 'https://www.speedtest.net/',
                              'nju': 'https://test.nju.edu.cn/',
                              'ustc': 'https://test.ustc.edu.cn/',
                              'neu': 'https://speed.neu.edu.cn/'
                          };
                          if (extSites[e.target.value]) {
                              window.open(extSites[e.target.value], '_blank');
                          } else {
                              setTestNode(e.target.value);
                          }
                       }}
                       className="appearance-none bg-slate-100 border border-slate-200 text-slate-700 py-1.5 pl-3 pr-8 rounded-lg text-[13px] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow cursor-pointer min-w-[200px]"
                    >
                       <optgroup label="国内测速 (Domestic)">
                          <option value="telecom">中国电信 (上海节点) - 官方</option>
                          <option value="nju">🚀 南京大学 (NJU) - 教育网 (外部新窗口)</option>
                          <option value="ustc">🚀 中科大 (USTC) - 教育网 (外部新窗口)</option>
                          <option value="neu">🚀 东北大学 (NEU) - 教育网 (外部新窗口)</option>
                       </optgroup>
                       <optgroup label="国际/港澳台 (Global)">
                          <option value="librespeed">LibreSpeed - 全球开源节点</option>
                          <option value="ntu">台湾大学 (NTU Taiwan)</option>
                          <option value="speedtest">🚀 Ookla Speedtest (外部新窗口)</option>
                       </optgroup>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                      <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                    </div>
                </div>
             </div>
          </div>

          <div className="flex-1 w-full relative bg-slate-100">
             {testNode === 'telecom' && <iframe src="http://netreport.sh.189.cn/speed/index.html#/" className="w-full h-full border-none absolute inset-0" sandbox="allow-scripts allow-same-origin allow-forms" title="电信测速" />}
             {testNode === 'librespeed' && <iframe src="https://librespeed.org/" className="w-full h-full border-none absolute inset-0" sandbox="allow-scripts allow-same-origin allow-forms" title="LibreSpeed" />}
             {testNode === 'ntu' && <iframe src="http://speed5.ntu.edu.tw/speed5/" className="w-full h-full border-none absolute inset-0" sandbox="allow-scripts allow-same-origin allow-forms" title="台湾大学测速" />}
          </div>
        </div>
      ) : (
        /* Website health diagnostic view */
        <div className="space-y-6 animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Diagnostic overview cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="sub-card p-5 flex items-center gap-4">
              <div className="p-3 bg-[rgba(0,0,0,0.02)] rounded-xl text-slate-700">
                <Laptop className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-[#8E8E93] font-bold font-mono tracking-wider block">DOMESTIC NETWORK</span>
                <h4 className="text-[13px] font-[600] text-slate-800">国内主流网站连通性</h4>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-slate-800">
                    {webResults.length > 0 ? `${domesticAliveCount}/${domesticList.length}` : '--'}
                  </span>
                  {webResults.length > 0 && (
                    <span className="text-[12px] text-slate-500">
                      平均耗时: {Math.round(domesticList.filter(d => d.alive && d.latency !== undefined).reduce((acc, current) => acc + (current.latency || 0), 0) / (domesticList.filter(d => d.alive).length || 1))}ms
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="sub-card p-5 flex items-center gap-4">
              <div className="p-3 bg-[rgba(0,0,0,0.02)] rounded-xl text-slate-700">
                <Globe className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-[#8E8E93] font-bold font-mono tracking-wider block">GLOBAL CLOUD & OFFICE</span>
                <h4 className="text-[13px] font-[600] text-slate-800">公有云 & M365 状态</h4>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-slate-800">
                    {webResults.length > 0 ? `${globalAliveCount}/${globalList.length}` : '--'}
                  </span>
                  {webResults.length > 0 && (
                    <span className="text-[12px] text-slate-500">
                      平均耗时: {Math.round(globalList.filter(g => g.alive && g.latency !== undefined).reduce((acc, current) => acc + (current.latency || 0), 0) / (globalList.filter(g => g.alive).length || 1))}ms
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="sub-card p-5 flex items-center gap-4">
              <div className="p-3 bg-[rgba(0,0,0,0.02)] rounded-xl text-slate-700">
                <Wifi className="w-6 h-6" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] text-[#8E8E93] font-bold font-mono tracking-wider block">DIAGNOSTIC STATUS</span>
                <h4 className="text-[13px] font-[600] text-slate-800">当前诊断引擎状态</h4>
                <div className="mt-1">
                  {webTesting ? (
                    <span className="text-xs font-semibold text-slate-800 flex items-center gap-1.5 animate-pulse mt-2">
                      <span className="w-2 h-2 rounded-full bg-slate-800 animate-ping"></span>
                      握手建连探测中...
                    </span>
                  ) : webResults.length > 0 ? (
                    <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1 mt-2">
                      <CheckCircle2 className="w-4 h-4" />
                      探测已就绪
                    </span>
                  ) : (
                    <span className="text-xs text-[#8E8E93] mt-2 block">
                      等待触发一键检测
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Start test action bar */}
          <div className="bg-[rgba(0,0,0,0.02)] border-none rounded-xl p-6 flex items-center justify-between flex-wrap gap-4">
            <div className="space-y-1">
              <h4 className="text-[13px] font-[600] text-slate-800">国内网站与国外多云业务双向握手诊断 (443 / 53)</h4>
              <p className="text-[12px] text-[#8E8E93]">
                系统使用服务端高并发网络握手模型，精准捕捉应用级 TCP 通信建连用时，相比被封禁的 ICMP 更有参考价值。
              </p>
            </div>
            <button
              onClick={startWebsiteTest}
              disabled={webTesting}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white font-[500] rounded-xl hover:bg-slate-700 transition-all disabled:opacity-50 text-[13px] cursor-pointer shadow-xs active:scale-95 border-none"
            >
              {webTesting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  正在测试中...
                </>
              ) : (
                <>
                  <Activity className="w-4 h-4 animate-pulse" />
                  一键开始网站/多云服务检测
                </>
              )}
            </button>
          </div>

          {/* Side-by-side results */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Section 1: China Mainstream Sites */}
            <div className="sub-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <span className="text-[13px] font-[600] text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                  国内主流核心网站
                </span>
                <span className="text-[11px] text-[#8E8E93]">检测标准端口: 443 (HTTPS)</span>
              </div>
              <div className="divide-y divide-slate-100">
                {webResults.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    {webTesting ? "正在准备发起国内建连请求..." : "尚未检测。请点击上方按钮触发。"}
                  </div>
                ) : (
                  domesticList.map(res => {
                    const latStyle = getLatencyStyle(res.latency);
                    return (
                      <div key={res.id} className="p-4 flex items-center justify-between hover:bg-[rgba(0,0,0,0.02)] transition-colors">
                        <div className="space-y-0.5">
                          <h5 className="text-[13px] font-[600] text-slate-800">{res.name}</h5>
                          <p className="text-[11px] text-[#8E8E93] font-mono">{res.host}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Connection Status Badge */}
                          {res.alive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-[600] bg-emerald-50 text-emerald-800 border border-emerald-100">
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                              在线 (Active)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-[600] bg-rose-50 text-rose-800 border border-rose-200">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                              异常 (Error)
                            </span>
                          )}

                          {/* Latency Badge */}
                          <span className={cn("px-2.5 py-1 text-[11px] font-mono font-bold rounded-md min-w-[70px] text-center", latStyle.badge)}>
                            {res.alive && res.latency !== undefined ? `${res.latency} ms` : 'Offline'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Section 2: Global Big Tech Cloud / M365 */}
            <div className="sub-card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                <span className="text-[13px] font-[600] text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 bg-slate-800 rounded-full"></span>
                  国外基础设施 & M365 办公云
                </span>
                <span className="text-[11px] text-[#8E8E93]">检测标准端口: 443 / 53</span>
              </div>
              <div className="divide-y divide-slate-100">
                {webResults.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-xs italic">
                    {webTesting ? "正在准备发起多云建连请求..." : "尚未检测。请点击上方按钮触发。"}
                  </div>
                ) : (
                  globalList.map(res => {
                    const latStyle = getLatencyStyle(res.latency);
                    return (
                      <div key={res.id} className="p-4 flex items-center justify-between hover:bg-[rgba(0,0,0,0.02)] transition-colors">
                        <div className="space-y-0.5">
                          <h5 className="text-[13px] font-[600] text-slate-800">{res.name}</h5>
                          <p className="text-[11px] text-[#8E8E93] font-mono">{res.host}:{res.port}</p>
                        </div>
                        <div className="flex items-center gap-4">
                          {/* Connection Status Badge */}
                          {res.alive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-[600] bg-slate-50 text-slate-800 border border-slate-200">
                              <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                              良好 (Normal)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-[600] bg-rose-50 text-rose-800 border border-rose-200">
                              <ShieldAlert className="w-3.5 h-3.5 text-rose-650" />
                              超时 / 阻断
                            </span>
                          )}

                          {/* Latency Badge */}
                          <span className={cn("px-2.5 py-1 text-[11px] font-mono font-bold rounded-md min-w-[70px] text-center", latStyle.badge)}>
                            {res.alive && res.latency !== undefined ? `${res.latency} ms` : 'Offline'}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
