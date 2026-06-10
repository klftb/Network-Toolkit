import React, { useState } from 'react';
import { diffLines, Change } from 'diff';
import { GitCompare, Copy, Check } from 'lucide-react';
import { cn } from '../lib/utils';

export function TextDiffTool() {
  const [original, setOriginal] = useState('');
  const [modified, setModified] = useState('');
  const [diffResult, setDiffResult] = useState<Change[]>([]);
  const [hasCompared, setHasCompared] = useState(false);

  const handleCompare = () => {
    const diff = diffLines(original, modified);
    setDiffResult(diff);
    setHasCompared(true);
  };

  const handleClear = () => {
    setOriginal('');
    setModified('');
    setDiffResult([]);
    setHasCompared(false);
  };

  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col">
      <div className="flex items-center gap-3 mb-6">
        <GitCompare className="w-6 h-6 text-slate-800" />
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">配置文本比对</h1>
      </div>

      <div className="flex gap-4 mb-4 flex-1 min-h-[300px]">
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-[13px] font-medium text-slate-700 flex justify-between">
            <span>原始版本 (Original)</span>
            {original && <span className="text-slate-400 font-normal">{original.split('\n').length} 行</span>}
          </label>
          <textarea
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            placeholder="粘贴原始配置或旧文本..."
            className="flex-1 w-full bg-white border border-slate-200 rounded-xl p-4 text-[13px] font-mono whitespace-pre overflow-auto focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 resize-none shadow-sm"
          />
        </div>
        <div className="flex-1 flex flex-col gap-2">
          <label className="text-[13px] font-medium text-slate-700 flex justify-between">
            <span>修改版本 (Modified)</span>
            {modified && <span className="text-slate-400 font-normal">{modified.split('\n').length} 行</span>}
          </label>
          <textarea
            value={modified}
            onChange={(e) => setModified(e.target.value)}
            placeholder="粘贴修改后的配置或新文本..."
            className="flex-1 w-full bg-white border border-slate-200 rounded-xl p-4 text-[13px] font-mono whitespace-pre overflow-auto focus:outline-none focus:border-slate-400 focus:ring-1 focus:ring-slate-400 resize-none shadow-sm"
          />
        </div>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={handleCompare}
          disabled={!original && !modified}
          className="px-6 h-[40px] bg-slate-900 hover:bg-slate-800 text-white rounded-[6px] text-[13px] font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          开始比对
        </button>
        <button
          onClick={handleClear}
          disabled={!original && !modified && !hasCompared}
          className="px-6 h-[40px] bg-white text-slate-700 hover:text-red-600 border border-slate-200 rounded-[6px] text-[13px] font-medium transition-colors shadow-sm disabled:opacity-50"
        >
          清空
        </button>
      </div>

      {hasCompared && (
        <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col min-h-[300px]">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <span className="text-[13px] font-medium text-slate-700">比对结果 (Diff)</span>
            <div className="flex gap-4 text-[12px]">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-100 border border-red-200 rounded-sm inline-block"></span> 删除的内容</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-100 border border-green-200 rounded-sm inline-block"></span> 新增的内容</span>
            </div>
          </div>
          <div className="p-4 flex-1 overflow-auto bg-slate-50 font-mono text-[13px] leading-relaxed">
            {diffResult.length === 1 && !diffResult[0].added && !diffResult[0].removed ? (
              <div className="text-slate-500 italic text-center py-8">文件内容完全一致</div>
            ) : diffResult.length === 0 ? (
              <div className="text-slate-500 italic text-center py-8">无内容</div>
            ) : (
              <pre className="m-0">
                {diffResult.map((part, index) => {
                  const colorClass = part.added ? 'bg-green-100 text-green-800' : part.removed ? 'bg-red-100 text-red-800' : 'text-slate-600';
                  const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
                  
                  // Handle lines
                  const lines = part.value.replace(/\n$/, '').split('\n');
                  
                  return (
                    <span key={index} className={cn("block w-full", colorClass)}>
                      {lines.map((line, i) => (
                        <div key={i} className="flex">
                           <span className="select-none w-6 text-slate-400 pl-1 shrink-0">{prefix}</span>
                           <span className="whitespace-pre-wrap word-break break-all">{line}</span>
                        </div>
                      ))}
                    </span>
                  );
                })}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
