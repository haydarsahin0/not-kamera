"""Fetch the exact Waveshare reference driver used by the V2 examples.
No guessed panel model. Preserve upstream code; patch allocation and busy timeout.
"""
import pathlib, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[1]
REV='aaf395c1bbd86f7c5b7a2f9f0401241ff5c44956'
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
    (ROOT/'NotEkran'/name).write_text(data)
print('Waveshare driver prepared:', REV)
