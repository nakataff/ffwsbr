'use strict';
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const origin = 'https://centralfreefire.com.br';
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const escape = value => String(value).replace(/[&<>"']/g, char =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[char]));
const articles = JSON.parse(read('data/public-news-pages.json'));
const check = process.argv.includes('--check');
const changes = [];

function publish(file, content) {
  const target = path.join(root, file);
  if (fs.existsSync(target) && read(file) === content) return;
  changes.push(file);
  if (!check) {
    fs.mkdirSync(path.dirname(target), {recursive:true});
    fs.writeFileSync(target, content);
  }
}

const template = read('noticia.html').trimEnd() + '\n';
const staticIds = new Set();
for (const article of articles) {
  const {id, title, description, image, date} = article;
  if (!/^[a-z0-9-]+$/.test(id) || staticIds.has(id) || !/^https:\/\//.test(image)) {
    throw Error('Metadados de notícia inválidos: ' + id);
  }
  staticIds.add(id);
  const canonical = origin + '/noticia/' + id + '/';
  const metadata = [
    ['property', 'og:type', 'article'], ['property', 'og:title', title],
    ['property', 'og:description', description], ['property', 'og:image', image],
    ['property', 'og:url', canonical], ['property', 'article:published_time', date],
    ['name', 'twitter:card', 'summary_large_image']
  ].map(([attribute, key, value]) => '  <meta ' + attribute + '="' + key + '" content="' + escape(value) + '">');
  const head = [
    '<title>' + escape(title) + ' | Central Free Fire</title>',
    '  <meta name="description" content="' + escape(description) + '">',
    '  <link rel="canonical" href="' + canonical + '">',
    ...metadata
  ].join('\n');
  const body = [
    '<article id="noticia-dinamica" class="news-article" data-news-id="' + id + '">',
    '      <img class="news-cover" alt="" src="' + escape(image) + '" fetchpriority="high">',
    '      <div class="news-content"><div class="news-kicker">Notícia</div>',
    '        <h1 class="news-title">' + escape(title) + '</h1>',
    '        <p class="news-summary">' + escape(description) + '</p>',
    '        <p class="news-meta">' + escape(date) + ' · Central Free Fire</p>',
    '      </div>',
    '    </article>'
  ].join('\n');
  publish('noticia/' + id + '/index.html', template
    .replace(/<title>[^<]*<\/title>\s*<meta name="description"[^>]+>/, () => head)
    .replace(/<article id="noticia-dinamica"[\s\S]+?<\/article>/, () => body));
}

const providerFile = 'js/news-admin-provider.js';
publish(providerFile, read(providerFile).replace(/const STATIC_NEWS = new Set\(\[.*?\]\);/,
  () => 'const STATIC_NEWS = new Set(' + JSON.stringify([...staticIds]) + ');'));

const tournament = (prefix, pages) => pages.map(page => '/' + prefix + '/' + page + '/');
const paths = ['/', '/mercado.html', '/ffws-br-s1.html', '/tier-constructor.html', '/camp-ao-vivo.html',
  '/equipes-historicas.html', '/ranking-anual.html',
  ...tournament('ffws-global-2026', ['inicio','formato','classificatoria','segunda-fase','last-chance',
    'final','jogadores','mvp','equipes','datas','selecoes','stats','notas','comparar']),
  ...tournament('ffws-br-s2', ['inicio','classificatoria','segunda-fase','final','mvp','equipes','datas','stats','selecoes','notas','comparar']),
  ...fs.readdirSync(path.join(root, 'noticias')).sort().map(id => '/noticias/' + id + '/')
];
for (const route of paths) {
  const file = route.endsWith('/') ? route + 'index.html' : route;
  if (!fs.existsSync(path.join(root, file.slice(1)))) throw Error('Rota sem arquivo: ' + route);
}
const locations = paths.map(route => '  <url><loc>' + origin + route + '</loc></url>');
for (const {id, date} of articles) {
  locations.push('  <url><loc>' + origin + '/noticia/' + id + '/</loc><lastmod>' + date + '</lastmod></url>');
}
publish('sitemap.xml', [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...locations, '</urlset>', ''
].join('\n'));
if (check && changes.length) {
  console.error('Páginas públicas fora de sincronia:\n' + changes.join('\n'));
  process.exitCode = 1;
}
