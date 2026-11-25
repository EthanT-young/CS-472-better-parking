import hashlib, secrets
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from api.config import settings

bearer = HTTPBearer(auto_error = False)

def require_device(creds: HTTPAuthorizationCredentials | None = Security(bearer)) -> str:
    if not creds:
        raise HTTPException(status_code=401, detail="Unauthorized")

    hashed_token = hashlib.sha256(creds.credentials.encode()).hexdigest()
    device = settings.device_key_hashes.get(hashed_token)
    if not device:
        raise HTTPException(status_code=401, detail="Unauthorized")

    return device