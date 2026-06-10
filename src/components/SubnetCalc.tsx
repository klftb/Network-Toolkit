import React, { useState, useMemo } from 'react';
import { Download, Calculator } from 'lucide-react';
import { downloadReport, ipToLong, longToIp } from '../lib/utils';
import { addHistory } from '../lib/history';
import { ToolComponentProps } from '../types';

export function SubnetCalc({ onExportReady }: ToolComponentProps) {
  const [ip, setIp] = useState('192.168.1.1');
  const [cidr, setCidr] = useState('24');
  
  const [targetCidr, setTargetCidr] = useState('26');
  const [generatedSubnets, setGeneratedSubnets] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const result = useMemo(() => {
    try {
      const parts = ip.split('.').map(d => parseInt(d, 10));
      if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
        return null; // Invalid IP
      }
      const prefix = parseInt(cidr, 10);
      if (isNaN(prefix) || prefix < 0 || prefix > 32) {
        return null; // Invalid CIDR
      }

      const ipLong = ipToLong(ip);
      const maskLong = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
      
      const networkLong = (ipLong & maskLong) >>> 0;
      const broadcastLong = (networkLong | (~maskLong)) >>> 0;
      
      const firstHostLong = prefix < 31 ? networkLong + 1 : networkLong;
      const lastHostLong = prefix < 31 ? broadcastLong - 1 : broadcastLong;
      
      // Calculate max hosts (subtract network and broadcast if prefix < 31)
      let numHosts = 0;
      if (prefix === 32) numHosts = 1;
      else if (prefix === 31) numHosts = 2;
      else numHosts = Math.max(0, Math.pow(2, 32 - prefix) - 2);

      return {
        ip,
        mask: longToIp(maskLong),
        network: longToIp(networkLong),
        broadcast: longToIp(broadcastLong),
        hostMin: longToIp(firstHostLong),
        hostMax: longToIp(lastHostLong),
        totalHosts: numHosts
      };

    } catch(e) {
      return null;
    }
  }, [ip, cidr]);

  const handleExport = () => {
    if (!result) return;
    let report = `=== IP 子网规划报告 ===\nIP: ${ip}/${cidr}\n子网掩码: ${result.mask}\n网络地址: ${result.network}\n广播地址: ${result.broadcast}\n可用 IP 范围: ${result.hostMin} - ${result.hostMax}\n可用主机数: ${result.totalHosts}`;
    
    if (generatedSubnets.length > 0) {
       report += `\n\n=== 子网拆分 (${cidr} -> ${targetCidr}) ===\n`;
       report += `总数: ${generatedSubnets.length} 个子网\n\n`;
       report += `序号\t网络地址\t子网掩码\t网关/首个可用 IP\t广播地址\t可用IP范围\n`;
       generatedSubnets.forEach(s => {
           report += `${s.index}\t${s.network}\t${s.mask}\t${s.gateway}\t${s.broadcast}\t${s.range}\n`;
       });
    }

    downloadReport('Subnet_Calc', report);
  };

  const handleGenerate = () => {
     if (!result) return;
     const basePrefix = parseInt(cidr, 10);
     const targetPrefix = parseInt(targetCidr, 10);
     
     if (isNaN(targetPrefix) || targetPrefix <= basePrefix || targetPrefix > 32) {
        alert('目标掩码长度必须大于当前掩码长度且小于等于 32');
        return;
     }
     
     const numSubnets = Math.pow(2, targetPrefix - basePrefix);
     if (numSubnets > 4096) {
        alert('生成的子网数量过多 (> 4096)，为避免卡顿，请重新选择参数。');
        return;
     }
     
     const targetMaskLong = targetPrefix === 0 ? 0 : (~0 << (32 - targetPrefix)) >>> 0;
     const baseIpLong = ipToLong(result.network);
     const incrementLong = targetPrefix === 32 ? 1 : Math.pow(2, 32 - targetPrefix);
     
     const subnets = [];
     for (let i = 0; i < numSubnets; i++) {
         const netLong = (baseIpLong + i * incrementLong) >>> 0;
         const bcLong = targetPrefix === 32 ? netLong : (netLong | (~targetMaskLong)) >>> 0;
         const firstLong = targetPrefix < 31 ? netLong + 1 : netLong;
         const lastLong = targetPrefix < 31 ? bcLong - 1 : bcLong;
         
         subnets.push({
              index: i + 1,
              network: `${longToIp(netLong)}/${targetPrefix}`,
              mask: longToIp(targetMaskLong),
              gateway: longToIp(firstLong),
              broadcast: longToIp(bcLong),
              range: targetPrefix === 32 ? 'N/A' : targetPrefix === 31 ? `${longToIp(firstLong)} - ${longToIp(lastLong)} (PtP)` : `${longToIp(firstLong)} - ${longToIp(lastLong)}`
         });
     }
     setGeneratedSubnets(subnets);
     setCurrentPage(1);

     addHistory({
       toolId: 'subnet',
       toolName: 'IP 掩码计算',
       target: `${ip}/${cidr} -> /${targetCidr}`,
       summary: `生成了 ${numSubnets} 个子网`
     });
  };

  const paginatedSubnets = generatedSubnets.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const totalPages = Math.ceil(generatedSubnets.length / itemsPerPage);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold text-slate-800">IP 地址/子网掩码计算 (IPv4)</h2>
        <button 
          onClick={handleExport}
          disabled={!result}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-[rgba(0,0,0,0.02)] border-none rounded-xl hover:bg-[rgba(0,0,0,0.05)] transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> 导出报告
        </button>
      </div>

      <div className="sub-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="space-y-4 col-span-1 lg:col-span-1">
            <h3 className="text-[13px] font-[600] text-slate-800 flex items-center gap-2">
               <Calculator className="w-4 h-4 text-slate-700" /> 输入参数
            </h3>
            <div className="space-y-1.5">
              <label className="text-[11px] font-[600] text-slate-500 uppercase tracking-wider">IPv4 地址</label>
              <input 
                type="text" 
                value={ip}
                onChange={e => setIp(e.target.value)}
                placeholder="192.168.1.1"
                className="w-full px-4 py-2 border-none rounded-xl bg-[rgba(0,0,0,0.02)] focus:ring-2 focus:ring-slate-800 focus:outline-none text-[13px] font-mono shadow-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-[600] text-slate-500 uppercase tracking-wider">CIDR 前缀长度 (/)</label>
              <input 
                type="number" 
                min="0" max="32"
                value={cidr}
                onChange={e => setCidr(e.target.value)}
                className="w-full px-4 py-2 border-none rounded-xl bg-[rgba(0,0,0,0.02)] focus:ring-2 focus:ring-slate-800 focus:outline-none text-[13px] font-mono shadow-sm"
              />
            </div>
            
            <div className="pt-2 text-[11px] text-[#8E8E93]">
               支持任意合法的 IPv4 及 /0 ~ /32 掩码长度。
            </div>
          </div>

          <div className="col-span-1 md:col-span-1 lg:col-span-2 space-y-4">
             <h3 className="text-[13px] font-[600] text-slate-800">计算结果</h3>
             {!result ? (
               <div className="p-4 bg-orange-50 text-orange-700 text-sm rounded-[8px]">
                  请输入有效的 IPv4 地址与 CIDR 前缀。
               </div>
             ) : (
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)]">
                    <div className="text-[11px] text-[#8E8E93] mb-1">子网掩码 (Subnet Mask)</div>
                    <div className="font-mono text-[13px] text-slate-800 font-[600]">{result.mask}</div>
                 </div>
                 <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)]">
                    <div className="text-[11px] text-[#8E8E93] mb-1">网络地址 (Network ID)</div>
                    <div className="font-mono text-[13px] text-slate-800 font-[600]">{result.network}</div>
                 </div>
                 <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)]">
                    <div className="text-[11px] text-[#8E8E93] mb-1">广播地址 (Broadcast IP)</div>
                    <div className="font-mono text-[13px] text-slate-800 font-[600]">{result.broadcast}</div>
                 </div>
                 <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.02)]">
                    <div className="text-[11px] text-[#8E8E93] mb-1">可用主机数 (Hosts)</div>
                    <div className="font-mono text-[13px] text-slate-800 font-[600]">{result.totalHosts.toLocaleString()}</div>
                 </div>
                 <div className="p-4 rounded-xl bg-[rgba(0,0,0,0.04)] col-span-1 sm:col-span-2">
                    <div className="text-[11px] text-slate-600 font-[600] mb-1">可用 IP 范围 (Host Range)</div>
                    <div className="font-mono text-[13px] text-slate-800 font-[600]">
                      {result.totalHosts > 0 ? `${result.hostMin}  —  ${result.hostMax}` : 'No usable hosts (Point-to-Point / Loopback)'}
                    </div>
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>

      <div className="sub-card p-6">
        <h3 className="text-[13px] font-[600] text-slate-800 mb-4 flex items-center gap-2">
           <Calculator className="w-4 h-4 text-slate-700" /> 快速子网生成器/拆分
        </h3>
        <div className="flex flex-col md:flex-row gap-4 items-end mb-6">
           <div className="w-full md:w-1/3">
              <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider mb-1.5">目标掩码长度 (例如 /26)</label>
              <div className="flex bg-[rgba(0,0,0,0.02)] rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-slate-800 shadow-sm">
                 <span className="flex items-center px-3 border-r border-transparent text-[#8E8E93] font-mono">/</span>
                 <input 
                   type="number" 
                   min={parseInt(cidr, 10) + 1} max="32"
                   value={targetCidr}
                   onChange={e => setTargetCidr(e.target.value)}
                   className="w-full px-4 py-2 focus:outline-none bg-transparent text-[13px] font-mono text-slate-800"
                 />
              </div>
           </div>
           <button 
              onClick={handleGenerate}
              disabled={!result || !targetCidr}
              className="w-full md:w-auto px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-[13px] font-[500] rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
           >
              生成子网列表
           </button>
        </div>

        {generatedSubnets.length > 0 && (
           <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex justify-between items-center mb-3">
                 <div className="text-[13px] font-[500] text-slate-700">
                    共生成 <span className="text-slate-800 font-[600]">{generatedSubnets.length}</span> 个子网 (目标掩码 /{targetCidr})
                 </div>
                 {totalPages > 1 && (
                    <div className="flex items-center gap-2 text-[12px]">
                       <button 
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-2 py-1 border-none rounded-[6px] text-slate-600 hover:bg-[rgba(0,0,0,0.03)] disabled:opacity-50"
                       >上一页</button>
                       <span className="text-[#8E8E93]">
                          {currentPage} / {totalPages}
                       </span>
                       <button 
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-2 py-1 border-none rounded-[6px] text-slate-600 hover:bg-[rgba(0,0,0,0.03)] disabled:opacity-50"
                       >下一页</button>
                    </div>
                 )}
              </div>
              <div className="overflow-x-auto rounded-[8px] bg-[rgba(0,0,0,0.02)] border-none">
                 <table className="w-full text-left text-[12px] whitespace-nowrap">
                   <thead className="bg-[#EAEAEA] text-slate-600 border-none">
                     <tr>
                       <th className="px-4 py-3 font-[600]">#</th>
                       <th className="px-4 py-3 font-[600]">网络地址</th>
                       <th className="px-4 py-3 font-[600]">子网掩码</th>
                       <th className="px-4 py-3 font-[600]">网关 / 首个可用</th>
                       <th className="px-4 py-3 font-[600]">广播地址</th>
                       <th className="px-4 py-3 font-[600]">可用 IP 范围</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-[rgba(0,0,0,0.05)]">
                     {paginatedSubnets.map(s => (
                       <tr key={s.index} className="hover:bg-[rgba(0,0,0,0.04)]">
                         <td className="px-4 py-3 text-[#8E8E93]">{s.index}</td>
                         <td className="px-4 py-3 font-mono text-slate-800 font-[600]">{s.network}</td>
                         <td className="px-4 py-3 font-mono text-slate-600">{s.mask}</td>
                         <td className="px-4 py-3 font-mono text-slate-600">{s.gateway}</td>
                         <td className="px-4 py-3 font-mono text-slate-600">{s.broadcast}</td>
                         <td className="px-4 py-3 font-mono text-slate-500">{s.range}</td>
                       </tr>
                     ))}
                   </tbody>
                 </table>
              </div>
           </div>
        )}
      </div>
    </div>
  );
}
