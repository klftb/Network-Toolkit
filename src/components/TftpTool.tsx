import React, { useState, useEffect } from 'react';
import { Server, Download, Upload, Play, Square, FolderOpen, Settings, Activity, CircleAlert, XCircle } from 'lucide-react';
import { cn } from '../lib/utils';

export function TftpTool() {
  // Server state
  const [serverRunning, setServerRunning] = useState(false);
  const [serverDir, setServerDir] = useState('C:\\TFTP-Root');
  const [serverLogs, setServerLogs] = useState<string[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<Record<string, any>>({});
  const [eventSource, setEventSource] = useState<EventSource | null>(null);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const setupEventSource = () => {
    if (eventSource) return;
    const es = new EventSource('/api/tftp/events');
    es.onmessage = (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === 'log') {
          setServerLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${payload.message}`]);
        } else if (payload.type === 'progress') {
          const data = payload.data;
          setActiveTransfers(prev => {
            const next = { ...prev };
            if (data.done) {
              delete next[data.file];
            } else {
              next[data.file] = data;
            }
            return next;
          });
        }
      } catch (err) {}
    };
    setEventSource(es);
  };

  useEffect(() => {
    fetch('/api/tftp/status')
      .then(res => res.json())
      .then(data => {
        if (data.running) {
          setServerRunning(true);
          setupEventSource();
        }
      })
      .catch(() => {});
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const startServer = async () => {
    try {
      const res = await fetch('/api/tftp/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root: serverDir })
      });
      const data = await res.json();
      if (data.success || data.error === "TFTP Server is already running") {
        setServerRunning(true);
        setupEventSource();
      } else {
        setServerLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 启动失败: ${data.error}`]);
      }
    } catch (e: any) {
      setServerLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 请求异常: ${e.message}`]);
    }
  };

  const stopServer = async () => {
    try {
      await fetch('/api/tftp/stop', { method: 'POST' });
      setServerRunning(false);
      if (eventSource) {
        eventSource.close();
        setEventSource(null);
      }
    } catch (e: any) {
      setServerLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 停止请求异常: ${e.message}`]);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <Server className="w-6 h-6 text-slate-800" />
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">TFTP 工具</h1>
      </div>

        <div className="flex flex-col flex-1 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4" /> 服务器配置
              </span>
              {serverRunning && (
                <span className="flex items-center gap-1.5 text-xs font-medium text-red-500 bg-red-50 px-2 py-1 rounded-full border border-red-100">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </span>
                  运行中 (端口: 69)
                </span>
              )}
            </h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  TFTP 根目录
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={serverDir}
                    onChange={(e) => setServerDir(e.target.value)}
                    className="w-full h-[36px] bg-[#F8F9FA] border border-[#E0E0E0] rounded-[6px] px-3 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
                  />
                  <button className="h-[36px] px-3 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-[6px] text-slate-700 transition-colors flex items-center justify-center">
                    <FolderOpen className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <button
                disabled={serverRunning}
                onClick={startServer}
                className={cn(
                  "h-[36px] px-6 rounded-[6px] text-[13px] font-medium transition-colors flex items-center justify-center gap-2 shadow-sm",
                  serverRunning ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                <Play className="w-4 h-4 fill-current" /> 启动服务
              </button>
              <button
                disabled={!serverRunning}
                onClick={stopServer}
                className={cn(
                  "h-[36px] px-6 rounded-[6px] text-[13px] font-medium transition-colors flex items-center justify-center gap-2 shadow-sm",
                  !serverRunning ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200" : "bg-red-50 text-red-600 border border-red-200 hover:bg-red-100"
                )}
              >
                <Square className="w-4 h-4 fill-current" /> 停止服务
              </button>
            </div>
          </div>
          
          {Object.keys(activeTransfers).length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-2">
                <Activity className="w-4 h-4" /> 实时传输状态
              </h2>
              {Object.values(activeTransfers).map(t => (
                <div key={t.file} className="flex flex-col gap-2 p-3 bg-[#F8F9FA] rounded-[8px] border border-slate-200">
                  <div className="flex justify-between items-center text-[13px]">
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      {t.direction === 'download' ? <Upload className="w-4 h-4 text-emerald-500" /> : <Download className="w-4 h-4 text-blue-500" />}
                      <span className="font-mono">{t.file}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-600">
                        {t.direction === 'download' ? '发送 (GET)' : '接收 (PUT)'}
                      </span>
                    </div>
                    <div className="text-slate-600 font-mono text-[13px] font-semibold">
                      {formatBytes(t.speed)}/s
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-[12px] text-slate-500">
                    <span>已传输: <span className="font-mono text-slate-700">{formatBytes(t.transferred)}</span></span>
                    <button 
                      onClick={async () => {
                        try {
                          await fetch('/api/tftp/cancel', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ file: t.file })
                          });
                        } catch (e) {}
                      }}
                      className="flex items-center gap-1 text-red-500 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                    >
                      <XCircle className="w-3.5 h-3.5" /> 强制中断
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex-1 bg-[#1E1E1E] rounded-xl border border-slate-800 overflow-hidden flex flex-col min-h-[300px]">
            <div className="px-4 py-2 bg-[#2D2D2D] border-b border-[#404040] flex justify-between items-center">
              <span className="text-[12px] font-mono text-gray-300">服务器日志 (TFTP Server Log)</span>
              <button 
                onClick={() => setServerLogs([])}
                className="text-[12px] text-gray-400 hover:text-white transition-colors"
              >
                清空
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto font-mono text-[13px] text-green-400">
              {serverLogs.length === 0 ? (
                <div className="text-gray-500 italic">等待连接...</div>
              ) : (
                serverLogs.map((log, i) => (
                  <div key={i} className="mb-1">{log}</div>
                ))
              )}
            </div>
          </div>
        </div>
    </div>
  );
}
