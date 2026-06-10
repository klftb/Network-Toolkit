import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Search, 
  Network, 
  MapPin, 
  Globe, 
  Gauge,
  Menu,
  Route,
  X,
  History,
  Wand2,
  PenTool,
  Database,
  FileCode,
  ChevronLeft,
  ChevronRight,
  Server,
  Download,
  GitCompare,
  Wifi,
  KeyRound,
  Settings
} from 'lucide-react';
import { ToolId } from '../types';
import { cn } from '../lib/utils';

interface SidebarProps {
  currentTool: ToolId;
  setCurrentTool: (tool: ToolId) => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export function Sidebar({ currentTool, setCurrentTool, isOpen, setIsOpen }: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('sidebarCollapsed');
    if (saved === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  const handleToggleCollapse = () => {
    const newVal = !isCollapsed;
    setIsCollapsed(newVal);
    localStorage.setItem('sidebarCollapsed', String(newVal));
  };

  const menuItems: { id: ToolId; label: string; icon: React.ReactNode }[] = [
    { id: 'dashboard', label: '仪表盘', icon: <Activity className="w-5 h-5" /> },
    { id: 'ping', label: 'Ping / TCPing', icon: <Network className="w-5 h-5" /> },
    { id: 'tracert', label: '路由追踪 (MTR)', icon: <Route className="w-5 h-5" /> },
    { id: 'portscan', label: 'IP/端口扫描', icon: <Search className="w-5 h-5" /> },
    { id: 'subnet', label: 'IP 掩码计算', icon: <Activity className="w-5 h-5" /> },
    { id: 'myip', label: 'IP地址归属', icon: <MapPin className="w-5 h-5" /> },
    { id: 'whois', label: 'Whois 查询', icon: <Globe className="w-5 h-5" /> },
    { id: 'speedtest', label: '网络测速', icon: <Gauge className="w-5 h-5" /> },
    { id: 'dns', label: 'DNS公网地址', icon: <Database className="w-5 h-5" /> },
    { id: 'batchgen', label: '文本批处理', icon: <Wand2 className="w-5 h-5" /> },
    { id: 'templates', label: '配置模板', icon: <FileCode className="w-5 h-5" /> },
    { id: 'excalidraw', label: '白板草图', icon: <PenTool className="w-5 h-5" /> },
    { id: 'tftp', label: 'TFTP', icon: <Server className="w-5 h-5" /> },
    { id: 'ftp', label: 'FTP', icon: <Download className="w-5 h-5" /> },
    { id: 'wifi', label: 'Wi-Fi 信号', icon: <Wifi className="w-5 h-5" /> },
    { id: 'textdiff', label: '文本比对', icon: <GitCompare className="w-5 h-5" /> },
    { id: 'password', label: '密码管理', icon: <KeyRound className="w-5 h-5" /> },
    { id: 'history', label: '测试历史', icon: <History className="w-5 h-5" /> },
    { id: 'settings', label: '配置数据同步', icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <>
      <div className={cn(
        "fixed inset-y-0 left-0 z-50 bg-[#EAEAEA] border-r border-[#E0E0E0] text-slate-700 transition-all duration-300 ease-in-out md:static flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        isCollapsed ? "w-[72px]" : "w-64"
      )}>
        <div className={cn(
          "flex items-center p-5 border-b border-[#E0E0E0] md:border-none",
          isCollapsed ? "justify-center px-0 flex-col gap-2" : "justify-between"
        )}>
          {!isCollapsed ? (
            <h1 className="text-[15px] font-[600] text-slate-800 tracking-tight flex items-center gap-2 truncate">
              <img src="/icon.svg" alt="Logo" className="w-6 h-6 shadow-sm border border-slate-200 shrink-0 object-contain bg-white" style={{ borderRadius: '25%' }} /> Network Toolkit
            </h1>
          ) : (
            <img src="/icon.svg" alt="Logo" className="w-6 h-6 shadow-sm border border-slate-200 shrink-0 object-contain bg-white mt-1" style={{ borderRadius: '25%' }} />
          )}
          <button className={cn("md:hidden text-slate-500 hover:text-slate-800", isCollapsed && "hidden")} onClick={() => setIsOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <nav className={cn("flex-1 overflow-y-auto py-3 space-y-[4px]", isCollapsed ? "px-2" : "px-3")}>
          {menuItems.map(item => {
            const isActive = currentTool === item.id;
            const navBtn = (
              <button
                key={item.id}
                title={isCollapsed ? item.label : undefined}
                onClick={() => {
                  setCurrentTool(item.id);
                  if (window.innerWidth < 768) {
                    setIsOpen(false);
                  }
                }}
                className={cn(
                  "w-full flex items-center rounded-[8px] transition-all duration-200",
                  isCollapsed ? "justify-center py-[10px]" : "gap-3 px-3 py-[8px] text-[13px]",
                  isActive 
                    ? "bg-[rgba(0,0,0,0.06)] text-slate-900 font-[600] shadow-sm" 
                    : "text-slate-600 hover:bg-[rgba(0,0,0,0.04)] hover:text-slate-900 font-medium",
                  item.id === 'dashboard' && !isCollapsed && "pr-8"
                )}
              >
                <div className={cn("flex-shrink-0", isActive ? "text-slate-900" : "text-slate-500")}>
                  {item.icon}
                </div>
                {!isCollapsed && <span className="truncate">{item.label}</span>}
              </button>
            );

            if (item.id === 'dashboard') {
              return (
                <div key={item.id} className="relative group/dash flex items-center">
                  {navBtn}
                  <button 
                    onClick={handleToggleCollapse} 
                    className={cn(
                      "absolute p-1 rounded-md hover:bg-[rgba(0,0,0,0.08)] text-slate-500 hover:text-slate-800 transition-colors hidden md:block",
                      isCollapsed ? "right-1 bg-white border border-slate-200 shadow-sm rounded-full -mr-3 z-10" : "right-1"
                    )}
                    title={isCollapsed ? "展开侧边栏" : "收起侧边栏"}
                  >
                    {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                  </button>
                </div>
              );
            }

            return navBtn;
          })}
        </nav>
        
        {!isCollapsed && (
          <div className="px-4 py-3 text-[11px] text-slate-400 text-center border-t border-[#E0E0E0]/50 relative group">
            <span className="group-hover:opacity-0 transition-opacity">Network Toolkit v1.1<br/>Powered by Fabio Ben</span>
          </div>
        )}
      </div>
      
      {!isOpen && (
        <button 
          className="md:hidden fixed top-4 left-4 z-40 p-2 bg-white text-slate-800 rounded-md shadow-sm border border-slate-200"
          onClick={() => setIsOpen(true)}
        >
          <Menu className="w-5 h-5" />
        </button>
      )}
    </>
  );
}
