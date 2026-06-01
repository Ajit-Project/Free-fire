// ============================================================
//  FIRESTRIKE — Free Fire Inspired Browser Game
//  Features: Drag-fire, Auto-aim, Virtual Joystick, Minimap
// ============================================================

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const miniCanvas = document.getElementById('minimapCanvas');
const miniCtx = miniCanvas.getContext('2d');

// ===== GAME STATE =====
let gameRunning = false;
let animId = null;
let gameTime = 300;
let timerInterval = null;
let totalDamageDealt = 0;

// ===== WORLD =====
const WORLD_W = 2400;
const WORLD_H = 2400;

// ===== CAMERA =====
const cam = { x: 0, y: 0 };

// ===== PLAYER =====
const player = {
  x: WORLD_W / 2, y: WORLD_H / 2,
  angle: 0,
  speed: 3.5,
  hp: 200, maxHp: 200,
  kills: 0,
  ammo: 30, maxAmmo: 30,
  reserveAmmo: 90,
  isReloading: false,
  reloadTime: 1500,
  radius: 18,
  color: '#4fc3f7',
  fireRate: 120, // ms between shots
  lastShot: 0,
  weapon: 'M4A1',
  damage: 35,
  aimTarget: null,
};

// ===== ENEMIES =====
let enemies = [];
const ENEMY_COUNT = 10;
const ENEMY_COLORS = ['#ff5252', '#ff7043', '#ef5350', '#e53935', '#d32f2f', '#c62828'];

// ===== BULLETS =====
let bullets = [];
let enemyBullets = [];

// ===== MAP OBJECTS =====
let mapObjects = [];
let trees = [];
let buildings = [];

// ===== INPUT =====
const keys = {};
const joystick = { active: false, startX: 0, startY: 0, dx: 0, dy: 0, id: null };
const aimDrag = { active: false, lastX: 0, lastY: 0, id: null };
const fireDrag = { active: false, startX: 0, startY: 0, id: null, dragging: false };

// ===== AUTO-AIM RING DOM =====
let aimRingEl = null;

// ============================================================
//  INIT GAME
// ============================================================
function startGame() {
  document.getElementById('mainMenu').style.display = 'none';
  document.getElementById('gameOver').style.display = 'none';
  document.getElementById('gameHUD').style.display = 'block';
  document.getElementById('gameCanvas').style.display = 'block';

  resize();
  generateMap();
  spawnPlayer();
  spawnEnemies();
  resetHUD();
  setupControls();

  gameRunning = true;
  gameTime = 300;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(tickTimer, 1000);

  if (animId) cancelAnimationFrame(animId);
  gameLoop();
}

function showMenu() {
  document.getElementById('mainMenu').style.display = 'flex';
  document.getElementById('gameOver').style.display = 'none';
  document.getElementById('gameHUD').style.display = 'none';
  document.getElementById('gameCanvas').style.display = 'none';
  gameRunning = false;
  if (timerInterval) clearInterval(timerInterval);
}

function showHowTo() {
  document.getElementById('howToPlay').style.display = 'flex';
}

function resetHUD() {
  player.hp = 200; player.maxHp = 200;
  player.kills = 0;
  player.ammo = 30; player.reserveAmmo = 90;
  player.isReloading = false;
  totalDamageDealt = 0;
  updateHPBar();
  document.getElementById('playerKills').textContent = '0';
  document.getElementById('enemyCount').textContent = ENEMY_COUNT;
  document.getElementById('currentAmmo').textContent = player.ammo;
  document.getElementById('totalAmmo').textContent = player.reserveAmmo;
  document.getElementById('killFeed').innerHTML = '';
}

// ============================================================
//  MAP GENERATION — Bermuda-inspired
// ============================================================
function generateMap() {
  mapObjects = []; trees = []; buildings = [];

  // Ground tiles (various terrain colors)
  // Buildings / structures
  const buildingDefs = [
    {x:300, y:300, w:200, h:150, color:'#5d4037'},
    {x:600, y:200, w:120, h:100, color:'#455a64'},
    {x:1800, y:400, w:180, h:120, color:'#5d4037'},
    {x:1200, y:300, w:250, h:200, color:'#37474f'},
    {x:400, y:1200, w:160, h:140, color:'#4e342e'},
    {x:1600, y:1200, w:200, h:160, color:'#546e7a'},
    {x:1000, y:1800, w:220, h:150, color:'#455a64'},
    {x:800, y:800, w:180, h:120, color:'#5d4037'},
    {x:1500, y:900, w:150, h:130, color:'#37474f'},
    // Hangar-like big building
    {x:900, y:1000, w:400, h:280, color:'#607d8b', isHangar: true},
    // Runway
    {x:500, y:1400, w:1400, h:60, color:'#424242', isRunway: true},
  ];

  buildingDefs.forEach(b => buildings.push(b));

  // Trees
  for (let i = 0; i < 120; i++) {
    trees.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      r: 18 + Math.random() * 14,
      color: Math.random() > 0.4 ? '#2e7d32' : '#388e3c',
    });
  }

  // Rocks / cover objects
  for (let i = 0; i < 40; i++) {
    mapObjects.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      w: 30 + Math.random() * 40,
      h: 25 + Math.random() * 30,
      color: '#78909c',
      type: 'rock',
    });
  }

  // Crates
  for (let i = 0; i < 25; i++) {
    mapObjects.push({
      x: Math.random() * WORLD_W,
      y: Math.random() * WORLD_H,
      w: 28, h: 28,
      color: '#795548',
      type: 'crate',
    });
  }
}

function spawnPlayer() {
  player.x = WORLD_W / 2;
  player.y = WORLD_H / 2;
  player.angle = 0;
  player.hp = 200;
  bullets = [];
  enemyBullets = [];
}

function spawnEnemies() {
  enemies = [];
  for (let i = 0; i < ENEMY_COUNT; i++) {
    let ex, ey;
    do {
      ex = 200 + Math.random() * (WORLD_W - 400);
      ey = 200 + Math.random() * (WORLD_H - 400);
    } while (dist(ex, ey, player.x, player.y) < 400);

    enemies.push({
      x: ex, y: ey,
      angle: Math.random() * Math.PI * 2,
      hp: 100, maxHp: 100,
      speed: 1.2 + Math.random() * 0.8,
      radius: 16,
      color: ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)],
      state: 'patrol',   // patrol | chase | attack
      patrolAngle: Math.random() * Math.PI * 2,
      lastShot: 0,
      fireRate: 1800 + Math.random() * 1200,
      damage: 15 + Math.floor(Math.random() * 10),
      name: 'Enemy_' + (i + 1),
      id: i,
    });
  }
}

// ============================================================
//  CONTROLS SETUP
// ============================================================
function setupControls() {
  const joystickZone = document.getElementById('joystickZone');
  const aimZone = document.getElementById('aimZone');
  const fireBtn = document.getElementById('fireBtn');

  // Remove old listeners by cloning
  const newJZ = joystickZone.cloneNode(true);
  joystickZone.parentNode.replaceChild(newJZ, joystickZone);
  const newAZ = aimZone.cloneNode(true);
  aimZone.parentNode.replaceChild(newAZ, aimZone);
  const newFB = fireBtn.cloneNode(true);
  fireBtn.parentNode.replaceChild(newFB, fireBtn);

  // Re-get elements
  const jz = document.getElementById('joystickZone');
  const az = document.getElementById('aimZone');
  const fb = document.getElementById('fireBtn');

  // JOYSTICK — Left side
  jz.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    joystick.active = true;
    joystick.id = t.identifier;
    joystick.startX = t.clientX;
    joystick.startY = t.clientY;
    joystick.dx = 0; joystick.dy = 0;
    positionJoystickBase(t.clientX, t.clientY);
  }, {passive: false});

  jz.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let t of e.changedTouches) {
      if (t.identifier === joystick.id) {
        const dx = t.clientX - joystick.startX;
        const dy = t.clientY - joystick.startY;
        const maxR = 50;
        const len = Math.sqrt(dx*dx + dy*dy);
        joystick.dx = len > maxR ? (dx/len) : dx/maxR;
        joystick.dy = len > maxR ? (dy/len) : dy/maxR;
        moveJoystickHandle(joystick.dx, joystick.dy);
      }
    }
  }, {passive: false});

  jz.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (let t of e.changedTouches) {
      if (t.identifier === joystick.id) {
        joystick.active = false;
        joystick.dx = 0; joystick.dy = 0;
        resetJoystickHandle();
      }
    }
  }, {passive: false});

  // AIM ZONE — Right side drag to rotate camera/aim
  az.addEventListener('touchstart', (e) => {
    e.preventDefault();
    for (let t of e.changedTouches) {
      if (aimDrag.id === null) {
        aimDrag.active = true;
        aimDrag.id = t.identifier;
        aimDrag.lastX = t.clientX;
        aimDrag.lastY = t.clientY;
      }
    }
  }, {passive: false});

  az.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let t of e.changedTouches) {
      if (t.identifier === aimDrag.id) {
        const dx = t.clientX - aimDrag.lastX;
        // Rotate player angle
        player.angle += dx * 0.012;
        aimDrag.lastX = t.clientX;
        aimDrag.lastY = t.clientY;
      }
    }
  }, {passive: false});

  az.addEventListener('touchend', (e) => {
    e.preventDefault();
    for (let t of e.changedTouches) {
      if (t.identifier === aimDrag.id) {
        aimDrag.active = false;
        aimDrag.id = null;
      }
    }
  }, {passive: false});

  // ===== FIRE BUTTON — TAP = single shot, HOLD+DRAG = drag fire (Free Fire style) =====
  fb.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    fireDrag.active = true;
    fireDrag.startX = t.clientX;
    fireDrag.startY = t.clientY;
    fireDrag.id = t.identifier;
    fireDrag.dragging = false;
    // Immediate first shot
    tryFire();
  }, {passive: false});

  fb.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (let t of e.changedTouches) {
      if (t.identifier === fireDrag.id) {
        const dx = t.clientX - fireDrag.startX;
        const dy = t.clientY - fireDrag.startY;
        const moved = Math.sqrt(dx*dx + dy*dy);

        if (moved > 10) {
          fireDrag.dragging = true;
          // Drag fire: aim based on drag direction
          const screenCX = window.innerWidth / 2;
          const screenCY = window.innerHeight / 2;
          const aimDx = t.clientX - screenCX;
          const aimDy = t.clientY - screenCY;
          // Smoothly adjust angle toward drag direction
          const targetAngle = Math.atan2(aimDy, aimDx);
          player.angle = lerpAngle(player.angle, targetAngle, 0.3);

          // Auto-fire while dragging
          tryFire();
        }
      }
    }
  }, {passive: false});

  fb.addEventListener('touchend', (e) => {
    e.preventDefault();
    fireDrag.active = false;
    fireDrag.dragging = false;
    fireDrag.id = null;
  }, {passive: false});

  // KEYBOARD fallback (PC)
  window.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
  window.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

  // MOUSE for PC drag fire (right click drag)
  let mouseDown = false;
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) { mouseDown = true; tryFire(); }
    if (e.button === 2) { mouseDown = true; }
  });
  canvas.addEventListener('mousemove', (e) => {
    if (mouseDown) {
      const dx = e.clientX - window.innerWidth / 2;
      const dy = e.clientY - window.innerHeight / 2;
      player.angle = Math.atan2(dy, dx);
      tryFire();
    }
  });
  canvas.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function positionJoystickBase(x, y) {
  const base = document.getElementById('joystickBase');
  if (!base) return;
  const zone = document.getElementById('joystickZone');
  if (!zone) return;
  const rect = zone.getBoundingClientRect();
  base.style.left = (x - rect.left - 65) + 'px';
  base.style.top = (y - rect.top - 65) + 'px';
}

function moveJoystickHandle(dx, dy) {
  const handle = document.getElementById('joystickHandle');
  if (!handle) return;
  const maxR = 37;
  handle.style.transform = `translate(${dx * maxR}px, ${dy * maxR}px)`;
}

function resetJoystickHandle() {
  const handle = document.getElementById('joystickHandle');
  if (handle) handle.style.transform = 'translate(0,0)';
}

// ============================================================
//  GAME LOOP
// ============================================================
function gameLoop() {
  if (!gameRunning) return;
  update();
  render();
  animId = requestAnimationFrame(gameLoop);
}

// ============================================================
//  UPDATE
// ============================================================
function update() {
  // --- Player Movement ---
  let mx = 0, my = 0;

  // Joystick
  if (joystick.active) {
    mx += joystick.dx;
    my += joystick.dy;
  }

  // Keyboard (WASD / Arrow)
  if (keys['w'] || keys['arrowup'])    my -= 1;
  if (keys['s'] || keys['arrowdown'])  my += 1;
  if (keys['a'] || keys['arrowleft'])  mx -= 1;
  if (keys['d'] || keys['arrowright']) mx += 1;
  if (keys[' ']) tryFire();
  if (keys['r']) reloadWeapon();

  const len = Math.sqrt(mx*mx + my*my);
  if (len > 0) {
    mx /= len; my /= len;
    player.x += mx * player.speed;
    player.y += my * player.speed;
  }

  // Clamp player to world
  player.x = Math.max(player.radius, Math.min(WORLD_W - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(WORLD_H - player.radius, player.y));

  // --- Auto-Aim ---
  updateAutoAim();

  // --- Camera follows player ---
  cam.x = player.x - canvas.width / 2;
  cam.y = player.y - canvas.height / 2;

  // --- Update Bullets ---
  updateBullets();

  // --- Update Enemy Bullets ---
  updateEnemyBullets();

  // --- Update Enemies ---
  updateEnemies();

  // --- Update HUD ---
  updateHPBar();
}

// ===== AUTO-AIM =====
function updateAutoAim() {
  let nearest = null;
  let nearestDist = 280; // auto-aim range

  enemies.forEach(e => {
    const d = dist(player.x, player.y, e.x, e.y);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = e;
    }
  });

  player.aimTarget = nearest;

  if (nearest) {
    // Smoothly rotate toward target
    const targetAngle = Math.atan2(nearest.y - player.y, nearest.x - player.x);
    player.angle = lerpAngle(player.angle, targetAngle, 0.15);
    showAimRing(nearest);
  } else {
    hideAimRing();
  }
}

function showAimRing(enemy) {
  const sx = enemy.x - cam.x;
  const sy = enemy.y - cam.y;
  if (!aimRingEl) {
    aimRingEl = document.createElement('div');
    aimRingEl.className = 'auto-aim-ring';
    document.body.appendChild(aimRingEl);
  }
  aimRingEl.style.display = 'block';
  aimRingEl.style.width = (enemy.radius * 2 + 20) + 'px';
  aimRingEl.style.height = (enemy.radius * 2 + 20) + 'px';
  aimRingEl.style.left = (sx - enemy.radius - 10) + 'px';
  aimRingEl.style.top = (sy - enemy.radius - 10) + 'px';
}

function hideAimRing() {
  if (aimRingEl) aimRingEl.style.display = 'none';
}

// ===== FIRING =====
function tryFire() {
  if (!gameRunning) return;
  if (player.isReloading) return;
  if (player.ammo <= 0) { reloadWeapon(); return; }
  const now = Date.now();
  if (now - player.lastShot < player.fireRate) return;
  player.lastShot = now;

  // Muzzle position
  const mx = player.x + Math.cos(player.angle) * 25;
  const my = player.y + Math.sin(player.angle) * 25;

  bullets.push({
    x: mx, y: my,
    vx: Math.cos(player.angle) * 12,
    vy: Math.sin(player.angle) * 12,
    life: 70,
    damage: player.damage,
  });

  // Slight spread on drag-fire
  if (fireDrag.dragging) {
    const spread = 0.06;
    for (let i = 0; i < 1; i++) {
      const ang = player.angle + (Math.random() - 0.5) * spread;
      bullets.push({
        x: mx, y: my,
        vx: Math.cos(ang) * 12,
        vy: Math.sin(ang) * 12,
        life: 70,
        damage: Math.floor(player.damage * 0.7),
      });
    }
  }

  player.ammo--;
  document.getElementById('currentAmmo').textContent = player.ammo;

  // Crosshair spread
  const ch = document.getElementById('crosshair');
  if (ch) {
    ch.classList.add('shooting');
    setTimeout(() => ch.classList.remove('shooting'), 100);
  }

  // Muzzle flash
  showMuzzleFlash();
}

function showMuzzleFlash() {
  const mx = player.x + Math.cos(player.angle) * 25 - cam.x;
  const my = player.y + Math.sin(player.angle) * 25 - cam.y;
  const flash = document.createElement('div');
  flash.className = 'muzzle-flash';
  flash.style.left = mx + 'px';
  flash.style.top = my + 'px';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 120);
}

function reloadWeapon() {
  if (player.isReloading) return;
  if (player.ammo === player.maxAmmo) return;
  if (player.reserveAmmo <= 0) return;

  player.isReloading = true;
  const rb = document.getElementById('reloadBar');
  const rp = document.getElementById('reloadProgress');
  if (rb) { rb.style.display = 'block'; }
  if (rp) { rp.style.animation = 'none'; rp.offsetHeight; rp.style.animation = ''; }

  setTimeout(() => {
    const needed = player.maxAmmo - player.ammo;
    const take = Math.min(needed, player.reserveAmmo);
    player.ammo += take;
    player.reserveAmmo -= take;
    player.isReloading = false;
    if (rb) rb.style.display = 'none';
    document.getElementById('currentAmmo').textContent = player.ammo;
    document.getElementById('totalAmmo').textContent = player.reserveAmmo;
  }, player.reloadTime);
}

// ===== BULLETS =====
function updateBullets() {
  bullets = bullets.filter(b => {
    b.x += b.vx; b.y += b.vy; b.life--;
    if (b.life <= 0) return false;
    // Hit enemies
    for (let i = enemies.length - 1; i >= 0; i--) {
      const e = enemies[i];
      if (dist(b.x, b.y, e.x, e.y) < e.radius + 4) {
        const dmg = b.damage + Math.floor(Math.random() * 10);
        e.hp -= dmg;
        totalDamageDealt += dmg;
        showDmgNumber(e.x - cam.x, e.y - cam.y - 30, dmg, dmg > 40);
        showHitMarker();
        if (e.hp <= 0) {
          addKillFeed(e.name);
          player.kills++;
          enemies.splice(i, 1);
          document.getElementById('playerKills').textContent = player.kills;
          document.getElementById('enemyCount').textContent = enemies.length;
          if (enemies.length === 0) { setTimeout(()=>endGame(true), 500); }
        }
        return false;
      }
    }
    return b.life > 0;
  });
}

function updateEnemyBullets() {
  enemyBullets = enemyBullets.filter(b => {
    b.x += b.vx; b.y += b.vy; b.life--;
    if (dist(b.x, b.y, player.x, player.y) < player.radius + 4) {
      takeDamage(b.damage);
      return false;
    }
    return b.life > 0;
  });
}

// ===== ENEMIES AI =====
function updateEnemies() {
  const now = Date.now();
  enemies.forEach(e => {
    const d = dist(e.x, e.y, player.x, player.y);
    if (d < 300) e.state = 'chase';
    else if (d > 500) e.state = 'patrol';

    if (e.state === 'patrol') {
      e.patrolAngle += (Math.random() - 0.5) * 0.05;
      e.x += Math.cos(e.patrolAngle) * e.speed * 0.5;
      e.y += Math.sin(e.patrolAngle) * e.speed * 0.5;
    } else {
      // Chase player
      const ang = Math.atan2(player.y - e.y, player.x - e.x);
      e.angle = ang;
      if (d > 80) {
        e.x += Math.cos(ang) * e.speed;
        e.y += Math.sin(ang) * e.speed;
      }
      // Attack
      if (d < 250 && now - e.lastShot > e.fireRate) {
        e.lastShot = now;
        const spread = (Math.random() - 0.5) * 0.2;
        enemyBullets.push({
          x: e.x, y: e.y,
          vx: Math.cos(ang + spread) * 7,
          vy: Math.sin(ang + spread) * 7,
          life: 60,
          damage: e.damage,
        });
      }
    }

    // Clamp enemy
    e.x = Math.max(e.radius, Math.min(WORLD_W - e.radius, e.x));
    e.y = Math.max(e.radius, Math.min(WORLD_H - e.radius, e.y));
  });
}

function takeDamage(dmg) {
  player.hp = Math.max(0, player.hp - dmg);
  updateHPBar();
  // Damage vignette
  const flash = document.createElement('div');
  flash.className = 'damage-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);
  if (player.hp <= 0) { setTimeout(()=>endGame(false), 500); }
}

// ============================================================
//  RENDER
// ============================================================
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  drawGround();
  drawBuildings();
  drawTrees();
  drawObjects();
  drawEnemyBullets();
  drawBullets();
  drawEnemies();
  drawPlayer();

  ctx.restore();
  drawMinimap();
}

function drawGround() {
  // Base terrain
  const grd = ctx.createLinearGradient(cam.x, cam.y, cam.x + canvas.width, cam.y + canvas.height);
  grd.addColorStop(0, '#3e5c1a');
  grd.addColorStop(0.3, '#4a6e20');
  grd.addColorStop(0.6, '#5c8426');
  grd.addColorStop(1, '#3e5c1a');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, WORLD_W, WORLD_H);

  // Grid pattern for ground feel
  ctx.strokeStyle = 'rgba(0,0,0,0.07)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WORLD_W; x += 80) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_H); ctx.stroke();
  }
  for (let y = 0; y < WORLD_H; y += 80) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_W, y); ctx.stroke();
  }

  // Sand/dirt patches
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(180,160,80,0.12)`;
    ctx.beginPath();
    ctx.ellipse(i * 80 + 40, i * 70 + 50, 60, 40, i * 0.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Water border
  ctx.fillStyle = '#1565c0';
  ctx.fillRect(0, 0, WORLD_W, 80);
  ctx.fillRect(0, WORLD_H - 80, WORLD_W, 80);
  ctx.fillRect(0, 0, 80, WORLD_H);
  ctx.fillRect(WORLD_W - 80, 0, 80, WORLD_H);
}

function drawBuildings() {
  buildings.forEach(b => {
    if (b.isRunway) {
      // Runway with markings
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = '#fff';
      for (let rx = b.x + 60; rx < b.x + b.w - 60; rx += 120) {
        ctx.fillRect(rx, b.y + b.h/2 - 4, 60, 8);
      }
      return;
    }
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 6, b.y + 6, b.w, b.h);

    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);

    // Roof / top color
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(b.x, b.y, b.w, 12);

    // Door
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(b.x + b.w/2 - 15, b.y + b.h - 30, 30, 30);

    if (b.isHangar) {
      // Big hangar doors
      ctx.fillStyle = '#78909c';
      ctx.fillRect(b.x + 20, b.y + b.h - 80, 80, 80);
      ctx.fillRect(b.x + b.w - 100, b.y + b.h - 80, 80, 80);
      ctx.strokeStyle = '#546e7a';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      // Plane silhouette inside
      ctx.fillStyle = '#455a64';
      ctx.save();
      ctx.translate(b.x + b.w/2, b.y + b.h/2);
      drawPlaneShape(ctx, 0, 0, 0.7);
      ctx.restore();
    }
  });
}

function drawPlaneShape(c, cx, cy, scale) {
  c.save();
  c.scale(scale, scale);
  c.fillStyle = '#37474f';
  // Body
  c.fillRect(-80, -10, 160, 20);
  // Wings
  c.fillRect(-30, -50, 60, 100);
  // Tail
  c.fillRect(-80, -25, 30, 15);
  c.fillRect(-80, 10, 30, 15);
  c.restore();
}

function drawTrees() {
  trees.forEach(t => {
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.ellipse(t.x + 4, t.y + 4, t.r, t.r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    // Trunk
    ctx.fillStyle = '#5d4037';
    ctx.fillRect(t.x - 3, t.y - 3, 6, 10);
    // Foliage
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

function drawObjects() {
  mapObjects.forEach(o => {
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fillRect(o.x + 3, o.y + 3, o.w, o.h);

    if (o.type === 'rock') {
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.ellipse(o.x + o.w/2, o.y + o.h/2, o.w/2, o.h/2, 0.3, 0, Math.PI*2);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.ellipse(o.x + o.w*0.3, o.y + o.h*0.3, o.w*0.25, o.h*0.2, 0.3, 0, Math.PI*2);
      ctx.fill();
    } else {
      // Crate
      ctx.fillStyle = '#5d4037';
      ctx.fillRect(o.x, o.y, o.w, o.h);
      ctx.strokeStyle = '#3e2723';
      ctx.lineWidth = 2;
      ctx.strokeRect(o.x, o.y, o.w, o.h);
      ctx.strokeRect(o.x + o.w/2 - 1, o.y, 2, o.h);
      ctx.strokeRect(o.x, o.y + o.h/2 - 1, o.w, 2);
    }
  });
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.rotate(player.angle);

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath();
  ctx.ellipse(3, 3, player.radius, player.radius * 0.7, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body circle
  ctx.fillStyle = '#1565c0';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
  ctx.fill();

  // Vest
  ctx.fillStyle = '#0d47a1';
  ctx.beginPath();
  ctx.arc(0, 0, player.radius - 4, 0, Math.PI * 2);
  ctx.fill();

  // Head direction indicator
  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.arc(player.radius * 0.55, 0, 6, 0, Math.PI * 2);
  ctx.fill();

  // Gun
  ctx.fillStyle = '#333';
  ctx.fillRect(8, -3, 22, 6);
  ctx.fillStyle = '#555';
  ctx.fillRect(18, -2, 14, 4);

  // HP bar above player
  ctx.rotate(-player.angle);
  const hpRatio = player.hp / player.maxHp;
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-20, -player.radius - 10, 40, 5);
  ctx.fillStyle = hpRatio > 0.5 ? '#4caf50' : hpRatio > 0.25 ? '#ff9800' : '#f44336';
  ctx.fillRect(-20, -player.radius - 10, 40 * hpRatio, 5);

  ctx.restore();
}

function drawEnemies() {
  enemies.forEach(e => {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(3, 3, e.radius, e.radius * 0.7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Body
    ctx.fillStyle = e.color;
    ctx.beginPath();
    ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
    ctx.fill();

    // Inner
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath();
    ctx.arc(0, 0, e.radius - 4, 0, Math.PI * 2);
    ctx.fill();

    // Direction
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(e.radius * 0.5, 0, 5, 0, Math.PI * 2);
    ctx.fill();

    // Gun
    ctx.fillStyle = '#222';
    ctx.fillRect(7, -2.5, 20, 5);

    // HP bar
    ctx.rotate(-e.angle);
    const hpR = e.hp / e.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(-18, -e.radius - 10, 36, 5);
    ctx.fillStyle = '#f44336';
    ctx.fillRect(-18, -e.radius - 10, 36 * hpR, 5);

    // Name
    ctx.fillStyle = '#ffcdd2';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(e.name, 0, -e.radius - 13);

    ctx.restore();
  });
}

function drawBullets() {
  bullets.forEach(b => {
    ctx.save();
    ctx.fillStyle = '#ffeb3b';
    ctx.shadowColor = '#ff9800';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
    // Trail
    ctx.strokeStyle = 'rgba(255,200,0,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 3, b.y - b.vy * 3);
    ctx.stroke();
    ctx.restore();
  });
}

function drawEnemyBullets() {
  enemyBullets.forEach(b => {
    ctx.save();
    ctx.fillStyle = '#ff5252';
    ctx.shadowColor = '#ff1744';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,82,82,0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x - b.vx * 3, b.y - b.vy * 3);
    ctx.stroke();
    ctx.restore();
  });
}

// ===== MINIMAP =====
function drawMinimap() {
  miniCtx.clearRect(0, 0, 120, 120);

  const scaleX = 120 / WORLD_W;
  const scaleY = 120 / WORLD_H;

  // Ground
  miniCtx.fillStyle = '#2e7d32';
  miniCtx.fillRect(0, 0, 120, 120);

  // Water
  miniCtx.fillStyle = '#1565c0';
  miniCtx.fillRect(0, 0, 120, 4);
  miniCtx.fillRect(0, 116, 120, 4);
  miniCtx.fillRect(0, 0, 4, 120);
  miniCtx.fillRect(116, 0, 4, 120);

  // Buildings
  buildings.forEach(b => {
    miniCtx.fillStyle = 'rgba(100,100,100,0.8)';
    miniCtx.fillRect(b.x * scaleX, b.y * scaleY, b.w * scaleX, b.h * scaleY);
  });

  // Enemies
  enemies.forEach(e => {
    miniCtx.fillStyle = '#f44336';
    miniCtx.beginPath();
    miniCtx.arc(e.x * scaleX, e.y * scaleY, 2.5, 0, Math.PI * 2);
    miniCtx.fill();
  });

  // Player
  miniCtx.fillStyle = '#4fc3f7';
  const px = player.x * scaleX;
  const py = player.y * scaleY;
  miniCtx.beginPath();
  miniCtx.arc(px, py, 3.5, 0, Math.PI * 2);
  miniCtx.fill();

  // Player direction
  miniCtx.strokeStyle = '#fff';
  miniCtx.lineWidth = 1.5;
  miniCtx.beginPath();
  miniCtx.moveTo(px, py);
  miniCtx.lineTo(px + Math.cos(player.angle) * 8, py + Math.sin(player.angle) * 8);
  miniCtx.stroke();
}

// ============================================================
//  HUD HELPERS
// ============================================================
function updateHPBar() {
  const ratio = player.hp / player.maxHp;
  const bar = document.getElementById('hpBar');
  const txt = document.getElementById('hpText');
  if (bar) bar.style.width = (ratio * 100) + '%';
  if (txt) txt.textContent = player.hp + '/' + player.maxHp;
}

function addKillFeed(name) {
  const feed = document.getElementById('killFeed');
  if (!feed) return;
  const el = document.createElement('div');
  el.className = 'kill-entry';
  el.textContent = '🔫 You killed ' + name;
  feed.appendChild(el);
  if (feed.children.length > 4) feed.removeChild(feed.firstChild);
  setTimeout(() => el.remove(), 3000);
}

function showHitMarker() {
  const hm = document.getElementById('hitMarker');
  if (!hm) return;
  hm.style.display = 'block';
  hm.style.animation = 'none';
  hm.offsetHeight;
  hm.style.animation = 'hitFade 0.3s ease forwards';
  setTimeout(() => { hm.style.display = 'none'; }, 300);
}

function showDmgNumber(x, y, dmg, isCrit) {
  const el = document.createElement('div');
  el.className = 'dmg-number' + (isCrit ? ' crit' : '');
  el.textContent = (isCrit ? '💥' : '') + dmg;
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

// ============================================================
//  TIMER
// ============================================================
function tickTimer() {
  if (!gameRunning) return;
  gameTime--;
  const m = Math.floor(gameTime / 60);
  const s = gameTime % 60;
  document.getElementById('gameTimer').textContent =
    String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  if (gameTime <= 0) endGame(false);
}

// ============================================================
//  GAME END
// ============================================================
function endGame(won) {
  gameRunning = false;
  if (timerInterval) clearInterval(timerInterval);
  hideAimRing();

  const m = Math.floor((300 - gameTime) / 60);
  const s = (300 - gameTime) % 60;

  document.getElementById('gameOver').style.display = 'flex';
  document.getElementById('gameOverTitle').textContent = won ? '🏆 BOOYAH!' : '💀 ELIMINATED';
  document.getElementById('gameOverIcon').textContent = won ? '🏆' : '💀';
  document.getElementById('finalKills').textContent = player.kills;
  document.getElementById('finalTime').textContent = String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
  document.getElementById('finalDamage').textContent = totalDamageDealt;
}

// ============================================================
//  UTILS
// ============================================================
function dist(x1, y1, x2, y2) {
  return Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1));
}

function lerpAngle(from, to, t) {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return from + diff * t;
}

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener('resize', () => {
  if (gameRunning) resize();
});

resize();
