import hashlib,json,pathlib,zipfile
root=pathlib.Path(__file__).resolve().parents[2];out=root/'web/camera-install'
info=json.loads((out/'build-info.json').read_text());manifest=json.loads((out/'manifest.json').read_text())
assert info['version']==manifest['version']=='0.1.7'
assert info['hardware_tested'] is False
assert 'XIAO_ESP32S3' in info['fqbn'] and 'PSRAM=opi' in info['fqbn']
# On XIAO_ESP32S3 only CDCOnBoot=default puts Serial (USB setup) on the USB port.
assert 'USBMode=hwcdc' in info['fqbn'] and 'CDCOnBoot=default' in info['fqbn']
assert manifest['new_install_prompt_erase'] is False
assert manifest['builds'][0]['chipFamily']=='ESP32-S3'
expected=[]
for p in info['parts']:
 data=(out/p['path']).read_bytes();assert len(data)==p['bytes'];assert hashlib.sha256(data).hexdigest()==p['sha256']
 erase_start=p['offset']//4096*4096;erase_end=(p['offset']+len(data)+4095)//4096*4096
 for start,end in [(0x9000,0xe000),(0x670000,0x7f0000)]:assert erase_end<=start or erase_start>=end
 expected.append(dict(path=p['path']+'?v=0.1.7',offset=p['offset']))
assert expected==manifest['builds'][0]['parts']
assert (out/'not-camera.bin').read_bytes()!=(root/'web/install/not-ekran-v2.bin').read_bytes()
with zipfile.ZipFile(root/'firmware/camera-build/not-camera-0.1.7.zip') as z:
 assert z.testzip() is None
 for p in info['parts']:assert z.read('flash/'+p['path'])==(out/p['path']).read_bytes()
 for p in (root/'firmware/NotCamera').iterdir():
  if p.is_file():assert z.read('NotCamera/'+p.name)==p.read_bytes()
 assert z.read('README.md')==(root/'firmware/CAMERA_README.md').read_bytes()
 print('PASS real XIAO build, flash hashes/offsets, NVS/history exclusion, complete source+binary zip, separate camera/NotEkran installers')
