from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from api.db import get_db
from supabase import Client
from pydantic import BaseModel  
from api.config import settings
from api.auth import require_device
import httpx
from api.ml import predict_spots
from fastapi.concurrency import run_in_threadpool

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["GET","POST"],
    allow_headers=["Content-Type"],
)

class Lot(BaseModel):
    lot_id: int
    site_id: int
    lot_name: str

class Section(BaseModel):
    section_id: int
    lot_id: int
    section_name: str
    capacity: int

class Spot(BaseModel):
    spot_id: int
    section_id: int
    lot_id: int
    spot_name: str
    taken: bool

class SpotStatus(BaseModel):
    spot_id: int
    taken: bool

@app.get("/lots", response_model=list[Lot])
def read_lots(db: Client = Depends(get_db)):
    response = db.table("lots").select("*").execute()
    return response.data

@app.get("/lots/{lot_id}/sections", response_model=list[Section])
def lot_sections(lot_id: int, db: Client = Depends(get_db)):
    response = db.table("sections").select("*").eq("lot_id", lot_id).execute()
    return response.data

@app.get("/lots/{lot_id}/spots", response_model=list[Spot])
def lot_spots(lot_id: int, db: Client = Depends(get_db)):
    response = db.table("spots").select("*").eq("lot_id", lot_id).execute()
    return response.data

@app.post("/spots", response_model=list[SpotStatus])
def update_spots(spots: list[SpotStatus], db: Client = Depends(get_db),
                 device_id: str = Depends(require_device)):
    if not spots:
        return []

    allowed_spots = set(settings.device_spots.get(device_id, []))

    taken_spots = []
    empty_spots = []
    for spot in spots:
        if spot.spot_id not in allowed_spots:
            raise HTTPException(status_code=403, detail=f"Spot {spot.spot_id} is not allowed for this device")
        if spot.taken:
            taken_spots.append(spot)
        else:
            empty_spots.append(spot)

    result = []
    if taken_spots:
        modified = db.table("spots").update({"taken": True}).in_("spot_id", [s.spot_id for s in taken_spots]).execute().data
        result.extend(modified)
    if empty_spots:
        modified = db.table("spots").update({"taken": False}).in_("spot_id", [s.spot_id for s in empty_spots]).execute().data
        result.extend(modified)

    return result

@app.post("/camera/{camera_id}/predict")
async def predict(camera_id: str, image: UploadFile = File(...),
                  device_id: str = Depends(require_device)):
    data = await image.read()
    try:
        result = await predict_spots(camera_id, data, image.filename)
    except httpx.TimeoutException:
        raise HTTPException(status_code=504, detail="Prediction timed out")
    except httpx.HTTPStatusError as error:
        status = error.response.status_code
        if status in (400, 404, 413):
            raise HTTPException(status_code=status, detail=error.response.text)
        raise HTTPException(status_code=502, detail="ML server error")
    except httpx.RequestError:
        raise HTTPException(status_code=502, detail="ML server unreachable")
    return result

def save_spaces(db: Client, spots: list[dict]) -> None:
    occupied = [s for s in spots if s["occupied"]]
    empty = [s for s in spots if not s["occupied"]]

    if occupied:
        db.table("spots").update({"taken": True}).in_("spot_id", [s["spot_id"] for s in occupied]).execute()
    if empty:
        db.table("spots").update({"taken": False}).in_("spot_id", [s["spot_id"] for s in empty]).execute()