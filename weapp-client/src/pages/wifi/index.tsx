import React, { useState, useEffect } from 'react'
import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

const getSignalLevel = (strength: number) => {
  if (strength >= -55) return { label: '极强', color: 'excellent', bars: 4 }
  if (strength >= -70) return { label: '良好', color: 'good', bars: 3 }
  if (strength >= -85) return { label: '一般', color: 'fair', bars: 2 }
  return { label: '较弱', color: 'weak', bars: 1 }
}

export default function WifiPage() {
  const [loading, setLoading] = useState(false)
  const [wifiInfo, setWifiInfo] = useState<any>(null)
  const [nearbyWifi, setNearbyWifi] = useState<any[]>([])
  const [error, setError] = useState('')
  const [netType, setNetType] = useState('')
  const [platform, setPlatform] = useState('')
  const [isDemo, setIsDemo] = useState(false)

  useEffect(() => {
    // 开启 WiFi 模块
    Taro.startWifi().catch(() => {})

    // 监听获取 WiFi 列表数据事件
    const handleWifiList = (res: any) => {
      if (res && res.wifiList) {
        // 过滤掉 SSID 为空的并按信号强度从大到小排序
        const sortedList = [...res.wifiList]
          .filter(w => w.SSID)
          .sort((a, b) => b.signalStrength - a.signalStrength)
        setNearbyWifi(sortedList)
        setIsDemo(false)
      }
    }

    Taro.onGetWifiList(handleWifiList)

    // 检测系统平台
    try {
      const sys = Taro.getSystemInfoSync()
      setPlatform(sys.platform || '')
    } catch {}

    return () => {
      Taro.offGetWifiList(handleWifiList)
    }
  }, [])

  const scan = async () => {
    setLoading(true)
    setError('')
    setWifiInfo(null)
    setNearbyWifi([])
    setIsDemo(false)

    // 获取网络类型
    try {
      const netRes = await Taro.getNetworkType()
      setNetType(netRes.networkType || '')
    } catch {}

    // 获取当前连接 WiFi
    try {
      await Taro.startWifi()
      const res = await Taro.getConnectedWifi({ partialInfo: false })
      if (res && res.wifi) {
        setWifiInfo(res.wifi)
      }
    } catch (e: any) {
      const msg = e.errMsg || e.message || ''
      if (msg.indexOf('not turned on') > -1) {
        setError('请先开启手机 WiFi')
      } else {
        console.log('获取当前已连接WiFi失败:', e)
      }
    }

    // 请求获取附近 WiFi 列表
    try {
      await Taro.getWifiList()
    } catch (e: any) {
      console.log('请求附近WiFi列表失败:', e)
    }

    // 延迟 2s 等待扫描结果返回
    setTimeout(() => {
      setLoading(false)
    }, 2000)
  }

  const loadDemoData = () => {
    setIsDemo(true)
    const demoList = [
      { SSID: 'ChinaNet-Home-5G', BSSID: 'ac:4e:91:12:34:56', signalStrength: -45 },
      { SSID: 'TP-LINK_Office_WiFi', BSSID: '7c:b5:40:88:99:aa', signalStrength: -62 },
      { SSID: 'Tencent-Guest', BSSID: '00:1a:2b:3c:4d:5e', signalStrength: -73 },
      { SSID: 'Xiaomi_Router_01', BSSID: 'ec:d6:8a:11:22:33', signalStrength: -84 },
      { SSID: 'Mercury-WiFi', BSSID: 'b0:d5:9d:aa:bb:cc', signalStrength: -92 }
    ]
    setNearbyWifi(demoList)
  }

  const signal = wifiInfo ? getSignalLevel(wifiInfo.signalStrength || -100) : null

  return (
    <View className='wifi-page'>
      <View className='header'>
        <Text className='title'>WiFi 信号检测</Text>
        <Text className='subtitle'>检测当前已连接及周边 WiFi 的信号强度</Text>
      </View>

      {platform === 'ios' && (
        <View className='ios-warning-banner'>
          <Text className='warning-title'>⚠️ 苹果 iOS 系统扫描限制说明</Text>
          <Text className='warning-desc'>
            由于苹果 iOS 系统底层隐私安全限制，微信小程序在 iOS 平台**仅能读取当前已连接的单个 WiFi**，不支持扫描获取周边的其它 WiFi 信号列表（即使已授权定位，微信自动拉起或跳转系统设置，iOS 也会限制返回空结果）。
          </Text>
          <Text className='warning-action'>
            如需体验多 WiFi 信号对比的彩色柱状图，请点击下方蓝色「加载模拟信号图示预览」按钮。
          </Text>
        </View>
      )}

      <Button className='scan-btn' onClick={scan} loading={loading}>
        {loading ? '扫描中...' : '开始扫描'}
      </Button>

      {error ? (
        <View className='error-card'><Text>{error}</Text></View>
      ) : null}

      {netType ? (
        <View className='info-card'>
          <Text className='card-title'>网络状态</Text>
          <Text className='info-value'>当前网络类型: {netType.toUpperCase()}</Text>
        </View>
      ) : null}

      {wifiInfo ? (
        <View className='info-card'>
          <Text className='card-title'>当前连接</Text>
          <View className='wifi-main'>
            <View className='signal-meter'>
              <View className={'bar bar-1 ' + (signal && signal.bars >= 1 ? signal.color : '')}></View>
              <View className={'bar bar-2 ' + (signal && signal.bars >= 2 ? signal.color : '')}></View>
              <View className={'bar bar-3 ' + (signal && signal.bars >= 3 ? signal.color : '')}></View>
              <View className={'bar bar-4 ' + (signal && signal.bars >= 4 ? signal.color : '')}></View>
            </View>
            <View className='wifi-detail'>
              <Text className='ssid'>{wifiInfo.SSID || '未知'}</Text>
              <Text className={'signal-label ' + (signal ? signal.color : '')}>{signal ? signal.label + ` (${wifiInfo.signalStrength} dBm)` : '-'}</Text>
            </View>
          </View>
          <View className='detail-grid'>
            <View className='detail-item'>
              <Text className='label'>BSSID</Text>
              <Text className='value'>{wifiInfo.BSSID || '-'}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>频率</Text>
              <Text className='value'>{wifiInfo.frequency ? wifiInfo.frequency + ' MHz' : '-'}</Text>
            </View>
            <View className='detail-item'>
              <Text className='label'>安全类型</Text>
              <Text className='value'>{wifiInfo.security || '-'}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* 附近 WiFi 列表 */}
      {nearbyWifi.length > 0 ? (
        <View className='nearby-section'>
          <Text className='section-title'>
            周边 WiFi 信号强度 {isDemo ? '(演示数据)' : ''}
          </Text>
          <View className='wifi-list'>
            {nearbyWifi.map((w, idx) => {
              const sig = getSignalLevel(w.signalStrength || -100)
              return (
                <View className='wifi-item' key={idx}>
                  <View className='wifi-info'>
                    <Text className='ssid'>{w.SSID}</Text>
                    <Text className='bssid'>BSSID: {w.BSSID}</Text>
                  </View>
                  <View className='signal-right'>
                    <View className='signal-bars'>
                      <View className={'bar bar-1 ' + (sig.bars >= 1 ? sig.color : '')}></View>
                      <View className={'bar bar-2 ' + (sig.bars >= 2 ? sig.color : '')}></View>
                      <View className={'bar bar-3 ' + (sig.bars >= 3 ? sig.color : '')}></View>
                      <View className={'bar bar-4 ' + (sig.bars >= 4 ? sig.color : '')}></View>
                    </View>
                    <Text className={'signal-value ' + sig.color}>{w.signalStrength} dBm</Text>
                  </View>
                </View>
              )
            })}
          </View>
          {isDemo && (
            <Button className='clear-demo-btn' onClick={() => { setNearbyWifi([]); setIsDemo(false); }}>
              清除演示数据
            </Button>
          )}
        </View>
      ) : (
        <View>
          {platform === 'ios' ? (
            <View className='tip-card'>
              <Text className='tip-text' style={{ marginBottom: '10px', display: 'block' }}>
                💡 iOS 系统限制：由于苹果系统的隐私和安全策略，iOS 小程序无法扫描和获取周围的 WiFi 列表。您可以将小程序部署到 Android 手机上测试以查看周边 WiFi 图表。
              </Text>
              <Button className='demo-btn' onClick={loadDemoData}>
                加载模拟信号图示预览
              </Button>
            </View>
          ) : (
            <View className='tip-card'>
              <Text className='tip-text' style={{ marginBottom: '10px', display: 'block' }}>
                提示：若未出现附近 WiFi 列表，请检查手机是否已开启“定位服务/GPS”以及微信的小程序定位权限（部分安卓系统扫描 WiFi 必须依赖定位权限）。
              </Text>
              <Button className='demo-btn' onClick={loadDemoData}>
                加载模拟信号图示预览
              </Button>
            </View>
          )}
        </View>
      )}
    </View>
  )
}
