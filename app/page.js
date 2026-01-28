// Build: 1769535000
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

const formatNum = (n, decimals = 2) => {
  if (n === undefined || n === null || isNaN(n)) return '-'
  if (Math.abs(n) < 0.0001) return '0'
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

const formatAmount = (n) => {
  if (!n || Math.abs(n) < 0.0001) return null
  if (Math.abs(n) >= 1000000) return (n / 1000000).toFixed(2) + 'M'
  if (Math.abs(n) >= 1000) return (n / 1000).toFixed(2) + 'K'
  if (Math.abs(n) >= 1) return n.toFixed(2)
  return n.toFixed(4)
}

// ============ STYLES ============
const styles = {
  container: {
    maxWidth: '1400px',
    margin: '0 auto',
    padding: '20px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontSize: '13px',
    background: '#fff',
    minHeight: '100vh'
  },
  tabs: {
    display: 'flex',
    gap: '0',
    marginBottom: '20px',
    borderBottom: '2px solid #e0e0e0'
  },
  tab: (active) => ({
    padding: '12px 24px',
    background: active ? '#fff' : '#f5f5f5',
    border: 'none',
    borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
    marginBottom: '-2px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: active ? '600' : '400',
    color: active ? '#2563eb' : '#666'
  }),
  card: {
    background: '#f8f9fa',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    border: '1px solid #e0e0e0'
  },
  input: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box'
  },
  select: {
    padding: '8px 12px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '13px',
    width: '100%',
    boxSizing: 'border-box',
    background: '#fff'
  },
  button: (color = 'blue') => ({
    padding: '8px 16px',
    background: color === 'blue' ? '#2563eb' : color === 'green' ? '#10b981' : color === 'red' ? '#ef4444' : color === 'orange' ? '#f59e0b' : '#6b7280',
    color: '#fff',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: '500'
  }),
  label: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#374151',
    marginBottom: '4px',
    display: 'block'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px'
  },
  th: {
    padding: '10px 12px',
    textAlign: 'left',
    fontWeight: '600',
    borderBottom: '2px solid #e0e0e0',
    background: '#f8f9fa',
    color: '#374151'
  },
  td: {
    padding: '10px 12px',
    borderBottom: '1px solid #f0f0f0'
  }
}

// ============ LOANS TAB ============
function LoansTab() {
  const [receivables, setReceivables] = useState([])
  const [payables, setPayables] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeSubTab, setActiveSubTab] = useState('summary')
  const [showForm, setShowForm] = useState(false)
  const [formType, setFormType] = useState('receivable')
  const [editingId, setEditingId] = useState(null)
  
  const [recForm, setRecForm] = useState({
    bookName: '', valuationDate: '', currency: 'BTC', amount: '', comment: ''
  })
  
  const [payForm, setPayForm] = useState({
    clientName: '', lastSettlementDate: '', nextSettlementDate: '', method: 'MONTHLY_COMP',
    monthlyRate: '', currency: 'BTC', principal: '', accruedInterestPaid: '0', comment: ''
  })

  const fetchLoans = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/loans')
      const data = await res.json()
      setReceivables(data.receivables || [])
      setPayables(data.payables || [])
    } catch (e) {
      console.error(e)
    }
    setLoading(false)
  }

  useEffect(() => { fetchLoans() }, [])

  // 이자 계산 함수
  const calcInterest = (p) => {
    const principal = parseFloat(p.principal) || 0
    const monthlyRate = parseFloat(p.monthlyRate) || 0
    const lastDate = new Date(p.lastSettlementDate)
    const now = new Date()
    const days = Math.floor((now - lastDate) / (1000 * 60 * 60 * 24))
    if (days <= 0 || monthlyRate === 0) return 0
    
    // 일할 이자 계산: monthlyRate * (days / 30)
    return principal * monthlyRate * (days / 30)
  }

  // 정산 처리 (매달 1일)
  const handleSettlement = async (p) => {
    const interest = calcInterest(p)
    const principal = parseFloat(p.principal) || 0
    const accruedPaid = parseFloat(p.accruedInterestPaid) || 0
    
    let newPrincipal = principal
    let newAccruedPaid = accruedPaid
    
    if (p.method === 'MONTHLY_COMP') {
      // 복리: 이자를 원금에 합산
      newPrincipal = principal + interest
    } else {
      // 단리: 이자를 별도 누적 (지급해야 할 금액)
      newAccruedPaid = accruedPaid + interest
    }
    
    // 날짜 업데이트
    const lastDate = new Date(p.nextSettlementDate)
    const nextDate = new Date(lastDate)
    nextDate.setMonth(nextDate.getMonth() + 1)
    
    const updatedPayable = {
      ...p,
      principal: newPrincipal.toString(),
      accruedInterestPaid: newAccruedPaid.toString(),
      lastSettlementDate: lastDate.toISOString().slice(0, 10),
      nextSettlementDate: nextDate.toISOString().slice(0, 10)
    }
    
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', type: 'payable', item: updatedPayable, id: p.id })
      })
      const data = await res.json()
      if (data.payables) {
        setReceivables(data.receivables || [])
        setPayables(data.payables)
        alert(`정산 완료: ${p.clientName}\n이자: ${formatNum(interest, p.currency === 'BTC' ? 8 : 2)} ${p.currency}`)
      }
    } catch (e) {
      alert('정산 실패: ' + e.message)
    }
  }

  // 단리 이자 지급 처리
  const handlePayInterest = async (p) => {
    const accruedPaid = parseFloat(p.accruedInterestPaid) || 0
    if (accruedPaid <= 0) {
      alert('지급할 이자가 없습니다')
      return
    }
    
    if (!confirm(`${p.clientName}에게 ${formatNum(accruedPaid, p.currency === 'BTC' ? 8 : 2)} ${p.currency} 이자를 지급 처리하시겠습니까?`)) return
    
    const updatedPayable = {
      ...p,
      accruedInterestPaid: '0'
    }
    
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update', type: 'payable', item: updatedPayable, id: p.id })
      })
      const data = await res.json()
      if (data.payables) {
        setReceivables(data.receivables || [])
        setPayables(data.payables)
        alert('이자 지급 완료')
      }
    } catch (e) {
      alert('처리 실패: ' + e.message)
    }
  }

  const handleSubmitReceivable = async () => {
    const action = editingId ? 'update' : 'add'
    const body = { action, type: 'receivable', item: recForm, ...(editingId && { id: editingId }) }
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.receivables) {
        setReceivables(data.receivables)
        setPayables(data.payables || [])
        setShowForm(false)
        setEditingId(null)
        setRecForm({ bookName: '', valuationDate: '', currency: 'BTC', amount: '', comment: '' })
      }
    } catch (e) {
      alert('저장 실패: ' + e.message)
    }
  }

  const handleSubmitPayable = async () => {
    const action = editingId ? 'update' : 'add'
    const body = { action, type: 'payable', item: payForm, ...(editingId && { id: editingId }) }
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      const data = await res.json()
      if (data.payables) {
        setReceivables(data.receivables || [])
        setPayables(data.payables)
        setShowForm(false)
        setEditingId(null)
        setPayForm({ clientName: '', lastSettlementDate: '', nextSettlementDate: '', method: 'MONTHLY_COMP', monthlyRate: '', currency: 'BTC', principal: '', accruedInterestPaid: '0', comment: '' })
      }
    } catch (e) {
      alert('저장 실패: ' + e.message)
    }
  }

  const handleEdit = (item, type) => {
    if (type === 'receivable') {
      setRecForm(item)
      setFormType('receivable')
    } else {
      setPayForm({ ...item, accruedInterestPaid: item.accruedInterestPaid || '0' })
      setFormType('payable')
    }
    setEditingId(item.id)
    setShowForm(true)
  }

  const handleDelete = async (id, type) => {
    if (!confirm('정말 삭제?')) return
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', type, id })
      })
      const data = await res.json()
      if (data.receivables !== undefined) {
        setReceivables(data.receivables)
        setPayables(data.payables)
      }
    } catch (e) {
      alert('삭제 실패')
    }
  }

  // Summary 계산
  const summaryByAsset = {}
  receivables.forEach(r => {
    const currency = r.currency
    if (!summaryByAsset[currency]) summaryByAsset[currency] = { receivable: 0, payable: 0, payableInterest: 0, unpaidInterest: 0 }
    summaryByAsset[currency].receivable += parseFloat(r.amount) || 0
  })
  
  payables.forEach(p => {
    const currency = p.currency
    if (!summaryByAsset[currency]) summaryByAsset[currency] = { receivable: 0, payable: 0, payableInterest: 0, unpaidInterest: 0 }
    const principal = parseFloat(p.principal) || 0
    const interest = calcInterest(p)
    const unpaid = parseFloat(p.accruedInterestPaid) || 0
    summaryByAsset[currency].payable += principal
    summaryByAsset[currency].payableInterest += interest
    summaryByAsset[currency].unpaidInterest += unpaid
  })

  // 정산 필요 여부 체크
  const needsSettlement = (p) => {
    const nextDate = new Date(p.nextSettlementDate)
    const now = new Date()
    return now >= nextDate
  }

  return (
    <div>
      {/* Sub Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button onClick={() => setActiveSubTab('summary')} style={{ ...styles.button(activeSubTab === 'summary' ? 'blue' : 'gray'), padding: '6px 14px' }}>Summary</button>
        <button onClick={() => setActiveSubTab('receivable')} style={{ ...styles.button(activeSubTab === 'receivable' ? 'green' : 'gray'), padding: '6px 14px' }}>Receivable</button>
        <button onClick={() => setActiveSubTab('payable')} style={{ ...styles.button(activeSubTab === 'payable' ? 'red' : 'gray'), padding: '6px 14px' }}>Payable</button>
      </div>

      {/* ===== SUMMARY VIEW ===== */}
      {activeSubTab === 'summary' && (
        <div>
          <div style={{ ...styles.card, background: '#fff' }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Asset</th>
                  <th style={{ ...styles.th, textAlign: 'right', color: '#166534' }}>Receivable</th>
                  <th style={{ ...styles.th, textAlign: 'right', color: '#991b1b' }}>Payable (Principal)</th>
                  <th style={{ ...styles.th, textAlign: 'right', color: '#dc2626' }}>Accrued Interest</th>
                  <th style={{ ...styles.th, textAlign: 'right', color: '#9333ea' }}>Unpaid Interest (SIMP)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Net Position</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summaryByAsset).map(([asset, data]) => {
                  const totalPayable = data.payable + data.payableInterest + data.unpaidInterest
                  const net = data.receivable - totalPayable
                  const decimals = asset === 'BTC' ? 6 : 2
                  return (
                    <tr key={asset}>
                      <td style={{ ...styles.td, fontWeight: '600' }}>{asset}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: '#166534' }}>{formatNum(data.receivable, decimals)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: '#991b1b' }}>{formatNum(data.payable, decimals)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>{formatNum(data.payableInterest, decimals)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: '#9333ea' }}>{formatNum(data.unpaidInterest, decimals)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: net >= 0 ? '#166534' : '#991b1b' }}>
                        {net >= 0 ? '+' : ''}{formatNum(net, decimals)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          
          {/* 정산 필요 알림 */}
          {payables.some(needsSettlement) && (
            <div style={{ ...styles.card, background: '#fef3c7', border: '2px solid #f59e0b' }}>
              <div style={{ fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>⚠️ 정산 필요</div>
              {payables.filter(needsSettlement).map(p => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #fcd34d' }}>
                  <span>{p.clientName} - {p.currency} {formatNum(parseFloat(p.principal), p.currency === 'BTC' ? 6 : 2)}</span>
                  <button onClick={() => handleSettlement(p)} style={styles.button('orange')}>정산 처리</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== RECEIVABLE VIEW ===== */}
      {activeSubTab === 'receivable' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <button style={styles.button('green')} onClick={() => { setShowForm(!showForm); setFormType('receivable'); setEditingId(null); setRecForm({ bookName: '', valuationDate: '', currency: 'BTC', amount: '', comment: '' }) }}>
              {showForm && formType === 'receivable' ? '취소' : '+ Receivable 추가'}
            </button>
          </div>

          {showForm && formType === 'receivable' && (
            <div style={{ ...styles.card, background: '#f0fdf4', border: '2px solid #22c55e' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px' }}>
                <div><label style={styles.label}>Book Name</label><input style={styles.input} value={recForm.bookName} onChange={e => setRecForm({ ...recForm, bookName: e.target.value })} /></div>
                <div><label style={styles.label}>Valuation Date</label><input style={styles.input} type="date" value={recForm.valuationDate} onChange={e => setRecForm({ ...recForm, valuationDate: e.target.value })} /></div>
                <div><label style={styles.label}>Currency</label><select style={styles.select} value={recForm.currency} onChange={e => setRecForm({ ...recForm, currency: e.target.value })}><option value="BTC">BTC</option><option value="USDT">USDT</option><option value="USDC">USDC</option><option value="ETH">ETH</option></select></div>
                <div><label style={styles.label}>Amount</label><input style={styles.input} type="number" step="any" value={recForm.amount} onChange={e => setRecForm({ ...recForm, amount: e.target.value })} /></div>
                <div><label style={styles.label}>Comment</label><input style={styles.input} value={recForm.comment} onChange={e => setRecForm({ ...recForm, comment: e.target.value })} /></div>
              </div>
              <div style={{ marginTop: '12px' }}><button style={styles.button('green')} onClick={handleSubmitReceivable}>{editingId ? '수정' : '저장'}</button></div>
            </div>
          )}

          <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={styles.table}>
              <thead>
                <tr style={{ background: '#f0fdf4' }}>
                  <th style={styles.th}>Book Name</th>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Currency</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Amount</th>
                  <th style={styles.th}>Comment</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {receivables.map(r => (
                  <tr key={r.id}>
                    <td style={{ ...styles.td, fontWeight: '500' }}>{r.bookName}</td>
                    <td style={styles.td}>{r.valuationDate}</td>
                    <td style={styles.td}>{r.currency}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: '#166534' }}>{formatNum(parseFloat(r.amount), r.currency === 'BTC' ? 6 : 2)}</td>
                    <td style={{ ...styles.td, fontSize: '11px', color: '#666' }}>{r.comment}</td>
                    <td style={styles.td}>
                      <button onClick={() => handleEdit(r, 'receivable')} style={{ ...styles.button('gray'), padding: '4px 8px', fontSize: '11px', marginRight: '4px' }}>Edit</button>
                      <button onClick={() => handleDelete(r.id, 'receivable')} style={{ ...styles.button('red'), padding: '4px 8px', fontSize: '11px' }}>Del</button>
                    </td>
                  </tr>
                ))}
                {receivables.length === 0 && <tr><td colSpan={6} style={{ ...styles.td, textAlign: 'center', color: '#999' }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===== PAYABLE VIEW ===== */}
      {activeSubTab === 'payable' && (
        <div>
          <div style={{ marginBottom: '16px' }}>
            <button style={styles.button('red')} onClick={() => { setShowForm(!showForm); setFormType('payable'); setEditingId(null); setPayForm({ clientName: '', lastSettlementDate: '', nextSettlementDate: '', method: 'MONTHLY_COMP', monthlyRate: '', currency: 'BTC', principal: '', accruedInterestPaid: '0', comment: '' }) }}>
              {showForm && formType === 'payable' ? '취소' : '+ Payable 추가'}
            </button>
          </div>

          {showForm && formType === 'payable' && (
            <div style={{ ...styles.card, background: '#fef2f2', border: '2px solid #ef4444' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                <div><label style={styles.label}>Client Name</label><input style={styles.input} value={payForm.clientName} onChange={e => setPayForm({ ...payForm, clientName: e.target.value })} /></div>
                <div><label style={styles.label}>Last Settlement Date</label><input style={styles.input} type="date" value={payForm.lastSettlementDate} onChange={e => setPayForm({ ...payForm, lastSettlementDate: e.target.value })} /></div>
                <div><label style={styles.label}>Next Settlement Date</label><input style={styles.input} type="date" value={payForm.nextSettlementDate} onChange={e => setPayForm({ ...payForm, nextSettlementDate: e.target.value })} /></div>
                <div><label style={styles.label}>Method</label><select style={styles.select} value={payForm.method} onChange={e => setPayForm({ ...payForm, method: e.target.value })}><option value="MONTHLY_COMP">Monthly Compound (복리)</option><option value="MONTHLY_SIMP">Monthly Simple (단리)</option></select></div>
                <div><label style={styles.label}>Monthly Rate (ex: 0.00375)</label><input style={styles.input} type="number" step="any" value={payForm.monthlyRate} onChange={e => setPayForm({ ...payForm, monthlyRate: e.target.value })} /></div>
                <div><label style={styles.label}>Currency</label><select style={styles.select} value={payForm.currency} onChange={e => setPayForm({ ...payForm, currency: e.target.value })}><option value="BTC">BTC</option><option value="USDT">USDT</option><option value="USDC">USDC</option><option value="ETH">ETH</option></select></div>
                <div><label style={styles.label}>Principal</label><input style={styles.input} type="number" step="any" value={payForm.principal} onChange={e => setPayForm({ ...payForm, principal: e.target.value })} /></div>
                <div><label style={styles.label}>Comment</label><input style={styles.input} value={payForm.comment} onChange={e => setPayForm({ ...payForm, comment: e.target.value })} /></div>
              </div>
              <div style={{ marginTop: '12px' }}><button style={styles.button('red')} onClick={handleSubmitPayable}>{editingId ? '수정' : '저장'}</button></div>
            </div>
          )}

          <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
            <table style={styles.table}>
              <thead>
                <tr style={{ background: '#fef2f2' }}>
                  <th style={styles.th}>Client</th>
                  <th style={styles.th}>Last Settle</th>
                  <th style={styles.th}>Next Settle</th>
                  <th style={styles.th}>Method</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Rate/Mo</th>
                  <th style={styles.th}>Curr</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Principal</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Accrued</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Unpaid (SIMP)</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Total Owed</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payables.map(p => {
                  const principal = parseFloat(p.principal) || 0
                  const interest = calcInterest(p)
                  const unpaid = parseFloat(p.accruedInterestPaid) || 0
                  const totalOwed = principal + interest + unpaid
                  const decimals = p.currency === 'BTC' ? 6 : 2
                  const isOverdue = needsSettlement(p)
                  return (
                    <tr key={p.id} style={{ background: isOverdue ? '#fef3c7' : 'transparent' }}>
                      <td style={{ ...styles.td, fontWeight: '500' }}>{p.clientName}</td>
                      <td style={{ ...styles.td, fontSize: '11px' }}>{p.lastSettlementDate}</td>
                      <td style={{ ...styles.td, fontSize: '11px', color: isOverdue ? '#dc2626' : 'inherit', fontWeight: isOverdue ? '600' : '400' }}>{p.nextSettlementDate} {isOverdue && '⚠️'}</td>
                      <td style={{ ...styles.td, fontSize: '10px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '4px', background: p.method === 'MONTHLY_COMP' ? '#dbeafe' : '#fef3c7', color: p.method === 'MONTHLY_COMP' ? '#1e40af' : '#92400e' }}>
                          {p.method === 'MONTHLY_COMP' ? 'COMP' : 'SIMP'}
                        </span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', fontSize: '11px' }}>{(parseFloat(p.monthlyRate) * 100).toFixed(4)}%</td>
                      <td style={styles.td}>{p.currency}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>{formatNum(principal, decimals)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>{formatNum(interest, decimals)}</td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: '#9333ea' }}>
                        {unpaid > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                            <span>{formatNum(unpaid, decimals)}</span>
                            <button onClick={() => handlePayInterest(p)} style={{ padding: '2px 6px', fontSize: '9px', background: '#9333ea', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }}>Pay</button>
                          </div>
                        )}
                        {unpaid <= 0 && '-'}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', fontWeight: '600', color: '#991b1b' }}>{formatNum(totalOwed, decimals)}</td>
                      <td style={styles.td}>
                        {isOverdue && <button onClick={() => handleSettlement(p)} style={{ ...styles.button('orange'), padding: '4px 8px', fontSize: '11px', marginRight: '4px' }}>정산</button>}
                        <button onClick={() => handleEdit(p, 'payable')} style={{ ...styles.button('gray'), padding: '4px 8px', fontSize: '11px', marginRight: '4px' }}>Edit</button>
                        <button onClick={() => handleDelete(p.id, 'payable')} style={{ ...styles.button('red'), padding: '4px 8px', fontSize: '11px' }}>Del</button>
                      </td>
                    </tr>
                  )
                })}
                {payables.length === 0 && <tr><td colSpan={11} style={{ ...styles.td, textAlign: 'center', color: '#999' }}>No data</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ============ LOCKED TOKENS TAB ============
function LockedTokensTab() {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState({ token: '', totalAmount: '', costBasis: '', vestingType: 'cliff-linear', cliffDate: '', vestingEndDate: '', vestingStartDate: '', unlockedPercent: '', currentPrice: '', notes: '' })

  const fetchTokens = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/locked-tokens')
      const data = await res.json()
      setTokens(data.tokens || [])
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  useEffect(() => { fetchTokens() }, [])

  const calcUnlocked = (t) => {
    const total = parseFloat(t.totalAmount) || 0
    if (t.vestingType === 'manual') return total * ((parseFloat(t.unlockedPercent) || 0) / 100)
    const now = new Date()
    const cliff = new Date(t.cliffDate)
    const end = new Date(t.vestingEndDate)
    const start = t.vestingStartDate ? new Date(t.vestingStartDate) : cliff
    if (now < cliff) return 0
    if (now >= end) return total
    const totalVestingDays = (end - start) / (1000 * 60 * 60 * 24)
    const elapsedDays = (now - start) / (1000 * 60 * 60 * 24)
    return total * (elapsedDays / totalVestingDays)
  }

  const handleSubmit = async () => {
    const action = editingId ? 'update' : 'add'
    const body = { action, token: form, ...(editingId && { id: editingId }) }
    try {
      const res = await fetch('/api/locked-tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (data.success) { setTokens(data.tokens); setShowForm(false); setEditingId(null); setForm({ token: '', totalAmount: '', costBasis: '', vestingType: 'cliff-linear', cliffDate: '', vestingEndDate: '', vestingStartDate: '', unlockedPercent: '', currentPrice: '', notes: '' }) }
    } catch (e) { alert('저장 실패: ' + e.message) }
  }

  const handleEdit = (token) => { setForm(token); setEditingId(token.id); setShowForm(true) }
  const handleDelete = async (id) => {
    if (!confirm('정말 삭제?')) return
    try {
      const res = await fetch('/api/locked-tokens', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id }) })
      const data = await res.json()
      if (data.success) setTokens(data.tokens)
    } catch (e) { alert('삭제 실패') }
  }

  const totalCost = tokens.reduce((sum, t) => sum + (parseFloat(t.costBasis) || 0), 0)
  const totalCurrentValue = tokens.reduce((sum, t) => sum + ((parseFloat(t.currentPrice) || 0) * (parseFloat(t.totalAmount) || 0)), 0)
  const totalUnlockedValue = tokens.reduce((sum, t) => sum + ((parseFloat(t.currentPrice) || 0) * calcUnlocked(t)), 0)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div style={styles.card}><div style={{ fontSize: '11px', color: '#666' }}>Total Cost Basis</div><div style={{ fontSize: '20px', fontWeight: '700', color: '#374151' }}>{formatUSD(totalCost)}</div></div>
        <div style={styles.card}><div style={{ fontSize: '11px', color: '#666' }}>Total Current Value</div><div style={{ fontSize: '20px', fontWeight: '700', color: '#2563eb' }}>{formatUSD(totalCurrentValue)}</div></div>
        <div style={styles.card}><div style={{ fontSize: '11px', color: '#666' }}>Unlocked Value</div><div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>{formatUSD(totalUnlockedValue)}</div></div>
        <div style={styles.card}><div style={{ fontSize: '11px', color: '#666' }}>Locked Value</div><div style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>{formatUSD(totalCurrentValue - totalUnlockedValue)}</div></div>
      </div>
      <div style={{ marginBottom: '16px' }}><button style={styles.button('blue')} onClick={() => { setShowForm(!showForm); setEditingId(null); setForm({ token: '', totalAmount: '', costBasis: '', vestingType: 'cliff-linear', cliffDate: '', vestingEndDate: '', vestingStartDate: '', unlockedPercent: '', currentPrice: '', notes: '' }) }}>{showForm ? '취소' : '+ 토큰 추가'}</button></div>
      {showForm && (
        <div style={{ ...styles.card, background: '#fff', border: '2px solid #2563eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
            <div><label style={styles.label}>Token Symbol</label><input style={styles.input} value={form.token} onChange={e => setForm({ ...form, token: e.target.value })} /></div>
            <div><label style={styles.label}>Total Amount</label><input style={styles.input} type="number" value={form.totalAmount} onChange={e => setForm({ ...form, totalAmount: e.target.value })} /></div>
            <div><label style={styles.label}>Cost Basis (USD)</label><input style={styles.input} type="number" value={form.costBasis} onChange={e => setForm({ ...form, costBasis: e.target.value })} /></div>
            <div><label style={styles.label}>Current Price (USD)</label><input style={styles.input} type="number" step="0.0001" value={form.currentPrice} onChange={e => setForm({ ...form, currentPrice: e.target.value })} /></div>
            <div><label style={styles.label}>Vesting Type</label><select style={styles.select} value={form.vestingType} onChange={e => setForm({ ...form, vestingType: e.target.value })}><option value="cliff-linear">Cliff + Linear</option><option value="manual">Manual</option></select></div>
            {form.vestingType === 'cliff-linear' ? (<><div><label style={styles.label}>Cliff Date</label><input style={styles.input} type="date" value={form.cliffDate} onChange={e => setForm({ ...form, cliffDate: e.target.value })} /></div><div><label style={styles.label}>Vesting Start</label><input style={styles.input} type="date" value={form.vestingStartDate} onChange={e => setForm({ ...form, vestingStartDate: e.target.value })} /></div><div><label style={styles.label}>Vesting End</label><input style={styles.input} type="date" value={form.vestingEndDate} onChange={e => setForm({ ...form, vestingEndDate: e.target.value })} /></div></>) : (<div><label style={styles.label}>Unlocked %</label><input style={styles.input} type="number" value={form.unlockedPercent} onChange={e => setForm({ ...form, unlockedPercent: e.target.value })} /></div>)}
            <div style={{ gridColumn: form.vestingType === 'manual' ? 'span 2' : 'span 3' }}><label style={styles.label}>Notes</label><input style={styles.input} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
            <div style={{ display: 'flex', alignItems: 'end' }}><button style={styles.button('green')} onClick={handleSubmit}>{editingId ? '수정' : '저장'}</button></div>
          </div>
        </div>
      )}
      {loading ? <div>Loading...</div> : (
        <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>Token</th><th style={{ ...styles.th, textAlign: 'right' }}>Total Qty</th><th style={{ ...styles.th, textAlign: 'right' }}>Cost Basis</th><th style={{ ...styles.th, textAlign: 'right' }}>Price</th><th style={{ ...styles.th, textAlign: 'right' }}>Current Value</th><th style={{ ...styles.th, textAlign: 'right' }}>Unlocked</th><th style={{ ...styles.th, textAlign: 'right' }}>Unlocked Value</th><th style={styles.th}>Vesting</th><th style={styles.th}>Notes</th><th style={styles.th}>Actions</th></tr></thead>
            <tbody>
              {tokens.map(t => {
                const unlocked = calcUnlocked(t); const total = parseFloat(t.totalAmount) || 0; const price = parseFloat(t.currentPrice) || 0; const unlockedPct = total > 0 ? (unlocked / total * 100).toFixed(1) : 0
                return (<tr key={t.id}><td style={{ ...styles.td, fontWeight: '600' }}>{t.token}</td><td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>{formatAmount(total)}</td><td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>{formatUSD(parseFloat(t.costBasis))}</td><td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace' }}>${price.toFixed(4)}</td><td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: '#2563eb' }}>{formatUSD(price * total)}</td><td style={{ ...styles.td, textAlign: 'right' }}><div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}><div style={{ width: '60px', height: '6px', background: '#e5e7eb', borderRadius: '3px', overflow: 'hidden' }}><div style={{ width: `${unlockedPct}%`, height: '100%', background: '#10b981' }} /></div><span style={{ fontSize: '11px', color: '#666' }}>{unlockedPct}%</span></div></td><td style={{ ...styles.td, textAlign: 'right', fontFamily: 'monospace', color: '#10b981' }}>{formatUSD(price * unlocked)}</td><td style={{ ...styles.td, fontSize: '11px', color: '#666' }}>{t.vestingType === 'manual' ? 'Manual' : `${t.cliffDate || '-'} ~ ${t.vestingEndDate || '-'}`}</td><td style={{ ...styles.td, fontSize: '11px', color: '#666' }}>{t.notes}</td><td style={styles.td}><button onClick={() => handleEdit(t)} style={{ ...styles.button('gray'), padding: '4px 8px', fontSize: '11px', marginRight: '4px' }}>Edit</button><button onClick={() => handleDelete(t.id)} style={{ ...styles.button('red'), padding: '4px 8px', fontSize: '11px' }}>Del</button></td></tr>)
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ============ CEX BALANCE TAB ============
function CEXBalanceTab() {
  const [data, setData] = useState(null)
  const [snapshots, setSnapshots] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('current')
  const [selectedDate, setSelectedDate] = useState(null)

  const fetchData = async () => { setLoading(true); try { const res = await fetch(API_URL); const json = await res.json(); setData(json) } catch (e) { console.error(e) } setLoading(false) }
  const fetchSnapshots = async () => { try { const res = await fetch(SNAPSHOTS_URL); const json = await res.json(); setSnapshots(json.snapshots || []) } catch (e) { console.error(e) } }
  useEffect(() => { fetchData(); fetchSnapshots() }, [])

  const displayData = view === 'history' ? (selectedDate ? snapshots.find(s => s.date === selectedDate) : snapshots[0]) : data
  if (!data && loading) return <div style={{ textAlign: 'center', padding: '40px' }}>Loading...</div>

  const coinTotals = {}; const rows = []; const exchangeOrder = ['binance', 'bybit', 'okx', 'htx', 'zoomex', 'kucoin', 'kraken']; const balances = displayData?.balances || data?.balances || {}

  for (const ex of exchangeOrder) {
    const exData = balances[ex]; const masterBal = exData?.master_breakdown || {}; const masterUsd = exData?.master_usd || 0; const exchangeTotalUsd = exData?.exchange_total_usd || 0
    const totalRow = { exchange: ex.toUpperCase(), account: 'Total', balances: {}, totalUsd: exchangeTotalUsd, isExchangeTotal: true }
    const masterRow = { exchange: '', account: 'Master', balances: {}, totalUsd: masterUsd, isMaster: true }
    for (const [coin, info] of Object.entries(masterBal)) {
      const cleanCoin = coin.replace('_FUTURES', '').replace('_COIN_FUTURES', '').replace('_DEPOSIT_EARNING', '').replace('_EARN_LOCKED', '').replace('_EARN', '').replace('_MARGIN', '').replace('_FUND', '')
      const existing = masterRow.balances[cleanCoin] || { amount: 0, usd: 0 }; masterRow.balances[cleanCoin] = { amount: existing.amount + info.amount, usd: existing.usd + (info.usd || 0) }
      const existingTotal = totalRow.balances[cleanCoin] || { amount: 0, usd: 0 }; totalRow.balances[cleanCoin] = { amount: existingTotal.amount + info.amount, usd: existingTotal.usd + (info.usd || 0) }
      coinTotals[cleanCoin] = (coinTotals[cleanCoin] || 0) + Math.abs(info.usd || 0)
    }
    const subs = exData?.subaccounts_usd || {}; const subRows = []
    for (const [subName, subData] of Object.entries(subs)) {
      if (Math.abs(subData.usd) < 1) continue
      const row = { exchange: '', account: subName.length > 25 ? subName.slice(0, 22) + '...' : subName, balances: {}, totalUsd: subData.usd, isSub: true }
      for (const [coin, info] of Object.entries(subData.breakdown || {})) {
        const cleanCoin = coin.replace('_FUTURES', '').replace('_COIN_FUTURES', '').replace('_DEPOSIT_EARNING', '').replace('_EARN_LOCKED', '').replace('_EARN', '').replace('_MARGIN', '').replace('_FUND', '')
        const existing = row.balances[cleanCoin] || { amount: 0, usd: 0 }; row.balances[cleanCoin] = { amount: existing.amount + info.amount, usd: existing.usd + (info.usd || 0) }
        const existingTotal = totalRow.balances[cleanCoin] || { amount: 0, usd: 0 }; totalRow.balances[cleanCoin] = { amount: existingTotal.amount + info.amount, usd: existingTotal.usd + (info.usd || 0) }
        coinTotals[cleanCoin] = (coinTotals[cleanCoin] || 0) + Math.abs(info.usd || 0)
      }
      subRows.push(row)
    }
    rows.push(totalRow); rows.push(masterRow); subRows.forEach(r => rows.push(r))
  }

  const topCoins = Object.entries(coinTotals).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([coin]) => coin)
  const exchangeTotals = {}; for (const ex of exchangeOrder) { exchangeTotals[ex] = balances[ex]?.exchange_total_usd || 0 }
  const chartData = [...snapshots].reverse()
  const maxTotal = Math.max(...chartData.map(s => s.grand_total_usd), displayData?.grand_total_usd || 0)
  const minTotal = Math.min(...chartData.map(s => s.grand_total_usd), displayData?.grand_total_usd || 0) * 0.95

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #e0e0e0' }}>
        <div><div style={{ fontSize: '11px', color: '#888', marginBottom: '4px' }}>{selectedDate ? `Snapshot: ${selectedDate}` : 'Total Balance'}</div><div style={{ fontSize: '32px', fontWeight: '700', color: '#1a1a1a' }}>{formatUSD(displayData?.grand_total_usd)}</div></div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => { setView('current'); setSelectedDate(null); }} style={{ padding: '8px 16px', background: view === 'current' ? '#2563eb' : '#f3f4f6', color: view === 'current' ? '#fff' : '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Current</button>
          <button onClick={() => setView('history')} style={{ padding: '8px 16px', background: view === 'history' ? '#2563eb' : '#f3f4f6', color: view === 'history' ? '#fff' : '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>History</button>
          <button onClick={fetchData} disabled={loading} style={{ padding: '8px 20px', background: loading ? '#ccc' : '#10b981', color: '#fff', border: 'none', borderRadius: '6px', cursor: loading ? 'default' : 'pointer', fontSize: '13px', fontWeight: '500' }}>{loading ? '...' : 'Refresh'}</button>
        </div>
      </div>
      {view === 'history' && snapshots.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '20px', background: '#f8f9fa', borderRadius: '12px', border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', marginBottom: '15px', color: '#374151' }}>Balance History</div>
          <div style={{ display: 'flex', alignItems: 'end', height: '150px', gap: '2px', paddingBottom: '25px', position: 'relative' }}>
            {chartData.map((snap) => { const height = ((snap.grand_total_usd - minTotal) / (maxTotal - minTotal)) * 100; const isSelected = selectedDate === snap.date; return (<div key={snap.date} onClick={() => setSelectedDate(snap.date)} style={{ flex: 1, height: `${Math.max(height, 5)}%`, background: isSelected ? '#2563eb' : '#94a3b8', borderRadius: '3px 3px 0 0', cursor: 'pointer', transition: 'all 0.2s', minWidth: '8px', position: 'relative' }} title={`${snap.date}: ${formatUSD(snap.grand_total_usd)}`}>{isSelected && (<div style={{ position: 'absolute', bottom: '-22px', left: '50%', transform: 'translateX(-50%)', fontSize: '9px', color: '#2563eb', whiteSpace: 'nowrap', fontWeight: '600' }}>{snap.date.slice(5)}</div>)}</div>) })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#9ca3af', marginTop: '5px' }}><span>{chartData[0]?.date}</span><span>{chartData[chartData.length - 1]?.date}</span></div>
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '20px' }}>
        {exchangeOrder.map(ex => { const total = exchangeTotals[ex]; return (<div key={ex} style={{ padding: '12px 14px', background: total > 0 ? '#f8f9fa' : '#fafafa', borderRadius: '8px', border: total > 0 ? '1px solid #e0e0e0' : '1px solid #eee' }}><div style={{ fontSize: '11px', color: total > 0 ? '#374151' : '#9ca3af', textTransform: 'uppercase', fontWeight: '600' }}>{ex}</div><div style={{ fontSize: '16px', fontWeight: '700', color: total > 0 ? '#1a1a1a' : '#d1d5db' }}>{formatUSD(total)}</div></div>) })}
      </div>
      <div style={{ border: '1px solid #e0e0e0', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead><tr style={{ background: '#f8f9fa' }}><th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e0e0e0', color: '#374151', width: '100px' }}>Exchange</th><th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', borderBottom: '2px solid #e0e0e0', color: '#374151', width: '180px' }}>Account</th>{topCoins.map(coin => (<th key={coin} style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', borderBottom: '2px solid #e0e0e0', color: '#374151', minWidth: '80px' }}>{coin}</th>))}<th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '700', borderBottom: '2px solid #e0e0e0', color: '#1a1a1a', background: '#e8f4fd', minWidth: '120px' }}>Total USD</th></tr></thead>
          <tbody>
            {rows.map((row, idx) => (<tr key={idx} style={{ background: row.isExchangeTotal ? '#eef2ff' : (row.isMaster ? '#fff' : (row.isSub ? '#fafafa' : '#fff')), borderBottom: row.isExchangeTotal ? '2px solid #c7d2fe' : '1px solid #f0f0f0' }}><td style={{ padding: '10px 16px', fontWeight: row.exchange ? '700' : '400', color: row.exchange ? '#1e3a8a' : '#666', borderRight: '1px solid #f0f0f0', background: row.isExchangeTotal ? '#dbeafe' : 'transparent' }}>{row.exchange}</td><td style={{ padding: '10px 16px', paddingLeft: row.isSub ? '32px' : (row.isMaster ? '24px' : '16px'), color: row.isExchangeTotal ? '#1e3a8a' : (row.isSub ? '#666' : '#1a1a1a'), fontFamily: row.isSub ? 'monospace' : 'inherit', fontSize: row.isSub ? '11px' : '12px', fontWeight: row.isExchangeTotal ? '600' : '400', borderRight: '1px solid #f0f0f0' }}>{row.account}</td>{topCoins.map(coin => { const coinData = row.balances[coin]; const amount = coinData?.amount; const usd = coinData?.usd; const amountStr = formatAmount(amount); return (<td key={coin} style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace', borderRight: '1px solid #f5f5f5', verticalAlign: 'middle', fontWeight: row.isExchangeTotal ? '600' : '400' }}>{amountStr ? (<div><div style={{ color: amount < 0 ? '#dc2626' : (row.isExchangeTotal ? '#1e3a8a' : '#374151'), fontSize: '12px' }}>{amountStr}</div>{usd && Math.abs(usd) >= 1 && (<div style={{ color: row.isExchangeTotal ? '#3b82f6' : '#9ca3af', fontSize: '10px', marginTop: '2px' }}>{formatUSD(usd)}</div>)}</div>) : (<span style={{ color: '#e5e7eb' }}>-</span>)}</td>) })}<td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: row.isExchangeTotal ? '700' : '600', color: row.totalUsd < 0 ? '#dc2626' : (row.totalUsd === 0 ? '#9ca3af' : (row.isExchangeTotal ? '#1e3a8a' : '#1a1a1a')), background: row.isExchangeTotal ? '#bfdbfe' : '#f0f7ff', fontFamily: 'monospace', fontSize: row.isExchangeTotal ? '14px' : '12px' }}>{formatUSD(row.totalUsd)}</td></tr>))}
          </tbody>
          <tfoot><tr style={{ background: '#1e3a5f' }}><td colSpan={2} style={{ padding: '14px 16px', fontWeight: '700', color: '#fff', fontSize: '13px' }}>GRAND TOTAL</td>{topCoins.map(coin => (<td key={coin} style={{ padding: '14px 8px', textAlign: 'right', color: '#94a3b8' }}></td>))}<td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: '700', color: '#fff', fontSize: '16px', fontFamily: 'monospace' }}>{formatUSD(displayData?.grand_total_usd)}</td></tr></tfoot>
        </table>
      </div>
      <div style={{ marginTop: '16px', fontSize: '11px', color: '#9ca3af', textAlign: 'center' }}>Last updated: {data?.timestamp ? new Date(data.timestamp).toLocaleString() : '-'} • Snapshots saved daily at 5PM SGT</div>
    </div>
  )
}

// ============ MAIN DASHBOARD ============
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('cex')
  return (
    <div style={styles.container}>
      {/* Header */}
      <div style={{ marginBottom: '24px', paddingBottom: '16px', borderBottom: '3px solid #1e3a5f' }}>
        <h1 style={{ margin: 0, fontSize: '28px', fontWeight: '700', color: '#1e3a5f', letterSpacing: '-0.5px' }}>Liquid Fund Dashboard</h1>
      </div>

      {/* Tabs */}
      <div style={styles.tabs}>
        <button style={styles.tab(activeTab === 'cex')} onClick={() => setActiveTab('cex')}>CEX Balance</button>
        <button style={styles.tab(activeTab === 'loans')} onClick={() => setActiveTab('loans')}>Loans</button>
        <button style={styles.tab(activeTab === 'locked')} onClick={() => setActiveTab('locked')}>Locked Tokens</button>
      </div>
      {activeTab === 'cex' && <CEXBalanceTab />}
      {activeTab === 'loans' && <LoansTab />}
      {activeTab === 'locked' && <LockedTokensTab />}
    </div>
  )
}



