from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from transformers import T5ForConditionalGeneration, T5Tokenizer
from deep_translator import GoogleTranslator
import requests
import re
import torch

app = FastAPI()

# --- SECURITY: ALLOW CHROME EXTENSION TO CONNECT ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all connections
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 1. LOAD THE AI MODEL ---
MODEL_PATH = "./model"
print("Loading model...")
try:
    # Try loading your custom trained model first
    tokenizer = T5Tokenizer.from_pretrained(MODEL_PATH)
    model = T5ForConditionalGeneration.from_pretrained(MODEL_PATH)
    print("✅ Custom Model loaded successfully!")
except Exception as e:
    print(f"⚠️ Custom model not found ({e}). Downloading base t5-small...")
    # Fallback to base model if yours isn't found
    tokenizer = T5Tokenizer.from_pretrained("t5-small")
    model = T5ForConditionalGeneration.from_pretrained("t5-small")

# --- DATA MODELS ---
class TextRequest(BaseModel):
    text: str
    target_lang: str = "en"  # Default to English if not specified

# --- HELPER: CALCULATE TEXT COMPLEXITY ---
def calculate_complexity(text):
    """
    Estimates the 'Grade Level' of text using a Flesch-Kincaid heuristic.
    Required for the 'Complexity Dashboard' in the extension.
    """
    if not text: return 0
    words = text.split()
    num_words = len(words)
    if num_words == 0: return 0
    
    # Count sentences (split by . ! ?)
    sentences = re.split(r'[.!?]+', text)
    num_sentences = len([s for s in sentences if len(s.strip()) > 0])
    if num_sentences == 0: num_sentences = 1
    
    # Count syllables (rough heuristic)
    def count_syllables(word):
        word = word.lower()
        count = 0
        vowels = "aeiouy"
        if word[0] in vowels: count += 1
        for index in range(1, len(word)):
            if word[index] in vowels and word[index - 1] not in vowels:
                count += 1
        if word.endswith("e"): count -= 1
        if count == 0: count += 1
        return count
    
    num_syllables = sum(count_syllables(w) for w in words)
    
    # Formula for Grade Level
    score = 0.39 * (num_words / num_sentences) + 11.8 * (num_syllables / num_words) - 15.59
    return round(score, 1)

# --- ENDPOINT 1: HOME ---
@app.get("/")
def home():
    return {"status": "Dyslexia AI V2.0 (Multi-Lang & Voice Ready)"}

# --- ENDPOINT 2: SIMPLIFY (With Translation & Analytics) ---
@app.post("/simplify")
def simplify(request: TextRequest):
    try:
        # 1. Analyze Original Text Complexity
        original_score = calculate_complexity(request.text)
        
        # 2. Run AI Simplification
        input_text = "simplify: " + request.text
        inputs = tokenizer(input_text, return_tensors="pt").input_ids
        
        outputs = model.generate(
            inputs, 
            max_length=128, 
            num_beams=5, 
            early_stopping=True
        )
        simplified_text = tokenizer.decode(outputs[0], skip_special_tokens=True)
        
        # 3. Translate if user requested a different language
        if request.target_lang != "en":
            try:
                simplified_text = GoogleTranslator(source='auto', target=request.target_lang).translate(simplified_text)
            except Exception as e:
                print(f"Translation failed: {e}") 
                # If translation fails, keep English text but proceed

        # 4. Analyze New Text Complexity
        new_score = calculate_complexity(simplified_text)
        
        # Calculate percentage reduction
        reduction = 0
        if original_score > 0:
            reduction = round(((original_score - new_score) / original_score) * 100, 0)
        
        return {
            "original": request.text, 
            "simplified": simplified_text,
            "metrics": {
                "original_grade": original_score,
                "new_grade": new_score,
                "reduction": reduction
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINT 3: EXPLAIN (For Voice Tutor Mode) ---
@app.post("/explain")
def explain(request: TextRequest):
    try:
        # 1. Generate Explanation (Using 'summarize' task)
        input_text = "summarize: " + request.text
        inputs = tokenizer(input_text, return_tensors="pt").input_ids
        
        outputs = model.generate(
            inputs, 
            max_length=150, 
            min_length=30, 
            length_penalty=2.0, 
            num_beams=4, 
            early_stopping=True
        )
        explanation = tokenizer.decode(outputs[0], skip_special_tokens=True)

        # 2. Translate if user requested a different language
        if request.target_lang != "en":
            try:
                explanation = GoogleTranslator(source='auto', target=request.target_lang).translate(explanation)
            except Exception as e:
                print(f"Translation failed: {e}")

        return {"original": request.text, "explanation": explanation, "lang": request.target_lang}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINT 4: DEFINE (Dictionary) ---
@app.get("/define/{word}")
def define_word(word: str):
    try:
        # Use free Dictionary API
        url = f"https://api.dictionaryapi.dev/api/v2/entries/en/{word}"
        response = requests.get(url)
        
        if response.status_code == 200:
            data = response.json()
            try:
                definition = data[0]['meanings'][0]['definitions'][0]['definition']
            except:
                definition = "Definition not found in database."
            return {"word": word, "definition": definition}
        else:
            return {"word": word, "definition": "No definition found."}
    except Exception as e:
        return {"word": word, "definition": "Could not fetch definition."}