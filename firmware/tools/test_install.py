"""Check generated release hashes and flash-sector preservation, not just offsets."""
import hashlib, json
from pathlib import Path

root = Path(__file__).resolve().parents[2] / 'web/install'
manifest = json.loads((root / 'manifest.json').read_text())
info = json.loads((root / 'build-info.json').read_text())
assert manifest['version'] == info['version'] == '0.9.1'
assert info['offset'] == 0x10000 and info['hardware_tested'] is False
parts = manifest['builds'][0]['parts']
assert len(parts) == len(info['parts']) == 4
# A combined image at address zero would erase NVS sectors even with eraseAll
# disabled. Replay the sector erases and writes against pre-existing data.
flash = bytearray(b'\xa5' * (8 * 1024 * 1024))
protected = [(0x9000, 0xe000), (0x670000, 0x7f0000)]
before = [bytes(flash[a:b]) for a, b in protected]
for part, expected in zip(parts, info['parts']):
    path, _, query = part['path'].partition('?')
    assert query == 'v='+info['version'] and path == expected['path']
    offset = part['offset']
    data = (root / path).read_bytes()
    assert offset == expected['offset'] and len(data) == expected['bytes']
    assert hashlib.sha256(data).hexdigest() == expected['sha256']
    first = offset // 4096 * 4096
    last = (offset + len(data) + 4095) // 4096 * 4096
    flash[first:last] = b'\xff' * (last - first)
    flash[offset:offset + len(data)] = data
assert all(bytes(flash[a:b]) == saved for (a, b), saved in zip(protected, before))
assert hashlib.sha256((root / 'partitions.bin').read_bytes()).hexdigest() == '1d9cca96de0fe07ad7fc0648b9878ddecd9ce565e38b589ad20fea698ed4c80c'
assert hashlib.sha256((root / 'not-ekran-v2.bin').read_bytes()).hexdigest() == info['sha256']
print('PASS release checksums, unchanged partition table, sector-level NVS/history preservation')
