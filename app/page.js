'use client'

import { useState, useEffect } from 'react'

const API_URL = 'https://hqr2yft2ej.execute-api.ap-northeast-2.amazonaws.com/prod/balances'

const formatUSD = (n) => {
  if (n === undefined || n === null) return '$0'
  if (Math.abs(n) < 0.01) return '$0'
  const prefix = n < 0 ? '-$' : '$'
  return prefix + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const formatAmount = (n) => {
  if (!n || Math.abs(n) < 0.0001) return null
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

  // 데이터 파싱 - 모든 6개 거래소
  const exchangeOrder = ['binance', 'bybit', 'okx', 'zoomex', 'kucoin', 'kraken']
  
  for (const ex of exchangeOrder) {
    const exData = data?.balances?.[ex]
    
    // Master 계정 - 항상 표시
    const masterBal = exData?.master_breakdown || {}
    const masterUsd = exData?.master_usd || 0
    
    const masterRow = {
      exchange: ex.toUpperCase(),
      account: 'Master',
      balances: {},
      totalUsd: masterUsd,
      isExchangeHeader: true
    }
    
    for (const [coin, info] of Object.entries(masterBal)) {
      const cleanCoin = coin.replace('_FUTURES', '').replace('_COIN_FUTURES', '')
      const existing = masterRow.balances[cleanCoin] || { amount: 0, usd: 0 }
      masterRow.balances[cleanCoin] = {
        amount: existing.amount + info.amount,
        usd: existing.usd + (info.usd || 0)
      }
      coinTotals[cleanCoin] = (coinTotals[cleanCoin] || 0) + Math.abs(info.usd || 0)
    }
    rows.push(masterRow)

    // Subaccounts
    const subs = exData?.subaccounts_usd || {}
    for (const [subName, subData] of Object.entries(subs)) {
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
        const existing = row.balances[cleanCoin] || { amount: 0, usd: 0 }
        row.balances[cleanCoin] = {
          amount: existing.amount + info.amount,
          usd: existing.usd + (info.usd || 0)
        }
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

  // 거래소별 합계
  const exchangeTotals = {}
  for (const ex of exchangeOrder) {
    exchangeTotals[ex] = data?.balances?.[ex]?.exchange_total_usd || 0
  }
  
  // 디버깅
  console.log('Exchange Totals:', exchangeTotals)
  console.log('OKX raw data:', data?.balances?.okx)

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

      {/* Exchange Summary Bar - 모든 6개 거래소 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(6, 1fr)',
        gap: '10px',
        marginBottom: '20px'
      }}>
        {exchangeOrder.map(ex => {
          const total = exchangeTotals[ex]
          return (
            <div key={ex} style={{
              padding: '12px 14px',
              background: total > 0 ? '#f8f9fa' : '#fafafa',
              borderRadius: '8px',
              border: total > 0 ? '1px solid #e0e0e0' : '1px solid #eee'
            }}>
              <div style={{ 
                fontSize: '11px', 
                color: total > 0 ? '#374151' : '#9ca3af', 
                textTransform: 'uppercase', 
                fontWeight: '600' 
              }}>
                {ex}
              </div>
              <div style={{ 
                fontSize: '16px', 
                fontWeight: '700', 
                color: total > 0 ? '#1a1a1a' : '#d1d5db'
              }}>
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
                  background: row.isExchangeHeader ? '#fff' : (row.isSub ? '#fafafa' : '#fff'),
                  borderBottom: '1px solid #f0f0f0'
                }}
              >
                <td style={{ 
                  padding: '10px 16px', 
                  fontWeight: row.exchange ? '600' : '400',
                  color: row.exchange ? '#1a1a1a' : '#666',
                  borderRight: '1px solid #f0f0f0',
                  background: row.isExchangeHeader ? '#f8f9fa' : 'transparent'
                }}>
                  {row.exchange}
                </td>
                <td style={{ 
                  padding: '10px 16px',
                  paddingLeft: row.isSub ? '32px' : '16px',
                  color: row.isSub ? '#666' : '#1a1a1a',
                  fontFamily: row.isSub ? 'monospace' : 'inherit',
                  fontSize: row.isSub ? '11px' : '12px',
                  borderRight: '1px solid #f0f0f0'
                }}>
                  {row.account}
                </td>
                {topCoins.map(coin => {
                  const coinData = row.balances[coin]
                  const amount = coinData?.amount
                  const usd = coinData?.usd
                  const amountStr = formatAmount(amount)
                  return (
                    <td key={coin} style={{ 
                      padding: '6px 8px', 
                      textAlign: 'right',
                      fontFamily: 'monospace',
                      borderRight: '1px solid #f5f5f5',
                      verticalAlign: 'middle'
                    }}>
                      {amountStr ? (
                        <div>
                          <div style={{ 
                            color: amount < 0 ? '#dc2626' : '#374151',
                            fontSize: '12px'
                          }}>
                            {amountStr}
                          </div>
                          {usd && Math.abs(usd) >= 1 && (
                            <div style={{ 
                              color: '#9ca3af', 
                              fontSize: '10px',
                              marginTop: '2px'
                            }}>
                              {formatUSD(usd)}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#e5e7eb' }}>-</span>
                      )}
                    </td>
                  )
                })}
                <td style={{ 
                  padding: '10px 16px', 
                  textAlign: 'right',
                  fontWeight: '600',
                  color: row.totalUsd < 0 ? '#dc2626' : (row.totalUsd === 0 ? '#9ca3af' : '#1a1a1a'),
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
        Auto-updates daily at 5PM SGT
      </div>
    </div>
  )
}
