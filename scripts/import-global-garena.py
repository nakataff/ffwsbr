#!/usr/bin/env python3
"""Validate a Garena World Finals phase-one workbook. Preview unless --write."""
import argparse
import collections
import json
from pathlib import Path
import re
import unicodedata

from openpyxl import load_workbook

BASE = Path(__file__).resolve().parents[1] / 'ffws-global-2026'
STAGE = 'classificatoria'
TEAM_CODES = {'PE': 'p-esports', 'PRT': 'pe', 'STG': 'stellar-esport', 'TW': 'total-winner-esports'}
ALIASES = dict(line.split() for line in """
GD.RUSHHRLQ gundynasty-rushfxp
GOW.PICIUU gow-piciu
INF.MIKEY09 team-inf-mikey
INF.RUSTY07 team-inf-rusty
LOS.RIGBY245 los-rigby
LOUD.BZP loud-bzp10
LOUD.GUAXA loud-guaxa7
LOUD.NICKZ loud-nickz7
LYON.DELLA lyon-soydella
LYON.HAAXSZ lyon-haax
ONIC.PUTRA onic-putraxx
PRT.FLAMEX77 pe-flamex
RES.DAAFIQ20 resurrection-esports-daafiq
RES.SIDAK07 resurrection-esports-sidak
RES.ZIYAN21 resurrection-esports-ziyan
RRQ.MAAL77 rrq-maal
STG.LOTEXBAU stellar-esport-lotex
TAG.KDGOD tag-kd
TAG.SAHIL7 tag-sahil
TAG.SHOTO17 tag-shoto
TSG.ARJUN tsg-pros-arjunn
TSG.SOMI17 tsg-pros-somi
XP.LBEHJAAA xprojekt-lbehja
XP.POOKIX xprojekt-pokiix
XP.SKYITOO xprojekt-skyito
""".strip().splitlines())
MAPS = {'PURGATORY': 'Purgatório', 'BERMUDA': 'Bermuda', 'KALAHARI': 'Kalahari',
        'NEXTERRA': 'Nova Terra', 'SOLARA': 'Solara'}


def norm(value):
    return re.sub(r'[^a-z0-9]', '', unicodedata.normalize('NFKD', str(value or '')).lower())


def read(name):
    return json.loads((BASE / (name + '.json')).read_text())


def integer(value):
    if not isinstance(value, (int, float)) or value < 0 or int(value) != value:
        raise ValueError(f'Número inválido: {value!r}')
    return int(value)


def import_sheet(sheet, rounds, groups, teams, roster, identities, stage=STAGE,
                 expected_teams=None, allow_missing_damage=False):
    teams_by_name = {norm(t['name']): t for t in teams}
    codes = {t['abbreviation'].upper(): t['id'] for t in teams} | TEAM_CODES
    aliases = collections.defaultdict(set)
    for p in roster.values():
        t = teams_by_name[norm(p['team'])]
        identity = identities[p['id']]
        for name in [p['name'], *identity.get('aliases', []), *p.get('aliases', [])]:
            aliases[t['id'], norm(name)].add(p['id'])
    blocks = collections.defaultdict(list)
    drop = None
    rows = iter(sheet.values)
    headers = [norm(value) for value in next(rows, ())]
    fields = ('teamname', 'rankingplacement', 'booyah', 'rankingscore', 'killingscore',
              'map', 'playername', 'totalkill', 'kills', 'assists', 'damage')
    invalid = [field for field in fields if headers.count(field) != 1]
    if invalid:
        raise ValueError(f'{sheet.title}: colunas ausentes ou duplicadas: {", ".join(invalid)}')
    columns = {field: headers.index(field) for field in fields}
    for values in rows:
        row = {field: values[i] if i < len(values) else None for field, i in columns.items()}
        if all(norm(row[field]) == field for field in fields):
            continue
        if re.fullmatch(r'R\d+', str(row['teamname'])) and not row['playername']:
            drop = int(row['teamname'][1:])
            if drop in blocks:
                raise ValueError(f'{sheet.title}: marcador R{drop} repetido')
            blocks[drop] = []
        elif drop and row['playername']:
            blocks[drop].append(row)
    expected = sum(r['matches'] for r in rounds)
    if sorted(blocks) != list(range(1, expected + 1)):
        raise ValueError(f'{sheet.title}: esperadas {expected} quedas completas')
    entries, events, offset = [], [], 0
    for round in rounds:
        team_ids = (set(expected_teams) if expected_teams is not None else
                    {tid for group in round['groups'] for tid in groups[group]})
        for n in range(1, round['matches'] + 1):
            drop = offset + n
            meta = dict(day=round['day'], round=round['round'], roundDrop=n, drop=drop, date=round['date'])
            results, used, count, kills, maps = {}, set(), collections.Counter(), collections.Counter(), set()
            for row in blocks[drop]:
                team_id = codes[row['teamname'].strip().upper()]
                nick = row['playername'].strip()
                identity = ALIASES.get(nick.upper())
                candidates = {identity} if identity else aliases[team_id, norm(nick.split('.', 1)[-1])]
                if len(candidates) != 1:
                    raise ValueError(f'{sheet.title} R{drop}: jogador desconhecido ou ambíguo {nick}')
                p = roster[next(iter(candidates))]
                team = teams_by_name[norm(p['team'])]
                if team_id not in team_ids or team['id'] != team_id or p['id'] in used:
                    raise ValueError(f'{sheet.title} R{drop}: jogador/equipe duplicado ou fora da rodada {nick}')
                used.add(p['id'])
                map_name = MAPS[row['map'].strip().upper()]
                maps.add(map_name)
                player_kills = integer(row['kills'])
                count[team_id] += 1
                kills[team_id] += player_kills
                damage = None if allow_missing_damage and row['damage'] is None else integer(row['damage'])
                entries.append(dict(playerId=p['id'], name=p['name'], team=team['name'], stage=stage,
                                    **meta, map=map_name, kills=player_kills, assists=integer(row['assists']), damage=damage))
                if row['rankingplacement'] is not None:
                    if team_id in results:
                        raise ValueError(f'{sheet.title} R{drop}: placar duplicado de {team_id}')
                    pos, booyah, place, team_kills = map(integer, (row['rankingplacement'], row['booyah'],
                                                                   row['rankingscore'], row['killingscore']))
                    if booyah != int(pos == 1) or team_kills != integer(row['totalkill']):
                        raise ValueError(f'{sheet.title} R{drop}: placar inconsistente de {team_id}')
                    results[team_id] = dict(team=team['name'], position=pos, kills=team_kills,
                                            points=place + team_kills, placementPoints=place, booyah=booyah)
            if (set(count) != team_ids or set(results) != team_ids or set(count.values()) != {4}
                    or len(maps) != 1 or sorted(r['position'] for r in results.values()) != list(range(1, 13))
                    or any(r['kills'] != kills[t] for t, r in results.items())):
                raise ValueError(f'{sheet.title} R{drop}: placar, mapas ou abates dos jogadores não conferem')
            events.append(dict(**meta, **{k: round[k] for k in ('session', 'groups') if k in round}, time=round['time'],
                               map=next(iter(maps)), results=list(results.values())))
        offset += round['matches']
    return entries, events


def write(name, payload):
    (BASE / (name + '.json')).write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook')
    parser.add_argument('--week', type=int, help='Importa apenas a semana selecionada, junto com --day')
    parser.add_argument('--day', type=int, help='Importa apenas o dia selecionado, junto com --week')
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    if (args.week is None) != (args.day is None):
        parser.error('--week e --day devem ser informados juntos')
    players, stages = read('players'), read('stages')
    schedule = read('dates')['rounds']
    teams, groups = read('teams')['teams'], read('groups')['groups']
    roster = {p['id']: p for p in players['players'] if p.get('type') != 'staff' and not p.get('left')}
    identities = {p['id']: p for p in read('player-identities')['players']}
    workbook = load_workbook(args.workbook, read_only=True, data_only=True)
    imported = {}
    for sheet in workbook:
        title = re.fullmatch(r'Day (\d+)\s*-\s*Week (\d+)', sheet.title, re.I)
        if not title:
            continue
        day, week = map(int, title.groups())
        if args.week is not None and (week, day) != (args.week, args.day):
            continue
        rounds = [r for r in schedule if r['stage'] == STAGE and r['week'] == week and r['dayInWeek'] == day]
        if not rounds or rounds[0]['date'] in imported:
            raise ValueError(f'Aba fora do calendário ou repetida: {sheet.title}')
        imported[rounds[0]['date']] = import_sheet(sheet, rounds, groups, teams, roster, identities)
    if not imported:
        expected = f'Day {args.day} - Week {args.week}' if args.week is not None else 'Day N - Week N'
        raise ValueError(f'Nenhuma aba {expected} encontrada.')
    phase = stages[STAGE]
    for date, (entries, events) in sorted(imported.items()):
        print(f'{date}: {len(events)} quedas, {len(entries)} participações, {len({p["playerId"] for p in entries})} jogadores')
    if args.write:
        players['entries'] = [e for e in players['entries'] if e['stage'] != STAGE or e.get('date') not in imported]
        players['entries'].extend(p for entries, _ in imported.values() for p in entries)
        players['entries'].sort(key=lambda p: (p.get('date', ''), p.get('drop', 0)))
        phase['rounds'] = [e for e in phase['rounds'] if e.get('date') not in imported]
        phase['rounds'].extend(e for _, events in imported.values() for e in events)
        phase['rounds'].sort(key=lambda e: (e.get('date', ''), e.get('drop', 0)))
        players['updatedAt'] = max(players['updatedAt'], max(imported))
        stages['updatedAt'] = max(stages['updatedAt'], max(imported))
        write('players', players)
        write('stages', stages)


if __name__ == '__main__':
    main()
