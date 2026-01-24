from fastapi import APIRouter, Depends
from app.auth.jwt import get_current_user_id
from app.database import get_db

router = APIRouter(prefix="/home", tags=["home"])

@router.get("/")
def home(user_id: int = Depends(get_current_user_id), conn=Depends(get_db)):
    """Szybkie info dla frontendu na start"""
    return {
        "message": f"Witaj, użytkowniku {user_id}!",
        "status": "success",
    }



