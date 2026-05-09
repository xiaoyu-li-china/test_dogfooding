import os
import sqlite3
import hashlib
from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import RedirectResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

BASE62_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
BASE62_BASE = len(BASE62_CHARS)
SHORT_CODE_LENGTH = 6
DATABASE_PATH = "shortlinks.db"

app = FastAPI(title="短链接服务")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ShortenRequest(BaseModel):
    url: str

class VisitRecord(BaseModel):
    id: int
    access_time: str
    ip_address: Optional[str]
    user_agent: Optional[str]

class StatsResponse(BaseModel):
    short_code: str
    original_url: str
    total_visits: int
    recent_visits: List[VisitRecord]

def base62_encode(num: int) -> str:
    if num == 0:
        return BASE62_CHARS[0]
    chars = []
    while num > 0:
        num, rem = divmod(num, BASE62_BASE)
        chars.append(BASE62_CHARS[rem])
    return "".join(reversed(chars))

def get_short_code(url: str, counter: int = 0) -> str:
    data = f"{url}{counter}" if counter > 0 else url
    hash_obj = hashlib.sha256(data.encode())
    hash_num = int(hash_obj.hexdigest(), 16)
    short_code = base62_encode(hash_num)
    return short_code[:SHORT_CODE_LENGTH]

def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            original_url TEXT NOT NULL,
            short_code TEXT UNIQUE NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            link_id INTEGER NOT NULL,
            access_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            ip_address TEXT,
            user_agent TEXT,
            FOREIGN KEY (link_id) REFERENCES links(id) ON DELETE CASCADE
        )
    """)
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_visits_link_id ON visits(link_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_visits_access_time ON visits(access_time DESC)")
    conn.commit()
    conn.close()

def get_link_id_by_short_code(short_code: str):
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT id, original_url FROM links WHERE short_code = ?", (short_code,))
    result = cursor.fetchone()
    conn.close()
    return result if result else None

def record_visit(link_id: int, ip_address: Optional[str], user_agent: Optional[str]):
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO visits (link_id, ip_address, user_agent)
        VALUES (?, ?, ?)
    """, (link_id, ip_address, user_agent))
    conn.commit()
    conn.close()

def get_visit_count(link_id: int) -> int:
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM visits WHERE link_id = ?", (link_id,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else 0

def get_recent_visits(link_id: int, limit: int = 10) -> List[VisitRecord]:
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT id, access_time, ip_address, user_agent
        FROM visits
        WHERE link_id = ?
        ORDER BY access_time DESC
        LIMIT ?
    """, (link_id, limit))
    rows = cursor.fetchall()
    conn.close()
    return [
        VisitRecord(
            id=row[0],
            access_time=row[1],
            ip_address=row[2],
            user_agent=row[3]
        )
        for row in rows
    ]

def check_short_code_exists(short_code: str) -> bool:
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM links WHERE short_code = ?", (short_code,))
    result = cursor.fetchone()
    conn.close()
    return result is not None

def get_original_url(short_code: str):
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT original_url FROM links WHERE short_code = ?", (short_code,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else None

def check_url_exists(original_url: str):
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT short_code FROM links WHERE original_url = ?", (original_url,))
    result = cursor.fetchone()
    conn.close()
    return result[0] if result else None

def save_link(original_url: str, short_code: str):
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO links (original_url, short_code) VALUES (?, ?)",
        (original_url, short_code)
    )
    conn.commit()
    conn.close()

@app.on_event("startup")
async def startup_event():
    init_db()

@app.post("/shorten")
async def shorten_url(request: ShortenRequest):
    original_url = request.url
    
    existing_short_code = check_url_exists(original_url)
    if existing_short_code:
        return {"short_code": existing_short_code, "original_url": original_url}
    
    counter = 0
    while True:
        short_code = get_short_code(original_url, counter)
        if not check_short_code_exists(short_code):
            break
        counter += 1
    
    save_link(original_url, short_code)
    return {"short_code": short_code, "original_url": original_url}

@app.get("/{short_code}")
async def redirect_to_url(short_code: str, request: Request):
    link = get_link_id_by_short_code(short_code)
    if not link:
        raise HTTPException(status_code=404, detail="短链接不存在")
    link_id, original_url = link
    ip_address = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    record_visit(link_id, ip_address, user_agent)
    return RedirectResponse(url=original_url)

@app.get("/stats/{short_code}", response_model=StatsResponse)
async def get_stats(short_code: str):
    link = get_link_id_by_short_code(short_code)
    if not link:
        raise HTTPException(status_code=404, detail="短链接不存在")
    link_id, original_url = link
    total_visits = get_visit_count(link_id)
    recent_visits = get_recent_visits(link_id, 10)
    return StatsResponse(
        short_code=short_code,
        original_url=original_url,
        total_visits=total_visits,
        recent_visits=recent_visits
    )

@app.get("/")
async def read_root():
    return FileResponse("index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
