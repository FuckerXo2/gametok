// Gravity Flip - Tap to flip gravity, dodge obstacles
export const GravityFlipGame = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #1a1a2e; 
      overflow: hidden; 
      touch-action: none;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }
    canvas { display: block; }
    #ui {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: 20px;
      display: flex;
      justify-content: space-between;
      color: white;
      font-size: 24px;
      font-weight: bold;
      text-shadow: 0 2px 10px rgba(0,0,0,0.5);
      z-index: 10;
    }
    #startScreen {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.7);
      color: white;
      z-index: 20;
    }
    #startScreen h1 { font-size: 48px; margin-bottom: 10px; }
    #startScreen p { font-size: 18px; opacity: 0.7; margin-bottom: 30px; }
    #startScreen .tap { font-size: 24px; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    #gameOver {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.8);
      color: white;
      z-index: 20;
    }
    #gameOver h2 { font-size: 36px; margin-bottom: 20px; }
    #gameOver .score { font-size: 64px; color: #6C5CE7; margin-bottom: 10px; }
    #gameOver .tap { font-size: 20px; opacity: 0.7; margin-top: 30px; animation: pulse 1.5s infinite; }
  </style>
</head>
<body>
  <div id="ui">
    <span id="score">0</span>
    <span id="highScore">Best: 0</span>
  </div>
  <div id="startScreen">
    <h1>🔄</h1>
    <h1>Gravity Flip</h1>
    <p>Tap to flip gravity and dodge obstacles</p>
    <span class="tap">TAP TO START</span>
  </div>
  <div id="gameOver">
    <h2>GAME OVER</h2>
    <div class="score" id="finalScore">0</div>
    <span class="tap">TAP TO RETRY</span>
  </div>
  <canvas id="game"></canvas>
  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('highScore');
    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOver');
    const finalScoreEl = document.getElementById('finalScore');
    
    let W, H;
    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    // Game state
    let player = { x: 80, y: H/2, vy: 0, size: 20, gravity: 1 };
    let obstacles = [];
    let particles = [];
    let score = 0;
    let highScore = 0;
    let gameStarted = false;
    let gameOver = false;
    let speed = 4;
    let lastObstacle = 0;
    let trail = [];
    
    // Colors
    const colors = {
      player: '#6C5CE7',
      playerGlow: 'rgba(108, 92, 231, 0.5)',
      obstacle: '#E17055',
      particle: '#FDCB6E',
      trail: 'rgba(108, 92, 231, 0.3)'
    };
    
    function spawnObstacle() {
      const gapSize = 180 - Math.min(score * 2, 60);
      const gapY = Math.random() * (H - gapSize - 100) + 50;
      obstacles.push({
        x: W + 50,
        gapY: gapY,
        gapSize: gapSize,
        width: 60,
        passed: false
      });
    }
    
    function spawnParticles(x, y, color, count = 10) {
      for (let i = 0; i < count; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 10,
          vy: (Math.random() - 0.5) * 10,
          life: 1,
          color,
          size: Math.random() * 6 + 2
        });
      }
    }
    
    function flipGravity() {
      if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        return;
      }
      if (gameOver) {
        resetGame();
        return;
      }
      player.gravity *= -1;
      player.vy = player.gravity * 8;
      spawnParticles(player.x, player.y, colors.particle, 5);
    }
    
    function resetGame() {
      player = { x: 80, y: H/2, vy: 0, size: 20, gravity: 1 };
      obstacles = [];
      particles = [];
      trail = [];
      score = 0;
      speed = 4;
      gameOver = false;
      gameOverScreen.style.display = 'none';
      scoreEl.textContent = '0';
    }
    
    function update() {
      if (!gameStarted || gameOver) return;
      
      // Player physics
      player.vy += player.gravity * 0.5;
      player.vy = Math.max(-12, Math.min(12, player.vy));
      player.y += player.vy;
      
      // Trail
      trail.push({ x: player.x, y: player.y, life: 1 });
      if (trail.length > 20) trail.shift();
      trail.forEach(t => t.life -= 0.05);
      
      // Bounds check
      if (player.y < player.size || player.y > H - player.size) {
        endGame();
        return;
      }
      
      // Spawn obstacles
      if (Date.now() - lastObstacle > 2000 - Math.min(score * 30, 800)) {
        spawnObstacle();
        lastObstacle = Date.now();
      }
      
      // Update obstacles
      obstacles.forEach(obs => {
        obs.x -= speed;
        
        // Collision check
        if (player.x + player.size > obs.x && player.x - player.size < obs.x + obs.width) {
          if (player.y - player.size < obs.gapY || player.y + player.size > obs.gapY + obs.gapSize) {
            endGame();
            return;
          }
        }
        
        // Score
        if (!obs.passed && obs.x + obs.width < player.x) {
          obs.passed = true;
          score++;
          scoreEl.textContent = score;
          speed = 4 + score * 0.1;
          spawnParticles(player.x, player.y, colors.particle, 8);
        }
      });
      
      // Remove off-screen obstacles
      obstacles = obstacles.filter(obs => obs.x > -100);
      
      // Update particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.03;
        p.vx *= 0.95;
        p.vy *= 0.95;
      });
      particles = particles.filter(p => p.life > 0);
    }
    
    function endGame() {
      gameOver = true;
      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = 'Best: ' + highScore;
      }
      finalScoreEl.textContent = score;
      gameOverScreen.style.display = 'flex';
      spawnParticles(player.x, player.y, colors.obstacle, 30);
      
      // Notify React Native
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'gameOver', score }));
      }
    }
    
    function draw() {
      // Clear with fade effect
      ctx.fillStyle = 'rgba(26, 26, 46, 0.3)';
      ctx.fillRect(0, 0, W, H);
      
      // Draw trail
      trail.forEach((t, i) => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, player.size * t.life * 0.8, 0, Math.PI * 2);
        ctx.fillStyle = \`rgba(108, 92, 231, \${t.life * 0.3})\`;
        ctx.fill();
      });
      
      // Draw obstacles
      obstacles.forEach(obs => {
        // Top obstacle
        ctx.fillStyle = colors.obstacle;
        ctx.shadowColor = colors.obstacle;
        ctx.shadowBlur = 20;
        ctx.fillRect(obs.x, 0, obs.width, obs.gapY);
        
        // Bottom obstacle
        ctx.fillRect(obs.x, obs.gapY + obs.gapSize, obs.width, H - obs.gapY - obs.gapSize);
        ctx.shadowBlur = 0;
      });
      
      // Draw player glow
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.size + 10, 0, Math.PI * 2);
      ctx.fillStyle = colors.playerGlow;
      ctx.fill();
      
      // Draw player
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.size, 0, Math.PI * 2);
      ctx.fillStyle = colors.player;
      ctx.shadowColor = colors.player;
      ctx.shadowBlur = 30;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Gravity indicator
      ctx.save();
      ctx.translate(player.x, player.y);
      ctx.rotate(player.gravity > 0 ? Math.PI : 0);
      ctx.beginPath();
      ctx.moveTo(0, -8);
      ctx.lineTo(-6, 6);
      ctx.lineTo(6, 6);
      ctx.closePath();
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.restore();
      
      // Draw particles
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1;
      });
    }
    
    function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }
    
    // Input
    document.addEventListener('touchstart', (e) => {
      e.preventDefault();
      flipGravity();
    });
    document.addEventListener('click', flipGravity);
    
    gameLoop();
  </script>
</body>
</html>
`;
