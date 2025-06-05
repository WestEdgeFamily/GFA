/**
 * Server-side OCR module for the Gluten-Free App
 */

// Function to send image to the server for OCR processing
async function performServerOCR(imageElement) {
    try {
        console.log("Starting server OCR process");
        
        // Show loading UI
        document.getElementById('scanningMessage').style.display = 'block';
        document.getElementById('ocrProgressText').textContent = 'Processing image on server...';
        document.getElementById('ocrProgress').style.width = '50%';
        
        // Create a canvas to get the image data
        const canvas = document.createElement('canvas');
        
        // Get image dimensions
        let imgWidth = imageElement.naturalWidth || imageElement.width;
        let imgHeight = imageElement.naturalHeight || imageElement.height;
        
        // Limit canvas size for efficiency
        const MAX_SIZE = 1200;
        if (imgWidth > MAX_SIZE || imgHeight > MAX_SIZE) {
            const scale = Math.min(MAX_SIZE / imgWidth, MAX_SIZE / imgHeight);
            imgWidth = Math.floor(imgWidth * scale);
            imgHeight = Math.floor(imgHeight * scale);
        }
        
        canvas.width = imgWidth;
        canvas.height = imgHeight;
        
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageElement, 0, 0, imgWidth, imgHeight);
        
        // Get base64 image with reduced quality for faster upload
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);
        
        console.log(`Image prepared for server upload: ${imgWidth}x${imgHeight}`);
        
        // Send to server
        const response = await fetch('/api/ocr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image: base64Image }),
        });
        
        // Parse result
        const result = await response.json();
        
        // Hide loading UI
        document.getElementById('scanningMessage').style.display = 'none';
        
        if (!result.success) {
            throw new Error(result.error || 'Server error processing image');
        }
        
        console.log("Server OCR completed successfully");
        
        return {
            text: result.text,
            confidence: result.confidence
        };
        
    } catch (error) {
        console.error("Server OCR error:", error);
        
        // Hide loading UI
        document.getElementById('scanningMessage').style.display = 'none';
        
        throw error;
    }
}

// Check server status
async function checkOcrServerStatus() {
    try {
        const response = await fetch('/health');
        if (response.ok) {
            const statusElement = document.getElementById('serverStatus');
            if (statusElement) {
                statusElement.className = 'server-status online';
                statusElement.innerHTML = '<i class="fas fa-circle"></i> OCR Server Online';
            }
            console.log("OCR server is online");
            return true;
        }
    } catch (error) {
        console.log(`Server status check failed: ${error.message}`);
    }
    
    const statusElement = document.getElementById('serverStatus');
    if (statusElement) {
        statusElement.className = 'server-status offline';
        statusElement.innerHTML = '<i class="fas fa-circle"></i> OCR Server Offline';
    }
    return false;
}

// Make functions available globally
window.performServerOCR = performServerOCR;
window.checkOcrServerStatus = checkOcrServerStatus;
