"""Embed the self-contained camera interface in the ESP32 firmware."""
from pathlib import Path
root=Path(__file__).resolve().parents[1]
html=(root/'ui'/'camera.html').read_text()
script=(root/'ui'/'camera.js').read_text()
assert '</script' not in script.lower()
html=html.replace('__SCRIPT__',script)
assert html.count('__CSRF__')==1 and ')CAMERA_UI"' not in html
(root/'NotEkran'/'camera_page.h').write_text('#pragma once\n#include <Arduino.h>\nstatic const char CAMERA_PAGE[] PROGMEM = R"CAMERA_UI('+html+')CAMERA_UI";\n')
print('Camera interface embedded')
