import json
import hmac
import hashlib
import time
import urllib.request
import urllib.parse
import base64
import os
import boto3
from datetime import datetime, timezone, timedelta

# DynamoDB
dynamodb = boto3.resource('dynamodb', region_name='ap-northeast-2')
snapshots_table = dynamodb.Table('cex-balance-snapshots')

# 가격 캐시
PRICES = {}

def fetch_prices():
    """Binance에서 주요 코인 가격 조회"""
    global PRICES
    try:
        url = 'https://api.binance.com/api/v3/ticker/price'
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode())
        
        for item in data:
            symbol = item['symbol']
            price = float(item['price'])
            # USDT 페어만 추출
            if symbol.endswith('USDT'):
                coin = symbol[:-4]
                PRICES[coin] = price
        
        # 스테이블코인
        PRICES['USDT'] = 1.0
        PRICES['USDC'] = 1.0
        PRICES['BUSD'] = 1.0
        PRICES['DAI'] = 1.0
        PRICES['TUSD'] = 1.0
        PRICES['FDUSD'] = 1.0
        PRICES['USD1'] = 1.0
        PRICES['USDE'] = 1.0
        
        print(f"Loaded {len(PRICES)} prices")
    except Exception as e:
        print(f"Price fetch error: {e}")
        # 기본값
        PRICES = {'BTC': 100000, 'ETH': 3500, 'USDT': 1, 'USDC': 1, 'BNB': 700}

def get_usd_value(coin, amount, exchange_usd_values=None):
    """코인의 USD 가치 계산"""
    # OKX에서 제공한 USD 값이 있으면 사용
    if exchange_usd_values and coin in exchange_usd_values:
        return exchange_usd_values[coin]
    
    # 접미사 제거: _FUTURES, _EARN, _EARN_LOCKED, _MARGIN, _FUND, _SUPER_MARGIN 등
    base_coin = coin.replace('_FUTURES', '').replace('_COIN_FUTURES', '').replace('_EARN_LOCKED', '').replace('_EARN', '').replace('_MARGIN', '').replace('_FUND', '').replace('_SUPER_MARGIN', '').replace('_OTC', '').replace('_POINT', '')
    
    price = PRICES.get(base_coin, 0)
    return amount * price

def calculate_usd_values(balances):
    """잔고에 USD 가치 추가"""
    for exchange, data in balances.items():
        # OKX 서브계정 직접 USD 값
        direct_sub_usd = data.get('subaccounts_usd_direct', {})
        
        # Master USD 계산 - 항상 가격 기반으로
        master_usd = 0
        master_usd_breakdown = {}
        for coin, amount in data.get('master', {}).items():
            usd = get_usd_value(coin, amount, None)  # 마스터는 가격 기반
            master_usd += usd
            if usd != 0:
                master_usd_breakdown[coin] = {'amount': amount, 'usd': round(usd, 2)}
        data['master_usd'] = round(master_usd, 2)
        data['master_breakdown'] = master_usd_breakdown
        
        # Subaccount USD 계산
        subaccounts_usd = {}
        total_sub_usd = 0
        for sub_name, sub_bal in data.get('subaccounts', {}).items():
            sub_usd = 0
            sub_breakdown = {}
            sub_direct = direct_sub_usd.get(sub_name, {})
            for coin, amount in sub_bal.items():
                # OKX 직접 USD 값 우선 사용
                if sub_direct and coin in sub_direct:
                    usd = sub_direct[coin]
                else:
                    usd = get_usd_value(coin, amount, None)
                sub_usd += usd
                if usd != 0:
                    sub_breakdown[coin] = {'amount': amount, 'usd': round(usd, 2)}
            subaccounts_usd[sub_name] = {
                'usd': round(sub_usd, 2),
                'breakdown': sub_breakdown
            }
            total_sub_usd += sub_usd
        data['subaccounts_usd'] = subaccounts_usd
        data['subaccounts_total_usd'] = round(total_sub_usd, 2)
        
        # 거래소 총 USD
        data['exchange_total_usd'] = round(master_usd + total_sub_usd, 2)

def fetch_all_balances(event):
    """모든 거래소 잔고 조회"""
    # 가격 먼저 로드
    fetch_prices()
    
    results = {}
    errors = {}
    
    # Binance
    if os.environ.get('BINANCE_API_KEY'):
        try:
            results['binance'] = fetch_binance()
            print(f"✓ Binance: {len(results['binance'].get('total', {}))} assets")
        except Exception as e:
            errors['binance'] = str(e)
            print(f"✗ Binance: {e}")
    
    # Bybit
    if os.environ.get('BYBIT_API_KEY'):
        try:
            results['bybit'] = fetch_bybit()
            print(f"✓ Bybit: {len(results['bybit'].get('total', {}))} assets")
        except Exception as e:
            errors['bybit'] = str(e)
            print(f"✗ Bybit: {e}")
    
    # OKX
    if os.environ.get('OKX_API_KEY'):
        try:
            results['okx'] = fetch_okx()
            print(f"✓ OKX: {len(results['okx'].get('total', {}))} assets")
        except Exception as e:
            errors['okx'] = str(e)
            print(f"✗ OKX: {e}")
    
    # KuCoin
    if os.environ.get('KUCOIN_API_KEY'):
        try:
            results['kucoin'] = fetch_kucoin()
            print(f"✓ KuCoin: {len(results['kucoin'].get('total', {}))} assets")
        except Exception as e:
            errors['kucoin'] = str(e)
            print(f"✗ KuCoin: {e}")
    
    # Kraken
    if os.environ.get('KRAKEN_API_KEY'):
        try:
            results['kraken'] = fetch_kraken()
            print(f"✓ Kraken: {len(results['kraken'].get('total', {}))} assets")
        except Exception as e:
            errors['kraken'] = str(e)
            print(f"✗ Kraken: {e}")
    
    # Zoomex
    if os.environ.get('ZOOMEX_API_KEY'):
        try:
            results['zoomex'] = fetch_zoomex()
            print(f"✓ Zoomex: {len(results['zoomex'].get('total', {}))} assets")
        except Exception as e:
            errors['zoomex'] = str(e)
            print(f"✗ Zoomex: {e}")
    
    # HTX
    if os.environ.get('HTX_API_KEY'):
        try:
            results['htx'] = fetch_htx()
            print(f"✓ HTX: {len(results['htx'].get('total', {}))} assets")
        except Exception as e:
            errors['htx'] = str(e)
            print(f"✗ HTX: {e}")
    
    # USD 가치 계산
    calculate_usd_values(results)
    
    # 전체 총합
    grand_total_usd = sum(data.get('exchange_total_usd', 0) for data in results.values())
    
    response = {
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'grand_total_usd': round(grand_total_usd, 2),
        'balances': results,
        'errors': errors if errors else None
    }
    
    # 스케줄 트리거 (EventBridge)면 스냅샷 저장
    if event.get('source') == 'aws.events' or event.get('save_snapshot'):
        save_snapshot(response)
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps(response)
    }


def save_snapshot(data):
    """DynamoDB에 스냅샷 저장"""
    try:
        # 싱가폴 시간 (UTC+8)
        sgt = timezone(timedelta(hours=8))
        now_sgt = datetime.now(sgt)
        date_str = now_sgt.strftime('%Y-%m-%d')
        
        item = {
            'date': date_str,
            'timestamp': data['timestamp'],
            'grand_total_usd': str(data['grand_total_usd']),
            'balances': json.dumps(data['balances'])
        }
        
        snapshots_table.put_item(Item=item)
        print(f"Snapshot saved: {date_str}")
    except Exception as e:
        print(f"Snapshot save error: {e}")


def get_snapshots(limit=30):
    """최근 스냅샷 조회"""
    try:
        response = snapshots_table.scan(
            Limit=limit
        )
        items = response.get('Items', [])
        
        # 날짜 역순 정렬
        items.sort(key=lambda x: x['date'], reverse=True)
        
        return [{
            'date': item['date'],
            'timestamp': item['timestamp'],
            'grand_total_usd': float(item['grand_total_usd']),
            'balances': json.loads(item['balances'])
        } for item in items]
    except Exception as e:
        print(f"Snapshot fetch error: {e}")
        return []


def lambda_handler(event, context):
    """메인 핸들러 - 라우팅"""
    
    # API Gateway path 확인
    path = event.get('path', '') or event.get('rawPath', '')
    method = event.get('httpMethod', '') or event.get('requestContext', {}).get('http', {}).get('method', '')
    
    # /snapshots 엔드포인트
    if '/snapshots' in path:
        snapshots = get_snapshots(limit=90)  # 최대 90일
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'snapshots': snapshots})
        }
    
    # 기본: 현재 잔고 조회
    return fetch_all_balances(event)


def http_request(url, headers=None, method='GET', body=None):
    """HTTP 요청 유틸리티"""
    req = urllib.request.Request(url, headers=headers or {}, method=method)
    if body:
        req.data = body.encode() if isinstance(body, str) else body
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


# ============ BINANCE ============
def fetch_binance():
    api_key = os.environ['BINANCE_API_KEY']
    api_secret = os.environ['BINANCE_API_SECRET']
    
    result = {'master': {}, 'subaccounts': {}, 'total': {}}
    
    def binance_req(endpoint, params=None, base='https://api.binance.com'):
        params = params or {}
        params['timestamp'] = int(time.time() * 1000)
        query = urllib.parse.urlencode(params)
        signature = hmac.new(api_secret.encode(), query.encode(), hashlib.sha256).hexdigest()
        url = f'{base}{endpoint}?{query}&signature={signature}'
        return http_request(url, {'X-MBX-APIKEY': api_key})
    
    # Master Spot account
    data = binance_req('/api/v3/account')
    for b in data.get('balances', []):
        total = float(b['free']) + float(b['locked'])
        if total > 0:
            result['master'][b['asset']] = total
            result['total'][b['asset']] = total
    
    # Simple Earn - Flexible
    try:
        earn_flex = binance_req('/sapi/v1/simple-earn/flexible/position', {'size': 100})
        for r in earn_flex.get('rows', []):
            amt = float(r.get('totalAmount', 0))
            if amt > 0:
                asset = r.get('asset')
                key = f"{asset}_EARN"
                result['master'][key] = amt
                result['total'][key] = result['total'].get(key, 0) + amt
                print(f"Binance Earn Flexible {asset}: {amt}")
    except Exception as e:
        print(f"Binance earn flexible error: {e}")
    
    # Simple Earn - Locked
    try:
        earn_lock = binance_req('/sapi/v1/simple-earn/locked/position', {'size': 100})
        for r in earn_lock.get('rows', []):
            amt = float(r.get('amount', 0))
            if amt > 0:
                asset = r.get('asset')
                key = f"{asset}_EARN_LOCKED"
                result['master'][key] = amt
                result['total'][key] = result['total'].get(key, 0) + amt
                print(f"Binance Earn Locked {asset}: {amt}")
    except Exception as e:
        print(f"Binance earn locked error: {e}")
    
    # Master Futures (USDT-M) - wallet과 uPnL 분리 저장
    try:
        futures = binance_req('/fapi/v2/account', base='https://fapi.binance.com')
        result['upnl'] = result.get('upnl', {})
        for asset in futures.get('assets', []):
            wallet = float(asset.get('walletBalance', 0))
            upnl = float(asset.get('unrealizedProfit', 0))
            margin = float(asset.get('marginBalance', 0))
            if margin != 0:
                ccy = asset['asset']
                key = f"{ccy}_FUTURES"
                result['master'][key] = margin
                result['total'][key] = result['total'].get(key, 0) + margin
                # uPnL 분리 저장
                if upnl != 0:
                    result['upnl'][key] = result['upnl'].get(key, 0) + upnl
                    print(f"Binance Master {ccy}_FUTURES: wallet={wallet}, uPnL={upnl}, margin={margin}")
    except Exception as e:
        print(f"Binance master futures error: {e}")
    
    # Subaccounts
    try:
        subs = binance_req('/sapi/v1/sub-account/list')
        print(f"Binance subaccounts found: {len(subs.get('subAccounts', []))}")
        
        for sub in subs.get('subAccounts', []):
            email = sub['email']
            sub_bal = {}
            
            # Spot balance
            try:
                assets = binance_req('/sapi/v4/sub-account/assets', {'email': email})
                for a in assets.get('balances', []):
                    total = float(a.get('free', 0)) + float(a.get('locked', 0))
                    if total > 0:
                        sub_bal[a['asset']] = total
            except Exception as e:
                print(f"  {email} spot error: {e}")
            
            # Futures USDT-M balance - wallet과 uPnL 분리
            try:
                fut = binance_req('/sapi/v2/sub-account/futures/account', {'email': email, 'futuresType': 1})
                fut_resp = fut.get('futureAccountResp', {})
                
                # 개별 자산 잔고 - marginBalance = walletBalance + unrealizedProfit
                for asset in fut_resp.get('assets', []):
                    wallet = float(asset.get('walletBalance', 0))
                    upnl = float(asset.get('unrealizedProfit', 0))
                    margin = float(asset.get('marginBalance', 0))
                    if margin != 0:  # 양수/음수 모두 기록
                        ccy = asset.get('asset', 'UNKNOWN')
                        key = f"{ccy}_FUTURES"
                        sub_bal[key] = sub_bal.get(key, 0) + margin
                        # uPnL 분리 저장
                        if upnl != 0:
                            result['upnl'][key] = result['upnl'].get(key, 0) + upnl
                        print(f"  {email} {ccy}_FUTURES: wallet={wallet}, uPnL={upnl}")
            except Exception as e:
                print(f"  {email} futures error: {e}")
            
            # Futures COIN-M balance - marginBalance 사용
            try:
                fut_coin = binance_req('/sapi/v2/sub-account/futures/account', {'email': email, 'futuresType': 2})
                fut_resp = fut_coin.get('deliveryAccountResp', {})
                
                for asset_info in fut_resp.get('assets', []):
                    margin = float(asset_info.get('marginBalance', 0))
                    if margin != 0:
                        ccy = asset_info.get('asset', 'UNKNOWN')
                        key = f"{ccy}_COIN_FUTURES"
                        sub_bal[key] = sub_bal.get(key, 0) + margin
                        print(f"  {email} {ccy}_COIN_FUTURES: {margin} (margin)")
            except Exception as e:
                print(f"  {email} coin futures error: {e}")
            
            # Cross Margin balance
            try:
                margin_data = binance_req('/sapi/v1/sub-account/margin/account', {'email': email})
                for asset in margin_data.get('marginUserAssetVoList', []):
                    net = float(asset.get('netAsset', 0))
                    if net != 0:
                        ccy = asset['asset']
                        key = f"{ccy}_MARGIN"
                        sub_bal[key] = sub_bal.get(key, 0) + net
                        print(f"  {email} {ccy}_MARGIN: {net}")
            except Exception as e:
                print(f"  {email} margin error: {e}")
            
            # Add to results
            if sub_bal:
                result['subaccounts'][email] = sub_bal
                for ccy, amt in sub_bal.items():
                    result['total'][ccy] = result['total'].get(ccy, 0) + amt
                    
    except Exception as e:
        print(f"Binance subaccount list error: {e}")
    
    return result


# ============ BYBIT ============
def fetch_bybit():
    api_key = os.environ['BYBIT_API_KEY']
    api_secret = os.environ['BYBIT_API_SECRET']
    
    # 서브계정 전용 API 키 (equity/uPnL 조회용)
    sub_api_key = os.environ.get('BYBIT_SUB_API_KEY')
    sub_api_secret = os.environ.get('BYBIT_SUB_API_SECRET')
    
    result = {'master': {}, 'subaccounts': {}, 'total': {}}
    
    def bybit_req(endpoint, params=None, use_sub_key=False):
        ak = sub_api_key if use_sub_key else api_key
        sk = sub_api_secret if use_sub_key else api_secret
        
        timestamp = str(int(time.time() * 1000))
        recv_window = '5000'
        query = urllib.parse.urlencode(params) if params else ''
        sign_str = f"{timestamp}{ak}{recv_window}{query}"
        signature = hmac.new(sk.encode(), sign_str.encode(), hashlib.sha256).hexdigest()
        
        headers = {
            'X-BAPI-API-KEY': ak,
            'X-BAPI-TIMESTAMP': timestamp,
            'X-BAPI-RECV-WINDOW': recv_window,
            'X-BAPI-SIGN': signature
        }
        url = f'https://api.bybit.com{endpoint}'
        if query:
            url += f'?{query}'
        return http_request(url, headers)
    
    # Master - Unified account (equity 사용)
    data = bybit_req('/v5/account/wallet-balance', {'accountType': 'UNIFIED'})
    if data.get('retCode') == 0:
        for coin in data.get('result', {}).get('list', [{}])[0].get('coin', []):
            equity = float(coin.get('equity', 0))
            if equity == 0:
                equity = float(coin.get('walletBalance', 0))
            if equity != 0:
                result['master'][coin['coin']] = equity
                result['total'][coin['coin']] = equity
    
    # Master - FUND account (deposits/withdrawals wallet)
    try:
        fund_data = bybit_req('/v5/asset/transfer/query-account-coins-balance', {'accountType': 'FUND'})
        if fund_data.get('retCode') == 0:
            for coin in fund_data.get('result', {}).get('balance', []):
                bal = float(coin.get('walletBalance', 0))
                if bal > 0:
                    key = f"{coin['coin']}_FUND"
                    result['master'][key] = bal
                    result['total'][key] = result['total'].get(key, 0) + bal
                    print(f"Bybit FUND {coin['coin']}: {bal}")
    except Exception as e:
        print(f"Bybit FUND error: {e}")
    
    # Subaccounts - 서브계정 API 키로 equity 조회
    if sub_api_key and sub_api_secret:
        try:
            sub_data = bybit_req('/v5/account/wallet-balance', {'accountType': 'UNIFIED'}, use_sub_key=True)
            if sub_data.get('retCode') == 0:
                sub_bal = {}
                result['upnl'] = result.get('upnl', {})
                for coin in sub_data.get('result', {}).get('list', [{}])[0].get('coin', []):
                    equity = float(coin.get('equity', 0))
                    wallet = float(coin.get('walletBalance', 0))
                    upl = float(coin.get('unrealisedPnl', 0))
                    if equity != 0:
                        sub_bal[coin['coin']] = equity
                        # uPnL 분리 저장
                        if upl != 0:
                            result['upnl'][coin['coin']] = result['upnl'].get(coin['coin'], 0) + upl
                        print(f"  Bybit Sub {coin['coin']}: wallet={wallet}, uPnL={upl}, equity={equity}")
                
                if sub_bal:
                    result['subaccounts']['BybitH7JSSEtym6M'] = sub_bal
                    for ccy, amt in sub_bal.items():
                        result['total'][ccy] = result['total'].get(ccy, 0) + amt
                    print(f"Bybit subaccount equity loaded")
        except Exception as e:
            print(f"Bybit sub API error: {e}")
    else:
        # Fallback: 마스터 API로 wallet balance만 조회
        try:
            subs = bybit_req('/v5/user/query-sub-members', {})
            if subs.get('retCode') == 0:
                for sub in subs.get('result', {}).get('subMembers', []):
                    uid = sub.get('uid')
                    username = sub.get('username', str(uid))
                    sub_bal = {}
                    
                    coins = 'BTC,ETH,USDT,USDC,USDE,XRP,SOL,DOGE,ADA,AVAX'
                    sub_wallet = bybit_req('/v5/asset/transfer/query-account-coins-balance', 
                                          {'accountType': 'UNIFIED', 'memberId': uid, 'coin': coins})
                    if sub_wallet.get('retCode') == 0:
                        for c in sub_wallet.get('result', {}).get('balance', []):
                            total = float(c.get('walletBalance', 0))
                            if total > 0:
                                sub_bal[c['coin']] = total
                    
                    if sub_bal:
                        result['subaccounts'][username] = sub_bal
                        for ccy, amt in sub_bal.items():
                            result['total'][ccy] = result['total'].get(ccy, 0) + amt
        except Exception as e:
            print(f"Bybit subaccount error: {e}")
    
    return result


# ============ OKX ============
def fetch_okx():
    api_key = os.environ['OKX_API_KEY']
    api_secret = os.environ['OKX_API_SECRET']
    passphrase = os.environ['OKX_PASSPHRASE']
    
    result = {'master': {}, 'subaccounts': {}, 'total': {}, 'usd_values': {}}
    
    def okx_req(endpoint):
        timestamp = datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%S.') + f'{datetime.utcnow().microsecond // 1000:03d}Z'
        sign_str = timestamp + 'GET' + endpoint
        signature = base64.b64encode(hmac.new(api_secret.encode(), sign_str.encode(), hashlib.sha256).digest()).decode()
        
        headers = {
            'OK-ACCESS-KEY': api_key,
            'OK-ACCESS-SIGN': signature,
            'OK-ACCESS-TIMESTAMP': timestamp,
            'OK-ACCESS-PASSPHRASE': passphrase
        }
        return http_request(f'https://www.okx.com{endpoint}', headers)
    
    # Master
    data = okx_req('/api/v5/account/balance')
    if data.get('code') == '0':
        for detail in data.get('data', [{}])[0].get('details', []):
            total = float(detail.get('cashBal', 0))
            eq_usd = float(detail.get('eqUsd', 0))
            if total > 0:
                ccy = detail['ccy']
                result['master'][ccy] = total
                result['total'][ccy] = total
                if eq_usd > 0:
                    result['usd_values'][ccy] = eq_usd
    
    # Subaccounts
    try:
        subs = okx_req('/api/v5/users/subaccount/list')
        if subs.get('code') == '0':
            for sub in subs.get('data', []):
                sub_name = sub.get('subAcct')
                try:
                    sub_data = okx_req(f'/api/v5/account/subaccount/balances?subAcct={sub_name}')
                    if sub_data.get('code') == '0':
                        sub_bal = {}
                        sub_usd = {}
                        for d in sub_data.get('data', [{}])[0].get('details', []):
                            total = float(d.get('cashBal', 0))
                            eq_usd = float(d.get('eqUsd', 0))
                            if total > 0:
                                ccy = d['ccy']
                                sub_bal[ccy] = total
                                result['total'][ccy] = result['total'].get(ccy, 0) + total
                                if eq_usd > 0:
                                    sub_usd[ccy] = eq_usd
                                    result['usd_values'][ccy] = result['usd_values'].get(ccy, 0) + eq_usd
                                print(f"OKX {sub_name} {ccy}: {total} (${eq_usd:.2f})")
                        if sub_bal:
                            result['subaccounts'][sub_name] = sub_bal
                            result['subaccounts_usd_direct'] = result.get('subaccounts_usd_direct', {})
                            result['subaccounts_usd_direct'][sub_name] = sub_usd
                except Exception as e:
                    print(f"OKX subaccount {sub_name} error: {e}")
    except Exception as e:
        print(f"OKX subaccount list error: {e}")
    
    return result


# ============ KUCOIN ============
def fetch_kucoin():
    api_key = os.environ['KUCOIN_API_KEY']
    api_secret = os.environ['KUCOIN_API_SECRET']
    passphrase = os.environ['KUCOIN_PASSPHRASE']
    
    result = {'master': {}, 'subaccounts': {}, 'total': {}}
    
    def kucoin_req(endpoint):
        timestamp = str(int(time.time() * 1000))
        sign_str = timestamp + 'GET' + endpoint
        signature = base64.b64encode(hmac.new(api_secret.encode(), sign_str.encode(), hashlib.sha256).digest()).decode()
        pass_hash = base64.b64encode(hmac.new(api_secret.encode(), passphrase.encode(), hashlib.sha256).digest()).decode()
        
        headers = {
            'KC-API-KEY': api_key,
            'KC-API-SIGN': signature,
            'KC-API-TIMESTAMP': timestamp,
            'KC-API-PASSPHRASE': pass_hash,
            'KC-API-KEY-VERSION': '2'
        }
        return http_request(f'https://api.kucoin.com{endpoint}', headers)
    
    # Master
    data = kucoin_req('/api/v1/accounts')
    if data.get('code') == '200000':
        balances = {}
        for acc in data.get('data', []):
            total = float(acc.get('balance', 0))
            if total > 0:
                ccy = acc['currency']
                balances[ccy] = balances.get(ccy, 0) + total
        result['master'] = balances
        result['total'] = balances.copy()
    
    # Subaccounts
    try:
        subs = kucoin_req('/api/v2/sub/user')
        if subs.get('code') == '200000':
            for sub in subs.get('data', []):
                uid = sub.get('userId')
                name = sub.get('subName', uid)
                try:
                    sub_data = kucoin_req(f'/api/v1/sub-accounts/{uid}')
                    if sub_data.get('code') == '200000':
                        sub_bal = {}
                        for acc_type in ['mainAccounts', 'tradeAccounts', 'marginAccounts']:
                            for acc in sub_data.get('data', {}).get(acc_type, []):
                                total = float(acc.get('balance', 0))
                                if total > 0:
                                    ccy = acc['currency']
                                    sub_bal[ccy] = sub_bal.get(ccy, 0) + total
                                    result['total'][ccy] = result['total'].get(ccy, 0) + total
                        if sub_bal:
                            result['subaccounts'][name] = sub_bal
                except:
                    pass
    except:
        pass
    
    return result


# ============ KRAKEN ============
def fetch_kraken():
    api_key = os.environ['KRAKEN_API_KEY']
    api_secret = os.environ['KRAKEN_API_SECRET']
    
    result = {'master': {}, 'subaccounts': {}, 'total': {}}
    
    path = '/0/private/Balance'
    nonce = str(int(time.time() * 1000))
    post_data = f'nonce={nonce}'
    
    message = (nonce + post_data).encode()
    sha256_hash = hashlib.sha256(message).digest()
    hmac_data = path.encode() + sha256_hash
    signature = base64.b64encode(hmac.new(base64.b64decode(api_secret), hmac_data, hashlib.sha512).digest()).decode()
    
    headers = {
        'API-Key': api_key,
        'API-Sign': signature,
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    req = urllib.request.Request(f'https://api.kraken.com{path}', headers=headers, method='POST')
    req.data = post_data.encode()
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read().decode())
    
    if not data.get('error'):
        for ccy, bal in data.get('result', {}).items():
            total = float(bal)
            if total > 0:
                clean_ccy = ccy[1:] if ccy.startswith(('X', 'Z')) and len(ccy) == 4 else ccy
                result['master'][clean_ccy] = total
                result['total'][clean_ccy] = total
    
    return result


# ============ ZOOMEX ============
def fetch_zoomex():
    api_key = os.environ['ZOOMEX_API_KEY']
    api_secret = os.environ['ZOOMEX_API_SECRET']
    
    result = {'master': {}, 'subaccounts': {}, 'total': {}}
    
    timestamp = str(int(time.time() * 1000))
    recv_window = '5000'
    query = 'accountType=UNIFIED'
    sign_str = f"{timestamp}{api_key}{recv_window}{query}"
    signature = hmac.new(api_secret.encode(), sign_str.encode(), hashlib.sha256).hexdigest()
    
    headers = {
        'X-BAPI-API-KEY': api_key,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recv_window,
        'X-BAPI-SIGN': signature
    }
    
    data = http_request(f'https://openapi.zoomex.com/cloud/trade/v3/account/wallet-balance?{query}', headers)
    
    if data.get('retCode') == 0:
        acc = data.get('result', {}).get('list', [{}])[0]
        print(f"Zoomex totalEquity: {acc.get('totalEquity')}")
        print(f"Zoomex totalWalletBalance: {acc.get('totalWalletBalance')}")
        print(f"Zoomex totalPerpUPL: {acc.get('totalPerpUPL')}")
        
        result['upnl'] = {}
        for coin in acc.get('coin', []):
            # equity = walletBalance + unrealizedPnl
            equity = float(coin.get('equity', 0))
            wallet = float(coin.get('walletBalance', 0))
            upl = float(coin.get('unrealisedPnl', 0))
            if equity != 0 or wallet != 0:
                print(f"  Zoomex {coin['coin']}: equity={equity}, wallet={wallet}, upl={upl}")
                final_val = equity if equity != 0 else wallet
                result['master'][coin['coin']] = final_val
                result['total'][coin['coin']] = final_val
                # uPnL 분리 저장
                if upl != 0:
                    result['upnl'][coin['coin']] = upl
    
    return result


# ============ HTX ============
def fetch_htx():
    api_key = os.environ.get('HTX_API_KEY', '')
    api_secret = os.environ.get('HTX_API_SECRET', '')
    
    if not api_key or not api_secret:
        return {'master': {}, 'subaccounts': {}, 'total': {}}
    
    result = {'master': {}, 'subaccounts': {}, 'total': {}}
    
    def htx_req(method, endpoint, params=None):
        timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S')
        params = params or {}
        params.update({
            'AccessKeyId': api_key,
            'SignatureMethod': 'HmacSHA256',
            'SignatureVersion': '2',
            'Timestamp': timestamp
        })
        
        # Sort params and create query string
        sorted_params = sorted(params.items())
        query_string = urllib.parse.urlencode(sorted_params)
        
        # Create signature
        sign_str = f"{method}\napi.huobi.pro\n{endpoint}\n{query_string}"
        signature = base64.b64encode(
            hmac.new(api_secret.encode(), sign_str.encode(), hashlib.sha256).digest()
        ).decode()
        
        # URL encode signature
        params['Signature'] = signature
        url = f"https://api.huobi.pro{endpoint}?{urllib.parse.urlencode(params)}"
        
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read().decode())
    
    # Step 1: Get all accounts
    try:
        accounts_data = htx_req('GET', '/v1/account/accounts')
        if accounts_data.get('status') == 'ok':
            for acc in accounts_data.get('data', []):
                acc_id = acc['id']
                acc_type = acc['type']  # spot, margin, otc, point, super-margin, etc
                
                # Step 2: Get balance for each account
                try:
                    bal_data = htx_req('GET', f'/v1/account/accounts/{acc_id}/balance')
                    if bal_data.get('status') == 'ok':
                        for item in bal_data.get('data', {}).get('list', []):
                            balance = float(item.get('balance', 0))
                            if balance > 0:
                                ccy = item['currency'].upper()
                                bal_type = item['type']  # trade, frozen
                                
                                if acc_type == 'spot':
                                    result['master'][ccy] = result['master'].get(ccy, 0) + balance
                                    result['total'][ccy] = result['total'].get(ccy, 0) + balance
                                    print(f"HTX spot {ccy}: {balance} ({bal_type})")
                                else:
                                    # margin, super-margin 등은 별도 키로
                                    key = f"{ccy}_{acc_type.upper().replace('-', '_')}"
                                    result['master'][key] = result['master'].get(key, 0) + balance
                                    result['total'][key] = result['total'].get(key, 0) + balance
                                    print(f"HTX {acc_type} {ccy}: {balance}")
                except Exception as e:
                    print(f"HTX account {acc_id} balance error: {e}")
    except Exception as e:
        print(f"HTX accounts error: {e}")
    
    return result
