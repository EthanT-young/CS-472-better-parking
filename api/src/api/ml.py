import httpx
from api.config import settings

async def predict_spots(camera_id: str, image: bytes, file_name: str) -> dict: 
    async with httpx.AsyncClient(timeout=settings.ml_timeout) as client:
        response = await client.post(
            f"{settings.ml_url}/predict",
            files={"image": (file_name, image)},
            params={"camera_id": camera_id}
        )
        response.raise_for_status()
        return response.json()