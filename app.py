from flask import Flask, request, jsonify
import re
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Sample list of gluten-containing ingredients
GLUTEN_INGREDIENTS = [
    {"name": "wheat", "reason": "Contains gluten protein", "confidence": 1.0},
    {"name": "barley", "reason": "Contains gluten protein", "confidence": 1.0},
    {"name": "rye", "reason": "Contains gluten protein", "confidence": 1.0},
    {"name": "malt", "reason": "Usually derived from barley", "confidence": 0.9},
    {"name": "brewer's yeast", "reason": "Often made from barley", "confidence": 0.8},
    {"name": "oats", "reason": "May be cross-contaminated", "confidence": 0.6},
    {"name": "semolina", "reason": "Made from wheat", "confidence": 1.0},
    {"name": "durum", "reason": "Type of wheat", "confidence": 1.0},
    {"name": "kamut", "reason": "Ancient type of wheat", "confidence": 1.0},
    {"name": "spelt", "reason": "Ancient type of wheat", "confidence": 1.0},
    {"name": "farina", "reason": "Usually made from wheat", "confidence": 0.9},
    {"name": "seitan", "reason": "Made from wheat gluten", "confidence": 1.0},
    {"name": "triticale", "reason": "Cross between wheat and rye", "confidence": 1.0},
    {"name": "couscous", "reason": "Made from wheat", "confidence": 1.0},
    {"name": "bulgur", "reason": "Made from wheat", "confidence": 1.0},
    {"name": "farro", "reason": "Type of wheat", "confidence": 1.0},
    {"name": "graham", "reason": "Type of wheat flour", "confidence": 1.0},
    {"name": "hydrolyzed wheat protein", "reason": "Derived from wheat", "confidence": 1.0},
    {"name": "soy sauce", "reason": "Often contains wheat, unless labeled GF", "confidence": 0.7},
    {"name": "wheat flour", "reason": "Contains gluten protein", "confidence": 1.0},
    # New specific flour entry
    {"name": "flour", "reason": "Usually wheat-based unless specified otherwise", "confidence": 0.8},
]

# Safe flours that should be excluded
SAFE_FLOURS = [
    "rice flour", "potato flour", "tapioca flour", "corn flour", "almond flour", 
    "coconut flour", "buckwheat flour", "sorghum flour", "millet flour", "quinoa flour",
    "chickpea flour", "amaranth flour", "teff flour", "arrowroot flour"
]

AMBIGUOUS_INGREDIENTS = [
    {"name": "natural flavors", "reason": "May contain gluten, specific source not disclosed", "confidence": 0.5},
    {"name": "caramel color", "reason": "Sometimes made from barley malt", "confidence": 0.4},
    {"name": "dextrin", "reason": "Can be derived from wheat", "confidence": 0.5},
    {"name": "modified food starch", "reason": "Can be derived from wheat", "confidence": 0.5},
    {"name": "hydrolyzed vegetable protein", "reason": "Can be derived from wheat", "confidence": 0.5},
    {"name": "vegetable protein", "reason": "Source may include wheat", "confidence": 0.5},
]

@app.route('/', methods=['GET'])
def home():
    return jsonify({"message": "Gluten Free Scanner API is running. Use /analyze endpoint for ingredient analysis."})

@app.route('/analyze', methods=['POST'])
def analyze_ingredients():
    data = request.json
    if not data or 'ingredients_text' not in data:
        return jsonify({"error": "Missing ingredients_text parameter"}), 400
    
    # Normalize text: lowercase and remove extra spaces between letters (for OCR issues)
    raw_text = data['ingredients_text'].lower()
    ingredients_text = raw_text
    # Also create a version with spaces removed between single letters (helps with OCR issues)
    normalized_text = re.sub(r'\b([a-z]) ([a-z]) ([a-z])([ ,.])', r'\1\2\3\4', raw_text)
    normalized_text = re.sub(r'\b([a-z]) ([a-z])([ ,.])', r'\1\2\3', normalized_text)
    
    # Check for explicitly labeled info in either version
    contains_pattern = r'contains\s*:.*?(wheat|barley|rye|gluten)'
    if re.search(contains_pattern, ingredients_text, re.IGNORECASE) or re.search(contains_pattern, normalized_text, re.IGNORECASE):
        return jsonify({
            "is_gluten_free": False,
            "message": "Product explicitly states it contains gluten ingredients.",
            "flagged_ingredients": [{"name": "Allergen statement", "reason": "Contains gluten (see 'contains' statement)", "confidence": 1.0}]
        })
    
    gluten_free_pattern = r'gluten[\s-]*free'
    if re.search(gluten_free_pattern, ingredients_text, re.IGNORECASE) or re.search(gluten_free_pattern, normalized_text, re.IGNORECASE):
        return jsonify({
            "is_gluten_free": True,
            "message": "Product is labeled as gluten-free.",
            "flagged_ingredients": []
        })
    
    # Check for ingredients
    flagged = []
    
    # Split text into words/phrases for more accurate matching
    words = re.split(r'[,;\n\(\)]', ingredients_text)
    words = [w.strip() for w in words]
    
    # Also create normalized words list for OCR issues
    normalized_words = re.split(r'[,;\n\(\)]', normalized_text)
    normalized_words = [w.strip() for w in normalized_words]
    
    # First check if any safe flours are present
    safe_flour_present = False
    for safe_flour in SAFE_FLOURS:
        if any(safe_flour in word for word in words) or any(safe_flour in word for word in normalized_words):
            safe_flour_present = True
            break
    
    # Match against known gluten ingredients
    for ingredient in GLUTEN_INGREDIENTS:
        ingredient_name = ingredient["name"]
        
        # Skip "flour" check if we found a safe flour
        if ingredient_name == "flour" and safe_flour_present:
            continue
            
        # Check in both original and normalized text
        if any(re.search(r'\b' + re.escape(ingredient_name) + r'\b', word) for word in words) or \
           any(re.search(r'\b' + re.escape(ingredient_name) + r'\b', word) for word in normalized_words):
            flagged.append(ingredient)
    
    # Match against ambiguous ingredients only if no definite matches
    if not flagged:
        for ingredient in AMBIGUOUS_INGREDIENTS:
            if any(re.search(r'\b' + re.escape(ingredient["name"]) + r'\b', word) for word in words) or \
               any(re.search(r'\b' + re.escape(ingredient["name"]) + r'\b', word) for word in normalized_words):
                flagged.append(ingredient)
    
    # Determine if product is gluten-free
    if not flagged:
        return jsonify({
            "is_gluten_free": True,
            "message": "No gluten-containing ingredients detected.",
            "flagged_ingredients": []
        })
    elif any(item["confidence"] > 0.7 for item in flagged):
        return jsonify({
            "is_gluten_free": False,
            "message": "This product contains ingredients that likely have gluten.",
            "flagged_ingredients": flagged
        })
    else:
        return jsonify({
            "is_gluten_free": False,
            "message": "This product contains ingredients that may have gluten. Caution is advised.",
            "flagged_ingredients": flagged
        })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 8080)))
