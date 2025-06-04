from flask import Flask, request, jsonify
import re
import os

app = Flask(__name__)

# Sample list of gluten-containing ingredients
GLUTEN_INGREDIENTS = [
    {"name": "wheat", "reason": "Contains gluten protein", "confidence": 1.0},
    {"name": "barley", "reason": "Contains gluten protein", "confidence": 1.0},
    {"name": "rye", "reason": "Contains gluten protein", "confidence": 1.0},
    {"name": "malt", "reason": "Usually derived from barley", "confidence": 0.9},
    {"name": "brewer's yeast", "reason": "Often made from barley", "confidence": 0.8},
    {"name": "oats", "reason": "May be cross-contaminated", "confidence": 0.6},
    {"name": "flour", "reason": "Usually wheat-based unless specified", "confidence": 0.8},
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
]

AMBIGUOUS_INGREDIENTS = [
    {"name": "natural flavors", "reason": "May contain gluten, specific source not disclosed", "confidence": 0.5},
    {"name": "caramel color", "reason": "Sometimes made from barley malt", "confidence": 0.4},
    {"name": "dextrin", "reason": "Can be derived from wheat", "confidence": 0.5},
    {"name": "modified food starch", "reason": "Can be derived from wheat", "confidence": 0.5},
    {"name": "hydrolyzed vegetable protein", "reason": "Can be derived from wheat", "confidence": 0.5},
    {"name": "vegetable protein", "reason": "Source may include wheat", "confidence": 0.5},
]

@app.route('/analyze', methods=['POST'])
def analyze_ingredients():
    data = request.json
    if not data or 'ingredients_text' not in data:
        return jsonify({"error": "Missing ingredients_text parameter"}), 400
    
    ingredients_text = data['ingredients_text'].lower()
    
    # Check for explicitly labeled info
    if re.search(r'contains\s*:.*?(wheat|barley|rye|gluten)', ingredients_text, re.IGNORECASE):
        return jsonify({
            "is_gluten_free": False,
            "message": "Product explicitly states it contains gluten ingredients.",
            "flagged_ingredients": [{"name": "Allergen statement", "reason": "Contains gluten (see 'contains' statement)", "confidence": 1.0}]
        })
    
    if re.search(r'gluten[\s-]*free', ingredients_text, re.IGNORECASE):
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
    
    # Match against known gluten ingredients
    for ingredient in GLUTEN_INGREDIENTS:
        if any(re.search(r'\b' + re.escape(ingredient["name"]) + r'\b', word) for word in words):
            flagged.append(ingredient)
    
    # Match against ambiguous ingredients only if no definite matches
    if not flagged:
        for ingredient in AMBIGUOUS_INGREDIENTS:
            if any(re.search(r'\b' + re.escape(ingredient["name"]) + r'\b', word) for word in words):
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
