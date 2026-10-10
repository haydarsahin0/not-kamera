"""Fetch the exact Waveshare reference driver used by the V2 examples.
No guessed panel model. Preserve upstream code; patch allocation and busy timeout.
"""
import hashlib, pathlib, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
REV='aaf395c1bbd86f7c5b7a2f9f0401241ff5c44956'
PATCHED_SHA256={'epaper_driver_bsp.h': '3d98572f3a7addb57c35f8c88b270df57b8a43b2104bf36197cf5ea857b6b858', 'epaper_driver_bsp.cpp': 'c2802112fde4e6c21fc7d72a8d3444f3d523fc229d962015eb0baa4efce14b6b'}
if all((ROOT/'NotEkran'/n).is_file() and hashlib.sha256((ROOT/'NotEkran'/n).read_bytes()).hexdigest()==sha for n,sha in PATCHED_SHA256.items()):
    print('Pinned Waveshare driver verified from cache:', REV)
    raise SystemExit(0)
BASE=f'https://raw.githubusercontent.com/waveshareteam/ESP32-S3-ePaper-1.54/{REV}/02_Example/Arduino/09_LVGL_V8_Test/src/display/'
for name in ('epaper_driver_bsp.h','epaper_driver_bsp.cpp'):
    data=urllib.request.urlopen(BASE+name, timeout=60).read().decode()
    if name.endswith('.cpp'):
        data=data.replace('MALLOC_CAP_SPIRAM','MALLOC_CAP_8BIT')
        old='''    while(gpio_get_level((gpio_num_t)busy) == 1) 
\t{
        vTaskDelay(pdMS_TO_TICKS(5));   //LOW: idle, HIGH: busy
    }'''
        new='''    if (!healthy) return;
    const TickType_t start = xTaskGetTickCount();
    while (gpio_get_level((gpio_num_t)busy) == 1) {
        if (xTaskGetTickCount() - start > pdMS_TO_TICKS(10000)) {
            healthy = false;
            ESP_LOGE(TAG, "EPD BUSY timeout; check V2 board/panel");
            return;
        }
        vTaskDelay(pdMS_TO_TICKS(5));
    }'''
        if old not in data: raise RuntimeError('Upstream busy loop changed')
        data=data.replace(old,new)
    else:
        data=data.replace('public:\n','public:\n    bool healthy = true;\n',1)
    if hashlib.sha256(data.encode()).hexdigest()!=PATCHED_SHA256[name]: raise RuntimeError('Pinned driver checksum mismatch')
    (ROOT/'NotEkran'/name).write_text(data)
print('Waveshare driver prepared:', REV)
