(() => {
      "use strict";

      if (typeof crypto.randomUUID !== "function") {
        crypto.randomUUID = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, character => {
          const random = Math.random() * 16 | 0;
          const value = character === "x" ? random : (random & 0x3 | 0x8);
          return value.toString(16);
        });
      }

      const DEFAULT_ROWS = [
        { id: crypto.randomUUID(), name: "S", color: "#ff7f7f", images: [] },
        { id: crypto.randomUUID(), name: "A", color: "#ffbf7f", images: [] },
        { id: crypto.randomUUID(), name: "B", color: "#ffdf7f", images: [] },
        { id: crypto.randomUUID(), name: "C", color: "#ffff7f", images: [] },
        { id: crypto.randomUUID(), name: "D", color: "#bfff7f", images: [] }
      ];

      const TIER_PRESET_COLORS = ["#ff7f7f", "#ffbf7f", "#ffdf7f", "#ffff7f", "#bfff7f", "#7fffbf", "#7fdfff", "#7fbfff", "#c79bff", "#f5f5f5"];
      const AUTOSAVE_KEY = "tierlist_autosave_v1";
      const PROJECT_DB_NAME = "tierlist_browser_projects_v1";
      const PROJECT_STORE_NAME = "projects";
      const BROWSER_AUTOSAVE_NAME = "__tierlist_autosave__";
      const CURRENT_PROJECT_KEY = "tierlist_current_browser_project";

      const TIER_ASSET_INDEX_URL = "tier-constructor/assets-index.json?v=20260801-v2";
      const TIER_DEFAULT_PRESET_URL = "tier-constructor/default-wb-2026-s2.json?v=20260801-v1";
      const TIER_LOGO_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=1308958099&single=true&output=tsv";
      const TIER_SHARE_HASH_KEY = "tier";
      const TIER_SHARE_VERSION = 1;
      const TIER_SHARE_SAFE_URL_LENGTH = 12000;
      const TIER_SHARE_MAX_PAYLOAD_LENGTH = 120000;
      let tierAssetData = null;
      let tierAssetPromise = null;
      let tierAssetType = "team";
      let tierAssetQuery = "";
      let tierAssetTimer = null;
      let tierLiveLogoPromise = null;
      let tierVisibleAssets = [];
      const tierAssetSourceCache = new Map();

      const DEFAULT_SETTINGS = {
        labelWidth: 150,
        boardWidth: 1100,
        imageSize: 100,
        gap: 10,
        rowMinHeight: 120,
        overlay: 20,
        separatorWidth: 1,
        separatorColor: "#3b3f48",
        backgroundColor: "#101217",
        imageFrameEnabled: false,
        backgroundFit: "cover",
        backgroundZoom: 100,
        backgroundPosX: 50,
        backgroundPosY: 50,
        captionFontSize: 30,
        captionFontFamily: "Inter, Arial, sans-serif",
        captionAlign: "center",
        captionColor: "#ffffff",
        captionBgColor: "#101217",
        captionBgOpacity: 100,
        captionImagePosition: "top",
        captionImageSize: 120,
        rowFontSize: 24,
        rowFontFamily: "Inter, Arial, sans-serif",
        rowTextAlign: "center",
        rowPaddingX: 16,
        rowPaddingY: 10,
        rowVerticalAlign: "center",
        rowAutoFit: true,
        rowAutoHeight: true,
        positionMode: true,
        positionScope: "global",
        positionFontSize: 16,
        positionFontFamily: "Inter, Arial, sans-serif",
        positionTextColor: "#ffffff",
        positionBgColor: "#000000",
        positionHorizontal: "left",
        positionVertical: "top",
        positionTextStroke: 0,
        positionTextStrokeColor: "#000000",
        positionShadowSize: 0,
        positionShadowColor: "#000000"
      };

      const state = {
        rows: structuredClone(DEFAULT_ROWS),
        images: {},
        bank: [],
        archived: [],
        caption: "",
        captionImage: "",
        background: "",
        settings: { ...DEFAULT_SETTINGS }
      };

      const els = {
        root: document.documentElement,
        tierBoard: document.getElementById("tierBoard"),
        tierCaption: document.getElementById("tierCaption"),
        captionInput: document.getElementById("captionInput"),
        imageBank: document.getElementById("imageBank"),
        bankCount: document.getElementById("bankCount"),
        archivedBank: document.getElementById("archivedBank"),
        archivedCount: document.getElementById("archivedCount"),
        imageInput: document.getElementById("imageInput"),
        projectInput: document.getElementById("projectInput"),
        backgroundInput: document.getElementById("backgroundInput"),
        captionImageInput: document.getElementById("captionImageInput"),
        editorBgInput: document.getElementById("editorBgInput"),
        editorPipInput: document.getElementById("editorPipInput"),
        settingsDialog: document.getElementById("settingsDialog"),
        browserProjectsDialog: document.getElementById("browserProjectsDialog"),
        shareProjectDialog: document.getElementById("shareProjectDialog"),
        imageEditorDialog: document.getElementById("imageEditorDialog"),
        rowManager: document.getElementById("rowManager"),
        toast: document.getElementById("toast"),
        undoBtn: document.getElementById("undoBtn"),
        redoBtn: document.getElementById("redoBtn")
      };

      let draggedImageId = null;
      let toastTimer = null;
      let historyTimer = null;
      let isRestoringHistory = false;
      let currentEditorImageId = null;
      let editorDraft = null;
      const HISTORY_LIMIT = 60;
      let historyStack = [];
      let historyIndex = -1;
      let currentEditorTab = "image";
      let captionPanelCollapsed = false;
      let editorDragMode = null;
      let lastAppliedEdit = null;
      let editorOriginalPreviewSrc = "";
      let editorOriginalEdit = null;
      let autosaveWarned = false;
      let currentBrowserProjectName = localStorage.getItem(CURRENT_PROJECT_KEY) || "";
      let namedProjectSaveTimer = null;
      let touchSelectedImageId = null;
      let mobileMoveHintShown = false;


      function tierNormalizeSearch(value) {
        return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
      }

      function tierAssetSlug(value) {
        return tierNormalizeSearch(value).replace(/\s+/g, "-") || "item";
      }

      function tierRefreshAssetIndex(data) {
        const assets = Array.isArray(data?.assets) ? data.assets : [];
        assets.forEach(asset => {
          asset._search = tierNormalizeSearch([asset.name, asset.subtitle, ...(asset.aliases || [])].join(" "));
          asset._title = tierNormalizeSearch(asset.name);
        });
        data.assets = assets;
        data.assetMap = new Map(assets.map(asset => [asset.id, asset]));
        data.counts = {
          teams: assets.filter(asset => asset.type === "team").length,
          players: assets.filter(asset => asset.type === "player").length
        };
        const count = document.getElementById("tierAssetCount");
        if (count) count.textContent = `${data.counts.teams} times · ${data.counts.players} jogadores`;
      }

      function tierParseLogoSheet(tsv) {
        const lines = String(tsv || "").replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) return [];
        const headers = lines.shift().split("\t").map(tierNormalizeSearch);
        const nameIndex = headers.findIndex(value => ["equipe", "time", "team", "nome"].includes(value));
        const logoIndex = headers.findIndex(value => ["logo", "imagem", "image", "url"].includes(value));
        if (nameIndex < 0 || logoIndex < 0) return [];
        return lines.map(line => {
          const cells = line.split("\t");
          return { name: String(cells[nameIndex] || "").trim(), image: String(cells[logoIndex] || "").trim() };
        }).filter(item => item.name && /^https?:\/\//i.test(item.image));
      }

      function tierMergeLiveTeamLogos(rows) {
        if (!tierAssetData || !rows.length) return 0;
        const teamAssets = tierAssetData.assets.filter(asset => asset.type === "team");
        let changed = 0;
        rows.forEach(row => {
          const normalized = tierNormalizeSearch(row.name);
          let asset = teamAssets.find(item => item._title === normalized || (item.aliases || []).some(alias => tierNormalizeSearch(alias) === normalized));
          if (asset) {
            if (asset.image !== row.image) {
              asset.image = row.image;
              changed += 1;
            }
            if (!(asset.aliases || []).some(alias => tierNormalizeSearch(alias) === normalized) && asset._title !== normalized) {
              asset.aliases = [...(asset.aliases || []), row.name];
              changed += 1;
            }
            return;
          }
          const base = `team:sheet-${tierAssetSlug(row.name)}`;
          let id = base;
          let suffix = 2;
          while (tierAssetData.assets.some(item => item.id === id)) id = `${base}-${suffix++}`;
          const newAsset = { id, type: "team", name: row.name, subtitle: "Banco de logos", image: row.image, aliases: [] };
          tierAssetData.assets.push(newAsset);
          teamAssets.push(newAsset);
          changed += 1;
        });
        if (changed) tierRefreshAssetIndex(tierAssetData);
        return changed;
      }

      function loadLiveTeamLogos() {
        if (tierAssetType !== "team" || !tierNormalizeSearch(tierAssetQuery)) return Promise.resolve(0);
        if (tierLiveLogoPromise) return tierLiveLogoPromise;
        tierLiveLogoPromise = fetch(TIER_LOGO_SHEET_URL, { cache: "no-store", mode: "cors" })
          .then(response => {
            if (!response.ok) throw new Error("Planilha de logos indisponível");
            return response.text();
          })
          .then(tierParseLogoSheet)
          .then(tierMergeLiveTeamLogos)
          .catch(error => {
            console.warn("Não foi possível sincronizar a planilha de logos", error);
            return 0;
          });
        return tierLiveLogoPromise;
      }

      function loadTierAssetData() {
        if (tierAssetData) return Promise.resolve(tierAssetData);
        if (tierAssetPromise) return tierAssetPromise;
        const status = document.getElementById("tierAssetStatus");
        if (status) status.textContent = "Carregando biblioteca...";
        tierAssetPromise = fetch(TIER_ASSET_INDEX_URL, { cache: "default" })
          .then(response => {
            if (!response.ok) throw new Error("Biblioteca indisponível");
            return response.json();
          })
          .then(data => {
            tierAssetData = data;
            tierRefreshAssetIndex(data);
            renderTierAssetResults();
            return data;
          })
          .catch(error => {
            console.warn("Biblioteca de imagens indisponível", error);
            if (status) status.textContent = "Não foi possível carregar a biblioteca agora.";
            throw error;
          });
        return tierAssetPromise;
      }

      function tierAssetScore(asset, query, tokens) {
        if (!query) return 100;
        if (asset._title === query) return 1000;
        if (asset._title.startsWith(query)) return 850;
        if (asset._search.startsWith(query)) return 760;
        if (asset._search.includes(query)) return 620;
        let hits = 0;
        for (const token of tokens) if (asset._search.includes(token)) hits += 1;
        return hits === tokens.length ? 420 + hits * 10 : -1;
      }

      function renderTierAssetResults() {
        const root = document.getElementById("tierAssetResults");
        const status = document.getElementById("tierAssetStatus");
        if (!root) return;
        if (!tierAssetData) {
          root.innerHTML = "";
          return;
        }
        const query = tierNormalizeSearch(tierAssetQuery);
        const addVisibleButton = document.getElementById("tierAssetAddVisible");
        if (!query) {
          tierVisibleAssets = [];
          root.replaceChildren();
          if (status) status.textContent = "Digite um nome para pesquisar. Nenhuma logo é carregada enquanto o campo estiver vazio.";
          if (addVisibleButton) addVisibleButton.disabled = true;
          return;
        }
        const tokens = query.split(" ").filter(Boolean);
        tierVisibleAssets = tierAssetData.assets
          .filter(asset => asset.type === tierAssetType)
          .map(asset => ({ asset, score: tierAssetScore(asset, query, tokens) }))
          .filter(entry => entry.score >= 0)
          .sort((a, b) => b.score - a.score || a.asset.name.localeCompare(b.asset.name, "pt-BR"))
          .slice(0, 40)
          .map(entry => entry.asset);

        root.innerHTML = "";
        if (!tierVisibleAssets.length) {
          const empty = document.createElement("div");
          empty.className = "tier-library-empty";
          empty.textContent = "Nenhum item encontrado.";
          root.appendChild(empty);
          if (status) status.textContent = "Tente outro nome ou apelido.";
          if (addVisibleButton) addVisibleButton.disabled = true;
          return;
        }
        const fragment = document.createDocumentFragment();
        tierVisibleAssets.forEach(asset => {
          const button = document.createElement("button");
          button.type = "button";
          button.className = "tier-asset-card";
          button.dataset.assetId = asset.id;
          const unavailable = asset.type === "player" && asset.available === false;
          if (unavailable) button.disabled = true;

          const image = document.createElement("img");
          image.src = asset.image || (asset.type === "team" ? "escudo.webp" : "silhueta.webp");
          image.alt = "";
          image.loading = "lazy";
          image.decoding = "async";
          image.onerror = () => {
            image.onerror = null;
            image.src = asset.type === "team" ? "escudo.webp" : "silhueta.webp";
          };

          const copy = document.createElement("span");
          copy.className = "tier-asset-copy";
          const strong = document.createElement("strong");
          strong.textContent = asset.name;
          const small = document.createElement("small");
          small.textContent = unavailable ? "Foto não cadastrada" : (asset.subtitle || (asset.type === "team" ? "Equipe" : "Jogador"));
          copy.append(strong, small);

          const add = document.createElement("span");
          add.className = "tier-asset-add";
          add.textContent = unavailable ? "—" : "+";
          button.append(image, copy, add);
          fragment.appendChild(button);
        });
        root.appendChild(fragment);
        if (addVisibleButton) addVisibleButton.disabled = false;
        if (status) status.textContent = `${tierVisibleAssets.length} ${tierAssetType === "team" ? "times" : "jogadores"} encontrados.`;
      }

      function tierBlobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      async function tierAssetSource(asset) {
        const source = asset?.image || "";
        if (!source || !/^https?:\/\//i.test(source)) return source;
        if (tierAssetSourceCache.has(source)) return tierAssetSourceCache.get(source);
        const promise = fetch(source, { mode: "cors", cache: "force-cache" })
          .then(response => {
            if (!response.ok) throw new Error("Imagem indisponível");
            return response.blob();
          })
          .then(tierBlobToDataUrl)
          .catch(() => source);
        tierAssetSourceCache.set(source, promise);
        return promise;
      }

      function tierAssetAlreadyAdded(assetId) {
        return Object.values(state.images).some(image => image?.sourceAssetId === assetId);
      }

      async function registerTierAsset(asset) {
        if (!asset || !asset.image || (asset.type === "player" && asset.available === false)) return null;
        if (tierAssetAlreadyAdded(asset.id)) return null;
        const src = await tierAssetSource(asset);
        if (!src) return null;
        const id = crypto.randomUUID();
        state.images[id] = normalizeImageData({
          id,
          name: asset.name,
          src,
          originalSrc: src,
          previewSrc: src,
          sourceAssetId: asset.id,
          sourceType: asset.type,
          sourceSubtitle: asset.subtitle || ""
        });
        state.bank.push(id);
        return id;
      }

      async function addTierAsset(asset, silent = false) {
        if (tierAssetAlreadyAdded(asset.id)) {
          if (!silent) showToast(`${asset.name} já foi adicionado.`);
          return false;
        }
        const id = await registerTierAsset(asset);
        if (!id) {
          if (!silent) showToast("Essa imagem não está disponível.");
          return false;
        }
        render();
        pushHistory();
        if (!silent) showToast(`${asset.name} adicionado.`);
        return true;
      }

      async function addVisibleTierAssets() {
        if (!tierVisibleAssets.length) return;
        const available = tierVisibleAssets.filter(asset => asset.image && !(asset.type === "player" && asset.available === false) && !tierAssetAlreadyAdded(asset.id));
        if (!available.length) {
          showToast("Todos os itens exibidos já estão no projeto.");
          return;
        }
        const button = document.getElementById("tierAssetAddVisible");
        if (button) button.disabled = true;
        let added = 0;
        for (let i = 0; i < available.length; i += 5) {
          const batch = available.slice(i, i + 5);
          const ids = await Promise.all(batch.map(registerTierAsset));
          added += ids.filter(Boolean).length;
          render();
          await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (button) button.disabled = false;
        if (added) pushHistory();
        showToast(`${added} ${added === 1 ? "imagem adicionada" : "imagens adicionadas"}.`);
      }

      function tierProjectHasContent() {
        return state.bank.length || state.archived.length || Object.keys(state.images).length || state.rows.some(row => row.images?.length) || state.caption || state.background;
      }

      async function applyTierPreset(preset, assets, options = {}) {
        if (!preset) return false;
        const { skipConfirm = false, silent = false } = options;
        if (!skipConfirm && tierProjectHasContent() && !confirm(`Abrir “${preset.name}”? O projeto atual será substituído.`)) return false;
        const status = document.getElementById("tierPresetStatus");
        const buttons = [...document.querySelectorAll("[data-tier-preset]")];
        buttons.forEach(button => button.disabled = true);
        if (status && !silent) status.textContent = "Carregando projeto...";
        try {
          state.rows = (preset.rows || []).map(row => ({ id: crypto.randomUUID(), name: row.name, color: row.color, images: [], height: DEFAULT_SETTINGS.rowMinHeight }));
          state.images = {};
          state.bank = [];
          state.archived = [];
          state.caption = preset.caption || preset.name || "";
          state.captionImage = preset.captionImage || "";
          state.background = preset.background || "";
          state.settings = { ...DEFAULT_SETTINGS, ...(preset.settings || {}) };
          els.captionInput.value = state.caption;
          for (let i = 0; i < assets.length; i += 5) {
            await Promise.all(assets.slice(i, i + 5).map(registerTierAsset));
            render();
            await new Promise(resolve => setTimeout(resolve, 0));
          }
          currentBrowserProjectName = "";
          localStorage.removeItem(CURRENT_PROJECT_KEY);
          historyStack = [];
          historyIndex = -1;
          render();
          pushHistory(true);
          if (status && !silent) status.textContent = `${assets.length} imagens prontas para classificar.`;
          if (!silent) showToast(`${preset.name} aberto.`);
          document.getElementById("projectMenu")?.removeAttribute("open");
          return true;
        } finally {
          buttons.forEach(button => button.disabled = false);
        }
      }

      async function loadTierPreset(presetId, options = {}) {
        const data = await loadTierAssetData();
        const preset = (data.presets || []).find(item => item.id === presetId);
        if (!preset) return false;
        const assets = (preset.assetIds || []).map(id => data.assetMap.get(id)).filter(Boolean);
        return applyTierPreset(preset, assets, options);
      }

      async function loadDefaultTierPreset() {
        const response = await fetch(TIER_DEFAULT_PRESET_URL, { cache: "default" });
        if (!response.ok) throw new Error("Projeto padrão indisponível");
        const preset = await response.json();
        return applyTierPreset(preset, Array.isArray(preset.assets) ? preset.assets : [], { skipConfirm: true, silent: true });
      }

      function defaultImageEdit() {
        return {
          mainScale: 100,
          mainOffsetX: 0,
          mainOffsetY: 0,
          outlineSize: 0,
          outlineColor: "#ffffff",
          shadowSize: 0,
          shadowColor: "#000000",
          bgMode: "none",
          bgColor: "#101217",
          bgImageSrc: "",
          bgFit: "cover",
          bgOpacity: 100,
          bgZoom: 100,
          bgPosX: 50,
          bgPosY: 50,
          bannerEnabled: false,
          bannerHeight: 72,
          bannerColor: "#000000",
          bannerOpacity: 70,
          text: "",
          textSize: 28,
          textColor: "#ffffff",
          textAlign: "center",
          textX: 50,
          textY: 86,
          textStroke: 2,
          textStrokeColor: "#000000",
          textShadow: true,
          pipEnabled: false,
          pipSrc: "",
          pipSize: 28,
          pipX: 70,
          pipY: 8
        };
      }

      function normalizeImageData(image) {
        const src = image.originalSrc || image.src || "";
        return {
          ...image,
          src,
          originalSrc: src,
          previewSrc: image.previewSrc || image.src || src,
          edit: { ...defaultImageEdit(), ...(image.edit || {}) }
        };
      }

      function normalizeStateImages() {
        Object.keys(state.images).forEach(id => {
          state.images[id] = normalizeImageData(state.images[id]);
        });
      }

      function showToast(message) {
        clearTimeout(toastTimer);
        els.toast.textContent = message;
        els.toast.classList.add("show");
        toastTimer = setTimeout(() => els.toast.classList.remove("show"), 2200);
      }

      function applySettings() {
        const s = state.settings;
        els.root.style.setProperty("--label-width", `${s.labelWidth}px`);
        els.root.style.setProperty("--board-width", `${s.boardWidth}px`);
        els.root.style.setProperty("--image-size", `${s.imageSize}px`);
        els.root.style.setProperty("--image-gap", `${s.gap}px`);
        els.root.style.setProperty("--row-min-height", `${s.rowMinHeight}px`);
        els.root.style.setProperty("--separator-width", `${s.separatorWidth}px`);
        els.root.style.setProperty("--separator-color", s.separatorColor);
        els.root.style.setProperty("--caption-font-size", `${s.captionFontSize}px`);
        els.root.style.setProperty("--caption-font-family", s.captionFontFamily);
        els.root.style.setProperty("--caption-text-align", s.captionAlign);
        els.root.style.setProperty("--caption-color", s.captionColor);
        els.root.style.setProperty("--caption-bg", hexToRgba(s.captionBgColor, s.captionBgOpacity / 100));
        els.root.style.setProperty("--caption-image-size", `${s.captionImageSize}px`);
        els.root.style.setProperty("--row-font-size", `${s.rowFontSize}px`);
        els.root.style.setProperty("--row-font-family", s.rowFontFamily);
        els.root.style.setProperty("--row-text-align", s.rowTextAlign);
        els.root.style.setProperty("--row-padding-x", `${s.rowPaddingX}px`);
        els.root.style.setProperty("--row-padding-y", `${s.rowPaddingY}px`);
        els.root.style.setProperty("--row-vertical-align", ({ top: "start", center: "center", bottom: "end" }[s.rowVerticalAlign] || "center"));
        els.root.style.setProperty("--card-bg", s.imageFrameEnabled ? "#08090b" : "transparent");
        els.root.style.setProperty("--card-border", s.imageFrameEnabled ? "rgba(255,255,255,.16)" : "transparent");
        els.root.style.setProperty("--card-shadow", s.imageFrameEnabled ? "0 4px 16px rgba(0,0,0,.22)" : "none");
        els.tierBoard.style.setProperty("--bg-overlay", String(s.overlay / 100));

        els.tierBoard.style.backgroundColor = s.backgroundColor;
        if (state.background) {
          els.tierBoard.style.backgroundImage = `url("${state.background}")`;
          if (s.backgroundFit === "stretch") {
            els.tierBoard.style.backgroundSize = "100% 100%";
          } else {
            els.tierBoard.style.backgroundSize = `${s.backgroundZoom}%`;
          }
          els.tierBoard.style.backgroundPosition = `${s.backgroundPosX}% ${s.backgroundPosY}%`;
        } else {
          els.tierBoard.style.backgroundImage = "none";
        }

        renderCaptionBlock();
        updateSettingsControls();
        updateChoiceButtons("captionAlignButtons", s.captionAlign);
        updateChoiceButtons("rowAlignButtons", s.rowTextAlign);
        updateChoiceButtons("rowVerticalButtons", s.rowVerticalAlign);
        updateChoiceButtons("rowAutoFitButtons", String(s.rowAutoFit));
        updateChoiceButtons("rowAutoHeightButtons", String(s.rowAutoHeight));
        updateChoiceButtons("imageFrameButtons", String(s.imageFrameEnabled));
        updateChoiceButtons("positionModeButtons", String(s.positionMode));
        updateChoiceButtons("quickPositionButtons", String(s.positionMode));
        updateChoiceButtons("positionScopeButtons", s.positionScope);
        updateChoiceButtons("positionHorizontalButtons", s.positionHorizontal);
        updateChoiceButtons("positionVerticalButtons", s.positionVertical);
        const quickDot = document.getElementById("quickPositionDot");
        if (quickDot) quickDot.classList.toggle("active", Boolean(s.positionMode));
        requestAnimationFrame(fitAllRowTexts);
      }

      function renderCaptionBlock() {
        const hasText = Boolean((state.caption || "").trim());
        const hasImage = Boolean(state.captionImage);
        els.tierCaption.innerHTML = "";
        els.tierCaption.className = `tier-caption${hasText || hasImage ? " visible" : ""} position-${state.settings.captionImagePosition}`;
        if (!hasText && !hasImage) return;

        const inner = document.createElement("div");
        inner.className = "tier-caption-inner";

        if (hasImage) {
          const media = document.createElement("div");
          media.className = "tier-caption-media";
          const img = document.createElement("img");
          img.src = state.captionImage;
          img.alt = "Imagem da legenda";
          media.appendChild(img);
          inner.appendChild(media);
        }

        if (hasText) {
          const text = document.createElement("div");
          text.className = "tier-caption-text";
          text.textContent = state.caption;
          inner.appendChild(text);
        }

        els.tierCaption.appendChild(inner);
      }

      function updateCaption() {
        state.caption = els.captionInput.value;
        renderCaptionBlock();
        scheduleHistoryPush();
      }

      function imageCard(imageId, zoneId = "bank") {
        const data = state.images[imageId];
        const card = document.createElement("div");
        card.className = "image-card";
        card.draggable = true;
        card.dataset.imageId = imageId;
        card.title = data?.name || "Imagem";

        const img = document.createElement("img");
        img.src = data.previewSrc || data.src;
        img.alt = data.name || "Imagem da tier list";

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const edit = document.createElement("button");
        edit.type = "button";
        edit.className = "edit-image";
        edit.title = "Editar imagem";
        edit.textContent = "✎";
        edit.addEventListener("click", (event) => {
          event.stopPropagation();
          openImageEditor(imageId);
        });

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "archive-image";
        remove.title = "Mover para a lixeira";
        remove.setAttribute("aria-label", "Mover imagem para a lixeira");
        remove.textContent = "🗑";
        remove.addEventListener("click", (event) => {
          event.stopPropagation();
          archiveImage(imageId);
        });

        actions.append(edit, remove);
        card.append(img, actions);

        card.addEventListener("dragstart", () => {
          draggedImageId = imageId;
          card.classList.add("dragging");
        });

        card.addEventListener("dragend", () => {
          draggedImageId = null;
          card.classList.remove("dragging");
          document.querySelectorAll(".drag-over").forEach(el => el.classList.remove("drag-over"));
        });

        card.addEventListener("click", (event) => {
          if (!isMobileInteractionMode()) return;
          if (event.target.closest('.card-actions')) return;
          event.preventDefault();
          event.stopPropagation();
          if (touchSelectedImageId && touchSelectedImageId !== imageId) {
            const zone = card.closest('.dropzone');
            const zoneId = zone?.dataset.zone || 'bank';
            moveSelectedImageMobile(zoneId, imageId);
            return;
          }
          selectTouchImage(imageId);
        });

        return card;
      }

      function makeDropzone(zone, imageIds) {
        const frag = document.createDocumentFragment();
        imageIds.forEach(id => {
          if (state.images[id]) frag.appendChild(imageCard(id, zone.dataset.zone));
        });
        zone.appendChild(frag);

        zone.addEventListener("dragover", (event) => {
          event.preventDefault();
          zone.classList.add("drag-over");
        });

        zone.addEventListener("dragleave", (event) => {
          if (!zone.contains(event.relatedTarget)) zone.classList.remove("drag-over");
        });

        zone.addEventListener("drop", (event) => {
          event.preventDefault();
          zone.classList.remove("drag-over");
          if (!draggedImageId) return;

          const beforeCard = event.target.closest(".image-card");
          const beforeId = beforeCard?.dataset.imageId || null;
          moveImage(draggedImageId, zone.dataset.zone, beforeId);
        });

        zone.addEventListener("click", (event) => {
          if (!isMobileInteractionMode() || !touchSelectedImageId) return;
          if (event.target.closest('.image-card') || event.target.closest('button') || event.target.closest('input')) return;
          event.preventDefault();
          moveSelectedImageMobile(zone.dataset.zone);
        });
      }


      function archivedImageCard(imageId) {
        const data = state.images[imageId];
        const card = document.createElement("div");
        card.className = "image-card";
        card.dataset.imageId = imageId;
        card.title = data?.name || "Imagem oculta";

        const img = document.createElement("img");
        img.src = data.previewSrc || data.src;
        img.alt = data.name || "Imagem oculta";

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const restore = document.createElement("button");
        restore.type = "button";
        restore.className = "restore-image";
        restore.title = "Restaurar para imagens não classificadas";
        restore.textContent = "↩";
        restore.addEventListener("click", event => {
          event.stopPropagation();
          restoreArchivedImage(imageId);
        });

        const removeForever = document.createElement("button");
        removeForever.type = "button";
        removeForever.className = "delete-forever-image";
        removeForever.title = "Excluir definitivamente";
        removeForever.textContent = "×";
        removeForever.addEventListener("click", event => {
          event.stopPropagation();
          if (confirm("Excluir esta imagem definitivamente do projeto?")) deleteImage(imageId);
        });

        actions.append(restore, removeForever);
        card.append(img, actions);
        return card;
      }

      function renderArchivedBank() {
        els.archivedBank.replaceChildren();
        state.archived.forEach(id => {
          if (state.images[id]) els.archivedBank.appendChild(archivedImageCard(id));
        });
        if (!state.archived.length) {
          const hint = document.createElement("div");
          hint.className = "empty-hint";
          hint.textContent = "Nenhuma logo está oculta.";
          els.archivedBank.appendChild(hint);
        }
        els.archivedCount.textContent = `${state.archived.length} ${state.archived.length === 1 ? "imagem" : "imagens"}`;
      }

      function setupTrashDropzone() {
        const panel = document.getElementById("trashPanel");
        if (!panel || !els.archivedBank) return;
        let openTimer = null;
        const activate = event => {
          if (!draggedImageId) return;
          event.preventDefault();
          panel.classList.add("drag-over");
          clearTimeout(openTimer);
          openTimer = setTimeout(() => { panel.open = true; }, 180);
        };
        const deactivate = event => {
          if (event && panel.contains(event.relatedTarget)) return;
          clearTimeout(openTimer);
          panel.classList.remove("drag-over");
        };
        panel.addEventListener("dragenter", activate);
        panel.addEventListener("dragover", activate);
        panel.addEventListener("dragleave", deactivate);
        panel.addEventListener("drop", event => {
          if (!draggedImageId) return;
          event.preventDefault();
          clearTimeout(openTimer);
          panel.classList.remove("drag-over");
          const imageId = draggedImageId;
          draggedImageId = null;
          archiveImage(imageId);
        });
        els.archivedBank.addEventListener("click", event => {
          if (!isMobileInteractionMode() || !touchSelectedImageId) return;
          if (event.target.closest(".image-card") || event.target.closest("button")) return;
          event.preventDefault();
          const imageId = touchSelectedImageId;
          touchSelectedImageId = null;
          archiveImage(imageId);
        });
      }

      function createTierRow(row, index) {
        const rowEl = document.createElement("div");
        rowEl.className = "tier-row";
        rowEl.dataset.rowId = row.id;
        rowEl.style.minHeight = `${getRowBaseHeight(row)}px`;

        const label = document.createElement("div");
        label.className = "row-label";
        label.style.background = row.color;

        const name = document.createElement("div");
        name.className = "row-name";
        name.contentEditable = "true";
        name.spellcheck = false;
        name.textContent = row.name;
        name.addEventListener("input", () => {
          row.name = name.innerText.replace(/\n{3,}/g, "\n\n");
          renderRowManager();
          requestAnimationFrame(() => fitRowTextElement(name, label));
          scheduleHistoryPush();
        });
        name.addEventListener("keydown", (event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            name.blur();
          }
        });

        const tools = document.createElement("div");
        tools.className = "row-tools";

        const up = miniButton("↑", "Mover row para cima", () => moveRow(index, -1));
        const down = miniButton("↓", "Mover row para baixo", () => moveRow(index, 1));
        const clear = miniButton("⌫", "Mover imagens desta row para o banco", () => clearRow(row.id));
        tools.append(up, down, clear);

        const rowDelete = miniButton("×", `Excluir row ${row.name}`, () => deleteRow(row.id));
        rowDelete.classList.add("row-delete-button");
        rowDelete.setAttribute("aria-label", `Excluir row ${row.name}`);

        const color = document.createElement("input");
        color.type = "color";
        color.className = "row-color";
        color.value = row.color;
        color.title = "Trocar cor da row";
        color.addEventListener("input", () => {
          row.color = color.value;
          label.style.background = row.color;
          renderRowManager();
          scheduleHistoryPush();
        });

        label.append(rowDelete, name, tools, color);

        const zone = document.createElement("div");
        zone.className = "dropzone";
        zone.dataset.zone = row.id;
        makeDropzone(zone, row.images);

        rowEl.append(label, zone);
        return rowEl;
      }

      function miniButton(text, title, action) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.title = title;
        button.addEventListener("click", action);
        return button;
      }

      function render() {
        updateCaption();
        applySettings();

        els.tierBoard.replaceChildren();
        state.rows.forEach((row, index) => els.tierBoard.appendChild(createTierRow(row, index)));

        els.imageBank.replaceChildren();
        makeDropzone(els.imageBank, state.bank);
        updatePositionBadges();

        if (!state.bank.length) {
          const hint = document.createElement("div");
          hint.className = "empty-hint";
          const imagesInRows = state.rows.some(row => row.images.length);
          hint.textContent = state.archived.length && !imagesInRows
            ? "As imagens do projeto estão ocultas na lixeira abaixo."
            : Object.keys(state.images).length
              ? "Todas as imagens já estão em alguma row."
              : "Adicione imagens e arraste para qualquer row.";
          els.imageBank.appendChild(hint);
        }

        els.bankCount.textContent = `${state.bank.length} ${state.bank.length === 1 ? "imagem" : "imagens"}`;
        renderArchivedBank();
        renderRowManager();
        requestAnimationFrame(fitAllRowTexts);
        updateTouchSelectionUI();
      }

      function fitRowTextElement(nameEl, labelEl) {
        if (!nameEl || !labelEl) return;
        const s = state.settings;
        const baseFont = s.rowFontSize;
        nameEl.style.fontSize = `${baseFont}px`;
        nameEl.style.lineHeight = "1.12";

        if (!s.rowAutoFit || s.rowAutoHeight) return;

        const availableHeight = Math.max(20, labelEl.clientHeight - (s.rowPaddingY * 2));
        let current = baseFont;
        while (current > 10 && nameEl.scrollHeight > availableHeight + 1) {
          current -= 1;
          nameEl.style.fontSize = `${current}px`;
        }
      }

      function fitAllRowTexts() {
        document.querySelectorAll('.row-label').forEach(label => {
          fitRowTextElement(label.querySelector('.row-name'), label);
        });
      }


      function flashRowsHighlight() {
        document.querySelectorAll('.tier-row').forEach(row => {
          row.classList.remove('highlight-target');
          void row.offsetWidth;
          row.classList.add('highlight-target');
          setTimeout(() => row.classList.remove('highlight-target'), 900);
        });
      }

      function flashCaptionHighlight() {
        const caption = els.tierCaption;
        if (!caption) return;
        caption.classList.remove('highlight-target');
        void caption.offsetWidth;
        caption.classList.add('highlight-target');
        setTimeout(() => caption.classList.remove('highlight-target'), 900);
      }

      function getRowBaseHeight(row) {
        return Number(row.height) > 0 ? Number(row.height) : state.settings.rowMinHeight;
      }

      function formatPositionBadge(index) {
        return `[${index + 1}º]`;
      }

      function getPositionLookup() {
        const map = new Map();
        if (state.settings.positionScope === "row") {
          state.rows.forEach(row => {
            row.images.forEach((id, index) => map.set(id, index));
          });
          return map;
        }
        let counter = 0;
        state.rows.forEach(row => {
          row.images.forEach(id => {
            map.set(id, counter);
            counter += 1;
          });
        });
        return map;
      }

      function applyPositionBadgeToCard(card, index) {
        const s = state.settings;
        let badge = card.querySelector('.image-rank-badge');
        if (!s.positionMode) {
          if (badge) badge.remove();
          return;
        }
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'image-rank-badge';
          card.appendChild(badge);
        }
        badge.textContent = formatPositionBadge(index);
        badge.style.fontSize = `${s.positionFontSize}px`;
        badge.style.fontFamily = s.positionFontFamily;
        badge.style.color = s.positionTextColor;
        badge.style.background = s.positionBgColor;
        badge.style.border = '0';
        badge.style.left = s.positionHorizontal === 'left' ? '4px' : 'auto';
        badge.style.right = s.positionHorizontal === 'right' ? '4px' : 'auto';
        badge.style.top = s.positionVertical === 'top' ? '4px' : 'auto';
        badge.style.bottom = s.positionVertical === 'bottom' ? '4px' : 'auto';
        badge.style.webkitTextStroke = `${s.positionTextStroke}px ${s.positionTextStrokeColor}`;
        badge.style.paintOrder = 'stroke fill';
        badge.style.textShadow = s.positionShadowSize > 0
          ? `0 0 ${s.positionShadowSize}px ${s.positionShadowColor}`
          : 'none';
      }

      function updatePositionBadges() {
        const lookup = getPositionLookup();
        document.querySelectorAll('.dropzone').forEach(zone => {
          const cards = [...zone.querySelectorAll('.image-card')];
          if (zone.dataset.zone === 'bank') {
            cards.forEach(card => card.querySelector('.image-rank-badge')?.remove());
            return;
          }
          cards.forEach(card => {
            const rank = lookup.get(card.dataset.imageId);
            applyPositionBadgeToCard(card, Number.isFinite(rank) ? rank : 0);
          });
        });
      }

      function isMobileInteractionMode() {
        return window.matchMedia('(hover: none), (pointer: coarse)').matches || window.innerWidth <= 760;
      }

      function updateTouchSelectionUI() {
        document.querySelectorAll('.image-card').forEach(card => {
          card.classList.toggle('touch-selected', Boolean(touchSelectedImageId) && card.dataset.imageId === touchSelectedImageId);
        });
        document.querySelectorAll('.dropzone').forEach(zone => {
          zone.classList.toggle('mobile-target', Boolean(touchSelectedImageId));
        });
      }

      function clearTouchSelection() {
        touchSelectedImageId = null;
        updateTouchSelectionUI();
      }

      function selectTouchImage(imageId) {
        touchSelectedImageId = touchSelectedImageId === imageId ? null : imageId;
        updateTouchSelectionUI();
        if (touchSelectedImageId && !mobileMoveHintShown) {
          showToast('Toque em uma row ou em outra imagem para mover.');
          mobileMoveHintShown = true;
        }
      }

      function moveSelectedImageMobile(zoneId, beforeId = null) {
        if (!touchSelectedImageId) return false;
        const selectedId = touchSelectedImageId;
        touchSelectedImageId = null;
        moveImage(selectedId, zoneId, beforeId);
        return true;
      }

      function removeFromAllZones(imageId) {
        state.bank = state.bank.filter(id => id !== imageId);
        state.archived = state.archived.filter(id => id !== imageId);
        state.rows.forEach(row => {
          row.images = row.images.filter(id => id !== imageId);
        });
      }

      function archiveImage(imageId) {
        if (!state.images[imageId]) return;
        removeFromAllZones(imageId);
        if (!state.archived.includes(imageId)) state.archived.push(imageId);
        if (touchSelectedImageId === imageId) touchSelectedImageId = null;
        render();
        pushHistory();
        showToast("Logo ocultada. Ela pode ser restaurada na lixeira.");
      }

      function restoreArchivedImage(imageId) {
        if (!state.images[imageId]) return;
        removeFromAllZones(imageId);
        if (!state.bank.includes(imageId)) state.bank.push(imageId);
        render();
        pushHistory();
        showToast("Logo restaurada.");
      }

      function moveImage(imageId, targetZone, beforeId = null) {
        if (!state.images[imageId]) return;
        removeFromAllZones(imageId);

        const target = targetZone === "bank"
          ? state.bank
          : state.rows.find(row => row.id === targetZone)?.images;

        if (!target) {
          state.bank.push(imageId);
          render();
          pushHistory();
          return;
        }

        const beforeIndex = beforeId ? target.indexOf(beforeId) : -1;
        if (beforeIndex >= 0 && beforeId !== imageId) {
          target.splice(beforeIndex, 0, imageId);
        } else {
          target.push(imageId);
        }
        render();
        pushHistory();
      }

      function deleteImage(imageId) {
        removeFromAllZones(imageId);
        delete state.images[imageId];
        if (touchSelectedImageId === imageId) touchSelectedImageId = null;
        render();
        pushHistory();
      }

      function addRow(name = "Nova", color = randomTierColor()) {
        state.rows.push({
          id: crypto.randomUUID(),
          name,
          color,
          images: [],
          height: state.settings.rowMinHeight
        });
        render();
        pushHistory();
      }

      function randomTierColor() {
        const palette = ["#ff7f7f", "#ffbf7f", "#ffdf7f", "#ffff7f", "#bfff7f", "#7fffff", "#7fbfff", "#bf7fff", "#ff7fff"];
        return palette[state.rows.length % palette.length];
      }

      function moveRow(index, direction) {
        const target = index + direction;
        if (target < 0 || target >= state.rows.length) return;
        [state.rows[index], state.rows[target]] = [state.rows[target], state.rows[index]];
        render();
        pushHistory();
      }

      function clearRow(rowId) {
        const row = state.rows.find(item => item.id === rowId);
        if (!row || !row.images.length) return;
        state.bank.push(...row.images);
        row.images = [];
        render();
        pushHistory();
      }

      function deleteRow(rowId) {
        if (state.rows.length === 1) {
          showToast("A tier precisa ter pelo menos uma row.");
          return;
        }
        const index = state.rows.findIndex(row => row.id === rowId);
        if (index < 0) return;
        const row = state.rows[index];
        const message = row.images.length
          ? `Excluir a row “${row.name}”? As ${row.images.length} imagens voltarão para a área não classificada.`
          : `Excluir a row “${row.name}”?`;
        if (!confirm(message)) return;
        state.bank.push(...row.images);
        state.rows.splice(index, 1);
        render();
        pushHistory();
        showToast("Row excluída.");
      }

      function renderRowManager() {
        els.rowManager.replaceChildren();
        state.rows.forEach((row, index) => {
          const item = document.createElement("div");
          item.className = "row-manager-item";

          const swatch = document.createElement("div");
          swatch.className = "swatch";
          swatch.style.background = row.color;

          const main = document.createElement("div");
          main.className = "row-manager-main";

          const input = document.createElement("input");
          input.type = "text";
          input.value = row.name;
          input.addEventListener("change", () => {
            row.name = input.value || "Row";
            render();
            pushHistory();
          });

          const palette = document.createElement("div");
          palette.className = "preset-palette";
          TIER_PRESET_COLORS.forEach(colorValue => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "preset-color-btn";
            button.style.background = colorValue;
            button.title = `Usar ${colorValue}`;
            button.addEventListener("click", () => {
              row.color = colorValue;
              render();
              pushHistory();
            });
            palette.appendChild(button);
          });
          const customColor = document.createElement("input");
          customColor.type = "color";
          customColor.value = row.color;
          customColor.title = "Escolher qualquer cor";
          customColor.addEventListener("input", () => {
            row.color = customColor.value;
            render();
            scheduleHistoryPush();
          });
          palette.appendChild(customColor);

          const heightWrap = document.createElement('div');
          heightWrap.className = 'row-height-control';
          const heightRange = document.createElement('input');
          heightRange.type = 'range';
          heightRange.min = '40';
          heightRange.max = '500';
          heightRange.step = '1';
          heightRange.value = String(getRowBaseHeight(row));
          const heightNumberWrap = document.createElement('div');
          heightNumberWrap.className = 'unit-input';
          const heightNumber = document.createElement('input');
          heightNumber.type = 'number';
          heightNumber.min = '40';
          heightNumber.max = '500';
          heightNumber.step = '1';
          heightNumber.value = String(getRowBaseHeight(row));
          const heightUnit = document.createElement('span');
          heightUnit.textContent = 'px';
          heightNumberWrap.append(heightNumber, heightUnit);
          const applyRowHeight = value => {
            const normalized = Math.max(40, Math.min(500, Number(value) || state.settings.rowMinHeight));
            row.height = normalized;
            heightRange.value = String(normalized);
            heightNumber.value = String(normalized);
            render();
            renderRowManager();
            flashRowsHighlight();
            scheduleHistoryPush();
          };
          heightRange.addEventListener('input', () => applyRowHeight(heightRange.value));
          heightNumber.addEventListener('input', () => applyRowHeight(heightNumber.value));
          heightWrap.append(heightRange, heightNumberWrap);

          main.append(input, palette, heightWrap);

          const buttons = document.createElement("div");
          buttons.className = "row-manager-buttons";
          buttons.append(
            miniButton("↑", "Subir", () => moveRow(index, -1)),
            miniButton("↓", "Descer", () => moveRow(index, 1)),
            miniButton("×", "Excluir", () => deleteRow(row.id))
          );

          item.append(swatch, main, buttons);
          els.rowManager.appendChild(item);
        });
      }

      async function addImageFiles(files) {
        const valid = [...files].filter(file => file.type.startsWith("image/"));
        for (const file of valid) {
          const src = await readFileAsDataURL(file);
          const id = crypto.randomUUID();
          state.images[id] = normalizeImageData({ id, name: file.name, src, originalSrc: src, previewSrc: src });
          state.bank.push(id);
        }
        render();
        if (valid.length) {
          pushHistory();
          showToast(`${valid.length} ${valid.length === 1 ? "imagem adicionada" : "imagens adicionadas"}.`);
        }
      }

      function readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      }

      function downloadBlob(content, filename, type) {
        const blob = content instanceof Blob ? content : new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = filename;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }

      function saveProject() {
        const project = {
          version: 5,
          savedAt: new Date().toISOString(),
          state
        };
        downloadBlob(JSON.stringify(project, null, 2), "tier-list-projeto.json", "application/json");
        showToast("Projeto salvo.");
      }


      function compactChangedValues(source, defaults) {
        const compact = {};
        for (const [key, value] of Object.entries(source || {})) {
          if (JSON.stringify(value) !== JSON.stringify(defaults?.[key])) compact[key] = value;
        }
        return compact;
      }

      function createShareSnapshot() {
        const snapshot = snapshotState();
        const images = {};
        for (const [id, image] of Object.entries(snapshot.images || {})) {
          const originalSrc = image.originalSrc || image.src || "";
          images[id] = {
            id,
            name: image.name || "Imagem",
            src: image.sourceAssetId ? `asset:${image.sourceAssetId}` : originalSrc,
            sourceAssetId: image.sourceAssetId || "",
            sourceType: image.sourceType || "",
            sourceSubtitle: image.sourceSubtitle || "",
            edit: compactChangedValues(image.edit || {}, defaultImageEdit())
          };
        }
        return {
          rows: snapshot.rows,
          images,
          bank: snapshot.bank,
          archived: snapshot.archived,
          caption: snapshot.caption,
          captionImage: snapshot.captionImage,
          background: snapshot.background,
          settings: compactChangedValues(snapshot.settings || {}, DEFAULT_SETTINGS)
        };
      }

      function bytesToBase64Url(bytes) {
        let binary = "";
        const chunkSize = 0x8000;
        for (let index = 0; index < bytes.length; index += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
      }

      function base64UrlToBytes(value) {
        const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
        const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
        const binary = atob(padded);
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
        return bytes;
      }

      async function streamBytes(bytes, StreamType) {
        const stream = new Blob([bytes]).stream().pipeThrough(new StreamType("gzip"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }

      async function encodeShareProject() {
        const packageData = {
          version: TIER_SHARE_VERSION,
          createdAt: new Date().toISOString(),
          state: createShareSnapshot()
        };
        const rawBytes = new TextEncoder().encode(JSON.stringify(packageData));
        let mode = "r";
        let payloadBytes = rawBytes;
        if (typeof CompressionStream === "function") {
          try {
            const compressed = await streamBytes(rawBytes, CompressionStream);
            if (compressed.length < rawBytes.length) {
              mode = "g";
              payloadBytes = compressed;
            }
          } catch (error) {
            console.warn("Compressão do link indisponível", error);
          }
        }
        return `${mode}.${bytesToBase64Url(payloadBytes)}`;
      }

      async function decodeShareProject(payload) {
        if (!payload || payload.length > TIER_SHARE_MAX_PAYLOAD_LENGTH) throw new Error("Link muito grande ou inválido.");
        const separator = payload.indexOf(".");
        if (separator <= 0) throw new Error("Formato de link inválido.");
        const mode = payload.slice(0, separator);
        let bytes = base64UrlToBytes(payload.slice(separator + 1));
        if (mode === "g") {
          if (typeof DecompressionStream !== "function") throw new Error("Este navegador não consegue abrir o link compactado.");
          bytes = await streamBytes(bytes, DecompressionStream);
        } else if (mode !== "r") {
          throw new Error("Versão de link não reconhecida.");
        }
        const json = new TextDecoder().decode(bytes);
        if (json.length > 2_000_000) throw new Error("Projeto compartilhado grande demais.");
        const project = JSON.parse(json);
        if (project?.version !== TIER_SHARE_VERSION || !project?.state) throw new Error("Projeto compartilhado inválido.");
        return project;
      }

      async function hydrateSharedProject(project) {
        const rawState = project?.state || project;
        const rawImages = rawState?.images && typeof rawState.images === "object" ? rawState.images : {};
        const needsAssets = Object.values(rawImages).some(image => image?.sourceAssetId && String(image.src || "").startsWith("asset:"));
        let assetMap = null;
        if (needsAssets) {
          const data = await loadTierAssetData();
          assetMap = data.assetMap;
        }
        for (const image of Object.values(rawImages)) {
          if (!image?.sourceAssetId || !String(image.src || "").startsWith("asset:")) continue;
          const asset = assetMap?.get(image.sourceAssetId);
          if (!asset?.image) throw new Error(`Imagem não encontrada: ${image.name || image.sourceAssetId}`);
          const source = await tierAssetSource(asset);
          image.src = source;
          image.originalSrc = source;
          image.previewSrc = source;
        }
        return normalizeLegacyProject({ state: rawState });
      }

      function imageEditHasChanges(edit) {
        const defaults = defaultImageEdit();
        return Object.keys(defaults).some(key => JSON.stringify(edit?.[key]) !== JSON.stringify(defaults[key]));
      }

      async function rebuildSharedImagePreviews() {
        const entries = Object.entries(state.images).filter(([, image]) => imageEditHasChanges(image.edit));
        for (let index = 0; index < entries.length; index += 1) {
          const [id, image] = entries[index];
          try {
            const canvas = await renderImageComposition(image, image.edit, 512);
            image.previewSrc = canvas.toDataURL("image/png");
            syncEditedImageCard(id, image.previewSrc);
          } catch (error) {
            console.warn("Não foi possível reconstruir uma edição compartilhada", error);
          }
          if (index % 3 === 2) await new Promise(resolve => setTimeout(resolve, 0));
        }
      }

      function buildShareUrl(payload) {
        const url = new URL(window.location.href);
        url.hash = `${TIER_SHARE_HASH_KEY}=${payload}`;
        return url.toString();
      }

      function setShareDialogState({ url = "", message = "", error = false } = {}) {
        const input = document.getElementById("shareProjectUrl");
        const status = document.getElementById("shareProjectStatus");
        const copyButton = document.getElementById("copyShareProjectBtn");
        const nativeButton = document.getElementById("nativeShareProjectBtn");
        if (input) input.value = url;
        if (status) {
          status.textContent = message;
          status.classList.toggle("error", error);
        }
        if (copyButton) copyButton.disabled = !url;
        if (nativeButton) nativeButton.disabled = !url || typeof navigator.share !== "function";
      }

      async function openShareProjectDialog() {
        const button = document.getElementById("shareLinkBtn");
        if (button) button.disabled = true;
        setShareDialogState({ message: "Preparando link..." });
        if (!els.shareProjectDialog.open) els.shareProjectDialog.showModal();
        try {
          const payload = await encodeShareProject();
          const url = buildShareUrl(payload);
          if (url.length > TIER_SHARE_SAFE_URL_LENGTH) {
            setShareDialogState({
              message: "Esta tier usa imagens enviadas do aparelho e ficou grande demais para um link confiável. Use Baixar JSON ou substitua essas imagens por itens da biblioteca do site.",
              error: true
            });
            return;
          }
          setShareDialogState({ url, message: "Link pronto. Quem abrir poderá editar uma cópia da tier." });
        } catch (error) {
          console.error("Falha ao criar link compartilhável", error);
          setShareDialogState({ message: error.message || "Não foi possível criar o link.", error: true });
        } finally {
          if (button) button.disabled = false;
        }
      }

      async function copyShareProjectLink() {
        const input = document.getElementById("shareProjectUrl");
        if (!input?.value) return;
        try {
          await navigator.clipboard.writeText(input.value);
          showToast("Link copiado.");
        } catch (error) {
          input.focus();
          input.select();
          const copied = document.execCommand("copy");
          showToast(copied ? "Link copiado." : "Selecione e copie o link.");
        }
      }

      async function nativeShareProjectLink() {
        const url = document.getElementById("shareProjectUrl")?.value;
        if (!url || typeof navigator.share !== "function") return;
        try {
          await navigator.share({ title: state.caption || "Tier Constructor", text: "Abra esta tier e continue editando:", url });
        } catch (error) {
          if (error?.name !== "AbortError") showToast("Não foi possível compartilhar agora.");
        }
      }

      async function loadSharedProjectFromLocation() {
        const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
        if (!hash) return false;
        const params = new URLSearchParams(hash);
        const payload = params.get(TIER_SHARE_HASH_KEY);
        if (!payload) return false;
        try {
          const project = await decodeShareProject(payload);
          const loaded = await hydrateSharedProject(project);
          isRestoringHistory = true;
          state.rows = loaded.rows;
          state.images = loaded.images && typeof loaded.images === "object" ? loaded.images : {};
          state.bank = Array.isArray(loaded.bank) ? loaded.bank : [];
          state.archived = Array.isArray(loaded.archived) ? loaded.archived : [];
          state.caption = loaded.caption || "";
          state.captionImage = loaded.captionImage || "";
          state.background = loaded.background || "";
          state.settings = { ...DEFAULT_SETTINGS, ...(loaded.settings || {}) };
          normalizeStateImages();
          currentBrowserProjectName = "";
          localStorage.removeItem(CURRENT_PROJECT_KEY);
          els.captionInput.value = state.caption;
          render();
          isRestoringHistory = false;
          historyStack = [];
          historyIndex = -1;
          pushHistory(true);
          saveAutosave();
          history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          showToast("Tier compartilhada carregada.");
          const schedule = window.requestIdleCallback || (callback => setTimeout(callback, 80));
          schedule(() => rebuildSharedImagePreviews());
          return true;
        } catch (error) {
          console.error("Falha ao abrir tier compartilhada", error);
          history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          showToast(error.message || "Link compartilhado inválido.");
          return false;
        } finally {
          isRestoringHistory = false;
        }
      }

      function legacyValue(source, keys, fallback = undefined) {
        for (const key of keys) {
          if (source && source[key] !== undefined && source[key] !== null) return source[key];
        }
        return fallback;
      }

      function normalizeLegacyProject(project) {
        const loaded = project?.state || project?.data || project?.project || project;
        if (!loaded || typeof loaded !== "object") {
          throw new Error("O arquivo não contém um projeto válido.");
        }

        const normalizedImages = {};
        const rawImages = legacyValue(loaded, ["images", "imageMap", "items", "logos"], {});

        const registerImage = (raw, preferredId = null, index = 0) => {
          if (!raw) return null;

          if (typeof raw === "string") {
            const id = preferredId || crypto.randomUUID();
            normalizedImages[id] = normalizeImageData({
              id,
              name: `Imagem ${index + 1}`,
              src: raw,
              originalSrc: raw,
              previewSrc: raw
            });
            return id;
          }

          if (typeof raw !== "object") return null;
          const id = String(raw.id || raw.imageId || raw.key || preferredId || crypto.randomUUID());
          const src = legacyValue(raw, ["originalSrc", "src", "dataUrl", "url", "image", "previewSrc"], "");
          if (!src) return null;

          normalizedImages[id] = normalizeImageData({
            ...raw,
            id,
            name: legacyValue(raw, ["name", "fileName", "filename", "title"], `Imagem ${index + 1}`),
            src,
            originalSrc: raw.originalSrc || src,
            previewSrc: raw.previewSrc || raw.src || src
          });
          return id;
        };

        if (Array.isArray(rawImages)) {
          rawImages.forEach((image, index) => registerImage(image, null, index));
        } else if (rawImages && typeof rawImages === "object") {
          Object.entries(rawImages).forEach(([id, image], index) => registerImage(image, id, index));
        }

        const normalizeImageReference = (reference, index = 0) => {
          if (reference === null || reference === undefined) return null;
          if (typeof reference === "object") return registerImage(reference, null, index);

          const id = String(reference);
          if (normalizedImages[id]) return id;

          if (typeof reference === "string" && (reference.startsWith("data:image/") || reference.startsWith("blob:") || reference.startsWith("http"))) {
            return registerImage(reference, null, index);
          }
          return null;
        };

        const rawRows = legacyValue(loaded, ["rows", "tiers", "categories", "rankingRows"], []);
        if (!Array.isArray(rawRows) || !rawRows.length) {
          throw new Error("O projeto antigo não possui rows reconhecíveis.");
        }

        const normalizedRows = rawRows.map((row, rowIndex) => {
          const rawReferences = legacyValue(row, ["images", "items", "imageIds", "logos", "cards"], []);
          const references = Array.isArray(rawReferences) ? rawReferences : [];
          return {
            id: String(legacyValue(row, ["id", "rowId", "key"], crypto.randomUUID())),
            name: String(legacyValue(row, ["name", "label", "title", "text"], `Row ${rowIndex + 1}`)),
            color: String(legacyValue(row, ["color", "background", "backgroundColor", "bg"], TIER_PRESET_COLORS[rowIndex % TIER_PRESET_COLORS.length])),
            images: references.map((reference, index) => normalizeImageReference(reference, index)).filter(Boolean)
          };
        });

        const usedIds = new Set(normalizedRows.flatMap(row => row.images));
        const rawBank = legacyValue(loaded, ["bank", "unranked", "unclassified", "pool", "remainingImages", "unused"], null);
        let normalizedBank;

        if (Array.isArray(rawBank)) {
          normalizedBank = rawBank.map((reference, index) => normalizeImageReference(reference, index)).filter(Boolean);
        } else {
          normalizedBank = Object.keys(normalizedImages).filter(id => !usedIds.has(id));
        }

        const rawArchived = legacyValue(loaded, ["archived", "hidden", "trash", "deletedLogos"], []);
        const normalizedArchived = Array.isArray(rawArchived)
          ? [...new Set(rawArchived.map((reference, index) => normalizeImageReference(reference, index)).filter(Boolean))]
          : [];

        const validIds = new Set(Object.keys(normalizedImages));
        normalizedRows.forEach(row => {
          row.images = [...new Set(row.images.filter(id => validIds.has(id) && !normalizedArchived.includes(id)))];
        });
        normalizedBank = [...new Set(normalizedBank.filter(id => validIds.has(id) && !usedIds.has(id) && !normalizedArchived.includes(id)))];

        const legacySettings = legacyValue(loaded, ["settings", "config", "options"], {});
        const migratedSettings = {
          ...DEFAULT_SETTINGS,
          ...(legacySettings || {})
        };

        const settingAliases = {
          labelWidth: ["rowColumnWidth", "tierLabelWidth"],
          boardWidth: ["tierWidth", "totalWidth"],
          imageSize: ["tileSize", "logoSize"],
          gap: ["imageGap", "spacing"],
          rowMinHeight: ["rowHeight", "minimumRowHeight"],
          captionFontSize: ["titleFontSize", "legendFontSize"],
          rowFontSize: ["labelFontSize", "tierFontSize"],
          separatorWidth: ["lineWidth", "borderWidth"],
          separatorColor: ["lineColor", "borderColor"]
        };

        for (const [currentKey, aliases] of Object.entries(settingAliases)) {
          if (legacySettings?.[currentKey] === undefined) {
            const oldValue = legacyValue(legacySettings, aliases, undefined);
            if (oldValue !== undefined) migratedSettings[currentKey] = oldValue;
          }
        }

        return {
          rows: normalizedRows,
          images: normalizedImages,
          bank: normalizedBank,
          archived: normalizedArchived,
          caption: String(legacyValue(loaded, ["caption", "legend", "title", "heading"], "")),
          captionImage: legacyValue(loaded, ["captionImage", "legendImage", "titleImage"], "") || "",
          background: legacyValue(loaded, ["background", "boardBackground", "backgroundImage"], "") || "",
          settings: migratedSettings
        };
      }

      async function loadProject(file) {
        const previousSnapshot = snapshotState();
        try {
          const text = (await file.text()).replace(/^\uFEFF/, "").trim();
          if (!text) throw new Error("O arquivo está vazio.");

          const project = JSON.parse(text);
          const loaded = normalizeLegacyProject(project);

          if (!Array.isArray(loaded.rows) || !loaded.rows.length) {
            throw new Error("Nenhuma row válida foi encontrada no projeto.");
          }

          isRestoringHistory = true;
          state.rows = loaded.rows;
          state.images = loaded.images && typeof loaded.images === "object" ? loaded.images : {};
          state.bank = Array.isArray(loaded.bank) ? loaded.bank : [];
          state.archived = Array.isArray(loaded.archived) ? loaded.archived : [];
          state.caption = loaded.caption || "";
          state.captionImage = loaded.captionImage || "";
          state.background = loaded.background || "";
          state.settings = { ...DEFAULT_SETTINGS, ...(loaded.settings || {}) };
          normalizeStateImages();

          els.captionInput.value = state.caption;
          render();
          isRestoringHistory = false;
          historyStack = [];
          historyIndex = -1;
          pushHistory(true);
          saveAutosave();
          showToast("Projeto carregado com sucesso.");
        } catch (error) {
          console.error("Erro ao importar projeto:", error);
          try {
            isRestoringHistory = true;
            state.rows = previousSnapshot.rows;
            state.images = previousSnapshot.images;
            state.bank = previousSnapshot.bank || [];
            state.archived = previousSnapshot.archived || [];
            state.caption = previousSnapshot.caption || "";
            state.captionImage = previousSnapshot.captionImage || "";
            state.background = previousSnapshot.background || "";
            state.settings = { ...DEFAULT_SETTINGS, ...(previousSnapshot.settings || {}) };
            normalizeStateImages();
            els.captionInput.value = state.caption;
            render();
          } catch (restoreError) {
            console.error("Falha ao restaurar o projeto anterior:", restoreError);
          } finally {
            isRestoringHistory = false;
          }
          showToast(`Não foi possível abrir: ${error.message || "formato incompatível"}`);
        }
      }

      function updateSettingsControls() {
        const map = [
          ["labelWidth", "labelWidthRange", "labelWidthNumber"],
          ["boardWidth", "boardWidthRange", "boardWidthNumber"],
          ["imageSize", "imageSizeRange", "imageSizeNumber"],
          ["gap", "gapRange", "gapNumber"],
          ["rowMinHeight", "rowHeightRange", "rowHeightNumber"],
          ["overlay", "overlayRange", "overlayNumber"],
          ["separatorWidth", "separatorWidthRange", "separatorWidthNumber"],
          ["backgroundZoom", "backgroundZoomRange", "backgroundZoomNumber"],
          ["backgroundPosX", "backgroundPosXRange", "backgroundPosXNumber"],
          ["backgroundPosY", "backgroundPosYRange", "backgroundPosYNumber"],
          ["captionFontSize", "captionFontSizeRange", "captionFontSizeNumber"],
          ["captionBgOpacity", "captionBgOpacityRange", "captionBgOpacityNumber"],
          ["captionImageSize", "captionImageSizeRange", "captionImageSizeNumber"],
          ["rowFontSize", "rowFontSizeRange", "rowFontSizeNumber"],
          ["positionFontSize", "positionFontSizeRange", "positionFontSizeNumber"],
          ["positionTextStroke", "positionTextStrokeRange", "positionTextStrokeNumber"],
          ["positionShadowSize", "positionShadowSizeRange", "positionShadowSizeNumber"],
          ["rowPaddingX", "rowPaddingXRange", "rowPaddingXNumber"],
          ["rowPaddingY", "rowPaddingYRange", "rowPaddingYNumber"]
        ];

        map.forEach(([key, rangeId, numberId]) => {
          const range = document.getElementById(rangeId);
          const number = document.getElementById(numberId);
          const value = state.settings[key];
          if (range && value !== undefined && value !== null) range.value = value;
          if (number && value !== undefined && value !== null) number.value = value;
        });

        const setControlValue = (id, value) => {
          const control = document.getElementById(id);
          if (control && value !== undefined && value !== null) control.value = value;
        };

        setControlValue("backgroundFit", state.settings.backgroundFit);
        setControlValue("captionFontFamily", state.settings.captionFontFamily);
        setControlValue("rowFontFamily", state.settings.rowFontFamily);
        setControlValue("positionFontFamily", state.settings.positionFontFamily);
        setControlValue("captionColorInput", state.settings.captionColor);
        setControlValue("captionBgColorInput", state.settings.captionBgColor);
        setControlValue("captionImagePosition", state.settings.captionImagePosition);
        setControlValue("separatorColorInput", state.settings.separatorColor);
        setControlValue("backgroundColorInput", state.settings.backgroundColor);
        setControlValue("positionTextColorInput", state.settings.positionTextColor);
        setControlValue("positionBgColorInput", state.settings.positionBgColor);
        setControlValue("positionTextStrokeColorInput", state.settings.positionTextStrokeColor);
        setControlValue("positionShadowColorInput", state.settings.positionShadowColor);
      }

      function bindRangePair(rangeId, numberId, key) {
        const range = document.getElementById(rangeId);
        const number = document.getElementById(numberId);
        if (!range || !number) {
          console.warn(`Controle ausente ignorado: ${rangeId} / ${numberId}`);
          return;
        }
        const min = Number(range.min);
        const max = Number(range.max);

        const setValue = (raw) => {
          let value = Number(raw);
          if (!Number.isFinite(value)) value = state.settings[key];
          value = Math.max(min, Math.min(max, value));
          state.settings[key] = value;
          range.value = value;
          number.value = value;
          applySettings();
          if (key === "rowMinHeight") {
            render();
            renderRowManager();
          } else if (key.startsWith("position")) {
            render();
          }
          scheduleHistoryPush();
        };

        range.addEventListener("input", () => setValue(range.value));
        number.addEventListener("input", () => {
          if (number.value === "") return;
          setValue(number.value);
        });
        number.addEventListener("blur", () => setValue(number.value || state.settings[key]));
      }

      function clearAllTierImages() {
        const returning = state.rows.flatMap(row => row.images);
        if (!returning.length) {
          showToast("Não há imagens nas tiers para tirar.");
          return;
        }
        state.rows.forEach(row => {
          row.images = [];
        });
        state.bank = [...new Set([...state.bank, ...returning])].filter(id => state.images[id] && !state.archived.includes(id));
        clearTouchSelection();
        render();
        pushHistory();
        showToast(`${returning.length} ${returning.length === 1 ? "imagem voltou" : "imagens voltaram"} para a parte de baixo.`);
      }

      async function setBackground(file) {
        if (!file?.type.startsWith("image/")) return;
        state.background = await readFileAsDataURL(file);
        applySettings();
        scheduleHistoryPush();
        showToast("Fundo aplicado.");
      }

      function loadImage(src) {
        return new Promise((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = src;
        });
      }


      function openProjectDatabase() {
        return new Promise((resolve, reject) => {
          if (!window.indexedDB) {
            reject(new Error("IndexedDB não está disponível neste navegador."));
            return;
          }
          const request = indexedDB.open(PROJECT_DB_NAME, 1);
          request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(PROJECT_STORE_NAME)) {
              db.createObjectStore(PROJECT_STORE_NAME, { keyPath: "name" });
            }
          };
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("Não foi possível abrir o banco de projetos."));
        });
      }

      async function putBrowserProject(name, snapshot, silent = false) {
        const db = await openProjectDatabase();
        await new Promise((resolve, reject) => {
          const transaction = db.transaction(PROJECT_STORE_NAME, "readwrite");
          transaction.objectStore(PROJECT_STORE_NAME).put({
            name,
            snapshot,
            updatedAt: new Date().toISOString()
          });
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error || new Error("Falha ao salvar no navegador."));
          transaction.onabort = () => reject(transaction.error || new Error("Salvamento cancelado."));
        });
        db.close();
        if (!silent) showToast(`Projeto “${name}” salvo no navegador.`);
      }

      async function getBrowserProject(name) {
        const db = await openProjectDatabase();
        const result = await new Promise((resolve, reject) => {
          const transaction = db.transaction(PROJECT_STORE_NAME, "readonly");
          const request = transaction.objectStore(PROJECT_STORE_NAME).get(name);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error || new Error("Não foi possível ler o projeto."));
        });
        db.close();
        return result;
      }

      async function getAllBrowserProjects() {
        const db = await openProjectDatabase();
        const result = await new Promise((resolve, reject) => {
          const transaction = db.transaction(PROJECT_STORE_NAME, "readonly");
          const request = transaction.objectStore(PROJECT_STORE_NAME).getAll();
          request.onsuccess = () => resolve(request.result || []);
          request.onerror = () => reject(request.error || new Error("Não foi possível listar os projetos."));
        });
        db.close();
        return result
          .filter(item => item.name !== BROWSER_AUTOSAVE_NAME)
          .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      }

      async function deleteBrowserProject(name) {
        const db = await openProjectDatabase();
        await new Promise((resolve, reject) => {
          const transaction = db.transaction(PROJECT_STORE_NAME, "readwrite");
          transaction.objectStore(PROJECT_STORE_NAME).delete(name);
          transaction.oncomplete = resolve;
          transaction.onerror = () => reject(transaction.error || new Error("Não foi possível excluir o projeto."));
        });
        db.close();
        if (currentBrowserProjectName === name) {
          currentBrowserProjectName = "";
          localStorage.removeItem(CURRENT_PROJECT_KEY);
        }
        await renderBrowserProjectsList();
        showToast(`Projeto “${name}” excluído.`);
      }

      async function saveCurrentProjectInBrowser(name = "", silent = false) {
        const input = document.getElementById("browserProjectNameInput");
        const resolvedName = String(name || input?.value || currentBrowserProjectName || "").trim();
        if (!resolvedName) {
          openBrowserProjectsDialog();
          input?.focus();
          showToast("Digite um nome para salvar o projeto.");
          return false;
        }
        await putBrowserProject(resolvedName, snapshotState(), silent);
        currentBrowserProjectName = resolvedName;
        localStorage.setItem(CURRENT_PROJECT_KEY, resolvedName);
        if (input) input.value = resolvedName;
        if (els.browserProjectsDialog.open) await renderBrowserProjectsList();
        return true;
      }

      function scheduleNamedProjectAutosave() {
        if (!currentBrowserProjectName) return;
        clearTimeout(namedProjectSaveTimer);
        namedProjectSaveTimer = setTimeout(() => {
          saveCurrentProjectInBrowser(currentBrowserProjectName, true).catch(error => {
            console.warn("Autosave do projeto nomeado falhou", error);
          });
        }, 650);
      }

      async function loadBrowserProjectByName(name) {
        const record = await getBrowserProject(name);
        if (!record?.snapshot) throw new Error("Projeto salvo não encontrado.");
        historyStack = [];
        historyIndex = -1;
        restoreSnapshot(JSON.parse(JSON.stringify(record.snapshot)));
        currentBrowserProjectName = name;
        localStorage.setItem(CURRENT_PROJECT_KEY, name);
        document.getElementById("browserProjectNameInput").value = name;
        pushHistory(true);
        if (els.browserProjectsDialog.open) els.browserProjectsDialog.close();
        showToast(`Projeto “${name}” aberto.`);
      }

      async function renderBrowserProjectsList() {
        const list = document.getElementById("browserProjectsList");
        if (!list) return;
        list.replaceChildren();
        try {
          const projects = await getAllBrowserProjects();
          if (!projects.length) {
            const empty = document.createElement("div");
            empty.className = "empty-hint";
            empty.textContent = "Nenhum projeto salvo no navegador.";
            list.appendChild(empty);
            return;
          }
          projects.forEach(project => {
            const row = document.createElement("div");
            row.className = "browser-project-row";
            const meta = document.createElement("div");
            meta.className = "browser-project-meta";
            const title = document.createElement("strong");
            title.textContent = project.name;
            const time = document.createElement("small");
            const date = project.updatedAt ? new Date(project.updatedAt) : null;
            time.textContent = date && !Number.isNaN(date.getTime())
              ? `Atualizado em ${date.toLocaleString("pt-BR")}`
              : "Data não disponível";
            meta.append(title, time);
            const actions = document.createElement("div");
            actions.className = "browser-project-actions";
            const open = document.createElement("button");
            open.type = "button";
            open.textContent = "Abrir";
            open.addEventListener("click", () => loadBrowserProjectByName(project.name).catch(error => showToast(error.message)));
            const overwrite = document.createElement("button");
            overwrite.type = "button";
            overwrite.textContent = "Sobrescrever";
            overwrite.addEventListener("click", () => saveCurrentProjectInBrowser(project.name).catch(error => showToast(error.message)));
            const remove = document.createElement("button");
            remove.type = "button";
            remove.className = "danger";
            remove.textContent = "Excluir";
            remove.addEventListener("click", () => {
              if (confirm(`Excluir o projeto “${project.name}”?`)) {
                deleteBrowserProject(project.name).catch(error => showToast(error.message));
              }
            });
            actions.append(open, overwrite, remove);
            row.append(meta, actions);
            list.appendChild(row);
          });
        } catch (error) {
          const failed = document.createElement("div");
          failed.className = "empty-hint";
          failed.textContent = `Não foi possível acessar os projetos: ${error.message}`;
          list.appendChild(failed);
        }
      }

      function openBrowserProjectsDialog() {
        const input = document.getElementById("browserProjectNameInput");
        input.value = currentBrowserProjectName || input.value || "";
        renderBrowserProjectsList();
        if (!els.browserProjectsDialog.open) els.browserProjectsDialog.showModal();
      }


      function closeProjectMenu() {
        const menu = document.getElementById("projectMenu");
        if (menu) menu.open = false;
      }

      function startNewProject() {
        if (!confirm("Começar um projeto novo? O projeto atual continuará salvo somente se você já o salvou no navegador ou baixou o JSON.")) return;
        state.rows = DEFAULT_ROWS.map(row => ({
          ...row,
          id: crypto.randomUUID(),
          images: [],
          height: DEFAULT_SETTINGS.rowMinHeight
        }));
        state.images = {};
        state.bank = [];
        state.archived = [];
        state.caption = "";
        state.captionImage = "";
        state.background = "";
        state.settings = { ...DEFAULT_SETTINGS };
        touchSelectedImageId = null;
        currentBrowserProjectName = "";
        localStorage.removeItem(CURRENT_PROJECT_KEY);
        els.captionInput.value = "";
        historyStack = [];
        historyIndex = -1;
        render();
        pushHistory(true);
        showToast("Novo projeto iniciado.");
      }

      function snapshotState() {
        return JSON.parse(JSON.stringify({
          rows: state.rows,
          images: state.images,
          bank: state.bank,
          archived: state.archived,
          caption: state.caption,
          captionImage: state.captionImage,
          background: state.background,
          settings: state.settings
        }));
      }

      function restoreSnapshot(snapshot) {
        isRestoringHistory = true;
        state.rows = snapshot.rows;
        state.images = snapshot.images;
        state.bank = snapshot.bank || [];
        state.archived = snapshot.archived || [];
        state.caption = snapshot.caption || "";
        state.captionImage = snapshot.captionImage || "";
        state.background = snapshot.background || "";
        state.settings = { ...DEFAULT_SETTINGS, ...(snapshot.settings || {}) };
        touchSelectedImageId = null;
        normalizeStateImages();
        els.captionInput.value = state.caption;
        render();
        isRestoringHistory = false;
        updateHistoryButtons();
        saveAutosave();
        scheduleNamedProjectAutosave();
      }


      function saveAutosave() {
        const snapshot = snapshotState();
        try {
          localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(snapshot));
        } catch (error) {
          if (!autosaveWarned) {
            autosaveWarned = true;
            console.warn("Autosave local indisponível", error);
          }
        }
        putBrowserProject(BROWSER_AUTOSAVE_NAME, snapshot, true).catch(error => {
          if (!autosaveWarned) {
            autosaveWarned = true;
            console.warn("Autosave no navegador indisponível", error);
          }
        });
      }

      function loadAutosave() {
        try {
          const raw = localStorage.getItem(AUTOSAVE_KEY);
          if (!raw) return false;
          const snapshot = JSON.parse(raw);
          restoreSnapshot(snapshot);
          return true;
        } catch (error) {
          console.warn("Autosave inválido", error);
          return false;
        }
      }

      function pushHistory(force = false) {
        if (isRestoringHistory) return;
        const snapshot = snapshotState();
        const serialized = JSON.stringify(snapshot);
        if (!force && historyIndex >= 0 && historyStack[historyIndex]?.serialized === serialized) {
          updateHistoryButtons();
          return;
        }
        historyStack = historyStack.slice(0, historyIndex + 1);
        historyStack.push({ snapshot, serialized });
        if (historyStack.length > HISTORY_LIMIT) historyStack.shift();
        historyIndex = historyStack.length - 1;
        updateHistoryButtons();
        saveAutosave();
      }

      function scheduleHistoryPush() {
        if (isRestoringHistory) return;
        clearTimeout(historyTimer);
        historyTimer = setTimeout(() => pushHistory(), 350);
      }

      function undoHistory() {
        if (historyIndex <= 0) return;
        historyIndex -= 1;
        restoreSnapshot(JSON.parse(JSON.stringify(historyStack[historyIndex].snapshot)));
        showToast("Desfeito.");
      }

      function redoHistory() {
        if (historyIndex >= historyStack.length - 1) return;
        historyIndex += 1;
        restoreSnapshot(JSON.parse(JSON.stringify(historyStack[historyIndex].snapshot)));
        showToast("Refeito.");
      }

      function updateHistoryButtons() {
        if (els.undoBtn) els.undoBtn.disabled = historyIndex <= 0;
        if (els.redoBtn) els.redoBtn.disabled = historyIndex >= historyStack.length - 1 || historyIndex < 0;
      }

      function hexToRgba(hex, alpha = 1) {
        const normalized = String(hex || "#000000").replace("#", "");
        const full = normalized.length === 3 ? normalized.split("").map(char => char + char).join("") : normalized.padEnd(6, "0").slice(0, 6);
        const int = parseInt(full, 16);
        const r = (int >> 16) & 255;
        const g = (int >> 8) & 255;
        const b = int & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      }

      function drawPositionedImage(ctx, img, x, y, width, height, fit = "contain", scalePercent = 100, offsetXPercent = 0, offsetYPercent = 0) {
        const baseScale = fit === "cover"
          ? Math.max(width / img.width, height / img.height)
          : Math.min(width / img.width, height / img.height);
        const scale = baseScale * (scalePercent / 100);
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const drawX = x + (width - drawW) / 2 + (offsetXPercent / 100) * width;
        const drawY = y + (height - drawH) / 2 + (offsetYPercent / 100) * height;
        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }

      const tintedCache = new Map();

      async function getTintedSilhouette(src, color) {
        const key = `${src}::${color}`;
        if (tintedCache.has(key)) return tintedCache.get(key);
        const img = await loadImage(src);
        const off = document.createElement("canvas");
        off.width = img.width;
        off.height = img.height;
        const ictx = off.getContext("2d");
        ictx.drawImage(img, 0, 0);
        ictx.globalCompositeOperation = "source-in";
        ictx.fillStyle = color;
        ictx.fillRect(0, 0, off.width, off.height);
        tintedCache.set(key, off);
        return off;
      }

      async function drawMainStyledImage(ctx, src, x, y, width, height, edit) {
        const img = await loadImage(src);
        const baseScale = Math.min(width / img.width, height / img.height) * (edit.mainScale / 100);
        const drawW = img.width * baseScale;
        const drawH = img.height * baseScale;
        const drawX = x + (width - drawW) / 2 + (edit.mainOffsetX / 100) * width;
        const drawY = y + (height - drawH) / 2 + (edit.mainOffsetY / 100) * height;

        if ((edit.outlineSize || 0) > 0) {
          const silhouette = await getTintedSilhouette(src, edit.outlineColor || "#ffffff");
          const steps = Math.max(8, (edit.outlineSize || 0) * 4);
          for (let i = 0; i < steps; i++) {
            const angle = (Math.PI * 2 * i) / steps;
            const ox = Math.cos(angle) * edit.outlineSize;
            const oy = Math.sin(angle) * edit.outlineSize;
            ctx.drawImage(silhouette, drawX + ox, drawY + oy, drawW, drawH);
          }
        }

        if ((edit.shadowSize || 0) > 0) {
          ctx.save();
          ctx.shadowColor = edit.shadowColor || "#000000";
          ctx.shadowBlur = edit.shadowSize;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
          ctx.drawImage(img, drawX, drawY, drawW, drawH);
          ctx.restore();
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
      }

      async function renderImageComposition(imageData, editOverride = null, size = 512) {
        const edit = { ...defaultImageEdit(), ...(imageData.edit || {}), ...(editOverride || {}) };
        const canvas = document.createElement("canvas");
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, size, size);

        if (edit.bgMode === "color") {
          ctx.fillStyle = edit.bgColor || "#101217";
          ctx.fillRect(0, 0, size, size);
        } else if (edit.bgMode === "image" && edit.bgImageSrc) {
          try {
            const bgImage = await loadImage(edit.bgImageSrc);
            ctx.save();
            ctx.globalAlpha = (edit.bgOpacity ?? 100) / 100;
            drawImageCover(ctx, bgImage, 0, 0, size, size, edit.bgFit || "cover", edit.bgZoom || 100, edit.bgPosX ?? 50, edit.bgPosY ?? 50);
            ctx.restore();
          } catch (error) {
            console.warn("Fundo da edição ignorado", error);
          }
        }

        await drawMainStyledImage(ctx, imageData.originalSrc || imageData.src, 0, 0, size, size, edit);

        if (edit.bannerEnabled && edit.bannerHeight > 0) {
          ctx.fillStyle = hexToRgba(edit.bannerColor, (edit.bannerOpacity ?? 100) / 100);
          ctx.fillRect(0, size - edit.bannerHeight, size, edit.bannerHeight);
        }

        if ((edit.text || "").trim()) {
          ctx.save();
          const textX = (edit.textX / 100) * size;
          const textY = (edit.textY / 100) * size;
          ctx.font = `900 ${edit.textSize}px Inter, Arial, sans-serif`;
          ctx.textAlign = edit.textAlign || "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = edit.textColor || "#ffffff";
          if (edit.textShadow) {
            ctx.shadowColor = "rgba(0,0,0,.75)";
            ctx.shadowBlur = 8;
            ctx.shadowOffsetY = 2;
          }
          const maxWidth = size * 0.86;
          const lines = wrapCanvasText(ctx, edit.text, maxWidth);
          const lineHeight = Math.max(18, Math.round(edit.textSize * 1.1));
          const startY = textY - ((lines.length - 1) * lineHeight) / 2;
          lines.forEach((line, index) => {
            const drawY = startY + index * lineHeight;
            if (edit.textStroke > 0) {
              ctx.lineWidth = edit.textStroke * 2;
              ctx.strokeStyle = edit.textStrokeColor || "#000000";
              ctx.strokeText(line, textX, drawY, maxWidth);
            }
            ctx.fillText(line, textX, drawY, maxWidth);
          });
          ctx.restore();
        }

        if (edit.pipEnabled && edit.pipSrc) {
          try {
            const pipImage = await loadImage(edit.pipSrc);
            const pipSize = (edit.pipSize / 100) * size;
            const pipX = (edit.pipX / 100) * size;
            const pipY = (edit.pipY / 100) * size;
            ctx.save();
            ctx.beginPath();
            const radius = Math.min(18, pipSize / 7);
            ctx.roundRect(pipX, pipY, pipSize, pipSize, radius);
            ctx.clip();
            drawImageCover(ctx, pipImage, pipX, pipY, pipSize, pipSize, "cover", 100, 50, 50);
            ctx.restore();
            ctx.strokeStyle = "rgba(255,255,255,.6)";
            ctx.strokeRect(pipX + .5, pipY + .5, pipSize - 1, pipSize - 1);
          } catch (error) {
            console.warn("PiP ignorado", error);
          }
        }

        return canvas;
      }

      function getEditorEls() {
        return {
          canvas: document.getElementById("editorCanvas"),
          mainScaleRange: document.getElementById("editorMainScaleRange"),
          mainScaleNumber: document.getElementById("editorMainScaleNumber"),
          mainOffsetXRange: document.getElementById("editorMainOffsetXRange"),
          mainOffsetXNumber: document.getElementById("editorMainOffsetXNumber"),
          mainOffsetYRange: document.getElementById("editorMainOffsetYRange"),
          mainOffsetYNumber: document.getElementById("editorMainOffsetYNumber"),
          outlineSizeRange: document.getElementById("editorOutlineSizeRange"),
          outlineSizeNumber: document.getElementById("editorOutlineSizeNumber"),
          outlineColor: document.getElementById("editorOutlineColor"),
          shadowSizeRange: document.getElementById("editorShadowSizeRange"),
          shadowSizeNumber: document.getElementById("editorShadowSizeNumber"),
          shadowColor: document.getElementById("editorShadowColor"),
          bgMode: document.getElementById("editorBgMode"),
          bgColor: document.getElementById("editorBgColor"),
          bgFit: document.getElementById("editorBgFit"),
          bgOpacityRange: document.getElementById("editorBgOpacityRange"),
          bgOpacityNumber: document.getElementById("editorBgOpacityNumber"),
          bgZoomRange: document.getElementById("editorBgZoomRange"),
          bgZoomNumber: document.getElementById("editorBgZoomNumber"),
          bgPosXRange: document.getElementById("editorBgPosXRange"),
          bgPosXNumber: document.getElementById("editorBgPosXNumber"),
          bgPosYRange: document.getElementById("editorBgPosYRange"),
          bgPosYNumber: document.getElementById("editorBgPosYNumber"),
          bannerHeightRange: document.getElementById("editorBannerHeightRange"),
          bannerHeightNumber: document.getElementById("editorBannerHeightNumber"),
          bannerColor: document.getElementById("editorBannerColor"),
          bannerOpacityRange: document.getElementById("editorBannerOpacityRange"),
          bannerOpacityNumber: document.getElementById("editorBannerOpacityNumber"),
          text: document.getElementById("editorText"),
          textSizeRange: document.getElementById("editorTextSizeRange"),
          textSizeNumber: document.getElementById("editorTextSizeNumber"),
          textColor: document.getElementById("editorTextColor"),
          textXRange: document.getElementById("editorTextXRange"),
          textXNumber: document.getElementById("editorTextXNumber"),
          textYRange: document.getElementById("editorTextYRange"),
          textYNumber: document.getElementById("editorTextYNumber"),
          textStrokeRange: document.getElementById("editorTextStrokeRange"),
          textStrokeNumber: document.getElementById("editorTextStrokeNumber"),
          textStrokeColor: document.getElementById("editorTextStrokeColor"),
          pipSizeRange: document.getElementById("editorPipSizeRange"),
          pipSizeNumber: document.getElementById("editorPipSizeNumber"),
          pipXRange: document.getElementById("editorPipXRange"),
          pipXNumber: document.getElementById("editorPipXNumber"),
          pipYRange: document.getElementById("editorPipYRange"),
          pipYNumber: document.getElementById("editorPipYNumber")
        };
      }

      function syncEditorPair(rangeEl, numberEl, key) {
        const value = editorDraft[key];
        if (rangeEl) rangeEl.value = value;
        if (numberEl) numberEl.value = value;
      }

      function updateEditorControls() {
        if (!editorDraft) return;
        const e = getEditorEls();
        syncEditorPair(e.mainScaleRange, e.mainScaleNumber, "mainScale");
        syncEditorPair(e.mainOffsetXRange, e.mainOffsetXNumber, "mainOffsetX");
        syncEditorPair(e.mainOffsetYRange, e.mainOffsetYNumber, "mainOffsetY");
        syncEditorPair(e.outlineSizeRange, e.outlineSizeNumber, "outlineSize");
        if (e.outlineColor) e.outlineColor.value = editorDraft.outlineColor;
        syncEditorPair(e.shadowSizeRange, e.shadowSizeNumber, "shadowSize");
        if (e.shadowColor) e.shadowColor.value = editorDraft.shadowColor;
        if (e.bgMode) e.bgMode.value = editorDraft.bgMode;
        if (e.bgColor) e.bgColor.value = editorDraft.bgColor;
        if (e.bgFit) e.bgFit.value = editorDraft.bgFit;
        syncEditorPair(e.bgOpacityRange, e.bgOpacityNumber, "bgOpacity");
        syncEditorPair(e.bgZoomRange, e.bgZoomNumber, "bgZoom");
        syncEditorPair(e.bgPosXRange, e.bgPosXNumber, "bgPosX");
        syncEditorPair(e.bgPosYRange, e.bgPosYNumber, "bgPosY");
        syncEditorPair(e.bannerHeightRange, e.bannerHeightNumber, "bannerHeight");
        if (e.bannerColor) e.bannerColor.value = editorDraft.bannerColor;
        syncEditorPair(e.bannerOpacityRange, e.bannerOpacityNumber, "bannerOpacity");
        if (e.text) e.text.value = editorDraft.text;
        syncEditorPair(e.textSizeRange, e.textSizeNumber, "textSize");
        if (e.textColor) e.textColor.value = editorDraft.textColor;
        syncEditorPair(e.textXRange, e.textXNumber, "textX");
        syncEditorPair(e.textYRange, e.textYNumber, "textY");
        syncEditorPair(e.textStrokeRange, e.textStrokeNumber, "textStroke");
        if (e.textStrokeColor) e.textStrokeColor.value = editorDraft.textStrokeColor;
        syncEditorPair(e.pipSizeRange, e.pipSizeNumber, "pipSize");
        syncEditorPair(e.pipXRange, e.pipXNumber, "pipX");
        syncEditorPair(e.pipYRange, e.pipYNumber, "pipY");
        updateChoiceButtons("editorBannerEnabledButtons", String(editorDraft.bannerEnabled));
        updateChoiceButtons("editorTextAlignButtons", String(editorDraft.textAlign));
        updateChoiceButtons("editorTextShadowButtons", String(editorDraft.textShadow));
        updateChoiceButtons("editorPipEnabledButtons", String(editorDraft.pipEnabled));
      }

      async function refreshEditorPreview() {
        if (!currentEditorImageId || !editorDraft) return;
        const imageData = state.images[currentEditorImageId];
        if (!imageData) return;
        const canvas = await renderImageComposition(imageData, editorDraft, 512);
        const target = document.getElementById("editorCanvas");
        const ctx = target.getContext("2d");
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(canvas, 0, 0);
        const previewSrc = canvas.toDataURL("image/png");
        imageData.previewSrc = previewSrc;
        syncEditedImageCard(currentEditorImageId, previewSrc);
      }

      function changeEditorValue(key, value) {
        if (!editorDraft) return;
        editorDraft[key] = value;
        refreshEditorPreview();
      }

      function bindEditorRangePair(rangeId, numberId, key, parser = Number) {
        const range = document.getElementById(rangeId);
        const number = document.getElementById(numberId);
        const apply = value => {
          const parsed = parser(value);
          editorDraft[key] = parsed;
          range.value = parsed;
          number.value = parsed;
          refreshEditorPreview();
        };
        range.addEventListener("input", () => apply(range.value));
        number.addEventListener("input", () => apply(number.value));
      }

      function setEditorTab(tab) {
        currentEditorTab = tab;
        document.querySelectorAll("[data-editor-tab-button]").forEach(button => {
          button.classList.toggle("active", button.dataset.editorTabButton === tab);
        });
        document.querySelectorAll(".editor-section").forEach(section => {
          section.hidden = section.dataset.editorTab !== tab;
        });
      }


      function syncEditedImageCard(imageId, previewSrc) {
        document.querySelectorAll(`.image-card[data-image-id="${imageId}"] img`).forEach(img => {
          img.src = previewSrc;
        });
      }

      function openEditorPanel() {
        document.body.classList.add("editor-open");
        if (!els.imageEditorDialog.open) els.imageEditorDialog.show();
      }


      function openSettingsPanel() {
        document.body.classList.add("settings-open");
        if (!els.settingsDialog.open) els.settingsDialog.show();
      }

      function closeSettingsPanel() {
        if (els.settingsDialog.open) els.settingsDialog.close();
        document.body.classList.remove("settings-open");
      }

      function setCaptionPanelCollapsed(collapsed) {
        captionPanelCollapsed = collapsed;
        const body = document.getElementById("captionPanelBody");
        const btn = document.getElementById("toggleCaptionPanelBtn");
        body.hidden = collapsed;
        btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
        btn.textContent = collapsed ? "▸" : "▾";
      }

      function closeEditorPanel({ revert = false } = {}) {
        if (revert && currentEditorImageId && state.images[currentEditorImageId]) {
          state.images[currentEditorImageId].edit = editorOriginalEdit ? { ...editorOriginalEdit } : defaultImageEdit();
          state.images[currentEditorImageId].previewSrc = editorOriginalPreviewSrc || state.images[currentEditorImageId].originalSrc || state.images[currentEditorImageId].src;
          syncEditedImageCard(currentEditorImageId, state.images[currentEditorImageId].previewSrc);
        }
        if (els.imageEditorDialog.open) els.imageEditorDialog.close();
        document.body.classList.remove("editor-open");
        currentEditorImageId = null;
        editorDraft = null;
        editorOriginalPreviewSrc = "";
        editorOriginalEdit = null;
      }

      function openImageEditor(imageId) {
        const imageData = state.images[imageId];
        if (!imageData) return;
        currentEditorImageId = imageId;
        editorOriginalPreviewSrc = imageData.previewSrc || imageData.originalSrc || imageData.src;
        editorOriginalEdit = { ...defaultImageEdit(), ...(imageData.edit || {}) };
        editorDraft = { ...defaultImageEdit(), ...(imageData.edit || {}) };
        setEditorTab("image");
        updateEditorControls();
        refreshEditorPreview();
        openEditorPanel();
      }

      function resetEditorDraft() {
        if (!currentEditorImageId) return;
        editorDraft = defaultImageEdit();
        updateEditorControls();
        refreshEditorPreview();
      }

      async function saveImageEditor() {
        if (!currentEditorImageId || !editorDraft) return;
        const imageData = state.images[currentEditorImageId];
        imageData.edit = { ...editorDraft };
        lastAppliedEdit = { ...editorDraft };
        const previewCanvas = await renderImageComposition(imageData, editorDraft, 512);
        imageData.previewSrc = previewCanvas.toDataURL("image/png");
        render();
        pushHistory();
        closeEditorPanel();
        showToast("Imagem editada.");
      }


      async function rebuildImagePreview(id) {
        const imageData = state.images[id];
        if (!imageData) return;
        const previewCanvas = await renderImageComposition(imageData, imageData.edit, 512);
        imageData.previewSrc = previewCanvas.toDataURL("image/png");
      }

      async function applyEditSubsetToAll(mode = "all") {
        if (!editorDraft) return;
        for (const id of Object.keys(state.images)) {
          const imageData = state.images[id];
          imageData.edit = { ...defaultImageEdit(), ...(imageData.edit || {}) };
          if (mode === "background") {
            Object.assign(imageData.edit, {
              bgMode: editorDraft.bgMode,
              bgColor: editorDraft.bgColor,
              bgImageSrc: editorDraft.bgImageSrc,
              bgFit: editorDraft.bgFit,
              bgOpacity: editorDraft.bgOpacity,
              bgZoom: editorDraft.bgZoom,
              bgPosX: editorDraft.bgPosX,
              bgPosY: editorDraft.bgPosY
            });
          } else if (mode === "effects") {
            Object.assign(imageData.edit, {
              outlineSize: editorDraft.outlineSize,
              outlineColor: editorDraft.outlineColor,
              shadowSize: editorDraft.shadowSize,
              shadowColor: editorDraft.shadowColor,
              bannerEnabled: editorDraft.bannerEnabled,
              bannerHeight: editorDraft.bannerHeight,
              bannerColor: editorDraft.bannerColor,
              bannerOpacity: editorDraft.bannerOpacity
            });
          } else {
            imageData.edit = { ...editorDraft };
          }
          await rebuildImagePreview(id);
        }
        render();
        pushHistory();
        showToast(mode === "background" ? "Fundo aplicado em todas." : mode === "effects" ? "Efeitos aplicados em todas." : "Estilo aplicado em todas.");
      }

      async function clearAllImageEdits() {
        for (const id of Object.keys(state.images)) {
          state.images[id].edit = defaultImageEdit();
          state.images[id].previewSrc = state.images[id].originalSrc || state.images[id].src;
        }
        render();
        pushHistory();
        showToast("Edições removidas de todas as imagens.");
      }


      async function applyBackgroundImageToAll(src) {
        for (const id of Object.keys(state.images)) {
          const imageData = state.images[id];
          imageData.edit = { ...defaultImageEdit(), ...(imageData.edit || {}) };
          imageData.edit.bgMode = "image";
          imageData.edit.bgImageSrc = src;
          imageData.edit.bgFit = imageData.edit.bgFit || "cover";
          imageData.edit.bgOpacity = imageData.edit.bgOpacity ?? 100;
          await rebuildImagePreview(id);
        }
        render();
        pushHistory();
        showToast("Fundo aplicado em todas as imagens.");
      }

      async function removeBackgroundFromAll() {
        for (const id of Object.keys(state.images)) {
          const imageData = state.images[id];
          imageData.edit = { ...defaultImageEdit(), ...(imageData.edit || {}) };
          imageData.edit.bgMode = "none";
          imageData.edit.bgImageSrc = "";
          await rebuildImagePreview(id);
        }
        render();
        pushHistory();
        showToast("Fundos removidos de todas as imagens.");
      }

      function pointerToCanvasPercent(event, canvas) {
        const rect = canvas.getBoundingClientRect();
        return {
          x: ((event.clientX - rect.left) / rect.width) * 100,
          y: ((event.clientY - rect.top) / rect.height) * 100
        };
      }

      function splitLongWord(ctx, word, maxWidth) {
        if (ctx.measureText(word).width <= maxWidth) return [word];
        const pieces = [];
        let chunk = "";
        for (const char of word) {
          const test = chunk + char;
          if (chunk && ctx.measureText(test).width > maxWidth) {
            pieces.push(chunk);
            chunk = char;
          } else {
            chunk = test;
          }
        }
        if (chunk) pieces.push(chunk);
        return pieces;
      }

      function wrapCanvasText(ctx, text, maxWidth) {
        const paragraphs = String(text).split(/\n/);
        const lines = [];

        paragraphs.forEach((paragraph, pIndex) => {
          const words = paragraph.split(/\s+/).filter(Boolean).flatMap(word => splitLongWord(ctx, word, maxWidth));
          if (!words.length) {
            lines.push("");
          } else {
            let line = "";
            words.forEach(word => {
              const test = line ? `${line} ${word}` : word;
              if (ctx.measureText(test).width <= maxWidth || !line) {
                line = test;
              } else {
                lines.push(line);
                line = word;
              }
            });
            if (line) lines.push(line);
          }
          if (pIndex < paragraphs.length - 1 && paragraph) lines.push("");
        });

        return lines;
      }

      function getRowTextLayout(ctx, text, labelWidth, settings, baseRowHeight) {
        const maxWidth = Math.max(20, labelWidth - (settings.rowPaddingX * 2) - 4);
        let fontSize = settings.rowFontSize;
        let lines = [];
        let lineHeight = 0;
        let textHeight = 0;
        const minFontSize = 10;

        while (fontSize >= minFontSize) {
          ctx.font = `900 ${fontSize}px ${settings.rowFontFamily}`;
          lines = wrapCanvasText(ctx, text || "Row", maxWidth);
          lineHeight = Math.max(16, Math.round(fontSize * 1.12));
          textHeight = lines.length * lineHeight;
          if (settings.rowAutoHeight || !settings.rowAutoFit || textHeight + (settings.rowPaddingY * 2) <= baseRowHeight) break;
          fontSize -= 1;
        }

        return {
          fontSize,
          lines,
          lineHeight,
          textHeight,
          requiredHeight: textHeight + (settings.rowPaddingY * 2)
        };
      }

      function drawImageCover(ctx, img, x, y, width, height, fit = "cover", zoom = 100, posX = 50, posY = 50) {
        if (fit === "stretch") {
          ctx.drawImage(img, x, y, width, height);
          return;
        }

        const zoomFactor = Math.max(0.05, zoom / 100);
        let baseScale;
        if (fit === "contain") {
          baseScale = Math.min(width / img.width, height / img.height);
        } else {
          baseScale = Math.max(width / img.width, height / img.height);
        }
        const scale = baseScale * zoomFactor;

        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const extraX = Math.max(0, drawWidth - width);
        const extraY = Math.max(0, drawHeight - height);
        const drawX = x - extraX * (posX / 100) + Math.max(0, (width - drawWidth) / 2);
        const drawY = y - extraY * (posY / 100) + Math.max(0, (height - drawHeight) / 2);

        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, width, height);
        ctx.clip();
        ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);
        ctx.restore();
      }

      function hexToRgb(hex) {
        const value = hex.replace("#", "");
        const normalized = value.length === 3
          ? value.split("").map(char => char + char).join("")
          : value;
        const number = parseInt(normalized, 16);
        return {
          r: (number >> 16) & 255,
          g: (number >> 8) & 255,
          b: number & 255
        };
      }

      function contrastingText(hex) {
        const { r, g, b } = hexToRgb(hex);
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
        return luminance > 165 ? "#111111" : "#ffffff";
      }

      function getCanvasAlign(alignment) {
        if (alignment === "left") return "left";
        if (alignment === "right") return "right";
        return "center";
      }

      function getTextX(alignment, startX, width, padding = 12) {
        if (alignment === "left") return startX + padding;
        if (alignment === "right") return startX + width - padding;
        return startX + width / 2;
      }

      async function exportPNG() {
        try {
          const s = state.settings;
          const boardWidth = s.boardWidth;
          const labelWidth = s.labelWidth;
          const contentWidth = boardWidth - labelWidth;
          const gap = s.gap;
          const tile = s.imageSize;
          const columns = Math.max(1, Math.floor((contentWidth - gap) / (tile + gap)));

          const scale = 2;
          const temp = document.createElement("canvas");
          const tempCtx = temp.getContext("2d");

          const rowLayouts = state.rows.map(row => {
            const baseRowHeight = getRowBaseHeight(row);
            const imageLines = Math.max(1, Math.ceil(row.images.length / columns));
            const imageHeight = Math.max(baseRowHeight, imageLines * tile + (imageLines + 1) * gap);
            const textLayout = getRowTextLayout(tempCtx, row.name || "Row", labelWidth, s, imageHeight);
            const rowHeight = s.rowAutoHeight ? Math.max(imageHeight, textLayout.requiredHeight) : Math.max(baseRowHeight, imageHeight);
            return { rowHeight, textLayout };
          });
          const rowHeights = rowLayouts.map(item => item.rowHeight);

          tempCtx.font = `900 ${s.captionFontSize}px ${s.captionFontFamily}`;
          const hasCaptionImage = Boolean(state.captionImage);
          const captionPaddingX = 22;
          const captionPaddingY = 18;
          const captionGap = 14;
          const imageSize = s.captionImageSize;
          const textOnlyMaxWidth = boardWidth - (captionPaddingX * 2);
          const sideImageMaxWidth = boardWidth - (captionPaddingX * 2) - (hasCaptionImage ? imageSize + captionGap : 0);
          const captionTextMaxWidth = ["left", "right"].includes(s.captionImagePosition) ? sideImageMaxWidth : textOnlyMaxWidth;
          const captionLines = state.caption.trim()
            ? wrapCanvasText(tempCtx, state.caption.trim(), Math.max(80, captionTextMaxWidth))
            : [];
          const captionLineHeight = Math.max(24, Math.round(s.captionFontSize * 1.2));
          const captionTextHeight = captionLines.length ? captionLines.length * captionLineHeight : 0;
          let captionHeight = 0;
          if (captionLines.length || hasCaptionImage) {
            if (["left", "right"].includes(s.captionImagePosition) && hasCaptionImage && captionLines.length) {
              captionHeight = captionPaddingY * 2 + Math.max(imageSize, captionTextHeight);
            } else if (["top", "bottom"].includes(s.captionImagePosition) && hasCaptionImage && captionLines.length) {
              captionHeight = captionPaddingY * 2 + imageSize + captionGap + captionTextHeight;
            } else if (hasCaptionImage) {
              captionHeight = captionPaddingY * 2 + imageSize;
            } else {
              captionHeight = captionPaddingY * 2 + captionTextHeight;
            }
          }
          const totalHeight = captionHeight + rowHeights.reduce((sum, value) => sum + value, 0);

          const canvas = document.createElement("canvas");
          canvas.width = boardWidth * scale;
          canvas.height = totalHeight * scale;
          const ctx = canvas.getContext("2d");
          ctx.scale(scale, scale);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";

          ctx.fillStyle = s.backgroundColor || "#101217";
          ctx.fillRect(0, 0, boardWidth, totalHeight);

          if (captionHeight > 0) {
            ctx.fillStyle = hexToRgba(s.captionBgColor, s.captionBgOpacity / 100);
            ctx.fillRect(0, 0, boardWidth, captionHeight);
            ctx.font = `900 ${s.captionFontSize}px ${s.captionFontFamily}`;
            ctx.fillStyle = s.captionColor;
            ctx.textAlign = getCanvasAlign(s.captionAlign);
            ctx.textBaseline = "middle";

            let textAreaX = 0;
            let textAreaWidth = boardWidth;
            let textBaseY = captionHeight / 2;

            if (hasCaptionImage) {
              try {
                const capImg = await loadImage(state.captionImage);
                if (["left", "right"].includes(s.captionImagePosition) && captionLines.length) {
                  const imageX = s.captionImagePosition === "left" ? captionPaddingX : boardWidth - captionPaddingX - imageSize;
                  const imageY = (captionHeight - imageSize) / 2;
                  drawImageCover(ctx, capImg, imageX, imageY, imageSize, imageSize, "contain", 100, 50, 50);
                  textAreaX = s.captionImagePosition === "left" ? imageX + imageSize + captionGap : 0;
                  textAreaWidth = boardWidth - imageSize - captionGap - (captionPaddingX * 2);
                } else if (["top", "bottom"].includes(s.captionImagePosition) && captionLines.length) {
                  const imageX = (boardWidth - imageSize) / 2;
                  const imageY = s.captionImagePosition === "top" ? captionPaddingY : captionHeight - captionPaddingY - imageSize;
                  drawImageCover(ctx, capImg, imageX, imageY, imageSize, imageSize, "contain", 100, 50, 50);
                  textBaseY = s.captionImagePosition === "top"
                    ? captionPaddingY + imageSize + captionGap + captionTextHeight / 2
                    : captionPaddingY + captionTextHeight / 2;
                } else {
                  const imageX = (boardWidth - imageSize) / 2;
                  const imageY = (captionHeight - imageSize) / 2;
                  drawImageCover(ctx, capImg, imageX, imageY, imageSize, imageSize, "contain", 100, 50, 50);
                }
              } catch (error) {
                console.warn("Imagem da legenda ignorada", error);
              }
            }

            if (captionLines.length) {
              const captionX = getTextX(s.captionAlign, textAreaX, textAreaWidth, captionPaddingX);
              const startY = textBaseY - ((captionLines.length - 1) * captionLineHeight) / 2;
              captionLines.forEach((line, index) => {
                ctx.fillText(line, captionX, startY + index * captionLineHeight, Math.max(80, textAreaWidth));
              });
            }
          }

          const boardTop = captionHeight;
          const rowsHeight = rowHeights.reduce((sum, value) => sum + value, 0);

          if (state.background) {
            const bg = await loadImage(state.background);
            drawImageCover(ctx, bg, labelWidth, boardTop, contentWidth, rowsHeight, s.backgroundFit, s.backgroundZoom, s.backgroundPosX, s.backgroundPosY);
          }

          ctx.fillStyle = `rgba(0,0,0,${s.overlay / 100})`;
          ctx.fillRect(labelWidth, boardTop, contentWidth, rowsHeight);

          const imageCache = new Map();
          for (const id of Object.keys(state.images)) {
            try {
              const imageData = state.images[id];
              imageCache.set(id, await loadImage(imageData.previewSrc || imageData.src));
            } catch (error) {
              console.warn("Imagem ignorada na exportação:", id, error);
            }
          }

          let y = boardTop;
          const exportPositionLookup = getPositionLookup();
          for (let rowIndex = 0; rowIndex < state.rows.length; rowIndex++) {
            const row = state.rows[rowIndex];
            const rowHeight = rowHeights[rowIndex];
            const textLayout = rowLayouts[rowIndex].textLayout;

            ctx.fillStyle = row.color;
            ctx.fillRect(0, y, labelWidth, rowHeight);

            ctx.fillStyle = "rgba(22,24,30,.90)";
            ctx.fillRect(labelWidth, y, contentWidth, rowHeight);

            if (s.separatorWidth > 0) {
              ctx.strokeStyle = s.separatorColor;
              ctx.lineWidth = s.separatorWidth;
              if (rowIndex < state.rows.length - 1) {
                ctx.beginPath();
                ctx.moveTo(0, y + rowHeight - (s.separatorWidth / 2));
                ctx.lineTo(boardWidth, y + rowHeight - (s.separatorWidth / 2));
                ctx.stroke();
              }

              ctx.beginPath();
              ctx.moveTo(labelWidth - (s.separatorWidth / 2), y);
              ctx.lineTo(labelWidth - (s.separatorWidth / 2), y + rowHeight);
              ctx.stroke();
            }

            ctx.fillStyle = contrastingText(row.color);
            ctx.font = `900 ${textLayout.fontSize}px ${s.rowFontFamily}`;
            ctx.textAlign = getCanvasAlign(s.rowTextAlign);
            ctx.textBaseline = "middle";
            const rowTextX = getTextX(s.rowTextAlign, 0, labelWidth, s.rowPaddingX);
            const labelBlockHeight = textLayout.lines.length * textLayout.lineHeight;
            let labelStart;
            if (s.rowVerticalAlign === "top") {
              labelStart = y + s.rowPaddingY + (textLayout.lineHeight / 2);
            } else if (s.rowVerticalAlign === "bottom") {
              labelStart = y + rowHeight - s.rowPaddingY - labelBlockHeight + (textLayout.lineHeight / 2);
            } else {
              labelStart = y + rowHeight / 2 - ((textLayout.lines.length - 1) * textLayout.lineHeight) / 2;
            }
            textLayout.lines.forEach((line, i) => {
              ctx.fillText(line, rowTextX, labelStart + i * textLayout.lineHeight);
            });

            row.images.forEach((id, index) => {
              const img = imageCache.get(id);
              if (!img) return;

              const col = index % columns;
              const line = Math.floor(index / columns);
              const x = labelWidth + gap + col * (tile + gap);
              const imageY = y + gap + line * (tile + gap);

              const radius = Math.min(8, tile / 6);
              if (s.imageFrameEnabled) {
                ctx.fillStyle = "#08090b";
                ctx.fillRect(x, imageY, tile, tile);
              }
              ctx.save();
              ctx.beginPath();
              ctx.roundRect(x, imageY, tile, tile, radius);
              ctx.clip();
              drawImageCover(ctx, img, x, imageY, tile, tile, "contain");
              ctx.restore();

              if (s.positionMode) {
                const badgeIndex = exportPositionLookup.get(id) ?? index;
                const badgeText = formatPositionBadge(badgeIndex);
                ctx.font = `900 ${s.positionFontSize}px ${s.positionFontFamily}`;
                const badgePadX = 6;
                const badgePadY = 4;
                const badgeH = s.positionFontSize + badgePadY * 2;
                const badgeW = ctx.measureText(badgeText).width + badgePadX * 2;
                const bx = s.positionHorizontal === 'right' ? x + tile - badgeW - 4 : x + 4;
                const by = s.positionVertical === 'bottom' ? imageY + tile - badgeH - 4 : imageY + 4;
                ctx.fillStyle = s.positionBgColor;
                ctx.fillRect(bx, by, badgeW, badgeH);
                ctx.save();
                ctx.textAlign = 'left';
                ctx.textBaseline = 'middle';
                if (s.positionShadowSize > 0) {
                  ctx.shadowColor = s.positionShadowColor;
                  ctx.shadowBlur = s.positionShadowSize;
                }
                if (s.positionTextStroke > 0) {
                  ctx.strokeStyle = s.positionTextStrokeColor;
                  ctx.lineWidth = s.positionTextStroke * 2;
                  ctx.strokeText(badgeText, bx + badgePadX, by + badgeH / 2);
                }
                ctx.fillStyle = s.positionTextColor;
                ctx.fillText(badgeText, bx + badgePadX, by + badgeH / 2);
                ctx.restore();
              }

              if (s.imageFrameEnabled) {
                ctx.strokeStyle = "rgba(255,255,255,.22)";
                ctx.strokeRect(x + .5, imageY + .5, tile - 1, tile - 1);
              }
            });

            y += rowHeight;
          }

          const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(result => {
              if (result) resolve(result);
              else reject(new Error("Falha ao criar PNG"));
            }, "image/png", 1);
          });

          const filename = "tier-list.png";
          const file = new File([blob], filename, { type: "image/png" });
          const mobileShareSupported =
            isMobileInteractionMode() &&
            typeof navigator.share === "function" &&
            typeof navigator.canShare === "function" &&
            navigator.canShare({ files: [file] });

          if (mobileShareSupported) {
            try {
              await navigator.share({
                files: [file],
                title: "Tier List",
                text: "Tier list exportada em PNG"
              });
              showToast("Imagem pronta para salvar ou compartilhar.");
              return;
            } catch (shareError) {
              if (shareError?.name === "AbortError") {
                showToast("Salvamento cancelado.");
                return;
              }
              console.warn("Compartilhamento nativo indisponível; usando download.", shareError);
            }
          }

          downloadBlob(blob, filename, "image/png");
          showToast(mobileShareSupported ? "PNG baixado como arquivo." : "PNG exportado.");
        } catch (error) {
          console.error(error);
          showToast("Não foi possível exportar a imagem.");
        }
      }

      function updateChoiceButtons(groupId, activeValue) {
        const group = document.getElementById(groupId);
        if (!group) return;
        [...group.querySelectorAll("button")].forEach(button => {
          button.classList.toggle("active", String(button.dataset.value) === String(activeValue));
        });
      }

      function bindChoiceGroup(groupId, key) {
        const group = document.getElementById(groupId);
        group.addEventListener("click", (event) => {
          const button = event.target.closest("button[data-value]");
          if (!button) return;
          const raw = button.dataset.value;
          state.settings[key] = raw === "true" ? true : raw === "false" ? false : raw;
          applySettings();
          if (key.startsWith("position") || key === "rowAutoHeight") render();
          scheduleHistoryPush();
        });
      }

      document.getElementById("addImagesBtn").addEventListener("click", () => els.imageInput.click());
      els.imageInput.addEventListener("change", async () => {
        await addImageFiles(els.imageInput.files);
        els.imageInput.value = "";
      });

      document.getElementById("addRowBtn").addEventListener("click", () => addRow());
      els.undoBtn.addEventListener("click", undoHistory);
      els.redoBtn.addEventListener("click", redoHistory);
      document.getElementById("settingsBtn").addEventListener("click", () => {
        renderRowManager();
        updateSettingsControls();
        openSettingsPanel();
      });
      document.getElementById("closeSettingsBtn").addEventListener("click", closeSettingsPanel);
      document.getElementById("doneSettingsBtn").addEventListener("click", closeSettingsPanel);

      document.getElementById("browserSaveBtn").addEventListener("click", () => {
        closeProjectMenu();
        if (currentBrowserProjectName) {
          saveCurrentProjectInBrowser(currentBrowserProjectName).catch(error => showToast(error.message));
        } else {
          openBrowserProjectsDialog();
          document.getElementById("browserProjectNameInput").focus();
        }
      });
      document.getElementById("browserProjectsBtn").addEventListener("click", () => {
        closeProjectMenu();
        openBrowserProjectsDialog();
      });
      document.getElementById("newProjectBtn").addEventListener("click", () => {
        closeProjectMenu();
        startNewProject();
      });
      document.getElementById("closeBrowserProjectsBtn").addEventListener("click", () => els.browserProjectsDialog.close());
      document.getElementById("saveNamedBrowserProjectBtn").addEventListener("click", () => {
        saveCurrentProjectInBrowser().catch(error => showToast(error.message));
      });
      document.getElementById("browserProjectNameInput").addEventListener("keydown", event => {
        if (event.key === "Enter") {
          event.preventDefault();
          saveCurrentProjectInBrowser().catch(error => showToast(error.message));
        }
      });

      document.getElementById("saveBtn").addEventListener("click", () => {
        closeProjectMenu();
        saveProject();
      });
      document.getElementById("shareLinkBtn").addEventListener("click", openShareProjectDialog);
      document.getElementById("closeShareProjectBtn").addEventListener("click", () => els.shareProjectDialog.close());
      document.getElementById("doneShareProjectBtn").addEventListener("click", () => els.shareProjectDialog.close());
      document.getElementById("copyShareProjectBtn").addEventListener("click", copyShareProjectLink);
      document.getElementById("nativeShareProjectBtn").addEventListener("click", nativeShareProjectLink);
      document.getElementById("downloadShareProjectBtn").addEventListener("click", saveProject);
      document.getElementById("loadBtn").addEventListener("click", () => {
        closeProjectMenu();
        els.projectInput.click();
      });
      els.projectInput.addEventListener("change", async () => {
        const [file] = els.projectInput.files;
        if (file) await loadProject(file);
        els.projectInput.value = "";
      });

      document.getElementById("exportBtn").addEventListener("click", exportPNG);
      document.getElementById("clearAllBtn").addEventListener("click", clearAllTierImages);
      document.getElementById("toggleCaptionPanelBtn").addEventListener("click", () => {
        setCaptionPanelCollapsed(!captionPanelCollapsed);
      });

      els.captionInput.addEventListener("input", updateCaption);

      document.getElementById("captionImageBtn").addEventListener("click", () => els.captionImageInput.click());
      document.getElementById("removeCaptionImageBtn").addEventListener("click", () => {
        state.captionImage = "";
        renderCaptionBlock();
        pushHistory();
      });
      els.captionImageInput.addEventListener("change", async () => {
        const [file] = els.captionImageInput.files;
        if (file) {
          state.captionImage = await readFileAsDataURL(file);
          renderCaptionBlock();
          pushHistory();
        }
        els.captionImageInput.value = "";
      });

      document.getElementById("backgroundBtn").addEventListener("click", () => els.backgroundInput.click());
      els.backgroundInput.addEventListener("change", async () => {
        const [file] = els.backgroundInput.files;
        if (file) await setBackground(file);
        els.backgroundInput.value = "";
      });
      document.getElementById("removeBackgroundBtn").addEventListener("click", () => {
        state.background = "";
        applySettings();
        scheduleHistoryPush();
        showToast("Fundo removido.");
      });

      document.getElementById("backgroundFit").addEventListener("change", event => {
        state.settings.backgroundFit = event.target.value;
        applySettings();
        scheduleHistoryPush();
      });

      document.getElementById("captionFontFamily").addEventListener("change", event => {
        state.settings.captionFontFamily = event.target.value;
        applySettings();
        scheduleHistoryPush();
      });

      document.getElementById("captionColorInput").addEventListener("input", event => {
        state.settings.captionColor = event.target.value;
        applySettings();
        scheduleHistoryPush();
      });
      document.getElementById("captionBgColorInput").addEventListener("input", event => {
        state.settings.captionBgColor = event.target.value;
        applySettings();
        scheduleHistoryPush();
      });
      document.getElementById("captionImagePosition").addEventListener("change", event => {
        state.settings.captionImagePosition = event.target.value;
        applySettings();
        scheduleHistoryPush();
      });
      const separatorColorInput = document.getElementById("separatorColorInput");
      if (separatorColorInput) {
        separatorColorInput.addEventListener("input", event => {
          state.settings.separatorColor = event.target.value;
          applySettings();
          scheduleHistoryPush();
        });
      }

      document.getElementById("rowFontFamily").addEventListener("change", event => {
        state.settings.rowFontFamily = event.target.value;
        applySettings();
        scheduleHistoryPush();
      });
      document.getElementById("positionFontFamily").addEventListener("change", event => {
        state.settings.positionFontFamily = event.target.value;
        render();
        scheduleHistoryPush();
      });
      document.getElementById("backgroundColorInput").addEventListener("input", event => {
        state.settings.backgroundColor = event.target.value;
        applySettings();
        scheduleHistoryPush();
      });
      document.getElementById("positionTextColorInput").addEventListener("input", event => {
        state.settings.positionTextColor = event.target.value;
        render();
        scheduleHistoryPush();
      });
      document.getElementById("positionBgColorInput").addEventListener("input", event => {
        state.settings.positionBgColor = event.target.value;
        render();
        scheduleHistoryPush();
      });
      document.getElementById("positionTextStrokeColorInput").addEventListener("input", event => {
        state.settings.positionTextStrokeColor = event.target.value;
        render();
        scheduleHistoryPush();
      });
      document.getElementById("positionShadowColorInput").addEventListener("input", event => {
        state.settings.positionShadowColor = event.target.value;
        render();
        scheduleHistoryPush();
      });

      bindRangePair("labelWidthRange", "labelWidthNumber", "labelWidth");
      bindRangePair("boardWidthRange", "boardWidthNumber", "boardWidth");
      bindRangePair("imageSizeRange", "imageSizeNumber", "imageSize");
      bindRangePair("gapRange", "gapNumber", "gap");
      bindRangePair("rowHeightRange", "rowHeightNumber", "rowMinHeight");
      bindRangePair("overlayRange", "overlayNumber", "overlay");
      bindRangePair("separatorWidthRange", "separatorWidthNumber", "separatorWidth");
      bindRangePair("backgroundZoomRange", "backgroundZoomNumber", "backgroundZoom");
      bindRangePair("backgroundPosXRange", "backgroundPosXNumber", "backgroundPosX");
      bindRangePair("backgroundPosYRange", "backgroundPosYNumber", "backgroundPosY");
      bindRangePair("captionFontSizeRange", "captionFontSizeNumber", "captionFontSize");
      bindRangePair("captionBgOpacityRange", "captionBgOpacityNumber", "captionBgOpacity");
      bindRangePair("captionImageSizeRange", "captionImageSizeNumber", "captionImageSize");
      bindRangePair("rowFontSizeRange", "rowFontSizeNumber", "rowFontSize");
      bindRangePair("positionFontSizeRange", "positionFontSizeNumber", "positionFontSize");
      bindRangePair("positionTextStrokeRange", "positionTextStrokeNumber", "positionTextStroke");
      bindRangePair("positionShadowSizeRange", "positionShadowSizeNumber", "positionShadowSize");
      bindRangePair("rowPaddingXRange", "rowPaddingXNumber", "rowPaddingX");
      bindRangePair("rowPaddingYRange", "rowPaddingYNumber", "rowPaddingY");

      bindChoiceGroup("captionAlignButtons", "captionAlign");
      bindChoiceGroup("rowAlignButtons", "rowTextAlign");
      bindChoiceGroup("rowVerticalButtons", "rowVerticalAlign");
      bindChoiceGroup("rowAutoFitButtons", "rowAutoFit");
      bindChoiceGroup("rowAutoHeightButtons", "rowAutoHeight");
      bindChoiceGroup("imageFrameButtons", "imageFrameEnabled");
      bindChoiceGroup("positionModeButtons", "positionMode");
      bindChoiceGroup("quickPositionButtons", "positionMode");
      bindChoiceGroup("positionScopeButtons", "positionScope");
      bindChoiceGroup("positionHorizontalButtons", "positionHorizontal");
      bindChoiceGroup("positionVerticalButtons", "positionVertical");
      ["rowFontSizeRange","rowFontSizeNumber","rowPaddingXRange","rowPaddingXNumber","rowPaddingYRange","rowPaddingYNumber"].forEach(id => {
        document.getElementById(id).addEventListener("input", flashRowsHighlight);
      });
      ["rowFontFamily","rowAlignButtons","rowVerticalButtons","rowAutoFitButtons","rowAutoHeightButtons"].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener("change", flashRowsHighlight);
        el.addEventListener("click", flashRowsHighlight);
      });
      ["captionFontSizeRange","captionFontSizeNumber","captionColorInput","captionBgColorInput","captionBgOpacityRange","captionBgOpacityNumber","captionFontFamily","captionAlignButtons"].forEach(id => {
        const el = document.getElementById(id);
        el.addEventListener("input", flashCaptionHighlight);
        el.addEventListener("change", flashCaptionHighlight);
        el.addEventListener("click", flashCaptionHighlight);
      });


      document.getElementById("chooseAllBgBtn").addEventListener("click", () => document.getElementById("applyAllBgInput").click());
      document.getElementById("removeAllBgBtn").addEventListener("click", removeBackgroundFromAll);
      document.getElementById("applyAllBgInput").addEventListener("change", async () => {
        const [file] = document.getElementById("applyAllBgInput").files;
        if (file) {
          const src = await readFileAsDataURL(file);
          await applyBackgroundImageToAll(src);
        }
        document.getElementById("applyAllBgInput").value = "";
      });
      document.getElementById("applyLastBgAllBtn").addEventListener("click", async () => {
        if (!lastAppliedEdit && !editorDraft) {
          showToast("Edite uma imagem primeiro.");
          return;
        }
        if (!editorDraft && lastAppliedEdit) editorDraft = { ...lastAppliedEdit };
        await applyEditSubsetToAll("background");
      });
      document.getElementById("applyLastEffectsAllBtn").addEventListener("click", async () => {
        if (!lastAppliedEdit && !editorDraft) {
          showToast("Edite uma imagem primeiro.");
          return;
        }
        if (!editorDraft && lastAppliedEdit) editorDraft = { ...lastAppliedEdit };
        await applyEditSubsetToAll("effects");
      });
      document.getElementById("clearAllImageEffectsBtn").addEventListener("click", clearAllImageEdits);

      document.getElementById("resetLayoutBtn").addEventListener("click", () => {
        state.settings = { ...DEFAULT_SETTINGS };
        applySettings();
        render();
        pushHistory();
        showToast("Tamanhos restaurados.");
      });

      window.addEventListener("dragover", event => {
        if ([...event.dataTransfer?.types || []].includes("Files")) event.preventDefault();
      });

      window.addEventListener("drop", async event => {
        const files = [...(event.dataTransfer?.files || [])];
        if (!files.length) return;
        if (event.target.closest(".dropzone")) return;
        event.preventDefault();
        await addImageFiles(files);
      });

      window.addEventListener("resize", () => requestAnimationFrame(fitAllRowTexts));


      bindEditorRangePair("editorMainScaleRange", "editorMainScaleNumber", "mainScale");
      bindEditorRangePair("editorMainOffsetXRange", "editorMainOffsetXNumber", "mainOffsetX");
      bindEditorRangePair("editorMainOffsetYRange", "editorMainOffsetYNumber", "mainOffsetY");
      bindEditorRangePair("editorOutlineSizeRange", "editorOutlineSizeNumber", "outlineSize");
      bindEditorRangePair("editorShadowSizeRange", "editorShadowSizeNumber", "shadowSize");
      bindEditorRangePair("editorBgOpacityRange", "editorBgOpacityNumber", "bgOpacity");
      bindEditorRangePair("editorBgZoomRange", "editorBgZoomNumber", "bgZoom");
      bindEditorRangePair("editorBgPosXRange", "editorBgPosXNumber", "bgPosX");
      bindEditorRangePair("editorBgPosYRange", "editorBgPosYNumber", "bgPosY");
      bindEditorRangePair("editorBannerHeightRange", "editorBannerHeightNumber", "bannerHeight");
      bindEditorRangePair("editorBannerOpacityRange", "editorBannerOpacityNumber", "bannerOpacity");
      bindEditorRangePair("editorTextSizeRange", "editorTextSizeNumber", "textSize");
      bindEditorRangePair("editorTextXRange", "editorTextXNumber", "textX");
      bindEditorRangePair("editorTextYRange", "editorTextYNumber", "textY");
      bindEditorRangePair("editorTextStrokeRange", "editorTextStrokeNumber", "textStroke");
      bindEditorRangePair("editorPipSizeRange", "editorPipSizeNumber", "pipSize");
      bindEditorRangePair("editorPipXRange", "editorPipXNumber", "pipX");
      bindEditorRangePair("editorPipYRange", "editorPipYNumber", "pipY");

      document.getElementById("editorBgMode").addEventListener("change", event => changeEditorValue("bgMode", event.target.value));
      document.querySelectorAll("[data-editor-tab-button]").forEach(button => {
        button.addEventListener("click", () => setEditorTab(button.dataset.editorTabButton));
      });
      document.getElementById("editorBgColor").addEventListener("input", event => changeEditorValue("bgColor", event.target.value));
      document.getElementById("editorOutlineColor").addEventListener("input", event => changeEditorValue("outlineColor", event.target.value));
      document.getElementById("editorShadowColor").addEventListener("input", event => changeEditorValue("shadowColor", event.target.value));
            document.getElementById("editorBgFit").addEventListener("change", event => changeEditorValue("bgFit", event.target.value));
      document.getElementById("editorBannerColor").addEventListener("input", event => changeEditorValue("bannerColor", event.target.value));
      document.getElementById("editorText").addEventListener("input", event => changeEditorValue("text", event.target.value));
      document.getElementById("editorTextColor").addEventListener("input", event => changeEditorValue("textColor", event.target.value));
      document.getElementById("editorTextStrokeColor").addEventListener("input", event => changeEditorValue("textStrokeColor", event.target.value));

      document.getElementById("editorBannerEnabledButtons").addEventListener("click", event => {
        const button = event.target.closest("button[data-value]");
        if (!button) return;
        editorDraft.bannerEnabled = button.dataset.value === "true";
        updateChoiceButtons("editorBannerEnabledButtons", String(editorDraft.bannerEnabled));
        refreshEditorPreview();
      });
      document.getElementById("editorTextAlignButtons").addEventListener("click", event => {
        const button = event.target.closest("button[data-value]");
        if (!button) return;
        editorDraft.textAlign = button.dataset.value;
        updateChoiceButtons("editorTextAlignButtons", String(editorDraft.textAlign));
        refreshEditorPreview();
      });
      document.getElementById("editorTextShadowButtons").addEventListener("click", event => {
        const button = event.target.closest("button[data-value]");
        if (!button) return;
        editorDraft.textShadow = button.dataset.value === "true";
        updateChoiceButtons("editorTextShadowButtons", String(editorDraft.textShadow));
        refreshEditorPreview();
      });
      document.getElementById("editorPipEnabledButtons").addEventListener("click", event => {
        const button = event.target.closest("button[data-value]");
        if (!button) return;
        editorDraft.pipEnabled = button.dataset.value === "true";
        updateChoiceButtons("editorPipEnabledButtons", String(editorDraft.pipEnabled));
        refreshEditorPreview();
      });

      document.getElementById("editorChooseBgBtn").addEventListener("click", () => els.editorBgInput.click());
      els.editorBgInput.addEventListener("change", async () => {
        const [file] = els.editorBgInput.files;
        if (file && editorDraft) {
          editorDraft.bgImageSrc = await readFileAsDataURL(file);
          editorDraft.bgMode = "image";
          updateEditorControls();
          refreshEditorPreview();
        }
        els.editorBgInput.value = "";
      });
      document.getElementById("editorRemoveBgBtn").addEventListener("click", () => {
        if (!editorDraft) return;
        editorDraft.bgImageSrc = "";
        if (editorDraft.bgMode === "image") editorDraft.bgMode = "none";
        updateEditorControls();
        refreshEditorPreview();
      });

      document.getElementById("editorChoosePipBtn").addEventListener("click", () => els.editorPipInput.click());
      document.getElementById("editorApplyBgAllBtn").addEventListener("click", () => applyEditSubsetToAll("background"));
      document.getElementById("editorApplyEffectsAllBtn").addEventListener("click", () => applyEditSubsetToAll("effects"));
      document.getElementById("editorApplyAllAllBtn").addEventListener("click", () => applyEditSubsetToAll("all"));
      els.editorPipInput.addEventListener("change", async () => {
        const [file] = els.editorPipInput.files;
        if (file && editorDraft) {
          editorDraft.pipSrc = await readFileAsDataURL(file);
          editorDraft.pipEnabled = true;
          updateEditorControls();
          refreshEditorPreview();
        }
        els.editorPipInput.value = "";
      });
      document.getElementById("editorRemovePipBtn").addEventListener("click", () => {
        if (!editorDraft) return;
        editorDraft.pipSrc = "";
        editorDraft.pipEnabled = false;
        updateEditorControls();
        refreshEditorPreview();
      });

      document.getElementById("closeEditorBtn").addEventListener("click", () => closeEditorPanel({ revert: true }));
      document.getElementById("cancelEditorBtn").addEventListener("click", () => closeEditorPanel({ revert: true }));
      document.getElementById("resetEditorBtn").addEventListener("click", resetEditorDraft);
      document.getElementById("saveEditorBtn").addEventListener("click", saveImageEditor);


      document.getElementById("editorCanvas").addEventListener("pointerdown", event => {
        if (!editorDraft) return;
        if (currentEditorTab === "text" && (editorDraft.text || "").trim()) {
          editorDragMode = "text";
        } else if (currentEditorTab === "pip" && editorDraft.pipEnabled && editorDraft.pipSrc) {
          editorDragMode = "pip";
        } else {
          return;
        }
        event.target.setPointerCapture(event.pointerId);
      });
      document.getElementById("editorCanvas").addEventListener("pointermove", event => {
        if (!editorDragMode || !editorDraft) return;
        const pos = pointerToCanvasPercent(event, event.currentTarget);
        if (editorDragMode === "text") {
          editorDraft.textX = Math.max(0, Math.min(100, pos.x));
          editorDraft.textY = Math.max(0, Math.min(100, pos.y));
        } else if (editorDragMode === "pip") {
          editorDraft.pipX = Math.max(0, Math.min(100, pos.x));
          editorDraft.pipY = Math.max(0, Math.min(100, pos.y));
        }
        updateEditorControls();
        refreshEditorPreview();
      });
      const stopEditorDrag = () => { editorDragMode = null; };
      document.getElementById("editorCanvas").addEventListener("pointerup", stopEditorDrag);
      document.getElementById("editorCanvas").addEventListener("pointercancel", stopEditorDrag);

      window.addEventListener("keydown", event => {
        const modifier = event.ctrlKey || event.metaKey;
        if (!modifier) return;
        if (event.key.toLowerCase() === "z" && !event.shiftKey) {
          event.preventDefault();
          undoHistory();
        } else if (event.key.toLowerCase() === "y" || (event.key.toLowerCase() === "z" && event.shiftKey)) {
          event.preventDefault();
          redoHistory();
        }
      });

      els.browserProjectsDialog.addEventListener("cancel", event => {
        event.preventDefault();
        els.browserProjectsDialog.close();
      });
      els.shareProjectDialog.addEventListener("cancel", event => {
        event.preventDefault();
        els.shareProjectDialog.close();
      });
      els.settingsDialog.addEventListener("close", () => document.body.classList.remove("settings-open"));


      els.imageEditorDialog.addEventListener("close", () => {
        document.body.classList.remove("editor-open");
      });

      els.imageEditorDialog.addEventListener("cancel", event => {
        event.preventDefault();
        closeEditorPanel({ revert: true });
      });

      els.imageEditorDialog.addEventListener("click", event => {
        const rect = els.imageEditorDialog.getBoundingClientRect();
        const outside =
          event.clientX < rect.left || event.clientX > rect.right ||
          event.clientY < rect.top || event.clientY > rect.bottom;
        if (outside) closeEditorPanel({ revert: true });
      });


      const tierAssetSearchInput = document.getElementById("tierAssetSearch");
      tierAssetSearchInput?.addEventListener("input", event => {
        tierAssetQuery = event.target.value;
        clearTimeout(tierAssetTimer);
        if (!tierNormalizeSearch(tierAssetQuery)) {
          renderTierAssetResults();
          return;
        }
        tierAssetTimer = setTimeout(async () => {
          try {
            await loadTierAssetData();
            renderTierAssetResults();
            if (tierAssetType === "team") {
              await loadLiveTeamLogos();
              renderTierAssetResults();
            }
          } catch (_) {}
        }, 70);
      });
      document.getElementById("tierAssetTypeButtons")?.addEventListener("click", event => {
        const button = event.target.closest("button[data-value]");
        if (!button) return;
        tierAssetType = button.dataset.value;
        document.querySelectorAll("#tierAssetTypeButtons button[data-value]").forEach(item => item.classList.toggle("active", item === button));
        if (!tierNormalizeSearch(tierAssetQuery)) {
          renderTierAssetResults();
          return;
        }
        loadTierAssetData().then(async () => {
          renderTierAssetResults();
          if (tierAssetType === "team") {
            await loadLiveTeamLogos();
            renderTierAssetResults();
          }
        }).catch(() => {});
      });
      document.getElementById("tierAssetResults")?.addEventListener("click", event => {
        const button = event.target.closest("[data-asset-id]");
        if (!button || button.disabled || !tierAssetData) return;
        const asset = tierAssetData.assetMap.get(button.dataset.assetId);
        if (asset) addTierAsset(asset).catch(() => showToast("Não foi possível adicionar a imagem."));
      });
      document.getElementById("tierAssetAddVisible")?.addEventListener("click", () => {
        if (!tierNormalizeSearch(tierAssetQuery)) return;
        loadTierAssetData().then(addVisibleTierAssets).catch(() => showToast("Biblioteca indisponível."));
      });
      document.querySelectorAll("[data-tier-preset]").forEach(button => {
        button.addEventListener("click", () => loadTierPreset(button.dataset.tierPreset).catch(() => showToast("Não foi possível abrir o projeto.")));
      });

      setupTrashDropzone();

      const initializeBlankProject = () => {
        els.captionInput.value = state.caption;
        normalizeStateImages();
        renderCaptionBlock();
        render();
        pushHistory(true);
        updateHistoryButtons();
      };

      (async () => {
        if (await loadSharedProjectFromLocation()) return;
        if (loadAutosave()) {
          els.captionInput.value = state.caption;
          pushHistory(true);
          updateHistoryButtons();
          return;
        }
        try {
          let record = await getBrowserProject(BROWSER_AUTOSAVE_NAME);
          if (!record && currentBrowserProjectName) {
            record = await getBrowserProject(currentBrowserProjectName);
          }
          if (record?.snapshot) {
            restoreSnapshot(JSON.parse(JSON.stringify(record.snapshot)));
            els.captionInput.value = state.caption;
            pushHistory(true);
            updateHistoryButtons();
            showToast("Projeto recuperado do navegador.");
          } else {
            try {
              const loaded = await loadDefaultTierPreset();
              if (!loaded) initializeBlankProject();
            } catch (error) {
              console.warn("Não foi possível abrir o projeto padrão da WB 2026 S2", error);
              initializeBlankProject();
            }
          }
        } catch (error) {
          console.warn("Não foi possível recuperar o projeto do navegador", error);
          try {
            const loaded = await loadDefaultTierPreset();
            if (!loaded) initializeBlankProject();
          } catch (_) {
            initializeBlankProject();
          }
        }
      })();
    })();
