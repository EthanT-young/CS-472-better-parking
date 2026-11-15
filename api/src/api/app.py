from fastapi import FastAPI, Depends, HTTPException
from api.db import get_db
from supabase import Client
from pydantic import BaseModel  
from api.config import settings

app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["GET, POST"],
    allow_headers=["*"],
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