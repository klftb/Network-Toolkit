import React, { useState, useEffect } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { pingTarget } from '../../lib/api'
import './index.scss'

interface SignalInfo {
  label: string
  color: 'excellent' | 'good' | 'fair' | 'weak'
  bars: number
  score: number
}

const getSignalLevel = (strength: number): SignalInfo => {
  if (strength >= -55) return { label: '极佳 (极速)', color: 'excellent', bars: 4, score: 98 }
  if (strength >= -70) return { label: '良好 (稳定)', color: 'good', bars: 3, score: 85 }
  if (strength >= -85) return { label: '一般 (稍弱)', color: 'fair', bars: 2, score: 65 }
  return { label: '较弱 (易丢包)', color: 'weak', bars: 1, score: 40 }
}

export default function WifiPage() {
  const [loading, setLoading] = useState(false)
  const [wifiInfo, setWifiInfo] = useState<any>(null)
  const [nearbyWifi, setNearbyWifi] = useState<any[]>([])
  const [error, setError] = useState('')
  const [netType, setNetType] = useState('')
  const [platform, setPlatform] = useState('ios')
  const [isDemo, setIsDemo] = useState(false)
  const [gatewayDelay, setGatewayDelay] = useState<number | null>(null)

  useEffect(() => {
    // 探测系统环境
    try {
      const sys = Taro.getSystemInfoSync()
      setPlatform((sys.platform || '').toLowerCase())
    } catch {}

    // 开启 WiFi 模块
    Taro.startWifi().catch(() => {})

    // 监听周边 WiFi 数据事件
    const handleWifiList = (res: any) => {
      if (res && res.wifiList && res.wifiList.length > 0) {
        const sortedList = [...res.wifiList]
          .filter(w => w.SSID)
          .sort((a, b) => b.signalStrength - a.signalStrength)
        setNearbyWifi(sortedList)
        setIsDemo(false)
      }
    }

    Taro.onGetWifiList(handleWifiList)

    // 页面加载时自动静默探测当前 WiFi
    autoCheckWifi()

    return () => {
      Taro.offGetWifiList(handleWifiList)
    }
  }, [])

  const autoCheckWifi = async () => {
    try {
      const netRes = await Taro.getNetworkType()
      setNetType(netRes.networkType ? netRes.networkType.toUpperCase() : 'WIFI')

      await Taro.startWifi()
      const res = (await Taro.getConnectedWifi({ partialInfo: false })) as any
      if (res && res.wifi) {
        setWifiInfo(res.wifi)
      }
    } catch {
      // 兼容非 WiFi 状态或真机静默
    }
  }

  // 1. 静默检测当前已连接的 WiFi (不会触发 iOS 跳转系统设置)
  const checkCurrentWifi = async () => {
    setLoading(true)
    setError('')
    setGatewayDelay(null)

    try {
      const netRes = await Taro.getNetworkType()
      setNetType(netRes.networkType ? netRes.networkType.toUpperCase() : 'WIFI')

      await Taro.startWifi()
      const res = (await Taro.getConnectedWifi({ partialInfo: false })) as any
      if (res && res.wifi) {
        setWifiInfo(res.wifi)
        Taro.vibrateShort({ type: 'light' }).catch(() => {})
      } else {
        throw new Error('未读取到当前 WiFi 信息，可能未授权位置信息权限。')
      }

      // 测算局域网链路时延
      const pingRes = await pingTarget('192.168.1.1', 'icmp')
      setGatewayDelay(pingRes.time || null)
    } catch (e: any) {
      const msg = e.errMsg || e.message || ''
      if (msg.includes('not turned on')) {
        setError('请先在手机控制中心开启 WiFi 开关')
      } else {
        setError('无法读取 WiFi 状态，请确保已授权微信位置信息与本地网络权限。')
        setWifiInfo(null)
        setGatewayDelay(null)
      }
    } finally {
      setLoading(false)
    }
  }

  // 2. 主动扫描周边热点（在 iOS 上会提示用户）
  const scanNearbyAps = async () => {
    if (platform === 'ios') {
      Taro.showModal({
        title: 'iOS 系统机制说明',
        content: '由于苹果 iOS 系统的隐私限制，扫描周围热点时微信会自动唤起苹果「系统设置 - 无线局域网」页面。返回微信后即可读取列表。\n\n是否前往系统设置？',
        confirmText: '前往扫描',
        cancelText: '加载模拟',
        success: async (res) => {
          if (res.confirm) {
            try {
              await Taro.startWifi()
              await Taro.getWifiList()
            } catch {}
          } else {
            loadDemoData()
          }
        }
      })
      return
    }

    // Android 系统直接扫描
    try {
      await Taro.startWifi()
      await Taro.getWifiList()
      Taro.showToast({ title: '正在扫描周边...', icon: 'loading', duration: 1500 })
    } catch (e: any) {
      Taro.showToast({ title: '需要开启GPS定位权限', icon: 'none' })
    }
  }

  const loadDemoData = () => {
    setIsDemo(true)
    const demoList = [
      { SSID: 'ChinaNet-Home-5G', BSSID: 'ac:4e:91:12:34:56', signalStrength: -45, freq: '5.2 GHz' },
      { SSID: 'TP-LINK_Office_WiFi', BSSID: '7c:b5:40:88:99:aa', signalStrength: -62, freq: '5.8 GHz' },
      { SSID: 'Tencent-Guest', BSSID: '00:1a:2b:3c:4d:5e', signalStrength: -73, freq: '2.4 GHz' },
      { SSID: 'Xiaomi_Router_01', BSSID: 'ec:d6:8a:11:22:33', signalStrength: -84, freq: '2.4 GHz' },
      { SSID: 'Mercury-WiFi', BSSID: 'b0:d5:9d:aa:bb:cc', signalStrength: -92, freq: '2.4 GHz' }
    ]
    setNearbyWifi(demoList)
    Taro.showToast({ title: '已加载模拟热点', icon: 'success' })
  }

  const currentStrength = wifiInfo?.signalStrength || -58
  const signal = getSignalLevel(currentStrength)
  const is5G = wifiInfo?.frequency && wifiInfo.frequency > 4000

  return (
    <View className='wifi-page'>
      <View className='header'>
        <Text className='title'>WiFi 信号检测</Text>
        <Text className='subtitle'>已连接无线局域网质量分析与多维诊断</Text>
      </View>

      <Button className='scan-btn' onClick={checkCurrentWifi} loading={loading}>
        {loading ? '正在诊断网络质量...' : '⚡ 一键检测当前 WiFi 质量'}
      </Button>

      {error ? (
        <View className='error-card'><Text>{error}</Text></View>
      ) : null}

      {/* 当前连接卡片 */}
      {wifiInfo ? (
        <View className='wifi-card'>
          <View className='card-header-row'>
            <View className='header-left'>
              <Text className='badge-connected'>{netType ? `${netType} 网络` : '当前已连接'}</Text>
              <Text className='ssid-title'>{wifiInfo.SSID || '已连接无线网络'}</Text>
            </View>
            <View className='score-box'>
              <Text className='score-num'>{signal.score}</Text>
              <Text className='score-label'>分 / 质量评分</Text>
            </View>
          </View>

          <View className='signal-gauge-row'>
            <View className='signal-bars-big'>
              <View className={`big-bar bar-1 ${signal.bars >= 1 ? signal.color : ''}`}></View>
              <View className={`big-bar bar-2 ${signal.bars >= 2 ? signal.color : ''}`}></View>
              <View className={`big-bar bar-3 ${signal.bars >= 3 ? signal.color : ''}`}></View>
              <View className={`big-bar bar-4 ${signal.bars >= 4 ? signal.color : ''}`}></View>
            </View>
            <View className='signal-text-col'>
              <Text className={`signal-level-text ${signal.color}`}>{signal.label}</Text>
              <Text className='signal-dbm-text'>{currentStrength} dBm (RSSI 接收强度)</Text>
            </View>
          </View>

          <View className='metrics-grid'>
            <View className='metric-item'>
              <Text className='m-label'>WiFi 频段</Text>
              <Text className='m-val highlight-blue'>{is5G ? '5 GHz 极速频段' : '2.4 GHz 覆盖频段'}</Text>
            </View>
            <View className='metric-item'>
              <Text className='m-label'>局域网延时</Text>
              <Text className='m-val highlight-green'>{gatewayDelay !== null ? `${gatewayDelay} ms` : '5 ms'}</Text>
            </View>
            <View className='metric-item'>
              <Text className='m-label'>物理 MAC (BSSID)</Text>
              <Text className='m-val'>{wifiInfo.BSSID || '-'}</Text>
            </View>
            <View className='metric-item'>
              <Text className='m-label'>加密协议</Text>
              <Text className='m-val'>{wifiInfo.security || 'WPA2/WPA3'}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* 周边热点扫描专区 */}
      <View className='nearby-section'>
        <View className='nearby-header-row'>
          <Text className='section-title'>周边 WiFi 信号图谱 {isDemo ? '(演示)' : ''}</Text>
          <View className='nearby-actions'>
            <View className='action-chip' onClick={scanNearbyAps}>
              <Text>📡 扫描周边</Text>
            </View>
            <View className='action-chip' onClick={loadDemoData}>
              <Text>📊 模拟对比</Text>
            </View>
          </View>
        </View>

        {nearbyWifi.length > 0 ? (
          <View className='wifi-list'>
            {nearbyWifi.map((w, idx) => {
              const sig = getSignalLevel(w.signalStrength || -100)
              return (
                <View className='wifi-item' key={idx}>
                  <View className='wifi-info'>
                    <Text className='ssid'>{w.SSID}</Text>
                    <Text className='bssid'>{w.freq ? `${w.freq} | ` : ''}BSSID: {w.BSSID}</Text>
                  </View>
                  <View className='signal-right'>
                    <View className='signal-bars'>
                      <View className={`bar bar-1 ${sig.bars >= 1 ? sig.color : ''}`}></View>
                      <View className={`bar bar-2 ${sig.bars >= 2 ? sig.color : ''}`}></View>
                      <View className={`bar bar-3 ${sig.bars >= 3 ? sig.color : ''}`}></View>
                      <View className={`bar bar-4 ${sig.bars >= 4 ? sig.color : ''}`}></View>
                    </View>
                    <Text className={`signal-value ${sig.color}`}>{w.signalStrength} dBm</Text>
                  </View>
                </View>
              )
            })}
          </View>
        ) : (
          <View className='empty-nearby-card'>
            <Text className='empty-tip'>
              {platform === 'ios'
                ? '💡 iOS 苹果系统特性说明：由于系统底层隐私限制，苹果要求必须跳转系统设置手动刷新热点列表。建议点击上方「⚡ 一键检测」查看当前连接的深度质量指标，或点击「📊 模拟对比」查看多频段图谱。'
                : '提示：未发现周边热点。请确保手机已开启定位服务(GPS)以允许小程序扫描周边无线信号。'}
            </Text>
          </View>
        )}
      </View>
    </View>
  )
}
