"""Local test-only replacement for Gemini. Run with the AI service virtualenv."""
from fastapi import FastAPI
from fastapi.responses import JSONResponse
import uvicorn
app=FastAPI()
@app.post('/ai/analyze-incident')
def analyze(data:dict):
    result={'mode':'GEMINI','category':'IT','priority':'MEDIUM','summary':'Fixture summary','notice':'Fixture only'}
    if 'invalid' in data['description']: result['category']='UNSUPPORTED'
    return JSONResponse(result,status_code=503 if 'unavailable' in data['description'] else 200)
if __name__=='__main__': uvicorn.run(app,host='127.0.0.1',port=8001)
