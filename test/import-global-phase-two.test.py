import copy
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('phase_two_import', ROOT / 'scripts/import-global-phase-two.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
fixture = json.loads((ROOT / 'test/fixtures/global-phase2-layout.json').read_text())
g = module.garena
teams = g.read('teams')['teams']
roster = {p['id']: p for p in g.read('players')['players'] if p.get('type') != 'staff' and not p.get('left')}
identities = {p['id']: p for p in g.read('player-identities')['players']}
round = next(r for r in g.read('dates')['rounds'] if r['key'] == 'segundaFase-1') | {'matches': 1}


def parse(values):
    sheet, missing = module.prepare_sheet(SimpleNamespace(title=fixture['title'], values=values))
    return g.import_sheet(sheet, [round], {}, teams, roster, identities,
                          stage='segundaFase', expected_teams=round['seededTeams'], allow_missing_damage=missing)


class PhaseTwoLayout(unittest.TestCase):
    def test_unlabelled_id_and_absent_damage_do_not_shift_kills_or_assists(self):
        entries, events = parse(fixture['values'])
        self.assertEqual(len(entries), 48)
        self.assertTrue(all(e['damage'] is None for e in entries))
        player = next(e for e in entries if e['playerId'] == 'onic-putraxx')
        self.assertEqual((player['kills'], player['assists']), (4, 6))
        self.assertEqual(sum(e['kills'] for e in entries if e['team'] == 'ONIC'), 18)
        self.assertEqual(len(events[0]['results']), 12)
        self.assertTrue(any(e['kills'] == 0 for e in entries))

    def test_reserve_alias_stays_in_xprojekt_without_creating_a_duplicate_player(self):
        values = copy.deepcopy(fixture['values'])
        row = next(row for row in values if len(row) > 8 and row[8] == 'XP.Z4CK')
        row[8] = 'XP.PERUU'
        entries, _ = parse(values)
        reserve = next(entry for entry in entries if entry['playerId'] == 'xprojekt-peruvi')
        self.assertEqual(reserve['team'], 'xProjekt')
        self.assertEqual(reserve['name'], 'PERUVI')
        self.assertEqual(len({entry['playerId'] for entry in entries}), 48)

    def test_a_changed_player_kill_total_is_rejected(self):
        values = copy.deepcopy(fixture['values'])
        values[2][10] += 1
        with self.assertRaisesRegex(ValueError, 'não conferem'):
            parse(values)

    def test_a_missing_player_cannot_be_imported_as_a_complete_drop(self):
        with self.assertRaisesRegex(ValueError, 'não conferem'):
            parse(fixture['values'][:-1])


if __name__ == '__main__':
    unittest.main()
