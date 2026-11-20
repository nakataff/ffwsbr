#!/usr/bin/env python3
"""Import one Phase 2 individual sheet; preserve the confirmed team results."""
import argparse
import importlib.util
import hashlib
import json
from pathlib import Path
import subprocess
from types import SimpleNamespace

spec = importlib.util.spec_from_file_location('garena_import', Path(__file__).with_name('import-global-garena.py'))
garena = importlib.util.module_from_spec(spec)
spec.loader.exec_module(garena)


def prepare_sheet(sheet):
    rows = list(sheet.values)
    header = rows[0]
    samples = [row for row in rows[1:] if len(row) > 8 and isinstance(row[8], str) and '.' in row[8]]
    missing_damage = False
    # This supplied export inserts an unlabelled player ID before the nickname
    # and omits DAMAGE. Repair that exact layout, never infer damage from knocks.
    if (garena.norm(header[7]) == 'playername' and samples and
            all(len(row) == 16 and isinstance(row[7], (int, float)) and row[7] >= 10000000 for row in samples)):
        cleaned = []
        for row in rows[1:]:
            if len(row) > 8 and isinstance(row[8], str) and '.' in row[8]:
                row = (*row[:7], *row[8:15], None, row[15])
            cleaned.append(row)
        rows = [header, *cleaned]
        missing_damage = True
    return SimpleNamespace(title=sheet.title, values=rows), missing_damage


def import_day(workbook_path, day, write=False):
    from openpyxl import load_workbook
    stage = 'segundaFase'
    players, stages, dates = (garena.read(k) for k in ('players', 'stages', 'dates'))
    rounds = [r for r in dates['rounds'] if r['stage'] == stage and r['day'] == day]
    if len(rounds) != 1:
        raise ValueError('Dia fora do calendário da Fase 2')
    round = rounds[0]
    code = "const C=require('./js/global-camp-core.js'),m=require('./ffws-global-2026/camp-model.json');process.stdout.write(JSON.stringify(C.entrants(process.argv[1],{},m)));"
    ids = json.loads(subprocess.check_output(['node', '-e', code, round['key']], cwd=garena.BASE.parent))
    teams, groups = garena.read('teams')['teams'], garena.read('groups')['groups']
    roster = {p['id']: p for p in players['players'] if p.get('type') != 'staff' and not p.get('left')}
    identities = {p['id']: p for p in garena.read('player-identities')['players']}
    workbook = load_workbook(workbook_path, read_only=True, data_only=True)
    try:
        title = f'PHASE 2 - DAY {day}'
        if title not in workbook.sheetnames:
            raise ValueError(f'Aba ausente: {title}')
        sheet, missing_damage = prepare_sheet(workbook[title])
        entries, events = garena.import_sheet(sheet, rounds, groups, teams, roster, identities,
                                            stage=stage, expected_teams=ids, allow_missing_damage=missing_damage)
    finally:
        workbook.close()
    # A workbook with stale collective scores cannot silently change qualification.
    known = {e['roundDrop']: e for e in stages[stage]['rounds'] if e['round'] == round['round'] and e['date'] == round['date']}
    for event in events:
        if event['map'] == 'Nova Terra':
            event['map'] = 'Nexterra'
        existing = known.get(event['roundDrop'])
        if not existing:
            raise ValueError('Publique o placar coletivo antes de importar os individuais')
        fields = ('team', 'position', 'kills', 'points', 'placementPoints', 'booyah')
        collect = lambda rows: sorted(tuple(r[k] for k in fields) for r in rows)
        if collect(event['results']) != collect(existing['results']) or event['map'] != existing['map']:
            raise ValueError(f"Placar diferente do fechamento confirmado: Q{event['roundDrop']}")
    for entry in entries:
        if entry['map'] == 'Nova Terra':
            entry['map'] = 'Nexterra'
    print(f"{round['date']}: {len(events)} quedas, {len(ids)} equipes, {len(entries)} participações e {len({e['playerId'] for e in entries})} jogadores conferidos")
    print('Dano: indisponível nesta aba' if missing_damage else 'Dano: presente')
    if write:
        players['entries'] = [e for e in players['entries'] if not (e['stage'] == stage and e.get('date') == round['date'])] + entries
        players['entries'].sort(key=lambda e: (e.get('date', ''), e.get('drop', 0)))
        players['updatedAt'] = max(players['updatedAt'], round['date'])
        players['individualImports'] = [i for i in players.get('individualImports', []) if not (i['stage'] == stage and i['date'] == round['date'])] + [dict(stage=stage, day=day, date=round['date'], sheet=title, rows=len(entries), missingMetrics=['damage'] if missing_damage else [], sha256=hashlib.sha256(Path(workbook_path).read_bytes()).hexdigest())]
        garena.write('players', players)
    return entries


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('workbook')
    parser.add_argument('--day', type=int, required=True)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    import_day(args.workbook, args.day, args.write)
