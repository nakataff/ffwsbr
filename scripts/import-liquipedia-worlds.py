"""Deterministic, offline pilot importer. No wiki/HTML evaluation or network access.

The reviewed manifest selects a bounded batch. Nested templates and links are parsed
structurally; unsupported/missing data is reported, never replaced with invented zeroes.
"""
from pathlib import Path
from dataclasses import dataclass
import argparse, calendar, hashlib, html, json, re, unicodedata
ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'imports/liquipedia-worlds'
def read(p):return json.loads(p.read_text())
def key(v):return re.sub('[^a-z0-9]','',unicodedata.normalize('NFD',str(v)).encode('ascii','ignore').decode().lower())
def packed(d):return json.dumps(d,ensure_ascii=False,separators=(',',':'))+'\n'

@dataclass
class Template:
    name:str
    args:dict
    start:int=0
    end:int=0

def templates(text):
    """Yield nested templates, preserving offsets, and reject truncated source."""
    stack=[];out=[];i=0
    while i<len(text):
        if text.startswith('{{',i):stack.append(i);i+=2
        elif text.startswith('}}',i):
            if not stack:raise ValueError('Fechamento de template sem abertura')
            start=stack.pop();raw=text[start+2:i];parts=split_top(raw,'|');args={};pos=1
            for part in parts[1:]:
                assignment=split_top(part,'=',once=True)
                if len(assignment)>1:args[assignment[0].strip()]=assignment[1].strip()
                else:args[str(pos)]=part.strip();pos+=1
            out.append(Template(parts[0].strip(),args,start,i+2));i+=2
        else:i+=1
    if stack:raise ValueError('Código truncado: template não fechado')
    return sorted(out,key=lambda t:t.start)

def split_top(text,delimiter,once=False):
    chunks=[];begin=0;braces=0;links=0;i=0
    while i<len(text):
        if text.startswith('{{',i):braces+=1;i+=2;continue
        if text.startswith('}}',i):braces-=1;i+=2;continue
        if text.startswith('[[',i):links+=1;i+=2;continue
        if text.startswith(']]',i):links-=1;i+=2;continue
        if text[i]==delimiter and braces==0 and links==0:
            chunks.append(text[begin:i]);begin=i+1
            if once:chunks.append(text[begin:]);return chunks
        i+=1
    return chunks+[text[begin:]]

def first(text,name):return next((t for t in templates(text) if t.name.lower()==name.lower()),None)
def clean(text):
    text=re.sub(r'<!--.*?-->','',str(text),flags=re.S)
    text=re.sub(r'<ref\b[^>]*>.*?</ref>|<ref\b[^>]*/>','',text,flags=re.S|re.I)
    # Markup wrappers are converted to plain text, never emitted as HTML.
    for _ in range(12):
        ts=templates(text) if '{{' in text else []
        if not ts:break
        t=ts[-1];a=t.args;n=t.name.lower()
        value=a.get('2',a.get('1','')) if n in ['abbr','abbrlink','bgcolortext'] else ' ' if n.startswith(('flag','leagueicon','abbr/')) else a.get('1','') if n in ['team','player','teamopponent','opponent','nowrap'] else '| ' if n=='!' else ''
        text=text[:t.start]+value+text[t.end:]
    text=re.sub(r'\[\[([^\]|]+)\|([^\]]+)\]\]',r'\2',text)
    text=re.sub(r'\[\[([^\]]+)\]\]',r'\1',text)
    text=re.sub(r'\[https?://[^\s\]]+\s+([^\]]+)\]',r'\1',text)
    text=re.sub(r'<[^>]+>',' ',text).replace("'''",'').replace("''",'')
    return re.sub(r'\s+',' ',html.unescape(text)).strip()

def integer(value):
    value=clean(value)
    return int(value) if re.fullmatch(r'\d+',value) else None

def date(value):
    value=clean(value)
    iso=re.match(r'(\d{4}-\d{2}-\d{2})',value)
    if iso:return iso[1]
    m=re.match(r'([A-Za-z]+) (\d{1,2}), (\d{4})',value)
    if m:return f'{m[3]}-{list(calendar.month_name).index(m[1]):02}-{int(m[2]):02}'
    return ''

COLS=['pos','teamOriginal','team','headstart','kills','placementPts','killPts','finalPts','total','matches']
MATCH_COLS=['match','placement','kills','placementPts','killPts','total']

def order_rows(rows,official=None,champion=None):
    # Free Fire ties: Booyahs, kills, then placement in the last played drop.
    rows.sort(key=lambda r:(r[2]!=champion if champion else False,-r[8],
        official.get(r[2],999) if official else 999,-sum(d[1]==1 for d in r[9]),-r[4],r[9][-1][1]))
    for pos,row in enumerate(rows,1):row[0]=pos

def match_table(match,resolve,title,sid,*,official=None,final=False,headstart=None,champion=None,anomalies=None):
    p=match.args;kp=integer(p.get('p_kill',''));assert kp is not None,'Pontuação por abate ausente'
    placement={str(n):integer(p.get('p'+str(n),'0')) for n in range(1,13)}
    assert all(v is not None for v in placement.values()),'Tabela de pontuação inválida'
    maps=[]
    for field,value in p.items():
        if not re.fullmatch(r'map\d+',field):continue
        m=first(value,'Map');assert m,'Mapa sem template'
        maps.append([int(field[3:]),{'Purgatory':'Purgatório','Nexterra':'Nova Terra'}.get(clean(m.args.get('map','')),clean(m.args.get('map',''))),date(m.args.get('date','')),clean(m.args.get('vod',''))])
    maps.sort();assert [m[0] for m in maps]==list(range(1,len(maps)+1)) and maps,'Quedas incompletas'
    rows=[]
    for field,value in p.items():
        if not re.fullmatch(r'opponent\d+',field):continue
        opponent=first(value,'TeamOpponent');assert opponent
        q=opponent.args;original=clean(q.get('1',''));team=resolve(original);drops=[]
        for number,_,_,_ in maps:
            score=first(q.get('m'+str(number),''),'MS')
            if not score:raise ValueError(f'{title}: {team}, queda {number} sem MS')
            pos=integer(score.args.get('1',''));kills=integer(score.args.get('2',''))
            assert pos is not None and 1<=pos<=12 and kills is not None,f'{title}: posição/abates ausentes'
            pp=placement[str(pos)];drops.append([number,pos,kills,pp,kills*kp,pp+kills*kp])
        kills=sum(d[2] for d in drops);pp=sum(d[3] for d in drops);points=pp+kills*kp
        bonus=integer(q.get('startingpoints','0'));assert bonus is not None,'Bônus inválido'
        if headstart is not None:assert headstart.get(team)==bonus,('Bônus diverge do resumo',team,bonus,headstart.get(team))
        rows.append([None,original,team,bonus,kills,pp,kills*kp,points,points+bonus,drops])
    assert len({r[2] for r in rows})==len(rows),'Equipe repetida na rodada'
    for number,_,_,_ in maps:
        positions=[r[9][number-1][1] for r in rows]
        if sorted(positions)!=list(range(1,len(rows)+1)):
            known=(anomalies or {}).get(sid+':'+str(number))
            assert known and known['positions']==positions,('Posições incompletas/repetidas',title,number,positions)
    order_rows(rows,official,champion)
    if official:
        for row in rows:assert official[row[2]]==row[0],('Final diverge da premiação',row[2],row[0],official[row[2]])
    table=dict(type='final' if final else 'pointRush' if sid.startswith('point-rush') else 'standings',source='liquipedia-text',format='bracket2',title=title,stageId=sid,finished=p.get('finished')=='true',killPoint=kp,placementPoints=placement,mapCols=['match','map','date','vod'],maps=maps,cols=COLS.copy(),matchCols=MATCH_COLS.copy(),rows=rows,drops=len(maps),preservePositions=True)
    if not final:
        table['rounds']=['Q'+str(m[0]) for m in maps];table['cols'].append('results')
        for row in rows:row.append([d[5] for d in row[9]])
    if p.get('matchpoint'):
        threshold=integer(p['matchpoint']);assert champion and threshold,'Champion Rush sem regra/campeão'
        winners=[]
        for row in rows:
            running=row[3]
            for d in row[9]:
                if running>=threshold and d[1]==1:winners.append((d[0],row[2]))
                running+=d[5]
        assert winners and min(winners)==(len(maps),champion),'Campeão não cumpriu o Champion Rush'
        table['championRush']=dict(threshold=threshold,champion=champion,winningMatch=len(maps))
    issues=[v['note'] for k,v in (anomalies or {}).items() if k.startswith(sid+':')]
    if issues:table['dataNotes']=issues
    return table

def modern_stages(cfg,all_t,resolve,prize_order,report):
    by_id={t.args.get('id'):t for t in all_t if t.name in ['Bracket','Matchlist']}
    bonus={}
    initial=next((t for t in all_t if t.name=='HeadstartPointsTable' and t.args.get('title')=='Initial Grand Finals Points'),None)
    if initial:
        for k,v in initial.args.items():
            if re.fullmatch(r'team\d+',k):bonus[resolve(v)]=integer(initial.args['hs_pts'+k[4:]])
    b=by_id[cfg['finalBracket']];champion=min(prize_order,key=prize_order.get) if cfg.get('championRush') else None
    final=match_table(first(b.args['R1M1'],'Match'),resolve,'Grande final','final',official=prize_order,final=True,headstart=bonus or None,champion=champion,anomalies=cfg.get('sourceAnomalies'))
    ko=by_id[cfg['knockoutList']];daily=[]
    for n in range(1,7):daily.append(match_table(first(ko.args['M'+str(n)],'Match'),resolve,f'Knockout · Dia {n}','knockout-day-'+str(n),anomalies=cfg.get('sourceAnomalies')))
    combined={}
    for i,table in enumerate(daily):
        for row in table['rows']:
            entry=combined.setdefault(row[2],[None,row[1],row[2],0,0,0,0,0,0,[],[None]*6])
            for col in [4,5,6,7,8]:entry[col]+=row[col]
            entry[9].extend([[i*6+d[0],*d[1:]] for d in row[9]])
            entry[10][i]=row[8]
    rows=list(combined.values());order_rows(rows)
    assert all(len(r[9])==24 for r in rows),'Cada participante precisa ter 24 quedas no Knockout'
    knockout={**daily[0], 'title':'Knockout · Classificação geral','stageId':'knockout','cols':COLS+['results'],'rows':rows,'rounds':['Dia '+str(i) for i in range(1,7)],'maps':[[(i*6+m[0]),*m[1:]] for i,t in enumerate(daily) for m in t['maps']],'drops':24,'slotStage':'knockout'}
    notes=[note for t in daily for note in t.get('dataNotes',[])]
    if notes:knockout['dataNotes']=notes
    # Reconcile independent summary data rather than trusting the detailed matches alone.
    if cfg['year']==2023:
        summary=next(t for t in all_t if t.name=='League standings without lobby custom')
        for k,v in summary.args.items():
            if not re.fullmatch(r'team\d+',k):continue
            row=combined[resolve(v)];expected=[integer(x.strip()) for x in summary.args['standings'+k[4:]].split(',')]
            assert row[10]==expected,('Resumo diário divergente',row[2],row[10],expected)
    if cfg['year']==2024:
        summary=next(t for t in all_t if t.name=='FfaStandings' and t.args.get('title')=='Knockout Stage Standings')
        official_order=[]
        for k,v in summary.args.items():
            if not k.isdigit():continue
            q=first(v,'TeamOpponent').args;row=combined[resolve(q['1'])]
            assert [row[5],row[4]]==[integer(q['r1']),integer(q['r2'])],('Resumo geral divergente',row[2])
            official_order.append(row[2])
        assert set(official_order)==set(combined),'Resumo Knockout incompleto'
        order_rows(rows,{n:i for i,n in enumerate(official_order,1)})
        assert [r[2] for r in rows]==official_order,'Desempate Knockout diverge da fonte'
    standings=[knockout];point_rush=[]
    for i,ident in enumerate(cfg.get('pointRushBrackets',[]),1):
        b=by_id[ident];table=match_table(first(b.args['R1M1'],'Match'),resolve,f'Point Rush · Dia {i}','point-rush-'+str(i));point_rush.append(table)
    if point_rush:
        schedule=cfg['headstartPoints'];calculated={r[2]:0 for r in final['rows']}
        for table in point_rush:
            for row in table['rows']:calculated[row[2]]+=schedule[row[0]-1]
        assert calculated==bonus,('Bônus não reconcilia com Point Rush',calculated,bonus)
        standings+=point_rush
    # 2025 Week 1 defines Clash Squad qualification, independent of the BR final.
    if cfg['year']==2025:
        week=[]
        for row in rows:
            ds=[d for d in row[9] if d[0]<=18];kills=sum(d[2] for d in ds);pp=sum(d[3] for d in ds);pts=kills+pp
            week.append([None,row[1],row[2],0,kills,pp,kills,pts,pts,ds,row[10][:3]])
        order_rows(week)
        standings.append({**knockout,'title':'Knockout · Semana 1 (vagas no Clash Squad)','stageId':'knockout-week1','slotStage':'knockout-week1','rows':week,'rounds':['Dia 1','Dia 2','Dia 3'],'drops':12,'maps':knockout['maps'][:18]})
    report['dailyStages']=[dict(name=t['title'],teams=len(t['rows']),drops=t['drops']) for t in daily+point_rush]
    return final,standings,dict(type='headstart',title='Bônus inicial da final',cols=['pos','team','points'],rows=[[i,n,v] for i,(n,v) in enumerate(sorted(bonus.items(),key=lambda p:-p[1]),1)]) if bonus else None

def compile_clash(ts,resolve,report):
    """Clash Squad is a separate competition, with no BR bonus or championship."""
    series=[];groups=[t for t in ts if t.name in ['Bracket','Matchlist']]
    labels={'FWGFCS25OP':'Suíça · Rodada 1','FFWGFCS25H':'Suíça · Rodada 2 (1–0)','FFWGFCS25L':'Suíça · Rodada 2 (0–1)','FFWGFCS25M':'Suíça · Rodada 3 (1–1)'}
    for g in groups:
        for k,v in g.args.items():
            if not re.fullmatch(r'(?:R\d+)?M\d+',k):continue
            t=first(v,'Match');assert t
            p=t.args;teams=[resolve(first(p['opponent'+str(i)],'TeamOpponent').args['1']) for i in [1,2]];scores=[0,0];maps=[]
            for mk,mv in p.items():
                if not re.fullmatch(r'map\d+',mk):continue
                q=first(mv,'Map').args
                if q.get('finished')=='skip':continue
                a,b=integer(q.get('score1','')),integer(q.get('score2',''))
                assert a is not None and b is not None and a!=b,'Placar CS incompleto'
                scores[0 if a>b else 1]+=1;maps.append(dict(map=clean(q.get('map','')),score=[a,b]))
            bo=integer(p.get('bestof','3' if g.args.get('id') in labels else ''));assert bo in [3,5] and max(scores)==bo//2+1 and min(scores)<bo//2+1,'Série CS incompleta'
            label=labels.get(g.args.get('id')) or ('Final' if k=='R2M1' else 'Semifinal')
            series.append(dict(stage=label,teams=teams,score=scores,winner=teams[0 if scores[0]>scores[1] else 1],date=date(p.get('date','')),bestOf=bo,maps=maps))
    assert len(series)==13,'Clash Squad exige 10 séries suíças e 3 de playoffs'
    pool=next(t for t in ts if t.name=='TeamPrizePool');prizes=[];rank=1
    for k,v in pool.args.items():
        if not k.isdigit():continue
        slot=first(v,'Slot');names=[resolve(first(val,'Opponent').args['1']) for field,val in slot.args.items() if field.isdigit()];amount=integer(slot.args['usdprize'].replace(',',''))
        prizes.append(dict(position=str(rank) if len(names)==1 else f'{rank}–{rank+len(names)-1}',teams=names,prizePerTeam=amount));rank+=len(names)
    assert sum(len(r['teams'])*r['prizePerTeam'] for r in prizes)==145000,'Premiação CS divergente'
    final=next(s for s in series if s['stage']=='Final');assert final['winner']==prizes[0]['teams'][0],'Campeão CS diverge da premiação'
    swiss={n:dict(team=n,wins=0,losses=0) for s in series if s['stage'].startswith('Suíça') for n in s['teams']}
    for s in series:
        if not s['stage'].startswith('Suíça'):continue
        for n in s['teams']:
            assert max(swiss[n]['wins'],swiss[n]['losses'])<2,'Equipe CS joga após encerrar a suíça'
            swiss[n]['wins' if n==s['winner'] else 'losses']+=1
    assert len(swiss)==8 and sum(r['wins']==2 for r in swiss.values())==4,'Classificação suíça inconsistente'
    semifinalists={n for s in series if s['stage']=='Semifinal' for n in s['teams']}
    assert semifinalists=={n for n,r in swiss.items() if r['wins']==2},'Semifinalistas incompatíveis'
    awards=[]
    for pool in (t for t in ts if t.name=='AwardPrizePool'):
        for k,v in pool.args.items():
            if not k.isdigit():continue
            slot=first(v,'Slot');q=next(first(v,'Opponent').args for k,v in slot.args.items() if k.isdigit())
            awards.append(dict(award='MVP da final',player=clean(q['1']),team=resolve(q['team'])))
    report['clashSquad']=dict(teams=8,series=len(series),champion=final['winner'])
    return dict(independent=True,title='Clash Squad 2025',description='Competição separada do Battle Royale, sem bônus na classificação BR. Suíça em melhor de 3 (5 e 6/11); semifinais e final em melhor de 5 (14/11).',champion=final['winner'],prizeTotal=150000,prizeNote='US$ 145 mil distribuídos às equipes e US$ 5 mil para o MVP da final.',series=series,swiss=sorted(swiss.values(),key=lambda r:(-r['wins'],r['losses'],r['team'])),prizes=prizes,awards=awards)

def compile_event(cfg):
    raw=(BASE/'sources'/cfg['file']).read_text();text=re.sub(r'<!--.*?-->','',raw,flags=re.S)
    all_t=templates(text);inf=next(t for t in all_t if t.name.lower()=='infobox league');a=inf.args
    other_inf=next((t for t in all_t if t.name.lower()=='infobox league' and t.start>inf.start),None)
    cs_templates=[t for t in all_t if other_inf and t.start>=other_inf.start]
    if other_inf:all_t=[t for t in all_t if t.start<other_inf.start]
    report={'id':cfg['id'],'sourceFile':cfg['file'],'sha256':hashlib.sha256(raw.encode()).hexdigest(),'warnings':[]}
    items=[];aliases={};unresolved=set();headers=[(m.start(),len(m[1]),m[2].strip()) for m in re.finditer(r'(?m)^(={2,6})\s*([^=\n]+?)\s*\1\s*$',text)]
    for t in all_t:
        if t.name.lower()!='teamcard':continue
        p=t.args;name=clean(p.get('team',''));assert name,'TeamCard sem nome'
        stage=next((label for pos,level,label in reversed(headers) if pos<t.start and level==3),'')
        roster=dict(id=key(name),o=name,n=name,q=clean(p.get('qualifier','')),flag=clean(p.get('flag','')),p=[],s=[])
        roster['entryStage']='withdrawn' if stage in ['Former Participants','Former Participant'] or p.get('nostorage')=='true' else 'playins' if stage=='Play-ins Teams' else 'knockout' if cfg.get('knockoutList') else 'final'
        for field in sorted(p,key=lambda k:int(re.search(r'\d+',k)[0]) if re.fullmatch(r'p\d+',k) else 999):
            if not re.fullmatch(r'p\d+',field) or not clean(p[field]):continue
            roster['p'].append(dict(n=clean(p[field]),f=clean(p.get(field+'flag') or p.get('flag','')),r='player',t='player',l=clean(p.get(field+'link',''))))
        if clean(p.get('c','')):roster['s'].append(dict(n=clean(p['c']),f=clean(p.get('cflag') or p.get('flag','')),r='coach',t='staff',l=clean(p.get('clink',''))))
        if clean(p.get('a','')):roster['s'].append(dict(n=clean(p['a']),f=clean(p.get('aflag') or p.get('flag','')),r='analyst',t='staff',l=clean(p.get('alink',''))))
        for field in p:
            if not re.fullmatch(r't2c\d+',field) or not clean(p[field]):continue
            role=key(clean(p.get(field+'pos','')))
            role='analyst' if role in ['a','analyst','analista'] else 'assistant_coach' if 'assistant' in role else 'manager' if 'manager' in role else 'coach' if 'coach' in role else 'other'
            roster['s'].append(dict(n=clean(p[field]),f=clean(p.get(field+'flag') or p.get('flag','')),r=role,t='staff',l=clean(p.get(field+'link',''))))
        if not roster['s'] and roster['entryStage']!='withdrawn':report['warnings'].append('Comissão não informada: '+name)
        for member in roster['p']+roster['s']:
            context=name+'|'+member['r']+'|'+member['n'];person_id=cfg.get('personLinks',{}).get(context)
            if person_id:member['personId']=person_id
        items.append(roster);aliases[key(name)]=name
    for alias,name in cfg.get('teamAliases',{}).items():
        assert any(t['n']==name for t in items),('Alias sem equipe',alias,name)
        aliases[key(alias)]=name
    def resolve(value):
        value=clean(value);name=aliases.get(key(value))
        if not name:raise ValueError('Alias de equipe não revisado: '+value)
        return name
    pools=next(t for t in all_t if t.name=='TeamPrizePool');prizes=[];prize_order={};rank=0;withdrawn=[]
    # Only direct Slot arguments: adjacentContent/AwardPrizePool is not collective money.
    for k,value in pools.args.items():
        if not k.isdigit():continue
        slot=first(value,'Slot')
        if not slot:continue
        opponents=[first(v,'Opponent') for k,v in slot.args.items() if k.isdigit()]
        opponents=[o for o in opponents if o]
        names=[resolve(o.args.get('1','')) for o in opponents]
        dnp=slot.args.get('dnp')=='true' or all(t['entryStage']=='withdrawn' for t in items if t['n'] in names);amount=slot.args.get('usdprize','').replace(',','')
        amount=int(amount) if amount.isdigit() else None
        if dnp:withdrawn.extend(names)
        else:
            for name in names:rank+=1;prize_order[name]=rank
        prizes.append([None if dnp else rank,' / '.join(names),' / '.join(names),amount,'Não disputou' if dnp else ''])
    finals=[];standings=[];stage_rows=[]
    bracket=next(t for t in all_t if t.name=='Bracket')
    for field,value in ([] if cfg.get('knockoutList') else bracket.args.items()):
        if not re.fullmatch(r'R\d+M\d+',field):continue
        match=first(value,'Match')
        if not match:continue
        p=match.args;label=clean(bracket.args.get(field+'header','Grande final'));is_final='final' in label.lower() or len([k for k in bracket.args if re.fullmatch(r'R\d+M\d+',k)])==1
        sid='final' if is_final else 'playins';label='Grande final' if is_final else 'Play-ins'
        kp=integer(p.get('p_kill',''));assert kp is not None,'Pontuação por abate ausente'
        placement={str(n):integer(p.get('p'+str(n),'0')) for n in range(1,13)}
        maps=[]
        for field,value in p.items():
            if re.fullmatch(r'map\d+',field):
                m=first(value,'Map');assert m,'Mapa sem template'
                maps.append([int(field[3:]),{'Purgatory':'Purgatório','Nexterra':'Nova Terra'}.get(clean(m.args.get('map','')),clean(m.args.get('map',''))),date(m.args.get('date','')),clean(m.args.get('vod',''))])
        maps.sort();rows=[]
        for field,value in p.items():
            if not re.fullmatch(r'opponent\d+',field):continue
            opponent=first(value,'TeamOpponent') or first(value,'Opponent');assert opponent
            q=opponent.args;original=clean(q.get('1',''));team=resolve(original);drops=[]
            for number,_,_,_ in maps:
                score=first(q.get('m'+str(number),''),'MS')
                if not score:raise ValueError(f'{team}: queda {number} sem MS')
                pos=integer(score.args.get('1',''));kills=integer(score.args.get('2',''))
                if pos is None or kills is None:raise ValueError(f'{team}: estatística ausente na queda {number}')
                assert 1<=pos<=12 and kills>=0,'Posição/abates inválidos'
                pp=placement[str(pos)];drops.append([number,pos,kills,pp,kills*kp,pp+kills*kp])
            kills=sum(m[2] for m in drops);pp=sum(m[3] for m in drops);points=pp+kills*kp
            rows.append([integer(q.get('placement','')),original,team,0,kills,pp,kills*kp,points,points,drops])
        for number,_,_,_ in maps:
            positions=[r[-1][number-1][1] for r in rows]
            assert len(positions)==len(set(positions)),'Posições repetidas numa queda'
            assert sorted(positions)==list(range(1,len(rows)+1)),'Posições incompletas numa queda'
        # Source explicit placements win ties. Official final order is independently in the prize pool.
        rows.sort(key=lambda r:(-r[8],r[0] if r[0] else prize_order.get(r[2],999) if is_final else 999,-r[4],-sum(d[1]==1 for d in r[-1]),r[-1][-1][1]))
        for pos,row in enumerate(rows,1):
            if row[0] is not None:assert row[0]==pos,('Desempate incompatível',row[2],row[0],pos)
            row[0]=pos
            if is_final:assert prize_order[row[2]]==pos,('Pontuação diverge da premiação',row[2],pos,prize_order.get(row[2]))
        table=dict(type='final' if is_final else 'standings',source='liquipedia-text',format='bracket2',title=label,stageId=sid,finished=p.get('finished')=='true',killPoint=kp,placementPoints=placement,
            mapCols=['match','map','date','vod'],maps=maps,cols=['pos','teamOriginal','team','headstart','kills','placementPts','killPts','finalPts','total','matches'],
            matchCols=['match','placement','kills','placementPts','killPts','total'],rows=rows,drops=len(maps),preservePositions=True)
        if is_final:finals.append(table)
        else:
            table['rounds']=['Q'+str(m[0]) for m in maps];table['cols'].append('results')
            for row in rows:row.append([d[5] for d in row[9]])
            standings.append(table)
        stage_rows.extend((sid,row[2]) for row in rows)
    headstart=None
    if cfg.get('knockoutList'):
        final,standings,headstart=modern_stages(cfg,all_t,resolve,prize_order,report);finals=[final]
        stage_rows=[(t['stageId'],row[2]) for t in [*standings,final] for row in t['rows']]
    assert len(finals)==1,'Uma final precisa ser mapeada explicitamente'
    played={name for _,name in stage_rows};rosters={t['n'] for t in items if t['entryStage']!='withdrawn'}
    assert played==rosters,('Elencos e resultados divergentes',played-rosters,rosters-played)
    missing_withdrawn={t['n'] for t in items if t['entryStage']=='withdrawn'}-set(withdrawn)
    assert missing_withdrawn==set(cfg.get('withdrawnWithoutPrize',[])),('Desistências divergentes',missing_withdrawn)
    awards=[]
    for pool in (t for t in all_t if t.name=='AwardPrizePool'):
        for k,value in pool.args.items():
            if not k.isdigit():continue
            slot=first(value,'Slot');o=next((first(v,'Opponent') for k,v in slot.args.items() if k.isdigit()),None) if slot else None
            if not o:continue
            team_award='Team of the Day' in slot.args.get('award','')
            award=clean(slot.args.get('award','')).replace('King of the Match #','Melhor da queda #').replace('Grand Finals MVP','MVP da final').replace('Finals MVP','MVP da final').replace('Team of the Day - Day ','Equipe do dia · Dia ').replace('Team of the Day - Grand Finals','Equipe do dia · Grande final')
            awards.append(dict(award=award,player='—' if team_award else clean(o.args.get('1','')),team=resolve(o.args.get('1','') if team_award else o.args.get('team','')),note=(('Prêmio da equipe' if team_award else 'Prêmio individual')+': US$ '+slot.args['usdprize'] if slot.args.get('usdprize') else '')))
    if unresolved:raise ValueError('Aliases de equipes não revisados: '+', '.join(sorted(unresolved)))
    declared=integer(a.get('prizepoolusd','').replace(',',''));distributed=sum(row[3] or 0 for row in prizes)
    prize_note=[]
    if declared!=distributed:
        prize_note.append(f'A fonte declara US$ {declared:,} no total; as linhas de premiação coletiva somam US$ {distributed:,}. Valores preservados sem preencher a diferença.')
        report['warnings']+=prize_note
    report['warnings'].append('Estatísticas individuais completas não estão nesta página Overview; ranking pessoal não importado.')
    if cfg['year']==2019:report['warnings'].append('A seção Most Kills é parcial e não informa o escopo completo; não foi tratada como ranking geral de jogadores.')
    start=date(a.get('sdate') or a.get('date',''));end=date(a.get('edate') or a.get('date',''))
    report['unlinkedPeople']=[dict(team=t['n'],name=m['n'],role=m['r']) for t in items if t['entryStage']!='withdrawn' for m in t['p']+t['s'] if not m.get('personId')]
    report.update(teams=len(played),withdrawn=withdrawn,players=sum(len(t['p']) for t in items),staff=sum(len(t['s']) for t in items),stages=[dict(name=t['title'],teams=len(t['rows']),drops=t['drops']) for t in [*standings,*finals]])
    report['warnings']+=cfg.get('warnings',[])+[v['note'] for v in cfg.get('sourceAnomalies',{}).values()]
    for table in [*standings,*finals]:
        unknown=[str(m[0]) for m in table.get('maps',[]) if not m[1]]
        if unknown:report['warnings'].append(table['title']+': mapa não informado nas quedas '+', '.join(unknown))
    slot_rules=cfg.get('slotRules') or (([f'group:1-{cfg["advance"]};up;Grande final',f'group:{cfg["advance"]+1}-{len(standings[0]["rows"])};down;Eliminado'] if standings else [])+['final:1;seedup;Campeão'])
    result=dict(schema=1,id=cfg['id'],careerId=cfg['careerId'],name=cfg['name'],year=cfg['year'],startDate=start,endDate=end,tier='S',region='MUNDIAL',status='OFICIAL',family='MUNDIAL',organizer=clean(a.get('organizer','Garena')),
        logo='ffws-global-2026/Free_Fire_World_Series_2021_icon_allmode.png',format=cfg['format'],location=cfg['location'],teams=dict(type='teams',source='liquipedia-text',items=[t for t in items if t['entryStage']!='withdrawn']),withdrawnTeams=[t for t in items if t['entryStage']=='withdrawn'],
        slotRules=slot_rules,standings=standings,final=finals[0],awards=awards,aliases={k:v for k,v in cfg.get('teamAliases',{}).items()},prizePool=dict(type='teamPrizePool',currency='USD',title='Premiação por equipe',cols=['pos','teamOriginal','team','prize','status'],rows=prizes),
        prizeTotal=integer(a.get('prizepoolusd','').replace(',','')),source=dict(url=cfg['sourceUrl'],file='imports/liquipedia-worlds/sources/'+cfg['file'],sha256=report['sha256']),dataNotes=cfg.get('dataNotes',[])+prize_note+['Estatísticas individuais completas não constam no arquivo enviado.'],pilot=True)
    if cfg.get('knockoutList'):result['standingsLabel']='Knockout'
    if headstart:result['headstart']=headstart
    if cs_templates:
        result['clashSquad']=compile_clash(cs_templates,resolve,report)
        week=next(t for t in standings if t['stageId']=='knockout-week1')
        assert {r[2] for r in week['rows'][:8]}=={r['team'] for r in result['clashSquad']['swiss']},'Participantes CS divergem das vagas da semana 1'
    if unresolved:raise ValueError('Aliases de equipes não revisados: '+', '.join(sorted(unresolved)))
    return result,report

def build():
    events=read(BASE/'manifest.json')['events'];out={};reports=[]
    for cfg in events:
        event,report=compile_event(cfg);out['novos-torneios/'+event['id']+'.json']=packed(event);reports.append(report)
    out['imports/liquipedia-worlds/report.json']=json.dumps(dict(batch=read(BASE/'manifest.json')['batch'],imported=len(events),reports=reports),ensure_ascii=False,indent=2)+'\n'
    return out
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--check',action='store_true');a=p.parse_args();files=build()
    for path,content in files.items():
        dest=ROOT/path
        if a.check:
            if not dest.exists() or dest.read_text()!=content:raise SystemExit('Dados desatualizados: '+path)
        else:dest.parent.mkdir(parents=True,exist_ok=True);dest.write_text(content)
    print(f'{len(files)-1} mundiais; {sum(len(v.encode()) for v in files.values())} bytes; zero rede/banco')
