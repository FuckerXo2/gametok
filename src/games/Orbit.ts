// Orbit - Keep the ball orbiting, dodge obstacles
export const OrbitGame = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: #0a0a1a; 
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
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.7);
      color: white;
      z-index: 20;
    }
    #startScreen h1 { font-size: 48px; margin-bottom: 10px; }
    #startScreen p { font-size: 18px; opacity: 0.7; margin-bottom: 30px; text-align: center; padding: 0 20px; }
    #startScreen .tap { font-size: 24px; animation: pulse 1.5s infinite; }
    @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
    #gameOver {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.8);
      color: white;
      z-index: 20;
    }
    #gameOver h2 { font-size: 36px; margin-bottom: 20px; }
    #gameOver .score { font-size: 64px; color: #0984E3; margin-bottom: 10px; }
    #gameOver .tap { font-size: 20px; opacity: 0.7; margin-top: 30px; animation: pulse 1.5s infinite; }
  </style>
</head>
<body>
  <div id="ui">
    <span id="score">0</span>
    <span id="highScore">Best: 0</span>
  </div>
  <div id="startScreen">
    <h1>🌙</h1>
    <h1>Orbit</h1>
    <p>Tap to change orbit direction. Collect stars, dodge obstacles!</p>
    <span class="tap">TAP TO START</span>
  </div>
  <div id="gameOver">
    <h2>COLLISION!</h2>
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
    
    let W, H, centerX, centerY;
    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
      centerX = W / 2;
      centerY = H / 2;
    };
    resize();
    window.addEventListener('resize', resize);
    
    // Game state
    let player = { angle: 0, radius: 120, size: 15, direction: 1 };
    let obstacles = [];
    let stars = [];
    let particles = [];
    let trail = [];
    let score = 0;
    let highScore = 0;
    let gameStarted = false;
    let gameOver = false;
    let speed = 0.03;
    let pulsePhase = 0;
    
    // Colors
    const colors = {
      player: '#0984E3',
      playerGlow: 'rgba(9, 132, 227, 0.5)',
      obstacle: '#E17055',
      star: '#FDCB6E',
      orbit: 'rgba(255,255,255,0.1)',
      trail: 'rgba(9, 132, 227, 0.3)'
    };
    
    function spawnObstacle() {
      const angle = Math.random() * Math.PI * 2;
      const orbitRadius = player.radius + (Math.random() - 0.5) * 40;
      obstacles.push({
        angle: angle,
        radius: orbitRadius,
        size: 20 + Math.random() * 15,
        speed: (Math.random() > 0.5 ? 1 : -1) * (0.01 + Math.random() * 0.02),
        color: colors.obstacle
      });
    }
    
    function spawnStar() {
      const angle = Math.random() * Math.PI * 2;
      stars.push({
        angle: angle,
        radius: player.radius,
        size: 12,
        pulse: Math.random() * Math.PI * 2
      });
    }
    
    function spawnParticles(x, y, color, count) {
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
    
    function switchDirection() {
      if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        spawnStar();
        return;
      }
      if (gameOver) {
        resetGame();
        return;
      }
      player.direction *= -1;
      const px = centerX + Math.cos(player.angle) * player.radius;
      const py = centerY + Math.sin(player.angle) * player.radius;
      spawnParticles(px, py, colors.player, 5);
    }
    
    function resetGame() {
      player = { angle: 0, radius: 120, size: 15, direction: 1 };
      obstacles = [];
      stars = [];
      particles = [];
      trail = [];
      score = 0;
      speed = 0.03;
      gameOver = false;
      gameOverScreen.style.display = 'none';
      scoreEl.textContent = '0';
      spawnStar();
    }
    
    function checkCollision(obj1X, obj1Y, obj1Size, obj2X, obj2Y, obj2Size) {
      const dx = obj1X - obj2X;
      const dy = obj1Y - obj2Y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist < obj1Size + obj2Size;
    }
    
    function update() {
      if (!gameStarted || gameOver) return;
      
      pulsePhase += 0.05;
      
      // Move player
      player.angle += speed * player.direction;
      
      const playerX = centerX + Math.cos(player.angle) * player.radius;
      const playerY = centerY + Math.sin(player.angle) * player.radius;
      
      // Trail
      trail.push({ x: playerX, y: playerY, life: 1 });
      if (trail.length > 30) trail.shift();
      trail.forEach(t => t.life -= 0.03);
      
      // Spawn obstacles
      if (Math.random() < 0.01 + score * 0.001) {
        spawnObstacle();
      }
      
      // Update obstacles
      obstacles.forEach(obs => {
        obs.angle += obs.speed;
        
        const obsX = centerX + Math.cos(obs.angle) * obs.radius;
        const obsY = centerY + Math.sin(obs.angle) * obs.radius;
        
        if (checkCollision(playerX, playerY, player.size, obsX, obsY, obs.size)) {
          endGame();
        }
      });
      
      // Remove far obstacles
      obstacles = obstacles.filter(obs => {
        const dist = Math.abs(obs.radius - player.radius);
        return dist < 100;
      });
      
      // Update stars
      stars.forEach((star, i) => {
        star.pulse += 0.1;
        
        const starX = centerX + Math.cos(star.angle) * star.radius;
        const starY = centerY + Math.sin(star.angle) * star.radius;
        
        if (checkCollision(playerX, playerY, player.size, starX, starY, star.size)) {
          score++;
          scoreEl.textContent = score;
          speed = 0.03 + score * 0.002;
          spawnParticles(starX, starY, colors.star, 15);
          stars.splice(i, 1);
          
          // Spawn new star
          setTimeout(spawnStar, 500);
        }
      });
      
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
      
      const playerX = centerX + Math.cos(player.angle) * player.radius;
      const playerY = centerY + Math.sin(player.angle) * player.radius;
      spawnParticles(playerX, playerY, colors.obstacle, 30);
      
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'gameOver', score }));
      }
    }
    
    function draw() {
      // Clear
      ctx.fillStyle = '#0a0a1a';
      ctx.fillRect(0, 0, W, H);
      
      // Draw background stars
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      for (let i = 0; i < 50; i++) {
        const x = (i * 137.5) % W;
        const y = (i * 73.3) % H;
        const size = 1 + Math.sin(pulsePhase + i) * 0.5;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      }
      
      // Draw orbit ring
      ctx.strokeStyle = colors.orbit;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, player.radius, 0, Math.PI * 2);
      ctx.stroke();
      
      // Draw center planet
      const planetPulse = 1 + Math.sin(pulsePhase) * 0.05;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 30 * planetPulse, 0, Math.PI * 2);
      ctx.fillStyle = '#2d3436';
      ctx.shadowColor = '#636e72';
      ctx.shadowBlur = 20;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Draw trail
      trail.forEach((t, i) => {
        ctx.beginPath();
        ctx.arc(t.x, t.y, player.size * t.life * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = \`rgba(9, 132, 227, \${t.life * 0.4})\`;
        ctx.fill();
      });
      
      // Draw obstacles
      obstacles.forEach(obs => {
        const obsX = centerX + Math.cos(obs.angle) * obs.radius;
        const obsY = centerY + Math.sin(obs.angle) * obs.radius;
        
        ctx.beginPath();
        ctx.arc(obsX, obsY, obs.size, 0, Math.PI * 2);
        ctx.fillStyle = obs.color;
        ctx.shadowColor = obs.color;
        ctx.shadowBlur = 15;
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      
      // Draw stars
      stars.forEach(star => {
        const starX = centerX + Math.cos(star.angle) * star.radius;
        const starY = centerY + Math.sin(star.angle) * star.radius;
        const starPulse = 1 + Math.sin(star.pulse) * 0.2;
        
        // Star shape
        ctx.save();
        ctx.translate(starX, starY);
        ctx.rotate(star.pulse * 0.5);
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? star.size * starPulse : star.size * 0.5 * starPulse;
          if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
          else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
        }
        ctx.closePath();
        ctx.fillStyle = colors.star;
        ctx.shadowColor = colors.star;
        ctx.shadowBlur = 20;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      });
      
      // Draw player
      const playerX = centerX + Math.cos(player.angle) * player.radius;
      const playerY = centerY + Math.sin(player.angle) * player.radius;
      
      // Glow
      ctx.beginPath();
      ctx.arc(playerX, playerY, player.size + 8, 0, Math.PI * 2);
      ctx.fillStyle = colors.playerGlow;
      ctx.fill();
      
      // Player
      ctx.beginPath();
      ctx.arc(playerX, playerY, player.size, 0, Math.PI * 2);
      ctx.fillStyle = colors.player;
      ctx.shadowColor = colors.player;
      ctx.shadowBlur = 25;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // Direction indicator
      ctx.save();
      ctx.translate(playerX, playerY);
      ctx.rotate(player.angle + (player.direction > 0 ? Math.PI/2 : -Math.PI/2));
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(-5, 5);
      ctx.lineTo(5, 5);
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
      });
      ctx.globalAlpha = 1;
    }
    
    function gameLoop() {
      update();
      draw();
      requestAnimationFrame(gameLoop);
    }
    
    document.addEventListener('touchstart', (e) => {
      e.preventDefault();
      switchDirection();
    });
    document.addEventListener('click', switchDirection);
    
    gameLoop();
  </script>
</body>
</html>
`;
