import Taro from '@tarojs/taro'

// We will use the standard domain for WeChat Cloud Run if configured, or a local dev proxy if not.
// WeChat Cloud Run intercepts requests to its own domain automatically if used with wx.cloud.callContainer.
// But since the backend is just a standard Express app, we can hit it directly using HTTP.

// Replace this with the actual deployed Cloud Run domain when ready, 
// e.g., 'https://express-llmm-xxx.ap-shanghai.run.tcloudbase.com'
// For now, we will use a placeholder or local test URL.
export const API_BASE = 'http://localhost:3001/api' 

export async function pingTarget(target: string, protocol: 'icmp' | 'tcp' | 'udp', port?: string) {
  try {
    const res = await Taro.request({
      url: `${API_BASE}/ping`,
      method: 'POST',
      data: { target, protocol, port: port || '80' }
    })
    return res.data
  } catch (err: any) {
    throw new Error(err.errMsg || 'Ping failed')
  }
}

export async function portScan(target: string, ports: number[]) {
  try {
    const res = await Taro.request({
      url: `${API_BASE}/portscan`,
      method: 'POST',
      data: { targets: [target], ports }
    })
    return res.data
  } catch (err: any) {
    throw new Error(err.errMsg || 'PortScan failed')
  }
}
