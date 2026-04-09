import "./style.css";
import { GAME_CONFIG } from "./config";
import playerShipSpriteUrl from "./assets/player-ship-placeholder.svg";

type GameState = "Title" | "Playing" | "GameOver";

type PillarObstacle = {
  kind: "pillar";
  x: number;
  width: number;
  topHeight: number;
  bottomY: number;
  passed: boolean;
};

type MovingObstacle = {
  kind: "moving";
  x: number;
  y: number;
  width: number;
  height: number;
  baseY: number;
  amplitude: number;
  phase: number;
  angularSpeed: number;
  passed: boolean;
};

type Obstacle = PillarObstacle | MovingObstacle;

type Player = {
  x: number;
  y: number;
  width: number;
  height: number;
  velocityY: number;
};

type CrashParticle = {
  x: number;
  y: number;
  velocityX: number;
  velocityY: number;
  life: number;
  maxLife: number;
  size: number;
};

type RankingEntry = {
  name: string;
  score: number;
  achievedAt: number;
};

const canvas = document.getElementById("game") as HTMLCanvasElement;
const maybeCtx = canvas.getContext("2d");

if (!maybeCtx) {
  throw new Error("2D context を初期化できませんでした");
}

const ctx: CanvasRenderingContext2D = maybeCtx;

const W = canvas.width;
const H = canvas.height;

const BORDER = GAME_CONFIG.world.border;

const player: Player = {
  x: W * GAME_CONFIG.player.startXRatio,
  y: H * GAME_CONFIG.player.startYRatio,
  width: GAME_CONFIG.player.width,
  height: GAME_CONFIG.player.height,
  velocityY: 0,
};

let state: GameState = "Title";
let gravity: number = GAME_CONFIG.physics.gravityMagnitude;

let obstacles: Obstacle[] = [];
let obstacleTimer = 0;
let obstacleInterval: number = GAME_CONFIG.obstacle.startInterval;

let speed: number = GAME_CONFIG.progression.baseSpeed;

let score = 0;
let bestScore = 0;
let survivedTime = 0;
let lastTimestamp = 0;
let crashParticles: CrashParticle[] = [];
let lastPillarGapCenterY: number | null = null;

const BEST_SCORE_STORAGE_KEY = "gravity-flip-runner.best-score";
const LEADERBOARD_STORAGE_KEY = "gravity-flip-runner.leaderboard";
const PLAYER_NAME_STORAGE_KEY = "gravity-flip-runner.player-name";
const LEADERBOARD_MAX_ENTRIES = 10;
const DEFAULT_PLAYER_NAME = "PLAYER";
const PLAYER_NAME_MAX_LENGTH = 12;

const playerSprite = new Image();
let isPlayerSpriteLoaded = false;
let leaderboard: RankingEntry[] = [];
let currentPlayerName = DEFAULT_PLAYER_NAME;
let hasAskedPlayerNameThisSession = false;

const pressed = new Set<string>();

playerSprite.src = playerShipSpriteUrl;
playerSprite.onload = () => {
  isPlayerSpriteLoaded = true;
};
playerSprite.onerror = () => {
  isPlayerSpriteLoaded = false;
};

function loadBestScore(): number {
  try {
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    if (raw === null) {
      return 0;
    }

    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 0;
    }

    return parsed;
  } catch {
    return 0;
  }
}

function saveBestScore(nextBestScore: number): void {
  try {
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(nextBestScore));
  } catch {
    // Ignore storage errors (private mode/quota) and continue the game.
  }
}

function normalizePlayerName(raw: string | null | undefined): string {
  if (typeof raw !== "string") {
    return DEFAULT_PLAYER_NAME;
  }

  const normalized = raw.trim().slice(0, PLAYER_NAME_MAX_LENGTH);
  return normalized.length > 0 ? normalized : DEFAULT_PLAYER_NAME;
}

function loadPlayerName(): string {
  try {
    const raw = window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY);
    return normalizePlayerName(raw);
  } catch {
    return "PLAYER";
  }
}

function savePlayerName(name: string): void {
  try {
    window.localStorage.setItem(PLAYER_NAME_STORAGE_KEY, normalizePlayerName(name));
  } catch {
    // Ignore storage errors and keep game running.
  }
}

function hasStoredPlayerName(): boolean {
  try {
    return window.localStorage.getItem(PLAYER_NAME_STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

function askPlayerName(): void {
  const initial = currentPlayerName === DEFAULT_PLAYER_NAME ? "" : currentPlayerName;
  const askedName = window.prompt("プレイヤー名を入力してください", initial);
  currentPlayerName = normalizePlayerName(askedName);
  savePlayerName(currentPlayerName);
}

function ensurePlayerNameOnFirstStart(): void {
  if (hasAskedPlayerNameThisSession) {
    return;
  }

  hasAskedPlayerNameThisSession = true;
  if (!hasStoredPlayerName()) {
    askPlayerName();
  }
}

function loadLeaderboard(): RankingEntry[] {
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_STORAGE_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const safeEntries = parsed
      .filter((item): item is Partial<RankingEntry> => typeof item === "object" && item !== null)
      .map((item) => {
        const scoreValue = typeof item.score === "number" && Number.isFinite(item.score) ? item.score : 0;
        const achievedAtValue =
          typeof item.achievedAt === "number" && Number.isFinite(item.achievedAt)
            ? item.achievedAt
            : Date.now();

        return {
          name: normalizePlayerName(item.name),
          score: Math.max(0, Math.floor(scoreValue)),
          achievedAt: Math.floor(achievedAtValue),
        };
      })
      .sort((a, b) => b.score - a.score || a.achievedAt - b.achievedAt)
      .slice(0, LEADERBOARD_MAX_ENTRIES);

    return safeEntries;
  } catch {
    return [];
  }
}

function saveLeaderboard(entries: RankingEntry[]): void {
  try {
    window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Ignore storage errors and keep game running.
  }
}

function tryRecordRanking(currentScore: number): void {
  if (currentScore <= 0) {
    return;
  }

  const qualifies =
    leaderboard.length < LEADERBOARD_MAX_ENTRIES ||
    currentScore > leaderboard[leaderboard.length - 1].score;

  if (!qualifies) {
    return;
  }

  leaderboard = [
    ...leaderboard,
    {
      name: currentPlayerName,
      score: currentScore,
      achievedAt: Date.now(),
    },
  ]
    .sort((a, b) => b.score - a.score || a.achievedAt - b.achievedAt)
    .slice(0, LEADERBOARD_MAX_ENTRIES);

  saveLeaderboard(leaderboard);
  void submitScoreToGlobalLeaderboard(currentPlayerName, currentScore);
}

function isGlobalRankingEnabled(): boolean {
  const cfg = GAME_CONFIG.ranking;
  return cfg.useGlobalApi && cfg.apiBaseUrl.trim().length > 0;
}

function buildApiUrl(path: string): string {
  const baseUrl = GAME_CONFIG.ranking.apiBaseUrl.replace(/\/$/, "");
  return `${baseUrl}${path}`;
}

function withTimeoutSignal(timeoutMs: number): AbortController {
  const controller = new AbortController();
  window.setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

function sanitizeRankingEntries(entries: unknown[]): RankingEntry[] {
  return entries
    .filter((item): item is Partial<RankingEntry> => typeof item === "object" && item !== null)
    .map((item) => {
      const scoreValue = typeof item.score === "number" && Number.isFinite(item.score) ? item.score : 0;
      const achievedAtValue =
        typeof item.achievedAt === "number" && Number.isFinite(item.achievedAt)
          ? item.achievedAt
          : Date.now();

      return {
        name: normalizePlayerName(item.name),
        score: Math.max(0, Math.floor(scoreValue)),
        achievedAt: Math.floor(achievedAtValue),
      };
    })
    .sort((a, b) => b.score - a.score || a.achievedAt - b.achievedAt)
    .slice(0, LEADERBOARD_MAX_ENTRIES);
}

async function fetchGlobalLeaderboard(): Promise<void> {
  if (!isGlobalRankingEnabled()) {
    return;
  }

  try {
    const controller = withTimeoutSignal(GAME_CONFIG.ranking.requestTimeoutMs);
    const response = await fetch(buildApiUrl(GAME_CONFIG.ranking.fetchPath), {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      return;
    }

    const parsed = (await response.json()) as unknown;
    if (!Array.isArray(parsed)) {
      return;
    }

    leaderboard = sanitizeRankingEntries(parsed);
    saveLeaderboard(leaderboard);
  } catch {
    // Keep local ranking as fallback when network is unavailable.
  }
}

async function submitScoreToGlobalLeaderboard(name: string, scoreValue: number): Promise<void> {
  if (!isGlobalRankingEnabled()) {
    return;
  }

  try {
    const controller = withTimeoutSignal(GAME_CONFIG.ranking.requestTimeoutMs);
    const response = await fetch(buildApiUrl(GAME_CONFIG.ranking.submitPath), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: normalizePlayerName(name),
        score: Math.max(0, Math.floor(scoreValue)),
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return;
    }

    await fetchGlobalLeaderboard();
  } catch {
    // Keep local ranking as fallback when network is unavailable.
  }
}

function resetGame(): void {
  state = "Title";
  gravity = GAME_CONFIG.physics.gravityMagnitude;
  player.y = H * GAME_CONFIG.player.startYRatio;
  player.velocityY = 0;
  obstacles = [];
  obstacleTimer = 0;
  obstacleInterval = GAME_CONFIG.obstacle.startInterval;
  speed = GAME_CONFIG.progression.baseSpeed;
  score = 0;
  survivedTime = 0;
  crashParticles = [];
  lastPillarGapCenterY = player.y + player.height / 2;
}

function startGame(): void {
  state = "Playing";
  gravity = GAME_CONFIG.physics.gravityMagnitude;
  player.y = H * GAME_CONFIG.player.startYRatio;
  player.velocityY = 0;
  obstacles = [];
  obstacleTimer = 0;
  obstacleInterval = GAME_CONFIG.obstacle.initialPlayingInterval;
  speed = GAME_CONFIG.progression.baseSpeed;
  score = 0;
  survivedTime = 0;
  crashParticles = [];
  lastPillarGapCenterY = player.y + player.height / 2;
}

function flipGravity(): void {
  gravity = -gravity;
  player.velocityY = -player.velocityY * GAME_CONFIG.physics.flipVelocityDamping;
  player.velocityY += gravity > 0 ? -GAME_CONFIG.physics.flipBoost : GAME_CONFIG.physics.flipBoost;
}

function spawnCrashParticles(x: number, y: number): void {
  const cfg = GAME_CONFIG.effect;

  for (let i = 0; i < cfg.crashParticleCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = cfg.crashParticleMinSpeed + Math.random() * (cfg.crashParticleMaxSpeed - cfg.crashParticleMinSpeed);
    const size = cfg.crashParticleMinSize + Math.random() * (cfg.crashParticleMaxSize - cfg.crashParticleMinSize);

    crashParticles.push({
      x,
      y,
      velocityX: Math.cos(angle) * speed,
      velocityY: Math.sin(angle) * speed,
      life: cfg.crashParticleLife,
      maxLife: cfg.crashParticleLife,
      size,
    });
  }
}

function updateEffects(dt: number): void {
  const dampingFactor = Math.max(0, 1 - GAME_CONFIG.effect.crashParticleDamping * dt);

  for (const p of crashParticles) {
    p.velocityY += GAME_CONFIG.effect.crashParticleGravity * dt;
    p.velocityX *= dampingFactor;
    p.velocityY *= dampingFactor;
    p.x += p.velocityX * dt;
    p.y += p.velocityY * dt;
    p.life -= dt;
  }

  crashParticles = crashParticles.filter((p) => p.life > 0);
}

function spawnObstacle(): void {
  if (Math.random() < GAME_CONFIG.obstacle.movingSpawnChance) {
    spawnMovingObstacle();
    return;
  }

  spawnPillarObstacle();
}

function spawnPillarObstacle(): void {
  const cfg = GAME_CONFIG.obstacle;
  const width = cfg.minWidth + Math.random() * cfg.widthVariance;
  const gap = cfg.gap;
  const minTop = BORDER + cfg.edgeMargin;
  const maxTop = H - BORDER - gap - cfg.edgeMargin;

  const centerMin = minTop + gap / 2;
  const centerMax = maxTop + gap / 2;
  let gapCenterY = centerMin + Math.random() * (centerMax - centerMin);

  if (lastPillarGapCenterY !== null) {
    let maxShift: number = cfg.maxGapCenterShiftBase;
    if (cfg.useSpeedScaledGapShift) {
      const speedRatio = GAME_CONFIG.progression.baseSpeed / Math.max(GAME_CONFIG.progression.baseSpeed, speed);
      maxShift = Math.max(cfg.maxGapCenterShiftMin, cfg.maxGapCenterShiftBase * speedRatio);
    }

    const minCenterByPrev = lastPillarGapCenterY - maxShift;
    const maxCenterByPrev = lastPillarGapCenterY + maxShift;
    gapCenterY = Math.max(minCenterByPrev, Math.min(maxCenterByPrev, gapCenterY));
    gapCenterY = Math.max(centerMin, Math.min(centerMax, gapCenterY));
  }

  const topHeight = gapCenterY - gap / 2;
  lastPillarGapCenterY = gapCenterY;

  obstacles.push({
    kind: "pillar",
    x: W + width,
    width,
    topHeight,
    bottomY: topHeight + gap,
    passed: false,
  });
}

function spawnMovingObstacle(): void {
  const cfg = GAME_CONFIG.obstacle;
  const width = cfg.movingWidth;
  const height = cfg.movingHeight;
  const minY = BORDER + cfg.movingEdgeMargin;
  const maxY = H - BORDER - cfg.movingEdgeMargin - height;
  const baseY = minY + Math.random() * Math.max(1, maxY - minY);
  const amplitude = cfg.movingAmplitudeMin + Math.random() * (cfg.movingAmplitudeMax - cfg.movingAmplitudeMin);
  const angularSpeed = cfg.movingAngularSpeedMin + Math.random() * (cfg.movingAngularSpeedMax - cfg.movingAngularSpeedMin);
  const phase = Math.random() * Math.PI * 2;

  obstacles.push({
    kind: "moving",
    x: W + width,
    y: baseY,
    width,
    height,
    baseY,
    amplitude,
    phase,
    angularSpeed,
    passed: false,
  });
}

function overlaps(a: { x: number; y: number; width: number; height: number }, b: { x: number; y: number; width: number; height: number }): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function handlePlayerCrash(): void {
  state = "GameOver";
  const nextBestScore = Math.max(bestScore, score);
  if (nextBestScore !== bestScore) {
    bestScore = nextBestScore;
    saveBestScore(bestScore);
  }

  tryRecordRanking(score);
  spawnCrashParticles(player.x + player.width / 2, player.y + player.height / 2);
}

function handleInput(): void {
  if (state === "Title") {
    ensurePlayerNameOnFirstStart();
    startGame();
    return;
  }

  if (state === "Playing") {
    flipGravity();
    return;
  }

  if (state === "GameOver") {
    startGame();
  }
}

function update(dt: number): void {
  updateEffects(dt);

  if (state !== "Playing") {
    return;
  }

  survivedTime += dt;
  score = Math.floor(survivedTime * GAME_CONFIG.scoring.pointsPerSecond);

  speed = Math.min(
    GAME_CONFIG.progression.baseSpeed + survivedTime * GAME_CONFIG.progression.speedRamp,
    GAME_CONFIG.progression.maxSpeed,
  );
  obstacleInterval = Math.max(
    GAME_CONFIG.obstacle.minInterval,
    GAME_CONFIG.obstacle.baseIntervalForRamp - survivedTime * GAME_CONFIG.obstacle.intervalRamp,
  );

  player.velocityY += gravity * dt;
  player.y += player.velocityY * dt;

  const ceilingY = BORDER;
  const floorY = H - BORDER - player.height;

  if (player.y < ceilingY) {
    player.y = ceilingY;
    player.velocityY = 0;
  }

  if (player.y > floorY) {
    player.y = floorY;
    player.velocityY = 0;
  }

  obstacleTimer += dt;
  if (obstacleTimer >= obstacleInterval) {
    obstacleTimer = 0;
    spawnObstacle();
  }

  for (const obstacle of obstacles) {
    obstacle.x -= speed * dt;

    if (obstacle.kind === "moving") {
      obstacle.phase += obstacle.angularSpeed * dt;
      const targetY = obstacle.baseY + Math.sin(obstacle.phase) * obstacle.amplitude;
      const minY = BORDER;
      const maxY = H - BORDER - obstacle.height;
      obstacle.y = Math.max(minY, Math.min(maxY, targetY));
    }

    if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
      obstacle.passed = true;
    }

    const playerRect = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
    };

    if (obstacle.kind === "pillar") {
      const topRect = {
        x: obstacle.x,
        y: BORDER,
        width: obstacle.width,
        height: obstacle.topHeight - BORDER,
      };

      const bottomRect = {
        x: obstacle.x,
        y: obstacle.bottomY,
        width: obstacle.width,
        height: H - BORDER - obstacle.bottomY,
      };

      if (overlaps(playerRect, topRect) || overlaps(playerRect, bottomRect)) {
        handlePlayerCrash();
        break;
      }
    }

    if (obstacle.kind === "moving") {
      const movingRect = {
        x: obstacle.x,
        y: obstacle.y,
        width: obstacle.width,
        height: obstacle.height,
      };

      if (overlaps(playerRect, movingRect)) {
        handlePlayerCrash();
        break;
      }
    }
  }

  obstacles = obstacles.filter((o) => o.x + o.width > GAME_CONFIG.obstacle.offscreenThreshold);
}

function drawBackground(): void {
  const gradient = ctx.createLinearGradient(0, 0, 0, H);
  gradient.addColorStop(0, "#0a1727");
  gradient.addColorStop(1, "#173b58");

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "#99d7ff";
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.65;

  ctx.beginPath();
  ctx.moveTo(0, BORDER);
  ctx.lineTo(W, BORDER);
  ctx.moveTo(0, H - BORDER);
  ctx.lineTo(W, H - BORDER);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

function drawObstacles(): void {
  for (const obstacle of obstacles) {
    if (obstacle.kind === "pillar") {
      ctx.fillStyle = "#f37335";
      const topH = obstacle.topHeight - BORDER;
      const bottomH = H - BORDER - obstacle.bottomY;

      ctx.fillRect(obstacle.x, BORDER, obstacle.width, topH);
      ctx.fillRect(obstacle.x, obstacle.bottomY, obstacle.width, bottomH);

      ctx.fillStyle = "#ffd166";
      ctx.fillRect(obstacle.x, obstacle.topHeight - 6, obstacle.width, 6);
      ctx.fillRect(obstacle.x, obstacle.bottomY, obstacle.width, 6);
      continue;
    }

    const glow = 0.5 + 0.5 * Math.sin(obstacle.phase);
    ctx.fillStyle = "#45d7ff";
    ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);

    ctx.globalAlpha = 0.35 + 0.45 * glow;
    ctx.fillStyle = "#b0f6ff";
    ctx.fillRect(obstacle.x + 8, obstacle.y + 8, obstacle.width - 16, obstacle.height - 16);
    ctx.globalAlpha = 1;
  }
}

function drawPlayer(): void {
  if (GAME_CONFIG.player.sprite.enabled && isPlayerSpriteLoaded) {
    const spriteCfg = GAME_CONFIG.player.sprite;
    const spriteX = player.x + spriteCfg.offsetX;
    const spriteY = player.y + spriteCfg.offsetY;
    const centerX = spriteX + spriteCfg.renderWidth / 2;
    const centerY = spriteY + spriteCfg.renderHeight / 2;
    const tilt = Math.max(
      -spriteCfg.maxTiltRad,
      Math.min(spriteCfg.maxTiltRad, player.velocityY * spriteCfg.tiltByVelocity),
    );
    const gravityFlip = spriteCfg.flipWithGravity && gravity < 0 ? Math.PI : 0;

    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(tilt + gravityFlip);
    ctx.drawImage(
      playerSprite,
      -spriteCfg.renderWidth / 2,
      -spriteCfg.renderHeight / 2,
      spriteCfg.renderWidth,
      spriteCfg.renderHeight,
    );
    ctx.restore();
    return;
  }

  const gradient = ctx.createLinearGradient(player.x, player.y, player.x + player.width, player.y + player.height);
  gradient.addColorStop(0, "#90f7ec");
  gradient.addColorStop(1, "#32ccbc");

  ctx.fillStyle = gradient;
  ctx.fillRect(player.x, player.y, player.width, player.height);

  ctx.strokeStyle = "#eaffff";
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.width, player.height);
}

function drawCrashParticles(): void {
  for (const p of crashParticles) {
    const alpha = Math.max(0, p.life / p.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = alpha > 0.55 ? "#ffd166" : "#f37335";
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }

  ctx.globalAlpha = 1;
}

function drawHud(): void {
  ctx.fillStyle = "#e8f4ff";
  ctx.font = "bold 28px Trebuchet MS, Segoe UI, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`SCORE ${score}`, 20, 40);

  ctx.font = "20px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText(`BEST ${bestScore}`, 20, 68);

  ctx.textAlign = "right";
  ctx.fillStyle = "#ffd166";
  ctx.fillText(`SPD ${Math.floor(speed)}`, W - 20, 40);

  if (state === "Title") {
    drawCenterText("Gravity Flip Runner", "クリック / SPACE で開始・反転");
  }

  if (state === "GameOver") {
    drawCenterText("GAME OVER", "クリック / SPACE で再スタート");
  }

  if (state === "Title" || state === "GameOver") {
    drawLeaderboard();
  }
}

function drawLeaderboard(): void {
  ctx.textAlign = "right";
  ctx.fillStyle = "#bfe7ff";
  ctx.font = "bold 18px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText("RANKING", W - 20, 80);

  if (leaderboard.length === 0) {
    ctx.fillStyle = "#9fc3d9";
    ctx.font = "16px Trebuchet MS, Segoe UI, sans-serif";
    ctx.fillText("No records yet", W - 20, 106);
    return;
  }

  ctx.font = "16px Trebuchet MS, Segoe UI, sans-serif";
  leaderboard.slice(0, 5).forEach((entry, index) => {
    const y = 106 + index * 24;
    ctx.fillStyle = index === 0 ? "#ffd166" : "#d9efff";
    ctx.fillText(`${index + 1}. ${entry.name}  ${entry.score}`, W - 20, y);
  });

  ctx.fillStyle = "#9fc3d9";
  ctx.font = "14px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText(`YOU: ${currentPlayerName}`, W - 20, 234);
}

function drawCenterText(title: string, subtitle: string): void {
  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 56px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillText(title, W / 2, H / 2 - 16);

  ctx.font = "24px Trebuchet MS, Segoe UI, sans-serif";
  ctx.fillStyle = "#ffd166";
  ctx.fillText(subtitle, W / 2, H / 2 + 30);
}

function draw(): void {
  drawBackground();
  drawObstacles();
  drawPlayer();
  drawCrashParticles();
  drawHud();
}

function tick(timestamp: number): void {
  if (!lastTimestamp) {
    lastTimestamp = timestamp;
  }

  const dt = Math.min((timestamp - lastTimestamp) / 1000, GAME_CONFIG.physics.maxDeltaTime);
  lastTimestamp = timestamp;

  update(dt);
  draw();

  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (event) => {
  if (event.code !== "Space") {
    return;
  }

  if (pressed.has("Space")) {
    return;
  }

  pressed.add("Space");
  event.preventDefault();
  handleInput();
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    pressed.delete("Space");
  }
});

canvas.addEventListener("pointerdown", () => {
  handleInput();
});

bestScore = loadBestScore();
currentPlayerName = loadPlayerName();
leaderboard = loadLeaderboard();
void fetchGlobalLeaderboard();
resetGame();
requestAnimationFrame(tick);
