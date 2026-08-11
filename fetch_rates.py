#!/usr/bin/env python3
# Скрапер ставок住宅ローン → rates.json. Запуск: GitHub Actions cron.
# Каждый банк независим: при неудаче сохраняем последнее известное значение (graceful degradation).
import re, json, sys, os, datetime, urllib.request

UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "rates.json")

# id, 表示名, URL, affiliate-URL(заглушка =公式), 変動 extract hint
BANKS = [
    ("aeon",   "イオン銀行",        "https://www.aeonbank.co.jp/housing_loan/"),
    ("jibun",  "auじぶん銀行",       "https://www.jibunbank.co.jp/products/homeloan/"),
    ("paypay", "PayPay銀行",        "https://www.paypay-bank.co.jp/mortgage/index.html"),
    ("sonybank","ソニー銀行",       "https://moneykit.net/visitor/hl/"),
    ("mufg",   "三菱UFJ銀行",       "https://www.bk.mufg.jp/kariru/jutaku/index.html"),
    ("mizuho", "みずほ銀行",        "https://www.mizuhobank.co.jp/retail/products/loan/housing/index.html"),
    ("rakuten","楽天銀行",          "https://www.rakuten-bank.co.jp/home-loan/rate/"),
]

def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "ignore")

def plain(html):
    t = re.sub(r"<[^>]+>", " ", html); return re.sub(r"\s+", " ", t)

def extract_variable(t):
    # ищем 変動金利 → ближайшую ставку 0.2–1.6% в следующих ~140 символах
    for m in re.finditer("変動金利", t):
        seg = t[m.end(): m.end()+140]
        for rm in re.finditer(r"([01]\.[0-9]{2,3})\s*[%％]", seg):
            v = float(rm.group(1))
            if 0.15 <= v <= 1.7:
                dm = re.search(r"(20\d\d)\s*年\s*(\d{1,2})\s*月", seg)
                date = f"{dm.group(1)}-{int(dm.group(2)):02d}" if dm else None
                return v, date
    return None, None

def load_prev():
    try: return json.load(open(OUT, encoding="utf-8"))
    except: return {"banks": []}

prev = {b["id"]: b for b in load_prev().get("banks", [])}
out_banks, log = [], []
for bid, name, url in BANKS:
    var, date = None, None
    try:
        var, date = extract_variable(plain(fetch(url)))
    except Exception as e:
        log.append(f"{bid}: fetch error {e}")
    if var is None and bid in prev:   # graceful: keep last-known
        b = prev[bid]; b["stale"] = True; out_banks.append(b); log.append(f"{bid}: KEEP {b.get('variable')} (stale)"); continue
    if var is None:
        log.append(f"{bid}: no rate, skip"); continue
    out_banks.append({"id": bid, "name": name, "variable": var, "asof": date,
                      "url": url, "stale": False})
    log.append(f"{bid}: {var}% ({date})")

data = {"updated": datetime.datetime.utcnow().replace(microsecond=0).isoformat()+"Z",
        "note": "参考値。最新・正確な金利は各金融機関の公式サイトでご確認ください。",
        "banks": out_banks}
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("\n".join(log)); print("→", len(out_banks), "banks written")
