import os
import uuid
from pathlib import Path
from typing import Optional

import psycopg
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator

from .questions import QUESTIONS

ROOT = Path(__file__).resolve().parent.parent
STATIC_DIR = ROOT / "static"
load_dotenv(ROOT / ".env")

app = FastAPI(title="AJAX Test Platform", version="2.0.0")


def database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError("DATABASE_URL sozlanmagan. .env yoki Render Environment bo'limini tekshiring.")
    # Render ba'zan postgres:// ko'rinishidagi URL beradi; psycopg uchun normallashtiramiz.
    if url.startswith("postgres://"):
        url = "postgresql://" + url[len("postgres://"):]
    return url


def get_connection():
    try:
        return psycopg.connect(database_url(), connect_timeout=10)
    except Exception as exc:
        # Maxfiy ulanish ma'lumotlarini API javobida ko'rsatmaymiz.
        raise HTTPException(status_code=503, detail="Ma'lumotlar bazasiga ulanib bo'lmadi. Server sozlamalarini tekshiring.") from exc


def ensure_tables() -> None:
    """Natijalar jadvalini mavjud bo'lmasa yaratadi."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS ajax_test_results (
                    id UUID PRIMARY KEY,
                    user_name VARCHAR(30) NOT NULL,
                    score INTEGER NOT NULL CHECK (score >= 0),
                    total INTEGER NOT NULL CHECK (total > 0),
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_ajax_results_created
                ON ajax_test_results (created_at DESC)
            """)
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_ajax_results_score
                ON ajax_test_results (score DESC, created_at ASC)
            """)
        conn.commit()
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=503, detail="Ma'lumotlar bazasi jadvalini tayyorlashda xatolik.") from exc
    finally:
        conn.close()


class AnswerSubmission(BaseModel):
    name: str = Field(min_length=1, max_length=30)
    answers: list[Optional[int]]

    @field_validator("answers")
    @classmethod
    def validate_answers(cls, values):
        for value in values:
            if value is not None and (isinstance(value, bool) or value not in range(4)):
                raise ValueError("Javob varianti 0 dan 3 gacha bo'lishi kerak.")
        return values


@app.on_event("startup")
def startup():
    # Ilova ishga tushishida bazani tekshiramiz; ulanish muammosi bo'lsa logda ko'rinadi.
    try:
        ensure_tables()
    except Exception as exc:
        print(f"Database startup warning: {exc}")


@app.get("/api/health")
def health():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT 1")
            cur.fetchone()
        return {"status": "ok", "database": "connected"}
    finally:
        conn.close()


@app.get("/api/questions")
def get_questions():
    # To'g'ri javoblar brauzerga yuborilmaydi.
    return [
        {"question": item["question"], "answers": item["answers"]}
        for item in QUESTIONS
    ]


@app.post("/api/submit")
def submit_test(payload: AnswerSubmission):
    name = " ".join(payload.name.split())
    if not name:
        raise HTTPException(status_code=400, detail="Ism kiritilishi shart.")
    if len(payload.answers) != len(QUESTIONS):
        raise HTTPException(status_code=400, detail="Javoblar soni noto'g'ri.")

    score = sum(
        1 for index, question in enumerate(QUESTIONS)
        if payload.answers[index] == question["correct"]
    )
    result_id = uuid.uuid4()

    ensure_tables()
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO ajax_test_results (id, user_name, score, total)
                   VALUES (%s, %s, %s, %s)""",
                (result_id, name, score, len(QUESTIONS)),
            )
        conn.commit()
    except Exception as exc:
        conn.rollback()
        raise HTTPException(status_code=503, detail="Natijani saqlashda xatolik yuz berdi.") from exc
    finally:
        conn.close()

    review = [
        {
            "question": item["question"],
            "answers": item["answers"],
            "selected": payload.answers[index],
            "correct": item["correct"],
            "is_correct": payload.answers[index] == item["correct"],
        }
        for index, item in enumerate(QUESTIONS)
    ]
    return {
        "id": str(result_id),
        "name": name,
        "score": score,
        "total": len(QUESTIONS),
        "percentage": round(score / len(QUESTIONS) * 100),
        "review": review,
    }


@app.get("/api/leaderboard")
def leaderboard():
    ensure_tables()
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, user_name, score, total
                FROM ajax_test_results
                WHERE created_at >= NOW() - INTERVAL '30 minutes'
                ORDER BY score DESC, created_at ASC
                LIMIT 10
            """)
            rows = cur.fetchall()
        return [
            {"id": str(row[0]), "name": row[1], "score": row[2], "total": row[3]}
            for row in rows
        ]
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Reytingni yuklashda xatolik.") from exc
    finally:
        conn.close()


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
