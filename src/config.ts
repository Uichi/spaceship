export const GAME_CONFIG = {
  // [FIELD] プレイエリアの境界設定
  world: {
    // [COLLISION] 上下の当たり判定ライン。上げると通れる高さが狭くなる。
    border: 24,
  },

  // [PLAYER] プレイヤー初期位置と当たり判定サイズ
  player: {
    // [SPAWN] 初期X位置の比率。大きいほど右寄りに開始。
    startXRatio: 0.2,
    // [SPAWN] 初期Y位置の比率。0に近いほど上、1に近いほど下。
    startYRatio: 0.5,
    // [HITBOX] 幅。大きいほど障害物に当たりやすい。
    width: 34,
    // [HITBOX] 高さ。大きいほど障害物に当たりやすい。
    height: 34,

    // [SPRITE] イラスト描画設定（当たり判定とは別に見た目だけを調整）
    sprite: {
      // [SPRITE] trueで画像描画。falseで四角形フォールバック。
      enabled: true,
      // [SPRITE] 描画幅。大きいほど見た目が大きくなる。
      renderWidth: 56,
      // [SPRITE] 描画高さ。大きいほど見た目が大きくなる。
      renderHeight: 56,
      // [SPRITE] X方向オフセット。見た目と当たり判定の位置合わせ用。
      offsetX: -11,
      // [SPRITE] Y方向オフセット。見た目と当たり判定の位置合わせ用。
      offsetY: -11,
      // [SPRITE] 速度による傾き係数。大きいほど機体が傾きやすい。
      tiltByVelocity: 0.0015,
      // [SPRITE] 傾きの最大角度（rad）。
      maxTiltRad: 0.45,
      // [SPRITE] 重力反転時に上下反転して描画する。falseで常に正立表示。
      flipWithGravity: false,
    },
  },

  // [PHYSICS] 重力反転の手触り
  physics: {
    // [FALL_SPEED] 落下/上昇の加速度。大きいほど縦移動が速い。
    gravityMagnitude: 500,
    // [FLIP_KICK] 反転直後の押し出し量。大きいほど反転が強くなる。
    flipBoost: 180,
    // [INERTIA] 反転時の速度保持率。1に近いほど慣性が残る。
    flipVelocityDamping: 0.1,
    // [STABILITY] 1フレームの最大時間。小さいほど低FPS時の挙動が安定。
    maxDeltaTime: 0.033,
  },

  // [OBSTACLE] 障害物の生成ルール
  obstacle: {
    // [SPAWN_RATE] タイトル復帰時の初期間隔。大きいほど障害物が少ない。
    startInterval: 1.25,
    // [SPAWN_RATE] プレイ開始直後の間隔。大きいほど序盤が易しい。
    initialPlayingInterval: 1.9,
    // [SPAWN_RATE] 最短間隔。小さいほど終盤が高密度になる。
    minInterval: 0.6,
    // [DIFFICULTY_RAMP] 時間経過で間隔を縮める速さ。大きいほど急に難化。
    intervalRamp: 0.03,
    // [DIFFICULTY_RAMP] 間隔短縮の起点値。
    baseIntervalForRamp: 1.15,

    // [SIZE] 障害物の最小幅。
    minWidth: 48,
    // [SIZE] 幅のランダム増分。大きいほど幅のばらつきが増える。
    widthVariance: 42,
    // [GAP] 上下の通路幅。大きいほど通りやすい。
    gap: 180,
    // [GAP] 通路生成時の上下余白。大きいほど極端な配置を避ける。
    edgeMargin: 36,
    // [GAP] 連続する柱の穴中心の最大移動量（低速時）。
    maxGapCenterShiftBase: 90,
    // [GAP] 高速時でも保証する最小の最大移動量。
    maxGapCenterShiftMin: 80,
    // [GAP] trueで速度に応じて穴の移動量制限を厳しくする。
    useSpeedScaledGapShift: true,
    // [LIFECYCLE] 画面外に出た障害物を削除する閾値。
    offscreenThreshold: -8,

    // [TYPE_MIX] 移動障害物を生成する確率（0-1）。
    movingSpawnChance: 0.35,
    // [TYPE_MIX] 移動障害物の幅。
    movingWidth: 44,
    // [TYPE_MIX] 移動障害物の高さ。
    movingHeight: 44,
    // [TYPE_MIX] 画面端からの最小余白。
    movingEdgeMargin: 46,
    // [TYPE_MIX] 上下揺れ幅の最小値。
    movingAmplitudeMin: 30,
    // [TYPE_MIX] 上下揺れ幅の最大値。
    movingAmplitudeMax: 90,
    // [TYPE_MIX] 揺れ速度（rad/s）の最小値。
    movingAngularSpeedMin: 2.2,
    // [TYPE_MIX] 揺れ速度（rad/s）の最大値。
    movingAngularSpeedMax: 3.8,
  },

  // [PROGRESSION] スクロール速度の難易度曲線
  progression: {
    // [SPEED] 開始時の横スクロール速度。
    baseSpeed: 300,
    // [SPEED] 時間経過による速度上昇率。大きいほど早く難しくなる。
    speedRamp: 0.1,
    // [SPEED] 最高速度の上限。
    maxSpeed: 400,
  },

  // [SCORING] スコア計算
  scoring: {
    // [SCORE_RATE] 1秒あたりの加点。大きいほどスコアが伸びやすい。
    pointsPerSecond: 100,
  },

  // [EFFECT] 演出設定（ゲーム性には影響しない）
  effect: {
    // [PARTICLE] 衝突時に生成するパーティクル数。
    crashParticleCount: 22,
    // [PARTICLE] 初速の最小値。
    crashParticleMinSpeed: 80,
    // [PARTICLE] 初速の最大値。
    crashParticleMaxSpeed: 300,
    // [PARTICLE] 生存時間（秒）。
    crashParticleLife: 0.7,
    // [PARTICLE] 粒サイズの最小値。
    crashParticleMinSize: 2,
    // [PARTICLE] 粒サイズの最大値。
    crashParticleMaxSize: 6,
    // [PARTICLE] 粒にかかる重力。
    crashParticleGravity: 280,
    // [PARTICLE] 粒の減衰（1秒でどれだけ速度を失うか）。
    crashParticleDamping: 2.6,
  },

  // [RANKING] ランキング保存設定
  ranking: {
    // [RANKING] trueでサーバーランキングを使用。falseでローカル保存のみ。
    useGlobalApi: true,
    // [RANKING] APIのベースURL（例: https://example.workers.dev）。
    apiBaseUrl: "https://gravity-flip-leaderboard.grottaazzura2023.workers.dev",
    // [RANKING] ランキング取得エンドポイント。
    fetchPath: "/api/leaderboard",
    // [RANKING] スコア送信エンドポイント。
    submitPath: "/api/leaderboard/submit",
    // [RANKING] 取得・送信のタイムアウト(ms)。
    requestTimeoutMs: 3000,
  },
} as const;
