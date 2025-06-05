/**
 * Enhanced OCR Module for Gluten-Free Scanner
 * Provides advanced text recognition optimized for ingredient lists
 * Updated: 2025-06-05
 */

// Perform OCR with settings optimized for ingredient lists
async function performOCR(image, options) {
    // First, let's optimize the default settings for ingredient lists
    const defaultOptions = {
        lang: 'eng',
        langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/lang-data',
        tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.():-%;/*& ',
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
    
    // Check if image is small (likely a cropped ingredient section)
    const isSmallCrop = width < 500 || height < 200;
    
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
            const C = isSmallCrop ? 10 : 5; // Higher bias for small crops
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
        const threshold = isSmallCrop ? 140 : 150; // Lower threshold for ingredient sections
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
        'preservatlve': 'preservative',
        'emulsi ier': 'emulsifier',
        'emulsi tier': 'emulsifier',
        'NIIILK': 'MILK',
        'NIILK': 'MILK',
        'lecithin)': 'lecithin),',
        'WHEATS': 'WHEAT',
        'NUTS!': 'NUTS',
        'NUTS1': 'NUTS',
        'NUTSI': 'NUTS',
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
        .replace(/(\w)\:(\w)/g, '$1: $2')
        .replace(/([a-z]),([a-z])/gi, '$1, $2') // Fix missing space after comma
        .replace(/(\d)%(\w)/g, '$1%, $2') // Add space after percentages
        .replace(/\(([\d\.]+)%\)/g, '($1%)') // Fix percentage formatting in parentheses
        .replace(/\. /g, ', '); // Replace periods with commas in ingredient lists
    
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
            tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.():-%;/*& ',
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

// Specialized function for food label OCR
async function performFoodLabelOCR(imageElement) {
    console.log("Starting specialized food label OCR");
    try {
        // Step 1: Try to correct orientation if needed
        const orientedImage = await correctImageOrientation(imageElement);
        
        // Step 2: Create multiple processed versions with different techniques
        const processedImages = await preprocessFoodLabel(orientedImage);
        
        // Step 3: Run multiple OCR passes with settings optimized for ingredient lists
        const results = [];
        
        // First pass - Standard settings with high-quality image
        results.push(await Tesseract.recognize(processedImages[0], {
            lang: 'eng',
            langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/lang-data',
            tessedit_pageseg_mode: '6',  // Assume a single uniform block of text
        }));
        
        // Second pass - Optimized for lines of text
        results.push(await Tesseract.recognize(processedImages[1], {
            lang: 'eng',
            langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/lang-data',
            tessedit_pageseg_mode: '7', // Treat the image as a single line of text
            tessjs_create_box: '1',
            preserve_interword_spaces: '1'
        }));
        
        // Third pass - Try with different preprocessing
        results.push(await Tesseract.recognize(processedImages[2], {
            lang: 'eng',
            langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/lang-data',
            tessedit_pageseg_mode: '11',  // Sparse text. Find as much text as possible in no particular order
            tessjs_create_box: '1',
        }));
        
        // Combine and clean results
        const texts = results.map(r => r.data.text);
        let bestText = '';
        
        // Evaluate the results and pick the best one
        for (let i = 0; i < texts.length; i++) {
            // Check if it contains the word INGREDIENTS or key ingredients words
            if (texts[i].match(/ingredients/i) || 
                (texts[i].match(/flour|bran|starch|gum|sugar|salt|water/gi) && 
                 texts[i].length > bestText.length)) {
                bestText = texts[i];
            }
        }
        
        // If none of the results seem good, combine them
        if (!bestText) {
            bestText = combineOcrResults(results.map(r => r.data));
        }
        
        // Clean up the text
        const cleanedText = cleanFoodLabelText(bestText);
        
        return {
            text: cleanedText,
            confidence: Math.max(...results.map(r => r.data.confidence || 0)),
            rawTexts: texts
        };
    } catch (error) {
        console.error("Error in food label OCR:", error);
        throw error;
    }
}

// Special preprocessing for food labels
async function preprocessFoodLabel(src) {
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
    
    // Create multiple processed versions optimized for food labels
    
    // Canvas 1: High contrast black text on white background
    const canvas1 = document.createElement('canvas');
    canvas1.width = width;
    canvas1.height = height;
    const ctx1 = canvas1.getContext('2d');
    
    // Draw original image
    ctx1.drawImage(canvas, 0, 0);
    
    // Apply contrast enhancement
    ctx1.globalCompositeOperation = 'multiply';
    ctx1.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx1.fillRect(0, 0, width, height);
    
    // Reset composite operation
    ctx1.globalCompositeOperation = 'source-over';
    
    // Get image data from enhanced image
    const imageData1 = ctx1.getImageData(0, 0, width, height);
    const data1 = imageData1.data;
    
    // Apply global threshold
    for (let i = 0; i < data1.length; i += 4) {
        // Calculate grayscale value
        const avg = (data1[i] + data1[i+1] + data1[i+2]) / 3;
        const threshold = 160; // Adjusted for food labels
        const newVal = avg > threshold ? 255 : 0;
        data1[i] = data1[i+1] = data1[i+2] = newVal;
    }
    
    ctx1.putImageData(imageData1, 0, 0);
    
    // Canvas 2: Adaptive threshold with edge enhancement
    const canvas2 = document.createElement('canvas');
    canvas2.width = width;
    canvas2.height = height;
    const ctx2 = canvas2.getContext('2d');
    ctx2.drawImage(canvas, 0, 0);
    
    // Enhance edges
    ctx2.filter = 'contrast(1.5) brightness(1.1)';
    ctx2.drawImage(canvas2, 0, 0);
    ctx2.filter = 'none';
    
    const imageData2 = ctx2.getImageData(0, 0, width, height);
    const data2 = imageData2.data;
    
    // Apply adaptive threshold
    const blockSize = Math.max(11, Math.floor(Math.min(width, height) / 15));
    const C = 7; // Bias value
    
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            // Calculate local region for adaptive threshold
            const startX = Math.max(0, x - blockSize);
            const startY = Math.max(0, y - blockSize);
            const endX = Math.min(width, x + blockSize);
            const endY = Math.min(height, y + blockSize);
            
            let sum = 0, count = 0;
            for (let ly = startY; ly < endY; ly++) {
                for (let lx = startX; lx < endX; lx++) {
                    const idx = (ly * width + lx) * 4;
                    const avg = (data2[idx] + data2[idx+1] + data2[idx+2]) / 3;
                    sum += avg;
                    count++;
                }
            }
            
            const mean = sum / count;
            const idx = (y * width + x) * 4;
            const pixelAvg = (data2[idx] + data2[idx+1] + data2[idx+2]) / 3;
            const newValue = pixelAvg < (mean - C) ? 0 : 255;
            
            data2[idx] = data2[idx+1] = data2[idx+2] = newValue;
        }
    }
    
    ctx2.putImageData(imageData2, 0, 0);
    
    // Canvas 3: Grayscale with histogram equalization
    const canvas3 = document.createElement('canvas');
    canvas3.width = width;
    canvas3.height = height;
    const ctx3 = canvas3.getContext('2d');
    ctx3.drawImage(canvas, 0, 0);
    
    const imageData3 = ctx3.getImageData(0, 0, width, height);
    const data3 = imageData3.data;
    
    // Convert to grayscale
    for (let i = 0; i < data3.length; i += 4) {
        const gray = 0.3 * data3[i] + 0.59 * data3[i+1] + 0.11 * data3[i+2];
        data3[i] = data3[i+1] = data3[i+2] = gray;
    }
    
    // Calculate histogram
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data3.length; i += 4) {
        histogram[data3[i]]++;
    }
    
    // Calculate cumulative distribution function
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i-1] + histogram[i];
    }
    
    // Normalize CDF
    const cdfMin = cdf.find(x => x > 0);
    for (let i = 0; i < 256; i++) {
        cdf[i] = Math.round(((cdf[i] - cdfMin) / (data3.length/4 - cdfMin)) * 255);
    }
    
    // Apply equalization
    for (let i = 0; i < data3.length; i += 4) {
        data3[i] = data3[i+1] = data3[i+2] = cdf[data3[i]];
    }
    
    // Apply global threshold
    for (let i = 0; i < data3.length; i += 4) {
        data3[i] = data3[i+1] = data3[i+2] = data3[i] > 130 ? 255 : 0;
    }
    
    ctx3.putImageData(imageData3, 0, 0);
    
    return [
        canvas1.toDataURL('image/png'),
        canvas2.toDataURL('image/png'),
        canvas3.toDataURL('image/png')
    ];
}

// Clean and format food label text
function cleanFoodLabelText(text) {
    if (!text) return "";
    
    // First, normalize whitespace
    let cleaned = text.replace(/\s+/g, ' ').trim();
    
    // Extract ingredient section if possible
    const ingredientSectionRegex = /ingredients\s*:?\s*([^.]*\.?)/i;
    const ingredientMatch = cleaned.match(ingredientSectionRegex);
    if (ingredientMatch && ingredientMatch[1]) {
        cleaned = "INGREDIENTS: " + ingredientMatch[1].trim();
    }
    
    // Special ingredient separator handling
    cleaned = cleaned
        .replace(/([a-z]),([a-z])/gi, '$1, $2') // Fix missing spaces after commas
        .replace(/(\d)%(\w)/g, '$1%, $2') // Add space after percentages
        .replace(/\(([\d\.]+)%\)/g, '($1%)') // Fix percentage formatting in parentheses
        .replace(/\. /g, ', '); // Replace periods with commas in ingredient lists
    
    // Fix common OCR errors specific to food labels
    const replacements = {
        'Ingred ents': 'Ingredients',
        'ingred ents': 'ingredients',
        'INGRED ENTS': 'INGREDIENTS',
        'Ingredienis': 'Ingredients',
        'Ingrediants': 'Ingredients',
        'Ingredants': 'Ingredients',
        'inodified': 'modified',
        'xantnan': 'xanthan',
        'xaninan': 'xanthan',
        'xantnem': 'xanthan',
        'gum,': 'gum,',
        'flcur': 'flour',
        'flour,': 'flour,',
        'bran,': 'bran,',
        'staren': 'starch',
        'starcn': 'starch',
        'sirch': 'starch',
        'starci': 'starch',
        'stabilzed': 'stabilized',
        'siabilized': 'stabilized',
        'emulsi ier': 'emulsifier',
        'emulsi tier': 'emulsifier',
        'NIIILK': 'MILK',
        'NIILK': 'MILK',
        'lecithin)': 'lecithin),',
        'TRACES': 'TRACES',
        'WHEATS': 'WHEAT',
        'NUTS!': 'NUTS',
        'NUTS1': 'NUTS',
        'NUTSI': 'NUTS',
    };
    
    for (const [error, correction] of Object.entries(replacements)) {
        cleaned = cleaned.replace(new RegExp(error, 'ig'), correction);
    }
    
    // Fix specific formatting for food ingredients
    cleaned = cleaned
        .replace(/([A-Za-z]),([A-Za-z])/g, '$1, $2') // Fix missing space after comma
        .replace(/\s+\./g, '.') // Fix space before period
        .replace(/\s*\(\s*/g, ' (') // Normalize opening parenthesis
        .replace(/\s*\)\s*/g, ') ') // Normalize closing parenthesis
        .replace(/\.\s*,/g, ',') // Fix period before comma
        .replace(/\.\s*\./g, '.'); // Fix multiple periods
        
    return cleaned;
}

// Specialized function to detect just the ingredients section of a food label
async function detectIngredientsSection(imageElement) {
    try {
        // First attempt - use OCR to find likely area containing ingredients text
        const lowResResult = await Tesseract.recognize(imageElement, {
            lang: 'eng',
            logger: m => {}, // Suppress progress messages
            rectangle: { // Only sample part of the image to speed things up
                top: Math.floor(imageElement.height * 0.5),
                left: 0,
                width: imageElement.width,
                height: Math.floor(imageElement.height * 0.5)
            }
        });
        
        // Look for the word "ingredients" in the text
        const lowResText = lowResResult.data.text.toLowerCase();
        const ingredientsIndex = lowResText.indexOf("ingredients");
        
        if (ingredientsIndex >= 0) {
            console.log("Found ingredients section via OCR");
            
            // Get the word position info from Tesseract
            const words = lowResResult.data.words || [];
            const ingredientsWord = words.find(word => 
                word.text.toLowerCase().includes("ingredient")
            );
            
            if (ingredientsWord) {
                // Extract a region that starts at the ingredients word and extends down
                // Scale coordinates since we used a smaller rectangle
                const yOffset = Math.floor(imageElement.height * 0.5); // Offset from rectangle
                
                const bbox = {
                    x: Math.max(0, ingredientsWord.bbox.x0 - 10),
                    y: ingredientsWord.bbox.y0 + yOffset - 5,
                    width: imageElement.width - ingredientsWord.bbox.x0 + 10,
                    height: Math.min(
                        imageElement.height - ingredientsWord.bbox.y0 - yOffset + 5,
                        imageElement.height * 0.3 // Limit height to 30% of the image
                    )
                };
                
                return bbox;
            }
        }
        
        // Fallback to image analysis method
        console.log("Ingredients word not found, using pattern detection");
        
        // Create a canvas with the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = imageElement.width;
        canvas.height = imageElement.height;
        ctx.drawImage(imageElement, 0, 0);
        
        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        
        // Look for patterns that typically contain ingredient lists
        // (small text blocks in the bottom half of the packaging)
        
        // 1. Analyze text density in different regions
        const rowDensity = [];
        
        // Skip the top 40% of the image (usually brand/nutrition info)
        const startY = Math.floor(imageElement.height * 0.4);
        
        // Analyze horizontal density of pixels (looking for text blocks)
        for (let y = startY; y < imageElement.height; y++) {
            let blackCount = 0;
            for (let x = 0; x < imageElement.width; x++) {
                const i = (y * imageElement.width + x) * 4;
                // Check if pixel is dark (text)
                const avg = (data[i] + data[i+1] + data[i+2]) / 3;
                if (avg < 100) blackCount++;
            }
            rowDensity.push(blackCount);
        }
        
        // Find the row with maximum density (likely to be in the ingredients section)
        const maxDensityRow = startY + rowDensity.indexOf(Math.max(...rowDensity));
        
        // Look for starting and ending rows of the ingredients block
        let startRow = maxDensityRow;
        let endRow = maxDensityRow;
        
        // Search for the start of the text block (where density drops)
        for (let y = maxDensityRow; y > startY; y--) {
            if (rowDensity[y - startY] < rowDensity[maxDensityRow - startY] * 0.3) {
                startRow = y + 5; // Add margin
                break;
            }
        }
        
        // Search for the end of the text block
        for (let y = maxDensityRow; y < imageElement.height; y++) {
            if (rowDensity[y - startY] < rowDensity[maxDensityRow - startY] * 0.3) {
                endRow = y - 5; // Add margin
                break;
            }
        }
        
        // Create bbox for the detected ingredients section
        const bbox = {
            x: 0,
            y: startRow,
            width: imageElement.width,
            height: endRow - startRow
        };
        
        return bbox;
    } catch (error) {
        console.error("Error detecting ingredients section:", error);
        // Return a default region in the middle-bottom of the image
        return {
            x: 0,
            y: Math.floor(imageElement.height * 0.6),
            width: imageElement.width,
            height: Math.floor(imageElement.height * 0.3)
        };
    }
}

// Function to detect if an image contains food label
async function detectIfFoodLabel(imageElement) {
    try {
        // Quick OCR sample to check for food-related keywords
        const result = await Tesseract.recognize(imageElement, {
            lang: 'eng',
            rectangle: { left: 0, top: 0, width: 0.8, height: 0.8 }
        });
        
        const text = result.data.text.toLowerCase();
        
        // Look for food label indicators
        const foodKeywords = [
            'ingredients', 'ingred', 'nutrition', 'calories', 
            'serving', 'flour', 'sugar', 'salt', 'contains',
            'modified', 'starch', 'water', 'protein', 'fat',
            'gluten', 'bran', 'gum', 'distributed', 'inc.'
        ];
        
        // Check if any keywords are found
        return foodKeywords.some(keyword => text.includes(keyword));
    } catch (e) {
        console.error("Error in food label detection:", e);
        return false; // Default to standard OCR on error
    }
}

// Make functions available globally
window.enhanceAndRecognizeText = enhanceAndRecognizeText;
window.performFoodLabelOCR = performFoodLabelOCR;
window.enhanceIngredientText = enhanceIngredientText;
window.detectIfFoodLabel = detectIfFoodLabel;
window.detectIngredientsSection = detectIngredientsSection;
