import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  KeyRound, Copy, Check, RefreshCw, Plus, Trash2, Edit2, Eye, EyeOff, Save, 
  X, List, Shield, Clock, ArrowRight, ShieldCheck, Download, Upload, 
  Lock, Unlock, Search, ShieldAlert, KeyRound as MasterKeyIcon,
  AlertCircle, CheckCircle2, Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import * as kdbxweb from 'kdbxweb';

export interface PasswordRecord {
  id: string;
  title: string;
  username: string;
  password: string;
  url?: string;
  notes?: string;
  createdAt?: number;
  updatedAt?: number;
}

interface PasswordToolProps {
  isActive?: boolean;
}

// 加盐 SHA-256 安全哈希计算
async function hashPassword(password: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode(salt + password);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateSalt(): string {
  const arr = new Uint8Array(16);
  window.crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000; // 5分钟无操作自动锁定

export function PasswordTool({ isActive = true }: PasswordToolProps) {
  const [activeTab, setActiveTab] = useState<'generator' | 'manager'>('manager');

  // === 统一的轻量级 Toast 提示系统（彻底杜绝阻塞性 alert 导致的窗口键盘永久失焦 bug） ===
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimerRef = useRef<any>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast({ message, type });
    toastTimerRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);

    // 在 Electron 中通知主进程确保窗口获得焦点
    if (typeof window !== 'undefined' && (window as any).require) {
      try {
        (window as any).require('electron').ipcRenderer.send('focus-window');
      } catch (e) {}
    }
  }, []);

  // === 主密码与锁屏安全状态 ===
  const [hasMasterPassword, setHasMasterPassword] = useState<boolean>(false);
  const [isUnlocked, setIsUnlocked] = useState<boolean>(false);
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [showUnlockEye, setShowUnlockEye] = useState(false);

  // 初始化主密码
  const [initMasterPassword, setInitMasterPassword] = useState('');
  const [initConfirmPassword, setInitConfirmPassword] = useState('');
  const [initMasterError, setInitMasterError] = useState('');

  // 修改主密码弹窗
  const [showChangeMasterModal, setShowChangeMasterModal] = useState(false);
  const [oldMasterPassword, setOldMasterPassword] = useState('');
  const [newMasterPassword, setNewMasterPassword] = useState('');
  const [confirmNewMasterPassword, setConfirmNewMasterPassword] = useState('');
  const [changeMasterError, setChangeMasterError] = useState('');

  // 删除确认弹窗（替代原生 window.confirm）
  const [recordToDelete, setRecordToDelete] = useState<PasswordRecord | null>(null);

  // === 5分钟无操作自动锁屏计时 ===
  const lastActiveRef = useRef<number>(Date.now());

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
  const [showFormModal, setShowFormModal] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  // Form State
  const [formTitle, setFormTitle] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // === KeePass Import State ===
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importError, setImportError] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // === KeePass Export State ===
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [confirmExportPassword, setConfirmExportPassword] = useState('');
  const [exportError, setExportError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Focus Refs
  const titleInputRef = useRef<HTMLInputElement>(null);
  const unlockInputRef = useRef<HTMLInputElement>(null);
  const initInputRef = useRef<HTMLInputElement>(null);

  // 1. 初始化检查主密码是否存在及加载记录
  useEffect(() => {
    const masterHash = localStorage.getItem('pwd_master_hash');
    const masterSalt = localStorage.getItem('pwd_master_salt');
    if (masterHash && masterSalt) {
      setHasMasterPassword(true);
      setIsUnlocked(false);
    } else {
      setHasMasterPassword(false);
      setIsUnlocked(false);
    }

    const saved = localStorage.getItem('pwd_records');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          setRecords(parsed);
        }
      } catch (e) {
        console.error('Failed to parse password records');
      }
    }
  }, []);

  // 2. 监听用户操作，5分钟无操作自动锁定
  useEffect(() => {
    if (!isUnlocked || !isActive) return;

    const handleUserActivity = () => {
      lastActiveRef.current = Date.now();
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(event => window.addEventListener(event, handleUserActivity, { passive: true }));

    const checkInterval = setInterval(() => {
      if (Date.now() - lastActiveRef.current >= AUTO_LOCK_TIMEOUT) {
        setIsUnlocked(false);
      }
    }, 5000);

    return () => {
      events.forEach(event => window.removeEventListener(event, handleUserActivity));
      clearInterval(checkInterval);
    };
  }, [isUnlocked, isActive]);

  // 当标签重新激活时检查是否超时
  useEffect(() => {
    if (isActive && isUnlocked) {
      if (Date.now() - lastActiveRef.current >= AUTO_LOCK_TIMEOUT) {
        setIsUnlocked(false);
      }
    }
  }, [isActive, isUnlocked]);

  // 安全聚焦处理：避免直接在元素上使用 autoFocus 造成 Electron 挂载焦点丢失
  useEffect(() => {
    if (showFormModal) {
      const timer = setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [showFormModal]);

  useEffect(() => {
    if (!isUnlocked && hasMasterPassword) {
      const timer = setTimeout(() => {
        unlockInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    } else if (!isUnlocked && !hasMasterPassword) {
      const timer = setTimeout(() => {
        initInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isUnlocked, hasMasterPassword]);

  // 手动锁定
  const handleLock = () => {
    setIsUnlocked(false);
    setUnlockPassword('');
    setUnlockError('');
    showToast('密码管理工具已锁定', 'info');
  };

  // 设置初始主密码
  const handleSetInitialMasterPassword = async () => {
    if (!initMasterPassword || initMasterPassword.length < 6) {
      setInitMasterError('主密码长度不能少于 6 位');
      return;
    }
    if (initMasterPassword !== initConfirmPassword) {
      setInitMasterError('两次输入的密码不一致');
      return;
    }

    const salt = generateSalt();
    const hash = await hashPassword(initMasterPassword, salt);
    localStorage.setItem('pwd_master_hash', hash);
    localStorage.setItem('pwd_master_salt', salt);

    setHasMasterPassword(true);
    setIsUnlocked(true);
    lastActiveRef.current = Date.now();
    setInitMasterPassword('');
    setInitConfirmPassword('');
    setInitMasterError('');
    showToast('主访问密码设置成功，已解锁！', 'success');
  };

  // 解锁密码管理
  const handleUnlock = async () => {
    if (!unlockPassword) {
      setUnlockError('请输入主密码');
      return;
    }

    const savedHash = localStorage.getItem('pwd_master_hash');
    const savedSalt = localStorage.getItem('pwd_master_salt');

    if (!savedHash || !savedSalt) {
      setUnlockError('未找到已设置的主密码，请重置');
      return;
    }

    const currentHash = await hashPassword(unlockPassword, savedSalt);
    if (currentHash === savedHash) {
      setIsUnlocked(true);
      setUnlockPassword('');
      setUnlockError('');
      lastActiveRef.current = Date.now();
      showToast('解锁成功', 'success');
    } else {
      setUnlockError('主密码错误，请重新输入');
    }
  };

  // 修改主密码
  const handleChangeMasterPassword = async () => {
    if (!oldMasterPassword) {
      setChangeMasterError('请输入当前主密码');
      return;
    }
    if (!newMasterPassword || newMasterPassword.length < 6) {
      setChangeMasterError('新主密码长度不能少于 6 位');
      return;
    }
    if (newMasterPassword !== confirmNewMasterPassword) {
      setChangeMasterError('两次输入的新密码不一致');
      return;
    }

    const savedHash = localStorage.getItem('pwd_master_hash');
    const savedSalt = localStorage.getItem('pwd_master_salt');

    if (!savedHash || !savedSalt) {
      setChangeMasterError('原密码信息异常');
      return;
    }

    const oldHash = await hashPassword(oldMasterPassword, savedSalt);
    if (oldHash !== savedHash) {
      setChangeMasterError('原主密码验证失败，请输入正确的密码');
      return;
    }

    const newSalt = generateSalt();
    const newHash = await hashPassword(newMasterPassword, newSalt);
    localStorage.setItem('pwd_master_hash', newHash);
    localStorage.setItem('pwd_master_salt', newSalt);

    setShowChangeMasterModal(false);
    setOldMasterPassword('');
    setNewMasterPassword('');
    setConfirmNewMasterPassword('');
    setChangeMasterError('');
    showToast('主访问密码修改成功！', 'success');
  };

  // 保存记录至本地
  const saveRecords = (newRecords: PasswordRecord[]) => {
    setRecords(newRecords);
    localStorage.setItem('pwd_records', JSON.stringify(newRecords));
  };

  // 密码生成器逻辑
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
    showToast('密码已复制到剪贴板', 'info');
  };
  
  const handleCopyText = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast('已复制', 'info');
  };

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
  const handleOpenNew = () => {
    setEditingRecord(null);
    setFormTitle('');
    setFormUsername('');
    setFormPassword('');
    setFormNotes('');
    setFormError('');
    setShowFormModal(true);
  };

  const openEdit = (record: PasswordRecord) => {
    setEditingRecord(record);
    setFormTitle(record.title || '');
    setFormUsername(record.username || '');
    setFormPassword(record.password || '');
    setFormNotes(record.notes || '');
    setFormError('');
    setShowFormModal(true);
  };

  const handleSaveRecord = () => {
    if (!formTitle.trim()) {
      setFormError('请输入配置标题或平台名称');
      return;
    }
    
    const now = Date.now();
    let newRecords: PasswordRecord[];

    if (editingRecord) {
      newRecords = records.map(r => r.id === editingRecord.id ? {
        ...r,
        title: formTitle.trim(),
        username: formUsername.trim(),
        password: formPassword,
        url: r.url, // 保留已有 url（若有）
        notes: formNotes.trim(),
        updatedAt: now
      } : r);
      showToast('记录修改成功', 'success');
    } else {
      newRecords = [{
        id: Math.random().toString(36).substring(2, 9) + '-' + Date.now().toString(36),
        title: formTitle.trim(),
        username: formUsername.trim(),
        password: formPassword,
        notes: formNotes.trim(),
        createdAt: now,
        updatedAt: now
      }, ...records];
      showToast('新增记录成功', 'success');
    }
    
    saveRecords(newRecords);
    closeForm();
  };

  const closeForm = () => {
    setShowFormModal(false);
    setEditingRecord(null);
    setFormTitle('');
    setFormUsername('');
    setFormPassword('');
    setFormNotes('');
    setFormError('');
  };

  const confirmDelete = () => {
    if (recordToDelete) {
      saveRecords(records.filter(r => r.id !== recordToDelete.id));
      showToast(`已删除 “${recordToDelete.title}”`, 'info');
      setRecordToDelete(null);
    }
  };

  const toggleVisibility = (id: string) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const applyGenPasswordToForm = () => {
    setEditingRecord(null);
    setFormTitle('');
    setFormUsername('');
    setFormPassword(password);
    setFormUrl('');
    setFormNotes('');
    setFormError('');
    setActiveTab('manager');
    setShowFormModal(true);
  };

  // KeePass 导入
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImportFile(e.target.files[0]);
      setImportError('');
      setImportPassword('');
      setShowImportModal(true);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportKeePass = async () => {
    if (!importFile) return;
    
    setIsImporting(true);
    setImportError('');
    
    try {
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
          const urlField = entry.fields.get('URL');
          const notesField = entry.fields.get('Notes');
          
          const title = titleField instanceof kdbxweb.ProtectedValue ? titleField.getText() : (titleField as string) || '';
          const username = userField instanceof kdbxweb.ProtectedValue ? userField.getText() : (userField as string) || '';
          const pass = passField instanceof kdbxweb.ProtectedValue ? passField.getText() : (passField as string) || '';
          const url = urlField instanceof kdbxweb.ProtectedValue ? urlField.getText() : (urlField as string) || '';
          const notes = notesField instanceof kdbxweb.ProtectedValue ? notesField.getText() : (notesField as string) || '';
          
          if (title || username || pass || url || notes) {
            newRecords.push({
              id: Math.random().toString(36).substring(2, 9) + '-' + Math.random().toString(36).substring(2, 9),
              title: title || '未命名记录',
              username: username || '',
              password: pass || '',
              url: url || '',
              notes: notes || '',
              createdAt: entry.times.creationTime ? entry.times.creationTime.getTime() : now,
              updatedAt: entry.times.lastModTime ? entry.times.lastModTime.getTime() : now
            });
          }
        }
      }
      
      if (newRecords.length > 0) {
        saveRecords([...newRecords, ...records]);
        setShowImportModal(false);
        setImportFile(null);
        setImportPassword('');
        showToast(`成功导入 ${newRecords.length} 条 KeePass 记录！`, 'success');
      } else {
        setImportError('未能从该 KeePass 文件中提取出有效条目。');
      }
    } catch (e: any) {
      console.error(e);
      if (e && e.code === 'InvalidKey') {
        setImportError('密码错误或密钥文件不匹配。');
      } else if (e && e.message) {
        setImportError(`导入失败: ${e.message}`);
      } else {
        setImportError('解析数据库失败，请检查密码和文件格式。');
      }
    } finally {
      setIsImporting(false);
    }
  };

  // KeePass 导出 (.kdbx)
  const handleExportKeePass = async () => {
    if (!exportPassword) {
      setExportError('请输入导出密码以保护备份文件');
      return;
    }
    if (exportPassword.length < 4) {
      setExportError('导出密码长度不能少于 4 位');
      return;
    }
    if (exportPassword !== confirmExportPassword) {
      setExportError('两次输入的密码不一致');
      return;
    }

    setIsExporting(true);
    setExportError('');

    try {
      const credentials = new kdbxweb.Credentials(kdbxweb.ProtectedValue.fromString(exportPassword));
      const db = kdbxweb.Kdbx.create(credentials, 'Network Toolkit Passwords');
      db.setKdf(kdbxweb.Consts.KdfId.Aes);

      const defaultGroup = db.getDefaultGroup();
      const now = new Date();

      for (const rec of records) {
        const entry = db.createEntry(defaultGroup);
        entry.fields.set('Title', rec.title || '未命名记录');
        entry.fields.set('UserName', rec.username || '');
        entry.fields.set('Password', kdbxweb.ProtectedValue.fromString(rec.password || ''));
        entry.fields.set('URL', rec.url || '');
        entry.fields.set('Notes', rec.notes || '');
        if (rec.createdAt) {
          entry.times.creationTime = new Date(rec.createdAt);
        }
        if (rec.updatedAt) {
          entry.times.lastModTime = new Date(rec.updatedAt);
        }
      }

      const arrayBuffer = await db.save();
      const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
      const defaultFilename = `passwords_backup_${dateStr}.kdbx`;

      // 1. Electron 环境：弹出原生另存为窗口
      let savedByElectron = false;
      const isElectron = typeof window !== 'undefined' && (window as any).process && (window as any).process.type;
      if (isElectron || (window as any).require) {
        try {
          const { ipcRenderer } = (window as any).require('electron');
          let binary = '';
          const bytes = new Uint8Array(arrayBuffer);
          const len = bytes.byteLength;
          for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = window.btoa(binary);

          const res = await ipcRenderer.invoke('save-kdbx-file', {
            defaultName: defaultFilename,
            arrayBufferBase64: base64
          });

          if (res && res.success) {
            savedByElectron = true;
            setShowExportModal(false);
            setExportPassword('');
            setConfirmExportPassword('');
            showToast(`已成功导出 KeePass 文件至：${res.filePath}`, 'success');
            return;
          } else if (res && res.canceled) {
            return; // 用户取消了保存
          }
        } catch (ipcErr) {
          console.warn('Electron IPC save dialog failed, fallback to browser download:', ipcErr);
        }
      }

      // 2. 网页环境或 Electron 降级模式：Blob 下载
      if (!savedByElectron) {
        const blob = new Blob([arrayBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = defaultFilename;
        document.body.appendChild(a);
        a.click();

        setTimeout(() => {
          if (document.body.contains(a)) document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 60000);

        setShowExportModal(false);
        setExportPassword('');
        setConfirmExportPassword('');
        showToast(`已导出 ${records.length} 条记录，请查看下载文件`, 'success');
      }
    } catch (e: any) {
      console.error(e);
      setExportError(`导出失败: ${e.message || e}`);
    } finally {
      setIsExporting(false);
    }
  };

  // ================= 视图：未解锁状态 =================
  if (!isUnlocked) {
    return (
      <div className="p-6 max-w-4xl mx-auto h-full flex flex-col justify-center items-center relative">
        {/* 全局 Toast */}
        {toast && (
          <div className={cn(
            "fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm animate-in fade-in slide-in-from-top-4 duration-200",
            toast.type === 'success' && "bg-white border-green-200 text-green-800 shadow-green-100",
            toast.type === 'error' && "bg-white border-red-200 text-red-800 shadow-red-100",
            toast.type === 'info' && "bg-white border-slate-200 text-slate-800 shadow-slate-100"
          )}>
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
            <span className="font-medium">{toast.message}</span>
          </div>
        )}

        {!hasMasterPassword ? (
          // 首次使用：引导设置主访问密码
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-md max-w-md w-full animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <MasterKeyIcon className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">设置主访问密码</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                为确保您的密码本安全，首次使用请设置固定的主访问密码。每次进入或闲置 5 分钟后均需使用此密码解锁。
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">主访问密码 (至少6位)</label>
                <input
                  ref={initInputRef}
                  type="password"
                  value={initMasterPassword}
                  onChange={e => setInitMasterPassword(e.target.value)}
                  placeholder="输入主访问密码"
                  className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-slate-700">确认主访问密码</label>
                <input
                  type="password"
                  value={initConfirmPassword}
                  onChange={e => setInitConfirmPassword(e.target.value)}
                  placeholder="再次输入以确认"
                  className="px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  onKeyDown={e => e.key === 'Enter' && handleSetInitialMasterPassword()}
                />
              </div>

              {initMasterError && (
                <div className="text-sm text-red-600 flex items-center gap-1.5 bg-red-50 p-2.5 rounded-lg border border-red-100">
                  <X className="w-4 h-4 shrink-0" />
                  <span>{initMasterError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSetInitialMasterPassword}
                className="mt-2 w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                设置密码并解锁
              </button>
            </div>
          </div>
        ) : (
          // 锁屏界面：输入主密码解锁
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-md max-w-md w-full animate-in fade-in zoom-in-95">
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-14 h-14 bg-slate-100 text-slate-700 rounded-2xl flex items-center justify-center mb-4 shadow-inner">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-800">密码管理工具已锁定</h2>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">
                请输入固定主密码解锁以查看和管理您的密码本
              </p>
            </div>

            <div className="flex flex-col gap-4">
              <div className="relative">
                <input
                  ref={unlockInputRef}
                  type={showUnlockEye ? "text" : "password"}
                  value={unlockPassword}
                  onChange={e => setUnlockPassword(e.target.value)}
                  placeholder="输入主密码..."
                  className="w-full pl-4 pr-11 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  onKeyDown={e => e.key === 'Enter' && handleUnlock()}
                />
                <button
                  type="button"
                  onClick={() => setShowUnlockEye(!showUnlockEye)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showUnlockEye ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {unlockError && (
                <div className="text-sm text-red-600 flex items-center gap-1.5 bg-red-50 p-2.5 rounded-lg border border-red-100">
                  <X className="w-4 h-4 shrink-0" />
                  <span>{unlockError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleUnlock}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-colors shadow-sm flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                解锁密码库
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-slate-400 mt-2">
                <Clock className="w-3.5 h-3.5" />
                <span>无操作 5 分钟后系统将自动上锁</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ================= 视图：已解锁管理状态 =================
  return (
    <div className="p-6 max-w-6xl mx-auto h-full flex flex-col gap-6 relative">
      {/* 全局 Toast 提示组件 */}
      {toast && (
        <div className={cn(
          "fixed top-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm animate-in fade-in slide-in-from-top-4 duration-200",
          toast.type === 'success' && "bg-white border-green-200 text-green-800 shadow-green-100",
          toast.type === 'error' && "bg-white border-red-200 text-red-800 shadow-red-100",
          toast.type === 'info' && "bg-white border-slate-200 text-slate-800 shadow-slate-100"
        )}>
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />}
          {toast.type === 'info' && <Info className="w-4 h-4 text-blue-600 shrink-0" />}
          <span className="font-medium">{toast.message}</span>
        </div>
      )}

      {/* 顶部标题与安全控制栏 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <KeyRound className="w-6 h-6 text-slate-800" />
          <h1 className="text-2xl font-semibold text-slate-800 tracking-tight">密码管理工具</h1>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>无操作 5 分钟自动锁屏</span>
          </div>

          <button
            type="button"
            onClick={() => {
              setOldMasterPassword('');
              setNewMasterPassword('');
              setConfirmNewMasterPassword('');
              setChangeMasterError('');
              setShowChangeMasterModal(true);
            }}
            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
          >
            修改主密码
          </button>

          <button
            type="button"
            onClick={handleLock}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors shadow-sm flex items-center gap-1.5"
            title="立即锁定密码库"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>立即上锁</span>
          </button>
        </div>
      </div>

      <div className="flex gap-4 border-b border-[#E0E0E0]">
        <button
          type="button"
          className={cn(
            "pb-3 px-2 font-medium transition-colors border-b-2 flex items-center gap-2",
            activeTab === 'generator' ? "border-slate-800 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
          )}
          onClick={() => setActiveTab('generator')}
        >
          <Shield className="w-4 h-4" /> 随机密码生成
        </button>
        <button
          type="button"
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
                  type="button"
                  onClick={generatePassword}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-md transition-colors"
                  title="重新生成"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={handleCopyGen}
                  className="px-3 py-2 text-slate-600 bg-white border border-slate-200 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors flex items-center gap-2 text-sm font-medium shadow-sm"
                  title="复制密码"
                >
                  {copiedGen ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                  {copiedGen ? '已复制' : '复制密码'}
                </button>
                <button 
                  type="button"
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
                  const isActiveLevel = level <= strengthGen;
                  const colorClass = isActiveLevel ? strengthColors[strengthGen] : "bg-slate-100";
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
            <div className="flex items-center gap-2.5 flex-wrap">
              <input
                type="file"
                accept=".kdbx"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileSelect}
              />
              <button 
                type="button"
                onClick={() => fileInputRef.current?.click()} 
                className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-[13px] font-medium rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                title="从 KeePass 数据库文件导入"
              >
                <Upload className="w-4 h-4" /> 导入 KeePass (.kdbx)
              </button>

              <button 
                type="button"
                onClick={() => {
                  setExportError('');
                  setExportPassword('');
                  setConfirmExportPassword('');
                  setShowExportModal(true);
                }}
                className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 text-[13px] font-medium rounded-lg flex items-center gap-2 hover:bg-slate-50 transition-colors shadow-sm"
                title="导出为 KeePass 加密数据库文件"
              >
                <Download className="w-4 h-4" /> 导出 KeePass (.kdbx)
              </button>

              <button 
                type="button"
                onClick={handleOpenNew} 
                className="px-4 py-2 bg-slate-900 text-white text-[13px] font-medium rounded-lg flex items-center gap-2 hover:bg-slate-800 transition-colors shadow-sm"
              >
                <Plus className="w-4 h-4" /> 新增记录
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm mt-2">
            {records.length === 0 ? (
              <div className="bg-slate-50 border-dashed p-12 text-center flex flex-col items-center justify-center text-slate-500">
                <ShieldCheck className="w-10 h-10 mb-3 text-slate-300" />
                <p className="font-medium">暂无密码记录</p>
                <p className="text-sm mt-1 mb-4">点击上方“新增记录”或从“导入 KeePass (.kdbx)”载入</p>
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
                      <th className="px-4 py-3 font-semibold text-slate-600 text-right w-[140px]">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.filter(record => {
                      const q = (searchQuery || '').toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (record.title || '').toLowerCase().includes(q) || 
                        (record.username || '').toLowerCase().includes(q) ||
                        (record.notes || '').toLowerCase().includes(q)
                      );
                    }).map(record => (
                      <tr key={record.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800 break-words max-w-[200px]">
                          {record.title || '未命名'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 break-words max-w-[180px]">
                          <div className="flex items-center gap-2">
                            <span>{record.username || '-'}</span>
                            {record.username && (
                              <button type="button" onClick={() => handleCopyText(record.username, record.id + '_user')} className="text-slate-400 hover:text-slate-700 transition-colors" title="复制用户名">
                                {copiedId === record.id + '_user' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="font-mono bg-white border border-slate-200 px-2 py-1 rounded text-slate-600 min-w-[90px]">
                              {visiblePasswords[record.id] ? record.password : '••••••••'}
                            </span>
                            <button type="button" onClick={() => toggleVisibility(record.id)} className="text-slate-400 hover:text-slate-700" title="显示/隐藏">
                              {visiblePasswords[record.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                            <button type="button" onClick={() => handleCopyText(record.password, record.id + '_pwd')} className="text-slate-400 hover:text-slate-700" title="复制密码">
                              {copiedId === record.id + '_pwd' ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden md:table-cell break-words max-w-[220px]">
                          <div className="truncate" title={record.notes}>
                            {record.notes || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button 
                              type="button" 
                              onClick={() => openEdit(record)} 
                              className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-md transition-colors flex items-center gap-1 shadow-2xs" 
                              title="编辑记录"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>编辑</span>
                            </button>
                            <button 
                              type="button" 
                              onClick={() => setRecordToDelete(record)} 
                              className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-md transition-colors flex items-center gap-1 shadow-2xs" 
                              title="删除记录"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>删除</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {records.length > 0 && records.filter(record => {
                      const q = (searchQuery || '').toLowerCase().trim();
                      if (!q) return true;
                      return (
                        (record.title || '').toLowerCase().includes(q) || 
                        (record.username || '').toLowerCase().includes(q) ||
                        (record.notes || '').toLowerCase().includes(q)
                      );
                    }).length === 0 && (
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

      {/* 新增 / 修改记录 Modal 弹窗 */}
      {showFormModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Edit2 className="w-5 h-5 text-blue-600" />
                  {editingRecord ? '修改密码记录' : '新增密码记录'}
                </h3>
                <button type="button" onClick={closeForm} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700">平台 / 标题 *</label>
                    <input 
                      ref={titleInputRef}
                      type="text" 
                      value={formTitle} 
                      onChange={e => {
                        setFormTitle(e.target.value);
                        if (formError) setFormError('');
                      }} 
                      className={cn(
                        "px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2",
                        formError ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500/40"
                      )}
                      placeholder="如: 阿里云控制台, 核心交换机" 
                    />
                    {formError && (
                      <span className="text-xs text-red-500 font-medium">{formError}</span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-700">用户名 / 账号</label>
                    <input 
                      type="text" 
                      value={formUsername} 
                      onChange={e => setFormUsername(e.target.value)} 
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40" 
                      placeholder="admin, root..." 
                    />
                  </div>
                </div>


                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700 flex justify-between">
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
                    <input 
                      type="text" 
                      value={formPassword} 
                      onChange={e => setFormPassword(e.target.value)} 
                      className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full font-mono pr-24 focus:outline-none focus:ring-2 focus:ring-blue-500/40" 
                      placeholder="输入密码..." 
                    />
                    <button 
                      type="button"
                      onClick={() => setFormPassword(password)} 
                      className="absolute right-2 top-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded border border-slate-200 font-medium transition-colors"
                      title="填入随机生成的强密码"
                    >
                      使用生成值
                    </button>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-700">备注说明</label>
                  <textarea 
                    value={formNotes} 
                    onChange={e => setFormNotes(e.target.value)} 
                    className="px-3 py-2 border border-slate-300 rounded-lg text-sm w-full h-20 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/40" 
                    placeholder="设备IP、端口、密钥提示等..."
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
              <button type="button" onClick={closeForm} className="px-4 py-2 border border-slate-300 rounded-lg text-[13px] font-medium text-slate-700 hover:bg-slate-100 transition-colors">
                取消
              </button>
              <button type="button" onClick={handleSaveRecord} className="px-5 py-2 bg-slate-900 text-white rounded-lg text-[13px] font-medium hover:bg-slate-800 transition-colors flex items-center gap-2 shadow-sm">
                <Save className="w-4 h-4"/> 保存记录
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认 Modal（取代原生阻塞式的 window.confirm，保护窗口焦点） */}
      {recordToDelete && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 p-6">
            <div className="flex items-center gap-3 text-red-600 mb-3">
              <Trash2 className="w-6 h-6" />
              <h3 className="text-lg font-semibold text-slate-800">确认删除该记录？</h3>
            </div>
            <p className="text-sm text-slate-600 mb-6 leading-relaxed">
              确定要删除密码记录 <strong className="text-slate-900 font-semibold">“{recordToDelete.title}”</strong> 吗？此操作无法撤销。
            </p>
            <div className="flex justify-end gap-3">
              <button 
                type="button" 
                onClick={() => setRecordToDelete(null)}
                className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors"
              >
                取消
              </button>
              <button 
                type="button" 
                onClick={confirmDelete}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors shadow-sm"
              >
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KeePass 导入 Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Lock className="w-5 h-5 text-blue-600" />
                  验证 KeePass 数据库密码
                </h3>
                <button type="button" onClick={() => { setShowImportModal(false); setImportFile(null); }} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800 flex items-center gap-2">
                  <Shield className="w-4 h-4 shrink-0" />
                  解密在客户端本地完成，不会将密码或数据上传到任何服务器。
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-[13px] font-medium text-slate-700">导入文件: {importFile?.name}</label>
                  <input 
                    type="password" 
                    value={importPassword}
                    onChange={(e) => setImportPassword(e.target.value)}
                    placeholder="输入该 KeePass 数据库密码"
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
                type="button"
                onClick={() => { setShowImportModal(false); setImportFile(null); }}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button 
                type="button"
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

      {/* KeePass 导出 Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Download className="w-5 h-5 text-blue-600" />
                  导出 KeePass (.kdbx) 备份
                </h3>
                <button type="button" onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 leading-relaxed">
                  将导出当前 <strong className="text-slate-800">{records.length}</strong> 条密码记录（包含标题、网址、账号、密码、备注）。导出的文件采用标准 KeePass 加密格式，可在 KeePass、KeePassXC 等软件直接打开或随时重新导入。
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">设置备份文件保护密码 *</label>
                  <input 
                    type="password" 
                    value={exportPassword}
                    onChange={(e) => setExportPassword(e.target.value)}
                    placeholder="输入保护密码 (至少4位)"
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">确认保护密码 *</label>
                  <input 
                    type="password" 
                    value={confirmExportPassword}
                    onChange={(e) => setConfirmExportPassword(e.target.value)}
                    placeholder="再次输入保护密码"
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleExportKeePass();
                    }}
                  />
                </div>

                {exportError && (
                  <p className="text-sm text-red-600 flex items-center gap-1.5 font-medium">
                    <X className="w-4 h-4 shrink-0" /> {exportError}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
              <button 
                type="button"
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button 
                type="button"
                onClick={handleExportKeePass}
                disabled={isExporting || !exportPassword || !confirmExportPassword}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? '生成中...' : '另存为 .kdbx 文件'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 修改主密码 Modal */}
      {showChangeMasterModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <MasterKeyIcon className="w-5 h-5 text-blue-600" />
                  修改主访问密码
                </h3>
                <button type="button" onClick={() => setShowChangeMasterModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">当前主密码 *</label>
                  <input 
                    type="password" 
                    value={oldMasterPassword}
                    onChange={(e) => setOldMasterPassword(e.target.value)}
                    placeholder="输入当前使用的旧密码"
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">新主密码 (至少6位) *</label>
                  <input 
                    type="password" 
                    value={newMasterPassword}
                    onChange={(e) => setNewMasterPassword(e.target.value)}
                    placeholder="输入新主密码"
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-slate-700">确认新主密码 *</label>
                  <input 
                    type="password" 
                    value={confirmNewMasterPassword}
                    onChange={(e) => setConfirmNewMasterPassword(e.target.value)}
                    placeholder="再次输入新主密码"
                    className="px-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleChangeMasterPassword();
                    }}
                  />
                </div>

                {changeMasterError && (
                  <p className="text-sm text-red-600 flex items-center gap-1.5 font-medium">
                    <X className="w-4 h-4 shrink-0" /> {changeMasterError}
                  </p>
                )}
              </div>
            </div>

            <div className="bg-slate-50 px-6 py-4 flex justify-end gap-3 border-t border-slate-200">
              <button 
                type="button"
                onClick={() => setShowChangeMasterModal(false)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors text-sm font-medium"
              >
                取消
              </button>
              <button 
                type="button"
                onClick={handleChangeMasterPassword}
                className="px-6 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg transition-colors text-sm font-medium flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存新主密码
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
