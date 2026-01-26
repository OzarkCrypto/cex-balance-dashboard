'use client'

import { useState, useEffect } from 'react'

const API_URL = 'https://hqr2yft2ej.execute-api.ap-northeast-2.amazonaws.com/prod/balances'

const formatUSD = (n) => {
  if (!n) return '$0'
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
    const i = setInterval(fetchData, 60000)
    return () => clearInterval(i)
  }, [])

  if (!data) return <div className="p-8 text-center">Loading...</div>

  const exchanges = Object.entries(data.balances || {})
    .filter(([_, d]) => d.exchange_total_usd > 0)
    .sort((a, b) => b[1].exchange_total_usd - a[1].exchange_total_usd)

  return (
    <div className="min-h-screen bg-white p-4 max-w-5xl mx-auto text-sm">
      {/* Header */}
      <div className="flex justify-between items-center border-b pb-3 mb-4">
        <div>
          <div className="text-xs text-gray-500">Total Balance</div>
          <div className="text-2xl font-bold">{formatUSD(data.grand_total_usd)}</div>
        </div>
        <div className="text-right">
          <button 
            onClick={fetchData} 
            disabled={loading}
            className="px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded text-xs"
          >
            {loading ? '...' : 'Refresh'}
          </button>
          <div className="text-xs text-gray-400 mt-1">
            {new Date(data.timestamp).toLocaleString()}
          </div>
        </div>
      </div>

      {/* Exchange Summary */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2 mb-6">
        {['binance', 'bybit', 'okx', 'kucoin', 'kraken', 'zoomex'].map(ex => {
          const d = data.balances?.[ex]
          return (
            <div key={ex} className="p-2 bg-gray-50 rounded">
              <div className="text-xs text-gray-500 capitalize">{ex}</div>
              <div className="font-medium">{formatUSD(d?.exchange_total_usd || 0)}</div>
            </div>
          )
        })}
      </div>

      {/* Exchange Details */}
      {exchanges.map(([exName, exData]) => (
        <div key={exName} className="mb-6 border rounded">
          {/* Exchange Header */}
          <div className="flex justify-between items-center p-3 bg-gray-50 border-b">
            <span className="font-semibold capitalize">{exName}</span>
            <span className="font-bold">{formatUSD(exData.exchange_total_usd)}</span>
          </div>

          {/* Master Account */}
          {exData.master_usd > 0 && (
            <div className="p-3 border-b">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Master Account</span>
                <span>{formatUSD(exData.master_usd)}</span>
              </div>
              <table className="w-full text-xs">
                <tbody>
                  {Object.entries(exData.master_breakdown || {})
                    .filter(([_, v]) => Math.abs(v.usd) >= 1)
                    .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                    .map(([coin, info]) => (
                      <tr key={coin} className="border-b border-gray-100">
                        <td className="py-1 font-mono">{coin}</td>
                        <td className="py-1 text-right">{formatNum(info.amount)}</td>
                        <td className="py-1 text-right text-gray-500 w-24">{formatUSD(info.usd)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Subaccounts */}
          {exData.subaccounts_total_usd > 0 && (
            <div className="p-3">
              <div className="flex justify-between text-xs text-gray-500 mb-2">
                <span>Subaccounts</span>
                <span>{formatUSD(exData.subaccounts_total_usd)}</span>
              </div>
              {Object.entries(exData.subaccounts_usd || {})
                .filter(([_, v]) => Math.abs(v.usd) >= 1)
                .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                .map(([subName, subData]) => (
                  <div key={subName} className="mb-3 last:mb-0">
                    <div className="flex justify-between text-xs font-medium bg-gray-50 p-2 rounded-t">
                      <span className="truncate max-w-[200px]" title={subName}>{subName}</span>
                      <span className={subData.usd >= 0 ? '' : 'text-red-600'}>{formatUSD(subData.usd)}</span>
                    </div>
                    <table className="w-full text-xs border-l border-r border-b rounded-b">
                      <tbody>
                        {Object.entries(subData.breakdown || {})
                          .filter(([_, v]) => Math.abs(v.usd) >= 0.01)
                          .sort((a, b) => Math.abs(b[1].usd) - Math.abs(a[1].usd))
                          .map(([coin, info]) => (
                            <tr key={coin} className="border-b border-gray-100 last:border-0">
                              <td className="py-1 px-2 font-mono">{coin}</td>
                              <td className="py-1 px-2 text-right">{formatNum(info.amount)}</td>
                              <td className="py-1 px-2 text-right text-gray-500 w-24">{formatUSD(info.usd)}</td>
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
