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

class Site(BaseModel):
    site_id: int
    site_name: str

class Lot(BaseModel):
    lot_id: int
    site_id: int
    lot_name: str

class Floor(BaseModel):
    floor_id: int
    lot_id: int
    floor_num: int

class Space(BaseModel):
    space_id: int
    floor_id: int
    camera_id: int
    space_type: str
    occupied: bool

class SpaceStatus(BaseModel):
    space_id: int
    occupied: bool

# Supabase returns at most 1000 rows per request, and a lot can have more spaces than that
PAGE_SIZE = 1000

@app.get("/sites", response_model=list[Site])
def read_sites(db: Client = Depends(get_db)):
    response = db.table("sites").select("*").execute()
    return response.data

@app.get("/sites/{site_id}/lots", response_model=list[Lot])
def site_lots(site_id: int, db: Client = Depends(get_db)):
    response = db.table("lots").select("*").eq("site_id", site_id).execute()
    return response.data

@app.get("/lots", response_model=list[Lot])
def read_lots(db: Client = Depends(get_db)):
    response = db.table("lots").select("*").execute()
    return response.data

@app.get("/lots/{lot_id}/floors", response_model=list[Floor])
def lot_floors(lot_id: int, db: Client = Depends(get_db)):
    response = db.table("floors").select("*").eq("lot_id", lot_id).execute()
    return response.data

@app.get("/lots/{lot_id}/spaces", response_model=list[Space])
def lot_spaces(lot_id: int, db: Client = Depends(get_db)):
    # spaces has no lot_id, so filter through its floor (inner join on floors)
    spaces = []
    start = 0
    while True:
        page = (db.table("spaces").select("*, floors!inner(lot_id)")
                .eq("floors.lot_id", lot_id).order("space_id")
                .range(start, start + PAGE_SIZE - 1).execute().data)
        spaces.extend(page)
        if len(page) < PAGE_SIZE:
            return spaces
        start += PAGE_SIZE

@app.get("/floors/{floor_id}/spaces", response_model=list[Space])
def floor_spaces(floor_id: int, db: Client = Depends(get_db)):
    response = db.table("spaces").select("*").eq("floor_id", floor_id).order("space_id").execute()
    return response.data

@app.post("/spaces", response_model=list[SpaceStatus])
def update_spaces(spaces: list[SpaceStatus], db: Client = Depends(get_db),
                  device_id: str = Depends(require_device)):
    if not spaces:
        return []

    allowed_spaces = set(settings.device_spots.get(device_id, []))

    occupied_spaces = []
    empty_spaces = []
    for space in spaces:
        if space.space_id not in allowed_spaces:
            raise HTTPException(status_code=403, detail=f"Space {space.space_id} is not allowed for this device")
        if space.occupied:
            occupied_spaces.append(space)
        else:
            empty_spaces.append(space)

    result = []
    if occupied_spaces:
        modified = db.table("spaces").update({"occupied": True}).in_("space_id", [s.space_id for s in occupied_spaces]).execute().data
        result.extend(modified)
    if empty_spaces:
        modified = db.table("spaces").update({"occupied": False}).in_("space_id", [s.space_id for s in empty_spaces]).execute().data
        result.extend(modified)

    return result

@app.post("/camera/{camera_id}/predict")
async def predict(camera_id: str, image: UploadFile = File(...),
                  device_id: str = Depends(require_device), db: Client = Depends(get_db)):
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
    
    await run_in_threadpool(save_spaces, db, result["spots"])
    return result

def save_spaces(db: Client, spaces: list[dict]) -> None:
    occupied = [s for s in spaces if s["occupied"] is True]
    empty = [s for s in spaces if s["occupied"] is False]

    if occupied:
        db.table("spaces").update({"occupied": True}).in_("space_id", [s["spot_id"] for s in occupied]).execute()
    if empty:
        db.table("spaces").update({"occupied": False}).in_("space_id", [s["spot_id"] for s in empty]).execute()