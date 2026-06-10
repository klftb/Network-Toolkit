import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { PingTool } from './components/PingTool';
import { PortScanner } from './components/PortScanner';
import { SubnetCalc } from './components/SubnetCalc';
import { WhoisTool } from './components/WhoisTool';
import { PublicIP } from './components/PublicIP';
import { SpeedTest } from './components/SpeedTest';
import { TracertTool } from './components/TracertTool';
import { HistoryTool } from './components/HistoryTool';
import { BatchGenTool } from './components/BatchGenTool';
import { TemplatesTool } from './components/TemplatesTool';
import { ExcalidrawTool } from './components/ExcalidrawTool';
import { DnsTool } from './components/DnsTool';
import { TftpTool } from './components/TftpTool';
import { FtpTool } from './components/FtpTool';
import { WifiTool } from './components/WifiTool';
import { TextDiffTool } from './components/TextDiffTool';
import { PasswordTool } from './components/PasswordTool';
import { SettingsTool } from './components/SettingsTool';
import { ToolId } from './types';
import { Network, Activity, ShieldCheck, Zap, Route, Wand2, PenTool, Database, FileCode, Clock, Server, Download, GitCompare, Wifi, KeyRound, Settings } from 'lucide-react';

export default function App() {
  const [currentTool, setCurrentTool] = useState<ToolId>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [recentTools, setRecentTools] = useState<ToolId[]>([]);
  const [visitedTools, setVisitedTools] = useState<Set<ToolId>>(new Set(['dashboard']));

  useEffect(() => {
    setVisitedTools(prev => {
      const next = new Set(prev);
      next.add(currentTool);
      return next;
    });
  }, [currentTool]);

  useEffect(() => {
    const saved = localStorage.getItem('recentTools');
    if (saved) {
      try {
        setRecentTools(JSON.parse(saved));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  const handleSetTool = (tool: ToolId) => {
    if (tool !== 'dashboard' && tool !== 'history') { // exclude full dashboard or history if needed, but maybe history is fine to exclude from "tools". Actually just exclude dashboard
      const updated = [tool, ...recentTools.filter(t => t !== tool)].slice(0, 3);
      setRecentTools(updated);
      localStorage.setItem('recentTools', JSON.stringify(updated));
    }
    setCurrentTool(tool);
  };

  return (
    <div className="flex h-screen bg-[#F6F6F6] font-sans text-slate-900 overflow-hidden">
      <Sidebar 
        currentTool={currentTool} 
        setCurrentTool={handleSetTool} 
        isOpen={isSidebarOpen} 
        setIsOpen={setIsSidebarOpen} 
      />
      
      {/* Overlay for mobile sidebar */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <main className="flex-1 h-screen overflow-y-auto w-full relative">
        <div className="max-w-7xl mx-auto p-4 md:p-8 pt-16 md:pt-8 h-full">
          {visitedTools.has('ping') && <div style={{ display: currentTool === 'ping' ? 'block' : 'none', height: '100%' }}><PingTool /></div>}
          {visitedTools.has('tracert') && <div style={{ display: currentTool === 'tracert' ? 'block' : 'none', height: '100%' }}><TracertTool /></div>}
          {visitedTools.has('portscan') && <div style={{ display: currentTool === 'portscan' ? 'block' : 'none', height: '100%' }}><PortScanner /></div>}
          {visitedTools.has('subnet') && <div style={{ display: currentTool === 'subnet' ? 'block' : 'none', height: '100%' }}><SubnetCalc /></div>}
          {visitedTools.has('whois') && <div style={{ display: currentTool === 'whois' ? 'block' : 'none', height: '100%' }}><WhoisTool /></div>}
          {visitedTools.has('myip') && <div style={{ display: currentTool === 'myip' ? 'block' : 'none', height: '100%' }}><PublicIP /></div>}
          {visitedTools.has('speedtest') && <div style={{ display: currentTool === 'speedtest' ? 'block' : 'none', height: '100%' }}><SpeedTest /></div>}
          {visitedTools.has('batchgen') && <div style={{ display: currentTool === 'batchgen' ? 'block' : 'none', height: '100%' }}><BatchGenTool /></div>}
          {visitedTools.has('templates') && <div style={{ display: currentTool === 'templates' ? 'block' : 'none', height: '100%' }}><TemplatesTool /></div>}
          {visitedTools.has('excalidraw') && <div style={{ display: currentTool === 'excalidraw' ? 'block' : 'none', height: '100%' }}><ExcalidrawTool /></div>}
          {visitedTools.has('dns') && <div style={{ display: currentTool === 'dns' ? 'block' : 'none', height: '100%' }}><DnsTool /></div>}
          {visitedTools.has('tftp') && <div style={{ display: currentTool === 'tftp' ? 'block' : 'none', height: '100%' }}><TftpTool /></div>}
          {visitedTools.has('ftp') && <div style={{ display: currentTool === 'ftp' ? 'block' : 'none', height: '100%' }}><FtpTool /></div>}
          {visitedTools.has('wifi') && <div style={{ display: currentTool === 'wifi' ? 'block' : 'none', height: '100%' }}><WifiTool /></div>}
          {visitedTools.has('textdiff') && <div style={{ display: currentTool === 'textdiff' ? 'block' : 'none', height: '100%' }}><TextDiffTool /></div>}
          {visitedTools.has('password') && <div style={{ display: currentTool === 'password' ? 'block' : 'none', height: '100%' }}><PasswordTool /></div>}
          {visitedTools.has('settings') && <div style={{ display: currentTool === 'settings' ? 'block' : 'none', height: '100%' }}><SettingsTool /></div>}
          {visitedTools.has('history') && <div style={{ display: currentTool === 'history' ? 'block' : 'none', height: '100%' }}><HistoryTool setCurrentTool={handleSetTool} /></div>}
          <div style={{ display: (currentTool === 'dashboard' || !currentTool) ? 'block' : 'none', height: '100%' }}>
            <Dashboard setCurrentTool={handleSetTool} recentTools={recentTools} />
          </div>
        </div>
      </main>
    </div>
  );
}

function Dashboard({ setCurrentTool, recentTools }: { setCurrentTool: (t: ToolId) => void, recentTools: ToolId[] }) {
  const cards = [
    { id: 'ping', title: '连通性分析', desc: '测试服务器网络可达性与通信延迟，支持 ICMP/TCP 协议。', icon: <Network className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'tracert', title: '路由追踪', desc: '检测数据包经过的路由节点，排查拥塞跳数，支持连续诊断。', icon: <Route className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'portscan', title: '端口扫描', desc: '快速检测目标主机的常见端口开放状态，支持范围扫描。', icon: <ShieldCheck className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'subnet', title: '子网掩码计算', desc: '计算 IPv4 网段的可用 IP 范围、广播地址等参数规划。', icon: <Activity className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'speedtest', title: '网络测速', desc: '测试当前客户端与服务器之间的上下行带宽性能。', icon: <Zap className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'dns', title: 'DNS公网地址', desc: '批量检测国内外主流公网DNS，支持端到端解析性能测试。', icon: <Database className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'batchgen', title: '文本批处理', desc: '基于变量模板的文本批量生成与过滤替换。', icon: <Wand2 className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'templates', title: '配置模板', desc: '交换机命令及Nginx/Docker配置查询与动态生成。', icon: <FileCode className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'excalidraw', title: '白板草图', desc: '离线画板工具，用于快速记录网络拓扑或架构草图。', icon: <PenTool className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'tftp', title: 'TFTP', desc: '基于 UDP 的简单文件传输协议服务端与客户端。', icon: <Server className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'ftp', title: 'FTP', desc: '连接 FTP 服务器进行文件操作或作为服务端提供访问。', icon: <Download className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'wifi', title: 'Wi-Fi 信号', desc: '测试周围的 Wi-Fi 信号强度、信道，生成建筑覆盖热力图。', icon: <Wifi className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'textdiff', title: '配置文本比对', desc: '快速对比两个配置文件的差异，支持高亮显示修改细节。', icon: <GitCompare className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
    { id: 'password', title: '密码管理工具', desc: '生成高强度且可定制的密码，并在本地安全记录和管理您的账号和密码。', icon: <KeyRound className="w-[24px] h-[24px] text-[#4A4A4A]" /> },
  ];

  const recentCards = recentTools.map(id => cards.find(c => c.id === id)).filter(Boolean) as typeof cards;

  return (
    <div className="pt-2 pb-8 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">欢迎使用 Network Toolkit</h1>
        <p className="text-[14px] text-[#8E8E93] mt-3 font-medium">选择下方工具卡片或左侧菜单开始使用。</p>
      </div>

      {recentCards.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-slate-500" />
            <h2 className="text-[16px] font-semibold text-slate-700">最近使用</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {recentCards.map(card => (
              <div 
                key={card.id}
                onClick={() => setCurrentTool(card.id as ToolId)}
                className="group cursor-pointer p-4 bg-white rounded-[16px] border border-slate-100 flex items-center gap-3 transition-all hover:border-emerald-200"
              >
                <div className="p-2 bg-emerald-50 rounded-xl text-emerald-600">
                  {card.icon && React.cloneElement(card.icon as any, { className: 'w-5 h-5 text-emerald-600' })}
                </div>
                <div>
                  <h3 className="text-[14px] font-[600] text-slate-800 tracking-tight">{card.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-[16px] font-semibold text-slate-700 mb-4">全部工具</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map(card => (
            <div 
              key={card.id}
              onClick={() => setCurrentTool(card.id as ToolId)}
              className="group cursor-pointer p-6 bg-white rounded-[16px] border-none text-left"
              style={{ 
                boxShadow: '0 6px 30px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.03)',
                transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)' 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 12px 40px rgba(0, 0, 0, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 30px rgba(0, 0, 0, 0.02), 0 1px 2px rgba(0, 0, 0, 0.03)';
              }}
            >
              <div className="flex flex-col">
                <div className="flex items-center gap-3 mb-2.5">
                  <div className="flex-shrink-0">
                    {card.icon}
                  </div>
                  <h3 className="text-[16px] font-[600] text-slate-800 tracking-tight">{card.title}</h3>
                </div>
                <p className="text-[13px] text-[#8E8E93] leading-[1.5]">{card.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
