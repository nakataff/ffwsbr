(() => {
  'use strict';

  const SETTINGS_KEY = 'cff-cloudinary-admin-settings-v1';
  const MAX_FILE_SIZE = 8 * 1024 * 1024;
  const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);

  const $ = (selector, root = document) => root.querySelector(selector);

  function escapeHTML(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[char]));
  }

  function injectStyles() {
    if ($('#cff-cloudinary-admin-style')) return;
    const style = document.createElement('style');
    style.id = 'cff-cloudinary-admin-style';
    style.textContent = `
      .cff-image-upload-box{margin-top:10px;border:1px solid rgba(0,200,255,.22);background:rgba(0,200,255,.045);border-radius:10px;padding:12px}
      .cff-image-upload-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
      .cff-image-upload-head strong{font-size:.84rem;color:#fff}.cff-image-upload-head span{font-size:.72rem;color:#8c96a6}
      .cff-image-drop{display:flex;align-items:center;gap:12px;min-height:76px;border:1px dashed #46505c;border-radius:9px;padding:12px;cursor:pointer;transition:.16s;background:#101319}
      .cff-image-drop:hover,.cff-image-drop.is-dragover{border-color:#00c8ff;background:rgba(0,200,255,.07)}
      .cff-image-drop-icon{font-size:1.45rem;line-height:1}.cff-image-drop-copy{min-width:0;flex:1}.cff-image-drop-copy b{display:block;color:#fff;font-size:.84rem;margin-bottom:3px}.cff-image-drop-copy small{display:block;color:#8d96a5;font-size:.72rem;line-height:1.35}
      .cff-image-upload-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}.cff-image-upload-actions button{min-width:0}
      .cff-image-upload-status{margin:8px 0 0;font-size:.76rem;color:#9ba4b3;line-height:1.35}.cff-image-upload-status.is-error{color:#ff7777}.cff-image-upload-status.is-success{color:#72d889}
      .cff-image-preview{display:none;margin-top:10px;border:1px solid #2d333c;border-radius:9px;overflow:hidden;background:#0c0e12}.cff-image-preview.is-visible{display:grid;grid-template-columns:120px minmax(0,1fr)}
      .cff-image-preview img{width:120px;height:82px;object-fit:cover;display:block}.cff-image-preview-copy{padding:9px 10px;min-width:0}.cff-image-preview-copy b{display:block;font-size:.76rem;color:#fff;margin-bottom:4px}.cff-image-preview-copy a{display:block;color:#73ccff;font-size:.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-decoration:none}
      .cff-cloudinary-settings{margin-top:10px;border-top:1px solid #2b3139;padding-top:9px}.cff-cloudinary-settings summary{cursor:pointer;color:#8ecfff;font-size:.76rem;font-weight:800;user-select:none}.cff-cloudinary-settings-grid{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;align-items:end;margin-top:9px}.cff-cloudinary-settings-grid label{display:block;color:#9ca6b5;font-size:.7rem;font-weight:800}.cff-cloudinary-settings-grid input{margin-top:5px}.cff-cloudinary-note{display:block;color:#777f8d;font-size:.68rem;line-height:1.35;margin-top:7px}
      .cff-cloudinary-settings .admin-btn{white-space:nowrap}
      @media(max-width:700px){.cff-cloudinary-settings-grid{grid-template-columns:1fr}.cff-cloudinary-settings-grid .admin-btn{width:100%}.cff-image-preview.is-visible{grid-template-columns:94px minmax(0,1fr)}.cff-image-preview img{width:94px;height:72px}}
    `;
    document.head.appendChild(style);
  }

  function getSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return {
        cloudName: String(raw.cloudName || '').trim(),
        uploadPreset: String(raw.uploadPreset || '').trim()
      };
    } catch (_) {
      return { cloudName: '', uploadPreset: '' };
    }
  }

  function saveSettings(cloudName, uploadPreset) {
    const settings = {
      cloudName: String(cloudName || '').trim(),
      uploadPreset: String(uploadPreset || '').trim()
    };
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return settings;
  }

  function isConfigured() {
    const s = getSettings();
    return Boolean(s.cloudName && s.uploadPreset);
  }

  function optimizedCloudinaryUrl(url) {
    const value = String(url || '').trim();
    if (!value || !/res\.cloudinary\.com\/[^/]+\/image\/upload\//i.test(value)) return value;
    if (/\/upload\/(?:[^/]*f_auto|[^/]*q_auto)/i.test(value)) return value;
    return value.replace('/image/upload/', '/image/upload/f_auto,q_auto:good,c_limit,w_1600/');
  }

  function validateFile(file) {
    if (!file) throw new Error('Nenhuma imagem selecionada.');
    if (!ACCEPTED_TYPES.has(file.type)) throw new Error('Use JPG, PNG, WEBP, GIF ou AVIF.');
    if (file.size > MAX_FILE_SIZE) throw new Error('A imagem precisa ter no máximo 8 MB.');
  }

  async function uploadFile(file, onStatus) {
    validateFile(file);
    const settings = getSettings();
    if (!settings.cloudName || !settings.uploadPreset) {
      throw new Error('Configure o Cloud Name e o Upload Preset antes de enviar.');
    }
    onStatus?.('Enviando imagem para o Cloudinary...');
    const form = new FormData();
    form.append('file', file);
    form.append('upload_preset', settings.uploadPreset);
    form.append('tags', 'centralfreefire,noticias');
    const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(settings.cloudName)}/image/upload`, {
      method: 'POST',
      body: form
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.secure_url) {
      const message = data && data.error && data.error.message ? data.error.message : 'Falha no upload da imagem.';
      throw new Error(message);
    }
    return {
      url: optimizedCloudinaryUrl(data.secure_url),
      originalUrl: data.secure_url,
      publicId: data.public_id || '',
      width: Number(data.width || 0),
      height: Number(data.height || 0),
      bytes: Number(data.bytes || file.size || 0)
    };
  }

  function setStatus(box, text, type = '') {
    if (!box) return;
    box.textContent = text || '';
    box.classList.toggle('is-error', type === 'error');
    box.classList.toggle('is-success', type === 'success');
  }

  function insertInlineToken(url) {
    const textarea = $('#news-content');
    if (!textarea) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || start;
    const prefix = start > 0 && textarea.value[start - 1] !== '\n' ? '\n' : '';
    textarea.setRangeText(`${prefix}[IMG: ${url}]\n`, start, end, 'end');
    textarea.focus();
  }

  function init() {
    const urlInput = $('#news-image');
    const field = urlInput?.closest('.admin-field');
    if (!urlInput || !field || $('#cff-image-upload-box')) return;

    injectStyles();

    const box = document.createElement('div');
    box.id = 'cff-image-upload-box';
    box.className = 'cff-image-upload-box';
    box.innerHTML = `
      <div class="cff-image-upload-head"><strong>Upload direto da imagem</strong><span>Cloudinary • sem GitHub</span></div>
      <div id="cff-image-drop" class="cff-image-drop" tabindex="0" role="button" aria-label="Selecionar imagem para a notícia">
        <span class="cff-image-drop-icon">🖼️</span>
        <span class="cff-image-drop-copy"><b>Arraste a imagem aqui ou clique para selecionar</b><small>JPG, PNG, WEBP, GIF ou AVIF. O link da imagem é preenchido automaticamente.</small></span>
      </div>
      <input id="cff-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden>
      <input id="cff-inline-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" hidden>
      <div class="cff-image-upload-actions">
        <button id="cff-image-pick" class="admin-btn admin-btn-primary" type="button">Selecionar imagem</button>
        <button id="cff-image-clear" class="admin-btn admin-btn-ghost" type="button">Limpar capa</button>
      </div>
      <p id="cff-image-upload-status" class="cff-image-upload-status">${isConfigured() ? 'Cloudinary configurado. Você já pode enviar imagens.' : 'Configure o Cloudinary abaixo uma única vez neste navegador.'}</p>
      <div id="cff-image-preview" class="cff-image-preview"><img id="cff-image-preview-img" alt="Prévia"><div class="cff-image-preview-copy"><b>Imagem atual</b><a id="cff-image-preview-link" href="#" target="_blank" rel="noopener"></a></div></div>
      <details class="cff-cloudinary-settings" ${isConfigured() ? '' : 'open'}>
        <summary>⚙ Configurar Cloudinary</summary>
        <div class="cff-cloudinary-settings-grid">
          <label>Cloud Name<input id="cff-cloudinary-name" autocomplete="off" placeholder="ex.: centralfreefire"></label>
          <label>Upload Preset (unsigned)<input id="cff-cloudinary-preset" autocomplete="off" placeholder="ex.: noticias_cff"></label>
          <button id="cff-cloudinary-save" class="admin-btn admin-btn-ghost" type="button">Salvar</button>
        </div>
        <small class="cff-cloudinary-note">Essa configuração fica somente neste navegador. Use um preset <strong>Unsigned</strong>. Nunca coloque API Secret ou API Key aqui.</small>
      </details>
    `;

    const existingHelp = Array.from(field.children).find((el) => el.tagName === 'SMALL');
    if (existingHelp) existingHelp.insertAdjacentElement('afterend', box);
    else field.appendChild(box);

    const drop = $('#cff-image-drop');
    const fileInput = $('#cff-image-file');
    const inlineInput = $('#cff-inline-image-file');
    const status = $('#cff-image-upload-status');
    const preview = $('#cff-image-preview');
    const previewImg = $('#cff-image-preview-img');
    const previewLink = $('#cff-image-preview-link');
    const cloudName = $('#cff-cloudinary-name');
    const preset = $('#cff-cloudinary-preset');
    const settings = getSettings();
    cloudName.value = settings.cloudName;
    preset.value = settings.uploadPreset;

    function refreshPreview() {
      const url = String(urlInput.value || '').trim();
      preview.classList.toggle('is-visible', Boolean(url));
      if (!url) {
        previewImg.removeAttribute('src');
        previewLink.textContent = '';
        previewLink.href = '#';
        return;
      }
      previewImg.src = url;
      previewLink.textContent = url;
      previewLink.href = url;
    }

    async function handleCoverFile(file) {
      try {
        const result = await uploadFile(file, (text) => setStatus(status, text));
        urlInput.value = result.url;
        urlInput.dispatchEvent(new Event('input', { bubbles: true }));
        urlInput.dispatchEvent(new Event('change', { bubbles: true }));
        refreshPreview();
        const kb = Math.max(1, Math.round(result.bytes / 1024));
        const dimensions = result.width && result.height ? ` • ${result.width}×${result.height}` : '';
        setStatus(status, `✅ Upload concluído • ${kb} KB${dimensions}. A URL da capa já foi preenchida.`, 'success');
      } catch (error) {
        setStatus(status, `❌ ${error.message}`, 'error');
      } finally {
        fileInput.value = '';
      }
    }

    async function handleInlineFile(file) {
      try {
        const result = await uploadFile(file, (text) => setStatus(status, text));
        insertInlineToken(result.url);
        setStatus(status, '✅ Imagem enviada e inserida dentro do texto.', 'success');
      } catch (error) {
        setStatus(status, `❌ ${error.message}`, 'error');
      } finally {
        inlineInput.value = '';
      }
    }

    $('#cff-image-pick').addEventListener('click', () => fileInput.click());
    drop.addEventListener('click', () => fileInput.click());
    drop.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        fileInput.click();
      }
    });
    fileInput.addEventListener('change', () => handleCoverFile(fileInput.files?.[0]));
    inlineInput.addEventListener('change', () => handleInlineFile(inlineInput.files?.[0]));

    ['dragenter', 'dragover'].forEach((name) => drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.add('is-dragover');
    }));
    ['dragleave', 'drop'].forEach((name) => drop.addEventListener(name, (event) => {
      event.preventDefault();
      drop.classList.remove('is-dragover');
    }));
    drop.addEventListener('drop', (event) => handleCoverFile(event.dataTransfer?.files?.[0]));

    drop.addEventListener('paste', (event) => {
      const file = Array.from(event.clipboardData?.files || []).find((item) => item.type.startsWith('image/'));
      if (file) {
        event.preventDefault();
        handleCoverFile(file);
      }
    });

    $('#cff-image-clear').addEventListener('click', () => {
      urlInput.value = '';
      urlInput.dispatchEvent(new Event('input', { bubbles: true }));
      refreshPreview();
      setStatus(status, 'Capa removida do formulário. A imagem já enviada continua no Cloudinary.', 'success');
    });

    $('#cff-cloudinary-save').addEventListener('click', () => {
      const saved = saveSettings(cloudName.value, preset.value);
      if (!saved.cloudName || !saved.uploadPreset) {
        setStatus(status, '❌ Preencha Cloud Name e Upload Preset.', 'error');
        return;
      }
      setStatus(status, '✅ Configuração do Cloudinary salva neste navegador.', 'success');
      box.querySelector('.cff-cloudinary-settings').open = false;
    });

    urlInput.addEventListener('input', refreshPreview);
    urlInput.addEventListener('change', refreshPreview);
    previewImg.addEventListener('error', () => preview.classList.remove('is-visible'));

    document.addEventListener('click', (event) => {
      const inlineButton = event.target.closest?.('#admin-insert-image');
      if (!inlineButton || !isConfigured()) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      inlineInput.click();
    }, true);

    document.addEventListener('click', (event) => {
      if (event.target.closest?.('[data-edit-news]')) setTimeout(refreshPreview, 80);
      if (event.target.closest?.('#admin-new-news')) setTimeout(refreshPreview, 80);
    }, true);

    refreshPreview();

    window.CFF_ADMIN_IMAGE_UPLOAD = {
      uploadFile,
      getSettings,
      optimizedCloudinaryUrl
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
