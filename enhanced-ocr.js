/**
 * OCR Compatibility Layer
 * Using server-side processing instead of client-side
 * June 2025
 */

// Stub functions for compatibility with existing code
window.enhanceAndRecognizeText = async function() {
    console.warn("Client-side OCR function called, but using server-side OCR instead");
    return { text: "", confidence: 0 };
};

window.performFoodLabelOCR = window.enhanceAndRecognizeText;
window.enhanceIngredientText = text => text;
window.detectIfFoodLabel = () => Promise.resolve(true);
window.detectIngredientsSection = () => null;
