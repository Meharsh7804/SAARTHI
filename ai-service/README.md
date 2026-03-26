# QuickRide AI Service

A standalone, production-grade AI subsystem for extracting **ride booking intent** (pickup TIME and DROP/destination) from natural language + Hinglish text.

---

## 🏗️ Architecture

```
User Input (text)
       │
       ▼
  ┌────────────┐
  │ spaCy NER  │  ← custom-trained, fast, lightweight
  └────────────┘
       │
  Both TIME + DROP found?
   YES ──────────────────────────────► Return result  (source: "ner")
   NO
       │
       ▼
  ┌─────────────────────┐
  │ DistilBERT (HF)     │  ← fine-tuned token classification
  └─────────────────────┘
       │
       ▼
  Merge NER + Transformer results
       │
       ▼
  Return  { time, drop, source }
```

### Why NER + Transformer?

| Model | Strength | Weakness |
|---|---|---|
| spaCy NER | Fast, lightweight, no GPU needed | Less robust to unseen patterns |
| DistilBERT | Context-aware, handles Hinglish well | Slower, needs more memory |

The **hybrid approach** gets the best of both: speed from spaCy, accuracy from DistilBERT when needed.

---

## 📁 Folder Structure

```
ai-service/
├── dataset/
│   └── dataset.json          # 200+ English + Hinglish training examples
├── ner_model/                # Saved spaCy model (after training)
├── transformer_model/        # Saved DistilBERT model (after training)
├── train_ner.py              # Train the spaCy NER model
├── train_transformer.py      # Fine-tune DistilBERT for token classification
├── test_models.py            # Load both models, run test suite, print results
├── app.py                    # FastAPI hybrid API (POST /extract)
├── requirements.txt          # All Python dependencies
└── README.md                 # This file
```

---

## ⚙️ Setup

### 1. Create Virtual Environment

```bash
python -m venv venv

# Windows
venv\Scripts\activate

# Linux / macOS
source venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
python -m spacy download en_core_web_sm   # optional spaCy model
```

---

## 🚀 Usage

### Step 1 — Train the spaCy NER Model

```bash
python train_ner.py
```

**Expected output:**
```
══════════════════════════════════════════════════════════
  QuickRide – spaCy NER Model Trainer
══════════════════════════════════════════════════════════

  ✔  Loaded   : 241 raw examples
  ✔  Valid    : 239 usable examples

  Iter  10/ 80  │  NER Loss:   128.4312  │  Elapsed:  3.2s
  Iter  20/ 80  │  NER Loss:    67.2011  │  Elapsed:  6.4s
  ...
  Iter  80/ 80  │  NER Loss:     4.1023  │  Elapsed: 24.7s

  ✔  Final NER Loss : 4.1023
  ✔  Model saved to  → ai-service/ner_model/
```

### Step 2 — Train the Transformer Model

```bash
python train_transformer.py
```

**Expected output:**
```
  Device   : CPU
  Model    : distilbert-base-uncased
  Labels   : ['O', 'B-TIME', 'I-TIME', 'B-DROP', 'I-DROP']

  Training...   Epoch 1/5  Loss: 0.8432
  Training...   Epoch 2/5  Loss: 0.3211
  ...
  ✔  Training loss  : 0.1842
  ✔  Model saved to  → ai-service/transformer_model/
```

> **Note:** DistilBERT training may take 5-20 minutes on CPU. A GPU is recommended.

### Step 3 — Run Tests

```bash
python test_models.py
```

**Expected output:**
```
  ┌────────────────────────────────────────────────────────────────┐
  │  Test # 1                                                      │
  │  INPUT     : Mujhe 9:30 baje Sitabuldi jana hai               │
  ├────────────────────────────────────────────────────────────────┤
  │  [NER]     TIME  : 9:30                    DROP : Sitabuldi   │
  │  [TRANSF]  TIME  : 9:30                    DROP : Sitabuldi   │
  └────────────────────────────────────────────────────────────────┘

  ACCURACY SUMMARY
  Model           TIME Hits     DROP Hits    Avg %
  ─────────────────────────────────────────────────
  spaCy NER           9/10          9/10    90.0%
  DistilBERT          8/10          8/10    80.0%
```

### Step 4 — Start the API Server

```bash
uvicorn app:app --reload --port 8001
```

API docs available at: **http://localhost:8001/docs**

---

## 🔌 API Reference

### `POST /extract`

Extract TIME and DROP from any ride booking text.

**Request:**
```json
{
  "text": "Mujhe 9:30 baje Sitabuldi jana hai"
}
```

**Response:**
```json
{
  "text"   : "Mujhe 9:30 baje Sitabuldi jana hai",
  "time"   : "9:30",
  "drop"   : "Sitabuldi",
  "source" : "ner",
  "details": {
    "ner_result"         : { "time": "9:30", "drop": "Sitabuldi" },
    "transformer_result" : { "time": "9:30", "drop": "Sitabuldi" },
    "ner_used"           : true,
    "transformer_used"   : false
  }
}
```

| Field | Description |
|---|---|
| `time` | Extracted pickup time (or `null`) |
| `drop` | Extracted destination (or `null`) |
| `source` | `"ner"` / `"transformer"` / `"hybrid"` |

### Other Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/` | Health check |
| GET | `/health` | Model load status |
| POST | `/extract` | Hybrid extraction |
| POST | `/extract/ner-only` | spaCy only |
| POST | `/extract/transformer-only` | DistilBERT only |

---

## 🧪 Sample Test Inputs

| Input | Expected TIME | Expected DROP |
|---|---|---|
| Mujhe 9:30 baje Sitabuldi jana hai | 9:30 | Sitabuldi |
| I need to reach Civil Lines at 10 AM | 10 AM | Civil Lines |
| bhai mujhe 9:30 tak Dharampeth pahuchna hai | 9:30 | Dharampeth |
| Airport jana hai 5:50 tak | 5:50 | Airport |
| subah 9:00 baje VNIT jaana hai | subah 9:00 baje | VNIT |

---

## 🔒 Notes

- This module is **standalone** and does NOT integrate with the main Backend/Frontend yet.
- No existing code is modified.
- The dataset uses Nagpur-area place names common in QuickRide's target market.
