import React, { useState, useEffect } from 'react'
import { View, Text, Input, Slider } from '@tarojs/components'
import './index.scss'

export default function SubnetCalculator() {
  const [ip, setIp] = useState('192.168.1.100')
  const [cidr, setCidr] = useState(24)

  const [results, setResults] = useState({
    network: '',
    broadcast: '',
    mask: '',
    usableHosts: 0,
    totalHosts: 0
  })

  // IPv4 to integer
  const ipToInt = (ipStr: string) => {
    return ipStr.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
  }

  // Integer to IPv4
  const intToIp = (int: number) => {
    return [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255
    ].join('.');
  }

  useEffect(() => {
    try {
      const parts = ip.split('.')
      if (parts.length !== 4 || parts.some(p => p === '' || isNaN(Number(p)) || Number(p) < 0 || Number(p) > 255)) {
        return; // Invalid IP
      }

      const ipInt = ipToInt(ip);
      const maskInt = cidr === 0 ? 0 : (~0 << (32 - cidr)) >>> 0;
      const networkInt = (ipInt & maskInt) >>> 0;
      const broadcastInt = (networkInt | ~maskInt) >>> 0;
      
      const totalHosts = cidr === 32 ? 1 : Math.pow(2, 32 - cidr);
      const usableHosts = cidr >= 31 ? 0 : totalHosts - 2;

      setResults({
        network: intToIp(networkInt),
        broadcast: intToIp(broadcastInt),
        mask: intToIp(maskInt),
        usableHosts,
        totalHosts
      })
    } catch (e) {
      // ignore
    }
  }, [ip, cidr])

  return (
    <View className='subnet-page'>
      <View className='header'>
        <Text className='title'>子网掩码计算</Text>
        <Text className='subtitle'>移动端纯净计算引擎，实时测算</Text>
      </View>

      <View className='input-card'>
        <View className='input-group'>
          <Text className='label'>IPv4 地址</Text>
          <View className='input-wrapper'>
            <Input 
              type='digit' 
              value={ip} 
              onInput={(e) => setIp(e.detail.value)}
              placeholder='例如: 192.168.1.1'
            />
          </View>
        </View>

        <View className='slider-group'>
          <View className='slider-header'>
            <Text className='label'>子网前缀 (CIDR)</Text>
            <Text className='value'>/{cidr}</Text>
          </View>
          <Slider 
            min={0} 
            max={32} 
            value={cidr} 
            activeColor='#38bdf8' 
            backgroundColor='rgba(255,255,255,0.1)'
            onChange={(e) => setCidr(e.detail.value)} 
          />
        </View>
      </View>

      <View className='results-grid'>
        <View className='result-card highlight'>
          <View className='info'>
            <Text className='label'>子网掩码 (Subnet Mask)</Text>
            <Text className='value'>{results.mask || '--'}</Text>
          </View>
        </View>
        
        <View className='result-card'>
          <View className='info'>
            <Text className='label'>网络地址 (Network Address)</Text>
            <Text className='value'>{results.network || '--'}</Text>
          </View>
        </View>

        <View className='result-card'>
          <View className='info'>
            <Text className='label'>广播地址 (Broadcast Address)</Text>
            <Text className='value'>{results.broadcast || '--'}</Text>
          </View>
        </View>

        <View className='result-card'>
          <View className='info'>
            <Text className='label'>可用主机数 (Usable Hosts)</Text>
            <Text className='value'>{results.usableHosts.toLocaleString()}</Text>
          </View>
        </View>
      </View>
    </View>
  )
}
