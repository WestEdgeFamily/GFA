/**
 * Ultra-Simplified OCR for Gluten-Free Scanner
 * Focus on reliability for mobile devices
 */

// Make direct OCR available globally
window.performSimpleOCR = async function(imageElement) {
    console.log("Starting ultra-simplified OCR");
    
    try {
        // Use minimal settings for speed
        const result = await Tesseract.recognize(imageElement, {
            lang: 'eng',
            langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@4/lang-data',
            tessedit_pageseg_mode: '6',  // Assume a single uniform block of text
            tessedit_ocr_engine_mode: '2',  // Use LSTM only
            preserve_interword_spaces: '1',
            tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.():-%;/*& ',
            tessjs_create_hocr: '0',
            tessjs_create_tsv: '0',
            tessjs_create_box: '0'
        });
        
        console.log("OCR completed");
        
        return {
            text: result.data.text.trim(),
            confidence: result.data.confidence
        };
    } catch (error) {
        console.error("OCR error:", error);
        throw error;
    }
};

// Stub functions to maintain compatibility
window.enhanceAndRecognizeText = window.performSimpleOCR;
window.performFoodLabelOCR = window.performSimpleOCR;
window.enhanceIngredientText = text => text;
window.detectIfFoodLabel = () => Promise.resolve(true);
window.detectIngredientsSection = () => null;
