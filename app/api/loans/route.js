import { NextResponse } from 'next/server'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO = 'OzarkCrypto/cex-balance-dashboard'
const FILE_PATH = 'data/loans.json'

async function getFile() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}` }, cache: 'no-store' }
  )
  if (res.status === 404) return { content: { receivables: [], payables: [] }, sha: null }
  const data = await res.json()
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString())
  // 기존 데이터 마이그레이션
  if (Array.isArray(content)) {
    return { content: { receivables: [], payables: [] }, sha: data.sha }
  }
  return { content, sha: data.sha }
}

async function saveFile(content, sha) {
  const body = {
    message: `Update loans ${new Date().toISOString().slice(0,10)}`,
    content: Buffer.from(JSON.stringify(content, null, 2)).toString('base64'),
    ...(sha && { sha })
  }
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
    {
      method: 'PUT',
      headers: { Authorization: `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    }
  )
  return res.ok
}

export async function GET() {
  try {
    const { content } = await getFile()
    return NextResponse.json(content)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { action, type, item, id } = await request.json()
    const { content, sha } = await getFile()
    
    const list = type === 'receivable' ? content.receivables : content.payables
    
    if (action === 'add') {
      const newItem = { ...item, id: Date.now().toString(), createdAt: new Date().toISOString() }
      list.push(newItem)
    } else if (action === 'update') {
      const idx = list.findIndex(l => l.id === id)
      if (idx !== -1) list[idx] = { ...list[idx], ...item, updatedAt: new Date().toISOString() }
    } else if (action === 'delete') {
      const idx = list.findIndex(l => l.id === id)
      if (idx !== -1) list.splice(idx, 1)
    }
    
    const ok = await saveFile(content, sha)
    if (!ok) throw new Error('Failed to save')
    return NextResponse.json({ success: true, ...content })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
