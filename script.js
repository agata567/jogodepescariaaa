
(() => {
  const canvas = document.getElementById('gameCanvas');
  const ctx = canvas.getContext('2d');
  const $ = (id) => document.getElementById(id);
  const ui = {
    score: $('score'), timer: $('timer'), level: $('level'), speedLabel: $('speedLabel'),
    targetBin: $('targetBin'), targetSymbol: $('targetSymbol'), targetName: $('targetName'),
    targetHint: $('targetHint'), overlay: $('overlay'), overlayTitle: $('overlayTitle'),
    overlayText: $('overlayText'), overlayButton: $('overlayButton'), startButton: $('startButton'),
    message: $('message')
  };

  const W = canvas.width, H = canvas.height;
  const riverTop = 128, riverBottom = 505;
  const types = {
    paper: { name: 'PAPEL', hint: 'Caixas de papelão', color: '#167bd0', className: 'blue', symbol: '▤', emoji: '📦' },
    plastic: { name: 'PLÁSTICO', hint: 'Sacolas plásticas', color: '#e94b4b', className: 'red', symbol: '♻', emoji: '🛍️' },
    metal: { name: 'METAL', hint: 'Latas de bebidas', color: '#f4c331', className: 'yellow', symbol: '♻', emoji: '🥫' }
  };
  const typeKeys = Object.keys(types);
  const keys = {};
  let running = false, ended = false, score = 0, remaining = 180, elapsed = 0;
  let lastFrame = 0, spawnTimer = 0, targetType = 'paper', objects = [], particles = [], waveOffset = 0;
  let messageTimer = 0;
  const hook = { x: 260, y: 275, r: 19, speed: 260, angle: 0 };

  function chooseTarget() {
    targetType = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const t = types[targetType];
    ui.targetBin.className = 'bin ' + t.className;
    ui.targetSymbol.textContent = t.symbol;
    ui.targetName.textContent = t.name;
    ui.targetHint.textContent = t.hint;
  }

  function updateHud() {
    ui.score.textContent = score;
    const sec = Math.max(0, Math.ceil(remaining));
    ui.timer.textContent = String(Math.floor(sec / 60)).padStart(2, '0') + ':' + String(sec % 60).padStart(2, '0');
    const level = Math.min(4, 1 + Math.floor(elapsed / 45));
    ui.level.textContent = level;
    ui.speedLabel.textContent = ['Velocidade tranquila', 'O rio está mais rápido!', 'Correnteza acelerada!', 'Desafio máximo!'][level - 1];
  }

  function startGame() {
    score = 0; remaining = 180; elapsed = 0; spawnTimer = 0; objects = []; particles = [];
    hook.x = 250; hook.y = 275; hook.angle = 0; ended = false; running = true;
    chooseTarget(); updateHud();
    ui.overlay.classList.add('hidden');
    ui.startButton.textContent = 'Reiniciar jogo';
    ui.message.textContent = 'Boa pescaria! Recolha apenas o material indicado.';
    lastFrame = performance.now();
    requestAnimationFrame(loop);
  }

  function endGame() {
    running = false; ended = true;
    ui.overlayTitle.textContent = '⏰ Fim de jogo!';
    ui.overlayText.textContent = `Você terminou com ${score} ponto${score === 1 ? '' : 's'}. Obrigado por ajudar a cuidar do rio!`;
    ui.overlayButton.textContent = 'Jogar novamente';
    ui.overlay.classList.remove('hidden');
    ui.message.textContent = 'Partida encerrada. Tente novamente para melhorar sua pontuação.';
  }

  function spawnObject() {
    const roll = Math.random();
    let type;
    if (roll < 0.20) type = 'fish';
    else type = typeKeys[Math.floor(Math.random() * typeKeys.length)];
    const size = type === 'fish' ? 23 : 24 + Math.random() * 5;
    objects.push({
      type, x: W + 35, y: riverTop + 28 + Math.random() * (riverBottom - riverTop - 65),
      size, phase: Math.random() * Math.PI * 2, caught: false,
      drift: (Math.random() * 14 - 7)
    });
  }

  function showMessage(text, good = true) {
    ui.message.textContent = text;
    ui.message.style.color = good ? '#16815d' : '#c34242';
    messageTimer = 1.8;
  }

  function burst(x, y, color, text) {
    particles.push({ x, y, color, text, life: 0.8, maxLife: 0.8 });
  }

  function catchObject(o) {
    o.caught = true;
    if (o.type === 'fish') {
      score = Math.max(0, score - 1);
      burst(o.x, o.y, '#ffcf62', '🐟 −1');
      showMessage('Ops! Peixe livre! Você perdeu 1 ponto.', false);
    } else if (o.type === targetType) {
      score += 1;
      burst(o.x, o.y, '#fff36d', '+1');
      showMessage('Muito bem! Material correto: +1 ponto!');
      chooseTarget();
    } else {
      burst(o.x, o.y, '#e6f8ff', 'Quase!');
      showMessage('Esse material não é o indicado. Continue tentando.', false);
    }
    updateHud();
  }

  function update(dt) {
    elapsed += dt;
    remaining -= dt;
    if (remaining <= 0) { remaining = 0; updateHud(); endGame(); return; }
    waveOffset += dt * (1.2 + elapsed / 45 * .35);
    const level = Math.min(4, 1 + Math.floor(elapsed / 45));
    const speedScale = 1 + (level - 1) * 0.38;
    const dx = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
    const dy = (keys.ArrowDown ? 1 : 0) - (keys.ArrowUp ? 1 : 0);
    const length = Math.hypot(dx, dy) || 1;
    hook.x += dx / length * hook.speed * dt;
    hook.y += dy / length * hook.speed * dt;
    hook.x = Math.max(90, Math.min(W - 35, hook.x));
    hook.y = Math.max(riverTop + 18, Math.min(riverBottom - 20, hook.y));
    hook.angle = Math.atan2(dy, dx) * .12;

    spawnTimer += dt;
    const spawnEvery = Math.max(.52, 1.25 - (level - 1) * .16);
    if (spawnTimer >= spawnEvery) { spawnTimer = 0; spawnObject(); }

    for (const o of objects) {
      if (o.caught) continue;
      o.x -= (75 + level * 19) * speedScale * dt;
      o.y += Math.sin(elapsed * 2 + o.phase) * o.drift * dt;
      o.phase += dt * 2;
      const rr = hook.r + o.size * .68;
      if (Math.hypot(o.x - hook.x, o.y - hook.y) < rr) catchObject(o);
    }
    objects = objects.filter(o => !o.caught && o.x > -50);
    particles.forEach(p => { p.life -= dt; p.y -= 28 * dt; });
    particles = particles.filter(p => p.life > 0);
    if (messageTimer > 0) { messageTimer -= dt; if (messageTimer <= 0) ui.message.style.color = '#16815d'; }
    updateHud();
  }

  function roundedRect(x, y, w, h, r, fill, stroke) {
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
  }

  function drawBackground() {
    // Céu e margens
    const sky = ctx.createLinearGradient(0, 0, 0, riverTop);
    sky.addColorStop(0, '#8be0f2'); sky.addColorStop(1, '#d6f8f2');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, riverTop);
    // Nuvens
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    [[100,38],[390,55],[750,32],[900,72]].forEach(([x,y],i) => {
      ctx.beginPath(); ctx.arc(x + Math.sin(elapsed * .15 + i) * 7,y,17,0,Math.PI*2);
      ctx.arc(x+20,y-8,22,0,Math.PI*2); ctx.arc(x+42,y,16,0,Math.PI*2); ctx.fill();
    });
    // Margem superior e grama
    ctx.fillStyle = '#7bc96f'; ctx.fillRect(0, 100, W, 31);
    ctx.fillStyle = '#3caa68';
    for (let x = 0; x < W; x += 24) {
      ctx.beginPath(); ctx.moveTo(x, 130); ctx.lineTo(x+7, 115 - (x%3)*2); ctx.lineTo(x+14,130); ctx.fill();
    }
    // Água
    const water = ctx.createLinearGradient(0, riverTop, 0, riverBottom);
    water.addColorStop(0, '#50c7e8'); water.addColorStop(.55, '#168dc5'); water.addColorStop(1, '#0879ac');
    ctx.fillStyle = water; ctx.fillRect(0, riverTop, W, riverBottom-riverTop);
    // Correntes onduladas
    for (let row=0; row<8; row++) {
      ctx.beginPath();
      for (let x=-40; x<=W+40; x+=12) {
        const y = riverTop + 18 + row*45 + Math.sin(x*.025 + waveOffset*2 + row)*5;
        if (x===-40) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      ctx.strokeStyle = row%2 ? 'rgba(210,250,255,.24)' : 'rgba(255,255,255,.33)';
      ctx.lineWidth = row%2 ? 2 : 3; ctx.stroke();
    }
    // Margem inferior
    ctx.fillStyle = '#b8e28a'; ctx.fillRect(0, riverBottom, W, H-riverBottom);
    ctx.fillStyle = '#73bf61'; ctx.fillRect(0, riverBottom, W, 9);
    for (let x=10; x<W; x+=32) {
      ctx.fillStyle = x%2 ? '#459f58' : '#5bb66a';
      ctx.beginPath(); ctx.ellipse(x, riverBottom+17, 12, 5, -.3, 0, Math.PI*2); ctx.fill();
    }
    // Letrinha na margem
    roundedRect(20, 18, 165, 58, 12, 'rgba(255,255,255,.78)', 'rgba(255,255,255,.9)');
    ctx.fillStyle = '#23586d'; ctx.font = '900 13px Nunito, sans-serif'; ctx.fillText('RIO LIMPO,', 34, 41);
    ctx.fillText('FUTURO FELIZ!', 34, 59);
  }

  function drawObject(o) {
    ctx.save(); ctx.translate(o.x, o.y + Math.sin(o.phase*2)*2);
    if (o.type === 'fish') {
      ctx.fillStyle = '#ff9f43';
      ctx.beginPath(); ctx.ellipse(0,0,22,13,0,0,Math.PI*2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-18,0); ctx.lineTo(-31,-12); ctx.lineTo(-31,12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd18d'; ctx.beginPath(); ctx.ellipse(4,4,11,5,.1,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(11,-4,4.5,0,Math.PI*2); ctx.fill();
      ctx.fillStyle = '#14344a'; ctx.beginPath(); ctx.arc(12,-4,2,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = '#b65c20'; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(20,2,5,-1,1); ctx.stroke();
    } else if (o.type === 'metal') {
      // Lata de bebida
      roundedRect(-13,-19,26,38,5,'#f4c331','#a77b12');
      ctx.fillStyle = '#fff0a0'; ctx.fillRect(-9,-14,18,5);
      ctx.fillStyle = '#b57d09'; ctx.font='900 10px Nunito'; ctx.textAlign='center'; ctx.fillText('REC',0,3);
      ctx.strokeStyle='#fff2ae'; ctx.lineWidth=2; ctx.beginPath(); ctx.ellipse(0,-18,7,2.5,0,0,Math.PI*2); ctx.stroke();
    } else if (o.type === 'plastic') {
      // Sacola plástica
      ctx.fillStyle = '#f15d66'; ctx.strokeStyle = '#b72d43'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-17,-11); ctx.lineTo(-10,-7); ctx.lineTo(-7,-18); ctx.lineTo(0,-18); ctx.lineTo(5,-7); ctx.lineTo(16,-12); ctx.lineTo(13,17); ctx.quadraticCurveTo(0,22,-13,17); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(-3,-17,4,Math.PI,0); ctx.stroke(); ctx.beginPath(); ctx.arc(7,-17,4,Math.PI,0); ctx.stroke();
      ctx.fillStyle='#fff'; ctx.font='900 11px Nunito'; ctx.textAlign='center'; ctx.fillText('♻',0,7);
    } else {
      // Caixa de papelão
      ctx.fillStyle='#c68b50'; ctx.strokeStyle='#86562f'; ctx.lineWidth=2;
      ctx.beginPath(); ctx.moveTo(-18,-12); ctx.lineTo(-3,-20); ctx.lineTo(18,-12); ctx.lineTo(18,14); ctx.lineTo(0,21); ctx.lineTo(-18,13); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle='#f0c18b'; ctx.beginPath(); ctx.moveTo(-3,-20); ctx.lineTo(-2,6); ctx.lineTo(0,21); ctx.moveTo(-18,-12); ctx.lineTo(-2,-4); ctx.lineTo(18,-12); ctx.stroke();
      ctx.fillStyle='#fff0d9'; ctx.font='900 10px Nunito'; ctx.textAlign='center'; ctx.fillText('PAPEL',0,8);
    }
    ctx.restore();
  }

  function drawHook() {
    // Vara móvel cartoon e linha até o anzol. A posição controlada é a ponta/anzol.
    ctx.save();
    ctx.lineCap='round'; ctx.lineJoin='round';
    const rodX = Math.max(12, hook.x - 95), rodY = Math.max(20, hook.y - 115);
    ctx.strokeStyle='#754522'; ctx.lineWidth=9;
    ctx.beginPath(); ctx.moveTo(rodX,rodY); ctx.quadraticCurveTo(rodX+38,rodY+18,hook.x,hook.y-8); ctx.stroke();
    ctx.strokeStyle='#f8d38a'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.moveTo(rodX+4,rodY+2); ctx.quadraticCurveTo(rodX+40,rodY+19,hook.x,hook.y-8); ctx.stroke();
    ctx.strokeStyle='#f5f8ff'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(hook.x,hook.y-8); ctx.lineTo(hook.x,hook.y+8); ctx.stroke();
    ctx.strokeStyle='#f3f5f5'; ctx.lineWidth=4;
    ctx.beginPath(); ctx.moveTo(hook.x,hook.y+5); ctx.lineTo(hook.x+3,hook.y+14); ctx.quadraticCurveTo(hook.x+16,hook.y+20,hook.x+12,hook.y+7); ctx.stroke();
    ctx.strokeStyle='#3d6474'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(hook.x,hook.y,hook.r+8,0,Math.PI*2); ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.save(); ctx.globalAlpha = Math.max(0,p.life/p.maxLife);
      ctx.font='900 19px Nunito, sans-serif'; ctx.textAlign='center'; ctx.fillStyle=p.color;
      ctx.shadowColor='rgba(0,0,0,.25)'; ctx.shadowBlur=3; ctx.fillText(p.text,p.x,p.y);
      ctx.restore();
    }
  }

  function draw() {
    drawBackground();
    // Peixes e lixo flutuando
    objects.forEach(drawObject);
    // Pequenas bolhas junto ao anzol
    ctx.fillStyle='rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(hook.x-18,hook.y+14,3+Math.sin(elapsed*4),0,Math.PI*2); ctx.fill();
    drawHook();
    drawParticles();
    if (!running && !ended) {
      ctx.fillStyle='rgba(17,61,80,.16)'; ctx.fillRect(0,riverTop,W,riverBottom-riverTop);
    }
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min((now-lastFrame)/1000, .035);
    lastFrame = now;
    update(dt);
    draw();
    if (running) requestAnimationFrame(loop);
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key)) e.preventDefault();
    keys[e.key] = true;
  });
  window.addEventListener('keyup', (e) => { keys[e.key] = false; });
  window.addEventListener('blur', () => { Object.keys(keys).forEach(k => keys[k] = false); });
  ui.startButton.addEventListener('click', startGame);
  ui.overlayButton.addEventListener('click', startGame);

  // Cena inicial estática com instruções; nenhum objeto é capturado antes do início.
  chooseTarget();
  draw();
})();