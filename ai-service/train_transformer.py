"""
=============================================================
train_transformer.py  –  DistilBERT Token Classification Trainer
=============================================================
Fine-tunes DistilBERT for NER (TOKEN CLASSIFICATION), learning
to extract:
  • TIME  – pickup time
  • DROP  – destination location

Labels follow the BIO (B-I-O) tagging scheme:
  B-TIME, I-TIME, B-DROP, I-DROP, O

Usage:
    python train_transformer.py

Output:
    Model saved to  ai-service/transformer_model/
=============================================================
"""

# ── Fix: Windows OpenMP runtime conflict (Anaconda + torch) ──────────────────
import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"
import sys
sys.stdout.reconfigure(encoding='utf-8')
sys.stderr.reconfigure(encoding='utf-8')

import json
import random
from pathlib import Path

import numpy as np

# ── Hugging Face imports ───────────────────────────────────
from transformers import (
    AutoTokenizer,
    AutoModelForTokenClassification,
    TrainingArguments,
    Trainer,
    DataCollatorForTokenClassification,
)
from datasets import Dataset
import torch

# ── Paths ─────────────────────────────────────────────────
BASE_DIR      = Path(__file__).parent
DATASET_PATH  = BASE_DIR / "dataset" / "dataset.json"
MODEL_DIR     = BASE_DIR / "transformer_model"

# ── Model configuration ───────────────────────────────────
MODEL_NAME    = "distilbert-base-uncased"

# ── Label scheme (BIO) ────────────────────────────────────
LABEL_LIST    = ["O", "B-TIME", "I-TIME", "B-DROP", "I-DROP", "B-PREFERENCE", "I-PREFERENCE"]
LABEL2ID      = {l: i for i, l in enumerate(LABEL_LIST)}
ID2LABEL      = {i: l for i, l in enumerate(LABEL_LIST)}

# ── Training hyperparameters ──────────────────────────────
NUM_EPOCHS    = 5
BATCH_SIZE    = 16
LR            = 2e-5
SEED          = 42

random.seed(SEED)
np.random.seed(SEED)


# ══════════════════════════════════════════════════════════
# HELPERS
# ══════════════════════════════════════════════════════════

def banner(msg: str, char: str = "═") -> None:
    width = 60
    print("\n" + char * width)
    print(f"  {msg}")
    print(char * width)


# ══════════════════════════════════════════════════════════
# DATA CONVERSION
# ══════════════════════════════════════════════════════════

def char_to_token_labels(text: str, entities: list) -> tuple[list[str], list[str]]:
    """
    Convert character-level entity spans to word-level BIO tags.
    Returns (tokens, labels).
    """
    words  = text.split()
    labels = ["O"] * len(words)

    # Re-build character→word index mapping
    char_to_word = {}
    char_idx = 0
    for w_idx, word in enumerate(words):
        for _ in word:
            char_to_word[char_idx] = w_idx
            char_idx += 1
        char_to_word[char_idx] = None  # space
        char_idx += 1  # account for space

    for (start, end, label) in entities:
        # Collect all word indices covered by this span
        word_indices = set()
        for c in range(start, end):
            if c in char_to_word and char_to_word[c] is not None:
                word_indices.add(char_to_word[c])

        for i, w_idx in enumerate(sorted(word_indices)):
            if w_idx < len(labels):
                if i == 0:
                    labels[w_idx] = f"B-{label}"
                else:
                    labels[w_idx] = f"I-{label}"

    return words, labels


def load_as_hf_dataset(path: Path) -> Dataset:
    """Load JSON → convert to Hugging Face Dataset with BIO labels."""
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    records = []
    skipped = 0

    for item in raw:
        try:
            tokens, ner_tags = char_to_token_labels(item["text"], item["entities"])
            if len(tokens) == 0:
                skipped += 1
                continue
            records.append({
                "tokens"  : tokens,
                "ner_tags": [LABEL2ID[t] for t in ner_tags],
            })
        except Exception:
            skipped += 1

    print(f"  ✔  Loaded   : {len(raw)} raw examples")
    print(f"  ✔  Converted: {len(records)} examples")
    print(f"  ⚠  Skipped  : {skipped} problematic examples")

    random.shuffle(records)
    split = int(0.85 * len(records))
    train_records = records[:split]
    eval_records  = records[split:]

    print(f"  ✔  Train    : {len(train_records)}")
    print(f"  ✔  Eval     : {len(eval_records)}")

    train_ds = Dataset.from_list(train_records)
    eval_ds  = Dataset.from_list(eval_records)
    return train_ds, eval_ds


# ══════════════════════════════════════════════════════════
# TOKENISATION
# ══════════════════════════════════════════════════════════

def tokenize_and_align(tokenizer, examples):
    """
    Tokenize word-split tokens and align BIO labels with
    sub-word pieces from DistilBERT.
    Uses -100 for ignored positions (CLS/SEP/padding).
    """
    tokenized = tokenizer(
        examples["tokens"],
        truncation=True,
        is_split_into_words=True,
        padding="max_length",
        max_length=64,
    )

    all_labels = []
    for i, label_ids in enumerate(examples["ner_tags"]):
        word_ids    = tokenized.word_ids(batch_index=i)
        prev_word_id = None
        new_labels  = []

        for word_id in word_ids:
            if word_id is None:
                new_labels.append(-100)       # CLS / SEP / PAD
            elif word_id != prev_word_id:
                new_labels.append(label_ids[word_id])   # first sub-token
            else:
                # Subsequent sub-tokens of same word → -100 (ignore)
                new_labels.append(-100)
            prev_word_id = word_id

        all_labels.append(new_labels)

    tokenized["labels"] = all_labels
    return tokenized


# ══════════════════════════════════════════════════════════
# EVALUATION
# ══════════════════════════════════════════════════════════

def compute_metrics(p):
    """Entity-level F1 using seqeval if available, else token accuracy."""
    predictions, labels = p
    preds = np.argmax(predictions, axis=2)

    try:
        from seqeval.metrics import (
            classification_report,
            f1_score,
            precision_score,
            recall_score,
        )

        true_preds  = []
        true_labels = []

        for pred_row, label_row in zip(preds, labels):
            p_seq = []
            l_seq = []
            for pd, lb in zip(pred_row, label_row):
                if lb != -100:
                    p_seq.append(ID2LABEL[pd])
                    l_seq.append(ID2LABEL[lb])
            true_preds.append(p_seq)
            true_labels.append(l_seq)

        results = {
            "precision": precision_score(true_labels, true_preds),
            "recall"   : recall_score(true_labels, true_preds),
            "f1"       : f1_score(true_labels, true_preds),
        }
        return results

    except ImportError:
        # Fallback: simple token accuracy
        correct = total = 0
        for pred_row, label_row in zip(preds, labels):
            for pd, lb in zip(pred_row, label_row):
                if lb != -100:
                    total += 1
                    correct += int(pd == lb)
        return {"token_accuracy": correct / max(total, 1)}


# ══════════════════════════════════════════════════════════
# DEMO PREDICTIONS
# ══════════════════════════════════════════════════════════

DEMO_INPUTS = [
    "Mujhe 9:30 baje Sitabuldi jana hai",
    "I need to reach Civil Lines at 10 AM",
    "bhai mujhe 9:30 tak Dharampeth pahuchna hai please",
    "Airport jana hai 5:50 tak",
    "Take me to Zero Mile by 8:45 AM",
    "Bajaj Nagar at 11 30 please",
]


def run_inference_demo(tokenizer, model) -> None:
    """Show sample predictions from the trained transformer."""
    banner("SAMPLE PREDICTIONS (POST-TRAINING)")
    model.eval()

    for text in DEMO_INPUTS:
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

        # Map sub-tokens back to words
        word_preds: dict[int, str] = {}
        for sub_idx, wid in enumerate(word_ids):
            if wid is not None and wid not in word_preds:
                word_preds[wid] = ID2LABEL[pred_ids[sub_idx]]

        time_tokens  = []
        drop_tokens  = []
        pref_tokens  = []
        for wid in sorted(word_preds):
            label = word_preds[wid]
            if label in ("B-TIME", "I-TIME"):
                time_tokens.append(words[wid])
            elif label in ("B-DROP", "I-DROP"):
                drop_tokens.append(words[wid])
            elif label in ("B-PREFERENCE", "I-PREFERENCE"):
                pref_tokens.append(words[wid])

        time_val = " ".join(time_tokens) if time_tokens else "⚠ NOT FOUND"
        drop_val = " ".join(drop_tokens) if drop_tokens else "⚠ NOT FOUND"
        pref_val = " ".join(pref_tokens) if pref_tokens else "⚠ NOT FOUND"

        print(f"\n  INPUT  : {text}")
        print(f"  ┌─ TIME : {time_val}")
        print(f"  ├─ DROP : {drop_val}")
        print(f"  └─ PREF : {pref_val}")


# ══════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════

def main():
    banner("QuickRide – DistilBERT Transformer Trainer")

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n  Device   : {device.upper()}")
    print(f"  Model    : {MODEL_NAME}")
    print(f"  Labels   : {LABEL_LIST}")

    # ── 1. Load dataset
    banner("LOADING & CONVERTING DATASET")
    train_ds, eval_ds = load_as_hf_dataset(DATASET_PATH)

    # ── 2. Tokenizer
    banner("LOADING TOKENIZER")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
    print(f"  ✔  Tokenizer loaded: {MODEL_NAME}")

    # ── 3. Tokenize datasets
    banner("TOKENIZING DATASET")
    train_tokenized = train_ds.map(
        lambda ex: tokenize_and_align(tokenizer, ex),
        batched=True,
    )
    eval_tokenized = eval_ds.map(
        lambda ex: tokenize_and_align(tokenizer, ex),
        batched=True,
    )
    print(f"  ✔  Train tokenized: {len(train_tokenized)} rows")
    print(f"  ✔  Eval  tokenized: {len(eval_tokenized)} rows")

    # ── 4. Load model
    banner("LOADING MODEL")
    model = AutoModelForTokenClassification.from_pretrained(
        MODEL_NAME,
        num_labels=len(LABEL_LIST),
        id2label=ID2LABEL,
        label2id=LABEL2ID,
    )
    print(f"  ✔  Model loaded: {MODEL_NAME}")
    print(f"  ✔  Output labels: {len(LABEL_LIST)}")

    # ── 5. Training arguments
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_DIR = BASE_DIR / "transformer_checkpoints"

    training_args = TrainingArguments(
        output_dir            = str(CHECKPOINT_DIR),
        num_train_epochs      = NUM_EPOCHS,
        per_device_train_batch_size = BATCH_SIZE,
        per_device_eval_batch_size  = BATCH_SIZE,
        learning_rate         = LR,
        weight_decay          = 0.01,
        eval_strategy         = "epoch",
        save_strategy         = "epoch",
        load_best_model_at_end= True,
        logging_dir           = str(CHECKPOINT_DIR / "logs"),
        logging_steps         = 10,
        seed                  = SEED,
        report_to             = "none",     # no wandb / tensorboard
    )

    data_collator = DataCollatorForTokenClassification(tokenizer)

    # ── 6. Train
    banner("TRAINING STARTED")
    print(f"  Epochs        : {NUM_EPOCHS}")
    print(f"  Batch size    : {BATCH_SIZE}")
    print(f"  Learning rate : {LR}")
    print()

    trainer = Trainer(
        model             = model,
        args              = training_args,
        train_dataset     = train_tokenized,
        eval_dataset      = eval_tokenized,
        processing_class  = tokenizer,   # replaces deprecated 'tokenizer' in v5
        data_collator     = data_collator,
        compute_metrics   = compute_metrics,
    )

    train_result = trainer.train()
    banner("TRAINING COMPLETE", char="─")
    print(f"  ✔  Training loss  : {train_result.training_loss:.4f}")
    print(f"  ✔  Steps          : {train_result.global_step}")
    print(f"  ✔  Runtime        : {train_result.metrics.get('train_runtime', 0):.1f}s")

    # ── 7. Evaluate
    banner("EVALUATION RESULTS")
    metrics = trainer.evaluate()
    for k, v in metrics.items():
        if isinstance(v, float):
            print(f"  {k:<30}: {v:.4f}")

    # ── 8. Save
    banner("SAVING MODEL")
    trainer.save_model(str(MODEL_DIR))
    tokenizer.save_pretrained(str(MODEL_DIR))
    print(f"  ✔  Model saved to  → {MODEL_DIR}")

    # ── 9. Demo
    run_inference_demo(tokenizer, model)

    banner("ALL DONE ✔", char="═")
    print(f"  Transformer model ready at: {MODEL_DIR}\n")


if __name__ == "__main__":
    main()
