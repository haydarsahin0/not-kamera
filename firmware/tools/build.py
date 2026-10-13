"""Reproducible local build. Install dependencies listed in firmware/README.md first."""
import hashlib,json,os,pathlib,re,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[2]
fw=root/'firmware'
out=root/'web'/'install'
build=fw/'build'
cli=os.environ.get('ARDUINO_CLI','arduino-cli')
version=re.search(r'FIRMWARE_VERSION="([0-9.]+)"',(fw/'NotEkran/firmware_version.h').read_text()).group(1)
subprocess.run([sys.executable,str(fw/'tools'/'prepare_driver.py')],check=True)
subprocess.run([sys.executable,str(fw/'tools'/'prepare_ui.py')],check=True)
fqbn='esp32:esp32:esp32s3:FlashSize=8M,PSRAM=opi,PartitionScheme=default_8MB,USBMode=hwcdc,CDCOnBoot=cdc'
subprocess.run([cli,'compile','--fqbn',fqbn,'--build-path',str(build),str(fw/'NotEkran')],check=True)
# Flash parts separately: a merged image spans and erases NVS even when
# eraseAll is false. Keep the same partition table and omit NVS/LittleFS ranges.
app=(build/'NotEkran.ino.bin').read_bytes()
merged=(build/'NotEkran.ino.merged.bin').read_bytes()
assert merged[0x10000:0x10000+len(app)]==app
parts=[('bootloader.bin',0,(build/'NotEkran.ino.bootloader.bin').read_bytes()),
       ('partitions.bin',0x8000,(build/'NotEkran.ino.partitions.bin').read_bytes()),
       ('boot-app0.bin',0xe000,merged[0xe000:0x10000]),
       ('not-ekran-v2.bin',0x10000,app)]
out.mkdir(parents=True,exist_ok=True)
metadata=[]
for name,offset,blob in parts:
    erase_start=offset//4096*4096
    erase_end=(offset+len(blob)+4095)//4096*4096
    for start,end in [(0x9000,0xe000),(0x670000,0x7f0000)]:
        assert erase_end<=start or erase_start>=end,'Protected data would be erased'
    (out/name).write_bytes(blob)
    metadata.append({'path':name,'offset':offset,'bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest()})
manifest={'name':'Not Ekran V2','version':version,'new_install_prompt_erase':False,'new_install_improv_wait_time':0,
          'builds':[{'chipFamily':'ESP32-S3','improv':False,'parts':[{'path':p['path']+'?v='+version,'offset':p['offset']} for p in metadata]}]}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
meta={'version':version,'board':'Waveshare ESP32-S3-ePaper-1.54 V2','arduino_esp32':'3.3.0','gfx':'1.12.1',
      'bytes':len(app),'sha256':hashlib.sha256(app).hexdigest(),'offset':65536,'parts':metadata,'hardware_tested':False}
(out/'build-info.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta,indent=2))
