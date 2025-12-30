// Color Match - Fast-paced color reaction game
export const ColorMatchGame = `
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
    #gameOver .score { font-size: 64px; color: #E17055; margin-bottom: 10px; }
    #gameOver .tap { font-size: 20px; opacity: 0.7; margin-top: 30px; animation: pulse 1.5s infinite; }
    #buttons {
      position: absolute;
      bottom: 50px;
      left: 0;
      right: 0;
      display: flex;
      justify-content: center;
      gap: 20px;
      z-index: 10;
    }
    .color-btn {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      border: 4px solid rgba(255,255,255,0.3);
      cursor: pointer;
      transition: transform 0.1s, box-shadow 0.1s;
    }
    .color-btn:active {
      transform: scale(0.9);
    }
    .streak {
      position: absolute;
      font-size: 24px;
      font-weight: bold;
      color: #FDCB6E;
      text-shadow: 0 0 20px #FDCB6E;
      animation: streakPop 0.4s ease-out forwards;
      pointer-events: none;
      z-index: 15;
    }
    @keyframes streakPop {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.3) translateY(-20px); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="ui">
    <span id="score">0</span>
    <span id="highScore">Best: 0</span>
  </div>
  <div id="startScreen">
    <h1>🎨</h1>
    <h1>Color Match</h1>
    <p>Tap the button that matches the falling shape's color!</p>
    <span class="tap">TAP TO START</span>
  </div>
  <div id="gameOver">
    <h2>WRONG COLOR!</h2>
    <div class="score" id="finalScore">0</div>
    <span class="tap">TAP TO RETRY</span>
  </div>
  <canvas id="game"></canvas>
  <div id="buttons"></div>
  <script>
    const canvas = document.getElementById('game');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('highScore');
    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOver');
    const finalScoreEl = document.getElementById('finalScore');
    const buttonsContainer = document.getElementById('buttons');
    
    let W, H;
    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);
    
    // Colors
    const COLORS = [
      { name: 'red', hex: '#E17055' },
      { name: 'blue', hex: '#0984E3' },
      { name: 'green', hex: '#00B894' },
      { name: 'yellow', hex: '#FDCB6E' },
    ];
    
    // Game state
    let fallingShape = null;
    let particles = [];
    let score = 0;
    let highScore = 0;
    let streak = 0;
    let gameStarted = false;
    let gameOver = false;
    let speed = 3;
    let bgPulse = 0;
    let correctColor = null;
    
    // Create buttons
    COLORS.forEach((color, i) => {
      const btn = document.createElement('div');
      btn.className = 'color-btn';
      btn.style.backgroundColor = color.hex;
      btn.style.boxShadow = '0 0 20px ' + color.hex;
      btn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        handleColorTap(color.name);
      });
      btn.addEventListener('click', () => handleColorTap(color.name));
      buttonsContainer.appendChild(btn);
    });
    
    function spawnShape() {
      const colorIndex = Math.floor(Math.random() * COLORS.length);
      const shapes = ['circle', 'square', 'triangle', 'diamond'];
      
      fallingShape = {
        x: W / 2,
        y: -60,
        size: 50,
        color: COLORS[colorIndex],
        shape: shapes[Math.floor(Math.random() * shapes.length)],
        rotation: 0
      };
      correctColor = COLORS[colorIndex].name;
    }
    
    function handleColorTap(colorName) {
      if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        spawnShape();
        return;
      }
      if (gameOver) {
        resetGame();
        return;
      }
      if (!fallingShape) return;
      
      if (colorName === correctColor) {
        // Correct!
        score++;
        streak++;
        scoreEl.textContent = score;
        speed = 3 + score * 0.15;
        
        // Show streak
        if (streak > 1) {
          showStreak(streak);
        }
        
        spawnParticles(fallingShape.x, fallingShape.y, fallingShape.color.hex, 15);
        bgPulse = 1;
        spawnShape();
      } else {
        // Wrong!
        endGame();
      }
    }
    
    function showStreak(num) {
      const el = document.createElement('div');
      el.className = 'streak';
      el.textContent = num + 'x STREAK!';
      el.style.left = W/2 - 60 + 'px';
      el.style.top = H/2 - 100 + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 400);
    }
    
    function spawnParticles(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 15,
          vy: (Math.random() - 0.5) * 15,
          life: 1,
          color,
          size: Math.random() * 10 + 5
        });
      }
    }
    
    function resetGame() {
      score = 0;
      streak = 0;
      speed = 3;
      gameOver = false;
      particles = [];
      gameOverScreen.style.display = 'none';
      scoreEl.textContent = '0';
      spawnShape();
    }
    
    function endGame() {
      gameOver = true;
      streak = 0;
      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = 'Best: ' + highScore;
      }
      finalScoreEl.textContent = score;
      gameOverScreen.style.display = 'flex';
      spawnParticles(fallingShape.x, fallingShape.y, '#E17055', 30);
      fallingShape = null;
      
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'gameOver', score }));
      }
    }
    
    function update() {
      if (!gameStarted || gameOver) return;
      
      bgPulse *= 0.95;
      
      if (fallingShape) {
        fallingShape.y += speed;
        fallingShape.rotation += 0.03;
        
        // Missed the shape
        if (fallingShape.y > H - 150) {
          endGame();
        }
      }
      
      // Update particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life -= 0.025;
        p.vx *= 0.98;
      });
      particles = particles.filter(p => p.life > 0);
    }
    
    function drawShape(x, y, size, shape, color, rotation) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 30;
      
      switch(shape) {
        case 'circle':
          ctx.beginPath();
          ctx.arc(0, 0, size, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'square':
          ctx.fillRect(-size, -size, size * 2, size * 2);
          break;
        case 'triangle':
          ctx.beginPath();
          ctx.moveTo(0, -size);
          ctx.lineTo(-size, size);
          ctx.lineTo(size, size);
          ctx.closePath();
          ctx.fill();
          break;
        case 'diamond':
          ctx.beginPath();
          ctx.moveTo(0, -size);
          ctx.lineTo(size, 0);
          ctx.lineTo(0, size);
          ctx.lineTo(-size, 0);
          ctx.closePath();
          ctx.fill();
          break;
      }
      
      ctx.shadowBlur = 0;
      ctx.restore();
    }
    
    function draw() {
      // Background with pulse effect
      const pulseColor = fallingShape ? fallingShape.color.hex : '#E17055';
      ctx.fillStyle = '#1a1a2e';
      ctx.fillRect(0, 0, W, H);
      
      if (bgPulse > 0.1) {
        ctx.fillStyle = pulseColor;
        ctx.globalAlpha = bgPulse * 0.2;
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
      
      // Draw target zone
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, H - 180);
      ctx.lineTo(W, H - 180);
      ctx.stroke();
      
      // Draw falling shape
      if (fallingShape) {
        drawShape(
          fallingShape.x, 
          fallingShape.y, 
          fallingShape.size, 
          fallingShape.shape, 
          fallingShape.color.hex,
          fallingShape.rotation
        );
        
        // Draw glow trail
        for (let i = 1; i <= 5; i++) {
          ctx.globalAlpha = 0.1 * (1 - i/5);
          drawShape(
            fallingShape.x, 
            fallingShape.y - i * 15, 
            fallingShape.size * (1 - i * 0.1), 
            fallingShape.shape, 
            fallingShape.color.hex,
            fallingShape.rotation - i * 0.05
          );
        }
        ctx.globalAlpha = 1;
      }
      
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
    
    // Start screen tap
    startScreen.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        spawnShape();
      }
    });
    startScreen.addEventListener('click', () => {
      if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        spawnShape();
      }
    });
    
    gameOverScreen.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (gameOver) resetGame();
    });
    gameOverScreen.addEventListener('click', () => {
      if (gameOver) resetGame();
    });
    
    gameLoop();
  </script>
</body>
</html>
`;
