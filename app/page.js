'use client'

import { useState, useEffect } from 'react'

const API_URL = 'https://hqr2yft2ej.execute-api.ap-northeast-2.amazonaws.com/prod/balances'

const formatUSD = (n) => {
  if (!n) return '$0.00'
  const prefix = n < 0 ? '-$' : '$'
  return prefix + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const formatNum = (n) => {
  if (!n) return '0'
  if (Math.abs(n) < 0.0001) return n.toExponential(2)
  if (Math.abs(n) < 1) return n.toFixed(6)
  return n.toLocaleString('en-US', { maximumFractionDigits: 4 })
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_URL)
      if (!res.ok) throw new Error('API Error')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const i = setInterval(fetchData, 60000)
    return () => clearInterval(i)
  }, [])

  if (!data && loading) {
    return <div style={styles.loading}>Loading...</div>
  }

  if (error) {
    return <div style={styles.error}>Error: {error}</div>
  }

  const exchanges = Object.entries(data?.balances || {})
    .filter(([_, d]) => (d.exchange_total_usd || 0) !== 0)
    .sort((a, b) => Math.abs(b[1].exchange_total_usd || 0) - Math.abs(a[1].exchange_total_usd || 0))

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.label}>Total Balance</div>
          <div style={styles.totalAmount}>{formatUSD(data?.grand_total_usd)}</div>
          <div style={styles.timestamp}>
            Updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '-'}
          </div>
        </div>
        <button onClick={fetchData} disabled={loading} style={styles.refreshBtn}>
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Grid */}
      <div style={styles.summaryGrid}>
        {['binance', 'bybit', 'okx', 'kucoin', 'kraken', 'zoomex'].map(ex => {
          const d = data?.balances?.[ex]
          const total = d?.exchange_total_usd || 0
          return (
            <div key={ex} style={styles.summaryCard}>
              <div style={styles.summaryLabel}>{ex.toUpperCase()}</div>
              <div style={{...styles.summaryValue, color: total === 0 ? '#999' : '#000'}}>
                {formatUSD(total)}
              </div>
            </div>
          )
        })}
      </div>

      {/* Exchange Details */}
      {exchanges.map(([exName, exData]) => (
        <div key={exName} style={styles.exchangeCard}>
          <div style={styles.exchangeHeader}>
            <span style={styles.exchangeName}>{exName.toUpperCase()}</span>
            <span style={styles.exchangeTotal}>{formatUSD(exData.exchange_total_usd)}</span>
          </div>

          {/* Master Account */}
          {(exData.master_usd || 0) !== 0 && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span>Master Account</span>
                <span>{formatUSD(exData.master_usd)}</span>
              </div>
              <table style={styles.table}>
                <tbody>
                  {Object.entries(exData.master_breakdown || {})
                    .filter(([_, v]) => Math.abs(v.usd) >= 1)
                    .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                    .map(([coin, info]) => (
                      <tr key={coin}>
                        <td style={styles.coinCell}>{coin}</td>
                        <td style={styles.amountCell}>{formatNum(info.amount)}</td>
                        <td style={styles.usdCell}>{formatUSD(info.usd)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Subaccounts */}
          {(exData.subaccounts_total_usd || 0) !== 0 && (
            <div style={styles.section}>
              <div style={styles.sectionHeader}>
                <span>Subaccounts</span>
                <span>{formatUSD(exData.subaccounts_total_usd)}</span>
              </div>
              {Object.entries(exData.subaccounts_usd || {})
                .filter(([_, v]) => Math.abs(v.usd) >= 1)
                .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                .map(([subName, subData]) => (
                  <div key={subName} style={styles.subaccount}>
                    <div style={styles.subaccountHeader}>
                      <span style={styles.subaccountName} title={subName}>{subName}</span>
                      <span style={{...styles.subaccountTotal, color: subData.usd < 0 ? '#dc3545' : '#000'}}>
                        {formatUSD(subData.usd)}
                      </span>
                    </div>
                    <table style={styles.table}>
                      <tbody>
                        {Object.entries(subData.breakdown || {})
                          .filter(([_, v]) => Math.abs(v.usd) >= 0.01)
                          .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                          .map(([coin, info]) => (
                            <tr key={coin}>
                              <td style={styles.coinCell}>{coin}</td>
                              <td style={styles.amountCell}>{formatNum(info.amount)}</td>
                              <td style={{...styles.usdCell, color: info.usd < 0 ? '#dc3545' : '#666'}}>
                                {formatUSD(info.usd)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    fontSize: '14px',
    color: '#333',
    background: '#fff',
    minHeight: '100vh',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '16px',
    color: '#666',
  },
  error: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontSize: '16px',
    color: '#dc3545',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottom: '1px solid #e0e0e0',
    paddingBottom: '16px',
    marginBottom: '20px',
  },
  label: {
    fontSize: '12px',
    color: '#666',
    marginBottom: '4px',
  },
  totalAmount: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#000',
  },
  timestamp: {
    fontSize: '11px',
    color: '#999',
    marginTop: '4px',
  },
  refreshBtn: {
    padding: '8px 16px',
    fontSize: '12px',
    background: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '8px',
    marginBottom: '24px',
  },
  summaryCard: {
    padding: '12px',
    background: '#f8f9fa',
    borderRadius: '4px',
  },
  summaryLabel: {
    fontSize: '10px',
    color: '#666',
    marginBottom: '4px',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: '13px',
    fontWeight: '600',
  },
  exchangeCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    marginBottom: '16px',
    overflow: 'hidden',
  },
  exchangeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#f8f9fa',
    borderBottom: '1px solid #e0e0e0',
  },
  exchangeName: {
    fontWeight: '600',
    fontSize: '14px',
  },
  exchangeTotal: {
    fontWeight: '700',
    fontSize: '16px',
  },
  section: {
    padding: '12px 16px',
    borderBottom: '1px solid #f0f0f0',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#666',
    marginBottom: '8px',
    fontWeight: '500',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  coinCell: {
    padding: '6px 0',
    fontFamily: "'SF Mono', 'Monaco', monospace",
    fontSize: '12px',
    borderBottom: '1px solid #f5f5f5',
  },
  amountCell: {
    padding: '6px 8px',
    textAlign: 'right',
    fontFamily: "'SF Mono', 'Monaco', monospace",
    fontSize: '12px',
    borderBottom: '1px solid #f5f5f5',
  },
  usdCell: {
    padding: '6px 0',
    textAlign: 'right',
    color: '#666',
    fontSize: '12px',
    width: '100px',
    borderBottom: '1px solid #f5f5f5',
  },
  subaccount: {
    marginBottom: '12px',
    background: '#fafafa',
    borderRadius: '4px',
    padding: '8px',
  },
  subaccountHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    paddingBottom: '6px',
    borderBottom: '1px solid #eee',
  },
  subaccountName: {
    fontSize: '12px',
    fontWeight: '500',
    maxWidth: '250px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  subaccountTotal: {
    fontSize: '13px',
    fontWeight: '600',
  },
}
