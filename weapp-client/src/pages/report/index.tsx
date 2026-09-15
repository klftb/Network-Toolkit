import React, { useState, useEffect } from 'react'
import { View, Text, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ipLookup, checkTcpPort } from '../../lib/api'
import './index.scss'

interface ReportData {
  device: string
  os: string
  wechatVersion: string
  networkType: string
  wifiSsid: string
  wifiBssid: string
  wifiSignal: number
  wifiFreq: string
  publicIp: string
  location: string
  isp: string
  dnsLatency: number | string
  httpLatency: number | string
  time: string
}

export default function NetworkReport() {
  const [report, setReport] = useState<ReportData | null>(null)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressText, setProgressText] = useState('')

  const updateProgress = (p: number, text: string) => {
    setProgress(p)
    setProgressText(text)
  }

  const generateReport = async () => {
    setRunning(true)
    setReport(null)
    Taro.vibrateShort({ type: 'light' }).catch(() => {})
    
    try {
      const data: Partial<ReportData> = {}

      updateProgress(10, '正在获取设备信息...')
      try {
        const sysInfo = Taro.getSystemInfoSync()
        data.device = sysInfo.model || '未知设备'
        data.os = sysInfo.system || '未知系统'
        data.wechatVersion = sysInfo.version || '未知版本'
      } catch {
        data.device = '获取失败'
        data.os = '获取失败'
      }

      updateProgress(25, '正在获取网络类型...')
      try {
        const netRes = await Taro.getNetworkType()
        data.networkType = netRes.networkType ? netRes.networkType.toUpperCase() : '未知'
      } catch {
        data.networkType = '获取失败'
      }

      updateProgress(40, '正在获取 WiFi 信息...')
      if (data.networkType === 'WIFI') {
        try {
          // WiFi 信息可能需要用户授权位置权限
          const wifiRes = await Taro.getConnectedWifi()
          data.wifiSsid = wifiRes.wifi.SSID || '未知'
          data.wifiBssid = wifiRes.wifi.BSSID || '未知'
          data.wifiSignal = Math.round((wifiRes.wifi.signalStrength || 0) * 100)
          const freq = wifiRes.wifi.frequency || 0
          if (freq >= 5000) data.wifiFreq = '5G'
          else if (freq >= 2400) data.wifiFreq = '2.4G'
          else data.wifiFreq = '未知'
        } catch (e: any) {
          data.wifiSsid = '未授权或未连接'
          data.wifiBssid = '-'
          data.wifiSignal = 0
          data.wifiFreq = '-'
        }
      } else {
        data.wifiSsid = '当前未使用 WiFi'
        data.wifiBssid = '-'
        data.wifiSignal = 0
        data.wifiFreq = '-'
      }

      updateProgress(60, '正在获取公网 IP 及归属地...')
      try {
        const ipInfo = await ipLookup()
        data.publicIp = ipInfo.ip
        data.location = `${ipInfo.country} ${ipInfo.region} ${ipInfo.city}`.replace(/-|中国/g, '').trim() || '未知地区'
        data.isp = ipInfo.isp
      } catch {
        data.publicIp = '获取失败'
        data.location = '未知'
        data.isp = '未知'
      }

      updateProgress(80, '正在测试网络连通性...')
      try {
        const dnsRes = await checkTcpPort('223.5.5.5', 53, 2000)
        data.dnsLatency = dnsRes.status === 'open' && dnsRes.latency ? dnsRes.latency : '超时'
      } catch {
        data.dnsLatency = '失败'
      }

      try {
        const httpStart = Date.now()
        await Taro.request({ url: 'https://www.baidu.com', method: 'HEAD', timeout: 3000 })
        data.httpLatency = Date.now() - httpStart
      } catch (e: any) {
        if (e.errMsg && (e.errMsg.includes('ssl') || e.errMsg.includes('domain list'))) {
          data.httpLatency = Date.now() - httpStart
        } else {
          data.httpLatency = '超时'
        }
      }

      updateProgress(100, '报告生成完毕')
      
      const now = new Date()
      data.time = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

      setReport(data as ReportData)
    } catch (e) {
      Taro.showToast({ title: '报告生成失败', icon: 'error' })
    } finally {
      setRunning(false)
    }
  }

  return (
    <ScrollView className='report-page' scrollY>
      <View className='header'>
        <Text className='title'>网络环境报告</Text>
        <Text className='subtitle'>一键收集当前设备的全部网络信息，方便截图分享给运维人员进行排障。</Text>
      </View>

      <View className='action-card'>
        <Button className='test-btn' disabled={running} onClick={generateReport}>
          {running ? '正在生成...' : (report ? '重新生成' : '一键生成报告')}
        </Button>
        {running && (
          <View className='progress-box'>
            <View className='p-track'>
              <View className='p-fill' style={{ width: `${progress}%` }} />
            </View>
            <Text className='p-text'>{progressText}</Text>
          </View>
        )}
      </View>

      {report && (
        <View className='report-card' id='report-canvas'>
          <View className='rc-header'>
            <Text className='rc-title'>Network Toolkit</Text>
            <Text className='rc-subtitle'>综合网络环境诊断报告</Text>
          </View>

          <View className='rc-section'>
            <Text className='rc-sec-title'>📱 设备信息</Text>
            <View className='rc-row'><Text className='lbl'>设备型号</Text><Text className='val'>{report.device}</Text></View>
            <View className='rc-row'><Text className='lbl'>操作系统</Text><Text className='val'>{report.os}</Text></View>
            <View className='rc-row'><Text className='lbl'>微信版本</Text><Text className='val'>{report.wechatVersion}</Text></View>
          </View>

          <View className='rc-section'>
            <Text className='rc-sec-title'>🌐 基础网络</Text>
            <View className='rc-row'><Text className='lbl'>当前网络</Text><Text className='val'>{report.networkType}</Text></View>
            {report.networkType === 'WIFI' && (
              <>
                <View className='rc-row'><Text className='lbl'>WiFi SSID</Text><Text className='val hl'>{report.wifiSsid}</Text></View>
                <View className='rc-row'><Text className='lbl'>BSSID</Text><Text className='val'>{report.wifiBssid}</Text></View>
                <View className='rc-row'><Text className='lbl'>频段</Text><Text className='val'>{report.wifiFreq}</Text></View>
                <View className='rc-row'><Text className='lbl'>信号强度</Text><Text className='val'>{report.wifiSignal}%</Text></View>
              </>
            )}
          </View>

          <View className='rc-section'>
            <Text className='rc-sec-title'>🔗 公网出口</Text>
            <View className='rc-row'><Text className='lbl'>公网 IP</Text><Text className='val hl'>{report.publicIp}</Text></View>
            <View className='rc-row'><Text className='lbl'>地理位置</Text><Text className='val'>{report.location}</Text></View>
            <View className='rc-row'><Text className='lbl'>运营商</Text><Text className='val'>{report.isp}</Text></View>
          </View>

          <View className='rc-section'>
            <Text className='rc-sec-title'>⚡ 连通性测试</Text>
            <View className='rc-row'><Text className='lbl'>DNS 延迟 (阿里)</Text><Text className={`val ${typeof report.dnsLatency === 'number' && report.dnsLatency < 100 ? 'good' : 'warn'}`}>{report.dnsLatency}{typeof report.dnsLatency === 'number' ? 'ms' : ''}</Text></View>
            <View className='rc-row'><Text className='lbl'>HTTP 延迟 (百度)</Text><Text className={`val ${typeof report.httpLatency === 'number' && report.httpLatency < 100 ? 'good' : 'warn'}`}>{report.httpLatency}{typeof report.httpLatency === 'number' ? 'ms' : ''}</Text></View>
          </View>

          <View className='rc-footer'>
            <Text className='footer-text'>生成时间：{report.time}</Text>
            <Text className='footer-text'>由 Network Toolkit 小程序自动生成</Text>
          </View>
        </View>
      )}

      {report && (
        <View className='tip-text'>提示：您可以直接截图此页面发送给运维人员。</View>
      )}

      <View className='version-footer'>
        <Text className='version-text'>v1.1 · Author: Ben</Text>
      </View>
    </ScrollView>
  )
}
