// Wish-studio AI mock — lets the full Create → Wish → Preview → live-edit flow
// run with the Railway backend down, so the UI/UX can be built and reviewed
// without a working model.
//
// Selected by AI_MODE / the backend-reachability probe in api.ts. When the
// backend is down (or AI_MODE is 'mock'), ai.generateSpec / refineSpec /
// dreamLabs / editGame return these canned responses (with realistic delays and
// progress telemetry) instead of hitting the network. Production builds are
// forced to 'live', so this never reaches a real user.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pull a plausible game title out of the user's brief. */
const titleFromPrompt = (prompt: string): string => {
  const cleaned = (prompt || '').replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 3);
  if (words.length === 0) return 'Neon Drifter';
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

const FEATURE_POOL = [
  'One-tap controls tuned for quick sessions',
  'Endless procedural waves that ramp in intensity',
  'Combo multiplier that rewards clean streaks',
  'Screen-shake + particle juice on every hit',
  'A punchy synth soundtrack that reacts to your score',
  'Boss encounter every tenth wave',
];

export const mockGenerateSpec = async (prompt: string) => {
  await wait(900);
  const title = titleFromPrompt(prompt);
  return {
    success: true,
    spec: {
      title,
      description: `${title} turns your idea — "${(prompt || '').slice(0, 80)}" — into a fast, replayable arcade run. Easy to pick up, hard to put down.`,
      structural: 'Vertical arcade loop: survive, score, chase the next best run.',
      features: FEATURE_POOL.slice(0, 4),
    },
  };
};

export const mockRefineSpec = async (
  _history: Array<{ role: 'ai' | 'user'; content: string }>,
  userMessage: string,
) => {
  await wait(750);
  const seedTitle =
    _history.find((h) => h.role === 'ai')?.content?.split(':')[0] || 'Neon Drifter';
  return {
    success: true,
    aiMessage: `Good call — I folded "${userMessage.slice(0, 60)}" into the concept.`,
    spec: {
      title: seedTitle,
      description: `Updated: now with ${userMessage.slice(0, 60)}. Same tight arcade loop, sharper hook.`,
      structural: 'Vertical arcade loop with your latest twist woven in.',
      features: [`Reflects your note: ${userMessage.slice(0, 40)}`, ...FEATURE_POOL.slice(0, 3)],
    },
  };
};

/** A tiny, fully self-contained, actually-playable preview game. */
const mockGameHtml = (name: string, accentNote = ''): string => `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
  html,body{margin:0;height:100%;background:#0a0a0f;overflow:hidden;font-family:-apple-system,system-ui,sans-serif;color:#fff;touch-action:none}
  #hud{position:fixed;top:14px;left:14px;font-size:15px;font-weight:700;letter-spacing:.3px;text-shadow:0 1px 4px #000}
  #title{position:fixed;top:14px;right:14px;font-size:13px;font-weight:700;color:#c084fc}
  #note{position:fixed;bottom:16px;left:0;right:0;text-align:center;font-size:12px;color:#8a8a99}
  canvas{display:block}
</style></head>
<body>
  <div id="hud">Score: 0</div>
  <div id="title">${name}</div>
  <div id="note">Tap the orbs · ${accentNote || 'mock preview'}</div>
  <canvas id="c"></canvas>
  <script>
    const c=document.getElementById('c'),x=c.getContext('2d');
    let W,H;function fit(){W=c.width=innerWidth;H=c.height=innerHeight;}fit();addEventListener('resize',fit);
    let score=0,orbs=[],t=0;
    const hud=document.getElementById('hud');
    function spawn(){orbs.push({x:40+Math.random()*(W-80),y:40+Math.random()*(H-120),r:22+Math.random()*14,h:Math.random()*360,life:1});}
    for(let i=0;i<5;i++)spawn();
    addEventListener('pointerdown',e=>{
      for(let i=orbs.length-1;i>=0;i--){const o=orbs[i];const d=Math.hypot(e.clientX-o.x,e.clientY-o.y);
        if(d<o.r+8){orbs.splice(i,1);score+=10;hud.textContent='Score: '+score;spawn();
          if(navigator.vibrate)navigator.vibrate(8);break;}}
    });
    function loop(){t+=0.016;x.fillStyle='#0a0a0f';x.fillRect(0,0,W,H);
      orbs.forEach(o=>{o.y+=Math.sin(t*2+o.x)*0.3;
        const g=x.createRadialGradient(o.x,o.y,2,o.x,o.y,o.r);
        g.addColorStop(0,'hsla('+o.h+',90%,70%,1)');g.addColorStop(1,'hsla('+o.h+',90%,45%,0)');
        x.fillStyle=g;x.beginPath();x.arc(o.x,o.y,o.r,0,7);x.fill();});
      requestAnimationFrame(loop);}
    loop();
  </script>
</body></html>`;

interface BuildOpts {
  onStatus?: (status: any) => void;
}

/** Shared progress-driven fake build used by dreamLabs + editGame. */
const runMockBuild = (
  name: string,
  totalMs: number,
  lines: string[],
  finalNote: string,
  opts?: BuildOpts,
) => {
  let canceled = false;
  const promise = new Promise<any>(async (resolve, reject) => {
    const start = Date.now();
    const tick = 350;
    while (Date.now() - start < totalMs) {
      if (canceled) {
        reject(new Error('aborted'));
        return;
      }
      const progress = Math.min(
        99,
        Math.round(((Date.now() - start) / totalMs) * 100),
      );
      const line = lines[Math.min(lines.length - 1, Math.floor(progress / (100 / lines.length)))];
      opts?.onStatus?.({ status: 'building', progress, statusMessage: line, phase: 'build' });
      await wait(tick);
    }
    if (canceled) {
      reject(new Error('aborted'));
      return;
    }
    opts?.onStatus?.({ status: 'complete', progress: 100, statusMessage: 'Done', phase: 'build' });
    resolve({
      status: 'complete',
      success: true,
      draftId: `mock_${Date.now().toString(36)}`,
      htmlPreview: mockGameHtml(name, finalNote),
    });
  });
  return { promise, cancel: () => { canceled = true; }, cancelRemote: () => { canceled = true; } };
};

export const mockDreamLabs = (
  prompt: string,
  _attachments: any[] = [],
  options?: BuildOpts,
) =>
  runMockBuild(
    titleFromPrompt(prompt),
    4200,
    [
      'Reading your idea...',
      'Writing game logic...',
      'Compiling physics...',
      'Rendering world...',
      'Generating audio...',
    ],
    'first build',
    options,
  );

export const mockPublish = async (_draftId: string, title?: string) => {
  await wait(1300);
  return {
    success: true,
    gameId: `mock_${Date.now().toString(36)}`,
    title: title || 'Your Game',
  };
};

export const mockEditGame = (
  _draftId: string,
  wish: string,
  _attachments: any[] = [],
  options?: BuildOpts,
) =>
  runMockBuild(
    'Your Game',
    2400,
    ['Making your wish real...', 'Rewiring the game...', 'Applying the change...'],
    wish.slice(0, 40),
    options,
  );
