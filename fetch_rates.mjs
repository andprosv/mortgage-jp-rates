// Скрапер住宅ローン金利 через Playwright (рендер JS) → rates.json.
// Каждый банк независим; при неудаче сохраняем последнее известное (graceful degradation).
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'rates.json');

const BANKS = [
  ['aeon','イオン銀行','https://www.aeonbank.co.jp/housing_loan/'],
  ['jibun','auじぶん銀行','https://www.jibunbank.co.jp/products/homeloan/'],
  ['paypay','PayPay銀行','https://www.paypay-bank.co.jp/mortgage/index.html'],
];

function nearRate(txt, kw, lo=0.15, hi=1.7){
  const i = txt.indexOf(kw); if(i<0) return [null,null];
  const seg = txt.slice(i, i+160);
  const rm = seg.match(/([01]\.[0-9]{2,3})\s*[%％]/);
  if(!rm) return [null,null];
  const v = parseFloat(rm[1]); if(v<lo||v>hi) return [null,null];
  const dm = seg.match(/(20\d\d)\s*年\s*(\d{1,2})\s*月/);
  return [v, dm ? `${dm[1]}-${String(+dm[2]).padStart(2,'0')}` : null];
}

// ⚠️ Affiliate: подставь сюда реф-ссылки (A8.net/バリューコマース) по id банка; пусто = официальный сайт.
const AFF = { aeon:'', jibun:'', paypay:'' };
let prev={banks:[]}; try{prev=JSON.parse(fs.readFileSync(OUT,'utf8'));}catch{}
const prevMap=Object.fromEntries((prev.banks||[]).map(b=>[b.id,b]));
const browser = await chromium.launch();
const ctx = await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36'});
const out=[], log=[];
for(const [id,name,url] of BANKS){
  let v=null,d=null;
  try{
    const page=await ctx.newPage();
    await page.goto(url,{waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForTimeout(2500);
    const txt=await page.evaluate(()=>document.body.innerText);
    [v,d]=nearRate(txt,'変動金利');
    await page.close();
  }catch(e){ log.push(`${id}: err ${e.message.slice(0,50)}`); }
  if(v==null && prevMap[id]){ const b={...prevMap[id],stale:true}; out.push(b); log.push(`${id}: KEEP ${b.variable} (stale)`); continue; }
  if(v==null){ log.push(`${id}: no rate`); continue; }
  out.push({id,name,variable:v,asof:d,url:(AFF[id]||url),stale:false}); log.push(`${id}: ${v}% (${d})`);
}
// フラット35 — ARUHI
let flat35 = prev.flat35 ?? 1.84;
try{
  const page=await ctx.newPage();
  await page.goto('https://www.aruhi-corp.co.jp/flat35/rate/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.waitForTimeout(2500);
  const txt=await page.evaluate(()=>document.body.innerText);
  const m=txt.match(/([12]\.[0-9]{2,3})\s*[%％]/); if(m) flat35=parseFloat(m[1]);
  log.push('flat35(ARUHI): '+flat35); await page.close();
}catch(e){ log.push('flat35 err '+e.message.slice(0,40)); }
await browser.close();
const data={updated:new Date().toISOString().replace(/\.\d+Z$/,'Z'),
  note:'参考値。最新・正確な金利は各金融機関の公式サイトでご確認ください。', flat35, banks:out};
fs.writeFileSync(OUT, JSON.stringify(data,null,1));
console.log(log.join('\n')); console.log('→',out.length,'banks, flat35',flat35);
