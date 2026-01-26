'use client'

import { useState, useEffect } from 'react'

const EXCHANGES = [
  { id: 'binance', name: 'Binance', color: '#F0B90B' },
  { id: 'bybit', name: 'Bybit', color: '#FF6600' },
  { id: 'okx', name: 'OKX', color: '#FFFFFF' },
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
  if (num === null || num === undefined || isNaN(num)) return '-'
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`
  }
  if (num >= 1000) {
    return `$${(num / 1000).toFixed(2)}K`
  }
  return `$${formatNumber(num)}`
}

export default function Dashboard() {
  const [balances, setBalances] = useState({})
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [error, setError] = useState(null)
  const [selectedExchange, setSelectedExchange] = useState(null)

  useEffect(() => {
    fetchBalances()
    const interval = setInterval(fetchBalances, 60000) // 1분마다 갱신
    return () => clearInterval(interval)
  }, [])

  const fetchBalances = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/balances')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      
      // API 응답을 대시보드 형식으로 변환
      const formatted = {}
      EXCHANGES.forEach(ex => {
        const assets = data.balances?.[ex.id] || []
        const totalUsd = assets.reduce((sum, a) => sum + (a.usdValue || 0), 0)
        formatted[ex.id] = {
          total_usd: totalUsd,
          assets: assets,
          error: data.errors?.[ex.id]
        }
      })
      
      setBalances(formatted)
      setLastUpdate(new Date())
      setError(null)
    } catch (err) {
      setError('데이터를 불러올 수 없습니다')
    } finally {
      setLoading(false)
    }
  }

  const totalBalance = Object.values(balances).reduce(
    (sum, ex) => sum + (ex?.total_usd || 0), 0
  )

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>CEX Balance</h1>
          <span style={styles.subtitle}>Multi-Exchange Dashboard</span>
        </div>
        <div style={styles.headerRight}>
          {lastUpdate && (
            <span style={styles.lastUpdate}>
              Last update: {lastUpdate.toLocaleTimeString('ko-KR')}
            </span>
          )}
          <button onClick={fetchBalances} style={styles.refreshBtn}>
            ↻ Refresh
          </button>
        </div>
      </header>

      {/* Total Balance */}
      <div style={styles.totalCard}>
        <span style={styles.totalLabel}>Total Balance</span>
        <span style={styles.totalValue} className="mono">
          {formatUSD(totalBalance)}
        </span>
      </div>

      {/* Exchange Grid */}
      <div style={styles.grid}>
        {EXCHANGES.map((exchange) => {
          const data = balances[exchange.id] || { total_usd: 0, assets: [] }
          const isSelected = selectedExchange === exchange.id
          
          return (
            <div
              key={exchange.id}
              style={{
                ...styles.card,
                ...(isSelected ? styles.cardSelected : {}),
                borderColor: isSelected ? exchange.color : 'var(--border-color)',
              }}
              onClick={() => setSelectedExchange(isSelected ? null : exchange.id)}
            >
              <div style={styles.cardHeader}>
                <div style={styles.exchangeName}>
                  <span 
                    style={{
                      ...styles.exchangeDot,
                      backgroundColor: exchange.color,
                    }}
                  />
                  {exchange.name}
                </div>
                <span style={styles.cardValue} className="mono">
                  {formatUSD(data.total_usd)}
                </span>
              </div>

              {/* Asset Breakdown */}
              {data.assets && data.assets.length > 0 && (
                <div style={styles.assetList}>
                  {data.assets.slice(0, isSelected ? 20 : 5).map((asset, idx) => (
                    <div key={idx} style={styles.assetRow}>
                      <span style={styles.assetName}>{asset.currency}</span>
                      <span style={styles.assetBalance} className="mono">
                        {formatNumber(asset.balance, 4)}
                      </span>
                      <span style={styles.assetUsd} className="mono">
                        {formatUSD(asset.usd_value)}
                      </span>
                    </div>
                  ))}
                  {!isSelected && data.assets.length > 5 && (
                    <div style={styles.moreAssets}>
                      +{data.assets.length - 5} more assets
                    </div>
                  )}
                </div>
              )}

              {/* Sub Accounts */}
              {isSelected && data.sub_accounts && data.sub_accounts.length > 0 && (
                <div style={styles.subAccounts}>
                  <div style={styles.subAccountsTitle}>Sub Accounts</div>
                  {data.sub_accounts.map((sub, idx) => (
                    <div key={idx} style={styles.subAccountRow}>
                      <span style={styles.subAccountName}>{sub.name}</span>
                      <span style={styles.subAccountValue} className="mono">
                        {formatUSD(sub.total_usd)}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {(!data.assets || data.assets.length === 0) && (
                <div style={styles.noData}>No data yet</div>
              )}
            </div>
          )
        })}
      </div>

      {/* Status */}
      {error && (
        <div style={styles.statusBar}>
          <span style={styles.statusDot} />
          {error} - Worker 실행 필요
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    padding: '24px',
    maxWidth: '1400px',
    margin: '0 auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '32px',
    paddingBottom: '24px',
    borderBottom: '1px solid var(--border-color)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-muted)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  lastUpdate: {
    fontSize: '13px',
    color: 'var(--text-muted)',
  },
  refreshBtn: {
    padding: '8px 16px',
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '8px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  totalCard: {
    background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)',
    border: '1px solid var(--border-color)',
    borderRadius: '16px',
    padding: '32px',
    marginBottom: '32px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  totalLabel: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  totalValue: {
    fontSize: '48px',
    fontWeight: '600',
    color: 'var(--accent-green)',
    letterSpacing: '-1px',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
    gap: '20px',
  },
  card: {
    background: 'var(--bg-card)',
    border: '1px solid var(--border-color)',
    borderRadius: '12px',
    padding: '20px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  cardSelected: {
    background: 'var(--bg-hover)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '16px',
  },
  exchangeName: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '16px',
    fontWeight: '500',
  },
  exchangeDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
  },
  cardValue: {
    fontSize: '22px',
    fontWeight: '600',
    color: 'var(--text-primary)',
  },
  assetList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  assetRow: {
    display: 'grid',
    gridTemplateColumns: '80px 1fr 100px',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid var(--bg-hover)',
  },
  assetName: {
    fontSize: '13px',
    fontWeight: '500',
    color: 'var(--text-secondary)',
  },
  assetBalance: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    textAlign: 'right',
    paddingRight: '16px',
  },
  assetUsd: {
    fontSize: '13px',
    color: 'var(--text-primary)',
    textAlign: 'right',
  },
  moreAssets: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    paddingTop: '8px',
  },
  subAccounts: {
    marginTop: '16px',
    paddingTop: '16px',
    borderTop: '1px solid var(--border-color)',
  },
  subAccountsTitle: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    marginBottom: '12px',
  },
  subAccountRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '6px 0',
  },
  subAccountName: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
  },
  subAccountValue: {
    fontSize: '13px',
    color: 'var(--text-primary)',
  },
  noData: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '20px',
  },
  statusBar: {
    position: 'fixed',
    bottom: '24px',
    left: '50%',
    transform: 'translateX(-50%)',
    background: 'var(--bg-card)',
    border: '1px solid var(--accent-yellow)',
    borderRadius: '8px',
    padding: '12px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '13px',
    color: 'var(--accent-yellow)',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--accent-yellow)',
    animation: 'pulse 2s infinite',
  },
}
