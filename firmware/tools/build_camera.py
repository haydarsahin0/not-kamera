"""Build the XIAO camera separately. Never changes NotEkran binaries."""
import hashlib,json,os,pathlib,subprocess,zipfile
root=pathlib.Path(__file__).resolve().parents[2]
sketch=root/'firmware/NotCamera';build=root/'firmware/camera-build';out=root/'web/camera-install'
version='0.1.7';cli=os.environ.get('ARDUINO_CLI','arduino-cli')
(sketch/'cloud_roots.h').write_bytes((root/'firmware/NotEkran/cloud_roots.h').read_bytes())
fqbn='esp32:esp32:XIAO_ESP32S3:PSRAM=opi,FlashSize=8M,PartitionScheme=default_8MB,USBMode=hwcdc,CDCOnBoot=default'
# XIAO_ESP32S3 menu: CDCOnBoot=default is "Enabled" (Serial on USB); CDCOnBoot=cdc is "Disabled" (Serial on UART pins).
subprocess.run([cli,'compile','--fqbn',fqbn,'--build-path',str(build),str(sketch)],check=True)
app=(build/'NotCamera.ino.bin').read_bytes();merged=(build/'NotCamera.ino.merged.bin').read_bytes()
assert merged[0x10000:0x10000+len(app)]==app
parts=[('bootloader.bin',0,(build/'NotCamera.ino.bootloader.bin').read_bytes()),('partitions.bin',0x8000,(build/'NotCamera.ino.partitions.bin').read_bytes()),('boot-app0.bin',0xe000,merged[0xe000:0x10000]),('not-camera.bin',0x10000,app)]
out.mkdir(parents=True,exist_ok=True);meta=[]
for name,offset,data in parts:
    start=offset//4096*4096;end=(offset+len(data)+4095)//4096*4096
    assert end<=0x9000 or start>=0xe000,'Flash operation would erase NVS settings'
    (out/name).write_bytes(data);meta.append(dict(path=name,offset=offset,bytes=len(data),sha256=hashlib.sha256(data).hexdigest()))
manifest=dict(name='NotCamera XIAO Sense',version=version,new_install_prompt_erase=False,new_install_improv_wait_time=0,builds=[dict(chipFamily='ESP32-S3',improv=False,parts=[dict(path=p['path']+'?v='+version,offset=p['offset']) for p in meta])])
info=dict(version=version,board='Seeed Studio XIAO ESP32-S3 Sense (8MB Flash/8MB OPI PSRAM)',sensor='OV2640 1600x1200, OV3660 2048x1536 or OV5640 2592x1944 JPEG (largest size detected)',arduino_esp32='3.3.0',fqbn=fqbn,parts=meta,hardware_tested=False)
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');(out/'build-info.json').write_text(json.dumps(info,indent=2)+'\n')
with zipfile.ZipFile(build/f'not-camera-{version}.zip','w',zipfile.ZIP_DEFLATED) as z:
    for p in sorted(sketch.glob('*')):
        if p.is_file():z.write(p,'NotCamera/'+p.name)
    z.write(root/'firmware/CAMERA_README.md','README.md')
    for p in meta:z.write(out/p['path'],'flash/'+p['path'])
    z.write(out/'build-info.json','flash/build-info.json');z.write(out/'manifest.json','flash/manifest.json')
print(json.dumps(info,indent=2))
