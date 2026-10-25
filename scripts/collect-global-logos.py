"""Collect published team logos for review and same-origin delivery."""
import base64,concurrent.futures,csv,io,json,re,unicodedata,urllib.request
from pathlib import Path
from PIL import Image
SHEET='https://docs.google.com/spreadsheets/d/e/2PACX-1vR6Paknya4E3qRT2mLd0fQMIiBKhuGOPebF0pLK9c0Gk5nRnVWNdY4FxMJV42467JLmwNNumXSc4fCC/pub?gid=1308958099&single=true&output=tsv'
def norm(v):return re.sub('[^A-Z0-9]','',unicodedata.normalize('NFD',str(v)).encode('ascii','ignore').decode().upper())
def get(url):
 for attempt in range(3):
  try:
   with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'CentralFreeFire-logo-sync/1.0'}),timeout=25) as r:return r.read()
  except Exception:
   if attempt==2:raise
rows=list(csv.reader(io.StringIO(get(SHEET).decode('utf-8-sig')),delimiter='\t'))
name_headers={'EQUIPE','TIME','TEAM','NOME','ORGANIZACAO','NOMEDOTIME','NOMEDAEQUIPE','NOMEEQUIPE','NOMETIME'}
url_headers={'LOGO','URL','LINK','IMAGEM','IMAGE','ESCUDO','LOGOURL','LINKLOGO','URLLOGO','LOGODOTIME','LOGODAEQUIPE'}
header=[norm(c) for c in rows[0]]
ni=next((i for i,h in enumerate(header) if h in name_headers),None)
ui=next((i for i,h in enumerate(header) if h in url_headers),None)
logos={};lyon_rows=[]
for row in rows[1:] if ni is not None else rows:
 urls=[(i,re.search(r'https?://[^\s"\'<>]+',c)) for i,c in enumerate(row)]
 urls=[(i,m.group(0).rstrip('),.;')) for i,m in urls if m]
 if not urls:continue
 ix,url=next(((i,u) for i,u in urls if i==ui),urls[0])
 name=row[ni].strip() if ni is not None and ni<len(row) else next((v.strip() for i,v in enumerate(row) if i!=ix and v.strip()),'')
 if norm(name)=='LYON':lyon_rows.append({'name':name,'url':url})
 if name:logos[norm(name)]=url
teams=json.loads(Path('ffws-global-2026/teams.json').read_text())['teams']
canonical=next(t['logo'] for t in json.loads(Path('ewc 2026/times.json').read_text())['teams'] if t['name']=='LYON')
def collect(team):
 candidates=[team['name'],team.get('wikiName',''),team['abbreviation']]
 if team['id']=='pe':candidates+=['PIRATES ESPORTS','PIRATE','PE']
 url=next((logos[norm(n)] for n in candidates if norm(n) in logos),'')
 if team['id']=='lyon':url=canonical
 if not url and team.get('logo') and team['logo']!='escudo.webp':
  raw=team['logo']
  if raw.startswith('https://'):url=raw
  else:
   data=Path(raw).read_bytes();url='https://centralfreefire.com.br/'+urllib.parse.quote(raw)
 if not url:raise ValueError('No logo found for '+team['name'])
 if 'data' not in locals():data=get(url)
 picture=Image.open(io.BytesIO(data)).convert('RGBA');picture.thumbnail((224,224),Image.Resampling.LANCZOS)
 output=io.BytesIO();picture.save(output,format='WEBP',quality=90,method=6)
 return {'id':team['id'],'name':team['name'],'abbreviation':team['abbreviation'],'source':url,'path':'home-assets/teams/global/'+team['id']+'.webp','base64':base64.b64encode(output.getvalue()).decode(),'width':picture.width,'height':picture.height,'bytes':len(output.getvalue())}
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:assets=list(pool.map(collect,teams))
print('GLOBAL_LOGO_DATA='+json.dumps({'lyonSheetRows':lyon_rows,'assets':assets},ensure_ascii=False))
