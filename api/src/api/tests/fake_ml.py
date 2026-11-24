import time
from fastapi import FastAPI, File, HTTPException, UploadFile
app = FastAPI()

@app.post("/predict")
def predict(camera_id: str, image: UploadFile = File(...)):
    if camera_id == "missing":
        raise HTTPException(404, "No config for camera missing")
    if camera_id == "slow":
        time.sleep(35)  # longer than your 30 s ml_timeout
    return {"count": 1, "camera_id": camera_id, "occupied": 1, "free": 1, "unknown": 1,
            "spots": [{"spot_id": 1, "occupied": True, "overlap": 0.8},
                      {"spot_id": 2, "occupied": False, "overlap": 0.0},
                      {"spot_id": 3, "occupied": None, "overlap": None}]}