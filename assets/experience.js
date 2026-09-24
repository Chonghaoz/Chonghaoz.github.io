(() => {
  'use strict';
  const ids = ['home', 'about', 'projects', 'blog'];
  const names = ['首页', '关于我', '作品集', '博客'];
  const panels = ids.map(id => document.getElementById(id));
  const main = document.getElementById('main');
  // Leave the readable document intact if a required section is missing.
  if (!main || panels.some(panel => !panel)) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let current = Math.max(0, ids.indexOf(location.hash.slice(1)));
  let lockedUntil = 0, wheelTotal = 0, lastWheel = 0;
  panels.forEach(panel => {
    panel.classList.add('panel');
    panel.tabIndex = -1;
    const inner = document.createElement('div');
    inner.className = 'page-content';
    while (panel.firstChild) inner.append(panel.firstChild);
    panel.append(inner);
  });
  const hint = document.createElement('span');
  hint.className = 'scroll-hint';
  hint.textContent = '左右滑动 / ← → 翻页';
  panels[0].querySelector('.actions').after(hint);
  const dots = document.createElement('nav');
  dots.className = 'page-dots';
  dots.setAttribute('aria-label', '页面导航');
  const dotButtons = ids.map((id, i) => {
    const button = document.createElement('button');
    button.className = 'page-dot';
    button.setAttribute('aria-label', `第 ${i + 1} 页：${names[i]}`);
    button.addEventListener('click', () => go(i, true, true));
    dots.append(button);
    return button;
  });
  document.body.append(dots);
  const controls = document.createElement('div');
  controls.className = 'page-controls';
  controls.innerHTML = '<button class="page-button" aria-label="上一页">←</button><span class="page-count" aria-live="polite"></span><button class="page-button" aria-label="下一页">→</button>';
  document.querySelector('.footer-row').append(controls);
  const [prev, next] = controls.querySelectorAll('button');
  prev.addEventListener('click', () => go(current - 1, true, true));
  next.addEventListener('click', () => go(current + 1, true, true));
  function go(index, updateHash = true, focus = false) {
    if (index < 0 || index >= panels.length) return;
    const changed = index !== current;
    const old = panels[current];
    const moveFocus = focus || (changed && old.contains(document.activeElement));
    current = index;
    panels.forEach((panel, i) => {
      panel.classList.toggle('is-active', i === index);
      panel.classList.toggle('is-before', i < index);
      panel.inert = i !== index;
      panel.setAttribute('aria-hidden', String(i !== index));
      dotButtons[i].setAttribute('aria-current', i === index ? 'page' : 'false');
    });
    document.querySelectorAll('header a[href^="#"]').forEach(link => {
      if (link.hash === '#' + ids[index]) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    controls.querySelector('.page-count').textContent = `0${index + 1} / 04`;
    prev.disabled = index === 0;
    next.disabled = index === panels.length - 1;
    if (changed) panels[index].scrollTop = 0;
    if (moveFocus) panels[index].focus({preventScroll:true});
    if (updateHash && location.hash !== '#' + ids[index]) history.pushState(null, '', '#' + ids[index]);
    lockedUntil = performance.now() + (reduce.matches ? 180 : 850);
    wheelTotal = 0;
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.hash.slice(1);
    const index = ids.indexOf(id);
    if (index >= 0 || id === 'main') {
      event.preventDefault();
      go(index >= 0 ? index : current, true, true);
    }
  });
  window.addEventListener('popstate', () => go(Math.max(0, ids.indexOf(location.hash.slice(1))), false));
  window.addEventListener('hashchange', () => go(Math.max(0, ids.indexOf(location.hash.slice(1))), false));
  function canReadMore(direction) {
    const panel = panels[current];
    return direction > 0 ? panel.scrollTop + panel.clientHeight < panel.scrollHeight - 3 : panel.scrollTop > 3;
  }
  main.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    const horizontal = Math.abs(event.deltaX) > Math.abs(event.deltaY);
    const delta = horizontal ? event.deltaX : event.deltaY;
    const direction = Math.sign(delta);
    // Vertical input scrolls long articles; horizontal input turns the page.
    if (!direction || (!horizontal && canReadMore(direction))) return;
    event.preventDefault();
    const now = performance.now();
    if (now < lockedUntil) { lastWheel = now; return; }
    if (now - lastWheel > 220 || Math.sign(wheelTotal) !== direction) wheelTotal = 0;
    lastWheel = now;
    wheelTotal += delta * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? main.clientWidth : 1);
    if (Math.abs(wheelTotal) >= 45) go(current + direction);
  }, {passive:false});
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,button,summary,[contenteditable="true"]')) return;
    const direction = ['ArrowRight','PageDown'].includes(event.key) ? 1 : ['ArrowLeft','PageUp'].includes(event.key) ? -1 : 0;
    if (direction) {
      event.preventDefault();
      if (!event.repeat && performance.now() >= lockedUntil) go(current + direction, true, true);
    }
  });
  let gesture = null;
  main.addEventListener('touchstart', event => {
    if (event.touches.length !== 1) { gesture = null; return; }
    gesture = {x:event.touches[0].clientX,y:event.touches[0].clientY};
  }, {passive:true});
  main.addEventListener('touchend', event => {
    if (!gesture || !event.changedTouches.length) return;
    const dy = gesture.y - event.changedTouches[0].clientY;
    const dx = gesture.x - event.changedTouches[0].clientX;
    if (Math.abs(dx) > 65 && Math.abs(dx) > Math.abs(dy)*1.3 && performance.now() > lockedUntil) go(current + Math.sign(dx));
    gesture = null;
  }, {passive:true});
  main.addEventListener('touchcancel', () => { gesture = null; }, {passive:true});
  document.body.classList.add('paged');
  const header = document.querySelector('header');
  const resizeHeader = () => document.documentElement.style.setProperty('--header-height', `${header.offsetHeight}px`);
  if ('ResizeObserver' in window) new ResizeObserver(resizeHeader).observe(header);
  else window.addEventListener('resize', resizeHeader);
  resizeHeader();
  go(current, false);

  // Real background readiness, a brief opening, and a bounded fallback.
  const loader = document.createElement('div');
  loader.className = 'loader';
  loader.setAttribute('role','dialog');
  loader.setAttribute('aria-modal','true');
  loader.setAttribute('aria-label','正在载入主页');
  loader.innerHTML = '<div class="loader-inner"><span class="loader-seal" aria-hidden="true">入境</span><p class="loader-title">CHONGHAO</p><div class="loader-line" aria-hidden="true"></div><p class="loader-caption" role="status">正在展开山水画卷…</p><button class="loader-skip">跳过开场</button></div>';
  document.body.append(loader);
  const surfaces = [main,header,document.querySelector('footer'),dots];
  surfaces.forEach(el => el.inert = true);
  const skip = loader.querySelector('button');
  skip.focus({preventScroll:true});
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    surfaces.forEach(el => el.inert = false);
    loader.classList.add('is-done');
    loader.inert = true;
    panels[current].focus({preventScroll:true});
    setTimeout(() => loader.remove(), reduce.matches ? 0 : 600);
  }
  skip.addEventListener('click', finish);
  loader.addEventListener('keydown', event => {
    if (event.key === 'Escape') finish();
    if (event.key === 'Tab') {event.preventDefault();skip.focus();}
  });
  const image = new Image();
  const ready = new Promise(resolve => { image.onload = resolve; image.onerror = resolve; });
  image.src = 'assets/ink-landscape-background.png';
  const fontReady = document.fonts ? document.fonts.load('400 24px "Xia Xing Kai"', '你好关于我作品集博客').catch(() => {}) : Promise.resolve();
  Promise.all([ready,fontReady,new Promise(resolve => setTimeout(resolve,reduce.matches ? 0 : 1300))]).then(finish);
  setTimeout(finish,6000);
})();
