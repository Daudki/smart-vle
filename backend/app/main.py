from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta
import jwt

app = FastAPI()

SECRET_KEY = "the-outcats-finally-returns"
ALGORITHM = "HS256"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Server is running"}

def create_access_token(username: str, role: str) -> str:
    expire = datetime.now(datetime.timezone.utc) + timedelta(hours = 8)
    payload = {
        "sub": username,
        "role": role,
        "exp": expire
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

@app.post("/auth/login")
def login(username: str, password: str):
    if username == "Lecturer" and password == "lecturer101":
        return {
            "message": "Login successful",
            "access_token": create_access_token(username, "lecturer"),
            "role": "lecturer",
            "name": "Lecturer",
        }
    if username == "Student" and password == "student101":
        return {
            "message": "Login successful",
            "access_token": create_access_token(username, "student"),
            "role": "student",
            "name": "Student",
        }
    raise HTTPException(status_code=401, detail="invalid username or password")