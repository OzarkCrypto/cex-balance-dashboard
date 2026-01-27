// Build: 1769480363
'use client'

import { useState, useEffect } from 'react'

const API_URL = 'https://hqr2yft2ej.execute-api.ap-northeast-2.amazonaws.com/prod/balances'
const SNAPSHOTS_URL = 'https://hqr2yft2ej.execute-api.ap-northeast-2.amazonaws.com/prod/snapshots'

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
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('current') // 'current' or 'history'
  const [selectedDate, setSelectedDate] = useState(null)

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

  const fetchSnapshots = async () => {
    try {
      const res = await fetch(SNAPSHOTS_URL)
      const json = await res.json()
      setSnapshots(json.snapshots || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    fetchData()
    fetchSnapshots()
  }, [])

  // 히스토리 뷰에서는 스냅샷만 표시
  const displayData = view === 'history'
    ? (selectedDate ? snapshots.find(s => s.date === selectedDate) : snapshots[0])
    : data

  if (!data && loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'system-ui' }}>
        Loading...
      </div>
    )
  }

  // 데이터 파싱
  const coinTotals = {}
  const rows = []
  const exchangeOrder = ['binance', 'bybit', 'okx', 'zoomex', 'kucoin', 'kraken']
  
  const balances = displayData?.balances || data?.balances || {}
  
  for (const ex of exchangeOrder) {
    const exData = balances[ex]
    const masterBal = exData?.master_breakdown || {}
    const masterUsd = exData?.master_usd || 0
    const exchangeTotalUsd = exData?.exchange_total_usd || 0
    
    // Exchange Total row (합계)
    const totalRow = {
      exchange: ex.toUpperCase(),
      account: 'Total',
      balances: {},
      totalUsd: exchangeTotalUsd,
      isExchangeTotal: true
    }
    
    // Master row
    const masterRow = {
      exchange: '',
      account: 'Master',
      balances: {},
      totalUsd: masterUsd,
      isMaster: true
    }
    
    for (const [coin, info] of Object.entries(masterBal)) {
      const cleanCoin = coin.replace('_FUTURES', '').replace('_COIN_FUTURES', '').replace('_EARN_LOCKED', '').replace('_EARN', '').replace('_MARGIN', '')
      const existing = masterRow.balances[cleanCoin] || { amount: 0, usd: 0 }
      masterRow.balances[cleanCoin] = {
        amount: existing.amount + info.amount,
        usd: existing.usd + (info.usd || 0)
      }
      // Total row에도 합산
      const existingTotal = totalRow.balances[cleanCoin] || { amount: 0, usd: 0 }
      totalRow.balances[cleanCoin] = {
        amount: existingTotal.amount + info.amount,
        usd: existingTotal.usd + (info.usd || 0)
      }
      coinTotals[cleanCoin] = (coinTotals[cleanCoin] || 0) + Math.abs(info.usd || 0)
    }

    const subs = exData?.subaccounts_usd || {}
    const subRows = []
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
        const cleanCoin = coin.replace('_FUTURES', '').replace('_COIN_FUTURES', '').replace('_EARN_LOCKED', '').replace('_EARN', '').replace('_MARGIN', '')
        const existing = row.balances[cleanCoin] || { amount: 0, usd: 0 }
        row.balances[cleanCoin] = {
          amount: existing.amount + info.amount,
          usd: existing.usd + (info.usd || 0)
        }
        // Total row에도 합산
        const existingTotal = totalRow.balances[cleanCoin] || { amount: 0, usd: 0 }
        totalRow.balances[cleanCoin] = {
          amount: existingTotal.amount + info.amount,
          usd: existingTotal.usd + (info.usd || 0)
        }
        coinTotals[cleanCoin] = (coinTotals[cleanCoin] || 0) + Math.abs(info.usd || 0)
      }
      subRows.push(row)
    }
    
    // Total -> Master -> Subs 순서로 추가
    rows.push(totalRow)
    rows.push(masterRow)
    subRows.forEach(r => rows.push(r))
  }

  const topCoins = Object.entries(coinTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([coin]) => coin)

  const exchangeTotals = {}
  for (const ex of exchangeOrder) {
    exchangeTotals[ex] = balances[ex]?.exchange_total_usd || 0
  }

  // 차트 데이터
  const chartData = [...snapshots].reverse()
  const maxTotal = Math.max(...chartData.map(s => s.grand_total_usd), displayData?.grand_total_usd || 0)
  const minTotal = Math.min(...chartData.map(s => s.grand_total_usd), displayData?.grand_total_usd || 0) * 0.95

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
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>
            {selectedDate ? `Snapshot: ${selectedDate}` : 'Total Balance'}
          </div>
          <div style={{ fontSize: '32px', fontWeight: '700', color: '#1a1a1a' }}>
            {formatUSD(displayData?.grand_total_usd)}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => { setView('current'); setSelectedDate(null); }}
            style={{
              padding: '8px 16px',
              background: view === 'current' ? '#2563eb' : '#f3f4f6',
              color: view === 'current' ? '#fff' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
          >
            Current
          </button>
          <button
            onClick={() => setView('history')}
            style={{
              padding: '8px 16px',
              background: view === 'history' ? '#2563eb' : '#f3f4f6',
              color: view === 'history' ? '#fff' : '#374151',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500'
            }}
          >
            History
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '8px 20px',
              background: loading ? '#ccc' : '#10b981',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'default' : 'pointer',
              fontSize: '13px',
              fontWeight: '500'
            }}
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* History Chart */}
      {view === 'history' && snapshots.length > 0 && (
        <div style={{
          marginBottom: '20px',
          padding: '20px',
          background: '#f8f9fa',
          borderRadius: '12px',
          border: '1px solid #e0e0e0'
        }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '15px', color: '#374151' }}>
            Balance History
          </div>
          <div style={{ 
            display: 'flex', 
            alignItems: 'end', 
            height: '150px', 
            gap: '2px',
            paddingBottom: '25px',
            position: 'relative'
          }}>
            {chartData.map((snap, idx) => {
              const height = ((snap.grand_total_usd - minTotal) / (maxTotal - minTotal)) * 100
              const isSelected = selectedDate === snap.date
              return (
                <div
                  key={snap.date}
                  onClick={() => setSelectedDate(snap.date)}
                  style={{
                    flex: 1,
                    height: `${Math.max(height, 5)}%`,
                    background: isSelected ? '#2563eb' : '#94a3b8',
                    borderRadius: '3px 3px 0 0',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    minWidth: '8px',
                    position: 'relative'
                  }}
                  title={`${snap.date}: ${formatUSD(snap.grand_total_usd)}`}
                >
                  {isSelected && (
                    <div style={{
                      position: 'absolute',
                      bottom: '-22px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '9px',
                      color: '#2563eb',
                      whiteSpace: 'nowrap',
                      fontWeight: '600'
                    }}>
                      {snap.date.slice(5)}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            fontSize: '10px', 
            color: '#9ca3af',
            marginTop: '5px'
          }}>
            <span>{chartData[0]?.date}</span>
            <span>{chartData[chartData.length - 1]?.date}</span>
          </div>
        </div>
      )}

      {/* Exchange Summary */}
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
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ background: '#f8f9fa' }}>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e0e0e0', color: '#374151', width: '100px' }}>
                Exchange
              </th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e0e0e0', color: '#374151', width: '180px' }}>
                Account
              </th>
              {topCoins.map(coin => (
                <th key={coin} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e0e0e0', color: '#374151', minWidth: '80px' }}>
                  {coin}
                </th>
              ))}
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', borderBottom: '2px solid #e0e0e0', color: '#1a1a1a', background: '#e8f4fd', minWidth: '120px' }}>
                Total USD
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} style={{ 
                background: row.isExchangeTotal ? '#eef2ff' : (row.isMaster ? '#fff' : (row.isSub ? '#fafafa' : '#fff')), 
                borderBottom: row.isExchangeTotal ? '2px solid #c7d2fe' : '1px solid #f0f0f0'
              }}>
                <td style={{ 
                  padding: '10px 16px', 
                  fontWeight: row.exchange ? '700' : '400', 
                  color: row.exchange ? '#1e3a8a' : '#666', 
                  borderRight: '1px solid #f0f0f0', 
                  background: row.isExchangeTotal ? '#dbeafe' : 'transparent'
                }}>
                  {row.exchange}
                </td>
                <td style={{ 
                  padding: '10px 16px', 
                  paddingLeft: row.isSub ? '32px' : (row.isMaster ? '24px' : '16px'), 
                  color: row.isExchangeTotal ? '#1e3a8a' : (row.isSub ? '#666' : '#1a1a1a'), 
                  fontFamily: row.isSub ? 'monospace' : 'inherit', 
                  fontSize: row.isSub ? '11px' : '12px', 
                  fontWeight: row.isExchangeTotal ? '600' : '400',
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
                      verticalAlign: 'middle',
                      fontWeight: row.isExchangeTotal ? '600' : '400'
                    }}>
                      {amountStr ? (
                        <div>
                          <div style={{ color: amount < 0 ? '#dc2626' : (row.isExchangeTotal ? '#1e3a8a' : '#374151'), fontSize: '12px' }}>
                            {amountStr}
                          </div>
                          {usd && Math.abs(usd) >= 1 && (
                            <div style={{ color: row.isExchangeTotal ? '#3b82f6' : '#9ca3af', fontSize: '10px', marginTop: '2px' }}>
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
                  fontWeight: row.isExchangeTotal ? '700' : '600', 
                  color: row.totalUsd < 0 ? '#dc2626' : (row.totalUsd === 0 ? '#9ca3af' : (row.isExchangeTotal ? '#1e3a8a' : '#1a1a1a')), 
                  background: row.isExchangeTotal ? '#bfdbfe' : '#f0f7ff', 
                  fontFamily: 'monospace',
                  fontSize: row.isExchangeTotal ? '14px' : '12px'
                }}>
                  {formatUSD(row.totalUsd)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#1e3a5f' }}>
              <td colSpan={2} style={{ padding: '14px 16px', fontWeight: '700', color: '#fff', fontSize: '13px' }}>
                GRAND TOTAL
              </td>
              {topCoins.map(coin => (
                <td key={coin} style={{ padding: '14px 8px', textAlign: 'right', color: '#94a3b8' }}></td>
              ))}
              <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#fff', fontSize: '16px', fontFamily: 'monospace' }}>
                {formatUSD(displayData?.grand_total_usd)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Footer */}
      <div style={{ marginTop: '16px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>
        Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '-'} • Snapshots saved daily at 5PM SGT • {snapshots.length} snapshots available
      </div>
    </div>
  )
}

