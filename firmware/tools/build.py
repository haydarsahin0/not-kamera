"""Reproducible local build. Install dependencies listed in firmware/README.md first."""
import hashlib,json,os,pathlib,subprocess,sys
root=pathlib.Path(__file__).resolve().parents[2]
fw=root/'firmware'
out=root/'web'/'install'
build=fw/'build'
cli=os.environ.get('ARDUINO_CLI','arduino-cli')
subprocess.run([sys.executable,str(fw/'tools'/'prepare_driver.py')],check=True)
subprocess.run([sys.executable,str(fw/'tools'/'prepare_ui.py')],check=True)
fqbn='esp32:esp32:esp32s3:FlashSize=8M,PSRAM=opi,PartitionScheme=default_8MB,USBMode=hwcdc,CDCOnBoot=cdc'
subprocess.run([cli,'compile','--fqbn',fqbn,'--build-path',str(build),str(fw/'NotEkran')],check=True)
# Arduino's merged image is padded to 8 MB. Keep all boot/partition/application
# bytes, omit only padding beyond the complete application image.
app=(build/'NotEkran.ino.bin').read_bytes()
merged=(build/'NotEkran.ino.merged.bin').read_bytes()
end=0x10000+len(app)
assert merged[0x10000:end]==app
out.mkdir(parents=True,exist_ok=True)
blob=merged[:end]
(out/'not-ekran-v2.bin').write_bytes(blob)
meta={'version':'0.2.0','board':'Waveshare ESP32-S3-ePaper-1.54 V2','arduino_esp32':'3.3.0','gfx':'1.12.1','bytes':len(blob),'sha256':hashlib.sha256(blob).hexdigest(),'hardware_tested':False}
(out/'build-info.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta,indent=2))
