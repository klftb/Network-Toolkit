import React, { useState, useEffect, useCallback, useRef } from 'react';
import { KeyRound, Copy, Check, RefreshCw, Plus, Trash2, Edit2, Eye, EyeOff, Save, X, List, Shield, Clock, ArrowRight, ShieldCheck, Download, Upload, Lock, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import * as kdbxweb from 'kdbxweb';

interface PasswordRecord {
  id: string;
  title: string;
  username: string;
  password: string;
  notes: string;
  createdAt: number;
  updatedAt: number;
}

export function PasswordTool() {
  const [activeTab, setActiveTab] = useState<'generator' | 'manager'>('manager'); // Default to manager

  // === Generator State ===
  const [password, setPassword] = useState('');
  const [length, setLength] = useState(16);
  const [includeUppercase, setIncludeUppercase] = useState(true);
  const [includeLowercase, setIncludeLowercase] = useState(true);
  const [includeNumbers, setIncludeNumbers] = useState(true);
  const [includeSymbols, setIncludeSymbols] = useState(true);
  const [copiedGen, setCopiedGen] = useState(false);

  // === Manager State ===
  const [records, setRecords] = useState<PasswordRecord[]>([]);
  const [editingRecord, setEditingRecord] = useState<PasswordRecord | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // === KeePass Import State ===
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load records on mount
  useEffect(() => {
    const saved = localStorage.getItem('pwd_records');
    if (saved) {
      try {
        setRecords(JSON.parse(saved));
      } catch (e) {
         console.error('Failed to parse password records');
      }
    }
  }, []);

  // Save records
  const saveRecords = (newRecords: PasswordRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem('pwd_records', JSON.stringify(newRecords));
  };

  const generatePassword = useCallback(() => {
    let charset = '';
    if (includeLowercase) charset += 'abcdefghijklmnopqrstuvwxyz';
    if (includeUppercase) charset += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    if (includeNumbers) charset += '0123456789';
    if (includeSymbols) charset += '!@#$%^&*()_+~`|}{[]:;?><,./-=';
    
    if (charset === '') {
        setPassword('请至少选择一种字符类型');
        return;
    }

    let newPassword = '';
    for (let i = 0; i < length; ++i) {
      newPassword += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    setPassword(newPassword);
    setCopiedGen(false);
  }, [length, includeUppercase, includeLowercase, includeNumbers, includeSymbols]);

  useEffect(() => {
    generatePassword();
  }, [generatePassword]);

  const handleCopyGen = () => {
    if (!password || password === '请至少选择一种字符类型') return;
    navigator.clipboard.writeText(password);
    setCopiedGen(true);
    setTimeout(() => setCopiedGen(false), 2000);
  };
  
  const handleCopyText = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Check strength for any given password
  const getPasswordStrength = (pwd: string) => {
    if (!pwd || pwd === '请至少选择一种字符类型') return 0;
    let strengthLevel = 0;
    if (pwd.length >= 8) strengthLevel += 1;
    if (pwd.length >= 12) strengthLevel += 1;
    if (pwd.length >= 16) strengthLevel += 1;
    if (/[A-Z]/.test(pwd)) strengthLevel += 1;
    if (/[a-z]/.test(pwd)) strengthLevel += 1;
    if (/[0-9]/.test(pwd)) strengthLevel += 1;
    if (/[^A-Za-z0-9]/.test(pwd)) strengthLevel += 1;
    
    return Math.min(5, Math.ceil(strengthLevel / 7 * 5));
  };
  
  const strengthGen = getPasswordStrength(password);
  const strengthForm = getPasswordStrength(formPassword);

  const strengthColors = ['bg-slate-200', 'bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500', 'bg-green-500'];
  const strengthLabels = ['', '非常弱', '弱', '中等', '强', '非常强'];

  // Manager Actions
  const handleSaveRecord = () => {
    if (!formTitle) {
      alert("请输入配置标题或平台名称");
      return;
    }
    
    const now = Date.now();
    let newRecords: PasswordRecord[];

    if (editingRecord) {
       newRecords = records.map(r => r.id === editingRecord.id ? {
          ...r,
          title: formTitle,
          username: formUsername,
          password: formPassword,
          notes: formNotes,
          updatedAt: now
       } : r);
    } else {
       newRecords = [{
          id: Math.random().toString(36).substring(2, 9),
          title: formTitle,
          username: formUsername,
          password: formPassword,
          notes: formNotes,
          createdAt: now,
          updatedAt: now
       }, ...records];
    }
    
    saveRecords(newRecords);
    closeForm();
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRecord(null);
    setFormTitle('');
    setFormUsername('');
    setFormPassword('');
    setFormNotes('');
  };

  const openEdit = (record: PasswordRecord) => {
    setEditingRecord(record);
    setFormTitle(record.title);
    setFormUsername(record.username);
    setFormPassword(record.password);
    setFormNotes(record.notes);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('确定要删除此密码记录吗？此操作无法恢复。')) {
      saveRecords(records.filter(r => r.id !== id));
    }
  };

  const toggleVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const applyGenPasswordToForm = () => {
      setFormPassword(password);
      setActiveTab('manager');
      setShowForm(true);
  };
  
  const formatDate = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setImportError('');
      setImportPassword('');
      setShowImportModal(true);
    }
    // clear input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportKeePass = async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    setImportError('');
    
    try {
      // Setup WebCrypto
      if (!window.crypto || !window.crypto.subtle) {
         kdbxweb.CryptoEngine.setArgon2Impl(async () => {
             throw new Error("Argon2 is not supported in this environment without specific polyfills, but WebCrypto is required for KeePass parsing.");
         });
      }

      const arrayBuffer = await importFile.arrayBuffer();
      const credentials = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(importPassword));
      
      const db = await kdbxweb.Kdbx.load(arrayBuffer, credentials);
      
      const newRecords: PasswordRecord[] = [];
      const now = Date.now();
      
      for (const group of db.groups) {
         for (const entry of group.allEntries()) {
            const titleField = entry.fields.get('Title');
            const userField = entry.fields.get('UserName');
            const passField = entry.fields.get('Password');
            const notesField = entry.fields.get('Notes');
            
            const title = titleField instanceof kdbxweb.ProtectedValue ? titleField.getText() : (titleField as string) || '未命名记录';
            const username = userField instanceof kdbxweb.ProtectedValue ? userField.getText() : (userField as string) || '';
            const password = passField instanceof kdbxweb.ProtectedValue ? passField.getText() : (passField as string) || '';
            const notes = notesField instanceof kdbxweb.ProtectedValue ? notesField.getText() : (notesField as string) || '';
            
            if (title || username || password) {
               newRecords.push({
                 id: Math.random().toString(36).substring(2, 9) + '-' + Math.random().toString(36).substring(2, 9),
                 title,
                 username,
                 password,
                 notes,
                 createdAt: entry.times.creationTime ? entry.times.creationTime.getTime() : now,
                 updatedAt: entry.times.lastModTime ? entry.times.lastModTime.getTime() : now
               });
            }
         }
      }
      
      if (newRecords.length > 0) {
          saveRecords([...newRecords, ...records]);
          alert(`成功导入 ${newRecords.length} 条密码记录！`);
      } else {
          alert('未能从文件中提取出任何记录。');
      }
      
      setShowImportModal(false);
      setImportFile(null);
      setImportPassword('');
    } catch (e: any) {
      console.error(e);
      if (e && e.code === 'InvalidKey') {
          setImportError('密码错误或密钥文件损坏。');
      } else if (e && e.message) {
          setImportError(`导入失败: ${e.message}`);
      } else {
          setImportError('解析数据库失败，请检查密码和文件格式。');
      }
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto h-full flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <KeyRound className="w-6 h-6 text-slate-800" />
        <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">密码管理工具</h1>
      </div>

      <div className="flex gap-4 border-b border-[#E0E0E0]">
        <button
          className={cn(
            "pb-3 px-2 font-medium transition-colors border-b-2 flex items-center gap-2",
            activeTab === 'generator' ? "border-slate-800 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
          onClick={() => setActiveTab('generator')}
        >
          <Shield className="w-4 h-4" /> 随机密码生成
        </button>
        <button
          className={cn(
            "pb-3 px-2 font-medium transition-colors border-b-2 flex items-center gap-2",
            activeTab === 'manager' ? "border-slate-800 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
          onClick={() => setActiveTab('manager')}
        >
          <List className="w-4 h-4" /> 密码本配置记录
        </button>
      </div>

      {activeTab === 'generator' && (
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-8 flex-1">
            
            {/* Password Display */}
            <div className="relative">
              <div className="bg-slate-50 border border-slate-200 p-6 rounded-lg flex items-center justify-between group h-24">
                <span className={cn(
                    "text-2xl font-mono tracking-wider break-all leading-tight pr-4",
                    password === '请至少选择一种字符类型' ? 'text-slate-400 text-base' : 'text-slate-800'
                )}>
                  {password}
                </span>
                <div className="flex items-center gap-2 shrink-0">
                   <button
                    onClick={generatePassword}
                    className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                    title="重新生成"
                   >
                     <RefreshCw className="w-5 h-5" />
                   </button>
                   <button
                    onClick={handleCopyGen}
                    className="px-3 py-2 text-slate-600 bg-white border border-slate-200 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
                    title="复制密码"
                   >
                     {copiedGen ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                     {copiedGen ? '已复制' : '复制密码'}
                   </button>
                   <button 
                    onClick={applyGenPasswordToForm}
                    className="px-3 py-2 bg-slate-900 text-white hover:bg-slate-800 rounded-md transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
                    title="记录此密码"
                   >
                     记录
                     <ArrowRight className="w-4 h-4" />
                   </button>
                </div>
              </div>
              
              <div className="mt-4 flex items-center gap-3">
                <span className="text-[13px] text-slate-600 font-medium whitespace-nowrap">实时强度校验:</span>
                <div className="flex-1 flex gap-1 h-2 max-w-sm">
                    {[1, 2, 3, 4, 5].map((level) => {
                        const isActive = level <= strengthGen;
                        const colorClass = isActive ? strengthColors[strengthGen] : "bg-slate-100";
                        return (
                           <div 
                               key={level} 
                               className={cn("flex-1 rounded-full transition-colors duration-300", colorClass)}
                           />
                        );
                    })}
                </div>
                <span className={cn("text-[13px] w-14 font-semibold", strengthGen > 0 ? strengthColors[strengthGen].replace('bg-', 'text-') : "text-slate-500")}>
                    {strengthLabels[strengthGen]}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center text-[13px] font-medium text-slate-700">
                   <span>密码长度</span>
                   <span className="text-blue-600 text-lg bg-blue-50 px-3 py-1 rounded-md min-w-[3rem] text-center">{length}</span>
                </div>
                <input 
                  type="range" 
                  min="4" 
                  max="64" 
                  value={length} 
                  onChange={(e) => setLength(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                 <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                        type="checkbox" 
                        checked={includeUppercase} 
                        onChange={(e) => setIncludeUppercase(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-[14px] text-slate-700 font-medium">大写字母 (A-Z)</span>
                 </label>
                 <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                        type="checkbox" 
                        checked={includeLowercase} 
                        onChange={(e) => setIncludeLowercase(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-[14px] text-slate-700 font-medium">小写字母 (a-z)</span>
                 </label>
                 <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                        type="checkbox" 
                        checked={includeNumbers} 
                        onChange={(e) => setIncludeNumbers(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-[14px] text-slate-700 font-medium">数字 (0-9)</span>
                 </label>
                 <label className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg cursor-pointer hover:bg-slate-50 transition-colors">
                    <input 
                        type="checkbox" 
                        checked={includeSymbols} 
                        onChange={(e) => setIncludeSymbols(e.target.checked)}
                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-[14px] text-slate-700 font-medium">符号 (!@#$)</span>
                 </label>
              </div>
            </div>
          </div>
      )}

      {activeTab === 'manager' && (
         <div className="flex-1 flex flex-col gap-4">
             {showForm ? (
                 <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-5 relative">
                     <button onClick={closeForm} className="absolute right-4 top-4 text-slate-400 hover:text-slate-600">
                         <X className="w-5 h-5" />
                     </button>
                     <h3 className="text-lg font-semibold text-slate-800">{editingRecord ? '修改密码记录' : '新增密码记录'}</h3>
                     
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="flex flex-col gap-1.5">
                             <label className="text-sm font-medium text-slate-700">平台 / 标题 *</label>
                             <input type="text" value={formTitle} onChange={e => setFormTitle(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="例如: 核心交换机 SSH, 阿里云控制台..." />
                         </div>
                         <div className="flex flex-col gap-1.5">
                             <label className="text-sm font-medium text-slate-700">用户名 / 账号</label>
                             <input type="text" value={formUsername} onChange={e => setFormUsername(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="admin, root, 等..." />
                         </div>
                         <div className="flex flex-col gap-1.5 md:col-span-2">
                             <label className="text-sm font-medium text-slate-700 flex justify-between">
                                <span>密码 *</span>
                                {formPassword && (
                                   <div className="flex items-center gap-2 mt-0.5">
                                     <div className="flex gap-0.5 h-1.5 w-16">
                                         {[1, 2, 3, 4, 5].map((level) => (
                                             <div key={level} className={cn("flex-1 rounded-full transition-colors", level <= strengthForm ? strengthColors[strengthForm] : "bg-slate-200")} />
                                         ))}
                                     </div>
                                     <span className="text-[10px] text-slate-500">{strengthLabels[strengthForm]}</span>
                                   </div>
                                )}
                             </label>
                             <div className="relative">
                                 <input type="text" value={formPassword} onChange={e => setFormPassword(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full font-mono pr-20 focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="输入密码..." />
                                 <button onClick={() => setFormPassword(password)} className="absolute right-2 top-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border border-slate-200 font-medium">使用随机</button>
                             </div>
                         </div>
                         <div className="flex flex-col gap-1.5 md:col-span-2">
                             <label className="text-sm font-medium text-slate-700">备注</label>
                             <textarea value={formNotes} onChange={e => setFormNotes(e.target.value)} className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full h-24 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40" placeholder="服务器 IP，端口，其他说明信息..."></textarea>
                         </div>
                     </div>
                     
                     <div className="flex justify-end gap-3 mt-2">
                         <button onClick={closeForm} className="px-4 py-2 border border-slate-300 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-50 transition-colors">取消</button>
                         <button onClick={handleSaveRecord} className="px-5 py-2 bg-slate-900 text-white rounded-lg text-[13px] font-medium hover:bg-slate-800 transition-colors flex items-center gap-2"><Save className="w-4 h-4"/> 保存记录</button>
                     </div>
                 </div>
             ) : (
                 <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex-wrap gap-4">
                     <div className="relative flex-1 min-w-[200px] max-w-sm">
                         <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                         <input 
                            type="text" 
                            placeholder="搜索平台、用户名、备注..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-[13px] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-shadow"
                         />
                     </div>
                     <div className="flex items-center gap-3">
                         <input
                           type="file"
                           accept=".kdbx"
                           ref={fileInputRef}
                           className="hidden"
                           onChange={handleFileSelect}
                         />
                         <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white border border-slate-200 text-slate-700 text-[13px] font-medium rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm">
                             <Upload className="w-4 h-4" /> 导入 KeePass (.kdbx)
                         </button>
                         <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-slate-900 text-white text-[13px] font-medium rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm">
                             <Plus className="w-4 h-4" /> 新增记录
                         </button>
                     </div>
                 </div>
             )}

             <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-2">
                 {records.length === 0 ? (
                     <div className="bg-slate-50 border-dashed p-12 text-center flex flex-col items-center justify-center text-slate-500">
                         <ShieldCheck className="w-10 h-10 mb-3 text-slate-300" />
                         <p className="font-medium">暂无密码记录</p>
                         <p className="text-sm mt-1 mb-4">点击上方“新增记录”或从“随机密码生成”页面添加</p>
                     </div>
                 ) : (
                     <div className="overflow-x-auto">
                         <table className="w-full text-left border-collapse text-[13px]">
                             <thead>
                                 <tr className="bg-slate-50 border-b border-slate-200 text-slate-500">
                                     <th className="px-4 py-3 font-semibold text-slate-600">平台 / 标题</th>
                                     <th className="px-4 py-3 font-semibold text-slate-600">用户名 / 账号</th>
                                     <th className="px-4 py-3 font-semibold text-slate-600">密码</th>
                                     <th className="px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">备注</th>
                                     <th className="px-4 py-3 font-semibold text-slate-600 text-right w-[100px]">操作</th>
                                 </tr>
                             </thead>
                             <tbody>
                                 {records.filter(record => 
                                     record.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                     record.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                     record.notes.toLowerCase().includes(searchQuery.toLowerCase())
                                 ).map(record => (
                                     <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors group">
                                         <td className="px-4 py-3 font-medium text-slate-800 break-words max-w-[200px]">
                                             {record.title}
                                         </td>
                                         <td className="px-4 py-3 text-slate-600 break-words max-w-[150px]">
                                             <div className="flex items-center gap-2">
                                                 <span>{record.username || '-'}</span>
                                                 {record.username && (
                                                     <button onClick={() => handleCopyText(record.username, record.id + '_user')} className="text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity" title="复制用户名">
                                                         {copiedId === record.id + '_user' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                     </button>
                                                 )}
                                             </div>
                                         </td>
                                         <td className="px-4 py-3">
                                             <div className="flex items-center gap-2">
                                                 <span className="font-mono bg-white border border-slate-200 px-2 py-1 rounded text-slate-600 min-w-[100px]">
                                                     {visiblePasswords[record.id] ? record.password : '••••••••'}
                                                 </span>
                                                 <button onClick={() => toggleVisibility(record.id)} className="text-slate-400 hover:text-slate-700" title="显示/隐藏">
                                                     {visiblePasswords[record.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                                 </button>
                                                 <button onClick={() => handleCopyText(record.password, record.id + '_pwd')} className="text-slate-400 hover:text-slate-700" title="复制密码">
                                                     {copiedId === record.id + '_pwd' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                 </button>
                                             </div>
                                         </td>
                                         <td className="px-4 py-3 text-slate-500 hidden md:table-cell break-words max-w-[200px]">
                                             <div className="truncate" title={record.notes}>
                                                 {record.notes || '-'}
                                             </div>
                                         </td>
                                         <td className="px-4 py-3 text-right">
                                             <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                 <button onClick={() => openEdit(record)} className="p-1.5 text-slate-400 hover:text-blue-600 bg-white hover:bg-blue-50 rounded-md transition-colors" title="编辑">
                                                     <Edit2 className="w-4 h-4" />
                                                 </button>
                                                 <button onClick={() => handleDelete(record.id)} className="p-1.5 text-slate-400 hover:text-red-600 bg-white hover:bg-red-50 rounded-md transition-colors" title="删除">
                                                     <Trash2 className="w-4 h-4" />
                                                 </button>
                                             </div>
                                         </td>
                                     </tr>
                                 ))}
                                 {records.length > 0 && records.filter(record => 
                                     record.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                     record.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                     record.notes.toLowerCase().includes(searchQuery.toLowerCase())
                                 ).length === 0 && (
                                     <tr>
                                         <td colSpan={5} className="px-4 py-8 text-center text-slate-500">
                                             未找到符合条件的记录
                                         </td>
                                     </tr>
                                 )}
                             </tbody>
                         </table>
                     </div>
                 )}
             </div>
         </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-blue-600" />
                  验证主密码
                </h3>
                <button onClick={() => { setShowImportModal(false); setImportFile(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0" />
                  解密在您的浏览器本地进行，密码和数据不会发送到任何服务器。
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-slate-700">正在导入文件: {importFile?.name}</label>
                  <input 
                    type="password" 
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    placeholder="输入该 KeePass 数据库的密码"
                    autoFocus
                    className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleImportKeePass();
                    }}
                  />
                  {importError && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1.5 font-medium">
                      <X className="w-4 h-4" /> {importError}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
              <button 
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button 
                onClick={handleImportKeePass}
                disabled={isImporting || !importPassword}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {isImporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {isImporting ? '解密中...' : '解密并导入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
