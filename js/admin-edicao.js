import { initializeApp, getApps, getApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getAuth, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

const ADMIN_EMAIL = 'admin@centralfreefire.com.br';
const BASE_W = 3000;
const BASE_H = 3749;
const FONT_NAME = 'Avilock';
const FRAME_DB = 'cff-admin-photo-editor-v1';
const FRAME_STORE = 'assets';
const FRAME_KEY = 'custom-frame';

const config = window.CFF_CONFIG && window.CFF_CONFIG.firebase;
if (!config) {
  location.replace('admin.html');
  throw new Error('Configuração do Firebase não encontrada.');
}

const app = getApps().length ? getApp() : initializeApp(config);
const auth = getAuth(app);

const $ = (selector) => document.querySelector(selector);
const ui = {
  app: $('#photo-editor-app'),
  authMessage: $('#photo-editor-auth-message'),
  file: $('#photo-editor-file'),
  imageName: $('#photo-editor-image-name'),
  canvas: $('#photo-editor-canvas'),
  stage: $('#photo-editor-stage'),
  empty: $('#photo-editor-empty'),
  status: $('#photo-editor-canvas-status'),
  resetAll: $('#photo-editor-reset-all'),
  fitCover: $('#photo-editor-fit-cover'),
  fitContain: $('#photo-editor-fit-contain'),
  center: $('#photo-editor-center'),
  flip: $('#photo-editor-flip'),
  zoom: $('#photo-editor-zoom'),
  zoomValue: $('#photo-editor-zoom-value'),
  rotation: $('#photo-editor-rotation'),
  rotationValue: $('#photo-editor-rotation-value'),
  brightness: $('#photo-editor-brightness'),
  brightnessValue: $('#photo-editor-brightness-value'),
  contrast: $('#photo-editor-contrast'),
  contrastValue: $('#photo-editor-contrast-value'),
  saturation: $('#photo-editor-saturation'),
  saturationValue: $('#photo-editor-saturation-value'),
  resetAdjustments: $('#photo-editor-reset-adjustments'),
  text: $('#photo-editor-text'),
  fontSize: $('#photo-editor-font-size'),
  textColor: $('#photo-editor-text-color'),
  textY: $('#photo-editor-text-y'),
  textYValue: $('#photo-editor-text-y-value'),
  textShadow: $('#photo-editor-text-shadow'),
  fontFile: $('#photo-editor-font-file'),
  fontStatus: $('#photo-editor-font-status'),
  frameEnabled: $('#photo-editor-frame-enabled'),
  frameFile: $('#photo-editor-frame-file'),
  frameStatus: $('#photo-editor-frame-status'),
  clearFrame: $('#photo-editor-clear-frame'),
  size: $('#photo-editor-size'),
  format: $('#photo-editor-format'),
  qualityWrap: $('#photo-editor-quality-wrap'),
  quality: $('#photo-editor-quality'),
  qualityValue: $('#photo-editor-quality-value'),
  fileName: $('#photo-editor-file-name'),
  download: $('#photo-editor-download'),
  message: $('#photo-editor-message')
};

const ctx = ui.canvas.getContext('2d', { alpha: false, desynchronized: true });
const state = {
  image: null,
  imageUrl: '',
  imageName: '',
  fitMode: 'cover',
  baseScale: 1,
  zoom: 1,
  x: BASE_W / 2,
  y: BASE_H / 2,
  rotation: 0,
  flipX: 1,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  text: '',
  textSize: 160,
  textColor: '#ffffff',
  textY: 42,
  textShadow: true,
  frameEnabled: true,
  customFrame: null,
  customFrameUrl: '',
  dragging: false,
  dragPointerId: null,
  dragLastX: 0,
  dragLastY: 0,
  renderQueued: false,
  avilockReady: false,
  logo: null
};

function setMessage(text, type = '') {
  ui.message.textContent = text || '';
  ui.message.classList.toggle('is-error', type === 'error');
  ui.message.classList.toggle('is-success', type === 'success');
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function queueRender() {
  if (state.renderQueued) return;
  state.renderQueued = true;
  requestAnimationFrame(() => {
    state.renderQueued = false;
    render();
  });
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawFallbackBackground(context) {
  const gradient = context.createLinearGradient(0, 0, BASE_W, BASE_H);
  gradient.addColorStop(0, '#a870ff');
  gradient.addColorStop(0.55, '#965eea');
  gradient.addColorStop(1, '#6d35bf');
  context.fillStyle = gradient;
  context.fillRect(0, 0, BASE_W, BASE_H);

  context.save();
  context.globalAlpha = 0.13;
  context.fillStyle = '#ffffff';
  const originX = BASE_W * 0.55;
  const originY = BASE_H * 0.42;
  const rayCount = 26;
  for (let i = 0; i < rayCount; i += 2) {
    const a1 = (Math.PI * 2 * i) / rayCount;
    const a2 = (Math.PI * 2 * (i + 1)) / rayCount;
    const radius = BASE_H * 1.15;
    context.beginPath();
    context.moveTo(originX, originY);
    context.lineTo(originX + Math.cos(a1) * radius, originY + Math.sin(a1) * radius);
    context.lineTo(originX + Math.cos(a2) * radius, originY + Math.sin(a2) * radius);
    context.closePath();
    context.fill();
  }
  context.restore();
}

function drawPhoto(context) {
  if (!state.image) return;
  const image = state.image;
  const scale = state.baseScale * state.zoom;
  const width = image.naturalWidth * scale;
  const height = image.naturalHeight * scale;

  context.save();
  context.filter = `brightness(${state.brightness}%) contrast(${state.contrast}%) saturate(${state.saturation}%)`;
  context.translate(state.x, state.y);
  context.rotate((state.rotation * Math.PI) / 180);
  context.scale(state.flipX, 1);
  context.drawImage(image, -width / 2, -height / 2, width, height);
  context.restore();
  context.filter = 'none';
}

function wrapText(context, text, maxWidth) {
  const paragraphs = String(text || '').split(/\n/);
  const lines = [];
  paragraphs.forEach((paragraph) => {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push('');
      return;
    }
    let line = words.shift();
    words.forEach((word) => {
      const test = `${line} ${word}`;
      if (context.measureText(test).width <= maxWidth) line = test;
      else {
        lines.push(line);
        line = word;
      }
    });
    lines.push(line);
  });
  return lines.slice(0, 4);
}

function drawTextLayer(context) {
  const text = String(state.text || '').trim();
  if (!text) return;
  const fontFamily = state.avilockReady ? '"Avilock"' : 'Impact, "Arial Black", sans-serif';
  const fontSize = clamp(Number(state.textSize) || 160, 40, 500);
  const y = BASE_H * (clamp(Number(state.textY) || 42, 8, 72) / 100);

  context.save();
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `${fontSize}px ${fontFamily}`;
  context.fillStyle = state.textColor || '#ffffff';
  if (state.textShadow) {
    context.shadowColor = 'rgba(0,0,0,.62)';
    context.shadowBlur = Math.max(10, fontSize * 0.08);
    context.shadowOffsetY = Math.max(4, fontSize * 0.035);
  }
  const lines = wrapText(context, text.toUpperCase(), BASE_W * 0.82);
  const lineHeight = fontSize * 0.92;
  const startY = y - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => context.fillText(line, BASE_W / 2, startY + index * lineHeight));
  context.restore();
}

function drawDefaultFrame(context) {
  const w = BASE_W;
  const h = BASE_H;

  context.save();
  context.fillStyle = '#ffffff';
  context.beginPath();
  context.moveTo(0, h * 0.655);
  context.bezierCurveTo(w * 0.08, h * 0.69, w * 0.24, h * 0.78, w * 0.39, h * 0.79);
  context.bezierCurveTo(w * 0.56, h * 0.80, w * 0.66, h * 0.75, w * 0.79, h * 0.78);
  context.bezierCurveTo(w * 0.88, h * 0.80, w * 0.94, h * 0.83, w, h * 0.85);
  context.lineTo(w, h);
  context.lineTo(0, h);
  context.closePath();
  context.fill();

  const inset = 72;
  const radius = 390;
  drawRoundedRect(context, inset, inset, w - inset * 2, h - inset * 2, radius);
  context.lineWidth = 86;
  context.strokeStyle = '#070707';
  context.stroke();
  context.lineWidth = 56;
  context.strokeStyle = '#ffffff';
  context.stroke();
  context.lineWidth = 15;
  context.strokeStyle = '#070707';
  context.stroke();

  context.fillStyle = '#050505';
  context.beginPath();
  context.moveTo(w * 0.955, h * 0.84);
  context.lineTo(w * 0.955, h * 0.93);
  context.lineTo(w * 0.995, h * 0.915);
  context.lineTo(w * 0.995, h * 0.825);
  context.closePath();
  context.fill();

  drawBrand(context);
  context.restore();
}

function drawBrand(context) {
  const logoSize = 230;
  const x = BASE_W * 0.73;
  const y = BASE_H * 0.89;
  if (state.logo && state.logo.complete && state.logo.naturalWidth) {
    const ratio = state.logo.naturalWidth / state.logo.naturalHeight;
    const logoW = ratio >= 1 ? logoSize : logoSize * ratio;
    const logoH = ratio >= 1 ? logoSize / ratio : logoSize;
    context.drawImage(state.logo, x - logoW - 40, y - logoH / 2, logoW, logoH);
  }

  context.textAlign = 'left';
  context.textBaseline = 'alphabetic';
  context.fillStyle = '#ffffff';
  context.shadowColor = 'rgba(0,0,0,.45)';
  context.shadowBlur = 8;
  context.shadowOffsetY = 3;
  const family = state.avilockReady ? '"Avilock"' : 'Impact, "Arial Black", sans-serif';
  context.font = `150px ${family}`;
  context.fillText('CENTRAL', x, y - 18);
  context.font = `92px ${family}`;
  context.fillText('FREE FIRE', x, y + 88);
  context.shadowColor = 'transparent';
}

function drawCustomFrame(context) {
  if (!state.customFrame) return false;
  context.drawImage(state.customFrame, 0, 0, BASE_W, BASE_H);
  return true;
}

function render() {
  ctx.save();
  ctx.clearRect(0, 0, BASE_W, BASE_H);
  drawFallbackBackground(ctx);
  drawPhoto(ctx);
  drawTextLayer(ctx);
  if (state.frameEnabled) {
    const customDrawn = drawCustomFrame(ctx);
    if (!customDrawn) drawDefaultFrame(ctx);
  }
  ctx.restore();

  ui.empty.hidden = Boolean(state.image);
  ui.download.disabled = !state.image;
  ui.status.textContent = state.image ? `${state.image.naturalWidth} × ${state.image.naturalHeight} • arraste para reposicionar` : 'Adicione uma foto para começar';
}

function fitImage(mode = 'cover', preserveZoom = false) {
  if (!state.image) return;
  const image = state.image;
  const scaleX = BASE_W / image.naturalWidth;
  const scaleY = BASE_H / image.naturalHeight;
  state.fitMode = mode;
  state.baseScale = mode === 'contain' ? Math.min(scaleX, scaleY) : Math.max(scaleX, scaleY);
  if (!preserveZoom) {
    state.zoom = 1;
    ui.zoom.value = '100';
    ui.zoomValue.textContent = '100%';
  }
  state.x = BASE_W / 2;
  state.y = BASE_H / 2;
  queueRender();
}

function loadImageFromFile(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/i.test(file.type)) {
    setMessage('Escolha uma imagem PNG, JPG ou WEBP.', 'error');
    return;
  }
  if (state.imageUrl) URL.revokeObjectURL(state.imageUrl);
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    state.image = image;
    state.imageUrl = url;
    state.imageName = file.name;
    ui.imageName.textContent = file.name;
    state.rotation = 0;
    state.flipX = 1;
    ui.rotation.value = '0';
    ui.rotationValue.textContent = '0°';
    fitImage('cover');
    setMessage('Foto carregada. Ajuste no preview e exporte quando estiver pronta.', 'success');
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setMessage('Não foi possível abrir essa imagem.', 'error');
  };
  image.src = url;
}

function resetAdjustments() {
  state.brightness = 100;
  state.contrast = 100;
  state.saturation = 100;
  ui.brightness.value = '100';
  ui.contrast.value = '100';
  ui.saturation.value = '100';
  ui.brightnessValue.textContent = '100%';
  ui.contrastValue.textContent = '100%';
  ui.saturationValue.textContent = '100%';
  queueRender();
}

function resetAll() {
  state.rotation = 0;
  state.flipX = 1;
  state.text = '';
  state.textSize = 160;
  state.textColor = '#ffffff';
  state.textY = 42;
  state.textShadow = true;
  ui.rotation.value = '0';
  ui.rotationValue.textContent = '0°';
  ui.text.value = '';
  ui.fontSize.value = '160';
  ui.textColor.value = '#ffffff';
  ui.textY.value = '42';
  ui.textYValue.textContent = '42%';
  ui.textShadow.checked = true;
  resetAdjustments();
  if (state.image) fitImage('cover');
  else queueRender();
  setMessage('Ajustes resetados.', 'success');
}

function stagePoint(event) {
  const rect = ui.stage.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * BASE_W,
    y: ((event.clientY - rect.top) / rect.height) * BASE_H
  };
}

function onPointerDown(event) {
  if (!state.image) return;
  event.preventDefault();
  const point = stagePoint(event);
  state.dragging = true;
  state.dragPointerId = event.pointerId;
  state.dragLastX = point.x;
  state.dragLastY = point.y;
  ui.stage.setPointerCapture?.(event.pointerId);
}

function onPointerMove(event) {
  if (!state.dragging || state.dragPointerId !== event.pointerId) return;
  event.preventDefault();
  const point = stagePoint(event);
  state.x += point.x - state.dragLastX;
  state.y += point.y - state.dragLastY;
  state.dragLastX = point.x;
  state.dragLastY = point.y;
  queueRender();
}

function onPointerUp(event) {
  if (state.dragPointerId !== event.pointerId) return;
  state.dragging = false;
  state.dragPointerId = null;
  ui.stage.releasePointerCapture?.(event.pointerId);
}

function updateZoom(value) {
  state.zoom = clamp(Number(value) / 100, 0.25, 3);
  ui.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  queueRender();
}

function sanitizeFileName(value) {
  const safe = String(value || 'central-free-fire-edit')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return safe || 'central-free-fire-edit';
}

function exportImage() {
  if (!state.image) {
    setMessage('Adicione uma foto antes de exportar.', 'error');
    return;
  }
  render();
  const [width, height] = String(ui.size.value || '3000x3749').split('x').map(Number);
  const output = document.createElement('canvas');
  output.width = width;
  output.height = height;
  const outputCtx = output.getContext('2d', { alpha: false });
  outputCtx.imageSmoothingEnabled = true;
  outputCtx.imageSmoothingQuality = 'high';
  outputCtx.drawImage(ui.canvas, 0, 0, BASE_W, BASE_H, 0, 0, width, height);

  const format = ui.format.value === 'jpg' ? 'jpg' : 'png';
  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  const quality = format === 'jpg' ? clamp(Number(ui.quality.value) / 100, 0.6, 1) : undefined;
  const name = `${sanitizeFileName(ui.fileName.value)}-${width}x${height}.${format}`;

  ui.download.disabled = true;
  ui.download.textContent = 'Gerando...';
  output.toBlob((blob) => {
    ui.download.disabled = false;
    ui.download.textContent = 'Baixar arte';
    if (!blob) {
      setMessage('Não foi possível gerar o arquivo.', 'error');
      return;
    }
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setMessage(`Arte exportada em ${width} × ${height}.`, 'success');
  }, mime, quality);
}

async function tryLoadAvilockFromSite() {
  const candidates = ['fonts/Avilock.ttf', 'fonts/avilock.ttf', 'fonts/Avilock.otf', 'fonts/avilock.otf'];
  for (const source of candidates) {
    try {
      const response = await fetch(source, { cache: 'force-cache' });
      if (!response.ok) continue;
      const buffer = await response.arrayBuffer();
      const font = new FontFace(FONT_NAME, buffer);
      await font.load();
      document.fonts.add(font);
      state.avilockReady = true;
      updateFontStatus();
      queueRender();
      return true;
    } catch (_) {}
  }
  updateFontStatus();
  return false;
}

async function loadAvilockFile(file) {
  if (!file) return;
  const name = String(file.name || '').toLowerCase();
  if (!name.endsWith('.ttf') && !name.endsWith('.otf')) {
    setMessage('Escolha o arquivo .ttf ou .otf da fonte Avilock.', 'error');
    return;
  }
  try {
    const buffer = await file.arrayBuffer();
    const font = new FontFace(FONT_NAME, buffer);
    await font.load();
    document.fonts.add(font);
    state.avilockReady = true;
    updateFontStatus();
    queueRender();
    setMessage('Fonte Avilock carregada nesta sessão.', 'success');
  } catch (error) {
    console.error(error);
    setMessage('Não consegui carregar esse arquivo de fonte.', 'error');
  }
}

function updateFontStatus() {
  const ready = state.avilockReady || document.fonts.check('32px Avilock');
  state.avilockReady = ready;
  ui.fontStatus.textContent = ready ? 'Avilock ativa' : 'Fallback ativo';
  ui.fontStatus.classList.toggle('is-ready', ready);
  ui.fontStatus.classList.toggle('is-warning', !ready);
}

function openFrameDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(FRAME_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FRAME_STORE)) db.createObjectStore(FRAME_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveFrameBlob(blob) {
  try {
    const db = await openFrameDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FRAME_STORE, 'readwrite');
      tx.objectStore(FRAME_STORE).put(blob, FRAME_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.warn('Não foi possível salvar a moldura localmente.', error);
  }
}

async function getSavedFrameBlob() {
  try {
    const db = await openFrameDb();
    const result = await new Promise((resolve, reject) => {
      const tx = db.transaction(FRAME_STORE, 'readonly');
      const request = tx.objectStore(FRAME_STORE).get(FRAME_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
  } catch (_) {
    return null;
  }
}

async function clearSavedFrame() {
  try {
    const db = await openFrameDb();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(FRAME_STORE, 'readwrite');
      tx.objectStore(FRAME_STORE).delete(FRAME_KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (_) {}
}

function setCustomFrameFromBlob(blob, persist = true) {
  if (!blob) return;
  if (state.customFrameUrl) URL.revokeObjectURL(state.customFrameUrl);
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.onload = async () => {
    state.customFrame = image;
    state.customFrameUrl = url;
    ui.frameStatus.textContent = 'PNG personalizado';
    ui.frameStatus.classList.add('is-ready');
    if (persist) await saveFrameBlob(blob);
    queueRender();
    setMessage('Moldura personalizada aplicada por cima da foto.', 'success');
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setMessage('Não foi possível abrir essa moldura.', 'error');
  };
  image.src = url;
}

async function restoreSavedFrame() {
  const blob = await getSavedFrameBlob();
  if (blob) setCustomFrameFromBlob(blob, false);
}

async function useDefaultFrame() {
  if (state.customFrameUrl) URL.revokeObjectURL(state.customFrameUrl);
  state.customFrame = null;
  state.customFrameUrl = '';
  await clearSavedFrame();
  ui.frameFile.value = '';
  ui.frameStatus.textContent = 'Padrão';
  ui.frameStatus.classList.add('is-ready');
  queueRender();
  setMessage('Moldura padrão restaurada.', 'success');
}

function loadLogo() {
  const logo = new Image();
  logo.onload = () => {
    state.logo = logo;
    queueRender();
  };
  logo.onerror = () => {};
  logo.src = 'central free fire.webp';
}

function bindEvents() {
  ui.file.addEventListener('change', () => loadImageFromFile(ui.file.files?.[0]));
  ui.resetAll.addEventListener('click', resetAll);
  ui.fitCover.addEventListener('click', () => fitImage('cover'));
  ui.fitContain.addEventListener('click', () => fitImage('contain'));
  ui.center.addEventListener('click', () => {
    state.x = BASE_W / 2;
    state.y = BASE_H / 2;
    queueRender();
  });
  ui.flip.addEventListener('click', () => {
    state.flipX *= -1;
    queueRender();
  });
  ui.zoom.addEventListener('input', () => updateZoom(ui.zoom.value));
  ui.rotation.addEventListener('input', () => {
    state.rotation = Number(ui.rotation.value);
    ui.rotationValue.textContent = `${state.rotation}°`;
    queueRender();
  });

  const bindPercent = (input, output, key) => {
    input.addEventListener('input', () => {
      state[key] = Number(input.value);
      output.textContent = `${state[key]}%`;
      queueRender();
    });
  };
  bindPercent(ui.brightness, ui.brightnessValue, 'brightness');
  bindPercent(ui.contrast, ui.contrastValue, 'contrast');
  bindPercent(ui.saturation, ui.saturationValue, 'saturation');
  ui.resetAdjustments.addEventListener('click', resetAdjustments);

  ui.text.addEventListener('input', () => {
    state.text = ui.text.value;
    queueRender();
  });
  ui.fontSize.addEventListener('input', () => {
    state.textSize = clamp(Number(ui.fontSize.value) || 160, 40, 500);
    queueRender();
  });
  ui.textColor.addEventListener('input', () => {
    state.textColor = ui.textColor.value;
    queueRender();
  });
  ui.textY.addEventListener('input', () => {
    state.textY = Number(ui.textY.value);
    ui.textYValue.textContent = `${state.textY}%`;
    queueRender();
  });
  ui.textShadow.addEventListener('change', () => {
    state.textShadow = ui.textShadow.checked;
    queueRender();
  });
  ui.fontFile.addEventListener('change', () => loadAvilockFile(ui.fontFile.files?.[0]));

  ui.frameEnabled.addEventListener('change', () => {
    state.frameEnabled = ui.frameEnabled.checked;
    queueRender();
  });
  ui.frameFile.addEventListener('change', () => {
    const file = ui.frameFile.files?.[0];
    if (!file || !/^image\/(png|webp)$/i.test(file.type)) {
      setMessage('Escolha uma moldura PNG ou WEBP.', 'error');
      return;
    }
    setCustomFrameFromBlob(file, true);
  });
  ui.clearFrame.addEventListener('click', useDefaultFrame);

  ui.stage.addEventListener('pointerdown', onPointerDown);
  ui.stage.addEventListener('pointermove', onPointerMove);
  ui.stage.addEventListener('pointerup', onPointerUp);
  ui.stage.addEventListener('pointercancel', onPointerUp);
  ui.stage.addEventListener('wheel', (event) => {
    if (!state.image) return;
    event.preventDefault();
    const next = clamp(Number(ui.zoom.value) + (event.deltaY < 0 ? 5 : -5), 25, 300);
    ui.zoom.value = String(next);
    updateZoom(next);
  }, { passive: false });

  ui.format.addEventListener('change', () => {
    ui.qualityWrap.hidden = ui.format.value !== 'jpg';
  });
  ui.quality.addEventListener('input', () => {
    ui.qualityValue.textContent = `${ui.quality.value}%`;
  });
  ui.download.addEventListener('click', exportImage);
}

async function initEditor() {
  bindEvents();
  loadLogo();
  drawFallbackBackground(ctx);
  drawDefaultFrame(ctx);
  updateFontStatus();
  tryLoadAvilockFromSite();
  restoreSavedFrame();
  render();
}

onAuthStateChanged(auth, async (user) => {
  const allowed = Boolean(user && String(user.email || '').toLowerCase() === ADMIN_EMAIL);
  if (!allowed) {
    location.replace('admin.html');
    return;
  }
  ui.authMessage.hidden = true;
  ui.app.hidden = false;
  await initEditor();
});
