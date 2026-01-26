'use client'

import { useState, useEffect } from 'react'

const API_URL = 'https://hqr2yft2ej.execute-api.ap-northeast-2.amazonaws.com/prod/balances'

const formatUSD = (n) => {
  if (!n || Math.abs(n) < 0.01) return ''
  const prefix = n < 0 ? '-$' : '$'
  return prefix + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const formatAmount = (n) => {
  if (!n || Math.abs(n) < 0.0001) return ''
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(2) + 'K'
  if (Math.abs(n) >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(API_URL)
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (!data && loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Loading...
      </div>
    )
  }

  // 모든 코인 수집 및 정렬 (USD 가치 기준)
  const coinTotals = {}
  const rows = []

  // 데이터 파싱
  const exchangeOrder = ['binance', 'bybit', 'okx', 'zoomex', 'kucoin', 'kraken']
  
  for (const ex of exchangeOrder) {
    const exData = data?.balances?.[ex]
    if (!exData) continue

    // Master 계정
    const masterBal = exData.master_breakdown || {}
    if (Object.keys(masterBal).length > 0 || exData.master_usd > 0) {
      const row = {
        exchange: ex.toUpperCase(),
        account: 'Master',
        balances: {},
        totalUsd: exData.master_usd || 0
      }
      for (const [coin, info] of Object.entries(masterBal)) {
        const cleanCoin = coin.replace('_FUTURES', '').replace('_COIN_FUTURES', '')
        row.balances[cleanCoin] = (row.balances[cleanCoin] || 0) + info.amount
        coinTotals[cleanCoin] = (coinTotals[cleanCoin] || 0) + Math.abs(info.usd || 0)
      }
      if (row.totalUsd !== 0) rows.push(row)
    }

    // Subaccounts
    for (const [subName, subData] of Object.entries(exData.subaccounts_usd || {})) {
      if (Math.abs(subData.usd) < 1) continue
      const row = {
        exchange: '',
        account: subName.length > 25 ? subName.slice(0, 22) + '...' : subName,
        balances: {},
        totalUsd: subData.usd,
        isSub: true
      }
      for (const [coin, info] of Object.entries(subData.breakdown || {})) {
        const cleanCoin = coin.replace('_FUTURES', '').replace('_COIN_FUTURES', '')
        row.balances[cleanCoin] = (row.balances[cleanCoin] || 0) + info.amount
        coinTotals[cleanCoin] = (coinTotals[cleanCoin] || 0) + Math.abs(info.usd || 0)
      }
      rows.push(row)
    }
  }

  // 상위 코인 선택 (USD 가치 기준 상위 8개)
  const topCoins = Object.entries(coinTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([coin]) => coin)

  // 거래소별 합계 계산
  const exchangeTotals = {}
  for (const ex of exchangeOrder) {
    const exData = data?.balances?.[ex]
    if (exData?.exchange_total_usd) {
      exchangeTotals[ex] = exData.exchange_total_usd
    }
  }

  return (
    <div style={{
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontSize: '13px',
      background: '#fff',
      minHeight: '100vh'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px',
        paddingBottom: '15px',
        borderBottom: '2px solid #e0e0e0'
      }}>
        <div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>Total Balance</div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a1a1a' }}>
            {formatUSD(data?.grand_total_usd)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '8px 20px',
              background: loading ? '#ccc' : '#2563eb',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'default' : 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <div style={{ fontSize: '11px', color: '#999', marginTop: '6px' }}>
            {data?.timestamp ? new Date(data.timestamp).toLocaleString() : ''}
          </div>
        </div>
      </div>

      {/* Exchange Summary Bar */}
      <div style={{
        display: 'flex',
        gap: '12px',
        marginBottom: '20px',
        flexWrap: 'wrap'
      }}>
        {exchangeOrder.map(ex => {
          const total = exchangeTotals[ex] || 0
          if (total === 0) return null
          return (
            <div key={ex} style={{
              padding: '10px 16px',
              background: '#f8f9fa',
              borderRadius: '8px',
              border: '1px solid #e9ecef'
            }}>
              <div style={{ fontSize: '11px', color: '#666', textTransform: 'uppercase', fontWeight: '600' }}>
                {ex}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', color: '#1a1a1a' }}>
                {formatUSD(total)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Main Table */}
      <div style={{ 
        border: '1px solid #e0e0e0', 
        borderRadius: '8px', 
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <table style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          fontSize: '12px'
        }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: '600',
                borderBottom: '2px solid #e0e0e0',
                color: '#374151',
                width: '100px'
              }}>
                Exchange
              </th>
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'left', 
                fontWeight: '600',
                borderBottom: '2px solid #e0e0e0',
                color: '#374151',
                width: '180px'
              }}>
                Account
              </th>
              {topCoins.map(coin => (
                <th key={coin} style={{ 
                  padding: '12px 8px', 
                  textAlign: 'right', 
                  fontWeight: '600',
                  borderBottom: '2px solid #e0e0e0',
                  color: '#374151',
                  minWidth: '80px'
                }}>
                  {coin}
                </th>
              ))}
              <th style={{ 
                padding: '12px 16px', 
                textAlign: 'right', 
                fontWeight: '700',
                borderBottom: '2px solid #e0e0e0',
                color: '#1a1a1a',
                background: '#e8f4fd',
                minWidth: '120px'
              }}>
                Total USD
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr 
                key={idx} 
                style={{ 
                  background: row.isSub ? '#fafafa' : '#fff',
                  borderBottom: '1px solid #f0f0f0'
                }}
              >
                <td style={{ 
                  padding: '10px 16px', 
                  fontWeight: row.exchange ? '600' : '400',
                  color: row.exchange ? '#1a1a1a' : '#666',
                  borderRight: '1px solid #f0f0f0'
                }}>
                  {row.exchange}
                </td>
                <td style={{ 
                  padding: '10px 16px',
                  paddingLeft: row.isSub ? '32px' : '16px',
                  color: row.isSub ? '#666' : '#1a1a1a',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  borderRight: '1px solid #f0f0f0'
                }}>
                  {row.account}
                </td>
                {topCoins.map(coin => (
                  <td key={coin} style={{ 
                    padding: '10px 8px', 
                    textAlign: 'right',
                    fontFamily: 'monospace',
                    color: (row.balances[coin] || 0) < 0 ? '#dc2626' : '#374151',
                    borderRight: '1px solid #f5f5f5'
                  }}>
                    {formatAmount(row.balances[coin])}
                  </td>
                ))}
                <td style={{ 
                  padding: '10px 16px', 
                  textAlign: 'right',
                  fontWeight: '600',
                  color: row.totalUsd < 0 ? '#dc2626' : '#1a1a1a',
                  background: '#f0f7ff',
                  fontFamily: 'monospace'
                }}>
                  {formatUSD(row.totalUsd)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1e3a5f' }}>
              <td colSpan={2} style={{ 
                padding: '14px 16px', 
                fontWeight: '700',
                color: '#fff',
                fontSize: '13px'
              }}>
                GRAND TOTAL
              </td>
              {topCoins.map(coin => (
                <td key={coin} style={{ 
                  padding: '14px 8px', 
                  textAlign: 'right',
                  color: '#94a3b8'
                }}>
                </td>
              ))}
              <td style={{ 
                padding: '14px 16px', 
                textAlign: 'right',
                fontWeight: '700',
                color: '#fff',
                fontSize: '16px',
                fontFamily: 'monospace'
              }}>
                {formatUSD(data?.grand_total_usd)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div style={{ 
        marginTop: '16px', 
        fontSize: '11px', 
        color: '#9ca3af',
        textAlign: 'center'
      }}>
        Auto-updates daily at 5PM SGT • Last refresh: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '-'}
      </div>
    </div>
  )
}
