import React, { useRef, useState } from 'react';
import { Settings, Download, Upload, Database, AlertCircle, CheckCircle2 } from 'lucide-react';
import { ToolComponentProps } from '../types';

export function SettingsTool({ onExportReady }: ToolComponentProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | 'idle', message: string }>({ type: 'idle', message: '' });

  const getExportData = () => {
    const data: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
            data[key] = localStorage.getItem(key);
        }
    }
    return JSON.stringify(data, null, 2);
  };

  const handleExport = () => {
    const appData = getExportData();
    const blob = new Blob([appData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nettools_backup_${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        try {
            const data = JSON.parse(event.target?.result as string);
            
            if (typeof data === 'object' && data !== null) {
                // Clear existing localStorage
                localStorage.clear();
                
                // Import new data
                for (const key in data) {
                    if (data.hasOwnProperty(key)) {
                        localStorage.setItem(key, data[key]);
                    }
                }
                
                setImportStatus({ type: 'success', message: '配置数据导入成功请刷新页面以生效。' });
                
                // Keep input value empty so same file can be selected again
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } else {
                throw new Error("Invalid format");
            }
        } catch (error) {
            setImportStatus({ type: 'error', message: '导入失败：文件格式不正确或已损坏。' });
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };
    reader.onerror = () => {
        setImportStatus({ type: 'error', message: '读取文件失败。' });
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 max-w-4xl mx-auto h-full flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Settings className="w-6 h-6 text-slate-800" />
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">配置与数据管理</h1>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-8">
        <div className="border-b border-slate-100 pb-6">
            <h2 className="text-lg font-medium text-slate-800 flex items-center gap-2 mb-2">
               <Database className="w-5 h-5 text-blue-600" />
               数据存储说明
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed">
                本工具的所有配置（包括密码本记录、自定义配置模板、测试历史记录、左侧菜单栏偏好等）全部安全地存储在您浏览器的<strong>本地存储 (LocalStorage)</strong> 中。
                为确保您的数据隐私，我们不会将任何配置或密码上传到任何云端服务器。
            </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Export Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col gap-4">
                <div>
                   <h3 className="font-medium text-slate-800 mb-1">导出整体配置 (Backup)</h3>
                   <p className="text-[13px] text-slate-500">将所有的本地数据打包为一个 JSON 文件下载，以便您在其他设备上恢复或作为备份保存。</p>
                </div>
                
                <div className="mt-auto pt-2">
                    <button 
                       onClick={handleExport}
                       className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium shadow-sm"
                    >
                        <Download className="w-4 h-4" /> 导出所有配置数据
                    </button>
                </div>
            </div>

            {/* Import Section */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 flex flex-col gap-4">
                <div>
                   <h3 className="font-medium text-slate-800 mb-1">导入整体配置 (Restore)</h3>
                   <p className="text-[13px] text-slate-500">从之前导出的 JSON 备份文件中恢复所有数据。<strong>注意：这将会覆盖您当前的全部本地数据，包括密码本的全部记录！</strong></p>
                </div>
                
                <div className="mt-auto pt-2 space-y-3">
                    <input 
                        type="file" 
                        accept=".json" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleImport}
                    />
                    <button 
                       onClick={() => fileInputRef.current?.click()}
                       className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium shadow-sm"
                    >
                        <Upload className="w-4 h-4" /> 选择并导入配置文件
                    </button>

                    {importStatus.type === 'success' && (
                        <div className="flex items-center gap-2 text-[13px] text-green-700 bg-green-50 p-2 rounded-md border border-green-100">
                           <CheckCircle2 className="w-4 h-4 shrink-0" /> {importStatus.message}
                           <button onClick={() => window.location.reload()} className="ml-auto underline font-medium">立即刷新</button>
                        </div>
                    )}

                    {importStatus.type === 'error' && (
                        <div className="flex items-center gap-2 text-[13px] text-red-700 bg-red-50 p-2 rounded-md border border-red-100">
                           <AlertCircle className="w-4 h-4 shrink-0" /> {importStatus.message}
                        </div>
                    )}
                </div>
            </div>
        </div>

        <div className="bg-orange-50 border border-orange-100 rounded-xl p-5 flex gap-3">
           <AlertCircle className="w-5 h-5 text-orange-600 shrink-0" />
           <div className="flex flex-col gap-1">
               <h4 className="font-medium text-orange-800 text-[14px]">数据覆盖风险警告</h4>
               <p className="text-[13px] text-orange-700 leading-relaxed">
                  导入配置将会<strong>清空设备当前的全部缓存数据</strong>，并替换为您文件中含有的数据。强烈建议您在进行导入操作之前，先使用“导出”功能备份当前设备最新的数据，以防数据丢失。
               </p>
           </div>
        </div>
      </div>
    </div>
  );
}
