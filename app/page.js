'use client'

import { useState, useEffect } from 'react'

const API_URL = 'https://hqr2yft2ej.execute-api.ap-northeast-2.amazonaws.com/prod/balances'

const EXCHANGES = [
  { id: 'binance', name: 'Binance', color: '#F0B90B' },
  { id: 'bybit', name: 'Bybit', color: '#FF6600' },
  { id: 'okx', name: 'OKX', color: '#000000' },
  { id: 'kucoin', name: 'KuCoin', color: '#23AF91' },
  { id: 'kraken', name: 'Kraken', color: '#5741D9' },
  { id: 'zoomex', name: 'Zoomex', color: '#00C8FF' },
]

const formatNumber = (num) => {
  if (num === 0) return '0'
  if (num < 0.00001) return num.toExponential(4)
  if (num < 1) return num.toFixed(8).replace(/\.?0+$/, '')
  if (num < 1000) return num.toFixed(4).replace(/\.?0+$/, '')
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchBalances = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(API_URL)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalances()
  }, [])

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.title}>💰 CEX Balance Dashboard</h1>
        <div style={styles.headerRight}>
          {data?.timestamp && (
            <span style={styles.time}>
              {new Date(data.timestamp).toLocaleString('ko-KR')}
            </span>
          )}
          <button onClick={fetchBalances} disabled={loading} style={styles.btn}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      {error && <div style={styles.errorBox}>Error: {error}</div>}

      {loading && !data ? (
        <div style={styles.loading}>Loading...</div>
      ) : (
        <div style={styles.grid}>
          {EXCHANGES.map(ex => {
            const balanceData = data?.balances?.[ex.id]
            const exchangeError = data?.errors?.[ex.id]
            
            return (
              <div key={ex.id} style={styles.card}>
                <div style={styles.cardHeader}>
                  <div style={styles.exchangeName}>
                    <span style={{...styles.dot, background: ex.color}} />
                    {ex.name}
                  </div>
                  <span style={exchangeError ? styles.statusError : styles.statusOk}>
                    {exchangeError ? 'Error' : 'Connected'}
                  </span>
                </div>

                {exchangeError ? (
                  <div style={styles.cardError}>{exchangeError}</div>
                ) : (
                  <>
                    {balanceData?.master && Object.keys(balanceData.master).length > 0 && (
                      <div style={styles.section}>
                        <div style={styles.sectionTitle}>Master Account</div>
                        <table style={styles.balanceTable}>
                          <tbody>
                            {Object.entries(balanceData.master)
                              .sort((a, b) => b[1] - a[1])
                              .map(([coin, amount]) => (
                                <tr key={coin}>
                                  <td style={styles.coinName}>{coin}</td>
                                  <td style={styles.coinAmount}>{formatNumber(amount)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {balanceData?.subaccounts && Object.keys(balanceData.subaccounts).length > 0 && (
                      Object.entries(balanceData.subaccounts).map(([subName, subBal]) => (
                        <div key={subName} style={styles.section}>
                          <div style={styles.sectionTitle}>Sub: {subName}</div>
                          <table style={styles.balanceTable}>
                            <tbody>
                              {Object.entries(subBal)
                                .sort((a, b) => b[1] - a[1])
                                .map(([coin, amount]) => (
                                  <tr key={coin}>
                                    <td style={styles.coinName}>{coin}</td>
                                    <td style={styles.coinAmount}>{formatNumber(amount)}</td>
                                  </tr>
                                ))}
                            </tbody>
                          </table>
                        </div>
                      ))
                    )}

                    {balanceData?.total && Object.keys(balanceData.total).length > 0 && (
                      <div style={{...styles.section, ...styles.totalSection}}>
                        <div style={styles.sectionTitle}>Total</div>
                        <table style={styles.balanceTable}>
                          <tbody>
                            {Object.entries(balanceData.total)
                              .sort((a, b) => b[1] - a[1])
                              .map(([coin, amount]) => (
                                <tr key={coin}>
                                  <td style={styles.coinName}>{coin}</td>
                                  <td style={styles.coinAmount}>{formatNumber(amount)}</td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {(!balanceData?.total || Object.keys(balanceData.total).length === 0) && (
                      <div style={styles.empty}>No balances</div>
                    )}
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '1px solid #e5e7eb',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    margin: 0,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  time: {
    fontSize: '14px',
    color: '#6b7280',
  },
  btn: {
    padding: '8px 16px',
    background: '#000',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  loading: {
    textAlign: 'center',
    padding: '60px',
    color: '#6b7280',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: '20px',
  },
  card: {
    background: '#fff',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    borderBottom: '1px solid #e5e7eb',
  },
  exchangeName: {
    fontSize: '18px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
  },
  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    marginRight: '10px',
  },
  statusOk: {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '20px',
    background: '#dcfce7',
    color: '#166534',
  },
  statusError: {
    fontSize: '12px',
    padding: '4px 10px',
    borderRadius: '20px',
    background: '#fee2e2',
    color: '#991b1b',
  },
  section: {
    padding: '16px 20px',
    borderBottom: '1px solid #f3f4f6',
  },
  totalSection: {
    background: '#f9fafb',
  },
  sectionTitle: {
    fontSize: '12px',
    color: '#6b7280',
    textTransform: 'uppercase',
    marginBottom: '12px',
    letterSpacing: '0.5px',
  },
  balanceTable: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  coinName: {
    padding: '6px 0',
    fontSize: '14px',
    fontWeight: '500',
  },
  coinAmount: {
    padding: '6px 0',
    fontSize: '14px',
    textAlign: 'right',
    fontFamily: "'SF Mono', Consolas, monospace",
  },
  empty: {
    padding: '30px 20px',
    textAlign: 'center',
    color: '#9ca3af',
    fontStyle: 'italic',
  },
  cardError: {
    padding: '16px 20px',
    background: '#fef2f2',
    color: '#991b1b',
    fontSize: '13px',
  },
  errorBox: {
    padding: '12px 16px',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    marginBottom: '20px',
    color: '#991b1b',
  },
}
