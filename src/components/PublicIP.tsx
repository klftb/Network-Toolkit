import React, { useEffect, useState } from 'react';
import { MapPin, Globe, Loader2, Download, Search, Copy, Navigation, Clock, Wifi, Monitor, Check } from 'lucide-react';
import { downloadReport } from '../lib/utils';
import { addHistory } from '../lib/history';
import { ToolComponentProps } from '../types';

export function PublicIP({ onExportReady }: ToolComponentProps) {
  const [ip, setIp] = useState<string | null>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [provider, setProvider] = useState<'ipify' | 'ip38' | 'ip138'>('ipify');
  const [geoSource, setGeoSource] = useState<'ipapi' | 'ip38'>('ip38');
  const [myBackendIps, setMyBackendIps] = useState<{chinaz: string, ipapi: string} | null>(null);
  
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const lookupGeoIP = async (targetIp: string, source: 'ipapi' | 'ip38' = geoSource) => {
    try {
      if (targetIp && targetIp !== 'Unknown' && targetIp !== '::1' && targetIp !== '127.0.0.1') {
        const geoRes = await fetch(`/api/geoip/${targetIp}?source=${source}`);
        const geo = await geoRes.json();
        if (geo.status === 'success') {
          setGeoData(geo);
        } else {
          setGeoData(null);
        }
      } else {
        setGeoData(null);
      }
    } catch (err) {
      console.warn("Failed to fetch geo IP details", err);
      setGeoData(null);
    }
  };

  const fetchMyIP = async () => {
    setLoading(true);
    setSearchInput('');
    try {
      // Determine what IP connection they're using to the backend
      const res = await fetch(`/api/myip?provider=${provider}`);
      const data = await res.json();
      let detectedIp = data.ip;
      
      let backendIps = null;
      // Let's also fetch from the backend proxy directly incase they run locally with split routing
      try {
        const backendRes = await fetch(`/api/backend-ip`);
        const backendData = await backendRes.json();
        if (backendData.chinaz || backendData.ipapi) {
            backendIps = backendData;
            setMyBackendIps(backendData);
            detectedIp = geoSource === 'ip38' ? backendData.chinaz : backendData.ipapi;
        }
      } catch (e) {
         console.warn("Backend IP fetch failed", e);
      }

      setIp(detectedIp);
      await lookupGeoIP(detectedIp, geoSource);

      addHistory({
        toolId: 'myip',
        toolName: 'IP地址归属',
        target: detectedIp,
        summary: '探测本机公网出局 IP'
      });
    } catch (err) {
      console.warn("Failed to fetch IP details", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchInput.trim()) {
        fetchMyIP();
        return;
    }
    
    setIsSearching(true);
    setLoading(true); // Treat search as loading state for UI
    try {
      // Just set ip and look it up
      const targetIp = searchInput.trim();
      setIp(targetIp);
      await lookupGeoIP(targetIp);
      
      addHistory({
        toolId: 'myip',
        toolName: 'IP 归属查询',
        target: targetIp,
        summary: '查询 IP 归属地信息'
      });
    } finally {
      setIsSearching(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyIP();
  }, [provider]);

  useEffect(() => {
    if (!searchInput.trim() && myBackendIps) {
        const newIp = geoSource === 'ip38' ? myBackendIps.chinaz : myBackendIps.ipapi;
        if (newIp && newIp !== 'Unknown' && newIp !== ip) {
            setIp(newIp);
            setLoading(true);
            lookupGeoIP(newIp, geoSource).finally(() => setLoading(false));
            return;
        }
    }
    
    if (ip) {
      setLoading(true);
      lookupGeoIP(ip, geoSource).finally(() => setLoading(false));
    }
  }, [geoSource]);

  const handleExport = () => {
    const report = `=== IP 信息查询报告 ===\nIP 地址: ${ip}\n` + 
      (geoData ? `国家: ${geoData.country}\n城市: ${geoData.city}\n地区: ${geoData.regionName}\nISP: ${geoData.isp}\nASN: ${geoData.as}\n经度: ${geoData.lon}\n纬度: ${geoData.lat}\n时区: ${geoData.timezone}` : '地理位置信息不可用');
    downloadReport('IP_Lookup', report);
  };
  
  const renderInfoCard = (icon: React.ReactNode, title: string, value: string, copyId: string) => (
      <div className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm hover:shadow-md transition-shadow group">
          <div className="flex items-center gap-3">
              <div className="text-blue-500">{icon}</div>
              <div>
                  <span className="text-[14px] text-slate-500 font-medium mr-4">{title}</span>
                  <span className="text-[14px] text-slate-800 font-medium">{value}</span>
              </div>
          </div>
          <button 
             onClick={() => handleCopyText(value, copyId)} 
             className="text-slate-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
          >
              {copiedId === copyId ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
          </button>
      </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-2xl font-[600] text-slate-800">IP 地址归属</h2>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select 
            value={geoSource} 
            onChange={(e) => setGeoSource(e.target.value as 'ipapi' | 'ip38')}
            className="px-3 py-2 text-[13px] font-[500] text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="ip38">国内线路 (ip38.com)</option>
            <option value="ipapi">国际线路 (ip-api.com)</option>
          </select>
          {ip === searchInput.trim() || !searchInput ? null : (
            <select 
              value={provider} 
              onChange={(e) => setProvider(e.target.value as 'ipify' | 'ip38' | 'ip138')}
              className="px-3 py-2 text-[13px] font-[500] text-slate-700 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="ipify">api.ipify.org</option>
              <option value="ip138">www.ip138.com</option>
              <option value="ip38">www.ip38.com</option>
            </select>
          )}
          <button 
            onClick={fetchMyIP}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-[500] text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl transition-colors shrink-0"
          >
            <Globe className="w-4 h-4" /> 本机 IP
          </button>
          <button 
            onClick={handleExport}
            disabled={!ip || loading}
            className="flex items-center gap-2 px-4 py-2 text-[13px] font-[500] text-slate-700 bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.05)] rounded-xl transition-colors disabled:opacity-50 border-none shrink-0"
          >
            <Download className="w-4 h-4" /> 导出
          </button>
        </div>
      </div>
      
      <form onSubmit={handleSearch} className="relative">
          <input
             type="text"
             value={searchInput}
             onChange={e => setSearchInput(e.target.value)}
             placeholder="输入 IP 地址进行查询..."
             className="w-full pl-5 pr-32 py-4 bg-white border border-slate-200 shadow-sm rounded-xl text-[15px] focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-mono"
          />
          <button
             type="submit"
             disabled={isSearching || !searchInput.trim()}
             className="absolute right-2 top-2 bottom-2 px-6 bg-slate-900 text-white rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50 font-medium text-[14px]"
          >
             {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
             查询
          </button>
      </form>

      {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-4 text-slate-500 bg-white rounded-xl border border-slate-100 shadow-sm">
             <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
             <p>正在获取 IP 信息...</p>
          </div>
      ) : (
          <div className="space-y-4">
              {!searchInput.trim() && myBackendIps && myBackendIps.chinaz !== myBackendIps.ipapi && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                      <div className="p-1 bg-amber-100 text-amber-600 rounded">
                          <Globe className="w-5 h-5" />
                      </div>
                      <div className="text-sm text-amber-800">
                          <p className="font-semibold mb-1">检测到多重出局 IP (可能正在使用路由分流策略)</p>
                          <p>
                              国内链路 (ip38): <span className="font-mono font-medium">{myBackendIps.chinaz}</span> <br/>
                              国际链路 (IP-API): <span className="font-mono font-medium">{myBackendIps.ipapi}</span>
                          </p>
                          <p className="mt-2 text-amber-600/80 text-xs">您可以通过右上角的数据源下拉列表切换想要查看详细信息的链路 IP。</p>
                      </div>
                  </div>
              )}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
             {/* Header */}
             <div className="p-8 border-b border-slate-100 flex items-start gap-4">
                 <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                     <MapPin className="w-6 h-6" />
                 </div>
                 <div className="flex flex-col gap-1">
                     <h3 className="text-2xl font-mono tracking-tight font-semibold text-slate-800">{ip || 'Unknown'}</h3>
                     <p className="text-[15px] text-slate-500">
                         {geoData ? `${geoData.country || ''} · ${geoData.regionName || ''} · ${geoData.city || ''}` : '位置信息未知'}
                     </p>
                 </div>
             </div>
             
             {/* Detail Cards */}
             <div className="p-8 bg-slate-50/50">
                 {geoData ? (
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         {renderInfoCard(<Globe className="w-5 h-5" />, "国家", `${geoData.country} (${geoData.countryCode})`, "country")}
                         {renderInfoCard(<Navigation className="w-5 h-5" />, "省份", geoData.regionName || '-', "region")}
                         {renderInfoCard(<MapPin className="w-5 h-5" />, "城市", geoData.city || '-', "city")}
                         {renderInfoCard(<Clock className="w-5 h-5" />, "时区", geoData.timezone || '-', "timezone")}
                         {renderInfoCard(<Wifi className="w-5 h-5" />, "运营商", geoData.isp || '-', "isp")}
                         {renderInfoCard(<Monitor className="w-5 h-5" />, "ASN", geoData.as || '-', "asn")}
                         {renderInfoCard(<Globe className="w-5 h-5" />, "纬度", geoData.lat ? geoData.lat.toString() : '-', "lat")}
                         {renderInfoCard(<Globe className="w-5 h-5" />, "经度", geoData.lon ? geoData.lon.toString() : '-', "lon")}
                     </div>
                 ) : (
                     <div className="py-10 text-center text-slate-500">
                         未获取到该 IP 的详细归属地信息。可能是保留地址、局域网 IP 或 API 限流。
                     </div>
                 )}
             </div>
          </div>
          </div>
      )}
    </div>
  );
}
