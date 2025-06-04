// Ultra-conservative detection algorithm
function analyzeIngredientsForSafety(data) {
  // Force more cautious interpretation of results
  if (data.flagged_ingredients && data.flagged_ingredients.length > 0) {
    // Any confidence > 50% should be treated as unsafe
    if (data.flagged_ingredients.some(i => i.confidence > 0.5)) {
      data.is_gluten_free = false;
      data.message = "Potentially unsafe: Contains suspicious ingredients.";
    } 
    // Even low confidence should be highlighted as caution
    else {
      data.message = "Exercise caution: Some ingredients need verification.";
    }
  }
  
  // Add explicit statement about cross-contamination
  if (data.is_gluten_free) {
    data.message += " However, always check for cross-contamination risks.";
  }
  
  return data;
}
