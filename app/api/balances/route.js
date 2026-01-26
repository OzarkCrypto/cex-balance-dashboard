import crypto from 'crypto';

// Force Singapore region
export const runtime = 'nodejs';
export const preferredRegion = 'sin1';

const exchanges = {
  binance: {
    baseUrl: 'https://api.binance.com',
    async getBalances(apiKey, apiSecret) {
      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(queryString).digest('hex');
      
      const response = await fetch(
        `${this.baseUrl}/api/v3/account?${queryString}&signature=${signature}`,
        { headers: { 'X-MBX-APIKEY': apiKey } }
      );
      
      if (!response.ok) throw new Error(`Binance error: ${response.status}`);
      const data = await response.json();
      
      return data.balances
        .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
        .map(b => ({
          currency: b.asset,
          balance: parseFloat(b.free) + parseFloat(b.locked),
          free: parseFloat(b.free),
          locked: parseFloat(b.locked)
        }));
    }
  },
  
  bybit: {
    baseUrl: 'https://api.bybit.com',
    async getBalances(apiKey, apiSecret) {
      const timestamp = Date.now();
      const recvWindow = 5000;
      const queryString = `accountType=UNIFIED`;
      const signString = `${timestamp}${apiKey}${recvWindow}${queryString}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(signString).digest('hex');
      
      const response = await fetch(
        `${this.baseUrl}/v5/account/wallet-balance?${queryString}`,
        {
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp.toString(),
            'X-BAPI-RECV-WINDOW': recvWindow.toString(),
            'X-BAPI-SIGN': signature
          }
        }
      );
      
      if (!response.ok) throw new Error(`Bybit error: ${response.status}`);
      const data = await response.json();
      
      if (data.retCode !== 0) throw new Error(`Bybit API error: ${data.retMsg}`);
      
      const coins = data.result?.list?.[0]?.coin || [];
      return coins
        .filter(c => parseFloat(c.walletBalance) > 0)
        .map(c => ({
          currency: c.coin,
          balance: parseFloat(c.walletBalance),
          usdValue: parseFloat(c.usdValue) || 0
        }));
    }
  },
  
  okx: {
    baseUrl: 'https://www.okx.com',
    async getBalances(apiKey, apiSecret, passphrase) {
      const timestamp = new Date().toISOString();
      const method = 'GET';
      const requestPath = '/api/v5/account/balance';
      const signString = timestamp + method + requestPath;
      const signature = crypto.createHmac('sha256', apiSecret).update(signString).digest('base64');
      
      const response = await fetch(
        `${this.baseUrl}${requestPath}`,
        {
          headers: {
            'OK-ACCESS-KEY': apiKey,
            'OK-ACCESS-SIGN': signature,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': passphrase
          }
        }
      );
      
      if (!response.ok) throw new Error(`OKX error: ${response.status}`);
      const data = await response.json();
      
      if (data.code !== '0') throw new Error(`OKX API error: ${data.msg}`);
      
      const details = data.data?.[0]?.details || [];
      return details
        .filter(d => parseFloat(d.cashBal) > 0)
        .map(d => ({
          currency: d.ccy,
          balance: parseFloat(d.cashBal),
          usdValue: parseFloat(d.eqUsd) || 0
        }));
    }
  },
  
  kucoin: {
    baseUrl: 'https://api.kucoin.com',
    async getBalances(apiKey, apiSecret, passphrase) {
      const timestamp = Date.now();
      const method = 'GET';
      const endpoint = '/api/v1/accounts';
      const signString = timestamp + method + endpoint;
      const signature = crypto.createHmac('sha256', apiSecret).update(signString).digest('base64');
      const passphraseHash = crypto.createHmac('sha256', apiSecret).update(passphrase).digest('base64');
      
      const response = await fetch(
        `${this.baseUrl}${endpoint}`,
        {
          headers: {
            'KC-API-KEY': apiKey,
            'KC-API-SIGN': signature,
            'KC-API-TIMESTAMP': timestamp.toString(),
            'KC-API-PASSPHRASE': passphraseHash,
            'KC-API-KEY-VERSION': '2'
          }
        }
      );
      
      if (!response.ok) throw new Error(`KuCoin error: ${response.status}`);
      const data = await response.json();
      
      if (data.code !== '200000') throw new Error(`KuCoin API error: ${data.msg}`);
      
      const balances = {};
      (data.data || []).forEach(acc => {
        const bal = parseFloat(acc.balance);
        if (bal > 0) {
          if (!balances[acc.currency]) {
            balances[acc.currency] = { currency: acc.currency, balance: 0 };
          }
          balances[acc.currency].balance += bal;
        }
      });
      
      return Object.values(balances);
    }
  },
  
  kraken: {
    baseUrl: 'https://api.kraken.com',
    async getBalances(apiKey, apiSecret) {
      const path = '/0/private/Balance';
      const nonce = Date.now() * 1000;
      const postData = `nonce=${nonce}`;
      
      const hash = crypto.createHash('sha256').update(nonce + postData).digest();
      const secretBuffer = Buffer.from(apiSecret, 'base64');
      const hmac = crypto.createHmac('sha512', secretBuffer);
      hmac.update(path);
      hmac.update(hash);
      const signature = hmac.digest('base64');
      
      const response = await fetch(
        `${this.baseUrl}${path}`,
        {
          method: 'POST',
          headers: {
            'API-Key': apiKey,
            'API-Sign': signature,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: postData
        }
      );
      
      if (!response.ok) throw new Error(`Kraken error: ${response.status}`);
      const data = await response.json();
      
      if (data.error && data.error.length > 0) throw new Error(`Kraken API error: ${data.error.join(', ')}`);
      
      return Object.entries(data.result || {})
        .filter(([_, bal]) => parseFloat(bal) > 0)
        .map(([currency, balance]) => ({
          currency: currency.replace(/^[XZ]/, ''),
          balance: parseFloat(balance)
        }));
    }
  },
  
  zoomex: {
    baseUrl: 'https://api.zoomex.com',
    async getBalances(apiKey, apiSecret) {
      const timestamp = Date.now();
      const recvWindow = 5000;
      const queryString = 'accountType=UNIFIED';
      const signString = `${timestamp}${apiKey}${recvWindow}${queryString}`;
      const signature = crypto.createHmac('sha256', apiSecret).update(signString).digest('hex');
      
      const response = await fetch(
        `${this.baseUrl}/v5/account/wallet-balance?${queryString}`,
        {
          headers: {
            'X-BAPI-API-KEY': apiKey,
            'X-BAPI-TIMESTAMP': timestamp.toString(),
            'X-BAPI-RECV-WINDOW': recvWindow.toString(),
            'X-BAPI-SIGN': signature
          }
        }
      );
      
      if (!response.ok) throw new Error(`Zoomex error: ${response.status}`);
      const data = await response.json();
      
      if (data.retCode !== 0) throw new Error(`Zoomex API error: ${data.retMsg}`);
      
      const coins = data.result?.list?.[0]?.coin || [];
      return coins
        .filter(c => parseFloat(c.walletBalance) > 0)
        .map(c => ({
          currency: c.coin,
          balance: parseFloat(c.walletBalance),
          usdValue: parseFloat(c.usdValue) || 0
        }));
    }
  }
};

export async function GET() {
  const results = {};
  const errors = {};
  
  // Binance
  if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) {
    try {
      results.binance = await exchanges.binance.getBalances(
        process.env.BINANCE_API_KEY,
        process.env.BINANCE_API_SECRET
      );
    } catch (e) {
      errors.binance = e.message;
    }
  }
  
  // Bybit
  if (process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET) {
    try {
      results.bybit = await exchanges.bybit.getBalances(
        process.env.BYBIT_API_KEY,
        process.env.BYBIT_API_SECRET
      );
    } catch (e) {
      errors.bybit = e.message;
    }
  }
  
  // OKX
  if (process.env.OKX_API_KEY && process.env.OKX_API_SECRET && process.env.OKX_PASSPHRASE) {
    try {
      results.okx = await exchanges.okx.getBalances(
        process.env.OKX_API_KEY,
        process.env.OKX_API_SECRET,
        process.env.OKX_PASSPHRASE
      );
    } catch (e) {
      errors.okx = e.message;
    }
  }
  
  // KuCoin
  if (process.env.KUCOIN_API_KEY && process.env.KUCOIN_API_SECRET && process.env.KUCOIN_PASSPHRASE) {
    try {
      results.kucoin = await exchanges.kucoin.getBalances(
        process.env.KUCOIN_API_KEY,
        process.env.KUCOIN_API_SECRET,
        process.env.KUCOIN_PASSPHRASE
      );
    } catch (e) {
      errors.kucoin = e.message;
    }
  }
  
  // Kraken
  if (process.env.KRAKEN_API_KEY && process.env.KRAKEN_API_SECRET) {
    try {
      results.kraken = await exchanges.kraken.getBalances(
        process.env.KRAKEN_API_KEY,
        process.env.KRAKEN_API_SECRET
      );
    } catch (e) {
      errors.kraken = e.message;
    }
  }
  
  // Zoomex
  if (process.env.ZOOMEX_API_KEY && process.env.ZOOMEX_API_SECRET) {
    try {
      results.zoomex = await exchanges.zoomex.getBalances(
        process.env.ZOOMEX_API_KEY,
        process.env.ZOOMEX_API_SECRET
      );
    } catch (e) {
      errors.zoomex = e.message;
    }
  }
  
  return Response.json({
    timestamp: new Date().toISOString(),
    balances: results,
    errors: Object.keys(errors).length > 0 ? errors : undefined
  });
}
