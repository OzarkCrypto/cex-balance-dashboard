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
  if (Math.abs(num) < 0.00001) return num.toExponential(4)
  if (Math.abs(num) < 1) return num.toFixed(8).replace(/\.?0+$/, '')
  if (Math.abs(num) < 1000) return num.toFixed(4).replace(/\.?0+$/, '')
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

const formatUSD = (num) => {
  if (num === 0 || num === undefined) return '$0'
  const prefix = num < 0 ? '-$' : '$'
  const abs = Math.abs(num)
  return prefix + abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export default function Dashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expandedExchanges, setExpandedExchanges] = useState({})

  const fetchBalances = async () => {
    setLoading(true)
    try {
      const res = await fetch(API_URL)
      if (!res.ok) throw new Error('API Error')
      const json = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchBalances()
    const interval = setInterval(fetchBalances, 60000)
    return () => clearInterval(interval)
  }, [])

  const toggleExchange = (id) => {
    setExpandedExchanges(prev => ({ ...prev, [id]: !prev[id] }))
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">CEX Balance Dashboard</h1>
            <div className="text-5xl font-bold text-green-400">
              {formatUSD(data?.grand_total_usd || 0)}
            </div>
            <p className="text-gray-400 text-sm mt-2">
              Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '-'}
            </p>
          </div>
          <button
            onClick={fetchBalances}
            disabled={loading}
            className="mt-4 md:mt-0 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 mb-6">
            Error: {error}
          </div>
        )}

        {/* Exchange Cards */}
        <div className="grid gap-4">
          {EXCHANGES.map(exchange => {
            const exData = data?.balances?.[exchange.id]
            if (!exData) return null
            
            const exchangeTotal = exData.exchange_total_usd || 0
            if (exchangeTotal === 0) return null
            
            const isExpanded = expandedExchanges[exchange.id]
            const masterUsd = exData.master_usd || 0
            const subsUsd = exData.subaccounts_total_usd || 0
            const subaccounts = exData.subaccounts_usd || {}
            
            return (
              <div key={exchange.id} className="bg-gray-800 rounded-xl overflow-hidden">
                {/* Exchange Header */}
                <div 
                  className="p-4 cursor-pointer hover:bg-gray-750"
                  onClick={() => toggleExchange(exchange.id)}
                  style={{ borderLeft: `4px solid ${exchange.color}` }}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-xl font-bold">{exchange.name}</span>
                      <span className="text-gray-400 text-sm">
                        {isExpanded ? '▼' : '▶'}
                      </span>
                    </div>
                    <span className="text-2xl font-bold text-green-400">
                      {formatUSD(exchangeTotal)}
                    </span>
                  </div>
                  <div className="flex gap-6 mt-2 text-sm text-gray-400">
                    <span>Master: {formatUSD(masterUsd)}</span>
                    {subsUsd > 0 && <span>Subaccounts: {formatUSD(subsUsd)}</span>}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="border-t border-gray-700 p-4">
                    {/* Master Account */}
                    {masterUsd !== 0 && (
                      <div className="mb-4">
                        <h3 className="text-lg font-semibold mb-2 text-blue-400">Master Account</h3>
                        <div className="bg-gray-700/50 rounded-lg p-3">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                            {Object.entries(exData.master_breakdown || {})
                              .filter(([_, info]) => Math.abs(info.usd) >= 1)
                              .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                              .map(([coin, info]) => (
                                <div key={coin} className="flex justify-between items-center py-1 px-2 bg-gray-800 rounded">
                                  <span className="font-mono text-sm">{coin}</span>
                                  <div className="text-right">
                                    <div className="text-sm">{formatNumber(info.amount)}</div>
                                    <div className="text-xs text-gray-400">{formatUSD(info.usd)}</div>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Subaccounts */}
                    {Object.keys(subaccounts).length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-2 text-purple-400">Subaccounts</h3>
                        <div className="space-y-3">
                          {Object.entries(subaccounts)
                            .filter(([_, data]) => Math.abs(data.usd) >= 1)
                            .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                            .map(([subName, subData]) => (
                              <div key={subName} className="bg-gray-700/50 rounded-lg p-3">
                                <div className="flex justify-between items-center mb-2">
                                  <span className="font-medium text-sm truncate max-w-[300px]" title={subName}>
                                    {subName}
                                  </span>
                                  <span className={`font-bold ${subData.usd >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {formatUSD(subData.usd)}
                                  </span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {Object.entries(subData.breakdown || {})
                                    .filter(([_, info]) => Math.abs(info.usd) >= 0.01)
                                    .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                                    .map(([coin, info]) => (
                                      <div key={coin} className="flex justify-between items-center py-1 px-2 bg-gray-800 rounded text-sm">
                                        <span className="font-mono">{coin}</span>
                                        <div className="text-right">
                                          <div>{formatNumber(info.amount)}</div>
                                          <div className="text-xs text-gray-400">{formatUSD(info.usd)}</div>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Summary Footer */}
        <div className="mt-8 p-4 bg-gray-800 rounded-xl">
          <h2 className="text-lg font-semibold mb-3">Summary by Exchange</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {EXCHANGES.map(exchange => {
              const total = data?.balances?.[exchange.id]?.exchange_total_usd || 0
              return (
                <div 
                  key={exchange.id}
                  className="p-3 rounded-lg"
                  style={{ backgroundColor: `${exchange.color}20` }}
                >
                  <div className="text-sm text-gray-400">{exchange.name}</div>
                  <div className="font-bold">{formatUSD(total)}</div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
