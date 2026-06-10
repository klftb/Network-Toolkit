import React, { useState, useEffect } from 'react';
import { PenTool, Download } from 'lucide-react';
import { Excalidraw, exportToBlob } from '@excalidraw/excalidraw';
import "@excalidraw/excalidraw/index.css";
import { ToolComponentProps } from '../types';

export function ExcalidrawTool({ onExportReady }: ToolComponentProps) {
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  const handleExport = async () => {
    if (!excalidrawAPI) return;
    const elements = excalidrawAPI.getSceneElements();
    if (!elements || !elements.length) return;
    
    try {
      const blob = await exportToBlob({
        elements,
        appState: excalidrawAPI.getAppState(),
        files: excalidrawAPI.getFiles(),
        mimeType: "image/png",
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `network-sketch-${new Date().getTime()}.png`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      console.warn("Export failed", e);
    }
  };

  return (
    <div className="sub-card overflow-hidden min-h-[500px] h-[calc(100vh-140px)] flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-[rgba(0,0,0,0.05)] flex justify-between items-center bg-[rgba(0,0,0,0.02)] shrink-0">
        <div>
          <h2 className="text-[14px] font-[600] text-slate-800 flex items-center gap-2">
            <PenTool className="w-5 h-5 text-slate-700" />
            白板草图 (Excalidraw)
          </h2>
          <p className="text-[11px] text-[#8E8E93] mt-1">完全离线使用的画板，适合绘制网络拓扑和架构草图</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.05)] text-slate-700 rounded-[8px] transition-colors text-[13px] font-[500] border-none"
          >
            <Download className="w-4 h-4" /> 导出 PNG
          </button>
        </div>
      </div>

      <div className="flex-1 w-full h-full relative z-0">
        <Excalidraw 
          excalidrawAPI={(api) => setExcalidrawAPI(api)}
          UIOptions={{
            canvasActions: {
              saveToActiveFile: false,
              loadScene: false,
              export: false,
            }
          }}
        />
      </div>
    </div>
  );
}
