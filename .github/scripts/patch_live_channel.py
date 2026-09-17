from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f'{label}: trecho não encontrado')
    return text.replace(old, new, 1)


# Admin UI
p = Path('admin.html')
text = p.read_text(encoding='utf-8')
old = '          <div class="admin-field admin-field-wide"><label for="live-url">Link da transmissão <span class="admin-optional">(opcional)</span></label><input id="live-url" type="url" placeholder="https://www.youtube.com/watch?v=..."><small>Se preencher, o card da live na home fica clicável.</small></div>'
new = '          <div class="admin-field admin-field-wide"><label for="live-url">Link da transmissão ou do canal <span class="admin-optional">(opcional)</span></label><input id="live-url" type="url" placeholder="https://www.youtube.com/@canal ou https://www.youtube.com/watch?v=..."><small>Se for um canal do YouTube, a home abre automaticamente o endereço /live para cair na transmissão atual.</small></div>\n          <div class="admin-field"><label for="live-link-mode">Quando liberar o link?</label><select id="live-link-mode"><option value="schedule" selected>Somente no horário de início</option><option value="always">Sempre disponível</option></select><small>Use “Somente no horário” quando o canal transmite torneios diferentes.</small></div>'
text = replace_once(text, old, new, 'admin.html live-url')
text = text.replace('js/admin.js?v=20260902-news-schedule-v27', 'js/admin.js?v=20260917-live-channel-link-v28')
p.write_text(text, encoding='utf-8')


# Admin persistence
p = Path('js/admin-core.js')
text = p.read_text(encoding='utf-8')
text = replace_once(
    text,
    "    url: String(raw && raw.url || '').trim(),\n    inicio: String(raw && (raw.inicio || raw.data_hora || '') || '').trim(),",
    "    url: String(raw && raw.url || '').trim(),\n    linkMode: String(raw && raw.linkMode || '').trim().toLowerCase() === 'schedule' ? 'schedule' : 'always',\n    inicio: String(raw && (raw.inicio || raw.data_hora || '') || '').trim(),",
    'admin-core normalizeLive'
)
text = text.replace(
    "  $('#live-url').value = item.url;\n  $('#live-start').value = item.inicio.slice(0, 16);",
    "  $('#live-url').value = item.url;\n  $('#live-link-mode').value = item.linkMode === 'schedule' ? 'schedule' : 'always';\n  $('#live-start').value = item.inicio.slice(0, 16);"
)
text = replace_once(
    text,
    "  $('#live-duration-minutes').value = '0';\n  $('#live-type').value = 'mobile';",
    "  $('#live-duration-minutes').value = '0';\n  $('#live-link-mode').value = 'schedule';\n  $('#live-type').value = 'mobile';",
    'admin-core clearLiveForm'
)
text = replace_once(
    text,
    "    url: $('#live-url').value.trim(),\n    inicio: $('#live-start').value.trim(),",
    "    url: $('#live-url').value.trim(),\n    linkMode: $('#live-link-mode').value === 'schedule' ? 'schedule' : 'always',\n    inicio: $('#live-start').value.trim(),",
    'admin-core readLiveForm'
)
p.write_text(text, encoding='utf-8')


# Bust admin-core module cache
p = Path('js/admin.js')
text = p.read_text(encoding='utf-8')
text = text.replace('./admin-core.js?v=20260909-admin-sections-titles-v1', './admin-core.js?v=20260917-live-channel-link-v1')
p.write_text(text, encoding='utf-8')


# Home live widget
p = Path('js/home-live-widget.min.js')
text = p.read_text(encoding='utf-8')
text = replace_once(
    text,
    'data_hora:idx(["data_hora","datahora","data_e_hora","inicio","data"]),duracao:idx(["duracao","duracao_horas","horas"])};',
    'data_hora:idx(["data_hora","datahora","data_e_hora","inicio","data"]),duracao:idx(["duracao","duracao_horas","horas"]),linkMode:idx(["link_mode","modo_link","liberar_link","disponibilidade_link"])};',
    'home widget sheet map'
)
text = replace_once(
    text,
    'url:String(get("url",2)??"").trim(),categoria:String(get("categoria",3)??"mobile").trim().toLowerCase()||"mobile",ativo:bool(get("ativo",4)),data_hora:String(get("data_hora",5)??"").trim(),duracaoMinutos:Math.max(0,Math.round(num(get("duracao",6))*60)),source:"sheet"',
    'url:String(get("url",2)??"").trim(),categoria:String(get("categoria",3)??"mobile").trim().toLowerCase()||"mobile",ativo:bool(get("ativo",4)),data_hora:String(get("data_hora",5)??"").trim(),duracaoMinutos:Math.max(0,Math.round(num(get("duracao",6))*60)),linkMode:String(map.linkMode>=0?get("linkMode",-1):"always").trim().toLowerCase()==="schedule"?"schedule":"always",source:"sheet"',
    'home widget sheet row'
)
text = replace_once(
    text,
    'url:String(raw?.url||"").trim(),categoria:String(raw?.tipo||raw?.categoria||"mobile").trim().toLowerCase(),ativo:false,data_hora:String(raw?.inicio||raw?.data_hora||"").trim(),duracaoMinutos:Number.isFinite(mins)?Math.max(0,Math.round(mins)):0,source:"admin"',
    'url:String(raw?.url||"").trim(),categoria:String(raw?.tipo||raw?.categoria||"mobile").trim().toLowerCase(),ativo:false,data_hora:String(raw?.inicio||raw?.data_hora||"").trim(),duracaoMinutos:Number.isFinite(mins)?Math.max(0,Math.round(mins)):0,linkMode:String(raw?.linkMode||"always").trim().toLowerCase()==="schedule"?"schedule":"always",source:"admin"',
    'home widget admin row'
)
marker = 'const UPCOMING_LIMIT=2;\n'
helpers = '''const UPCOMING_LIMIT=2;
function resolveLiveUrl(value){const raw=String(value||"").trim();if(!raw)return"";try{const u=new URL(raw,location.href),host=u.hostname.toLowerCase().replace(/^www\\./,"");if(host==="youtube.com"||host==="m.youtube.com"){let path=u.pathname.replace(/\\/+$/,"");if(/^\\/(?:@[^/]+|channel\\/[^/]+|c\\/[^/]+|user\\/[^/]+)$/i.test(path)){u.pathname=path+"/live";u.search="";u.hash="";return u.toString()}if(/^\\/(?:@[^/]+|channel\\/[^/]+|c\\/[^/]+|user\\/[^/]+)\\/streams$/i.test(path)){u.pathname=path.replace(/\\/streams$/i,"/live");u.search="";u.hash="";return u.toString()}}return u.toString()}catch(e){return raw}}
function liveLinkAvailable(r,s,now){if(!r.url)return false;return r.linkMode!=="schedule"||!!(s.start&&now>=s.start)}
'''
text = replace_once(text, marker, helpers, 'home widget helpers')
old_build = 'function buildLiveCard(r,s,now,labels){const el=document.createElement(r.url?"a":"div");const visualClass=["mobile","emulador","emulator","misto"].includes(r.categoria)?"recomendada":r.categoria;el.className="live-card "+(s.isLive?`ativo ${visualClass}`:"agendado");if(r.url){el.target="_blank";el.rel="noopener noreferrer";el.href=r.url}else el.style.cursor="default";'
new_build = 'function buildLiveCard(r,s,now,labels){const href=liveLinkAvailable(r,s,now)?resolveLiveUrl(r.url):"",el=document.createElement(href?"a":"div");const visualClass=["mobile","emulador","emulator","misto"].includes(r.categoria)?"recomendada":r.categoria;el.className="live-card "+(s.isLive?`ativo ${visualClass}`:"agendado");if(href){el.target="_blank";el.rel="noopener noreferrer";el.href=href}else{el.style.cursor="default";if(r.url&&r.linkMode==="schedule"&&s.future)el.title="Link liberado no horário de início"};'
text = replace_once(text, old_build, new_build, 'home widget buildLiveCard')
p.write_text(text, encoding='utf-8')


# Bust home cache
p = Path('index.html')
text = p.read_text(encoding='utf-8')
text = text.replace('js/home-live-widget.min.js?v=20260902-home-lives-v24', 'js/home-live-widget.min.js?v=20260917-channel-link-v25')
p.write_text(text, encoding='utf-8')
