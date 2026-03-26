"""
=============================================================
test_models.py  –  Hybrid Model Testing Script
=============================================================
Loads both trained models (spaCy NER + DistilBERT transformer)
and runs a suite of test inputs to demonstrate extraction.

Usage:
    python test_models.py

Requires that BOTH models have been trained first:
    python train_ner.py
    python train_transformer.py
=============================================================
"""

# ── Fix: Windows OpenMP runtime conflict (Anaconda + torch) ──────────────────
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
from pathlib import Path

import spacy
import torch
from transformers import AutoTokenizer, AutoModelForTokenClassification

# ── Paths ─────────────────────────────────────────────────
BASE_DIR         = Path(__file__).parent
NER_MODEL_DIR    = BASE_DIR / "ner_model"
TRANS_MODEL_DIR  = BASE_DIR / "transformer_model"

# ── BIO label scheme (must match training) ─────────────────
ID2LABEL = {0: "O", 1: "B-TIME", 2: "I-TIME", 3: "B-DROP", 4: "I-DROP"}


# ══════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════

def banner(msg: str, char: str = "═") -> None:
    width = 64
    print("\n" + char * width)
    print(f"  {msg}")
    print(char * width)


def check_models_exist() -> bool:
    """Verify trained model files exist before testing."""
    ner_ok   = (NER_MODEL_DIR / "meta.json").exists()
    trans_ok = (TRANS_MODEL_DIR / "config.json").exists()

    banner("MODEL AVAILABILITY CHECK")
    print(f"  spaCy NER model       : {'✔  FOUND' if ner_ok else '✘  MISSING — run train_ner.py'}")
    print(f"  Transformer model     : {'✔  FOUND' if trans_ok else '✘  MISSING — run train_transformer.py'}")

    if not ner_ok and not trans_ok:
        print("\n  ⛔  No models found. Train both models first.")
        return False
    return True


# ══════════════════════════════════════════════════════════
# NER EXTRACTOR (spaCy)
# ══════════════════════════════════════════════════════════

pos_nlp = None

def load_ner_model():
    """Load the trained spaCy NER model."""
    global pos_nlp
    try:
        if pos_nlp is None:
            pos_nlp = spacy.load("en_core_web_sm")
            print("  ✔  spaCy POS model loaded (en_core_web_sm)")
    except Exception as e:
        print(f"  ⚠  Failed to load en_core_web_sm: {e}")

    if not (NER_MODEL_DIR / "meta.json").exists():
        return None
    nlp = spacy.load(str(NER_MODEL_DIR))
    print(f"  ✔  spaCy NER model loaded from  {NER_MODEL_DIR}")
    return nlp


def expand_drop_span(text: str, start_char: int, end_char: int) -> str:
    """Dynamically expand the bounds of a detected location using POS tagging."""
    original_text = text[start_char:end_char]
    if pos_nlp is None:
        return original_text
        
    doc = pos_nlp(text)
    
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
    
    while left > 0:
        if doc[left - 1].pos_ == "PROPN":
            left -= 1
        else:
            break
            
    while right < len(doc) - 1:
        if doc[right + 1].pos_ in ("PROPN", "NOUN"):
            right += 1
        else:
            break
            
    expanded_span = doc[left:right+1].text
    return expanded_span

def extract_with_ner(nlp, text: str) -> dict:
    """Run spaCy NER and apply POS span expansion."""
    if nlp is None:
        return {"time": None, "drop": None}

    doc      = nlp(text)
    time_val = None
    drop_val = None

    for ent in doc.ents:
        if ent.label_ == "TIME" and time_val is None:
            time_val = ent.text
        elif ent.label_ == "DROP" and drop_val is None:
            drop_val = expand_drop_span(text, ent.start_char, ent.end_char)

    return {"time": time_val, "drop": drop_val}


# ══════════════════════════════════════════════════════════
# TRANSFORMER EXTRACTOR (DistilBERT)
# ══════════════════════════════════════════════════════════

def load_transformer_model():
    """Load the fine-tuned DistilBERT model and tokenizer."""
    if not (TRANS_MODEL_DIR / "config.json").exists():
        return None, None

    tokenizer = AutoTokenizer.from_pretrained(str(TRANS_MODEL_DIR))
    model     = AutoModelForTokenClassification.from_pretrained(str(TRANS_MODEL_DIR))
    model.eval()
    print(f"  ✔  Transformer model loaded from {TRANS_MODEL_DIR}")
    return tokenizer, model


def extract_with_transformer(tokenizer, model, text: str) -> dict:
    """Run DistilBERT inference and return structured extraction."""
    if tokenizer is None or model is None:
        return {"time": None, "drop": None}

    words  = text.split()
    inputs = tokenizer(
        words,
        is_split_into_words=True,
        return_tensors="pt",
        padding=True,
        truncation=True,
        max_length=64,
    )

    with torch.no_grad():
        outputs = model(**inputs)

    logits   = outputs.logits[0]
    word_ids = inputs.word_ids(0)
    pred_ids = logits.argmax(dim=-1).tolist()

    # Map sub-tokens → first occurrence per word
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
# TEST SUITE
# ══════════════════════════════════════════════════════════

TEST_CASES = [
    {
        "text"    : "Mujhe 9:30 baje Sitabuldi jana hai",
        "expected": {"time": "9:30", "drop": "Sitabuldi"},
    },
    {
        "text"    : "I need to reach Civil Lines at 10 AM",
        "expected": {"time": "10 AM", "drop": "Civil Lines"},
    },
    {
        "text"    : "bhai mujhe 9:30 tak Dharampeth pahuchna hai please",
        "expected": {"time": "9:30", "drop": "Dharampeth"},
    },
    {
        "text"    : "Drop me at Wardha Road around 6:30",
        "expected": {"time": "6:30", "drop": "Wardha Road"},
    },
    {
        "text"    : "Airport jana hai 5:50 tak",
        "expected": {"time": "5:50", "drop": "Airport"},
    },
    {
        "text"    : "subah 9:00 baje VNIT jaana hai",
        "expected": {"time": "subah 9:00 baje", "drop": "VNIT"},
    },
    {
        "text"    : "Take me to Zero Mile by 8:45 AM",
        "expected": {"time": "8:45 AM", "drop": "Zero Mile"},
    },
    {
        "text"    : "Bajaj Nagar at 11 30 please",
        "expected": {"time": "11 30", "drop": "Bajaj Nagar"},
    },
    {
        "text"    : "Departure for Manish Nagar is exactly 10:30",
        "expected": {"time": "10:30", "drop": "Manish Nagar"},
    },
    {
        "text"    : "Reach Trimurti Nagar at 11:30 PM",
        "expected": {"time": "11:30 PM", "drop": "Trimurti Nagar"},
    },
    {
        "text"    : "Take me to Ramdeobaba University by 9:00 AM",
        "expected": {"time": "9:00 AM", "drop": "Ramdeobaba University"},
    },
    {
        "text"    : "Need drop at AIIMS Hospital Nagpur around 10:15",
        "expected": {"time": "10:15", "drop": "AIIMS Hospital Nagpur"},
    },
    {
        "text"    : "Drop me to VNIT Nagpur at 12 PM",
        "expected": {"time": "12 PM", "drop": "VNIT Nagpur"},
    },
    {
        "text"    : "Nagpur Railway Station at exactly 7 30",
        "expected": {"time": "7 30", "drop": "Nagpur Railway Station"},
    },
]


def format_result(val: str | None, expected: str | None) -> str:
    """Format extraction result with simple match indicator."""
    if val is None:
        return f"{'⚠  NOT FOUND':25s}"
    return f"{val:25s}"


def run_test_suite(nlp, tokenizer, model) -> None:
    """Execute all test cases and print a formatted report."""
    banner("TEST SUITE – HYBRID ENTITY EXTRACTION")

    ner_time_hits  = 0
    ner_drop_hits  = 0
    trans_time_hits = 0
    trans_drop_hits = 0

    for idx, case in enumerate(TEST_CASES, 1):
        text    = case["text"]
        exp_t   = case["expected"]["time"]
        exp_d   = case["expected"]["drop"]

        ner_res   = extract_with_ner(nlp, text)
        trans_res = extract_with_transformer(tokenizer, model, text)

        # Soft match (case-insensitive substring)
        def soft_match(got, exp):
            if got is None or exp is None:
                return False
            return exp.lower() in got.lower() or got.lower() in exp.lower()

        nt = soft_match(ner_res["time"], exp_t)
        nd = soft_match(ner_res["drop"], exp_d)
        tt = soft_match(trans_res["time"], exp_t)
        td = soft_match(trans_res["drop"], exp_d)

        ner_time_hits  += int(nt)
        ner_drop_hits  += int(nd)
        trans_time_hits += int(tt)
        trans_drop_hits += int(td)

        sep = "─" * 64
        print(f"\n  ┌{sep}┐")
        print(f"  │  Test #{idx:>2}                                                  │")
        print(f"  │  INPUT     : {text:<49}│")
        print(f"  ├{sep}┤")
        print(f"  │  [NER]     TIME  : {format_result(ner_res['time'], exp_t)}  DROP : {format_result(ner_res['drop'], exp_d)} │")
        print(f"  │  [TRANSF]  TIME  : {format_result(trans_res['time'], exp_t)}  DROP : {format_result(trans_res['drop'], exp_d)} │")
        print(f"  └{sep}┘")

    n = len(TEST_CASES)
    banner("ACCURACY SUMMARY")
    print(f"  {'Model':<15} {'TIME Hits':>12}  {'DROP Hits':>12}  {'Avg %':>8}")
    print(f"  {'─'*55}")

    def pct(hits):
        return f"{100 * hits / n:.1f}%"

    ner_avg   = 50 * (ner_time_hits + ner_drop_hits) / n
    trans_avg = 50 * (trans_time_hits + trans_drop_hits) / n

    print(f"  {'spaCy NER':<15} {ner_time_hits:>10}/{n}  {ner_drop_hits:>10}/{n}  {ner_avg:>7.1f}%")
    print(f"  {'DistilBERT':<15} {trans_time_hits:>10}/{n}  {trans_drop_hits:>10}/{n}  {trans_avg:>7.1f}%")

    winner = "spaCy NER" if ner_avg >= trans_avg else "DistilBERT"
    print(f"\n  🏆  Best model  : {winner}")
    print(f"  💡  Hybrid uses NER first; falls back to Transformer when needed.")


# ══════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════

def main():
    banner("QuickRide – Hybrid Model Testing Suite")

    if not check_models_exist():
        sys.exit(1)

    # ── Load models
    banner("LOADING MODELS")
    nlp               = load_ner_model()
    tokenizer, model  = load_transformer_model()

    # ── Run tests
    run_test_suite(nlp, tokenizer, model)

    banner("TESTING COMPLETE ✔", char="═")


if __name__ == "__main__":
    main()
