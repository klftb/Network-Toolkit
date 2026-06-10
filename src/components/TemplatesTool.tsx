import React, { useState, useEffect } from 'react';
import { 
  FileCode, 
  Search, 
  Plus, 
  Edit, 
  Trash2, 
  Copy, 
  Check, 
  Download, 
  RotateCcw,
  Sliders,
  Settings,
  FolderOpen,
  Info,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { cn, downloadReport } from '../lib/utils';
import { addHistory } from '../lib/history';
import { ToolComponentProps } from '../types';

import { ConfigTemplate, DEFAULT_TEMPLATES, TEMPLATE_CATEGORIES } from '../data/templates';

export function TemplatesTool({ onExportReady }: ToolComponentProps) {
  // Use state to manage current templates loaded (stored in localStorage if changed)
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedTemplate, setSelectedTemplate] = useState<ConfigTemplate | null>(null);
  
  // Model management variables bindings (key: variableName, value: actualValue)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  
  // Clipboard copy confirmation visual effect
  const [copied, setCopied] = useState(false);

  // Management UI States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConfigTemplate | null>(null);

  // Form Fields for Add/Edit
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState<ConfigTemplate['category']>('Cisco');
  const [formDesc, setFormDesc] = useState('');
  const [formCode, setFormCode] = useState('');
  const [formVarsInput, setFormVarsInput] = useState(''); // comma-separated strings "PORT:物理口:1/0/1, VLAN:VLAN号:10"

  // 1. Initial Loading
  useEffect(() => {
    const saved = localStorage.getItem('nettools_templates_v3');
    if (saved) {
      try {
        setTemplates(JSON.parse(saved));
      } catch (e) {
        setTemplates(DEFAULT_TEMPLATES);
      }
    } else {
      setTemplates(DEFAULT_TEMPLATES);
      localStorage.setItem('nettools_templates_v3', JSON.stringify(DEFAULT_TEMPLATES));
    }
  }, []);

  // Update selected template values helper on choice change
  useEffect(() => {
    if (templates.length > 0) {
      // Pick the first template as default if none selected
      if (!selectedTemplate) {
        setSelectedTemplate(templates[0]);
      } else {
        // Keep selected reference in sync with updated dataset (e.g. after edit)
        const matched = templates.find(t => t.id === selectedTemplate.id);
        if (matched) {
          setSelectedTemplate(matched);
        } else {
          setSelectedTemplate(templates[0]);
        }
      }
    } else {
      setSelectedTemplate(null);
    }
  }, [templates]);

  // Sync variables state when selectedTemplate swap
  useEffect(() => {
    if (selectedTemplate) {
      const initialVals: Record<string, string> = {};
      selectedTemplate.variables.forEach(v => {
        initialVals[v.name] = v.defaultValue;
      });
      setVariableValues(initialVals);
    } else {
      setVariableValues({});
    }
    setCopied(false);
  }, [selectedTemplate]);

  // Compute live compiled code structure
  const getCompiledCode = () => {
    if (!selectedTemplate) return '';
    let processed = selectedTemplate.code;
    Object.entries(variableValues).forEach(([varName, val]) => {
      // Regex replace {{VAR}}
      const regex = new RegExp(`{{\\s*${varName}\\s*}}`, 'g');
      processed = processed.replace(regex, val || '');
    });
    return processed;
  };

  // Helper categories options
  const categories: string[] = TEMPLATE_CATEGORIES;

  const filteredTemplates = templates.filter(tmpl => {
    const query = searchQuery.toLowerCase();
    const matchSearch = 
      tmpl.title.toLowerCase().includes(query) ||
      tmpl.desc.toLowerCase().includes(query) ||
      tmpl.category.toLowerCase().includes(query) ||
      tmpl.code.toLowerCase().includes(query);
    
    const matchCat = selectedCategory === 'All' || tmpl.category === selectedCategory;
    return matchSearch && matchCat;
  });

  // Save templates list to browser memory
  const persistTemplates = (updatedList: ConfigTemplate[]) => {
    setTemplates(updatedList);
    localStorage.setItem('nettools_templates_v3', JSON.stringify(updatedList));
  };

  // 2. Add or Edit handler modal trigger
  const handleOpenEditor = (target: ConfigTemplate | null = null) => {
    if (target) {
      // Setup edit mode
      setEditingTemplate(target);
      setFormTitle(target.title);
      setFormCategory(target.category);
      setFormDesc(target.desc);
      setFormCode(target.code);
      
      // Serialize variables back to plain lines
      const varsString = target.variables
        .map(v => `${v.name}:${v.label}:${v.defaultValue}`)
        .join('\n');
      setFormVarsInput(varsString);
    } else {
      // Setup create mode
      setEditingTemplate(null);
      setFormTitle('');
      setFormCategory('Cisco');
      setFormDesc('');
      setFormCode('// 粘帖您的新模版代码\n// 推荐使用 {{VAR_NAME}} 作为自定义字段变量占位符。\n\ninterface GigabitEthernet{{PORT}}');
      setFormVarsInput('PORT:端口号:1/0/1');
    }
    setIsEditorOpen(true);
  };

  // Save newly modified structure
  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formCode.trim()) return;

    // Parse Variables lines
    const parsedVariables: ConfigTemplate['variables'] = [];
    formVarsInput.split('\n').forEach(line => {
      const parts = line.trim().split(':');
      if (parts[0] && parts[1]) {
        parsedVariables.push({
          name: parts[0].trim(),
          label: parts[1].trim(),
          defaultValue: parts[2] ? parts[2].trim() : ''
        });
      }
    });

    // Fallback: If no custom variables are defined, look up any matches dynamically inside code e.g. {{VARIABLE}}
    if (parsedVariables.length === 0) {
      const varMatches = formCode.match(/{{\s*([A-Za-z0-9_-]+)\s*}}/g);
      if (varMatches) {
        const uniqueMatches = Array.from(new Set(varMatches.map(m => m.replace(/[{{\s}}]/g, '')))) as string[];
        uniqueMatches.forEach(name => {
          parsedVariables.push({
            name,
            label: `参数 ${name}`,
            defaultValue: 'Value'
          });
        });
      }
    }

    let updatedList: ConfigTemplate[] = [];

    if (editingTemplate) {
      // Save Existing Edit representation
      updatedList = templates.map(t => {
        if (t.id === editingTemplate.id) {
          return {
            ...t,
            title: formTitle,
            category: formCategory,
            desc: formDesc,
            code: formCode,
            variables: parsedVariables
          };
        }
        return t;
      });
      addHistory({
        toolId: 'batchgen', // map to template engine matching
        toolName: '配置模板管理',
        target: formTitle,
        summary: `更新配置模版 "${formTitle}"，分类: ${formCategory}`
      });
    } else {
      // Append New Document Record
      const newId = `custom-${Date.now()}`;
      const newTmpl: ConfigTemplate = {
        id: newId,
        title: formTitle,
        category: formCategory,
        desc: formDesc,
        code: formCode,
        variables: parsedVariables,
        isCustom: true
      };
      updatedList = [...templates, newTmpl];
      addHistory({
        toolId: 'batchgen',
        toolName: '配置模板管理',
        target: formTitle,
        summary: `创建自定义配置模版 "${formTitle}"，分类: ${formCategory}`
      });
    }

    persistTemplates(updatedList);
    setIsEditorOpen(false);

    // Swap Selection to saved item
    const matched = updatedList.find(i => i.title === formTitle);
    if (matched) {
      setSelectedTemplate(matched);
    }
  };

  // Delete matching config
  const handleDeleteTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('您确定要彻底删除该配置模板吗？此操作无法撤销。')) return;

    const filtered = templates.filter(t => t.id !== id);
    persistTemplates(filtered);
    
    if (selectedTemplate?.id === id) {
      setSelectedTemplate(filtered[0] || null);
    }
  };

  // Reset to original predefined backups
  const handleResetToDefaults = () => {
    if (!window.confirm('该操作将清除您新增的所有自定义模板，并重新回滚所有系统自带出厂设置。继续？')) return;
    persistTemplates(DEFAULT_TEMPLATES);
    setSelectedTemplate(DEFAULT_TEMPLATES[0]);
    addHistory({
      toolId: 'batchgen',
      toolName: '配置模板回滚',
      target: '全集模板库',
      summary: '全量恢复内置系统预设配置模板'
    });
  };

  // Copy code to clipboard with alert response
  const handleCopyCode = () => {
    const text = getCompiledCode();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download code template directly
  const handleDownloadCode = () => {
    if (!selectedTemplate) return;
    const codeContent = getCompiledCode();
    let extStr = 'txt';
    if (['Cisco', 'HuaWei', 'H3C', 'Forti'].includes(selectedTemplate.category)) extStr = 'cfg';
    else if (selectedTemplate.category === 'Rocky') extStr = 'conf';
    
    downloadReport(`template_${selectedTemplate.category.toLowerCase()}_${selectedTemplate.id}`, codeContent);
  };

  return (
    <div className="space-y-6">
      {/* Visual Title Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-[600] text-slate-800 flex items-center gap-2">
            配置模板中心
          </h2>
          <p className="text-[13px] text-[#8E8E93] mt-1">
            提供主流交换机/路由器设备命令、Nginx配置流、Docker安全容器等通用脚本模版查询、动态变量表单注入和自定义模版管理
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleResetToDefaults}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-[500] text-slate-700 bg-[rgba(0,0,0,0.02)] hover:bg-[rgba(0,0,0,0.05)] rounded-xl transition-colors border-none"
            title="恢复所有系统出厂模版"
          >
            <RotateCcw className="w-4 h-4" />
            重置预设
          </button>
          <button
            onClick={() => handleOpenEditor(null)}
            className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-[600] text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors border-none"
          >
            <Plus className="w-4 h-4" />
            新增自定义模板
          </button>
        </div>
      </div>

      {/* Main Structural Layout split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Side: Template Directory & Query Panel (5-span) */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="sub-card p-4 space-y-4">
            <h3 className="text-[13px] font-[600] text-slate-800 tracking-tight flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-800"></span>
              模板目录和条件查询
            </h3>

            {/* Sub-search tools */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="搜索模板名称, 支持模糊匹配高亮..."
                className="w-full pl-9 pr-4 py-2.5 bg-[rgba(0,0,0,0.02)] border-none rounded-xl text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all placeholder-[#8E8E93]"
              />
            </div>

            {/* Filter Tabs Pills scroll */}
            <div className="flex gap-1.5 flex-wrap">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 text-[11px] font-[600] rounded-[12px] transition-colors border-none flex-shrink-0 cursor-pointer",
                    selectedCategory === cat
                      ? "bg-slate-800 text-white shadow-sm"
                      : "bg-transparent text-slate-600 hover:bg-[rgba(0,0,0,0.05)]"
                  )}
                >
                  {cat === 'All' ? '全部' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* List display panel */}
          <div className="sub-card max-h-[500px] overflow-y-auto divide-y divide-[rgba(0,0,0,0.05)]">
            {filteredTemplates.length === 0 ? (
              <div className="p-12 text-center text-[#8E8E93] text-[13px]">
                没有检索到符合过滤条件的配置模板，您可以尝试在此新增自定义。
              </div>
            ) : (
              filteredTemplates.map(tmpl => {
                const isCurrent = selectedTemplate?.id === tmpl.id;
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => setSelectedTemplate(tmpl)}
                    className={cn(
                      "p-4 cursor-pointer transition-colors flex justify-between items-start gap-3 relative group text-left",
                      isCurrent 
                        ? "bg-[rgba(0,0,0,0.02)]" 
                        : "hover:bg-[rgba(0,0,0,0.02)]"
                    )}
                  >
                    {isCurrent && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-slate-800" />
                    )}
                    <div className="space-y-1.5 select-none flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn(
                          "px-2 py-0.5 rounded-[4px] text-[9px] font-[700] uppercase tracking-wider",
                          tmpl.category === 'Cisco' ? "bg-slate-100 text-slate-700" :
                          tmpl.category === 'HuaWei' ? "bg-slate-100 text-slate-700" :
                          tmpl.category === 'H3C' ? "bg-slate-100 text-slate-700" :
                          tmpl.category === 'Forti' ? "bg-slate-100 text-slate-700" :
                          tmpl.category === 'Rocky' ? "bg-slate-100 text-slate-700" :
                          "bg-slate-100 text-slate-700"
                        )}>
                          {tmpl.category}
                        </span>
                        {tmpl.isCustom && (
                          <span className="bg-[rgba(0,0,0,0.04)] text-slate-600 px-2 py-0.5 rounded-[4px] text-[9px] font-[700]">
                            自定义
                          </span>
                        )}
                      </div>
                      <h4 className="text-[13px] font-[600] text-slate-800 line-clamp-1">{tmpl.title}</h4>
                      <p className="text-[11px] text-[#8E8E93] line-clamp-2 leading-relaxed">{tmpl.desc}</p>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {tmpl.isCustom && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditor(tmpl);
                            }}
                            className="p-1.5 hover:bg-[rgba(0,0,0,0.05)] rounded-[6px] text-slate-500 hover:text-slate-800 border-none transition-colors"
                            title="修改模版内容"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={(e) => handleDeleteTemplate(tmpl.id, e)}
                            className="p-1.5 hover:bg-rose-50 rounded-[6px] text-rose-500 hover:text-rose-700 border-none transition-colors"
                            title="彻底删除"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                      <ChevronRight className={cn(
                        "w-4 h-4 text-slate-300 transition-transform",
                        isCurrent && "translate-x-0.5 text-slate-800"
                      )} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Interactive Rendering & Values Editor (7-span) */}
        <div className="lg:col-span-7 space-y-6">
          {selectedTemplate ? (
            <div className="space-y-6">
              
              {/* Box 1: Dynamic Variables Input Form */}
              <div className="sub-card p-6 space-y-4">
                <div className="flex items-center justify-between border-b border-[rgba(0,0,0,0.05)] pb-3">
                  <h3 className="text-[13px] font-[600] text-slate-800 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-800"></span>
                    参数表单变量注入
                  </h3>
                  <span className="text-[11px] text-[#8E8E93] font-mono">修改内容即时渲染预览</span>
                </div>

                {selectedTemplate.variables.length === 0 ? (
                  <div className="flex items-center gap-2 text-[11px] text-[#8E8E93] py-2 font-[500]">
                    <Info className="w-4 h-4 shrink-0" />
                    本模板为静态模版，无需配置动态环境变量。您可以直接复制使用。
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {selectedTemplate.variables.map(v => (
                      <div key={v.name} className="space-y-1.5">
                        <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider">
                          {v.label} <code className="text-[9px] font-mono text-slate-600 bg-[rgba(0,0,0,0.04)] px-1 py-0.5 rounded-[4px] ml-1">{"{{" + v.name + "}}"}</code>
                        </label>
                        <input
                          type="text"
                          value={variableValues[v.name] || ''}
                          onChange={(e) => {
                            setVariableValues(prev => ({
                              ...prev,
                              [v.name]: e.target.value
                            }));
                          }}
                          placeholder={v.placeholder || v.defaultValue}
                          className="w-full px-3 py-2 bg-[rgba(0,0,0,0.02)] border-none rounded-[8px] text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 transition-all font-mono"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Box 2: Code Code Preview and Output Drawer */}
              <div className="sub-card overflow-hidden">
                <div className="bg-[rgba(0,0,0,0.02)] px-6 py-4 flex justify-between items-center border-b border-[rgba(0,0,0,0.05)]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-800" />
                    <span className="text-[11px] font-[700] text-slate-700 font-mono block max-w-sm truncate uppercase tracking-wider">
                      {selectedTemplate.title} - 预览配置
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCopyCode}
                      className="px-3 py-1.5 text-[11px] font-[600] text-slate-700 bg-white shadow-xs rounded-[6px] hover:bg-[rgba(0,0,0,0.02)] transition-colors flex items-center gap-1.5 border-none"
                      title="复制完整配置"
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-600">已复制!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          <span>一键复制</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleDownloadCode}
                      className="px-3 py-1.5 text-[11px] font-[600] text-white bg-slate-800 rounded-[6px] hover:bg-slate-700 transition-colors flex items-center gap-1.5 border-none"
                      title="下载为本地配置文件"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>导出文件</span>
                    </button>
                  </div>
                </div>

                {/* Preformatted Output container */}
                <pre className="p-6 overflow-auto max-h-[350px] font-mono text-slate-800 text-[13px] leading-relaxed select-all bg-[#F9F9F9] text-left">
                  <code>{getCompiledCode()}</code>
                </pre>
              </div>

            </div>
          ) : (
            <div className="sub-card p-12 text-center text-[#8E8E93] text-[13px]">
              请在左侧选取列表模版以执行变量配置诊断及预览复制。
            </div>
          )}
        </div>

      </div>

      {/* Box 3: Form Add/Edit Editor Modal Overlay */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white w-full max-w-2xl rounded-[16px] border-none shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            
            <div className="bg-[rgba(0,0,0,0.02)] px-6 py-4 flex items-center justify-between border-b border-[rgba(0,0,0,0.05)]">
              <h3 className="text-[14px] font-[600] text-slate-800 flex items-center gap-2">
                {editingTemplate ? '编辑配置模版' : '创建自定义配置模版'}
              </h3>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="text-slate-500 hover:text-slate-800 text-[13px] font-[500] p-1.5 hover:bg-[rgba(0,0,0,0.05)] rounded-[6px] transition-colors border-none"
              >
                关闭
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="p-6 overflow-y-auto space-y-5 flex-1">
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider">模板名称 *</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={e => setFormTitle(e.target.value)}
                    placeholder="如: H3C 汇聚交换机端口防雷及VLAN绑定"
                    className="w-full px-4 py-2.5 bg-[rgba(0,0,0,0.02)] border-none rounded-[8px] text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 font-sans shadow-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider">应用范畴分类 *</label>
                  <select
                    value={formCategory}
                    onChange={e => setFormCategory(e.target.value as ConfigTemplate['category'])}
                    className="w-full px-4 py-2.5 bg-[rgba(0,0,0,0.02)] border-none rounded-[8px] text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 shadow-sm"
                  >
                    {categories.filter(c => c !== 'All').map(c => (
                      <option key={c} value={c}>{c} 设备配置</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider">模版功能描述</label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={e => setFormDesc(e.target.value)}
                  placeholder="一句话介绍该配置命令主要适合什么级别的设备以及注意事项"
                  className="w-full px-4 py-2.5 bg-[rgba(0,0,0,0.02)] border-none rounded-[8px] text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 font-sans shadow-sm"
                />
              </div>

              {/* Double Column variable details */}
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                
                {/* Code Body Edit segment (7-cols) */}
                <div className="md:col-span-8 space-y-2">
                  <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider flex justify-between">
                    <span>模版代码正文 *</span>
                    <span className="text-[#8E8E93] font-normal lowercase">支持用 {"{{VAR}}"} 定义插槽</span>
                  </label>
                  <textarea
                    required
                    rows={12}
                    value={formCode}
                    onChange={e => setFormCode(e.target.value)}
                    placeholder={`# 敲入您的脚本指令
interface GigabitEthernet{{PORT}}
  description User_Uplink
  switchport access vlan {{VLAN_ID}}`}
                    className="w-full px-4 py-3 bg-[rgba(0,0,0,0.02)] border-none rounded-[8px] text-[13px] text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-800 shadow-sm leading-relaxed"
                  />
                </div>

                {/* Variables configurations dictionary (4-cols) */}
                <div className="md:col-span-4 space-y-2">
                  <label className="block text-[11px] font-[600] text-slate-500 uppercase tracking-wider">
                    配置变量字典
                  </label>
                  <p className="text-[11px] text-[#8E8E93] leading-relaxed">
                    每行代表一个字段:
                    <code className="block bg-[rgba(0,0,0,0.04)] px-2 py-1 rounded-[6px] font-mono text-[10px] text-slate-600 mt-1.5 select-all">
                      参数名:名称:默认值
                    </code>
                  </p>
                  <textarea
                    rows={8}
                    value={formVarsInput}
                    onChange={e => setFormVarsInput(e.target.value)}
                    placeholder="PORT:物理网口:1/0/24&#10;VLAN_ID:业务VLAN:10"
                    className="w-full px-3 py-2 bg-[rgba(0,0,0,0.02)] border-none rounded-[8px] text-[11px] font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-800 shadow-sm"
                  />
                </div>

              </div>

              {/* Submit Buttons footer */}
              <div className="border-t border-[rgba(0,0,0,0.05)] pt-5 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 bg-transparent hover:bg-[rgba(0,0,0,0.05)] text-slate-700 rounded-[8px] transition-colors text-[13px] font-[500] border-none"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-slate-800 text-white rounded-[8px] text-[13px] font-[600] hover:bg-slate-700 transition-colors shadow-sm border-none"
                >
                  保存模版
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
