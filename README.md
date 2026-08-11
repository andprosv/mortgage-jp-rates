# mortgage-jp-rates

Скрапер住宅ローン金利 → `rates.json`, обновляется GitHub Actions cron (2×/день). Приложение fetch'ит raw-URL.

## Настройка (один раз)
1. Создать публичный репозиторий (напр. `mortgage-jp-rates`), запушить эту папку.
2. Settings → Actions → General → Workflow permissions → **Read and write**.
3. Actions → «Update mortgage rates» → **Run workflow** (проверить первый прогон).
4. В приложении `RatesStore.remoteURL` = `https://raw.githubusercontent.com/<user>/mortgage-jp-rates/main/rates.json`.
5. Affiliate: завести A8.net/バリューコマース, вписать реф-ссылки в `AFF` в `fetch_rates.mjs`.

## Локально
`npm i playwright && npx playwright install chromium && node fetch_rates.mjs`

## Добавить банк
Строка в `BANKS` (`fetch_rates.mjs`): `['id','表示名','URL страницы со ставкой']`. Экстрактор ищет `変動金利` → ближайшую ставку 0.15–1.7%. JS-страницы рендерятся Playwright. Провал банка → сохраняется прошлое значение (`stale:true`).

⚠️ Скрейп хрупкий: вёрстка банков меняется → селекторы ломаются, требуется периодическая правка. Ставки — «参考値», в приложении дисклеймер.
