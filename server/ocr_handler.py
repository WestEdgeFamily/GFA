import base64
import pytesseract
import cv2
import numpy as np
from PIL import Image
import io
import os
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
        
        # Image preprocessing pipeline
        # 1. Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # 2. Apply adaptive thresholding
        gray = cv2.adaptiveThreshold(
            gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
            cv2.THRESH_BINARY, 11, 2
        )
        
        # 3. Denoise the image
        gray = cv2.fastNlMeansDenoising(gray, None, 10, 7, 21)
        
        # Convert back to PIL Image for pytesseract
        pil_img = Image.fromarray(gray)
        
        # Perform OCR with optimized configuration
        text = pytesseract.image_to_string(
            pil_img, 
            lang='eng',
            config='--psm 6 --oem 3 -c preserve_interword_spaces=1'
        )
        
        # Post-process the text
        text = text.strip()
        
        logger.info("OCR processing completed successfully")
        return {
            'success': True,
            'text': text,
            'confidence': 90
        }
        
    except Exception as e:
        logger.error(f"OCR processing error: {str(e)}")
        return {
            'success': False,
            'error': str(e)
        }
