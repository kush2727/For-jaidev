/* ===========================================================
   For Jaidev — A Friendship Archive
   Scene engine · typewriter · particles · confetti · audio
   =========================================================== */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
  var TOTAL = scenes.length;
  var current = 0; // index into scenes[]
  var started = false;

  var progress = document.getElementById('progress');
  var progressFill = document.getElementById('progress-fill');
  var chapterTag = document.getElementById('chapter-tag');

  /* ---------- helpers ---------- */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $all(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  function updateChrome() {
    var pct = (current / (TOTAL - 1)) * 100;
    progressFill.style.width = pct + '%';
    chapterTag.textContent = (current + 1).toString().padStart(2, '0') + ' / ' + TOTAL;
  }

  /* ---------- typewriter ---------- */
  function typewrite(el, text, speed, done) {
    if (reduce) { el.textContent = text.replace(/\\n/g, '\n'); if (done) done(); return; }
    text = text.replace(/\\n/g, '\n');
    el.textContent = '';
    el.classList.add('typing');
    var i = 0;
    (function step() {
      if (i <= text.length) {
        el.textContent = text.slice(0, i);
        i++;
        var ch = text.charAt(i - 1);
        typeTick(ch); // soft keystroke sound
        var delay = ch === '\n' ? 260 : (ch === '.' || ch === ',') ? speed * 5 : speed;
        setTimeout(step, delay);
      } else {
        el.classList.remove('typing');
        if (done) done();
      }
    })();
  }

  /* ---------- per-scene activation ---------- */
  function revealButton(scene) {
    var b = $('.reveal-later', scene);
    if (b) b.classList.add('show');
  }

  function activateScene(idx) {
    var scene = scenes[idx];

    // reveal staggered items
    $all('.reveal', scene).forEach(function (el, i) {
      setTimeout(function () { el.classList.add('in'); }, 200 + i * 90);
    });

    // memories reel runs its own flow
    if (scene.classList.contains('scene--reel')) { startReel(scene); return; }

    startCounters(scene);                                   // no-op if no counters
    if (scene.hasAttribute('data-celebrate')) burstConfetti(120);

    // typewriter blocks
    var typers = $all('.typmax', scene);
    if (typers.length) {
      var idxT = 0;
      (function chain() {
        if (idxT >= typers.length) { revealButton(scene); return; }
        var t = typers[idxT++];
        typewrite(t, t.getAttribute('data-type') || '', 34, chain);
      })();
    } else {
      setTimeout(function () { revealButton(scene); }, 700);
    }
  }

  /* ---------- scene navigation ---------- */
  function goTo(idx) {
    if (idx === current || idx < 0 || idx >= TOTAL) return;
    var cur = scenes[current];
    var nxt = scenes[idx];
    if (cur.classList.contains('scene--reel')) stopReel();
    cur.classList.add('is-leaving');
    cur.classList.remove('is-active');
    var wait = reduce ? 50 : 650; // emotional pause between scenes
    setTimeout(function () {
      cur.classList.remove('is-leaving');
      current = idx;
      nxt.classList.add('is-active');
      if (nxt.classList.contains('scene--scroll')) {
        var si = $('.scroll-inner', nxt); if (si) nxt.scrollTop = 0;
      }
      updateChrome();
      activateScene(idx);
    }, wait);
  }
  function next() { goTo(current + 1); }

  // wire data-next buttons
  $all('[data-next]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!started) firstStart();
      next();
    });
  });

  /* ---------- counters ---------- */
  function startCounters(scene) {
    $all('.stat-num[data-count]', scene).forEach(function (el) {
      if (el.dataset.ran) return; el.dataset.ran = '1';
      var target = parseInt(el.getAttribute('data-count'), 10);
      var suffix = el.getAttribute('data-suffix') || '';
      var dur = 1400, t0 = null;
      function tick(ts) {
        if (!t0) t0 = ts;
        var p = Math.min((ts - t0) / dur, 1);
        var eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  /* ---------- envelope (scene 7) ---------- */
  var envelope = document.getElementById('envelope');
  var envWrap = document.getElementById('env-wrap');
  if (envelope) {
    envelope.addEventListener('click', function () {
      if (envelope.classList.contains('open')) return;
      envelope.classList.add('open');                                   // flap opens
      var nb = document.getElementById('letter-next');
      setTimeout(function () { if (envWrap) envWrap.classList.add('show-letter'); }, reduce ? 100 : 700);
      setTimeout(function () { if (nb) nb.classList.add('show'); }, reduce ? 300 : 2700);
    });
  }

  /* ===========================================================
     MEMORIES REEL — auto-playing cinematic montage
     =========================================================== */
  var reelState = { i: -1, timer: 0, paused: false, active: false };
  function reelVideos() { return $all('.reel-slide--video video', document.getElementById('reel')); }
  function pauseReelVideos() { reelVideos().forEach(function (v) { try { v.pause(); } catch (e) {} }); }
  function stopReel() {
    clearTimeout(reelState.timer);
    reelState.active = false;
    pauseReelVideos();
    playReelMusic(false);                      // music is reel-only
    audioBtn.classList.add('hidden');
  }
  function startReel() {
    var reelEl = document.getElementById('reel');
    var slides = $all('.reel-slide', reelEl);
    var dotsWrap = document.getElementById('reel-dots');
    var fill = document.getElementById('reel-progress-fill');
    var hint = document.getElementById('reel-hint');
    var nextBtn = document.getElementById('reel-next');
    var PHOTO_MS = reduce ? 2000 : 2900;
    var VIDEO_FALLBACK = 9000;

    reelState.active = true;
    reelState.paused = false;
    reelState.i = -1;
    reelEl.classList.remove('paused');
    if (hint) hint.classList.remove('hide');
    audioBtn.classList.remove('hidden');       // mute control, reel only
    playReelMusic(true);                        // lofi soundtrack starts with the reel

    // build dots once
    if (dotsWrap.childElementCount !== slides.length) {
      dotsWrap.innerHTML = '';
      slides.forEach(function (_, k) {
        var d = document.createElement('i');
        d.addEventListener('click', function (ev) { ev.stopPropagation(); show(k); });
        dotsWrap.appendChild(d);
      });
    }
    var dots = $all('i', dotsWrap);

    function schedule(ms) {
      clearTimeout(reelState.timer);
      if (reelState.paused) return;
      reelState.timer = setTimeout(advance, ms);
    }
    function advance() { if (reelState.active) show(reelState.i + 1); }

    function show(k) {
      clearTimeout(reelState.timer);
      pauseReelVideos();
      if (k >= slides.length) return finish();
      if (k < 0) k = 0;
      reelState.i = k;
      slides.forEach(function (s, si) { s.classList.toggle('active', si === k); });
      dots.forEach(function (d, di) { d.classList.toggle('on', di === k); });
      fill.style.width = ((k + 1) / slides.length * 100) + '%';

      var vid = slides[k].querySelector('video');
      if (vid) {
        try { vid.currentTime = 0; } catch (e) {}
        var p = vid.play();
        if (p && p.catch) p.catch(function () { schedule(PHOTO_MS); });
        vid.onended = function () { advance(); };
        schedule(VIDEO_FALLBACK); // safety if 'ended' never fires
      } else {
        schedule(PHOTO_MS);
      }
    }
    function finish() {
      reelState.i = slides.length - 1;
      slides.forEach(function (s, si) { s.classList.toggle('active', si === reelState.i); });
      dots.forEach(function (d, di) { d.classList.toggle('on', di === reelState.i); });
      fill.style.width = '100%';
      if (nextBtn) nextBtn.classList.add('show');
    }
    function togglePause() {
      reelState.paused = !reelState.paused;
      reelEl.classList.toggle('paused', reelState.paused);
      if (reelState.paused) {
        clearTimeout(reelState.timer);
        pauseReelVideos();
        playReelMusic(false);
      } else {
        playReelMusic(true);
        var vid = slides[reelState.i] && slides[reelState.i].querySelector('video');
        if (vid) { vid.play().catch(function () {}); schedule(VIDEO_FALLBACK); }
        else { schedule(PHOTO_MS); }
      }
    }

    // tap zones: left edge = prev · right edge = next · middle = pause/resume
    reelEl.onclick = function (e) {
      var rect = reelEl.getBoundingClientRect();
      var x = (e.clientX - rect.left) / rect.width;
      if (x < 0.28) show(Math.max(0, reelState.i - 1));
      else if (x > 0.72) { if (reelState.i < slides.length - 1) show(reelState.i + 1); else finish(); }
      else togglePause();
    };

    // Continue is hidden until the reel finishes (revealed in finish())
    if (nextBtn) nextBtn.classList.remove('show');
    setTimeout(function () { if (hint) hint.classList.add('hide'); }, 3800);

    show(0);
  }

  /* ---------- gift card flip (each card flips independently) ---------- */
  $all('.zepto-flip').forEach(function (zflip) {
    zflip.addEventListener('click', function (e) {
      if (e.target && e.target.isContentEditable) return; // don't flip while editing fields
      zflip.classList.toggle('flipped');
    });
  });

  /* ---------- gift-box picker → fake-out → reveal (final scene) ---------- */
  var picker = document.getElementById('gift-picker');
  var boxesWrap = document.getElementById('boxes');
  var pickResult = document.getElementById('pick-result');
  var cardWrap = document.getElementById('gift-card-wrap');
  var giftBoxes = boxesWrap ? $all('.giftbox', boxesWrap) : [];
  var pickerLock = false;
  var pickTimers = [];

  function resetPicker() {
    pickTimers.forEach(clearTimeout); pickTimers = [];
    pickerLock = false;
    if (picker) picker.classList.remove('hidden');
    if (cardWrap) cardWrap.classList.add('hidden');
    if (pickResult) { pickResult.textContent = ''; pickResult.classList.remove('show'); }
    giftBoxes.forEach(function (b) {
      b.classList.remove('open', 'gone', 'winner');
      b.style.pointerEvents = '';
    });
  }
  function revealCard() {
    if (picker) picker.classList.add('hidden');
    if (cardWrap) cardWrap.classList.remove('hidden');
    giftSound();                                // distinct reveal chime
    burstConfetti(220);
    pickTimers.push(setTimeout(function () { burstConfetti(160); }, 700));
  }
  giftBoxes.forEach(function (box, idx) {
    box.addEventListener('click', function () {
      if (pickerLock) return;
      pickerLock = true;
      giftBoxes.forEach(function (b) { b.style.pointerEvents = 'none'; });
      box.classList.add('open');
      pickResult.textContent = 'Oops… better luck next time 😅';
      pickResult.classList.add('show');
      // 3s later: "just kidding", move a different box to center, reveal
      pickTimers.push(setTimeout(function () {
        var winner = giftBoxes[(idx + 1) % giftBoxes.length];
        giftBoxes.forEach(function (b) { if (b !== winner) b.classList.add('gone'); });
        winner.classList.remove('open');
        winner.classList.add('winner');
        pickResult.textContent = "Just kidding! 😄 Here's your real gift —";
        pickTimers.push(setTimeout(function () {
          winner.classList.add('open');
          pickTimers.push(setTimeout(revealCard, 650));
        }, 1300));
      }, 3000));
    });
  });

  /* ---------- replay ---------- */
  var replay = document.getElementById('replay');
  if (replay) {
    replay.addEventListener('click', function () {
      // reset transient states
      $all('.reveal').forEach(function (e) { e.classList.remove('in'); });
      $all('.reveal-later').forEach(function (e) { e.classList.remove('show'); });
      $all('.stat-num[data-count]').forEach(function (e) { e.dataset.ran = ''; e.textContent = '0'; });
      if (envelope) envelope.classList.remove('open');
      if (envWrap) envWrap.classList.remove('show-letter');
      $all('.zepto-flip').forEach(function (z) { z.classList.remove('flipped'); });
      resetPicker();
      goTo(0); // back to welcome
    });
  }

  /* ===========================================================
     AUDIO
     =========================================================== */
  var audio = document.getElementById('bg-audio');
  var audioBtn = document.getElementById('audio-toggle');
  var muted = false; // user preference, persists across reel entries
  function setPlaying(on) { audioBtn.classList.toggle('playing', on); }
  // reel-only soundtrack control
  function playReelMusic(on) {
    if (!audio) return;
    if (on && !muted) {
      audio.volume = 0.55;
      var p = audio.play();
      if (p && p.catch) p.catch(function () {}); // blocked → user can tap toggle
    } else {
      audio.pause();
    }
  }
  audioBtn.addEventListener('click', function () {
    if (audio.paused) { muted = false; audio.play().then(function(){setPlaying(true);}).catch(function(){}); }
    else { muted = true; audio.pause(); setPlaying(false); }
  });
  audio.addEventListener('play', function () { setPlaying(true); });
  audio.addEventListener('pause', function () { setPlaying(false); });

  /* ---------- Web Audio: shared context, typing clicks, gift chime ---------- */
  var _ac = null;
  function getAC() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      _ac = _ac || new AC();
      if (_ac.state === 'suspended') _ac.resume();
      return _ac;
    } catch (e) { return null; }
  }
  // soft keystroke click for every typed character
  function typeTick(ch) {
    if (reduce || !ch || ch === ' ' || ch === '\n') return;
    var ac = getAC(); if (!ac) return;
    var now = ac.currentTime;
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'square';
    o.frequency.value = 1100 + Math.random() * 350;
    o.connect(g); g.connect(ac.destination);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.07, now + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    o.start(now); o.stop(now + 0.045);
  }
  // gift reveal chime — distinct from reel music
  function giftSound() {
    if (reduce) return;
    var ac = getAC(); if (!ac) return;
    try {
      var now = ac.currentTime;
      var master = ac.createGain();
      master.connect(ac.destination);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.6, now + 0.02);
      master.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
      // rising sparkle arpeggio (C major, ascending)
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'triangle'; o.frequency.value = f;
        o.connect(g); g.connect(master);
        var t = now + i * 0.10;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.95);
        o.start(t); o.stop(t + 1.0);
      });
      // shimmering bell tail
      var b = ac.createOscillator(), bg = ac.createGain();
      b.type = 'sine'; b.frequency.value = 1568;
      b.connect(bg); bg.connect(master);
      var bt = now + 0.5;
      bg.gain.setValueAtTime(0.0001, bt);
      bg.gain.exponentialRampToValueAtTime(0.32, bt + 0.03);
      bg.gain.exponentialRampToValueAtTime(0.001, bt + 1.9);
      b.start(bt); b.stop(bt + 2.0);
    } catch (e) {}
  }

  /* ===========================================================
     FIRST START — reveal chrome (no music here; music is reel-only)
     =========================================================== */
  function firstStart() {
    started = true;
    progress.classList.remove('hidden');
    chapterTag.classList.remove('hidden');
    getAC(); // unlock/resume audio context on first gesture (for typing clicks)
  }

  /* ===========================================================
     PARTICLES (canvas)
     =========================================================== */
  (function particles() {
    var cv = document.getElementById('particles');
    var ctx = cv.getContext('2d');
    var W, H, dots = [], raf;
    function resize() {
      W = cv.width = window.innerWidth * (window.devicePixelRatio || 1);
      H = cv.height = window.innerHeight * (window.devicePixelRatio || 1);
    }
    function rnd(a, b) { return a + (b - a) * pseudo(); }
    // seeded-ish pseudo-random (Math.random allowed in browser, but keep deterministic-friendly)
    var seed = 0.137;
    function pseudo() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    function make() {
      var count = reduce ? 0 : Math.min(70, Math.floor(window.innerWidth / 9));
      dots = [];
      for (var i = 0; i < count; i++) {
        dots.push({
          x: pseudo() * W, y: pseudo() * H,
          r: rnd(0.6, 2.6) * (window.devicePixelRatio || 1),
          vy: rnd(0.05, 0.4), vx: rnd(-0.15, 0.15),
          a: rnd(0.15, 0.7), hue: pseudo() < 0.5 ? '255,210,122' : '127,227,212'
        });
      }
    }
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < dots.length; i++) {
        var d = dots[i];
        d.y -= d.vy; d.x += d.vx;
        if (d.y < -10) { d.y = H + 10; d.x = pseudo() * W; }
        if (d.x < -10) d.x = W + 10; if (d.x > W + 10) d.x = -10;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, 6.283);
        ctx.fillStyle = 'rgba(' + d.hue + ',' + d.a + ')';
        ctx.shadowBlur = 8; ctx.shadowColor = 'rgba(' + d.hue + ',0.6)';
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }
    resize(); make();
    if (!reduce) draw();
    window.addEventListener('resize', function () { resize(); make(); });
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduce) draw();
    });
  })();

  /* ===========================================================
     CONFETTI (canvas burst)
     =========================================================== */
  var confettiCtx, confW, confH, pieces = [], confRaf, confActive = false;
  (function initConfetti() {
    var cv = document.getElementById('confetti');
    confettiCtx = cv.getContext('2d');
    function size() { confW = cv.width = window.innerWidth; confH = cv.height = window.innerHeight; }
    size(); window.addEventListener('resize', size);
  })();
  var cseed = 0.77;
  function crnd() { cseed = (cseed * 9301 + 49297) % 233280; return cseed / 233280; }
  function burstConfetti(n) {
    if (reduce) return;
    var colors = ['#ffd27a', '#ffb347', '#7fe3d4', '#ff9ec7', '#ffffff'];
    for (var i = 0; i < n; i++) {
      pieces.push({
        x: confW / 2 + (crnd() - 0.5) * confW * 0.5,
        y: confH * 0.35 + (crnd() - 0.5) * 60,
        vx: (crnd() - 0.5) * 14,
        vy: crnd() * -12 - 4,
        g: 0.3 + crnd() * 0.2,
        size: 5 + crnd() * 7,
        rot: crnd() * 6.28, vr: (crnd() - 0.5) * 0.4,
        color: colors[Math.floor(crnd() * colors.length)],
        life: 120 + crnd() * 60
      });
    }
    if (!confActive) { confActive = true; runConfetti(); }
  }
  function runConfetti() {
    confettiCtx.clearRect(0, 0, confW, confH);
    for (var i = pieces.length - 1; i >= 0; i--) {
      var p = pieces[i];
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
      p.vx *= 0.99;
      confettiCtx.save();
      confettiCtx.translate(p.x, p.y); confettiCtx.rotate(p.rot);
      confettiCtx.fillStyle = p.color;
      confettiCtx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      confettiCtx.restore();
      if (p.life <= 0 || p.y > confH + 30) pieces.splice(i, 1);
    }
    if (pieces.length) confRaf = requestAnimationFrame(runConfetti);
    else { confActive = false; confettiCtx.clearRect(0, 0, confW, confH); }
  }

  /* ---------- init ---------- */
  updateChrome();
  activateScene(0); // start on the welcome scene
})();
