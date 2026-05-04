from fastapi import FastAPI, UploadFile, File, HTTPException
from app.parser import parse_pdf

app = FastAPI()

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/parse")
async def parse(file: UploadFile = File(...)):
    try:
        buffer = await file.read()
        if not buffer:
            raise HTTPException(status_code=400, detail="Empty upload")

        result = parse_pdf(buffer)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"parse_failed: {str(e)}")