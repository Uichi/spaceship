import "./style.css";
import { GAME_CONFIG } from "./config";
import playerShipSpriteUrl from "./assets/player-ship-placeholder.svg";

type GameState = "Title" | "Playing" | "GameOver";

type Obstacle = {
  x: number;
  width: number;
  topHeight: number;
  bottomY: number;
  passed: boolean;
};

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

const playerSprite = new Image();
let isPlayerSpriteLoaded = false;

const pressed = new Set<string>();

playerSprite.src = playerShipSpriteUrl;
playerSprite.onload = () => {
  isPlayerSpriteLoaded = true;
};
playerSprite.onerror = () => {
  isPlayerSpriteLoaded = false;
};

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
  const width = GAME_CONFIG.obstacle.minWidth + Math.random() * GAME_CONFIG.obstacle.widthVariance;
  const gap = GAME_CONFIG.obstacle.gap;
  const minTop = BORDER + GAME_CONFIG.obstacle.edgeMargin;
  const maxTop = H - BORDER - gap - GAME_CONFIG.obstacle.edgeMargin;
  const topHeight = minTop + Math.random() * (maxTop - minTop);

  obstacles.push({
    x: W + width,
    width,
    topHeight,
    bottomY: topHeight + gap,
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

function handleInput(): void {
  if (state === "Title") {
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

    if (!obstacle.passed && obstacle.x + obstacle.width < player.x) {
      obstacle.passed = true;
    }

    const playerRect = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
    };

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
      state = "GameOver";
      bestScore = Math.max(bestScore, score);
      spawnCrashParticles(player.x + player.width / 2, player.y + player.height / 2);
      break;
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
  ctx.fillStyle = "#f37335";

  for (const obstacle of obstacles) {
    const topH = obstacle.topHeight - BORDER;
    const bottomH = H - BORDER - obstacle.bottomY;

    ctx.fillRect(obstacle.x, BORDER, obstacle.width, topH);
    ctx.fillRect(obstacle.x, obstacle.bottomY, obstacle.width, bottomH);

    ctx.fillStyle = "#ffd166";
    ctx.fillRect(obstacle.x, obstacle.topHeight - 6, obstacle.width, 6);
    ctx.fillRect(obstacle.x, obstacle.bottomY, obstacle.width, 6);
    ctx.fillStyle = "#f37335";
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

resetGame();
requestAnimationFrame(tick);
