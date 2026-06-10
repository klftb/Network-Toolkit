export interface HistoryEntry {
  id: string;
  toolId: string;
  toolName: string;
  target: string;
  summary: string;
  timestamp: number;
}

export function getHistory(): HistoryEntry[] {
  try {
    const saved = localStorage.getItem('nettools_history');
    return saved ? JSON.parse(saved) : [];
  } catch (e) {
    return [];
  }
}

export function addHistory(entry: Omit<HistoryEntry, 'id' | 'timestamp'>) {
  const newEntry: HistoryEntry = {
    ...entry,
    id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
    timestamp: Date.now()
  };
  const current = getHistory();
  const updated = [newEntry, ...current].slice(0, 100); // keep last 100
  localStorage.setItem('nettools_history', JSON.stringify(updated));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('history_updated'));
  }
}

export function clearHistory() {
  localStorage.removeItem('nettools_history');
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('history_updated'));
  }
}
