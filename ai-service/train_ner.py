"""
=============================================================
train_ner.py  –  Custom spaCy NER Model Trainer
=============================================================
Trains a Named Entity Recognition model to extract:
  • TIME  – pickup time mentioned in ride requests
  • DROP  – destination / drop location

Usage:
    python train_ner.py

Output:
    Model saved to  ai-service/ner_model/
=============================================================
"""

# ── Fix: Windows OpenMP runtime conflict (Anaconda + torch/spaCy) ──────────
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"

import json
import random
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')
from pathlib import Path
import time

# ── spaCy imports ─────────────────────────────────────────
import spacy
from spacy.training import Example
from spacy.util import minibatch, compounding

# ── Paths ─────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
DATASET     = BASE_DIR / "dataset" / "dataset.json"
MODEL_DIR   = BASE_DIR / "ner_model"

# ── Hyperparameters ───────────────────────────────────────
N_ITER      = 100       # training iterations
BATCH_START = 4         # compounding batch – start
BATCH_STOP  = 32        # compounding batch – stop
BATCH_COMP  = 1.001     # compounding factor
DROPOUT     = 0.1


# ══════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════

def banner(msg: str, char: str = "═") -> None:
    """Print a styled banner for clear PPT-friendly output."""
    width = 60
    print("\n" + char * width)
    print(f"  {msg}")
    print(char * width)


def load_dataset(path: Path) -> list:
    """Load and validate the JSON training data."""
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    validated = []
    skipped   = 0

    for item in raw:
        text     = item["text"]
        entities = item["entities"]

        # Basic boundary validation
        clean_ents = []
        for (start, end, label) in entities:
            if end <= len(text) and start >= 0 and start < end:
                clean_ents.append((start, end, label))
            else:
                skipped += 1

        if clean_ents:
            validated.append({"text": text, "entities": clean_ents})

    print(f"  ✔  Loaded   : {len(raw)} raw examples")
    print(f"  ✔  Valid    : {len(validated)} usable examples")
    print(f"  ⚠  Skipped  : {skipped} bad entity spans")
    return validated


def build_model() -> spacy.language.Language:
    """Create a blank spaCy English model and add NER pipeline."""
    nlp = spacy.blank("en")
    ner = nlp.add_pipe("ner", last=True)
    ner.add_label("TIME")
    ner.add_label("DROP")
    print("  ✔  spaCy blank 'en' model created")
    print("  ✔  NER pipe added  →  labels: TIME, DROP")
    return nlp


def make_examples(nlp, data: list) -> list:
    """Convert raw dicts to spaCy Example objects."""
    examples = []
    for item in data:
        doc  = nlp.make_doc(item["text"])
        ents = [(s, e, l) for s, e, l in item["entities"]]
        ann  = {"entities": ents}
        try:
            ex = Example.from_dict(doc, ann)
            examples.append(ex)
        except Exception:
            pass  # skip misaligned spans silently
    return examples


# ══════════════════════════════════════════════════════════
# TRAINING LOOP
# ══════════════════════════════════════════════════════════

def train(nlp, examples: list) -> None:
    """Run the full supervised NER training loop."""

    banner("TRAINING CONFIGURATION")
    print(f"  Iterations : {N_ITER}")
    print(f"  Examples   : {len(examples)}")
    print(f"  Dropout    : {DROPOUT}")
    print(f"  Batch      : {BATCH_START} → {BATCH_STOP} (compounding)")

    # Initialise the model weights
    nlp.initialize(lambda: examples)
    optimizer = nlp.get_pipe("ner").model.attrs.get("optimizer", None)

    banner("TRAINING STARTED", char="─")

    losses_history = []
    t_start = time.time()

    for iteration in range(1, N_ITER + 1):
        random.shuffle(examples)
        losses: dict = {}

        batches = minibatch(examples, size=compounding(BATCH_START, BATCH_STOP, BATCH_COMP))

        for batch in batches:
            nlp.update(batch, drop=DROPOUT, losses=losses)

        ner_loss = losses.get("ner", 0.0)
        losses_history.append(ner_loss)

        # Print every 10 iterations for clean output
        if iteration % 10 == 0 or iteration == 1:
            elapsed = time.time() - t_start
            print(f"  Iter {iteration:>3}/{N_ITER}  │  NER Loss: {ner_loss:>10.4f}  │  Elapsed: {elapsed:.1f}s")

    banner("TRAINING COMPLETE", char="─")
    print(f"  ✔  Final NER Loss : {losses_history[-1]:.4f}")
    print(f"  ✔  Best  NER Loss : {min(losses_history):.4f}")


# ══════════════════════════════════════════════════════════
# DEMO PREDICTIONS
# ══════════════════════════════════════════════════════════

SAMPLE_INPUTS = [
    "Mujhe 9:30 baje Sitabuldi jana hai",
    "I need to reach Civil Lines at 10 AM",
    "bhai mujhe 9:30 tak Dharampeth pahuchna hai please",
    "Drop me at Wardha Road around 6:30",
    "Airport jana hai 5:50 tak",
    "subah 9:00 baje VNIT jaana hai",
    "Take me to Zero Mile by 8:45 AM",
    "Bajaj Nagar at 11 30 please",
]


def run_demo(nlp) -> None:
    """Show sample predictions after training."""
    banner("SAMPLE PREDICTIONS (POST-TRAINING)")

    for text in SAMPLE_INPUTS:
        doc  = nlp(text)
        time_val = None
        drop_val = None

        for ent in doc.ents:
            if ent.label_ == "TIME":
                time_val = ent.text
            elif ent.label_ == "DROP":
                drop_val = ent.text

        print(f"\n  INPUT  : {text}")
        print(f"  ┌─ TIME : {time_val or '⚠ NOT FOUND'}")
        print(f"  └─ DROP : {drop_val or '⚠ NOT FOUND'}")


# ══════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════

def main():
    banner("QuickRide – spaCy NER Model Trainer")

    # ── 1. Load data
    banner("LOADING DATASET")
    data = load_dataset(DATASET)

    # ── 2. Build model
    banner("BUILDING MODEL")
    nlp = build_model()

    # ── 3. Convert to Examples
    examples = make_examples(nlp, data)
    print(f"  ✔  Converted {len(examples)} training examples")

    # ── 4. Train
    train(nlp, examples)

    # ── 5. Save model
    banner("SAVING MODEL")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    nlp.to_disk(str(MODEL_DIR))
    print(f"  ✔  Model saved to  → {MODEL_DIR}")

    # ── 6. Reload saved model and demo
    banner("RELOADING & VERIFYING SAVED MODEL")
    nlp_loaded = spacy.load(str(MODEL_DIR))
    print(f"  ✔  Model reloaded successfully from {MODEL_DIR}")

    run_demo(nlp_loaded)

    banner("ALL DONE ✔", char="═")
    print(f"  NER model ready at: {MODEL_DIR}\n")


if __name__ == "__main__":
    main()
