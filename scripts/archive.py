#!/usr/bin/env python3
"""Create a portable, allowlisted source archive without credentials or dependencies."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / 'AK47-Interactive-Atlas.zip'
DIRECTORIES = ('src', 'public', 'docs', 'scripts', 'tests', '.github')
FILES = (
    'README.md', 'package.json', 'package-lock.json', 'index.html', '.gitignore', '.nvmrc',
    'tsconfig.json', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts',
    'eslint.config.js', 'vercel.json',
)
files = [ROOT / name for name in FILES if (ROOT / name).is_file()]
for folder in DIRECTORIES:
    files.extend(p for p in (ROOT / folder).rglob('*') if p.is_file() and not p.is_symlink()
                 and not any(part in ('__pycache__', 'node_modules', '.git', '.cache') for part in p.parts)
                 and not p.name.startswith('.env') and p.suffix not in ('.pyc', '.zip', '.log'))
with ZipFile(OUTPUT, 'w', ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(files):
        archive.write(path, Path('AK47-Interactive-Atlas') / path.relative_to(ROOT))
with ZipFile(OUTPUT) as archive:
    assert archive.testzip() is None
    assert 'AK47-Interactive-Atlas/src/geometry/createAtlasModel.ts' in archive.namelist()
    assert not any('/node_modules/' in n or '/.git/' in n or '/.env' in n for n in archive.namelist())
print(f'{OUTPUT.name}: {len(files)} files, {OUTPUT.stat().st_size:,} bytes; integrity verified')
