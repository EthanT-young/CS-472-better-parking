from fastapi import FastAPI, Depends, HTTPException
from api.db import get_db
from supabase import Client
from pydantic import BaseModel  

app = FastAPI()

class Lot(BaseModel):
    lot_id: int
    site_id: int
    lot_name: str

@app.get("/lots")
def read_lots(db: Client = Depends(get_db)):
    response = db.table("lots").select("*").execute()
    return response.data


@app.get("/lots/{lot_id}/sections")
def lot_sections(lot_id: int, db: Client = Depends(get_db)):
    response = db.table("sections").select("*").eq("lot_id", lot_id).execute()
    return response.data

