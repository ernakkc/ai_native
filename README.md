# AI Native

Small local AI assistant that bridges Telegram to local AI services.

## Quick start

1. Copy `.env.example` to `.env` and set `TELEGRAM_API_KEY` and other vars.

```
cp .env.example .env
# edit .env
```

2. Install dependencies and start:

```bash
npm install
npm start
```

3. Run only Telegram interface:

```bash
npm run telegram
```

## Project layout

- `index.js` — app entry
- `src/interfaces/telegram` — Telegram bot
- `src/brain` — AI orchestration
- `src/bridges` — bridges between interfaces and brain
- `data/logs` — runtime logs (ignored by git)

## Environment
Store secrets in `.env`. Example in `.env.example`.

## CI
A basic GitHub Actions workflow is included to run `npm test` and `npm run telegram` build checks.

## License
MIT
