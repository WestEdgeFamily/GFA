/**
 * Minimal OCR Module for Gluten-Free Scanner
 * Optimized for reliability over quality
 * Updated: 2025-06-05
 */

// Global debug logger
function safeLogDebug(message) {
    if (typeof window.logDebug === 'function') {
        window.logDebug(message);
    } else {
        console.log(message);
    }
}

// Basic OCR function - no preprocessing, no enhancement, just direct recognition
async function performBasicOCR(imageElement) {
    safeLogDebug("Starting basic OCR");
    
    try {
        // Use minimal configuration with lower quality for better performance
        const result = await Tesseract.recognize(imageElement, {
            lang: 'eng',
            langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/lang-data',
            logger: progress => {
                if (progress.status === 'recognizing text') {
                    const progressBar = document.getElementById('ocrProgress');
                    const progressText = document.getElementById('ocrProgressText');
                    if (progressBar && progressText) {
                        progressBar.style.width = (50 + progress.progress * 50) + '%';
                        progressText.textContent = `Reading text: ${Math.round(progress.progress * 100)}%`;
                    }
                }
            }
        });
        
        safeLogDebug(`OCR completed with confidence: ${result.data.confidence}`);
        
        // Process text with minimal cleanup
        return {
            text: cleanBasicText(result.data.text),
            confidence: result.data.confidence
        };
    } catch (error) {
        safeLogDebug(`OCR error: ${error.message}`);
        throw error;
    }
}

// Ultra-simple text cleaning
function cleanBasicText(text) {
    if (!text) return "";
    
    // Just do very basic cleaning
    return text
        .replace(/([a-z]),([a-z])/gi, '$1, $2')  // Add space after commas
        .trim();
}

// Format ingredients text
function enhanceIngredientText(text) {
    return cleanBasicText(text);
}

// Dummy function that just returns a common area
function detectIngredientsSection(image) {
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    
    return {
        x: 0,
        y: Math.floor(height * 0.5),  // Start halfway down the image
        width: width,
        height: Math.floor(height * 0.5)  // Take half the image height
    };
}

// Simple function to detect if food label
function detectIfFoodLabel() {
    // Just return true
    return Promise.resolve(true);
}

// Main function for text recognition
async function enhanceAndRecognizeText(imageElement) {
    safeLogDebug("Starting OCR with minimal processing");
    
    try {
        // Just pass directly to basic OCR
        return await performBasicOCR(imageElement);
    } catch (error) {
        safeLogDebug(`Error in enhanceAndRecognizeText: ${error.message}`);
        throw error;
    }
}

// Food label OCR - just use basic OCR
async function performFoodLabelOCR(imageElement) {
    return enhanceAndRecognizeText(imageElement);
}

// Make functions available globally
window.enhanceAndRecognizeText = enhanceAndRecognizeText;
window.performFoodLabelOCR = performFoodLabelOCR;
window.enhanceIngredientText = enhanceIngredientText;
window.detectIfFoodLabel = detectIfFoodLabel;
window.detectIngredientsSection = detectIngredientsSection;
