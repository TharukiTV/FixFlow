"""Lesson 7: a local FastAPI service with explicitly labelled demo responses."""
import os
from typing import Literal
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, ConfigDict, Field

app = FastAPI(title="FixFlow incident analysis", version="0.1.0",
              description="Gemini suggestions for human review; optional explicit demo mode.")

class IncidentInput(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    description: str = Field(min_length=1, max_length=2000)
    location: str = Field(min_length=1, max_length=120)

class Analysis(BaseModel):
    mode: Literal["DEMO", "GEMINI"] = "DEMO"
    category: Literal["IT", "PLUMBING", "ELECTRICAL", "FURNITURE", "SAFETY", "GENERAL"]
    priority: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL", "UNASSESSED"]
    summary: str
    notice: str = "Sample output from keyword examples, not AI. Priority needs human review."

@app.get("/health")
def health():
    return {"status": "ok", "mode": os.getenv("AI_MODE", "gemini").upper(),
            "configured": bool(os.getenv("GEMINI_API_KEY", "").strip())}

@app.post("/ai/analyze-incident", response_model=Analysis)
async def analyze_incident(report: IncidentInput) -> Analysis:
    mode = os.getenv("AI_MODE", "gemini").lower()
    if mode == "gemini":
        from app.gemini import analyze_with_gemini
        result = await analyze_with_gemini(report.model_dump())
        return Analysis(mode="GEMINI", **result.model_dump(),
                        notice="AI suggestion from Gemini. A staff member must review category and urgency.")
    if mode != "demo":
        raise HTTPException(503, "Invalid AI_MODE. Use gemini or demo.")
    return demo_analysis(report)

def demo_analysis(report: IncidentInput) -> Analysis:
    description = report.description.casefold()
    # Simple examples for learning request/response flow. Replace with a model later.
    if any(word in description for word in ("wi-fi", "wifi", "projector", "internet")):
        return Analysis(category="IT", priority="MEDIUM",
                        summary="Example IT report. An IT staff member should review the details.")
    if any(word in description for word in ("leak", "pipe", "tap")):
        return Analysis(category="PLUMBING", priority="UNASSESSED",
                        summary="Example plumbing report. A staff member must assess the issue and urgency.")
    return Analysis(category="GENERAL", priority="UNASSESSED",
                    summary="No demo example matched. A staff member should classify this report.")
