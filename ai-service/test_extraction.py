
import sys
from pathlib import Path
sys.path.append(str(Path(__file__).parent))

from app import load_models, hybrid_extract

load_models()

queries = [
    "Mujhe 9:30 baje Sitabuldi jana hai",
    "I need to reach IT Park by 10 AM",
    "Dharampeth jana hai 5:50 tak",
    "Take me to Airport around 6:30"
]

for q in queries:
    res = hybrid_extract(q)
    print(f"\nQUERY: {q}")
    print(f"EXTRACTED: {res.get('drop')} at {res.get('time')} via {res.get('source')}")
