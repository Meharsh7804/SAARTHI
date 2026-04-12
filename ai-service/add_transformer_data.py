import json
import random

new_data = [
    # Multi-intent, indirectly phrasing, preference
    {
        "text": "Bhai mujhe pehle IT Park jaana hai phir 10:30 tak Civil Lines pahuchna hai, make it the fastest route",
        "entities": [
            [23, 30, "DROP"],  # IT Park
            [40, 45, "TIME"],  # 10:30
            [50, 61, "DROP"],  # Civil Lines
            [88, 95, "PREFERENCE"]  # fastest
        ]
    },
    {
        "text": "Kal subah 8 baje VNIT jaana hai but traffic kam wala safest route lena",
        "entities": [
            [10, 16, "TIME"],  # 8 baje
            [17, 21, "DROP"],  # VNIT
            [53, 59, "PREFERENCE"]  # safest
        ]
    },
    {
        "text": "Reach airport before 9, jo safest ho wo route lena",
        "entities": [
            [6, 13, "DROP"],   # airport
            [21, 22, "TIME"],  # 9
            [27, 33, "PREFERENCE"] # safest
        ]
    },
    {
        "text": "Office jana hai around 10 but jaldi pahucha de please, i want cheapest",
        "entities": [
            [0, 6, "DROP"],    # Office
            [23, 25, "TIME"],  # 10
            [62, 70, "PREFERENCE"] # cheapest
        ]
    },
    {
         "text": "Mujhe 9 30 tak Manish Nagar le chalo, I need the fastest route",
         "entities": [
             [6, 10, "TIME"], # 9 30
             [15, 27, "DROP"], # Manish Nagar
             [49, 56, "PREFERENCE"] # fastest
         ]
    },
    {
         "text": "Drop me at Sitabuldi at 9.30, use fastest path",
         "entities": [
             [11, 20, "DROP"], # Sitabuldi
             [24, 28, "TIME"], # 9.30
             [34, 41, "PREFERENCE"] # fastest
         ]
    },
    {
         "text": "Take me to Dharampeth by morning 9 baje, safest ride only",
         "entities": [
             [11, 21, "DROP"],  # Dharampeth
             [25, 39, "TIME"],  # morning 9 baje
             [41, 47, "PREFERENCE"] # safest
         ]
    },
    {
         "text": "cheap ride to Medical Square at 8:45 PM",
         "entities": [
             [0, 5, "PREFERENCE"], # cheap
             [14, 28, "DROP"], # Medical Square
             [32, 39, "TIME"] # 8:45 PM
         ]
    },
    {
         "text": "I have to be at Sadar at 23:00, safest path is a must",
         "entities": [
             [16, 21, "DROP"], # Sadar
             [25, 30, "TIME"], # 23:00
             [32, 38, "PREFERENCE"] # safest
         ]
    },
    {
         "text": "jaldi le chalo, fastest route to Wadi, time info 10:15",
         "entities": [
             [16, 23, "PREFERENCE"], # fastest
             [33, 37, "DROP"], # Wadi
             [49, 54, "TIME"] # 10:15
         ]
    },
    {
         "text": "safest option to Wardhaman Nagar for 7:30",
         "entities": [
             [0, 6, "PREFERENCE"], # safest
             [17, 32, "DROP"], # Wardhaman Nagar
             [37, 41, "TIME"] # 7:30
         ]
    },
    {
         "text": "Need cheapest cab to hingna at evening 5, safely bhi thoda theek hai but main is cheapest",
         "entities": [
             [5, 13, "PREFERENCE"], # cheapest
             [21, 27, "DROP"], # hingna
             [31, 40, "TIME"], # evening 5
             [82, 90, "PREFERENCE"] # cheapest
         ]
    },
    {
         "text": "Subah subah 9 baje Gittikhadan drop kardo fast driver cheapest route",
         "entities": [
             [12, 18, "TIME"], # 9 baje
             [19, 31, "DROP"], # Gittikhadan
             [55, 63, "PREFERENCE"] # cheapest
         ]
    },
    {
         "text": "Drop at Pratap Nagar by 8 15 AM, whatever is fastest",
         "entities": [
             [8, 20, "DROP"], # Pratap Nagar
             [24, 31, "TIME"], # 8 15 AM
             [45, 52, "PREFERENCE"] # fastest
         ]
    },
    {
         "text": "Pls safest and cheap cab to Somalwada till 10",
         "entities": [
             [4, 10, "PREFERENCE"], # safest
             [15, 20, "PREFERENCE"], # cheap
             [28, 37, "DROP"], # Somalwada
             [43, 45, "TIME"] # 10
         ]
    }
]

file_path = "dataset/dataset.json"
with open(file_path, "r", encoding="utf-8") as f:
    data = json.load(f)

# Optional: Add multiple variations for robustness
for i in range(10):
    for entry in new_data:
        data.append(entry)

with open(file_path, "w", encoding="utf-8") as f:
    json.dump(data, f, indent=2)

print("Added", len(new_data) * 10, "entries to dataset")
