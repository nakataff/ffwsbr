#!/usr/bin/env python3
"""Small offline catalogue for the shared tournament logo picker. No network."""
import json, re, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
def key(name):
    name = re.sub(r'^(?:WB|FFWS BRASIL)\s+', 'FFWS BR ', name, flags=re.I)
    return re.sub('[^a-z0-9]', '', unicodedata.normalize('NFD', name).encode('ascii', 'ignore').decode().lower())

def build():
    entries = {}
    def add(name, logo='', tier='', alias=''):
        if not name: return
        k = key(name)
        row = entries.setdefault(k, dict(id=k, name=name, aliases=[], logo='', tier=''))
        for value in [name, alias]:
            if value and value != row['name'] and value not in row['aliases']: row['aliases'].append(value)
        if logo and not re.search(r'(trofeu|escudo)\.webp', logo): row['logo'] = logo
        if tier: row['tier'] = tier
    # Legacy titles include small competitions without a full tournament page.
    for file in sorted((ROOT/'team-data/history').glob('*.json')):
        data = json.loads(file.read_text())
        for row in data.get('titles', []): add(row.get('event'), row.get('logo'), row.get('tier'))
        for row in data.get('results', []): add(row.get('torneio'), '', row.get('tier'))
    for file in sorted((ROOT/'team-data/historical').glob('*.json')):
        data = json.loads(file.read_text())
        for row in data.get('collectiveTitles', []): add(row.get('event'), row.get('logo'), row.get('tier'))
    manifest = json.loads((ROOT/'novos-torneios/index.json').read_text())
    for name in manifest['files']:
        data = json.loads((ROOT/'novos-torneios'/name).read_text())
        add(data.get('name'), data.get('logo') or data.get('image'), data.get('tier'), data.get('id'))
    for row in manifest.get('year2026', {}).get('events', []): add(row.get('name'), row.get('logo'), row.get('tier'), row.get('id'))
    return {'version': 1, 'entries': sorted(entries.values(), key=lambda row: row['name'].casefold())}

if __name__ == '__main__':
    import sys
    path = ROOT/'data/tournament-assets.json'
    text = json.dumps(build(), ensure_ascii=False, separators=(',', ':'))+'\n'
    if '--check' in sys.argv:
        assert path.read_text() == text, 'Regenerate: python scripts/build-tournament-assets.py'
    else:
        path.write_text(text)
    print(f'{len(build()["entries"])} competitions · {len(text.encode())} bytes')
