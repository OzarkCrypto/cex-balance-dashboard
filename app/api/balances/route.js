import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return Response.json({
      balances: {},
      error: 'Supabase not configured'
    })
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  try {
    // 계정 정보 가져오기
    const { data: accounts, error: accountsError } = await supabase
      .from('accounts')
      .select('*')

    if (accountsError) throw accountsError

    // 현재 잔고 가져오기
    const { data: currentBalances, error: balancesError } = await supabase
      .from('balance_current')
      .select('*')

    if (balancesError) throw balancesError

    // 거래소별로 그룹화
    const balances = {}
    const exchanges = ['binance', 'bybit', 'okx', 'kucoin', 'kraken', 'zoomex']
    
    exchanges.forEach(exchange => {
      balances[exchange] = {
        total_usd: 0,
        assets: [],
        sub_accounts: []
      }
    })

    // 계정별 잔고 매핑
    if (accounts && currentBalances) {
      const accountMap = {}
      accounts.forEach(acc => {
        accountMap[acc.id] = acc
      })

      currentBalances.forEach(bal => {
        const account = accountMap[bal.account_id]
        if (!account) return

        const exchange = account.exchange.toLowerCase()
        if (!balances[exchange]) return

        // 자산 추가
        balances[exchange].assets.push({
          currency: bal.currency,
          balance: parseFloat(bal.balance),
          usd_value: parseFloat(bal.usd_value) || 0,
          wallet_type: bal.wallet_type
        })

        balances[exchange].total_usd += parseFloat(bal.usd_value) || 0

        // 서브계정 처리
        if (account.account_type === 'sub') {
          const existingSub = balances[exchange].sub_accounts.find(
            s => s.name === account.account_name
          )
          if (existingSub) {
            existingSub.total_usd += parseFloat(bal.usd_value) || 0
          } else {
            balances[exchange].sub_accounts.push({
              name: account.account_name,
              total_usd: parseFloat(bal.usd_value) || 0
            })
          }
        }
      })

      // USD 가치 기준으로 정렬
      exchanges.forEach(exchange => {
        balances[exchange].assets.sort((a, b) => b.usd_value - a.usd_value)
      })
    }

    return Response.json({ balances })
  } catch (error) {
    console.error('Error fetching balances:', error)
    return Response.json({
      balances: {},
      error: error.message
    })
  }
}
