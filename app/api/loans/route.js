import { NextResponse } from 'next/server'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO = 'OzarkCrypto/cex-balance-dashboard'
const FILE_PATH = 'data/loans.json'

async function getFile() {
  const res = await fetch(
    `https://api.github.com/repos/${REPO}/contents/${FILE_PATH}`,
    { headers: { Authorization: `token ${GITHUB_TOKEN}` }, cache: 'no-store' }
  )
  if (res.status === 404) return { content: [], sha: null }
  const data = await res.json()
  const content = JSON.parse(Buffer.from(data.content, 'base64').toString())
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
    return NextResponse.json({ loans: content })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function POST(request) {
  try {
    const { action, loan, id } = await request.json()
    const { content, sha } = await getFile()
    
    if (action === 'add') {
      const newLoan = { ...loan, id: Date.now().toString(), createdAt: new Date().toISOString() }
      content.push(newLoan)
    } else if (action === 'update') {
      const idx = content.findIndex(l => l.id === id)
      if (idx !== -1) content[idx] = { ...content[idx], ...loan, updatedAt: new Date().toISOString() }
    } else if (action === 'delete') {
      const idx = content.findIndex(l => l.id === id)
      if (idx !== -1) content.splice(idx, 1)
    }
    
    const ok = await saveFile(content, sha)
    if (!ok) throw new Error('Failed to save')
    return NextResponse.json({ success: true, loans: content })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
