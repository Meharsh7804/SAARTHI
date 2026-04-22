import re
import logging
import spacy
from spacy.matcher import Matcher
from typing import Tuple, Dict, Optional

try:
    from rapidfuzz import process, fuzz
except ImportError:
    # Fallback to basic string comparison if rapidfuzz is missing
    # But it is in requirements, so it should be there.
    pass

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class NLPPreprocessor:
    def __init__(self):
        # Load English model for basic NLP tasks
        try:
            self.nlp = spacy.load("en_core_web_sm")
            logger.info("SpaCy model 'en_core_web_sm' loaded successfully.")
        except Exception as e:
            logger.warning(f"Could not load SpaCy model: {e}. Falling back to basic tokenization.")
            self.nlp = None

        # Predefined keywords for fuzzy correction
        self.TIME_KEYWORDS = ["tomorrow", "today", "yesterday", "tonight", "morning", "afternoon", "evening"]
        
        # Hinglish stop words / noise words to ignore in noun extraction
        self.HINGLISH_STOP_WORDS = {"hai", "ko", "se", "mein", "par", "ke", "liye", "tha", "raha", "kar", "karna", "jana", "pahuchna"}

        # Mapping for Hinglish/Common translations
        self.TRANSLATIONS = {
            "kal": "tomorrow",
            "aaj": "today",
            "parso": "day after tomorrow",
        }

        # Canonical Locations (used for normalization)
        self.CANONICAL_LOCATIONS = {
            "Sitabuldi": "Sitabuldi, Nagpur",
            "Bardi": "Sitabuldi, Nagpur",
            "Civil Lines": "Civil Lines, Nagpur",
            "Airport": "Dr. Babasaheb Ambedkar International Airport, Nagpur",
            "Ramdaspeth": "Ramdaspeth, Nagpur",
            "Dharampeth": "Dharampeth, Nagpur",
            "Nagpur Station": "Nagpur Railway Station",
            "Futala": "Futala Lake, Nagpur"
        }
        self.LOCATION_KEYS = list(self.CANONICAL_LOCATIONS.keys())

        # Initialize Matcher for intent patterns
        if self.nlp:
            self.matcher = Matcher(self.nlp.vocab)
            patterns = [
                [{"LOWER": "to"}, {"POS": {"IN": ["PROPN", "NOUN"]}, "OP": "+"}],
                [{"POS": {"IN": ["PROPN", "NOUN"]}, "OP": "+"}, {"LOWER": {"IN": ["jana", "pahuchna", "reach", "karna"]}}]
            ]
            self.matcher.add("DESTINATION_PATTERN", patterns)

    def dynamic_spell_correct(self, word: str) -> str:
        """Uses fuzzy matching to correct common typos in time-related keywords."""
        word = word.lower()
        if word in self.TRANSLATIONS:
            return self.TRANSLATIONS[word]
            
        # Match against time keywords
        if len(word) > 4:
            match = process.extractOne(word, self.TIME_KEYWORDS, scorer=fuzz.WRatio)
            if match and match[1] > 85:
                return match[0]
            
        return word

    def preprocess(self, text: str) -> str:
        """Normalizes text using SpaCy tokenization and fuzzy correction."""
        if not self.nlp:
            words = text.lower().split()
            corrected = [self.dynamic_spell_correct(w) for w in words]
            return " ".join(corrected)

        # Basic cleaning before SpaCy
        text = text.lower()
        for k, v in self.TRANSLATIONS.items():
            text = re.sub(rf'\b{k}\b', v, text)

        doc = self.nlp(text)
        corrected_tokens = []
        for token in doc:
            if token.is_punct:
                continue
            
            # Use lemmatization for standard words, but keep nouns as is
            if token.pos_ not in ["PROPN", "NOUN"]:
                corrected = self.dynamic_spell_correct(token.lemma_)
            else:
                corrected = token.text
                
            if corrected:
                corrected_tokens.append(corrected)
                
        return " ".join(corrected_tokens)

    def extract_entities(self, text: str) -> Tuple[Optional[str], Optional[str], Optional[str], Dict[str, float]]:
        confidence = {"date": 0.0, "time": 0.0, "location": 0.0}
        date_val, time_val, location_val = None, None, None

        if not self.nlp: return None, None, None, confidence
        doc = self.nlp(text)

        # 1. DATE EXTRACTION
        for ent in doc.ents:
            if ent.label_ == "DATE":
                # Avoid picking up numbers that are likely times
                if not re.match(r'^\d+$', ent.text):
                    date_val = ent.text.title()
                    confidence["date"] = 0.9
                    break
        
        if not date_val:
            for kw in ["tomorrow", "today", "day after tomorrow"]:
                if kw in text:
                    date_val = kw.title()
                    confidence["date"] = 0.8
                    break

        # 2. TIME EXTRACTION
        # Match patterns like "8 am", "9:30", "10 baje"
        time_match = re.search(r'(\d{1,2}(?:\:\d{2})?\s*(?:am|pm|baje)?)', text, re.IGNORECASE)
        if time_match:
            time_raw = time_match.group(1).upper()
            # If date_val contains this time (e.g. "Tomorrow 9"), strip it from date
            short_time = re.search(r'\d+', time_raw)
            if short_time and date_val and short_time.group() in date_val:
                date_val = date_val.replace(short_time.group(), "").strip()
            
            time_val = time_raw.replace("BAJE", "AM").strip()
            if ":" not in time_val and any(x in time_val for x in ["AM", "PM"]):
                 time_val = re.sub(r'(\d+)', r'\1:00', time_val)
            confidence["time"] = 0.9

        # 3. LOCATION EXTRACTION
        detected_locs = []
        
        # A: SpaCy NER
        detected_locs.extend([ent.text for ent in doc.ents if ent.label_ in ["GPE", "LOC", "FAC"]])
        
        # B: Matcher
        matches = self.matcher(doc)
        for match_id, start, end in matches:
            span = doc[start:end]
            loc_text = " ".join([t.text for t in span if t.lower_ not in ["to", "jana", "pahuchna", "reach", "karna"]])
            if loc_text: detected_locs.append(loc_text)

        # C: Heuristic (Last Noun that isn't a stop word or time keyword)
        if not detected_locs:
            potential_nouns = [
                token.text for token in doc 
                if token.pos_ in ["PROPN", "NOUN"] 
                and token.text.lower() not in self.HINGLISH_STOP_WORDS 
                and token.text.lower() not in self.TIME_KEYWORDS
                and not token.like_num
            ]
            if potential_nouns:
                detected_locs.append(potential_nouns[-1])

        # Normalization
        if detected_locs:
            best_candidate = detected_locs[-1]
            match = process.extractOne(best_candidate, self.LOCATION_KEYS, scorer=fuzz.WRatio)
            if match and match[1] > 70:
                location_val = self.CANONICAL_LOCATIONS[match[0]]
                confidence["location"] = match[1] / 100.0
            else:
                location_val = best_candidate.title()
                confidence["location"] = 0.5

        return date_val, time_val, location_val, confidence

# Singleton Instance
_preprocessor = None

def get_preprocessor():
    global _preprocessor
    if _preprocessor is None:
        _preprocessor = NLPPreprocessor()
    return _preprocessor

def process_query(raw_input: str) -> dict:
    preprocessor = get_preprocessor()
    
    logger.info(f"Processing query: {raw_input}")
    cleaned = preprocessor.preprocess(raw_input)
    
    date_val, time_val, location_val, confidence = preprocessor.extract_entities(cleaned)
    
    # Final check: if no location found in cleaned, try raw (NER sometimes prefers original case)
    if not location_val:
        _, _, location_val, confidence = preprocessor.extract_entities(raw_input)

    return {
        "date": date_val or "Today",
        "time": time_val,
        "location": location_val,
        "confidence": confidence,
        "status": "confirmed" if location_val and confidence["location"] > 0.4 else "clarification_needed"
    }

if __name__ == "__main__":
    # Test cases
    test_inputs = [
        "Tommarow 8:00 AM bardi jana hai",
        "kal 9 baje sitabuldi reach karna hai",
        "mujhe airport jana hai aaj sham ko",
        "I want to go to Nagpur Station tomorrow morning",
        "parso 10:30 baje futala lake pahuchna hai"
    ]
    for inp in test_inputs:
        print(f"\nINPUT: {inp}")
        res = process_query(inp)
        print(f"OUTPUT: Date: {res['date']}, Time: {res['time']}, Location: {res['location']} (Conf: {res['confidence']['location']:.2f})")
