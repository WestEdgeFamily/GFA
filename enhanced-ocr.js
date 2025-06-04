// Enhanced OCR implementation
async function improvedScanImage() {
  const imgPreview = document.getElementById('imagePreview');
  if (!imgPreview.src) {
    alert("Please upload an image first.");
    return;
  }
  
  // Show scanning message
  document.getElementById('scanningMessage').style.display = 'block';
  document.getElementById('extractedText').value = '';
  document.getElementById('useTextButton').disabled = true;
  
  try {
    // Image preprocessing
    const enhancedImage = await preprocessImage(imgPreview.src);
    
    // First OCR attempt with default settings
    const result1 = await performOCR(enhancedImage, { rotateAuto: true });
    
    // Second OCR attempt with different settings for comparison
    const result2 = await performOCR(enhancedImage, { 
      rotateAuto: true,
      tessedit_char_whitelist: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789,.():-% '
    });
    
    // Combine and clean results
    const combinedText = mergeOCRResults(result1, result2);
    const cleanedText = postprocessText(combinedText);
    
    document.getElementById('extractedText').value = cleanedText;
    document.getElementById('useTextButton').disabled = false;
    document.getElementById('scanningMessage').style.display = 'none';
    document.getElementById('ocrProgress').style.width = '0%';
    
    // Provide confidence feedback
    const confidence = Math.min(result1.confidence, result2.confidence);
    if (confidence < 70) {
      document.getElementById('ocrConfidence').textContent = 
        "⚠️ Warning: Text recognition confidence is low. Please verify the extracted text carefully.";
      document.getElementById('ocrConfidence').style.display = 'block';
    }
  } catch (error) {
    alert("Error scanning image: " + error.message);
    document.getElementById('scanningMessage').style.display = 'none';
  }
}

// Image preprocessing to improve OCR
async function preprocessImage(src) {
  // Create a canvas and get its context
  const img = new Image();
  await new Promise(resolve => {
    img.onload = resolve;
    img.src = src;
  });
  
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  
  // Draw original image
  ctx.drawImage(img, 0, 0);
  
  // Get image data
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  
  // Apply basic contrast enhancement
  for (let i = 0; i < data.length; i += 4) {
    // Convert to grayscale
    const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
    
    // Apply threshold for better text contrast
    const newValue = avg > 128 ? 255 : 0;
    
    data[i] = newValue;     // r
    data[i + 1] = newValue; // g
    data[i + 2] = newValue; // b
  }
  
  // Put the enhanced image data back on the canvas
  ctx.putImageData(imageData, 0, 0);
  
  return canvas.toDataURL('image/png');
}

// Helper to merge OCR results
function mergeOCRResults(result1, result2) {
  // Use the longer text as the base
  let baseText = result1.text.length > result2.text.length ? result1.text : result2.text;
  
  // Insert any ingredients from the other result that might be missing
  // This is a simplified approach - a more sophisticated merge would be needed for production
  const lines1 = result1.text.split('\n');
  const lines2 = result2.text.split('\n');
  
  // Find potential ingredients in second result not in first
  for (const line of lines2) {
    if (line.trim() && !lines1.some(l => l.includes(line))) {
      baseText += '\n' + line;
    }
  }
  
  return baseText;
}

// Helper to clean up common OCR errors in ingredient lists
function postprocessText(text) {
  return text
    // Fix common OCR errors
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
    .trim();
}
