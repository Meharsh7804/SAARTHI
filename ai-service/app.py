"""
=============================================================
app.py  –  QuickRide AI Service  (FastAPI)
=============================================================
Hybrid extraction endpoint:
  POST /extract
    → runs spaCy NER first
    → falls back to DistilBERT if TIME or DROP is missing
    → returns structured JSON

Run:
    uvicorn app:app --reload --port 8001

Docs:
    http://localhost:8001/docs
=============================================================
"""

# ── Fix: Windows OpenMP runtime conflict (Anaconda + torch) ──────────────────
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
from pathlib import Path
from typing import Optional

import spacy
import torch
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForTokenClassification

# ── Paths ─────────────────────────────────────────────────
BASE_DIR        = Path(__file__).parent
NER_MODEL_DIR   = BASE_DIR / "ner_model"
TRANS_MODEL_DIR = BASE_DIR / "transformer_model"

# ── BIO label mapping ─────────────────────────────────────
ID2LABEL = {0: "O", 1: "B-TIME", 2: "I-TIME", 3: "B-DROP", 4: "I-DROP"}


# ══════════════════════════════════════════════════════════
# GLOBAL MODEL HANDLES  (loaded once at startup)
# ══════════════════════════════════════════════════════════

ner_nlp         = None
trans_tokenizer = None
trans_model     = None
pos_nlp         = None


def load_models():
    """Load both models on startup (lazy – skips if file not found)."""
    global ner_nlp, trans_tokenizer, trans_model

    # spaCy NER
    ner_path = NER_MODEL_DIR / "meta.json"
    if ner_path.exists():
        try:
            ner_nlp = spacy.load(str(NER_MODEL_DIR))
            print(f"[AI-Service] ✔  spaCy NER model loaded  ({NER_MODEL_DIR})")
        except Exception as e:
            print(f"[AI-Service] ⚠  Failed to load spaCy NER: {e}")
    else:
        print(f"[AI-Service] ⚠  NER model not found – run train_ner.py first")

    # DistilBERT
    trans_path = TRANS_MODEL_DIR / "config.json"
    if trans_path.exists():
        try:
            trans_tokenizer = AutoTokenizer.from_pretrained(str(TRANS_MODEL_DIR))
            trans_model     = AutoModelForTokenClassification.from_pretrained(str(TRANS_MODEL_DIR))
            trans_model.eval()
            print(f"[AI-Service] ✔  Transformer model loaded ({TRANS_MODEL_DIR})")
        except Exception as e:
            print(f"[AI-Service] ⚠  Failed to load transformer: {e}")
    else:
        print(f"[AI-Service] ⚠  Transformer model not found – run train_transformer.py first")

    # POS Tagger (en_core_web_sm)
    global pos_nlp
    try:
        pos_nlp = spacy.load("en_core_web_sm")
        print(f"[AI-Service] ✔  spaCy POS model loaded (en_core_web_sm)")
    except Exception as e:
        print(f"[AI-Service] ⚠  Failed to load en_core_web_sm: {e}")


# ══════════════════════════════════════════════════════════
# FASTAPI APP
# ══════════════════════════════════════════════════════════

app = FastAPI(
    title       = "QuickRide AI Service",
    description = "Hybrid NER + Transformer extraction of ride TIME and DROP location.",
    version     = "1.0.0",
)

# Allow cross-origin (for future frontend integration)
app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)


@app.on_event("startup")
def startup_event():
    """Load models when the FastAPI server starts."""
    load_models()


# ══════════════════════════════════════════════════════════
# SCHEMAS
# ══════════════════════════════════════════════════════════

class ExtractRequest(BaseModel):
    text: str

    class Config:
        json_schema_extra = {
            "example": {
                "text": "Mujhe 9:30 baje Sitabuldi jana hai"
            }
        }


class ExtractResponse(BaseModel):
    text   : str
    time   : Optional[str]
    drop   : Optional[str]
    source : str          # "ner" | "transformer" | "none"
    details: dict


# ══════════════════════════════════════════════════════════
# EXTRACTION HELPERS
# ══════════════════════════════════════════════════════════

def expand_drop_span(text: str, start_char: int, end_char: int) -> str:
    """Dynamically expand the bounds of a detected location using POS tagging."""
    original_text = text[start_char:end_char]
    if pos_nlp is None:
        return original_text
        
    doc = pos_nlp(text)
    
    # 1. Map character indices to token indices
    start_token_idx = None
    end_token_idx = None
    
    for token in doc:
        if start_token_idx is None and token.idx >= start_char:
            start_token_idx = token.i
        if start_token_idx is None and token.idx < start_char <= token.idx + len(token.text):
            start_token_idx = token.i
            
        if token.idx + len(token.text) >= end_char and end_token_idx is None:
            end_token_idx = token.i
            
    if start_token_idx is None or end_token_idx is None:
        return original_text
        
    left = start_token_idx
    right = end_token_idx
    
    # 2. Expand LEFT while PROPN
    while left > 0:
        if doc[left - 1].pos_ == "PROPN":
            left -= 1
        else:
            break
            
    # 3. Expand RIGHT while PROPN or NOUN
    while right < len(doc) - 1:
        if doc[right + 1].pos_ in ("PROPN", "NOUN"):
            right += 1
        else:
            break
            
    expanded_span = doc[left:right+1].text
    
    if expanded_span != original_text:
        print(f"")
        print(f"[AI Expander] NER detected    : {original_text}")
        print(f"[AI Expander] Expanded to      : {expanded_span}")
        print(f"[AI Expander] Final output     : {expanded_span}")
        print(f"")
        return expanded_span
        
    return original_text


def ner_extract(text: str) -> dict:
    """Extract TIME and DROP using spaCy NER with POS expansion."""
    if ner_nlp is None:
        return {"time": None, "drop": None, "expanded": False}

    doc = ner_nlp(text)
    result = {"time": None, "drop": None, "expanded": False}
    for ent in doc.ents:
        if ent.label_ == "TIME" and result["time"] is None:
            result["time"] = ent.text
        elif ent.label_ == "DROP" and result["drop"] is None:
            original = ent.text
            expanded = expand_drop_span(text, ent.start_char, ent.end_char)
            result["drop"] = expanded
            if expanded != original:
                result["expanded"] = True
    return result


def transformer_extract(text: str) -> dict:
    """Extract TIME and DROP using DistilBERT token classification."""
    if trans_tokenizer is None or trans_model is None:
        return {"time": None, "drop": None}

    words  = text.split()
    inputs = trans_tokenizer(
        words,
        is_split_into_words=True,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=64,
    )

    with torch.no_grad():
        outputs = trans_model(**inputs)

    logits   = outputs.logits[0]
    word_ids = inputs.word_ids(0)
    pred_ids = logits.argmax(dim=-1).tolist()

    word_preds: dict[int, str] = {}
    for sub_idx, wid in enumerate(word_ids):
        if wid is not None and wid not in word_preds:
            word_preds[wid] = ID2LABEL.get(pred_ids[sub_idx], "O")

    time_tokens = []
    drop_tokens = []
    for wid in sorted(word_preds):
        label = word_preds[wid]
        if label in ("B-TIME", "I-TIME"):
            time_tokens.append(words[wid])
        elif label in ("B-DROP", "I-DROP"):
            drop_tokens.append(words[wid])

    return {
        "time": " ".join(time_tokens) if time_tokens else None,
        "drop": " ".join(drop_tokens) if drop_tokens else None,
    }


# ══════════════════════════════════════════════════════════
# HYBRID LOGIC
# ══════════════════════════════════════════════════════════

def hybrid_extract(text: str) -> dict:
    """
    Hybrid extraction pipeline:
      1. Run spaCy NER model
      2. If both TIME + DROP found → return NER result
      3. Else  → run DistilBERT transformer
      4. Merge: prefer NER values, fill gaps with transformer
    """
    ner_result   = ner_extract(text)
    trans_result = transformer_extract(text)

    ner_complete = ner_result["time"] is not None and ner_result["drop"] is not None

    if ner_complete:
        return {
            "time"   : ner_result["time"],
            "drop"   : ner_result["drop"],
            "source" : "ner-expanded" if ner_result.get("expanded") else "ner",
            "details": {
                "ner_result"        : ner_result,
                "transformer_result": trans_result,
                "ner_used"          : True,
                "transformer_used"  : False,
            }
        }

    # Fallback / merge
    merged_time = ner_result["time"] or trans_result["time"]
    merged_drop = ner_result["drop"] or trans_result["drop"]

    source = "transformer" if (ner_result["time"] is None and ner_result["drop"] is None) else "hybrid"

    return {
        "time"   : merged_time,
        "drop"   : merged_drop,
        "source" : source,
        "details": {
            "ner_result"        : ner_result,
            "transformer_result": trans_result,
            "ner_used"          : True,
            "transformer_used"  : True,
            "reason"            : "NER incomplete; transformer used as fallback",
        }
    }


# ══════════════════════════════════════════════════════════
# ROUTES
# ══════════════════════════════════════════════════════════

@app.get("/", tags=["Health"])
def root():
    """Health check."""
    return {
        "service"    : "QuickRide AI Service",
        "version"    : "1.0.0",
        "ner_loaded" : ner_nlp is not None,
        "transformer_loaded": trans_model is not None,
        "status"     : "running",
    }


@app.get("/health", tags=["Health"])
def health():
    """Detailed health check with model status."""
    return {
        "ner_model"        : "loaded" if ner_nlp is not None else "not_loaded",
        "transformer_model": "loaded" if trans_model is not None else "not_loaded",
        "status"           : "healthy",
    }


@app.post("/extract", response_model=ExtractResponse, tags=["Extraction"])
def extract(req: ExtractRequest):
    """
    **Hybrid entity extraction.**

    Extracts TIME and DROP from a ride booking request using:
    - **Primary**: spaCy NER (fast, custom-trained)
    - **Fallback**: DistilBERT Transformer (when NER is incomplete)

    Returns structured JSON with source attribution.
    """
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Input text cannot be empty")

    if ner_nlp is None and trans_model is None:
        raise HTTPException(
            status_code=503,
            detail="No AI models loaded. Train models first: train_ner.py & train_transformer.py",
        )

    result = hybrid_extract(req.text.strip())

    return ExtractResponse(
        text   = req.text,
        time   = result["time"],
        drop   = result["drop"],
        source = result["source"],
        details= result["details"],
    )


@app.post("/extract/ner-only", tags=["Extraction"])
def extract_ner_only(req: ExtractRequest):
    """Run spaCy NER model only (no transformer fallback)."""
    if ner_nlp is None:
        raise HTTPException(status_code=503, detail="NER model not loaded")
    result = ner_extract(req.text.strip())
    return {"text": req.text, **result, "source": "ner"}


@app.post("/extract/transformer-only", tags=["Extraction"])
def extract_transformer_only(req: ExtractRequest):
    """Run DistilBERT transformer only (no NER)."""
    if trans_model is None:
        raise HTTPException(status_code=503, detail="Transformer model not loaded")
    result = transformer_extract(req.text.strip())
    return {"text": req.text, **result, "source": "transformer"}
