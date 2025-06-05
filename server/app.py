from flask import Flask, request, jsonify, render_template, send_from_directory
from ocr_handler import process_image
import os
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("ocr_server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

app = Flask(__name__)

@app.route('/api/ocr', methods=['POST'])
def ocr_endpoint():
    try:
        # Get the base64 image from the request
        data = request.json
        if not data:
            logger.warning("No JSON data in request")
            return jsonify({'success': False, 'error': 'No data provided'}), 400
            
        base64_image = data.get('image', '')
        
        if not base64_image:
            logger.warning("No image in request data")
            return jsonify({'success': False, 'error': 'No image provided'}), 400
            
        # Process the image with OCR
        logger.info("Received OCR request, processing...")
        result = process_image(base64_image)
        
        if result['success']:
            logger.info("OCR processing successful")
            return jsonify(result)
        else:
            logger.error(f"OCR processing failed: {result.get('error', 'Unknown error')}")
            return jsonify(result), 500
        
    except Exception as e:
        logger.error(f"Unexpected error in OCR endpoint: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Simple health check endpoint"""
    return jsonify({
        'status': 'ok'
    })

# If we're running the main application server, include these routes
# Otherwise other Flask apps can import this
if __name__ == '__main__':
    # Add routes for serving the static files and templates
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/static/<path:path>')
    def serve_static(path):
        return send_from_directory('../static', path)

    # Start the server
    port = int(os.environ.get('PORT', 5000))
    debug = os.environ.get('DEBUG', 'False').lower() == 'true'
    
    logger.info(f"Starting OCR Server on port {port}, debug={debug}")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
