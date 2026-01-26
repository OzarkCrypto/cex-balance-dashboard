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

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '14px',
    color: '#333',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottom: '1px solid #eee',
    paddingBottom: '15px',
    marginBottom: '20px',
  },
  totalLabel: {
    fontSize: '12px',
    color: '#888',
    marginBottom: '4px',
  },
  totalValue: {
    fontSize: '28px',
    fontWeight: 'bold',
  },
  refreshBtn: {
    padding: '8px 16px',
    background: '#f5f5f5',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  },
  timestamp: {
    fontSize: '11px',
    color: '#999',
    marginTop: '8px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '10px',
    marginBottom: '25px',
  },
  summaryCard: {
    padding: '12px',
    background: '#f9f9f9',
    borderRadius: '6px',
  },
  summaryLabel: {
    fontSize: '11px',
    color: '#888',
    textTransform: 'capitalize',
  },
  summaryValue: {
    fontWeight: '600',
    marginTop: '2px',
  },
  exchangeCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    marginBottom: '20px',
    overflow: 'hidden',
  },
  exchangeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 16px',
    background: '#fafafa',
    borderBottom: '1px solid #e0e0e0',
  },
  exchangeName: {
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  exchangeTotal: {
    fontWeight: 'bold',
    fontSize: '16px',
  },
  section: {
    padding: '12px 16px',
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#666',
    marginBottom: '10px',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  tr: {
    borderBottom: '1px solid #f0f0f0',
  },
  td: {
    padding: '6px 0',
  },
  tdCoin: {
    fontFamily: 'monospace',
    fontSize: '12px',
  },
  tdAmount: {
    textAlign: 'right',
  },
  tdUsd: {
    textAlign: 'right',
    color: '#888',
    width: '100px',
  },
  subaccountBox: {
    marginBottom: '12px',
    border: '1px solid #eee',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  subaccountHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 12px',
    background: '#f5f5f5',
    fontSize: '12px',
    fontWeight: '500',
  },
  subaccountName: {
    maxWidth: '250px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  negative: {
    color: '#d32f2f',
  },
  subTable: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  subTd: {
    padding: '5px 12px',
    borderBottom: '1px solid #f5f5f5',
  },
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(API_URL)
      if (!res.ok) throw new Error('API Error')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, 60000)
    return () => clearInterval(interval)
  }, [])

  if (!data && loading) {
    return (
      <div style={{ ...styles.container, textAlign: 'center', paddingTop: '100px' }}>
        Loading...
      </div>
    )
  }

  if (error && !data) {
    return (
      <div style={{ ...styles.container, textAlign: 'center', paddingTop: '100px', color: '#d32f2f' }}>
        Error: {error}
      </div>
    )
  }

  const exchanges = Object.entries(data?.balances || {})
    .filter(([_, d]) => (d.exchange_total_usd || 0) !== 0)
    .sort((a, b) => Math.abs(b[1].exchange_total_usd || 0) - Math.abs(a[1].exchange_total_usd || 0))

  const exchangeList = ['binance', 'bybit', 'okx', 'kucoin', 'kraken', 'zoomex']

  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <div style={styles.totalLabel}>Total Balance</div>
          <div style={styles.totalValue}>{formatUSD(data?.grand_total_usd)}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <button 
            style={styles.refreshBtn} 
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <div style={styles.timestamp}>
            {data?.timestamp ? new Date(data.timestamp).toLocaleString() : ''}
          </div>
        </div>
      </div>

      {/* Summary Grid */}
      <div style={styles.summaryGrid}>
        {exchangeList.map(ex => {
          const d = data?.balances?.[ex]
          return (
            <div key={ex} style={styles.summaryCard}>
              <div style={styles.summaryLabel}>{ex}</div>
              <div style={styles.summaryValue}>{formatUSD(d?.exchange_total_usd || 0)}</div>
            </div>
          )
        })}
      </div>

      {/* Exchange Details */}
      {exchanges.map(([exName, exData]) => (
        <div key={exName} style={styles.exchangeCard}>
          {/* Header */}
          <div style={styles.exchangeHeader}>
            <span style={styles.exchangeName}>{exName}</span>
            <span style={styles.exchangeTotal}>{formatUSD(exData.exchange_total_usd)}</span>
          </div>

          {/* Master Account */}
          {(exData.master_usd || 0) !== 0 && (
            <div style={{ ...styles.section, borderBottom: '1px solid #e0e0e0' }}>
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
                      <tr key={coin} style={styles.tr}>
                        <td style={{ ...styles.td, ...styles.tdCoin }}>{coin}</td>
                        <td style={{ ...styles.td, ...styles.tdAmount }}>{formatNum(info.amount)}</td>
                        <td style={{ ...styles.td, ...styles.tdUsd }}>{formatUSD(info.usd)}</td>
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
                  <div key={subName} style={styles.subaccountBox}>
                    <div style={styles.subaccountHeader}>
                      <span style={styles.subaccountName} title={subName}>{subName}</span>
                      <span style={subData.usd < 0 ? styles.negative : {}}>
                        {formatUSD(subData.usd)}
                      </span>
                    </div>
                    <table style={styles.subTable}>
                      <tbody>
                        {Object.entries(subData.breakdown || {})
                          .filter(([_, v]) => Math.abs(v.usd) >= 0.01)
                          .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                          .map(([coin, info]) => (
                            <tr key={coin}>
                              <td style={{ ...styles.subTd, fontFamily: 'monospace' }}>{coin}</td>
                              <td style={{ ...styles.subTd, textAlign: 'right' }}>{formatNum(info.amount)}</td>
                              <td style={{ ...styles.subTd, textAlign: 'right', color: '#888', width: '90px' }}>
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
