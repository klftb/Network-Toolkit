import React, { useState } from 'react';
import { Download, Upload, Server, Settings, FolderOpen, Play, Square, Key, User, File as FileIcon, ArrowLeft, RefreshCw, FileDown, Trash2, Activity, Pause, XCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { cn } from '../lib/utils';

export function FtpTool() {
  // Client state
  const [clientProtocol, setClientProtocol] = useState<'FTP' | 'SFTP'>('FTP');
  const [clientHost, setClientHost] = useState('');
  const [clientPort, setClientPort] = useState('21');
  const [clientUsername, setClientUsername] = useState('anonymous');
  const [clientPassword, setClientPassword] = useState('');
  const [clientConnected, setClientConnected] = useState(false);
  const [clientLogs, setClientLogs] = useState<string[]>([]);
  // File Explorer State
  const [currentPath, setCurrentPath] = useState('/');
  const [fileList, setFileList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTransfers, setActiveTransfers] = useState<Record<string, any>>({});

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const fetchFileList = async (path: string) => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ftp/list', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
              protocol: clientProtocol,
              host: clientHost,
              port: clientPort,
              user: clientUsername,
              password: clientPassword,
              currentPath: path
          })
      });
      const data = await res.json();
      if (data.success) {
          setFileList(data.files || []);
          setCurrentPath(path);
      } else {
          setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 列表获取失败: ${data.error}`]);
      }
    } catch(e: any) {
      setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 列表请求异常: ${e.message}`]);
    }
    setIsLoading(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <Download className="w-6 h-6 text-slate-800" />
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">FTP 工具</h1>
      </div>

        <div className="flex flex-col flex-1 gap-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
              <Settings className="w-4 h-4" /> 客户端连接
            </h2>
            <div className="flex gap-4 items-end mb-4 flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  服务器 IP / 域名
                </label>
                <div className="flex gap-2">
                  <select 
                    value={clientProtocol}
                    onChange={(e) => {
                      const p = e.target.value as 'FTP' | 'SFTP';
                      setClientProtocol(p);
                      if (p === 'SFTP' && clientPort === '21') setClientPort('22');
                      if (p === 'FTP' && clientPort === '22') setClientPort('21');
                    }}
                    className="h-[36px] bg-slate-100 border border-slate-200 rounded-[6px] px-2 text-[13px] font-medium text-slate-700 outline-none cursor-pointer"
                  >
                    <option value="FTP">FTP</option>
                    <option value="SFTP">SFTP</option>
                  </select>
                  <Server className="w-5 h-5 mt-2 text-slate-400 hidden sm:block"/>
                  <input
                    type="text"
                    placeholder="21.13.1.200"
                    value={clientHost}
                    onChange={(e) => setClientHost(e.target.value)}
                    className="w-full h-[36px] bg-[#F8F9FA] border border-[#E0E0E0] rounded-[6px] px-3 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              <div className="w-[100px]">
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  端口
                </label>
                <input
                  type="text"
                  value={clientPort}
                  onChange={(e) => setClientPort(e.target.value)}
                  className="w-full h-[36px] bg-[#F8F9FA] border border-[#E0E0E0] rounded-[6px] px-3 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
                />
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  用户名
                </label>
                <div className="flex gap-2">
                  <User className="w-5 h-5 mt-2 text-slate-400 hidden sm:block"/>
                  <input
                    type="text"
                    value={clientUsername}
                    onChange={(e) => setClientUsername(e.target.value)}
                    className="w-full h-[36px] bg-[#F8F9FA] border border-[#E0E0E0] rounded-[6px] px-3 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[150px]">
                <label className="block text-[13px] font-medium text-slate-700 mb-1">
                  密码
                </label>
                <div className="flex gap-2">
                  <Key className="w-5 h-5 mt-2 text-slate-400 hidden sm:block"/>
                  <input
                    type="password"
                    value={clientPassword}
                    onChange={(e) => setClientPassword(e.target.value)}
                    className="w-full h-[36px] bg-[#F8F9FA] border border-[#E0E0E0] rounded-[6px] px-3 text-[13px] text-slate-800 focus:outline-none focus:border-slate-400 focus:bg-white transition-colors"
                  />
                </div>
              </div>
              
              <button
                onClick={async () => {
                  if (clientConnected) {
                      setClientConnected(false);
                      setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 已断开连接`]);
                      return;
                  }
                  
                  if (!clientHost) {
                      setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 错误: 请输入服务器地址`]);
                      return;
                  }

                  const logMsg = `正在通过 ${clientProtocol} 连接到 ${clientHost}:${clientPort} ...`;
                  setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${logMsg}`]);
                  setClientConnected(true);

                  try {
                      const res = await fetch('/api/ftp/test-connection', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                              protocol: clientProtocol,
                              host: clientHost,
                              port: clientPort,
                              user: clientUsername,
                              password: clientPassword
                          })
                      });
                      const data = await res.json();
                      if (data.success) {
                          setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 连接成功`]);
                          setCurrentPath('/');
                          fetchFileList('/');
                      } else {
                          setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 错误:`, ...data.output.split('\n')]);
                          setClientConnected(false);
                      }
                  } catch(e: any) {
                      setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 请求异常: ${e.message}`]);
                      setClientConnected(false);
                  }
                }}
                className={cn(
                  "h-[36px] px-6 rounded-[6px] text-[13px] font-medium transition-colors shadow-sm",
                  clientConnected ? "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200" : "bg-slate-900 text-white hover:bg-slate-800"
                )}
              >
                {clientConnected ? '断开' : '测试连接'}
              </button>
            </div>
            
            <div className="flex gap-3 mt-4 pt-4 border-t border-[#E0E0E0]">
              <button 
                className={cn(
                  "flex-1 h-[36px] rounded-[6px] text-[13px] font-medium transition-colors flex items-center justify-center gap-2",
                  clientConnected ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-slate-50 text-slate-400 cursor-not-allowed"
                )}
                disabled={!clientConnected}
                onClick={() => fetchFileList(currentPath)}
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} /> 刷新目录
              </button>
              
              <button className={cn(
                  "flex-1 h-[36px] rounded-[6px] text-[13px] font-medium transition-colors flex items-center justify-center gap-2 relative overflow-hidden",
                  clientConnected ? "bg-slate-100 text-slate-700 hover:bg-slate-200" : "bg-slate-50 text-slate-400 cursor-not-allowed"
                )}
                disabled={!clientConnected}
              >
                <Upload className="w-4 h-4" /> 上传到此目录
                {clientConnected && (
                  <input 
                    type="file" 
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      e.target.value = ''; // Reset input
                      
                      const targetPath = currentPath.endsWith('/') ? `${currentPath}${file.name}` : `${currentPath}/${file.name}`;
                      setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 正在上传 ${file.name} 到 ${targetPath} ...`]);
                      
                      const formData = new FormData();
                      formData.append('protocol', clientProtocol);
                      formData.append('host', clientHost);
                      formData.append('port', clientPort);
                      formData.append('user', clientUsername);
                      formData.append('password', clientPassword);
                      formData.append('remotePath', targetPath);
                      formData.append('file', file);

                      const transferId = uuidv4();
                      formData.append('transferId', transferId);
                      
                      const startTime = Date.now();
                      let lastLogTime = 0;
                      let progressTimer: any = null;

                      progressTimer = setInterval(async () => {
                          try {
                              const pRes = await fetch(`/api/ftp/progress?id=${transferId}`);
                              const pData = await pRes.json();
                              if (pData.success && pData.total > 0) {
                                  const percent = ((pData.loaded / pData.total) * 100).toFixed(1);
                                  const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
                                  const speedMBps = (pData.loaded / 1024 / 1024 / elapsedSec).toFixed(2);
                                  
                                      if (Date.now() - lastLogTime > 1000) {
                                          lastLogTime = Date.now();
                                      }
                                      setActiveTransfers(prev => ({
                                          ...prev,
                                          [transferId]: { id: transferId, file: file.name, type: 'upload', loaded: pData.loaded, total: pData.total, paused: pData.paused, speed: (pData.loaded / elapsedSec) }
                                      }));
                                  }
                              } catch (e) {}
                          }, 1000);

                      try {
                          const res = await fetch('/api/ftp/upload', {
                              method: 'POST',
                              body: formData
                          });
                          clearInterval(progressTimer);
                          setActiveTransfers(prev => { const n = { ...prev }; delete n[transferId]; return n; });
                          const data = await res.json();
                          if (data.success) {
                              const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
                              const finalSpeed = (file.size / 1024 / 1024 / elapsedSec).toFixed(2);
                              setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 上传完成: ${targetPath} (平均: ${finalSpeed} MB/s)`]);
                              fetchFileList(currentPath); // Auto refresh
                          } else {
                              setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 上传失败: ${data.error}`]);
                          }
                      } catch(err: any) {
                          clearInterval(progressTimer);
                          setActiveTransfers(prev => { const n = { ...prev }; delete n[transferId]; return n; });
                          setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 请求异常: ${err.message}`]);
                      }
                    }}
                  />
                )}
              </button>
            </div>
          </div>
          
          <div className="flex-1 flex flex-col gap-4">
            {clientConnected && (
              <div className="flex-[2] flex flex-col gap-4">
                
                {Object.keys(activeTransfers).length > 0 && (
                  <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
                    <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2 mb-1">
                      <Activity className="w-4 h-4" /> 活跃传输任务
                    </h2>
                    {Object.values(activeTransfers).map(t => (
                      <div key={t.id} className="flex flex-col gap-2 p-3 bg-[#F8F9FA] rounded-[8px] border border-slate-200">
                        <div className="flex justify-between items-center text-[13px]">
                          <div className="flex items-center gap-2 font-medium text-slate-800">
                            {t.type === 'download' ? <Download className="w-4 h-4 text-emerald-500" /> : <Upload className="w-4 h-4 text-blue-500" />}
                            <span className="font-mono truncate max-w-[200px]">{t.file}</span>
                            {t.paused && <span className="text-[11px] px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">已暂停</span>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-slate-600 font-mono text-[13px] font-semibold min-w-[70px] text-right">
                              {t.paused ? '-- B/s' : `${formatBytes(t.speed)}/s`}
                            </span>
                          </div>
                        </div>
                        <div className="w-full bg-slate-200 rounded-full h-1.5">
                          <div className={cn("h-1.5 rounded-full transition-all", t.paused ? "bg-yellow-400" : (t.type === 'download' ? "bg-emerald-500" : "bg-blue-500"))} style={{ width: `${(t.loaded / t.total) * 100}%` }}></div>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-[11px] text-slate-500 font-mono">
                            {formatBytes(t.loaded)} / {formatBytes(t.total)}
                          </span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => fetch('/api/ftp/action', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id: t.id, action: t.paused ? 'resume' : 'pause' }) })}
                              className={cn("px-2 py-1 rounded text-[11px] flex items-center gap-1", t.paused ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100" : "bg-yellow-50 text-yellow-600 hover:bg-yellow-100")}
                            >
                              {t.paused ? <><Play className="w-3 h-3" /> 继续</> : <><Pause className="w-3 h-3" /> 暂停</>}
                            </button>
                            <button 
                              onClick={() => fetch('/api/ftp/action', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ id: t.id, action: 'cancel' }) })}
                              className="px-2 py-1 rounded text-[11px] flex items-center gap-1 bg-red-50 text-red-600 hover:bg-red-100"
                            >
                              <XCircle className="w-3 h-3" /> 取消
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex-1 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col shadow-sm">
                  <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                    <button 
                    disabled={currentPath === '/'}
                    onClick={() => {
                      const parts = currentPath.split('/').filter(Boolean);
                      parts.pop();
                      const newPath = '/' + parts.join('/');
                      fetchFileList(newPath || '/');
                    }}
                    className="p-1 rounded-md text-slate-500 hover:bg-slate-200 disabled:opacity-30 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <span className="text-[13px] font-mono text-slate-700 flex-1 truncate">{currentPath}</span>
                </div>
                <div className="flex-1 overflow-auto p-2">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> 加载目录中...
                    </div>
                  ) : fileList.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-slate-400 text-sm">
                      空目录
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100">
                          <th className="py-2 px-3 text-[12px] font-medium text-slate-500 w-[50%]">文件名</th>
                          <th className="py-2 px-3 text-[12px] font-medium text-slate-500 w-[20%]">大小</th>
                          <th className="py-2 px-3 text-[12px] font-medium text-slate-500 w-[30%]">操作</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fileList.sort((a, b) => (a.type === 'd' ? -1 : 1)).map((f, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50/80 transition-colors group">
                            <td className="py-2 px-3">
                              <div 
                                className={cn(
                                  "flex items-center gap-2 text-[13px] font-mono",
                                  f.type === 'd' ? "text-blue-600 cursor-pointer hover:underline" : "text-slate-700"
                                )}
                                onClick={() => {
                                  if (f.type === 'd') {
                                    const nextPath = currentPath.endsWith('/') ? `${currentPath}${f.name}` : `${currentPath}/${f.name}`;
                                    fetchFileList(nextPath);
                                  }
                                }}
                              >
                                {f.type === 'd' ? <FolderOpen className="w-4 h-4" /> : <FileIcon className="w-4 h-4" />}
                                <span className="truncate">{f.name}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3 text-[12px] text-slate-500 font-mono">
                              {f.type === 'd' ? '-' : `${(f.size / 1024).toFixed(1)} KB`}
                            </td>
                            <td className="py-2 px-3">
                              {f.type !== 'd' && (
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button 
                                    className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex items-center gap-1 text-[12px]"
                                  onClick={async () => {
                                    const remotePath = currentPath.endsWith('/') ? `${currentPath}${f.name}` : `${currentPath}/${f.name}`;
                                    const transferId = uuidv4();
                                    setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 正在服务器端拉取 ${f.name} ...`]);
                                    
                                    const startTime = Date.now();
                                    let lastLogTime = 0;
                                    let progressTimer: any = null;

                                    progressTimer = setInterval(async () => {
                                        try {
                                            const pRes = await fetch(`/api/ftp/progress?id=${transferId}`);
                                            const pData = await pRes.json();
                                            if (pData.success && pData.total > 0) {
                                                const elapsedSec = (Date.now() - startTime) / 1000 || 0.1;
                                                
                                                if (Date.now() - lastLogTime > 1000) {
                                                    lastLogTime = Date.now();
                                                }
                                                setActiveTransfers(prev => ({
                                                    ...prev,
                                                    [transferId]: { id: transferId, file: f.name, type: 'download', loaded: pData.loaded, total: pData.total, paused: pData.paused, speed: (pData.loaded / elapsedSec) }
                                                }));
                                            }
                                        } catch (e) {}
                                    }, 1000);

                                    try {
                                        const res = await fetch('/api/ftp/download', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                protocol: clientProtocol, host: clientHost, port: clientPort, user: clientUsername, password: clientPassword, remotePath, transferId
                                            })
                                        });
                                        clearInterval(progressTimer);
                                        setActiveTransfers(prev => { const n = { ...prev }; delete n[transferId]; return n; });
                                        const data = await res.json();
                                        
                                        if (data.success) {
                                            setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 远端拉取完成，即将保存至本地...`]);
                                            
                                            // Trigger browser download dialog
                                            const url = `/api/ftp/serve?fileId=${encodeURIComponent(data.fileId)}&fileName=${encodeURIComponent(data.fileName)}`;
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = data.fileName;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                        } else {
                                            setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 下载失败: ${data.error}`]);
                                        }
                                    } catch(e: any) {
                                        clearInterval(progressTimer);
                                        setActiveTransfers(prev => { const n = { ...prev }; delete n[transferId]; return n; });
                                        setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 请求异常: ${e.message}`]);
                                    }
                                  }}
                                >
                                  <FileDown className="w-3.5 h-3.5" /> 下载
                                </button>
                                <button 
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors flex items-center gap-1 text-[12px]"
                                  onClick={async () => {
                                    if (!confirm(`确定要删除远端文件 ${f.name} 吗？`)) return;
                                    const remotePath = currentPath.endsWith('/') ? `${currentPath}${f.name}` : `${currentPath}/${f.name}`;
                                    setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 正在请求删除 ${f.name} ...`]);
                                    try {
                                        const res = await fetch('/api/ftp/delete', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                protocol: clientProtocol, host: clientHost, port: clientPort, user: clientUsername, password: clientPassword, remotePath
                                            })
                                        });
                                        const data = await res.json();
                                        if (data.success) {
                                            setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 删除成功: ${f.name}`]);
                                            fetchFileList(currentPath);
                                        } else {
                                            setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 删除失败: ${data.error}`]);
                                        }
                                    } catch(e: any) {
                                        setClientLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] 删除异常: ${e.message}`]);
                                    }
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> 删除
                                </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
            )}
            
            <div className={cn("bg-[#1E1E1E] rounded-xl border border-slate-800 overflow-hidden flex flex-col", clientConnected ? "flex-1" : "flex-1 min-h-[300px]")}>
              <div className="px-4 py-2 bg-[#2D2D2D] border-b border-[#404040] flex justify-between items-center">
                <span className="text-[12px] font-mono text-gray-300">FTP 客户端日志</span>
                <button 
                  onClick={() => setClientLogs([])}
                  className="text-[12px] text-gray-400 hover:text-white transition-colors"
                >
                  清空
                </button>
              </div>
              <div className="p-4 overflow-auto flex-1 font-mono text-[13px] text-[#A8C7FA] whitespace-pre-wrap leading-relaxed">
                {clientLogs.length === 0 ? (
                  <span className="text-gray-500 opacity-50">等待操作...</span>
                ) : (
                  clientLogs.map((log, i) => (
                    <div key={i}>{log}</div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
    </div>
  );
}
