import json

with open('ai-service/dataset/dataset.json', 'r') as f:
    data = json.load(f)

new_examples = [
    ('Mujhe 9:30 baje Ramdeobaba University jana hai', 'TIME', '9:30', 'DROP', 'Ramdeobaba University'),
    ('I need to reach VNIT Nagpur by 10 AM', 'TIME', '10 AM', 'DROP', 'VNIT Nagpur'),
    ('AIIMS Hospital Nagpur jana hai around 11:15', 'TIME', '11:15', 'DROP', 'AIIMS Hospital Nagpur'),
    ('Nagpur Railway Station drop kardo 5:30 tak', 'TIME', '5:30', 'DROP', 'Nagpur Railway Station'),
    ('Dr Babasaheb Ambedkar Airport at 8:45 PM please', 'TIME', '8:45 PM', 'DROP', 'Dr Babasaheb Ambedkar Airport'),
    ('Take me to Civil Lines Nagpur by 6:00', 'TIME', '6:00', 'DROP', 'Civil Lines Nagpur'),
    ('kal dopahar 2 baje Dharampeth Market Area nikalna hai', 'TIME', '2 baje', 'DROP', 'Dharampeth Market Area'),
    ('Can you drop me at Ramdeobaba University by 9:00 AM?', 'TIME', '9:00 AM', 'DROP', 'Ramdeobaba University'),
    ('VNIT Nagpur pahuchna hai 7:30 tak', 'TIME', '7:30', 'DROP', 'VNIT Nagpur'),
    ('Need a ride to AIIMS Hospital Nagpur at 4:20 PM', 'TIME', '4:20 PM', 'DROP', 'AIIMS Hospital Nagpur'),
    ('Drop at Nagpur Railway Station around 11:30 PM', 'TIME', '11:30 PM', 'DROP', 'Nagpur Railway Station'),
    ('Flight hai Dr Babasaheb Ambedkar Airport jana hai 3 AM ko', 'TIME', '3 AM', 'DROP', 'Dr Babasaheb Ambedkar Airport'),
    ('Civil Lines Nagpur me utar dena subah 10 baje', 'TIME', '10 baje', 'DROP', 'Civil Lines Nagpur'),
    ('Dharampeth Market Area chalna hai 5:00 PM tak', 'TIME', '5:00 PM', 'DROP', 'Dharampeth Market Area'),
    ('Please drop me to Ramdeobaba University around 8:15 AM', 'TIME', '8:15 AM', 'DROP', 'Ramdeobaba University'),
    ('Reached VNIT Nagpur by 9:45 AM please', 'TIME', '9:45 AM', 'DROP', 'VNIT Nagpur'),
    ('Take me to AIIMS Hospital Nagpur at exactly 12:30', 'TIME', '12:30', 'DROP', 'AIIMS Hospital Nagpur'),
    ('Nagpur Railway Station drop me at 1:15 PM', 'TIME', '1:15 PM', 'DROP', 'Nagpur Railway Station'),
    ('Dr Babasaheb Ambedkar Airport pahuchna hai 7:00 AM tak', 'TIME', '7:00 AM', 'DROP', 'Dr Babasaheb Ambedkar Airport'),
    ('Mujhe kal sham 6 baje Civil Lines Nagpur jana hai', 'TIME', '6 baje', 'DROP', 'Civil Lines Nagpur'),
    ('Dharampeth Market Area at 11:00 AM', 'TIME', '11:00 AM', 'DROP', 'Dharampeth Market Area'),
    ('Ramdeobaba University at 10 30', 'TIME', '10 30', 'DROP', 'Ramdeobaba University'),
    ('VNIT Nagpur at 8:45', 'TIME', '8:45', 'DROP', 'VNIT Nagpur'),
    ('AIIMS Hospital Nagpur around 4 15', 'TIME', '4 15', 'DROP', 'AIIMS Hospital Nagpur'),
    ('Nagpur Railway Station around 5:00', 'TIME', '5:00', 'DROP', 'Nagpur Railway Station'),
    ('Dr Babasaheb Ambedkar Airport jana hai 12 baje', 'TIME', '12 baje', 'DROP', 'Dr Babasaheb Ambedkar Airport'),
    ('Civil Lines Nagpur around 9 15', 'TIME', '9 15', 'DROP', 'Civil Lines Nagpur'),
    ('Dharampeth Market Area around 1 30', 'TIME', '1 30', 'DROP', 'Dharampeth Market Area'),
    ('Pick me up and drop at Ramdeobaba University at 2:00 PM', 'TIME', '2:00 PM', 'DROP', 'Ramdeobaba University'),
    ('I want to reach VNIT Nagpur before 10.30 AM', 'TIME', '10.30 AM', 'DROP', 'VNIT Nagpur'),
    ('Go to AIIMS Hospital Nagpur by 2.15 PM', 'TIME', '2.15 PM', 'DROP', 'AIIMS Hospital Nagpur'),
    ('Drop me to Nagpur Railway Station by 11.45 AM', 'TIME', '11.45 AM', 'DROP', 'Nagpur Railway Station'),
    ('Take me to Dr Babasaheb Ambedkar Airport by 3.30 PM', 'TIME', '3.30 PM', 'DROP', 'Dr Babasaheb Ambedkar Airport'),
    ('I need to be at Civil Lines Nagpur by 4.00 PM', 'TIME', '4.00 PM', 'DROP', 'Civil Lines Nagpur'),
    ('Let us go to Dharampeth Market Area by 6.30 PM', 'TIME', '6.30 PM', 'DROP', 'Dharampeth Market Area'),
    ('Ramdeobaba University drop kar dena around 8.00 AM', 'TIME', '8.00 AM', 'DROP', 'Ramdeobaba University'),
    ('VNIT Nagpur chalte hai 9.15 ko', 'TIME', '9.15', 'DROP', 'VNIT Nagpur'),
    ('AIIMS Hospital Nagpur chalte hai 1.45 PM tak', 'TIME', '1.45 PM', 'DROP', 'AIIMS Hospital Nagpur'),
    ('Nagpur Railway Station par 7.00 baje drop karna', 'TIME', '7.00 baje', 'DROP', 'Nagpur Railway Station'),
    ('Dr Babasaheb Ambedkar Airport par 10.00 PM tak chhod dena', 'TIME', '10.00 PM', 'DROP', 'Dr Babasaheb Ambedkar Airport'),
    ('Civil Lines Nagpur ko 12.30 ko jana hai', 'TIME', '12.30', 'DROP', 'Civil Lines Nagpur'),
    ('Dharampeth Market Area around 3.15 PM', 'TIME', '3.15 PM', 'DROP', 'Dharampeth Market Area'),
    ('I have to reach Ramdeobaba University by 4:45 PM', 'TIME', '4:45 PM', 'DROP', 'Ramdeobaba University'),
    ('Drive to VNIT Nagpur at 5:30 PM', 'TIME', '5:30 PM', 'DROP', 'VNIT Nagpur'),
    ('AIIMS Hospital Nagpur take me there by 6:15 PM', 'TIME', '6:15 PM', 'DROP', 'AIIMS Hospital Nagpur'),
    ('Nagpur Railway Station is my drop at 8:00 PM', 'TIME', '8:00 PM', 'DROP', 'Nagpur Railway Station'),
    ('Take me to Dr Babasaheb Ambedkar Airport at 9:30 PM', 'TIME', '9:30 PM', 'DROP', 'Dr Babasaheb Ambedkar Airport'),
    ('Civil Lines Nagpur drop me off around 10:15', 'TIME', '10:15', 'DROP', 'Civil Lines Nagpur'),
    ('Dharampeth Market Area drop me by 11:30', 'TIME', '11:30', 'DROP', 'Dharampeth Market Area'),
]

for text, label1, val1, label2, val2 in new_examples:
    start1 = text.find(val1)
    end1 = start1 + len(val1)
    start2 = text.find(val2)
    end2 = start2 + len(val2)
    ents = []
    if start1 != -1: ents.append([start1, end1, label1])
    if start2 != -1: ents.append([start2, end2, label2])
    data.append({ 'text': text, 'entities': ents })

with open('ai-service/dataset/dataset.json', 'w') as f:
    json.dump(data, f, indent=2)

print(f"Successfully added {len(new_examples)} new multi-word examples to dataset!")
