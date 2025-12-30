// Stack Tower - Time your drops perfectly to build the highest tower
export const StackTowerGame = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      background: linear-gradient(180deg, #0c0c1e 0%, #1a1a3e 100%); 
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
    #startScreen p { font-size: 18px; opacity: 0.7; margin-bottom: 30px; }
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
    #gameOver .score { font-size: 64px; color: #00CEC9; margin-bottom: 10px; }
    #gameOver .tap { font-size: 20px; opacity: 0.7; margin-top: 30px; animation: pulse 1.5s infinite; }
    .perfect {
      position: absolute;
      font-size: 32px;
      font-weight: bold;
      color: #FDCB6E;
      text-shadow: 0 0 20px #FDCB6E;
      animation: perfectPop 0.5s ease-out forwards;
      pointer-events: none;
      z-index: 15;
    }
    @keyframes perfectPop {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.5) translateY(-30px); opacity: 0; }
    }
  </style>
</head>
<body>
  <div id="ui">
    <span id="score">0</span>
    <span id="highScore">Best: 0</span>
  </div>
  <div id="startScreen">
    <h1>🏗️</h1>
    <h1>Stack Tower</h1>
    <p>Tap to drop. Perfect timing = bigger stack!</p>
    <span class="tap">TAP TO START</span>
  </div>
  <div id="gameOver">
    <h2>TOWER COLLAPSED</h2>
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
    let blocks = [];
    let currentBlock = null;
    let fallingPieces = [];
    let particles = [];
    let score = 0;
    let highScore = 0;
    let gameStarted = false;
    let gameOver = false;
    let cameraY = 0;
    let targetCameraY = 0;
    
    const BLOCK_HEIGHT = 40;
    const BASE_WIDTH = 200;
    const SPEED_BASE = 4;
    
    // Beautiful color palette
    const colors = [
      '#00CEC9', '#6C5CE7', '#E17055', '#FDCB6E', '#00B894',
      '#E84393', '#0984E3', '#FD79A8', '#55EFC4', '#A29BFE'
    ];
    
    function getBlockColor(index) {
      return colors[index % colors.length];
    }
    
    function initGame() {
      const baseBlock = {
        x: W / 2 - BASE_WIDTH / 2,
        y: H - 100,
        width: BASE_WIDTH,
        height: BLOCK_HEIGHT,
        color: getBlockColor(0)
      };
      blocks = [baseBlock];
      spawnNewBlock();
    }
    
    function spawnNewBlock() {
      const lastBlock = blocks[blocks.length - 1];
      const speed = SPEED_BASE + score * 0.3;
      const direction = score % 2 === 0 ? 1 : -1;
      
      currentBlock = {
        x: direction > 0 ? -lastBlock.width : W,
        y: lastBlock.y - BLOCK_HEIGHT,
        width: lastBlock.width,
        height: BLOCK_HEIGHT,
        color: getBlockColor(blocks.length),
        vx: speed * direction
      };
    }
    
    function dropBlock() {
      if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        initGame();
        return;
      }
      if (gameOver) {
        resetGame();
        return;
      }
      if (!currentBlock) return;
      
      const lastBlock = blocks[blocks.length - 1];
      
      // Calculate overlap
      const overlapLeft = Math.max(currentBlock.x, lastBlock.x);
      const overlapRight = Math.min(currentBlock.x + currentBlock.width, lastBlock.x + lastBlock.width);
      const overlapWidth = overlapRight - overlapLeft;
      
      if (overlapWidth <= 0) {
        // Missed completely
        endGame();
        return;
      }
      
      // Check for perfect drop
      const isPerfect = Math.abs(currentBlock.x - lastBlock.x) < 5;
      
      if (isPerfect) {
        // Perfect drop - keep full width
        currentBlock.x = lastBlock.x;
        currentBlock.width = lastBlock.width;
        showPerfect();
        spawnParticles(W/2, currentBlock.y, '#FDCB6E', 20);
      } else {
        // Create falling piece
        if (currentBlock.x < lastBlock.x) {
          // Piece falls off left
          fallingPieces.push({
            x: currentBlock.x,
            y: currentBlock.y,
            width: lastBlock.x - currentBlock.x,
            height: BLOCK_HEIGHT,
            color: currentBlock.color,
            vy: 0,
            vr: -0.1
          });
        } else if (currentBlock.x + currentBlock.width > lastBlock.x + lastBlock.width) {
          // Piece falls off right
          fallingPieces.push({
            x: lastBlock.x + lastBlock.width,
            y: currentBlock.y,
            width: (currentBlock.x + currentBlock.width) - (lastBlock.x + lastBlock.width),
            height: BLOCK_HEIGHT,
            color: currentBlock.color,
            vy: 0,
            vr: 0.1
          });
        }
        
        currentBlock.x = overlapLeft;
        currentBlock.width = overlapWidth;
      }
      
      // Add block to stack
      blocks.push({
        x: currentBlock.x,
        y: currentBlock.y,
        width: currentBlock.width,
        height: BLOCK_HEIGHT,
        color: currentBlock.color
      });
      
      score++;
      scoreEl.textContent = score;
      
      // Move camera up
      if (blocks.length > 5) {
        targetCameraY = (blocks.length - 5) * BLOCK_HEIGHT;
      }
      
      // Check if block too small
      if (currentBlock.width < 10) {
        endGame();
        return;
      }
      
      spawnNewBlock();
      spawnParticles(currentBlock.x + currentBlock.width/2, currentBlock.y, currentBlock.color, 10);
    }
    
    function showPerfect() {
      const perfect = document.createElement('div');
      perfect.className = 'perfect';
      perfect.textContent = 'PERFECT!';
      perfect.style.left = W/2 - 60 + 'px';
      perfect.style.top = H/2 + 'px';
      document.body.appendChild(perfect);
      setTimeout(() => perfect.remove(), 500);
    }
    
    function spawnParticles(x, y, color, count) {
      for (let i = 0; i < count; i++) {
        particles.push({
          x, y,
          vx: (Math.random() - 0.5) * 12,
          vy: (Math.random() - 0.5) * 12 - 5,
          life: 1,
          color,
          size: Math.random() * 8 + 3
        });
      }
    }
    
    function resetGame() {
      blocks = [];
      fallingPieces = [];
      particles = [];
      score = 0;
      cameraY = 0;
      targetCameraY = 0;
      gameOver = false;
      gameOverScreen.style.display = 'none';
      scoreEl.textContent = '0';
      initGame();
    }
    
    function endGame() {
      gameOver = true;
      currentBlock = null;
      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = 'Best: ' + highScore;
      }
      finalScoreEl.textContent = score;
      gameOverScreen.style.display = 'flex';
      
      // Make all blocks fall
      blocks.forEach((block, i) => {
        setTimeout(() => {
          fallingPieces.push({
            ...block,
            vy: -5,
            vr: (Math.random() - 0.5) * 0.3
          });
        }, i * 50);
      });
      blocks = [];
      
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'gameOver', score }));
      }
    }
    
    function update() {
      if (!gameStarted || gameOver) return;
      
      // Smooth camera
      cameraY += (targetCameraY - cameraY) * 0.1;
      
      // Move current block
      if (currentBlock) {
        currentBlock.x += currentBlock.vx;
        
        // Bounce off walls
        if (currentBlock.x <= 0 || currentBlock.x + currentBlock.width >= W) {
          currentBlock.vx *= -1;
        }
      }
      
      // Update falling pieces
      fallingPieces.forEach(piece => {
        piece.vy += 0.5;
        piece.y += piece.vy;
        piece.rotation = (piece.rotation || 0) + piece.vr;
      });
      fallingPieces = fallingPieces.filter(p => p.y < H + 200);
      
      // Update particles
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.3;
        p.life -= 0.02;
      });
      particles = particles.filter(p => p.life > 0);
    }
    
    function draw() {
      ctx.clearRect(0, 0, W, H);
      
      // Draw background gradient
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, '#0c0c1e');
      gradient.addColorStop(1, '#1a1a3e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);
      
      ctx.save();
      ctx.translate(0, cameraY);
      
      // Draw stacked blocks
      blocks.forEach((block, i) => {
        ctx.fillStyle = block.color;
        ctx.shadowColor = block.color;
        ctx.shadowBlur = 15;
        ctx.fillRect(block.x, block.y, block.width, block.height - 2);
        ctx.shadowBlur = 0;
        
        // Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.fillRect(block.x, block.y, block.width, 5);
      });
      
      // Draw current block
      if (currentBlock) {
        ctx.fillStyle = currentBlock.color;
        ctx.shadowColor = currentBlock.color;
        ctx.shadowBlur = 20;
        ctx.fillRect(currentBlock.x, currentBlock.y, currentBlock.width, currentBlock.height - 2);
        ctx.shadowBlur = 0;
        
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.fillRect(currentBlock.x, currentBlock.y, currentBlock.width, 5);
      }
      
      // Draw falling pieces
      fallingPieces.forEach(piece => {
        ctx.save();
        ctx.translate(piece.x + piece.width/2, piece.y + piece.height/2);
        ctx.rotate(piece.rotation || 0);
        ctx.fillStyle = piece.color;
        ctx.globalAlpha = 0.7;
        ctx.fillRect(-piece.width/2, -piece.height/2, piece.width, piece.height);
        ctx.restore();
      });
      ctx.globalAlpha = 1;
      
      ctx.restore();
      
      // Draw particles (not affected by camera)
      particles.forEach(p => {
        ctx.beginPath();
        ctx.arc(p.x, p.y + cameraY, p.size * p.life, 0, Math.PI * 2);
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
      dropBlock();
    });
    document.addEventListener('click', dropBlock);
    
    gameLoop();
  </script>
</body>
</html>
`;
