@echo off
if not exist .venv (
  py -m venv .venv
)
call .venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
if not exist .env copy .env.example .env
echo.
echo .env faylida DATABASE_URL qiymatini sozlang.
echo Serverni ishga tushirish uchun davom eting.
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
pause
