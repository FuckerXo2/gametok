// Helix Jump - 3D spiral tower game
export const HelixJumpGame = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      overflow: hidden; 
      touch-action: none;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    }
    canvas { display: block; }
    #ui {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      padding: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      z-index: 10;
      pointer-events: none;
    }
    #score {
      font-size: 48px;
      font-weight: 800;
      color: white;
      text-shadow: 0 4px 20px rgba(0,0,0,0.5);
    }
    #highScore {
      font-size: 16px;
      color: rgba(255,255,255,0.7);
      font-weight: 600;
    }
    #combo {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 64px;
      font-weight: 900;
      color: #FFD93D;
      text-shadow: 0 0 40px #FFD93D, 0 0 80px #FF6B6B;
      opacity: 0;
      transition: opacity 0.2s, transform 0.2s;
      pointer-events: none;
      z-index: 20;
    }
    #combo.show {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1.2);
    }
    #startScreen {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(10px);
      color: white;
      z-index: 30;
    }
    #startScreen h1 { 
      font-size: 42px; 
      font-weight: 900;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #FFD93D, #FF6B6B);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    #startScreen p { 
      font-size: 16px; 
      opacity: 0.7; 
      margin-bottom: 40px;
    }
    #startScreen .tap { 
      font-size: 18px; 
      padding: 16px 48px;
      background: linear-gradient(135deg, #FFD93D, #FF6B6B);
      border-radius: 30px;
      font-weight: 700;
      color: #1a1a2e;
      animation: pulse 2s infinite;
    }
    @keyframes pulse { 
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255,217,61,0.7); } 
      50% { transform: scale(1.05); box-shadow: 0 0 0 15px rgba(255,217,61,0); } 
    }
    #gameOver {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,0.8);
      backdrop-filter: blur(10px);
      color: white;
      z-index: 30;
    }
    #gameOver h2 { 
      font-size: 32px; 
      margin-bottom: 10px;
      font-weight: 800;
    }
    #gameOver .score { 
      font-size: 72px; 
      font-weight: 900;
      background: linear-gradient(135deg, #FFD93D, #FF6B6B);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    #gameOver .best {
      font-size: 18px;
      opacity: 0.7;
      margin-bottom: 40px;
    }
    #gameOver .tap { 
      font-size: 18px;
      padding: 16px 48px;
      background: linear-gradient(135deg, #FFD93D, #FF6B6B);
      border-radius: 30px;
      font-weight: 700;
      color: #1a1a2e;
      animation: pulse 2s infinite;
    }
  </style>
</head>
<body>
  <div id="ui">
    <div>
      <div id="score">0</div>
      <div id="highScore">BEST: 0</div>
    </div>
  </div>
  <div id="combo"></div>
  <div id="startScreen">
    <h1>HELIX JUMP</h1>
    <p>Swipe to rotate • Drop through gaps</p>
    <div class="tap">TAP TO PLAY</div>
  </div>
  <div id="gameOver">
    <h2>GAME OVER</h2>
    <div class="score" id="finalScore">0</div>
    <div class="best" id="finalBest">BEST: 0</div>
    <div class="tap">TAP TO RETRY</div>
  </div>
  
  <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
  <script>
    // Game elements
    const scoreEl = document.getElementById('score');
    const highScoreEl = document.getElementById('highScore');
    const comboEl = document.getElementById('combo');
    const startScreen = document.getElementById('startScreen');
    const gameOverScreen = document.getElementById('gameOver');
    const finalScoreEl = document.getElementById('finalScore');
    const finalBestEl = document.getElementById('finalBest');
    
    // Three.js setup
    let scene, camera, renderer;
    let tower, ball, pole;
    let platforms = [];
    let particles = [];
    
    // Game state
    let score = 0;
    let highScore = 0;
    let combo = 0;
    let gameStarted = false;
    let gameOver = false;
    let ballVelocity = 0;
    let towerRotation = 0;
    let targetRotation = 0;
    let lastPlatformY = 0;
    let cameraTargetY = 0;
    
    // Touch handling
    let touchStartX = 0;
    let isDragging = false;
    
    // Colors
    const COLORS = {
      ball: 0xFFD93D,
      safe: 0x4ECDC4,
      danger: 0xFF6B6B,
      pole: 0x2C3E50,
      platform: 0x34495E,
      particle: 0xFFD93D
    };
    
    // Platform config
    const PLATFORM_HEIGHT = 0.4;
    const PLATFORM_GAP = 2.5;
    const PLATFORM_INNER = 0.8;
    const PLATFORM_OUTER = 3.5;
    const NUM_SEGMENTS = 8;
    const GAP_SIZE = 2; // segments
    
    function init() {
      // Scene
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x1a1a2e);
      scene.fog = new THREE.Fog(0x1a1a2e, 10, 50);
      
      // Camera
      camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
      camera.position.set(0, 8, 12);
      camera.lookAt(0, 0, 0);
      
      // Renderer
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      document.body.appendChild(renderer.domElement);
      
      // Lights
      const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
      scene.add(ambientLight);
      
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 20, 10);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      scene.add(directionalLight);
      
      // Create tower group
      tower = new THREE.Group();
      scene.add(tower);
      
      // Create pole
      const poleGeometry = new THREE.CylinderGeometry(0.3, 0.3, 100, 16);
      const poleMaterial = new THREE.MeshStandardMaterial({ 
        color: COLORS.pole,
        metalness: 0.3,
        roughness: 0.7
      });
      pole = new THREE.Mesh(poleGeometry, poleMaterial);
      pole.position.y = -50;
      pole.castShadow = true;
      tower.add(pole);
      
      // Create ball
      const ballGeometry = new THREE.SphereGeometry(0.5, 32, 32);
      const ballMaterial = new THREE.MeshStandardMaterial({ 
        color: COLORS.ball,
        metalness: 0.4,
        roughness: 0.3,
        emissive: COLORS.ball,
        emissiveIntensity: 0.3
      });
      ball = new THREE.Mesh(ballGeometry, ballMaterial);
      ball.position.y = 5;
      ball.castShadow = true;
      scene.add(ball);
      
      // Generate initial platforms
      generatePlatforms(30);
      
      // Event listeners
      window.addEventListener('resize', onResize);
      document.addEventListener('touchstart', onTouchStart);
      document.addEventListener('touchmove', onTouchMove);
      document.addEventListener('touchend', onTouchEnd);
      document.addEventListener('mousedown', onMouseDown);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
      
      animate();
    }
    
    function createPlatformRing(y, gapStart, hasDanger = true) {
      const ring = new THREE.Group();
      ring.userData.y = y;
      ring.userData.passed = false;
      ring.userData.gapStart = gapStart;
      ring.userData.hasDanger = hasDanger;
      
      for (let i = 0; i < NUM_SEGMENTS; i++) {
        const isGap = i >= gapStart && i < gapStart + GAP_SIZE;
        if (isGap) continue;
        
        const isDanger = hasDanger && (i === (gapStart - 1 + NUM_SEGMENTS) % NUM_SEGMENTS || 
                                        i === (gapStart + GAP_SIZE) % NUM_SEGMENTS);
        
        const segmentAngle = (Math.PI * 2) / NUM_SEGMENTS;
        const startAngle = i * segmentAngle;
        const endAngle = (i + 1) * segmentAngle;
        
        const shape = new THREE.Shape();
        shape.moveTo(Math.cos(startAngle) * PLATFORM_INNER, Math.sin(startAngle) * PLATFORM_INNER);
        shape.lineTo(Math.cos(startAngle) * PLATFORM_OUTER, Math.sin(startAngle) * PLATFORM_OUTER);
        shape.absarc(0, 0, PLATFORM_OUTER, startAngle, endAngle, false);
        shape.lineTo(Math.cos(endAngle) * PLATFORM_INNER, Math.sin(endAngle) * PLATFORM_INNER);
        shape.absarc(0, 0, PLATFORM_INNER, endAngle, startAngle, true);
        
        const extrudeSettings = { depth: PLATFORM_HEIGHT, bevelEnabled: false };
        const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geometry.rotateX(Math.PI / 2);
        
        const material = new THREE.MeshStandardMaterial({
          color: isDanger ? COLORS.danger : COLORS.safe,
          metalness: 0.2,
          roughness: 0.8
        });
        
        const segment = new THREE.Mesh(geometry, material);
        segment.position.y = y;
        segment.castShadow = true;
        segment.receiveShadow = true;
        segment.userData.isDanger = isDanger;
        
        ring.add(segment);
      }
      
      return ring;
    }
    
    function generatePlatforms(count) {
      for (let i = 0; i < count; i++) {
        const y = lastPlatformY - PLATFORM_GAP;
        const gapStart = Math.floor(Math.random() * NUM_SEGMENTS);
        const hasDanger = Math.random() > 0.3;
        
        const ring = createPlatformRing(y, gapStart, hasDanger);
        tower.add(ring);
        platforms.push(ring);
        lastPlatformY = y;
      }
    }
    
    function spawnParticles(position, color, count = 15) {
      for (let i = 0; i < count; i++) {
        const geometry = new THREE.SphereGeometry(0.1, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: color });
        const particle = new THREE.Mesh(geometry, material);
        
        particle.position.copy(position);
        particle.userData.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.3,
          Math.random() * 0.2,
          (Math.random() - 0.5) * 0.3
        );
        particle.userData.life = 1;
        
        scene.add(particle);
        particles.push(particle);
      }
    }
    
    function showCombo(num) {
      comboEl.textContent = 'x' + num;
      comboEl.classList.add('show');
      setTimeout(() => comboEl.classList.remove('show'), 300);
    }
    
    function checkCollision() {
      const ballY = ball.position.y;
      const ballRadius = 0.5;
      
      for (const ring of platforms) {
        const platformY = ring.userData.y;
        
        // Check if ball is at platform level
        if (ballY - ballRadius <= platformY + PLATFORM_HEIGHT && 
            ballY - ballRadius >= platformY - 0.1 &&
            ballVelocity < 0) {
          
          // Get ball angle relative to tower rotation
          const ballAngle = ((-towerRotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          const segmentAngle = (Math.PI * 2) / NUM_SEGMENTS;
          const ballSegment = Math.floor(ballAngle / segmentAngle);
          
          const gapStart = ring.userData.gapStart;
          const isInGap = ballSegment >= gapStart && ballSegment < gapStart + GAP_SIZE;
          
          if (isInGap) {
            // Passed through gap
            if (!ring.userData.passed) {
              ring.userData.passed = true;
              score++;
              combo++;
              scoreEl.textContent = score;
              
              if (combo > 1) {
                showCombo(combo);
                score += combo - 1;
                scoreEl.textContent = score;
              }
              
              spawnParticles(ball.position.clone(), COLORS.particle);
              
              // Notify React Native
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'score', score }));
              }
            }
            return false;
          } else {
            // Check if hit danger segment
            for (const segment of ring.children) {
              if (segment.userData.isDanger) {
                const segAngle = Math.atan2(segment.position.z, segment.position.x);
                const angleDiff = Math.abs(ballAngle - ((segAngle + Math.PI * 2) % (Math.PI * 2)));
                if (angleDiff < segmentAngle || angleDiff > Math.PI * 2 - segmentAngle) {
                  return 'danger';
                }
              }
            }
            
            // Hit safe platform - bounce
            combo = 0;
            return 'safe';
          }
        }
      }
      
      return false;
    }
    
    function endGame() {
      gameOver = true;
      if (score > highScore) {
        highScore = score;
        highScoreEl.textContent = 'BEST: ' + highScore;
      }
      finalScoreEl.textContent = score;
      finalBestEl.textContent = 'BEST: ' + highScore;
      gameOverScreen.style.display = 'flex';
      
      spawnParticles(ball.position.clone(), COLORS.danger, 30);
      
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'gameOver', score }));
      }
    }
    
    function resetGame() {
      score = 0;
      combo = 0;
      ballVelocity = 0;
      towerRotation = 0;
      targetRotation = 0;
      lastPlatformY = 0;
      cameraTargetY = 0;
      gameOver = false;
      
      scoreEl.textContent = '0';
      gameOverScreen.style.display = 'none';
      
      // Clear platforms
      platforms.forEach(p => tower.remove(p));
      platforms = [];
      
      // Clear particles
      particles.forEach(p => scene.remove(p));
      particles = [];
      
      // Reset ball
      ball.position.set(0, 5, 0);
      tower.rotation.y = 0;
      camera.position.y = 8;
      
      // Generate new platforms
      generatePlatforms(30);
    }
    
    function update() {
      if (!gameStarted || gameOver) return;
      
      // Apply gravity
      ballVelocity -= 0.015;
      ball.position.y += ballVelocity;
      
      // Smooth tower rotation
      towerRotation += (targetRotation - towerRotation) * 0.15;
      tower.rotation.y = towerRotation;
      
      // Check collision
      const collision = checkCollision();
      if (collision === 'danger') {
        endGame();
        return;
      } else if (collision === 'safe') {
        ballVelocity = 0.2; // Bounce
        ball.position.y += 0.1;
      }
      
      // Camera follow
      cameraTargetY = ball.position.y + 5;
      camera.position.y += (cameraTargetY - camera.position.y) * 0.1;
      camera.lookAt(0, ball.position.y - 2, 0);
      
      // Generate more platforms
      if (ball.position.y < lastPlatformY + 20) {
        generatePlatforms(10);
      }
      
      // Remove passed platforms
      platforms = platforms.filter(p => {
        if (p.userData.y > ball.position.y + 10) {
          tower.remove(p);
          return false;
        }
        return true;
      });
      
      // Update particles
      particles = particles.filter(p => {
        p.position.add(p.userData.velocity);
        p.userData.velocity.y -= 0.01;
        p.userData.life -= 0.03;
        p.scale.setScalar(p.userData.life);
        
        if (p.userData.life <= 0) {
          scene.remove(p);
          return false;
        }
        return true;
      });
      
      // Ball rotation for visual effect
      ball.rotation.x += 0.1;
    }
    
    function animate() {
      requestAnimationFrame(animate);
      update();
      renderer.render(scene, camera);
    }
    
    function onResize() {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    function onTouchStart(e) {
      if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        return;
      }
      if (gameOver) {
        resetGame();
        return;
      }
      touchStartX = e.touches[0].clientX;
      isDragging = true;
    }
    
    function onTouchMove(e) {
      if (!isDragging || !gameStarted || gameOver) return;
      const deltaX = e.touches[0].clientX - touchStartX;
      targetRotation += deltaX * 0.01;
      touchStartX = e.touches[0].clientX;
    }
    
    function onTouchEnd() {
      isDragging = false;
    }
    
    function onMouseDown(e) {
      if (!gameStarted) {
        gameStarted = true;
        startScreen.style.display = 'none';
        return;
      }
      if (gameOver) {
        resetGame();
        return;
      }
      touchStartX = e.clientX;
      isDragging = true;
    }
    
    function onMouseMove(e) {
      if (!isDragging || !gameStarted || gameOver) return;
      const deltaX = e.clientX - touchStartX;
      targetRotation += deltaX * 0.01;
      touchStartX = e.clientX;
    }
    
    function onMouseUp() {
      isDragging = false;
    }
    
    // Start
    init();
  </script>
</body>
</html>
`;
