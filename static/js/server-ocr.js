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
        canvas.width = imageElement.naturalWidth || imageElement.width;
        canvas.height = imageElement.naturalHeight || imageElement.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageElement, 0, 0);
        
        // Get base64 image with reduced quality for faster upload
        const base64Image = canvas.toDataURL('image/jpeg', 0.7);
        
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

// Make the function available globally
window.performServerOCR = performServerOCR;
