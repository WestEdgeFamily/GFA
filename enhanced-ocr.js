/**
 * Simplified OCR Module for Gluten-Free Scanner
 * Optimized for iOS reliability
 * Updated: 2025-06-05
 */

// Perform OCR with basic settings
async function performBasicOCR(image) {
    try {
        if (typeof logDebug === 'function') {
            logDebug('Starting basic OCR');
        }
        
        // Use simple configuration for better reliability
        const result = await Tesseract.recognize(image, {
            lang: 'eng',
            langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/lang-data',
            logger: progress => {
                if (progress.status === 'recognizing text') {
                    const progressBar = document.getElementById('ocrProgress');
                    const progressText = document.getElementById('ocrProgressText');
                    if (progressBar && progressText) {
                        const percent = Math.round(progress.progress * 100);
                        const overallPercent = 50 + Math.round(progress.progress * 40);
                        progressBar.style.width = overallPercent + '%';
                        progressText.textContent = `Extracting text: ${percent}% complete`;
                    }
                    
                    if (typeof logDebug === 'function' && (progress.progress === 0 || progress.progress === 1 || progress.progress % 0.2 < 0.01)) {
                        logDebug(`OCR progress: ${Math.round(progress.progress * 100)}%`);
                    }
                }
            }
        });
        
        return {
            text: cleanExtractedText(result.data.text),
            confidence: result.data.confidence
        };
    } catch (error) {
        if (typeof logDebug === 'function') {
            logDebug(`Error in OCR: ${error.message}`);
        }
        throw error;
    }
}

// Simple text cleaning without complex processing
function cleanExtractedText(text) {
    if (!text) return "";
    
    // Extract just the ingredients section if possible
    let cleaned = text;
    const ingredientsMatch = cleaned.match(/ingredients[\s\:\.]+(.*)/i);
    if (ingredientsMatch && ingredientsMatch[1]) {
        cleaned = "INGREDIENTS: " + ingredientsMatch[1].trim();
    }
    
    // Fix common OCR errors
    cleaned = cleaned
        .replace(/c0rn/gi, 'corn')
        .replace(/\bfiour\b/gi, 'flour')
        .replace(/\boll\b/gi, 'oil')
        .replace(/\bsall\b/gi, 'salt')
        .replace(/\bwater\,/gi, 'water,')
        .replace(/\bsugar\,/gi, 'sugar,')
        .replace(/\,\s*\,/g, ',')
        .replace(/\.\s*\./g, '.')
        .replace(/lngredients/gi, 'Ingredients')
        .replace(/\bcontams\b/gi, 'contains')
        .replace(/\ballergems\b/gi, 'allergens')
        .replace(/g1uten/gi, 'gluten')
        .replace(/([a-z]),([a-z])/gi, '$1, $2') // Add space after commas
        .trim();
    
    return cleaned;
}

// Format ingredients text
function enhanceIngredientText(text) {
    if (!text) return text;
    
    let formatted = text;
    
    // Extract ingredients prefix
    const ingredientsMatch = formatted.match(/^(ingredients|ingred)[\s\:\.]+(.*)/i);
    if (ingredientsMatch) {
        formatted = "INGREDIENTS: " + ingredientsMatch[2];
    }
    
    // Fix common mistakes
    formatted = formatted
        .replace(/\,\s*\,/g, ',')
        .replace(/\.\s*\./g, '.')
        .replace(/\s+/g, ' ')
        .replace(/([a-z])\,([a-z])/gi, '$1, $2');
    
    return formatted.trim();
}

// Detect ingredients section in a simplified way
async function detectIngredientsSection(image) {
    if (typeof logDebug === 'function') {
        logDebug("Using simplified ingredients section detection");
    }
    
    // Return a default region in the middle-bottom of the image
    // This is simple but reliable
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    
    return {
        x: 0,
        y: Math.floor(height * 0.6),  // Start 60% down the image
        width: width,
        height: Math.floor(height * 0.3)  // Take 30% of the image height
    };
}

// Simple wrapper function for the main OCR functionality
async function enhanceAndRecognizeText(imageElement) {
    if (typeof logDebug === 'function') {
        logDebug('Starting simplified OCR process');
    }
    
    try {
        // Create a smaller version if needed
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 1000; // Smaller for better performance
        
        let width = imageElement.naturalWidth || imageElement.width;
        let height = imageElement.naturalHeight || imageElement.height;
        let scale = 1;
        
        if (width > MAX_SIZE || height > MAX_SIZE) {
            scale = Math.min(MAX_SIZE / width, MAX_SIZE / height);
            width = Math.floor(width * scale);
            height = Math.floor(height * scale);
            
            if (typeof logDebug === 'function') {
                logDebug(`Scaling image for OCR: ${width}x${height}`);
            }
        }
        
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(imageElement, 0, 0, width, height);
        
        // Just do basic OCR - no fancy preprocessing
        const result = await performBasicOCR(canvas);
        
        // Clean up canvas
        ctx.clearRect(0, 0, width, height);
        
        if (typeof logDebug === 'function') {
            logDebug('OCR completed successfully');
        }
        
        return result;
    } catch (error) {
        if (typeof logDebug === 'function') {
            logDebug(`Error in enhanceAndRecognizeText: ${error.message}`);
        }
        throw error;
    }
}

// Backward compatibility for the more complex functions
async function performFoodLabelOCR(imageElement) {
    // Just use the basic OCR instead
    return enhanceAndRecognizeText(imageElement);
}

// Simplified food label detection
async function detectIfFoodLabel() {
    // Always return true to simplify processing
    return true;
}

// Make functions available globally
window.enhanceAndRecognizeText = enhanceAndRecognizeText;
window.performFoodLabelOCR = performFoodLabelOCR;
window.enhanceIngredientText = enhanceIngredientText;
window.detectIfFoodLabel = detectIfFoodLabel;
window.detectIngredientsSection = detectIngredientsSection;
