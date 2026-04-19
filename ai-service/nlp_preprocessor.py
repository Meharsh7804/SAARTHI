import re
import logging

try:
    from rapidfuzz import process, fuzz
except ImportError:
    pass # Will be handled if not installed

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

SPELL_MAPPING = {
    "tommarow": "tomorrow",
    "tommorow": "tomorrow",
    "tommorrow": "tomorrow",
    "kal": "tomorrow",
    "aaj": "today",
    "todday": "today"
}

KNOWN_LOCATIONS = {
    "sitabuldi": "Sitabuldi, Nagpur",
    "sitabardi": "Sitabuldi, Nagpur",
    "sitabdi": "Sitabuldi, Nagpur",
    "bardi": "Bardi, Nagpur",
    "civil lines": "Civil Lines, Nagpur",
    "airport": "Dr. Babasaheb Ambedkar International Airport, Nagpur" # or simply Airport
}

KNOWN_LOCATION_KEYS = list(KNOWN_LOCATIONS.keys())

def preprocess_text(text: str) -> str:
    """Spell correction and normalization."""
    # simple clean
    text = text.lower()
    # word replace for known typos
    words = text.split()
    cleaned_words = []
    for w in words:
        # strip punctuation except colon
        w_clean = re.sub(r'[^\w\:]', '', w)
        if w_clean in SPELL_MAPPING:
            cleaned_words.append(SPELL_MAPPING[w_clean])
        else:
            cleaned_words.append(w_clean)
    return " ".join(cleaned_words)

def extract_entities(text: str):
    """
    Returns (date, time, location_name, confidence_dict)
    """
    confidence = {"date": 0.0, "time": 0.0, "location": 0.0}
    
    # 1. DATE
    date_val = None
    if "tomorrow" in text.split():
        date_val = "Tomorrow"
        confidence["date"] = 0.95
    elif "today" in text.split():
        date_val = "Today"
        confidence["date"] = 0.95

    # 2. TIME
    time_val = None
    # match patterns like "8:00 am", "10 baje", "9:30"
    time_match = re.search(r'(\d{1,2}(?:\:\d{2})?\s*(?:am|pm|baje))', text)
    if time_match:
        time_raw = time_match.group(1)
        # format basic
        time_clean = time_raw.replace("baje", "AM").strip().upper() # naive assumption
        if ":" not in time_clean and "AM" in time_clean:
            # e.g. "8 AM"
            time_clean = re.sub(r'(\d+)\s*AM', r'\g<1>:00 AM', time_clean)
        time_val = time_clean
        confidence["time"] = 0.92

    # 3. LOCATION
    target_words = ["jana", "pahuchna", "reach"]
    location_val = None
    
    # check for intent words
    has_intent = False
    for tw in target_words:
        if tw in text:
            has_intent = True
            break
            
    # Try to extract the word right before "jana" or "reach" etc as the location if present
    # Better: just fuzzy search over all text against known locations
    # But rule says: "The LAST location-like word = DESTINATION"
    # To implement this cleanly, we can find all matches in text for our known locations
    # OR we tokenize the sentence, remove stop/date/time words, and whatever noun is left is considered.
    
    words = text.split()
    filtered_words = []
    
    for w in words:
        if w not in ["tomorrow", "today", "hai", "jana", "pahuchna", "reach", "mujhe", "baje", "am", "pm"]:
            if not re.match(r'\d+', w):
                filtered_words.append(w)
                
    # fuzzy matching for the noun phrase in KNOWN_LOCATION_KEYS
    if filtered_words:
        # let's try to match the last word or bigram
        phrase = " ".join(filtered_words)
        try:
            # RapidFuzz extractOne
            # Since phrase might contain extra words, we match against keys
            match = process.extractOne(phrase, KNOWN_LOCATION_KEYS, scorer=fuzz.WRatio)
            if match:
                matched_key, score, _ = match
                location_val = KNOWN_LOCATIONS[matched_key]
                confidence["location"] = score / 100.0
        except Exception as e:
            logger.error(f"Fuzzy match error: {e}")
            pass
            
    return date_val, time_val, location_val, confidence

def process_query(raw_input: str) -> dict:
    """
    Main entry point for nlp_preprocessor
    """
    logger.info(f"Raw input: {raw_input}")
    cleaned = preprocess_text(raw_input)
    logger.info(f"Cleaned input: {cleaned}")
    
    date_val, time_val, location_val, confidence = extract_entities(cleaned)
    
    logger.info(f"Extracted - Date: {date_val}, Time: {time_val}, Location: {location_val}")
    logger.info(f"Scores - {confidence}")
    
    if confidence["location"] < 0.6:
        # if the user typed something completely unknown, don't guess
        return {
            "status": "clarification_needed",
            "suggestion": f"Did you mean {location_val}?" if location_val and confidence["location"] > 0.4 else "I couldn't understand the location. Please clarify."
        }
        
    return {
        "date": date_val or "Today", # default to Today if none? Keep what's extracted
        "time": time_val,
        "location": location_val,
        "confidence": confidence,
        "status": "confirmed"
    }

if __name__ == "__main__":
    result = process_query("Tommarow 8:00 AM bardi jana hai")
    print(result)
