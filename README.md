# Gravity Flip Runner

重力反転で障害物を回避するランアクションゲームです。

https://spaceship.grottaazzura2023.workers.dev/
## Frontend (Vite)

### ローカル起動

```bash
npm install
npm run dev
```

### ビルド

```bash
npm run build
```

## 世界ランキング API (Cloudflare Workers + D1)

このリポジトリには `workers/leaderboard` に最小構成のランキング API が含まれています。

### 1. D1 データベースを作成

```bash
cd workers/leaderboard
npm install
npx wrangler d1 create gravity_flip_leaderboard
```

出力される `database_id` を `workers/leaderboard/wrangler.toml` の
`REPLACE_WITH_YOUR_D1_DATABASE_ID` に貼り付けてください。

### 2. スキーマ適用

```bash
npx wrangler d1 execute gravity_flip_leaderboard --remote --file=./sql/schema.sql
```

### 3. Worker デプロイ

```bash
npx wrangler deploy
```

デプロイ後に `https://<your-worker>.workers.dev` が発行されます。

### 4. フロント側設定

`src/config.ts` の `ranking` を次のように設定します。

- `useGlobalApi: true`
- `apiBaseUrl: "https://<your-worker>.workers.dev"`
- `fetchPath: "/api/leaderboard"`
- `submitPath: "/api/leaderboard/submit"`

これでゲーム開始時に入力したプレイヤー名で、世界ランキングを取得/送信します。

## API 仕様

- `GET /api/leaderboard?limit=10`
	- 返却: `[{ name, score, achievedAt }]`
- `POST /api/leaderboard/submit`
	- body: `{ "name": "AAA", "score": 1234 }`

## 注意点

- 現在の API は最小構成のため、厳密な不正対策は未実装です。
- 本番運用では、レート制限や簡易署名などを追加してください。
