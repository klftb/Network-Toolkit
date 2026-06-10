export type ToolId = 
  | 'dashboard'
  | 'history'
  | 'ping'
  | 'portscan'
  | 'subnet'
  | 'myip'
  | 'whois'
  | 'speedtest'
  | 'tracert'
  | 'batchgen'
  | 'templates'
  | 'excalidraw'
  | 'dns'
  | 'tftp'
  | 'ftp'
  | 'textdiff'
  | 'wifi'
  | 'password'
  | 'settings';

export interface ToolComponentProps {
  onExportReady?: (title: string, content: string) => void;
}
