'use client'

import { useState, useEffect } from 'react'

const EXCHANGES = [
  { id: 'binance', name: 'Binance', color: '#F0B90B' },
  { id: 'bybit', name: 'Bybit', color: '#FF6600' },
  { id: 'okx', name: 'OKX', color: '#000000' },
  { id: 'kucoin', name: 'KuCoin', color: '#23AF91' },
  { id: 'kraken', name: 'Kraken', color: '#5741D9' },
  { id: 'zoomex', name: 'Zoomex', color: '#00C8FF' },
]

const formatNumber = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) return '-'
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num)
}

const formatUSD = (num) => {
  if (num === null || num === undefined || isNaN(num)) return '$0.00'
  return `$${formatNumber(num)}`
}

export default function Dashboard() {
  const [balances, setBalances] = useState({})
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchBalances = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/balances')
      const data = await res.json()
      
      const formatted = {}
      EXCHANGES.forEach(ex => {
        const assets = data.balances?.[ex.id] || []
        const totalUsd = assets.reduce((sum, a) => sum + (a.usdValue || 0), 0)
        formatted[ex.id] = { total_usd: totalUsd, assets }
      })
      
      setBalances(formatted)
      setErrors(data.errors || {})
      setLastUpdate(new Date())
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalances()
  }, [])

  const totalBalance = Object.values(balances).reduce(
    (sum, ex) => sum + (ex?.total_usd || 0), 0
  )

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>CEX Balance</h1>
        <div style={styles.headerRight}>
          {lastUpdate && (
            <span style={styles.time}>{lastUpdate.toLocaleTimeString('ko-KR')}</span>
          )}
          <button 
            onClick={fetchBalances} 
            disabled={loading}
            style={styles.btn}
          >
            {loading ? '...' : 'Refresh'}
          </button>
        </div>
      </header>

      <div style={styles.totalRow}>
        <span style={styles.totalLabel}>Total</span>
        <span style={styles.totalValue}>{formatUSD(totalBalance)}</span>
      </div>

      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}>Exchange</th>
            <th style={styles.thRight}>Balance</th>
            <th style={styles.thRight}>Assets</th>
            <th style={styles.th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {EXCHANGES.map(ex => {
            const data = balances[ex.id] || { total_usd: 0, assets: [] }
            const error = errors[ex.id]
            
            return (
              <tr key={ex.id} style={styles.tr}>
                <td style={styles.td}>
                  <span style={{...styles.dot, background: ex.color}} />
                  {ex.name}
                </td>
                <td style={styles.tdRight}>{formatUSD(data.total_usd)}</td>
                <td style={styles.tdRight}>
                  {data.assets.length > 0 
                    ? data.assets.map(a => `${a.currency}: ${formatNumber(a.balance, 4)}`).join(', ')
                    : '-'
                  }
                </td>
                <td style={styles.td}>
                  {error 
                    ? <span style={styles.error}>Error</span>
                    : data.assets.length > 0 
                      ? <span style={styles.ok}>OK</span>
                      : <span style={styles.empty}>Empty</span>
                  }
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {Object.keys(errors).length > 0 && (
        <div style={styles.errorBox}>
          <strong>Errors:</strong>
          {Object.entries(errors).map(([ex, msg]) => (
            <div key={ex}>{ex}: {msg}</div>
          ))}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '20px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  title: {
    fontSize: '20px',
    fontWeight: '600',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  time: {
    fontSize: '13px',
    color: '#666',
  },
  btn: {
    padding: '6px 14px',
    background: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    fontSize: '13px',
    cursor: 'pointer',
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#fff',
    borderRadius: '8px',
    marginBottom: '20px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  totalLabel: {
    fontSize: '14px',
    color: '#666',
  },
  totalValue: {
    fontSize: '24px',
    fontWeight: '700',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    background: '#fff',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  th: {
    textAlign: 'left',
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#666',
    borderBottom: '1px solid #eee',
  },
  thRight: {
    textAlign: 'right',
    padding: '12px 16px',
    fontSize: '12px',
    fontWeight: '500',
    color: '#666',
    borderBottom: '1px solid #eee',
  },
  tr: {
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '12px 16px',
    fontSize: '14px',
  },
  tdRight: {
    padding: '12px 16px',
    fontSize: '14px',
    textAlign: 'right',
    fontFamily: "'SF Mono', monospace",
  },
  dot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    marginRight: '8px',
  },
  ok: {
    color: '#22c55e',
    fontSize: '12px',
  },
  empty: {
    color: '#999',
    fontSize: '12px',
  },
  error: {
    color: '#ef4444',
    fontSize: '12px',
  },
  errorBox: {
    marginTop: '20px',
    padding: '12px 16px',
    background: '#fef2f2',
    borderRadius: '6px',
    fontSize: '12px',
    color: '#991b1b',
  },
}
