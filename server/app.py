from flask import Flask, request, jsonify
from ocr_handler import process_image

app = Flask(__name__)

@app.route('/api/ocr', methods=['POST'])
def ocr_endpoint():
    try:
        # Get the base64 image from the request
        data = request.json
        base64_image = data.get('image', '')
        
        if not base64_image:
            return jsonify({'success': False, 'error': 'No image provided'}), 400
            
        # Process the image with OCR
        result = process_image(base64_image)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
