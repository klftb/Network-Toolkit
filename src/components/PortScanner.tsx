import React, { useState } from "react";
import { Search, Download, AlertCircle, ChevronDown, ChevronUp, CheckCircle, ShieldAlert } from "lucide-react";
import { downloadReport, cn, parseTargetRanges } from "../lib/utils";
import { addHistory } from "../lib/history";
import { ToolComponentProps } from "../types";

const COMMON_PORTS = [
  21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995, 1723,
  3306, 3389, 5900, 8080, 8443,
];

export function PortScanner({ onExportReady }: ToolComponentProps) {
  const [target, setTarget] = useState("");
  const [portMode, setPortMode] = useState<"common" | "range" | "custom">(
    "common",
  );
  const [startPort, setStartPort] = useState("1");
  const [endPort, setEndPort] = useState("1024");
  const [customPorts, setCustomPorts] = useState("");

  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [results, setResults] = useState<
    { target: string; port: number; status: string }[]
  >([]);
  const [expandedIps, setExpandedIps] = useState<Record<string, boolean>>({});
  const [onlyShowAlive, setOnlyShowAlive] = useState(false);

  const handleScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!target) return;

    let portsToScan: number[] = [];
    if (portMode === "common") {
      portsToScan = COMMON_PORTS;
    } else if (portMode === "range") {
      const start = parseInt(startPort);
      const end = parseInt(endPort);
      if (start > 0 && end >= start && end - start <= 65535) {
        for (let i = start; i <= end; i++) portsToScan.push(i);
      } else {
        alert("无效的端口范围，一次最多扫描 65535 个端口");
        return;
      }
    } else {
      portsToScan = customPorts
        .split(",")
        .map((p) => parseInt(p.trim()))
        .filter((p) => !isNaN(p) && p > 0 && p <= 65535);
    }

    if (portsToScan.length === 0) return;

    const targetsToScan = parseTargetRanges(target);

    if (targetsToScan.length > 256) {
      alert(
        `目标 IP 数量 (${targetsToScan.length}) 超过安全限制，最多支持 256 个目标。`,
      );
      return;
    }

    setLoading(true);
    setProgress(0);
    setProgressStatus("正在初始化端口扫描引擎...");
    setResults([]);
    setExpandedIps({});
    setOnlyShowAlive(false);

    const totalTasks = targetsToScan.length * portsToScan.length;
    const intervalDelay = totalTasks > 500 ? 80 : 120;

    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      if (currentProgress < 30) {
        currentProgress += Math.random() * 12 + 6;
      } else if (currentProgress < 75) {
        currentProgress += Math.random() * 6 + 2;
      } else if (currentProgress < 96) {
        currentProgress += Math.random() * 1.5 + 0.3;
      }
      const rounded = Math.min(Math.floor(currentProgress), 96);
      setProgress(rounded);

      if (rounded < 15) {
        setProgressStatus(
          `解析目标完毕，正在批量建立 TCP 并发通道 (${totalTasks} 个探针)...`,
        );
      } else if (rounded < 50) {
        setProgressStatus(
          `正在扫描中... 已扫描约 ${Math.floor((totalTasks * rounded) / 100)}/${totalTasks} 个端口 (${rounded}%)`,
        );
      } else if (rounded < 85) {
        setProgressStatus(`高并发检测中，等待慢响应节点握手确认 (${rounded}%)`);
      } else {
        setProgressStatus(`正在汇总端口开放状态并清理并发连接 (${rounded}%)`);
      }
    }, intervalDelay);

    try {
      const response = await fetch("/api/portscan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets: targetsToScan, ports: portsToScan }),
      });
      const data = await response.json();

      const sorted = (data.results || []).sort((a: any, b: any) => {
        if (a.target !== b.target) return a.target.localeCompare(b.target);
        if (a.status === "open" && b.status !== "open") return -1;
        if (b.status === "open" && a.status !== "open") return 1;
        return a.port - b.port;
      });

      clearInterval(progressInterval);
      setProgress(100);
      setProgressStatus("扫描完成，已生成结果列表");

      setResults(sorted);

      const openPorts = sorted.filter((r: any) => r.status === "open").length;
      addHistory({
        toolId: "portscan",
        toolName: "IP/端口扫描",
        target: target,
        summary: `扫描了 ${targetsToScan.length} 个IP, ${portsToScan.length} 个端口，发现 ${openPorts} 个开放`,
      });
    } catch (err: any) {
      console.warn("Port scan error:", err);
      clearInterval(progressInterval);
      setProgressStatus("扫描失败，请检查网络或输入的地址");
    } finally {
      clearInterval(progressInterval);
      setTimeout(() => {
        setLoading(false);
      }, 600);
    }
  };

  const handleExport = () => {
    const report =
      `=== IP/端口扫描报告 ===\n目标: ${target}\n扫描时间: ${new Date().toLocaleString()}\n\n结果:\n` +
      results
        .map((r) => `${r.target}:${r.port} -> ${r.status.toUpperCase()}`)
        .join("\n");
    downloadReport("IP_PortScan", report);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-[600] text-slate-800">IP / 端口扫描</h2>
        <button
          onClick={handleExport}
          disabled={results.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-[500] text-slate-700 bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.05)] rounded-xl transition-colors disabled:opacity-50 border-none"
        >
          <Download className="w-4 h-4" /> 导出报告
        </button>
      </div>

      <div className="sub-card p-6">
        <form onSubmit={handleScan} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[11px] font-[600] text-slate-500 uppercase tracking-wider flex justify-between">
              <span>目标地址范围 (支持单IP, 逗号分隔, 范围/CIDR模式)</span>
              <span className="text-[#8E8E93] font-normal lowercase">
                例如: 192.168.1.1-10 或 10.0.0.0/24
              </span>
            </label>
            <input
              required
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="例如: 127.0.0.1, 192.168.1.1-20"
              className="w-full xl:w-2/3 px-4 py-2.5 bg-[rgba(0,0,0,0.02)] border-none rounded-xl focus:ring-2 focus:ring-slate-800 focus:outline-none text-[13px] text-slate-800 placeholder-[#8E8E93] shadow-sm"
            />
          </div>

          <div className="space-y-3">
            <label className="text-[11px] font-[600] text-slate-500 uppercase tracking-wider">
              扫描端口策略
            </label>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="portMode"
                  checked={portMode === "common"}
                  onChange={() => setPortMode("common")}
                  className="text-slate-800 focus:ring-slate-800"
                />
                <span className="text-[13px] text-slate-800 font-[500]">
                  常用端口 (21, 22, 80, 443...)
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="portMode"
                  checked={portMode === "range"}
                  onChange={() => setPortMode("range")}
                  className="text-slate-800 focus:ring-slate-800"
                />
                <span className="text-[13px] text-slate-800 font-[500]">有限端范围扫描</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="portMode"
                  checked={portMode === "custom"}
                  onChange={() => setPortMode("custom")}
                  className="text-slate-800 focus:ring-slate-800"
                />
                <span className="text-[13px] text-slate-800 font-[500]">自定义端口列表</span>
              </label>
            </div>
          </div>

          {portMode === "range" && (
            <div className="flex items-center gap-3 w-full xl:w-1/2">
              <input
                type="number"
                min="1"
                max="65535"
                value={startPort}
                onChange={(e) => setStartPort(e.target.value)}
                className="w-full px-4 py-2.5 bg-[rgba(0,0,0,0.02)] border-none rounded-xl text-[13px] text-slate-800"
                placeholder="启动端口"
              />
              <span className="text-slate-500">-</span>
              <input
                type="number"
                min="1"
                max="65535"
                value={endPort}
                onChange={(e) => setEndPort(e.target.value)}
                className="w-full px-4 py-2.5 bg-[rgba(0,0,0,0.02)] border-none rounded-xl text-[13px] text-slate-800"
                placeholder="结束端口 (最多+65535)"
              />
            </div>
          )}

          {portMode === "custom" && (
            <input
              type="text"
              value={customPorts}
              onChange={(e) => setCustomPorts(e.target.value)}
              className="w-full xl:w-1/2 px-4 py-2.5 bg-[rgba(0,0,0,0.02)] border-none rounded-xl text-[13px] text-slate-800 placeholder-[#8E8E93]"
              placeholder="例如: 80, 443, 3306"
            />
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={loading || !target}
              className="flex items-center gap-2 px-6 py-2.5 bg-slate-800 text-white rounded-xl text-[13px] font-[600] hover:bg-slate-700 disabled:opacity-50 transition-colors border-none"
            >
              {loading ? (
                <span className="animate-spin text-xl leading-none">⟳</span>
              ) : (
                <Search className="w-4 h-4" />
              )}
              {loading ? "极速扫描中..." : "开始全局扫描"}
            </button>
            <span className="text-[11px] text-[#8E8E93] flex items-center gap-1 font-[500]">
              <AlertCircle className="w-3.5 h-3.5" /> 支持通过内置池并发数千个
              IP:Port
            </span>
          </div>
        </form>
      </div>

      {(results.length > 0 || loading) && (() => {
        // Compute and group the results per IP
        const uniqueIps: string[] = Array.from(new Set(results.map((r) => r.target)));
        const groupedData = uniqueIps.map((ip) => {
          const ipResults = results.filter((r) => r.target === ip);
          const openPorts = ipResults.filter((r) => r.status === "open");
          const isAlive = openPorts.length > 0;
          return {
            ip,
            isAlive,
            openPorts,
            allPorts: ipResults,
          };
        });

        const filteredGroupedData = onlyShowAlive
          ? groupedData.filter((g) => g.isAlive)
          : groupedData;

        const toggleAllIps = (expanded: boolean) => {
          const nextExpanded: Record<string, boolean> = {};
          uniqueIps.forEach((ip) => {
            nextExpanded[ip] = expanded;
          });
          setExpandedIps(nextExpanded);
        };

        return (
          <div className="sub-card overflow-hidden">
            <div className="px-6 py-4 border-none bg-[rgba(0,0,0,0.02)] flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-[13px] font-[600] text-slate-800 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-slate-800 animate-pulse"></span>
                  诊断结果追踪{" "}
                  {results.length > 0 && `(共探测到 ${uniqueIps.length} 个 IP 地址)`}
                </h3>
                {results.length > 0 && (
                  <p className="text-[11px] text-[#8E8E93] mt-1 space-x-1">
                    系统一共发现{" "}
                    <span className="text-emerald-600 font-[700] font-mono">
                      {results.filter((r) => r.status === "open").length}
                    </span>{" "}
                    个开放活跃端口，点击整行或右侧按钮可二次查看全部探测详情。
                  </p>
                )}
              </div>
              {results.length > 0 && !loading && (
                <div className="flex items-center gap-1.5 self-end">
                  <span className="text-[11px] text-[#8E8E93] font-mono">过滤视图:</span>
                  <button
                    type="button"
                    onClick={() => setOnlyShowAlive(!onlyShowAlive)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 text-[11px] font-[600] rounded-[6px] transition-all duration-150 border-none",
                      onlyShowAlive
                        ? "bg-slate-800 text-white shadow-sm"
                        : "bg-white text-slate-600 hover:bg-[rgba(0,0,0,0.05)] shadow-xs"
                    )}
                  >
                    只看存活主机 ({groupedData.filter((g) => g.isAlive).length})
                  </button>
                </div>
              )}
            </div>

            {results.length > 0 && !loading && (
              <div className="flex border-b border-[rgba(0,0,0,0.05)] bg-[rgba(0,0,0,0.02)] p-2.5 gap-2 flex-wrap px-6">
                <button
                  type="button"
                  onClick={() => toggleAllIps(true)}
                  className="px-3 py-1.5 text-[11px] font-[600] text-slate-700 bg-white shadow-xs rounded-[6px] hover:bg-[rgba(0,0,0,0.02)] transition-colors border-none"
                >
                  展开所有 IP 端口面板
                </button>
                <button
                  type="button"
                  onClick={() => toggleAllIps(false)}
                  className="px-3 py-1.5 text-[11px] font-[600] text-[#8E8E93] bg-transparent hover:bg-[rgba(0,0,0,0.05)] rounded-[6px] transition-colors border-none"
                >
                  折叠所有 IP 面板
                </button>
              </div>
            )}

            <div className="p-0 overflow-y-auto">
              {loading ? (
                <div className="p-8 space-y-5 bg-[rgba(0,0,0,0.02)]">
                  <div className="flex justify-between items-center text-[13px]">
                    <span className="text-slate-600 font-[500] flex items-center gap-3">
                      <span className="inline-block w-4 h-4 border-2 border-slate-300 border-t-slate-800 rounded-full animate-spin"></span>
                      {progressStatus}
                    </span>
                    <span className="text-slate-800 font-[700] font-mono text-lg">
                      {progress}%
                    </span>
                  </div>

                  <div className="w-full bg-[rgba(0,0,0,0.04)] rounded-full h-3.5 overflow-hidden border-none">
                    <div
                      className="bg-slate-800 h-full rounded-full transition-all duration-300 ease-out"
                      style={{ width: `${progress}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-[11px] text-[#8E8E93] font-mono">
                    <span className="flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      SOCKET POOL: ACTIVE SCANNING
                    </span>
                    <span>TIMEOUT: 800ms</span>
                  </div>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-[rgba(0,0,0,0.05)] text-left text-[13px]">
                    <thead className="bg-[#EAEAEA]">
                      <tr>
                        <th className="w-12 px-4 py-3 text-center border-none">展开</th>
                        <th className="px-6 py-3 text-[11px] font-[600] text-slate-500 uppercase tracking-wider border-none">
                          IP 地址
                        </th>
                        <th className="px-6 py-3 text-[11px] font-[600] text-slate-500 uppercase tracking-wider border-none">
                          主机状态
                        </th>
                        <th className="px-6 py-3 text-[11px] font-[600] text-slate-500 uppercase tracking-wider border-none">
                          已放行端口 (绿色表示)
                        </th>
                        <th className="px-6 py-3 text-[11px] font-[600] text-slate-500 uppercase tracking-wider border-none">
                          检测响应情况
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-[600] text-slate-500 uppercase tracking-wider border-none">
                          细节诊断
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-[rgba(0,0,0,0.05)]">
                      {filteredGroupedData.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-[#8E8E93]">
                            未发现任何匹配结果
                          </td>
                        </tr>
                      ) : (
                        filteredGroupedData.map((g) => {
                          const isExpanded = !!expandedIps[g.ip];
                          return (
                            <React.Fragment key={g.ip}>
                              {/* Root IP Summary row */}
                              <tr
                                onClick={() => {
                                  setExpandedIps((prev) => ({
                                    ...prev,
                                    [g.ip]: !prev[g.ip],
                                  }));
                                }}
                                className={cn(
                                  "cursor-pointer hover:bg-[rgba(0,0,0,0.02)] transition-colors",
                                  g.isAlive ? "bg-emerald-50/20" : ""
                                )}
                              >
                                <td className="px-4 py-4 text-center">
                                  {isExpanded ? (
                                    <ChevronUp className="w-4 h-4 text-slate-500 mx-auto" />
                                  ) : (
                                    <ChevronDown className="w-4 h-4 text-[#8E8E93] mx-auto" />
                                  )}
                                </td>

                                {/* IP Address with optional green style */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center gap-2">
                                    {g.isAlive ? (
                                      <span className="flex h-2 w-2 relative">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-[4px] h-2 w-2 bg-emerald-500"></span>
                                      </span>
                                    ) : (
                                      <span className="h-2 w-2 rounded-[4px] bg-[rgba(0,0,0,0.1)]"></span>
                                    )}
                                    <span
                                      className={cn(
                                        "font-mono font-[600] text-[13px]",
                                        g.isAlive
                                          ? "text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-[6px]"
                                          : "text-slate-700"
                                      )}
                                    >
                                      {g.ip}
                                    </span>
                                  </div>
                                </td>

                                {/* Host Live Status with color code */}
                                <td className="px-6 py-4 whitespace-nowrap">
                                  {g.isAlive ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-[600] bg-emerald-50 text-emerald-800">
                                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                                      存活 (Active)
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-[500] bg-[rgba(0,0,0,0.02)] text-slate-500">
                                      <ShieldAlert className="w-3.5 h-3.5 text-[#8E8E93]" />
                                      未响应 / 闭塞
                                    </span>
                                  )}
                                </td>

                                {/* Open ports list shown in green */}
                                <td className="px-6 py-4">
                                  <div className="flex flex-wrap gap-1">
                                    {g.openPorts.length > 0 ? (
                                      g.openPorts.map((p) => (
                                        <span
                                          key={p.port}
                                          className="px-2 py-0.5 text-[11px] font-[600] rounded-[6px] bg-emerald-500 text-white shadow-sm border-none"
                                        >
                                          :{p.port}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[11px] text-[#8E8E93] font-mono italic">
                                        无开放活跃端口
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Scanned count status */}
                                <td className="px-6 py-4 whitespace-nowrap text-[11px] text-slate-500 font-mono">
                                  {g.openPorts.length} 开放 / {g.allPorts.length} 探测
                                </td>

                                {/* Toggle confirm details */}
                                <td className="px-4 py-4 whitespace-nowrap text-right text-[11px] font-[500]">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setExpandedIps((prev) => ({
                                        ...prev,
                                        [g.ip]: !prev[g.ip],
                                      }));
                                    }}
                                    className={cn(
                                      "px-3 py-1.5 rounded-[6px] transition-all duration-150 border-none font-[600]",
                                      isExpanded
                                        ? "bg-[rgba(0,0,0,0.04)] text-slate-700 hover:bg-[rgba(0,0,0,0.06)]"
                                        : "bg-slate-800 text-white hover:bg-slate-700"
                                    )}
                                  >
                                    {isExpanded ? "收起状态" : "二次点入 / 详情"}
                                  </button>
                                </td>
                              </tr>

                              {/* Collapsible / Secondary Details Grid */}
                              {isExpanded && (
                                <tr>
                                  <td
                                    colSpan={6}
                                    className="bg-[rgba(0,0,0,0.02)] border-t border-b border-[rgba(0,0,0,0.05)] p-0"
                                  >
                                    <div className="p-6 space-y-4 animate-in fade-in slide-in-from-top-1 duration-150">
                                      <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.05)] pb-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="w-1.5 h-3.5 bg-slate-800 rounded-sm"></span>
                                          <h4 className="text-[11px] font-[600] text-slate-700 font-mono">
                                            主机 {g.ip} 所有探测端口的完整分析详情:
                                          </h4>
                                        </div>
                                        <span className="text-[10px] text-[#8E8E93] font-mono">
                                          测试时延 ~ 800ms / 主机名反查未设置
                                        </span>
                                      </div>

                                      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
                                        {g.allPorts.map((portObj) => {
                                          const isOpen = portObj.status === "open";
                                          return (
                                            <div
                                              key={portObj.port}
                                              className={cn(
                                                "flex flex-col items-center justify-center p-2.5 border-none rounded-[8px] shadow-sm transition-all duration-100",
                                                isOpen
                                                  ? "bg-emerald-50"
                                                  : "bg-[rgba(0,0,0,0.02)] opacity-80"
                                              )}
                                            >
                                              <span
                                                className={cn(
                                                  "text-[13px] font-[600] font-mono",
                                                  isOpen ? "text-emerald-700" : "text-slate-500"
                                                )}
                                              >
                                                :{portObj.port}
                                              </span>
                                              <span
                                                className={cn(
                                                  "text-[9px] font-[600] tracking-tight uppercase mt-1 px-1.5 py-0.5 rounded-[4px]",
                                                  isOpen
                                                    ? "bg-emerald-500 text-white"
                                                    : "bg-[rgba(0,0,0,0.04)] text-[#8E8E93]"
                                                )}
                                              >
                                                {isOpen ? "OPEN" : "CLOSED"}
                                              </span>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
