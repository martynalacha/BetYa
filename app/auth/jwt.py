from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

# -------------------- JWT konfiguracja --------------------
SECRET_KEY = "betya_secret_message"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60

oauth2_scheme = HTTPBearer()

def create_access_token(data: dict, expires_delta: timedelta = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user_id(token: HTTPAuthorizationCredentials = Depends(oauth2_scheme)):
    """Dekoduje token Bearer i zwraca ID zalogowanego użytkownika"""
    try:
        payload = jwt.decode(token.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        uzytkownik_id: int = payload.get("uzytkownik_id")
        if uzytkownik_id is None:
            raise HTTPException(status_code=401, detail="Nieprawidłowy token JWT: brak pola 'uzytkownik_id'.")
        return uzytkownik_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Błędny token JWT - signature jest niepoprawny")
