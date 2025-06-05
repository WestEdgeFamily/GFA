import base64
import pytesseract
import cv2
import numpy as np
from PIL import Image
import io
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def process_image(base64_image):
    """Process an image with OCR and return the extracted text"""
    try:
        logger.info("Processing OCR request")
        
        # Remove data:image/jpeg;base64, prefix if present
        if 'base64,' in base64_image:
            base64_image = base64_image.split('base64,')[1]
            
        # Decode the base64 image
        image_bytes = base64.b64decode(base64_image)
        
        # Convert to OpenCV format for processing
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        
        if img is None or img.size == 0:
            logger.error("Failed to decode image")
            return {
                'success': False,
                'error': 'Invalid image data'
            }
            
        # Get image dimensions for logging
        height, width = img.shape[:2]
        logger.info(f"Processing image: {width}x{height} pixels")
        
        # Image preprocessing pipeline for text extraction
        # 1. Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 2. Apply adaptive thresholding
        # This is often better for varying lighting conditions
        binary = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        
        # 3. Denoise the image (can help with text clarity)
        denoised = cv2.fastNlMeansDenoising(binary, None, 10, 7, 21)
        
        # 4. Increase contrast
        enhanced = cv2.convertScaleAbs(denoised, alpha=1.2, beta=0)
        
        # Convert processed image back to PIL format for tesseract
        pil_img = Image.fromarray(enhanced)
        
        # Perform OCR with optimized configuration for ingredient lists
        # --psm 6: Assume a single uniform block of text
        # --oem 3: Use LSTM neural network mode
        text = pytesseract.image_to_string(
            pil_img, 
            lang='eng',
            config='--psm 6 --oem 3 -c preserve_interword_spaces=1'
        )
        
        # Post-processing of the text
        processed_text = text.strip()
        processed_text = processed_text.replace('|', 'I')  # Common misrecognition
        processed_text = processed_text.replace('l', 'I')  # Often confused
        
        logger.info("OCR processing completed successfully")
        return {
            'success': True,
            'text': processed_text,
            'confidence': 90  # Static confidence value
        }
        
    except Exception as e:
        logger.error(f"OCR processing error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
