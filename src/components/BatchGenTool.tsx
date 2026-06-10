import React, { useState, useEffect } from 'react';
import { Wand2, Download, Copy, Play } from 'lucide-react';
import { downloadReport, cn } from '../lib/utils';
import { addHistory } from '../lib/history';
import { ToolComponentProps } from '../types';

export function BatchGenTool({ onExportReady }: ToolComponentProps) {
  const [dataInput, setDataInput] = useState('apple, red\nbanana, yellow\ncherry, red');
  const [patternInput, setPatternInput] = useState('The $0 is $1.');
  const [colSep, setColSep] = useState(',');
  const [output, setOutput] = useState('');

  const generate = () => {
    try {
      const rows = dataInput.split('\n').filter(r => r.trim() !== '');
      const results = rows.map(row => { // Ignore Empty rows
        let cols: string[] = [];
        if (colSep === '\\t') {
           cols = row.split('\t');
        } else {
           cols = row.split(colSep);
        }
        cols = cols.map(c => c.trim());

        let res = patternInput;
        cols.forEach((col, idx) => {
          // Replace $0, $1, etc.
          res = res.split(`$${idx}`).join(col);
        });
        
        // Also support $ROWNUM
        // Currently skipped for simplicity, but easily addable.
        return res;
      });
      const finalOut = results.join('\n');
      setOutput(finalOut);
    } catch(e) {
      console.warn('BatchGenTool Error:', e);
      setOutput('处理出错，请检查输入格式。');
    }
  };

  useEffect(() => {
    generate();
  }, [dataInput, patternInput, colSep]);

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    alert('已复制到剪贴板');
  };

  const handleExport = () => {
    downloadReport('BatchGen', output);
    addHistory({
      toolId: 'batchgen',
      toolName: '文本批处理',
      target: '数据转换',
      summary: `使用了批量生成，输出了 ${output.split('\n').length} 行数据`
    });
  };

  return (
    <div className="sub-card overflow-hidden min-h-[500px] flex flex-col">
      <div className="p-6 border-none flex justify-between items-center bg-[rgba(0,0,0,0.02)]">
        <div>
          <h2 className="text-[14px] font-[600] text-slate-800 flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-slate-700" />
            文本批处理工具
          </h2>
          <p className="text-[11px] text-[#8E8E93] mt-1">类似 NimbleText，批量处理行数据并应用模板 (使用 $0, $1 引用列)</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 bg-transparent hover:bg-[rgba(0,0,0,0.05)] text-slate-700 rounded-xl transition-colors text-[13px] font-[500] border-none"
          >
            <Copy className="w-4 h-4" /> 复制结果
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl hover:bg-slate-700 transition-colors shadow-sm text-[13px] font-[600] border-none"
          >
            <Download className="w-4 h-4" /> 导出文本
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 bg-white">
        {/* Left Side: Inputs */}
        <div className="flex flex-col gap-4">
          <div className="flex-1 flex flex-col min-h-[200px]">
             <div className="flex justify-between items-center mb-2">
               <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider">数据 (每行一条记录)</label>
               <div className="flex items-center gap-2 text-[11px]">
                 <span className="text-[#8E8E93] font-[500]">列分隔符:</span>
                 <select 
                   value={colSep} 
                   onChange={(e) => setColSep(e.target.value)}
                   className="border-none rounded-lg px-2 py-1 bg-[rgba(0,0,0,0.02)] text-slate-700 focus:ring-2 focus:ring-slate-800 outline-none"
                 >
                   <option value=",">逗号 (,)</option>
                   <option value="\t">制表符 (Tab)</option>
                   <option value="|">竖线 (|)</option>
                   <option value=" ">空格 (Space)</option>
                   <option value=";">分号 (;)</option>
                 </select>
               </div>
             </div>
             <textarea 
               value={dataInput} 
               onChange={(e) => setDataInput(e.target.value)}
               className="flex-1 min-h-0 w-full rounded-xl border-none bg-[rgba(0,0,0,0.02)] px-4 py-3 text-[13px] text-slate-800 focus:ring-2 focus:ring-slate-800 transition-all font-mono shadow-sm resize-none outline-none"
               placeholder="192.168.1.1, router&#10;192.168.1.2, switch"
             />
          </div>

          <div className="h-32 flex flex-col">
             <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider mb-2">模板 (用 $0, $1 表示第几列数据)</label>
             <textarea 
               value={patternInput} 
               onChange={(e) => setPatternInput(e.target.value)}
               className="flex-1 min-h-0 w-full rounded-xl border-none bg-[rgba(0,0,0,0.02)] px-4 py-3 text-[13px] text-slate-800 focus:ring-2 focus:ring-slate-800 transition-all font-mono shadow-sm resize-none outline-none"
               placeholder="ping -c 4 $0 // check $1"
             />
          </div>
        </div>

        {/* Right Side: Output */}
        <div className="flex flex-col">
          <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider mb-2">输出结果预览</label>
          <textarea 
            readOnly
            value={output}
            className="flex-1 min-h-0 w-full rounded-xl border-none bg-[rgba(0,0,0,0.04)] px-4 py-3 text-[13px] text-slate-800 font-mono overflow-auto focus:outline-none resize-none shadow-sm"
            placeholder="结果将在此处显示..."
          />
        </div>
      </div>
    </div>
  );
}
