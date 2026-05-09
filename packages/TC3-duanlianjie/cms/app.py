import sqlite3
import re
import json
import httpx
from typing import Optional, List
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

DATABASE_PATH = "cms.db"
SHORTENER_API_URL = "http://localhost:8000"

app = FastAPI(title="内容管理系统 - 短链接集成")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ArticleBase(BaseModel):
    title: str
    content: str

class ArticleCreate(ArticleBase):
    pass

class ArticleUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class LinkMapping(BaseModel):
    id: int
    original_url: str
    short_code: str
    short_url: str

class Article(BaseModel):
    id: int
    title: str
    content: str
    original_content: Optional[str]
    link_mappings: List[LinkMapping]
    created_at: str
    updated_at: str
    published: bool

class ReplaceResult(BaseModel):
    success: bool
    original_count: int
    replaced_count: int
    short_links: List[LinkMapping]
    content: str

class RestoreResult(BaseModel):
    success: bool
    restored_count: int
    content: str

def init_db():
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS articles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            original_content TEXT,
            link_mappings TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            published INTEGER DEFAULT 0
        )
    """)
    conn.commit()
    conn.close()

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def extract_urls(text: str) -> List[str]:
    url_pattern = re.compile(
        r'https?://[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+'
        r'(?:/[^\s<>\"]*)?'
    )
    urls = url_pattern.findall(text)
    return list(set(urls))

async def shorten_url(url: str) -> Optional[dict]:
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                f"{SHORTENER_API_URL}/shorten",
                json={"url": url},
                timeout=10.0
            )
            if response.status_code == 200:
                return response.json()
        except Exception as e:
            print(f"Shorten URL error: {e}")
    return None

async def batch_replace_urls(content: str) -> ReplaceResult:
    urls = extract_urls(content)
    if not urls:
        return ReplaceResult(
            success=True,
            original_count=0,
            replaced_count=0,
            short_links=[],
            content=content
        )
    
    short_links = []
    modified_content = content
    replaced_count = 0
    
    for url in urls:
        result = await shorten_url(url)
        if result:
            short_code = result.get("short_code")
            short_url = f"{SHORTENER_API_URL}/{short_code}"
            mapping = LinkMapping(
                id=0,
                original_url=url,
                short_code=short_code,
                short_url=short_url
            )
            short_links.append(mapping)
            modified_content = modified_content.replace(url, short_url)
            replaced_count += 1
    
    return ReplaceResult(
        success=True,
        original_count=len(urls),
        replaced_count=replaced_count,
        short_links=short_links,
        content=modified_content
    )

def restore_urls(content: str, mappings: List[LinkMapping]) -> RestoreResult:
    if not mappings:
        return RestoreResult(
            success=True,
            restored_count=0,
            content=content
        )
    
    modified_content = content
    restored_count = 0
    
    for mapping in mappings:
        if mapping.short_url in modified_content:
            modified_content = modified_content.replace(mapping.short_url, mapping.original_url)
            restored_count += 1
    
    return RestoreResult(
        success=True,
        restored_count=restored_count,
        content=modified_content
    )

def parse_link_mappings(mappings_json: Optional[str]) -> List[LinkMapping]:
    if not mappings_json:
        return []
    try:
        data = json.loads(mappings_json)
        return [LinkMapping(**item) for item in data]
    except:
        return []

@app.on_event("startup")
async def startup_event():
    init_db()

@app.post("/articles", response_model=Article)
async def create_article(article: ArticleCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    replace_result = await batch_replace_urls(article.content)
    
    link_mappings_json = json.dumps([m.model_dump() for m in replace_result.short_links])
    
    cursor.execute(
        """INSERT INTO articles (title, content, original_content, link_mappings, created_at, updated_at, published)
           VALUES (?, ?, ?, ?, ?, ?, 0)""",
        (
            article.title,
            replace_result.content,
            article.content,
            link_mappings_json,
            datetime.now().isoformat(),
            datetime.now().isoformat()
        )
    )
    article_id = cursor.lastrowid
    conn.commit()
    
    cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
    row = cursor.fetchone()
    conn.close()
    
    return Article(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        original_content=row["original_content"],
        link_mappings=parse_link_mappings(row["link_mappings"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        published=bool(row["published"])
    )

@app.get("/articles", response_model=List[Article])
async def list_articles():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM articles ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    
    return [
        Article(
            id=row["id"],
            title=row["title"],
            content=row["content"],
            original_content=row["original_content"],
            link_mappings=parse_link_mappings(row["link_mappings"]),
            created_at=row["created_at"],
            updated_at=row["updated_at"],
            published=bool(row["published"])
        )
        for row in rows
    ]

@app.get("/articles/{article_id}", response_model=Article)
async def get_article(article_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    return Article(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        original_content=row["original_content"],
        link_mappings=parse_link_mappings(row["link_mappings"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        published=bool(row["published"])
    )

@app.put("/articles/{article_id}", response_model=Article)
async def update_article(article_id: int, article: ArticleUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
    existing = cursor.fetchone()
    
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="文章不存在")
    
    title = article.title or existing["title"]
    content = article.content or existing["content"]
    
    if article.content:
        replace_result = await batch_replace_urls(content)
        content = replace_result.content
        link_mappings_json = json.dumps([m.model_dump() for m in replace_result.short_links])
        original_content = article.content
    else:
        link_mappings_json = existing["link_mappings"]
        original_content = existing["original_content"]
    
    cursor.execute(
        """UPDATE articles SET title = ?, content = ?, original_content = ?, link_mappings = ?, updated_at = ?
           WHERE id = ?""",
        (title, content, original_content, link_mappings_json, datetime.now().isoformat(), article_id)
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
    row = cursor.fetchone()
    conn.close()
    
    return Article(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        original_content=row["original_content"],
        link_mappings=parse_link_mappings(row["link_mappings"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        published=bool(row["published"])
    )

@app.delete("/articles/{article_id}")
async def delete_article(article_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM articles WHERE id = ?", (article_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="文章不存在")
    
    cursor.execute("DELETE FROM articles WHERE id = ?", (article_id,))
    conn.commit()
    conn.close()
    
    return {"success": True, "message": "文章已删除"}

@app.post("/articles/{article_id}/publish", response_model=Article)
async def publish_article(article_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
    row = cursor.fetchone()
    
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="文章不存在")
    
    cursor.execute(
        "UPDATE articles SET published = 1, updated_at = ? WHERE id = ?",
        (datetime.now().isoformat(), article_id)
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
    row = cursor.fetchone()
    conn.close()
    
    return Article(
        id=row["id"],
        title=row["title"],
        content=row["content"],
        original_content=row["original_content"],
        link_mappings=parse_link_mappings(row["link_mappings"]),
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        published=bool(row["published"])
    )

@app.post("/articles/{article_id}/restore", response_model=RestoreResult)
async def restore_article_urls(article_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM articles WHERE id = ?", (article_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="文章不存在")
    
    mappings = parse_link_mappings(row["link_mappings"])
    result = restore_urls(row["content"], mappings)
    
    return result

@app.post("/articles/replace-preview", response_model=ReplaceResult)
async def replace_preview(article: ArticleBase):
    result = await batch_replace_urls(article.content)
    return result

@app.get("/")
async def read_root():
    return FileResponse("index.html")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8001, reload=True)
