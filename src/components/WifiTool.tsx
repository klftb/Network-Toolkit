import React, { useState, useRef, useEffect } from 'react';
import { Wifi, Map as MapIcon, RefreshCw, Upload, Crosshair, Download, Layers, FileDown, FileJson, BarChart2, Activity, ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface WifiNetwork {
  ssid: string;
  bssid: string;
  rssi: number;
  channel: number;
  frequency: number;
  speed: string;
  security: string;
  securityFlags: string;
  quality: number;
  isHidden: boolean;
}

interface DataPoint {
  x: number;
  y: number;
  rssi: number;
}

const CH_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e', '#84cc16'];

const getGraphData = (nets: WifiNetwork[], band: '2.4' | '5') => {
    const netsInBand = nets.filter(n => {
        const cNum = parseInt(n.channel as any, 10) || 0;
        const freq = n.frequency || 0;
        const is24 = (freq > 0 && freq < 3000) || (cNum > 0 && cNum <= 14);
        return band === '2.4' ? is24 : !is24;
    }).slice(0, 8); // Take top 8 strongest to avoid chart clutter
    
    let channels: number[] = [];
    if (band === '2.4') {
        for(let i=1; i<=14; i++) channels.push(i);
    } else {
        channels = [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165];
    }

    const data = channels.map((ch, chIndex) => {
        let row: any = { channel: ch };
        netsInBand.forEach((net, index) => {
            let cNum = parseInt(net.channel as any, 10) || 0;
            if (cNum === 0 && net.frequency) {
               if (net.frequency > 2400 && net.frequency < 2500) cNum = Math.round((net.frequency - 2407) / 5);
               else if (net.frequency > 5000) cNum = Math.round((net.frequency - 5000) / 5);
            }
            if (cNum === 0) cNum = ch; // Fallback so it at least shows up

            let dist;
            if (band === '2.4') {
                dist = Math.abs(ch - cNum);
               if (dist === 0) row[`net_${index}`] = Math.max(-100, net.rssi);
               else if (dist === 1) row[`net_${index}`] = Math.max(-100, net.rssi - 5);
               else if (dist === 2) row[`net_${index}`] = Math.max(-100, net.rssi - 20);
               else row[`net_${index}`] = -100;
            } else {
               // For 5GHz, find the array index of the channel
               const targetIndex = channels.indexOf(cNum);
               if (targetIndex === -1) {
                   // cNum not in standard list, fallback to naive dist
                   dist = Math.abs(ch - cNum);
                   if (dist === 0) row[`net_${index}`] = Math.max(-100, net.rssi);
                   else if (dist <= 4 && dist > 0) row[`net_${index}`] = Math.max(-100, net.rssi - 10);
                   else row[`net_${index}`] = -100;
               } else {
                   dist = Math.abs(chIndex - targetIndex);
                   if (dist === 0) row[`net_${index}`] = Math.max(-100, net.rssi);
                   else if (dist === 1) row[`net_${index}`] = Math.max(-100, net.rssi - 10);
                   else row[`net_${index}`] = -100;
               }
            }
        });
        return row;
    });

    return { data, netsInBand };
};

export function WifiTool() {
  const [expandedSsids, setExpandedSsids] = useState<Record<string, boolean>>({});
  
  const toggleSsid = (ssid: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedSsids(prev => ({
      ...prev,
      [ssid]: !prev[ssid]
    }));
  };

  const [activeTab, setActiveTab] = useState<'scanner' | 'heatmap' | 'chart'>('scanner');
  const [scanning, setScanning] = useState(false);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [chartBand, setChartBand] = useState<'2.4' | '5'>('2.4');

  // Heatmap state
  const [mapImage, setMapImage] = useState<string | null>(null);
  const [points, setPoints] = useState<DataPoint[]>([]);
  const [currentRssi, setCurrentRssi] = useState<number>(-50);
  const [showHeatmap, setShowHeatmap] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Geolocation for Base Station Info
  const [geoLoc, setGeoLoc] = useState<{lat: number, lng: number, acc: number, time: number} | null>(null);
  const [geoLocLoading, setGeoLocLoading] = useState(false);
  const [geoLocError, setGeoLocError] = useState('');

  const handleGeoLocate = () => {
      setGeoLocLoading(true);
      setGeoLocError('');
      if (!navigator.geolocation) {
          setGeoLocError('当前浏览器不支持地理定位 / Geolocation not supported');
          setGeoLocLoading(false);
          return;
      }
      navigator.geolocation.getCurrentPosition(
          (pos) => {
              setGeoLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy, time: pos.timestamp });
              setGeoLocLoading(false);
          },
          (err) => {
              setGeoLocError(err.message || '无法获取位置信息');
              setGeoLocLoading(false);
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
  };

  const handleScan = async () => {
    setScanning(true);
    try {
        const response = await fetch('/api/wifi/scan');
        if (response.ok) {
            const data = await response.json();
            if (data && Array.isArray(data.networks)) {
                // Map the node-wifi output to our expected interface
                // node-wifi gives: { ssid, bssid, mac, channel, frequency, signal_level, quality, security, security_flags, mode }
                const mapped = data.networks.map((net: any) => ({
                    ssid: net.ssid || '<Hidden SSID>',
                    bssid: net.bssid || net.mac,
                    rssi: typeof net.signal_level === 'number' ? net.signal_level : -50,
                    channel: net.channel || 0,
                    frequency: net.frequency || 0,
                    speed: net.speed ? `${net.speed}` : net.bitrate ? `${net.bitrate}` : net.rate ? `${net.rate}` : '-',
                    security: net.security || 'Unknown',
                    securityFlags: net.security_flags ? (Array.isArray(net.security_flags) ? net.security_flags.join(', ') : String(net.security_flags)) : '',
                    quality: typeof net.quality === 'number' && net.quality > 0 ? net.quality : Math.max(0, Math.min(100, 2 * ((typeof net.signal_level === 'number' ? net.signal_level : -50) + 100))),
                    isHidden: !net.ssid
                }));
                // Sort by RSSI descending
                mapped.sort((a: WifiNetwork, b: WifiNetwork) => b.rssi - a.rssi);
                
                if (mapped.length === 0) {
                   setNetworks([]);
                   alert("扫描完成，但在当前环境中未发现任何无线网络。如果你正在云端运行或没有配置无线网卡，将无法获取真实数据。");
                } else {
                   setNetworks(mapped);
                }
            } else {
                 setNetworks([]);
                 alert("解析网络数据失败，未收到预期的格式。");
            }
        } else {
            const errorText = await response.text();
            alert(`扫描请求失败 (${response.status}): ${errorText}\n\n注意：本地执行时可能需要管理员权限（如 Windows 的系统权限，或 Mac 的 Location 服务权限）。`);
        }
    } catch (e: any) {
        console.error("Failed to scan wifi:", e);
        alert(`请求发生异常: ${e.message}`);
    } finally {
        setScanning(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setMapImage(url);
      setPoints([]);
      setShowHeatmap(false);
    }
  };

  const handleMapClick = async (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mapImage) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Attempt to fetch real Wi-Fi RSSI from server
    let rssiToUse = currentRssi;
    try {
        const response = await fetch('/api/wifi/current');
        if (response.ok) {
            const data = await response.json();
            if (data && typeof data.rssi === 'number') {
                rssiToUse = data.rssi;
                setCurrentRssi(data.rssi);
            }
        }
    } catch(e) {
        console.error("Failed to fetch real RSSI", e);
    }

    setPoints([...points, { x, y, rssi: rssiToUse }]);
    setShowHeatmap(false); // Reset heatmap when adding new points to require regeneration
  };

  const drawHeatmap = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) return;

    setShowHeatmap(true);

    // Draw gradients for each point
    points.forEach(p => {
      const radius = 100;
      const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
      
      // Determine color based on RSSI
      // -30 (strong) to -90 (weak)
      let color = 'rgba(0, 255, 0, '; // Green
      if (p.rssi < -60) color = 'rgba(255, 255, 0, '; // Yellow
      if (p.rssi < -75) color = 'rgba(255, 0, 0, '; // Red

      gradient.addColorStop(0, color + '0.6)');
      gradient.addColorStop(1, color + '0)');

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
      ctx.fill();
    });
  };

  const exportToCSV = () => {
    if (points.length === 0) return;
    const header = "X,Y,RSSI(dBm)\n";
    const csvContent = points.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)},${p.rssi}`).join("\n");
    const blob = new Blob([header + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wifi_heatmap_data_${new Date().getTime()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportToJSON = () => {
    if (points.length === 0) return;
    const blob = new Blob([JSON.stringify(points, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `wifi_heatmap_data_${new Date().getTime()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <Wifi className="w-6 h-6 text-slate-800" />
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">Wi-Fi 信号与热力图工具</h1>
      </div>

      <div className="flex gap-4 mb-6 border-b border-[#E0E0E0]">
        <button
          className={cn(
            "pb-2 px-1 font-medium transition-colors border-b-2 flex items-center gap-2",
            activeTab === 'scanner' ? "border-slate-800 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
          onClick={() => setActiveTab('scanner')}
        >
          <Wifi className="w-4 h-4" /> 附近网络扫描
        </button>
        <button
          className={cn(
            "pb-2 px-1 font-medium transition-colors border-b-2 flex items-center gap-2",
            activeTab === 'heatmap' ? "border-slate-800 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
          onClick={() => setActiveTab('heatmap')}
        >
          <MapIcon className="w-4 h-4" /> 覆盖热力图测量
        </button>
        <button
          className={cn(
            "pb-2 px-1 font-medium transition-colors border-b-2 flex items-center gap-2",
            activeTab === 'chart' ? "border-slate-800 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
          onClick={() => setActiveTab('chart')}
        >
          <BarChart2 className="w-4 h-4" /> 信号分布图表
        </button>
      </div>

      {activeTab === 'scanner' && (
        <div className="flex flex-col flex-1 gap-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">检测周围的无线网络，包含隐藏的 SSID (通过管理帧解析)。</p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleGeoLocate}
                disabled={geoLocLoading}
                className="px-4 py-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <MapIcon className={cn("w-4 h-4", geoLocLoading && "animate-pulse")} />
                {geoLocLoading ? '获取位置中...' : '获取基站定位'}
              </button>
              <button
                onClick={handleScan}
                disabled={scanning}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <RefreshCw className={cn("w-4 h-4", scanning && "animate-spin")} />
                {scanning ? '扫描中...' : '开始扫描'}
              </button>
            </div>
          </div>

          {(geoLoc || geoLocError) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-[13px] flex items-start gap-2">
              <MapIcon className="w-4 h-4 mt-0.5 text-slate-500 shrink-0" />
              <div>
                <p className="font-medium text-slate-700 mb-1">地理位置关联 (基站参考信息)</p>
                {geoLocError ? (
                  <p className="text-red-500">{geoLocError}</p>
                ) : geoLoc ? (
                  <div className="grid grid-cols-2 md:flex gap-4 text-slate-600">
                    <span><span className="text-slate-400">经度:</span> {geoLoc.lng.toFixed(6)}°</span>
                    <span><span className="text-slate-400">纬度:</span> {geoLoc.lat.toFixed(6)}°</span>
                    <span><span className="text-slate-400">精度:</span> ±{Math.round(geoLoc.acc)}m</span>
                    <span className="hidden md:inline"><span className="text-slate-400">时间:</span> {new Date(geoLoc.time).toLocaleTimeString()}</span>
                  </div>
                ) : null}
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
            <div className="overflow-x-auto h-full">
              <table className="w-full text-left text-[13px]">
                <thead className="bg-[#f8f9fa] border-b border-slate-200 text-slate-600 font-medium sticky top-0 md:static">
                  <tr>
                    <th className="px-4 py-3 min-w-[150px]">SSID</th>
                    <th className="px-4 py-3 min-w-[150px]">BSSID (MAC)</th>
                    <th className="px-4 py-3 min-w-[200px]">信号强度 (RSSI)</th>
                    <th className="px-4 py-3 min-w-[100px]">信道</th>
                    <th className="px-4 py-3 min-w-[100px]">频段</th>
                    <th className="px-4 py-3 min-w-[100px]">最大速率</th>
                    <th className="px-4 py-3 min-w-[150px]">安全协议</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {networks.length === 0 ? (
                    <tr>
<td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                        <p className="mb-2">点击 "开始扫描" 获取附近网络列表</p>
                        <p className="text-xs text-slate-400 mb-4">注意：WIFI 扫描依赖本地网络硬件。如果你在云端网页上使用此工具，或当前设备无可用无线网卡，将无法获取真实信息。</p>
                        <button 
                           onClick={() => setNetworks([
                               { ssid: '双频测试网络_Home', bssid: 'A1:B2:C3:D4:E5:F6', rssi: -45, channel: 6, frequency: 2437, speed: '144 Mbit/s', security: 'WPA2', securityFlags: 'WPA2-PSK-CCMP', quality: 90, isHidden: false },
                               { ssid: '双频测试网络_Home', bssid: '11:22:33:44:55:66', rssi: -62, channel: 149, frequency: 5745, speed: '866 Mbit/s', security: 'WPA2/WPA3', securityFlags: 'WPA3-PSK-CCMP', quality: 75, isHidden: false },
                              { ssid: '<Hidden>', bssid: 'AA:BB:CC:DD:EE:FF', rssi: -85, channel: 1, frequency: 2412, speed: '72 Mbit/s', security: 'WEP', securityFlags: 'WEP', quality: 30, isHidden: true },
                              { ssid: 'Public_Free_WiFi', bssid: '00:11:22:33:44:55', rssi: -78, channel: 11, frequency: 2462, speed: '54 Mbit/s', security: 'None', securityFlags: '', quality: 45, isHidden: false },
                           ])}
                           className="px-3 py-1.5 border border-slate-300 text-slate-600 rounded hover:bg-slate-50 text-xs"
                        >
                           加载模拟测试数据
                        </button>
                      </td>
                    </tr>
                  ) : (() => {
                    // 聚合相同的 SSID，方便展示 2.4G 和 5G 双频信号
                    const grouped = Object.values(
                       networks.reduce((acc, net) => {
                          if (!acc[net.ssid]) acc[net.ssid] = [];
                          acc[net.ssid].push(net);
                          return acc;
                       }, {} as Record<string, WifiNetwork[]>)
                    ).sort((a, b) => Math.max(...b.map(n => n.rssi)) - Math.max(...a.map(n => n.rssi)));

                    return grouped.flatMap((group, groupIdx) => {
                      const isExpanded = expandedSsids[group[0].ssid];
                      const visibleNets = isExpanded ? group : [group[0]];
                      
                      return visibleNets.map((net, subIndex) => {
                        const isFirst = net === group[0];
                        const channelNum = parseInt(net.channel as unknown as string, 10);
                        const is24G = (net.frequency && net.frequency < 3000) || (channelNum > 0 && channelNum <= 14);
                        
                        let displayFreq = net.frequency;
                        if (!displayFreq && channelNum > 0) {
                            displayFreq = channelNum > 14 ? (5000 + channelNum * 5) : (2407 + channelNum * 5);
                        }

                        return (
                        <tr key={`${groupIdx}-${subIndex}`} className={cn("hover:bg-slate-50 transition-colors", isFirst && groupIdx > 0 ? "border-t-[2px] border-slate-100" : "")}>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                                {!isFirst && <div className="w-3 h-3 border-l-2 border-b-2 border-slate-300 rounded-bl ml-2 mb-1 opacity-60 shrink-0"></div>}
                                {isFirst && group.length > 1 && (
                                    <button onClick={(e) => toggleSsid(group[0].ssid, e)} className="p-0.5 hover:bg-slate-200 rounded text-slate-500 transition-colors shrink-0">
                                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                    </button>
                                )}
                                <span className={cn("font-medium", net.isHidden && "text-slate-400 italic", !isFirst && "text-slate-500")}>
                                  {isFirst ? net.ssid : `(同名双频/多基站)`}
                                </span>
                            </div>
                          </td>
                        <td className="px-4 py-3 text-slate-600 font-mono">{net.bssid}</td>
                        <td className="px-4 py-3">
                          <div className="flex flex-col gap-1">
                             <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-slate-200 rounded-full overflow-hidden shrink-0">
                                  <div 
                                    className={cn(
                                      "h-full rounded-full",
                                      net.rssi > -60 ? "bg-green-500" : net.rssi > -80 ? "bg-yellow-500" : "bg-red-500"
                                    )}
                                    style={{ width: `${Math.max(0, Math.min(100, 100 - ((net.rssi || -100) * -1 - 30)))}%` }}
                                  />
                                </div>
                                <span className={cn(
                                  "font-medium tabular-nums",
                                  net.rssi > -60 ? "text-green-600" : net.rssi > -80 ? "text-yellow-600" : "text-red-500"
                                )}>
                                  {net.rssi} dBm
                                </span>
                             </div>
                             {net.quality > 0 && (
                                <span className="text-[11px] text-slate-500">Quality: {net.quality}%</span>
                             )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-medium">
                            <div className="flex flex-col gap-0.5">
                                <span>{channelNum > 0 ? channelNum : net.channel}</span>
                                {displayFreq > 0 && <span className="text-[11px] font-normal text-slate-400">{displayFreq} MHz</span>}
                            </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                            <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border",
                                is24G ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            )}>
                                {is24G ? '2.4 GHz' : '5 GHz'}
                            </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono">{net.speed && net.speed !== 'undefined' ? `${net.speed}` : '-'}</td>
                        <td className="px-4 py-3 text-slate-600">
                           <div className="flex flex-col gap-0.5 items-start">
                               <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                 {net.security}
                               </span>
                               {net.securityFlags && net.securityFlags !== net.security && (
                                  <span className="text-[10px] text-slate-400 max-w-[120px] truncate" title={net.securityFlags}>
                                      {net.securityFlags}
                                  </span>
                               )}
                           </div>
                        </td>
                      </tr>
                      );
                      });
                    });
                })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'heatmap' && (
        <div className="flex flex-col flex-1 gap-4">
          <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex-1 min-w-[200px] flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-[6px] text-[13px] font-medium cursor-pointer transition-colors border border-slate-200">
                <Upload className="w-4 h-4" /> 导入建筑底图 (PNG/JPG)
                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleImageUpload} />
              </label>
              {mapImage && (
                <span className="text-[12px] text-slate-500">已加载地图</span>
              )}
            </div>
            
            <div className="flex items-center gap-3 border-l border-slate-200 pl-4">
              <label className="text-[13px] text-slate-600 font-medium whitespace-nowrap">当前信号 (点击地图自动更新):</label>
              <input 
                type="number" 
                value={currentRssi} 
                onChange={(e) => setCurrentRssi(Number(e.target.value))}
                className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded text-[13px]"
              />
              <span className="text-[12px] text-slate-500">dBm</span>
            </div>

            <div className="flex items-center gap-2 border-l border-slate-200 pl-4">
              <button 
                onClick={drawHeatmap}
                disabled={points.length === 0 || !mapImage}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Layers className="w-4 h-4" /> 生成热力图
              </button>
              <button 
                onClick={exportToCSV}
                disabled={points.length === 0}
                className="px-3 py-2 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                title="导出 CSV"
              >
                <FileDown className="w-4 h-4" /> CSV
              </button>
              <button 
                onClick={exportToJSON}
                disabled={points.length === 0}
                className="px-3 py-2 bg-white text-slate-700 hover:text-slate-900 border border-slate-200 hover:border-slate-300 rounded-[6px] text-[13px] font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                title="导出 JSON"
              >
                <FileJson className="w-4 h-4" /> JSON
              </button>
              <button 
                onClick={() => { setPoints([]); setShowHeatmap(false); }}
                disabled={points.length === 0}
                className="px-4 py-2 bg-white text-slate-700 hover:text-red-500 border border-slate-200 rounded-[6px] text-[13px] font-medium transition-colors disabled:opacity-50 ml-1"
              >
                清空
              </button>
            </div>
          </div>

          <div className="flex-1 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-center justify-center overflow-hidden relative shadow-inner">
            {!mapImage ? (
              <div className="text-center text-slate-500">
                <MapIcon className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm font-medium">请先导入一张建筑平面图/户型图</p>
                <p className="text-xs mt-2 opacity-70">支持 JPG 或 PNG 格式</p>
              </div>
            ) : (
              <div 
                className="relative cursor-crosshair max-h-full max-w-full overflow-auto"
                onClick={handleMapClick}
              >
                {/* Background Image */}
                <img 
                  ref={imageRef}
                  src={mapImage} 
                  alt="Floor plan" 
                  className="max-w-none block select-none"
                  onLoad={(e) => {
                    if (canvasRef.current) {
                      canvasRef.current.width = e.currentTarget.naturalWidth;
                      canvasRef.current.height = e.currentTarget.naturalHeight;
                    }
                  }}
                />
                
                {/* Heatmap Canvas */}
                <canvas 
                  ref={canvasRef}
                  className={cn("absolute top-0 left-0 pointer-events-none transition-opacity duration-500", showHeatmap ? "opacity-100" : "opacity-0")}
                  style={{ mixBlendMode: 'multiply' }}
                />

                {/* Measurement Points */}
                {points.map((p, i) => (
                  <div 
                    key={i}
                    className="absolute w-3 h-3 rounded-full border border-white shadow-sm transform -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ 
                      left: p.x, 
                      top: p.y,
                      backgroundColor: p.rssi > -60 ? '#22c55e' : p.rssi > -80 ? '#eab308' : '#ef4444'
                    }}
                  />
                ))}
              </div>
            )}
            {mapImage && !showHeatmap && (
              <div className="absolute top-4 left-4 right-4 bg-blue-50/90 text-blue-800 text-sm py-2 px-4 rounded shadow-sm flex items-center justify-center gap-2 backdrop-blur-sm pointer-events-none">
                <Crosshair className="w-4 h-4" /> 点击地图上的位置以记录当前信号强度，记录多个点后点击“生成热力图”。
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'chart' && (
        <div className="flex flex-col flex-1 gap-6 bg-white rounded-xl pt-6 border border-slate-200 shadow-sm p-6 overflow-auto">
           <div className="flex flex-col gap-2 mb-4">
              <div className="flex justify-between items-start">
                  <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                     <Activity className="w-5 h-5 text-blue-500" />
                     信道与信号分布图
                  </h2>
                  <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                      <button 
                         className={cn("px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors", chartBand === '2.4' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                         onClick={() => setChartBand('2.4')}
                      >
                         2.4 GHz
                      </button>
                      <button 
                         className={cn("px-4 py-1.5 text-[13px] font-medium rounded-md transition-colors", chartBand === '5' ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700")}
                         onClick={() => setChartBand('5')}
                      >
                         5 GHz
                      </button>
                  </div>
              </div>
              <p className="text-sm text-slate-500">模拟 NetSpot 的信道图，由于信道宽度默认按照 20MHz 计算。Y轴表现真实信号强度(-dBm)。</p>
           </div>
           
           {networks.length === 0 ? (
               <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                   <Activity className="w-12 h-12 mb-4 opacity-20" />
                   <p>暂无网络数据。请先执行扫描，或在“附近网络扫描”页面点击加载模拟数据。</p>
               </div>
           ) : (() => {
               const { data, netsInBand } = getGraphData(networks, chartBand);
               if (netsInBand.length === 0) {
                   return (
                       <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                           <Activity className="w-10 h-10 mb-2 opacity-20" />
                           <p>该频段没有扫描到热点。</p>
                       </div>
                   );
               }
               return (
                   <div className="flex-1 h-[450px] w-full relative">
                       <ResponsiveContainer width="100%" height="100%">
                           <AreaChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                               <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                               <XAxis 
                                   dataKey="channel" 
                                   type="number"
                                   domain={['dataMin', 'dataMax']}
                                   tickCount={data.length}
                                   tick={{ fontSize: 12, fill: '#64748b' }} 
                                   label={{ value: '信道 (Channel)', position: 'insideBottom', offset: -15, style: { fill: '#64748b', fontSize: 13 } }}
                               />
                               <YAxis 
                                   domain={[-100, -20]} 
                                   tick={{ fontSize: 12, fill: '#64748b' }} 
                                   label={{ value: '信号强度 (dBm)', angle: -90, position: 'insideLeft', offset: 0, style: { fill: '#64748b', fontSize: 13 } }} 
                               />
                               <RechartsTooltip 
                                   labelFormatter={(val) => `信道: ${val}`}
                                   formatter={(value: number, name: string) => {
                                       const idx = parseInt(name.replace('net_', ''), 10);
                                       const netName = !isNaN(idx) && netsInBand[idx] ? netsInBand[idx].ssid : name;
                                       return [`${value} dBm`, netName || '未知网络'];
                                   }}
                                   labelStyle={{ color: '#0f172a', fontWeight: 600, marginBottom: '4px' }}
                                   contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                               />
                               <Legend verticalAlign="top" height={36} formatter={(value) => {
                                  const idx = parseInt(value.replace('net_', ''));
                                  return netsInBand[idx]?.ssid || value;
                               }} />
                               {netsInBand.map((net, index) => (
                                   <Area 
                                      key={`net_${index}`}
                                      type="monotone" 
                                      dataKey={`net_${index}`} 
                                      name={`net_${index}`}
                                      stroke={CH_COLORS[index % CH_COLORS.length]} 
                                      fill={CH_COLORS[index % CH_COLORS.length]} 
                                      fillOpacity={0.2}
                                      strokeWidth={2}
                                      connectNulls={false}
                                      baseValue={-100}
                                   />
                               ))}
                           </AreaChart>
                       </ResponsiveContainer>
                   </div>
               );
           })()}
        </div>
      )}
    </div>
  );
}
