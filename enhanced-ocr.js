/**
 * Enhanced OCR Module for Gluten-Free Scanner
 * Provides advanced text recognition optimized for ingredient lists
 */

// Perform OCR with settings optimized for ingredient lists
async function performOCR(image, options) {
    // First, let's optimize the default settings for ingredient lists
    const defaultOptions = {
        lang: 'eng',
        langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/lang-data',
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.():-%;/* ',
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: '6', // Assume a single uniform block of text
        tessjs_create_box: '0',
        tessjs_create_unlv: '0',
        tessjs_create_osd: '0',
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    
    // Add logging for progress tracking
    finalOptions.logger = progress => {
        if (progress.status === 'recognizing text') {
            const progressBar = document.getElementById('ocrProgress');
            const progressText = document.getElementById('ocrProgressText');
            const percent = Math.round(progress.progress * 100);
            const overallPercent = 50 + Math.round(progress.progress * 30); // Scale to 50-80% of overall process
            progressBar.style.width = overallPercent + '%';
            progressText.textContent = `Extracting text: ${percent}% complete`;
        }
    };
    
    // Run recognition
    const result = await Tesseract.recognize(image, finalOptions);
    return result.data;
}

// Enhanced image preprocessing for better OCR results
async function preprocessImage(src) {
    // Create image and canvas elements
    const getImageData = async (source) => {
        // Handle both Image elements and canvas elements
        if(source.tagName === 'IMG' || source.tagName === 'CANVAS') {
            // For canvas element
            if(source.tagName === 'CANVAS') {
                const ctx = source.getContext('2d');
                return {
                    imageData: ctx.getImageData(0, 0, source.width, source.height),
                    width: source.width,
                    height: source.height,
                    canvas: source
                };
            } 
            // For IMG element
            else {
                await new Promise(resolve => {
                    if(source.complete) resolve();
                    else source.onload = resolve;
                });
                
                const canvas = document.createElement('canvas');
                canvas.width = source.naturalWidth || source.width;
                canvas.height = source.naturalHeight || source.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(source, 0, 0);
                
                return {
                    imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
                    width: canvas.width,
                    height: canvas.height,
                    canvas: canvas
                };
            }
        } 
        // For URL/data URI string
        else {
            const img = new Image();
            await new Promise(resolve => {
                img.onload = resolve;
                img.src = source;
            });
            
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            
            return {
                imageData: ctx.getImageData(0, 0, canvas.width, canvas.height),
                width: canvas.width,
                height: canvas.height,
                canvas: canvas
            };
        }
    };
    
    // Get image data
    const { imageData, width, height, canvas } = await getImageData(src);
    const ctx = canvas.getContext('2d');
    const data = imageData.data;
    
    // Process the image using multiple techniques and return the best one
    
    // 1. Create a clone of the original image data
    const origData = new Uint8ClampedArray(data);
    
    // 2. Process with adaptive thresholding (better for varied lighting)
    const blockSize = Math.max(5, Math.floor(Math.min(width, height) / 20));
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Calculate local region for adaptive threshold
            const startX = Math.max(0, x - blockSize);
            const startY = Math.max(0, y - blockSize);
            const endX = Math.min(width, x + blockSize);
            const endY = Math.min(height, y + blockSize);
            
            // Calculate local mean
            let sum = 0, count = 0;
            for (let ly = startY; ly < endY; ly++) {
                for (let lx = startX; lx < endX; lx++) {
                    const idx = (ly * width + lx) * 4;
                    const avg = (data[idx] + data[idx+1] + data[idx+2]) / 3;
                    sum += avg;
                    count++;
                }
            }
            const mean = sum / count;
            
            // Apply threshold with slight bias (C value)
            const idx = (y * width + x) * 4;
            const pixelAvg = (data[idx] + data[idx+1] + data[idx+2]) / 3;
            const C = 5; // Threshold bias
            const newValue = pixelAvg < (mean - C) ? 0 : 255;
            
            data[idx] = data[idx+1] = data[idx+2] = newValue;
        }
    }
    
    // Create a new canvas with the adaptive image
    const adaptiveCanvas = document.createElement('canvas');
    adaptiveCanvas.width = width;
    adaptiveCanvas.height = height;
    const adaptiveCtx = adaptiveCanvas.getContext('2d');
    const adaptiveImageData = new ImageData(data, width, height);
    adaptiveCtx.putImageData(adaptiveImageData, 0, 0);
    
    // 3. Process with contrast enhancement & fixed threshold
    const contrastCanvas = document.createElement('canvas');
    contrastCanvas.width = width;
    contrastCanvas.height = height;
    const contrastCtx = contrastCanvas.getContext('2d');
    
    // Draw original image
    contrastCtx.putImageData(new ImageData(origData, width, height), 0, 0);
    
    // Apply contrast adjustment
    contrastCtx.globalCompositeOperation = 'source-over';
    contrastCtx.fillStyle = 'rgba(255, 255, 255, 0.3)';
    contrastCtx.fillRect(0, 0, width, height);
    
    // Sharpen the image using convolution
    const sharpenKernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
    ];
    
    const imageDataCopy = contrastCtx.getImageData(0, 0, width, height);
    const dataCopy = imageDataCopy.data;
    
    // Apply fixed thresholding
    for (let i = 0; i < dataCopy.length; i += 4) {
        const avg = (dataCopy[i] + dataCopy[i + 1] + dataCopy[i + 2]) / 3;
        const threshold = 150;
        const newValue = avg > threshold ? 255 : 0;
        
        dataCopy[i] = dataCopy[i + 1] = dataCopy[i + 2] = newValue;
    }
    
    contrastCtx.putImageData(imageDataCopy, 0, 0);
    
    // Return an array of processed images for OCR to try
    return [
        adaptiveCanvas.toDataURL('image/png'),
        contrastCanvas.toDataURL('image/png')
    ];
}

// Combine OCR results from multiple attempts
function combineOcrResults(results) {
    // Initialize with the longest text
    let baseText = '';
    let maxLength = 0;
    
    for (const result of results) {
        if (result.text.length > maxLength) {
            baseText = result.text;
            maxLength = result.text.length;
        }
    }
    
    // Extract words from all results
    const allWords = new Set();
    for (const result of results) {
        const words = result.text
            .split(/\s+/)
            .map(word => word.trim().toLowerCase())
            .filter(word => word.length > 2);  // Filter out very short words
            
        words.forEach(word => allWords.add(word));
    }
    
    // Check if any words are missing from base text and add them
    for (const word of allWords) {
        if (!baseText.toLowerCase().includes(word.toLowerCase())) {
            baseText += " " + word;
        }
    }
    
    return baseText;
}

// Detect and correct image orientation for better OCR
async function correctImageOrientation(imageElement) {
    try {
        // Create a temporary canvas to work with the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Get image dimensions
        const width = imageElement.naturalWidth || imageElement.width;
        const height = imageElement.naturalHeight || imageElement.height;
        canvas.width = width;
        canvas.height = height;
        
        // Draw the image
        ctx.drawImage(imageElement, 0, 0);
        
        // Try to detect orientation using Tesseract
        const result = await Tesseract.detect(canvas);
        
        // If orientation is not upright, rotate the image
        if (result.orientation && result.orientation.angle !== 0) {
            console.log("Detected orientation angle:", result.orientation.angle);
            
            // Create new canvas with dimensions flipped if needed
            const rotatedCanvas = document.createElement('canvas');
            const rotatedCtx = rotatedCanvas.getContext('2d');
            
            // Check if we need to swap dimensions
            if (Math.abs(result.orientation.angle) === 90 || Math.abs(result.orientation.angle) === 270) {
                rotatedCanvas.width = height;
                rotatedCanvas.height = width;
            } else {
                rotatedCanvas.width = width;
                rotatedCanvas.height = height;
            }
            
            // Apply rotation
            rotatedCtx.save();
            rotatedCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
            rotatedCtx.rotate((result.orientation.angle * Math.PI) / 180);
            rotatedCtx.drawImage(imageElement, -width / 2, -height / 2);
            rotatedCtx.restore();
            
            return rotatedCanvas.toDataURL('image/png');
        }
        
        // If no rotation needed, return original
        return imageElement;
    } catch (error) {
        console.error("Error correcting orientation:", error);
        return imageElement; // Return original image if correction fails
    }
}

// Clean and enhance recognized text
function postprocessText(text) {
    // Base processing from before
    let processed = text
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
        .replace(/suger/gi, 'sugar')
        .replace(/g1ucose/gi, 'glucose')
        .replace(/mi1k/gi, 'milk')
        .replace(/w1th/gi, 'with')
        .replace(/rnay/gi, 'may')
        .replace(/waler/gi, 'water')
        .replace(/wafer/gi, 'water')
        .replace(/frorn/gi, 'from')
        .replace(/preservatlve/gi, 'preservative')
        .trim();
    
    // NEW: Remove nutritional information sections
    const nutritionRegexes = [
        /nutrition\s*facts?.*?(?=ingredients|\n\n|$)/is,
        /nutritional\s*information.*?(?=ingredients|\n\n|$)/is,
        /serving\s*size.*?(?=ingredients|\n\n|$)/is,
        /calories(\s*per\s*serving)?.*?(?=ingredients|\n\n|$)/is,
        /\bcalories\b.*?\bfat\b.*?\bsodium\b.*?\bprotein\b/is
    ];
    
    for (const regex of nutritionRegexes) {
        processed = processed.replace(regex, '');
    }
    
    // Extract just the ingredients section if possible
    const ingredientsRegex = /ingredients[\s\:\.]+([^]*)/i;
    const ingredientsMatch = processed.match(ingredientsRegex);
    
    if (ingredientsMatch) {
        processed = "Ingredients: " + ingredientsMatch[1].trim();
    }
    
    return processed.trim();
}

// Format and improve the extracted ingredient text
function enhanceIngredientText(text) {
    if (!text || !text.trim()) {
        return text;
    }
    
    let formatted = text;
    
    // 1. Find and separate "Ingredients:" prefix
    const ingredientsMatch = formatted.match(/^(ingredients|ingr?e?d?i?e?nts?|ingred|contents)[\s\:\.]+(.*)/i);
    
    if (ingredientsMatch) {
        formatted = "INGREDIENTS: " + ingredientsMatch[2];
    }
    
    // 2. Replace common OCR errors
    const replacements = {
        'c0rn': 'corn',
        'fiour': 'flour',
        'oll': 'oil',
        'sall': 'salt',
        'lngredients': 'Ingredients',
        'contams': 'contains',
        'allergems': 'allergens',
        'g1uten': 'gluten',
        'suger': 'sugar',
        'g1ucose': 'glucose',
        'mi1k': 'milk',
        'w1th': 'with',
        'rnay': 'may',
        'waler': 'water',
        'wafer': 'water',
        'frorn': 'from',
        'preservatlve': 'preservative'
    };
    
    for (const [error, correction] of Object.entries(replacements)) {
        formatted = formatted.replace(new RegExp('\\b' + error + '\\b', 'gi'), correction);
    }
    
    // 3. Fix punctuation
    formatted = formatted
        .replace(/\,\s*\,/g, ',')
        .replace(/\.\s*\./g, '.')
        .replace(/\s+/g, ' ')
        .replace(/([a-z])\,([a-z])/gi, '$1, $2')
        .replace(/(\w)\:(\w)/g, '$1: $2');
    
    // 4. Clean up "contains" statements
    const containsMatch = formatted.match(/contains[\s\:\.]+([^\.]*)(\.|$)/i);
    if (containsMatch) {
        // Isolate and format the contains statement
        const containsPart = containsMatch[0];
        const mainPart = formatted.replace(containsPart, '');
        formatted = mainPart.trim() + "\n\nCONTAINS: " + containsMatch[1].trim();
    }
    
    // 5. Clean up "may contain" statements
    const mayContainMatch = formatted.match(/may\s+contain[\s\:\.]+([^\.]*)(\.|$)/i);
    if (mayContainMatch) {
        // Isolate and format the may contain statement
        const mayContainPart = mayContainMatch[0];
        const mainPart = formatted.replace(mayContainPart, '');
        formatted = mainPart.trim() + "\n\nMAY CONTAIN: " + mayContainMatch[1].trim();
    }
    
    return formatted.trim();
}

// Enhanced OCR with multiple processing techniques
async function enhanceAndRecognizeText(imageElement) {
    try {
        // Correct orientation if needed
        const orientedImage = await correctImageOrientation(imageElement);
        
        // Image preprocessing with multiple techniques
        const processedImages = await preprocessImage(orientedImage);
        
        // Run OCR on all processed images with different settings
        const results = [];
        
        // First pass: Adaptive processed image with default settings
        results.push(await performOCR(processedImages[0], { 
            rotateAuto: true 
        }));
        
        // Second pass: Contrast enhanced image with ingredient-specific character whitelist
        results.push(await performOCR(processedImages[1], { 
            rotateAuto: true,
            tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.():-%;/* ',
            tessjs_create_box: '1'  // Create word boxes for better word recognition
        }));
        
        // Third pass: Use PSM mode 4 (single column of text)
        results.push(await performOCR(processedImages[0], {
            tessedit_pageseg_mode: '4',
            tessjs_create_box: '1'
        }));
        
        // Combine results using voting/confidence
        let bestText = '';
        let bestConfidence = 0;
        
        // First pick the result with highest confidence
        for (const result of results) {
            if (result.confidence > bestConfidence) {
                bestConfidence = result.confidence;
                bestText = result.text;
            }
        }
        
        // Enhance the result with text from other results
        const combinedText = combineOcrResults(results);
        const cleanedText = postprocessText(combinedText);
        const enhancedText = enhanceIngredientText(cleanedText);
        
        return {
            text: enhancedText,
            confidence: bestConfidence
        };
        
    } catch (error) {
        console.error("Error in enhanced OCR:", error);
        throw error;
    }
}
