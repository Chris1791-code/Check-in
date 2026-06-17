import re

with open('app.v1.2.7.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the Quagga interval block and replace it
new_block = """                window.quaggaLiveInterval = setInterval(() => {
                    if (isProcessing) return; // Don't scan if app is busy checking in
                    const videoEl = document.querySelector("#qr-reader video");
                    if (!videoEl || videoEl.paused || videoEl.ended) return;
                    
                    let w = videoEl.videoWidth;
                    let h = videoEl.videoHeight;
                    if (w === 0 || h === 0) return;
                    
                    // Crop the center 90% width and 60% height (more forgiving aim)
                    let cropW = Math.floor(w * 0.9);
                    let cropH = Math.floor(h * 0.6);
                    let cropX = Math.floor((w - cropW) / 2);
                    let cropY = Math.floor((h - cropH) / 2);
                    
                    let targetW = cropW;
                    if (targetW > 1200) {
                        let scale = 1200 / targetW;
                        targetW = 1200;
                        cropH = Math.floor(cropH * scale);
                    }
                    
                    canvas.width = targetW;
                    canvas.height = cropH;
                    
                    // Boost contrast and grayscale for better 1D barcode detection on bad cameras
                    ctx.filter = "contrast(150%) brightness(110%) grayscale(100%)";
                    ctx.drawImage(videoEl, cropX, cropY, cropW, Math.floor(cropH * (cropW/targetW)), 0, 0, targetW, cropH);
                    
                    Quagga.decodeSingle({
                        src: canvas.toDataURL("image/jpeg", 0.9),
                        numOfWorkers: 0,
                        inputStream: { size: targetW },
                        decoder: {
                            readers: [
                                "code_128_reader", "code_39_reader", "code_93_reader",
                                "ean_reader", "ean_8_reader", "upc_reader", "upc_e_reader", "i2of5_reader"
                            ]
                        },
                        locate: true
                    }, function(result) {
                        if (result && result.codeResult && result.codeResult.code) {
                            if (!isProcessing) { // Double check
                                console.log("DUAL-ENGINE Quagga2 found barcode:", result.codeResult.code);
                                handleCheckIn(result.codeResult.code);
                            }
                        }
                    });
                }, 200); // Process every 200ms (5 FPS) for lightning fast scanning"""

content = re.sub(r'window\.quaggaLiveInterval = setInterval\(\(\) => \{.*?(?= \}\);\\n                \}, 800\); // Process every 800ms to save CPU)', new_block, content, flags=re.DOTALL)
content = content.replace('}, 800); // Process every 800ms to save CPU', '')

with open('app.v1.2.7.js', 'w', encoding='utf-8') as f:
    f.write(content)
