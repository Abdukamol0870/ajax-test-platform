# AJAX Test Platform

AJAX mavzusidagi 30 ta savoldan iborat test platformasi. Frontend HTML/CSS/JavaScript, backend FastAPI, ma'lumotlar bazasi PostgreSQL.

## Lokal ishga tushirish (Windows)

1. Python 3.10+ va PostgreSQL o'rnatilgan bo'lsin.
2. PostgreSQL'da `ajax_test` nomli database yarating.
3. PowerShell'da loyiha papkasida:

```powershell
py -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

4. `.env` faylidagi `DATABASE_URL` qiymatini o'zingizga moslang:

```env
DATABASE_URL=postgresql://postgres:parolingiz@localhost:5432/ajax_test
```

5. Ishga tushiring:

```powershell
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

Sayt: http://127.0.0.1:8000  
API docs: http://127.0.0.1:8000/docs  
Health: http://127.0.0.1:8000/api/health

Jadval backend tomonidan avtomatik yaratiladi.

## Render'ga joylash

1. GitHub repository'ni Render'ga ulang va Web Service yarating.
2. Runtime: `Python 3`.
3. Build Command: `pip install -r requirements.txt`.
4. Start Command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`.
5. Render'da alohida PostgreSQL database yarating.
6. PostgreSQL sahifasidan Internal Database URL'ni oling. Web Service → Environment bo'limida `DATABASE_URL` nomi bilan kiriting (yoki Render'ning database ulash funksiyasidan foydalaning).
7. Deploy qiling. `/api/health` manzili `{"status":"ok","database":"connected"}` qaytarishi kerak.

## API

- `GET /api/questions` — savollar va variantlar; to'g'ri javoblar ommaviy berilmaydi.
- `POST /api/submit` — javoblarni tekshiradi, ballni hisoblaydi va PostgreSQL'ga saqlaydi.
- `GET /api/leaderboard` — oxirgi 30 daqiqadagi eng yaxshi 10 natija.
- `GET /api/health` — server va database ulanishini tekshiradi.

## Xavfsizlik

`.env` fayli va database parolini GitHub'ga yuklamang. `.env` `.gitignore` ichida. Hozircha test ism bilan topshiriladi; login/ro'yxatdan o'tish tizimi mavjud emas.
