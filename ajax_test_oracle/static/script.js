const welcome = document.getElementById("welcome");
const testSection = document.getElementById("test");
const resultSection = document.getElementById("result");
const questionElement = document.getElementById("question");
const answersElement = document.getElementById("answers");
const nextBtn = document.getElementById("nextBtn");
const prevBtn = document.getElementById("prevBtn");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const welcomeError = document.getElementById("welcomeError");
const testError = document.getElementById("testError");

let questions = [];
let currentQuestion = 0;
let userAnswers = [];
let userName = "";
let submitting = false;
let lastTestResult = null;

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
}

async function apiRequest(path, options = {}) {
    const response = await fetch(path, {
        ...options,
        headers: {
            ...(options.body ? { "Content-Type": "application/json" } : {}),
            ...(options.headers || {})
        }
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        throw new Error(data.detail || "Server bilan bog'lanishda xatolik yuz berdi.");
    }
    return data;
}

document.getElementById("startBtn").addEventListener("click", startTest);
document.getElementById("userName").addEventListener("keydown", (event) => {
    if (event.key === "Enter") startTest();
});

async function startTest() {
    userName = document.getElementById("userName").value.trim();
    welcomeError.textContent = "";
    if (!userName) {
        welcomeError.textContent = "Iltimos, ismingizni kiriting!";
        return;
    }
    if (userName.length > 30) {
        welcomeError.textContent = "Ism 30 ta belgidan oshmasligi kerak.";
        return;
    }

    const startBtn = document.getElementById("startBtn");
    startBtn.disabled = true;
    startBtn.textContent = "Yuklanmoqda...";
    try {
        questions = await apiRequest("/api/questions");
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error("Savollar topilmadi.");
        }
        userAnswers = new Array(questions.length).fill(null);
        currentQuestion = 0;
        document.getElementById("questionCount").textContent = questions.length;
        welcome.classList.add("hidden");
        testSection.classList.remove("hidden");
        showQuestion();
    } catch (error) {
        welcomeError.textContent = error.message;
    } finally {
        startBtn.disabled = false;
        startBtn.textContent = "Testni boshlash →";
    }
}

function showQuestion() {
    const question = questions[currentQuestion];
    questionElement.textContent = `${currentQuestion + 1}. ${question.question}`;
    progressText.textContent = `${currentQuestion + 1} / ${questions.length}`;
    progressFill.style.width = `${((currentQuestion + 1) / questions.length) * 100}%`;
    answersElement.innerHTML = "";

    question.answers.forEach((answer, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = answer;
        button.className = "answer";
        if (userAnswers[currentQuestion] === index) button.classList.add("selected");
        button.addEventListener("click", () => {
            userAnswers[currentQuestion] = index;
            showQuestion();
        });
        answersElement.appendChild(button);
    });

    prevBtn.disabled = currentQuestion === 0;
    nextBtn.disabled = false;
    nextBtn.textContent = currentQuestion === questions.length - 1
        ? "Testni yakunlash" : "Keyingi →";
    testError.textContent = "";
}

nextBtn.addEventListener("click", async () => {
    if (userAnswers[currentQuestion] === null) {
        testError.textContent = "Avval javobni tanlang!";
        return;
    }
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        showQuestion();
    } else {
        await finishTest();
    }
});

prevBtn.addEventListener("click", () => {
    if (currentQuestion > 0) {
        currentQuestion--;
        showQuestion();
    }
});

async function finishTest() {
    if (submitting) return;
    submitting = true;
    nextBtn.disabled = true;
    prevBtn.disabled = true;
    nextBtn.textContent = "Natija saqlanmoqda...";
    testError.textContent = "";

    try {
        lastTestResult = await apiRequest("/api/submit", {
            method: "POST",
            body: JSON.stringify({ name: userName, answers: userAnswers })
        });
        testSection.classList.add("hidden");
        resultSection.classList.remove("hidden");
        await showResult(lastTestResult);
    } catch (error) {
        testError.textContent = `${error.message} Internet yoki serverni tekshirib, qayta urinib ko'ring.`;
        nextBtn.disabled = false;
        prevBtn.disabled = currentQuestion === 0;
        nextBtn.textContent = "Qayta yuborish";
    } finally {
        submitting = false;
    }
}

async function showResult(result) {
    let ranking = [];
    let rankingError = "";
    try {
        ranking = await apiRequest("/api/leaderboard");
    } catch (error) {
        rankingError = error.message;
    }

    const position = ranking.findIndex((item) => item.id === result.id);
    const rankingHTML = ranking.map((item, index) => `
        <div class="rank-item">
            <span>${index + 1}. ${escapeHTML(item.name)} ${item.id === result.id ? "(Siz)" : ""}</span>
            <span class="rank-score">${item.score}/${item.total}</span>
        </div>
    `).join("");

    resultSection.innerHTML = `
        <div class="logo">AJAX<span>TEST</span></div>
        <h2 style="margin-top:30px">Test yakunlandi!</h2>
        <div class="result-score">${result.percentage}%</div>
        <p class="result-message">
            ${escapeHTML(result.name)}, siz ${result.total} ta savoldan
            ${result.score} tasiga to'g'ri javob berdingiz.
        </p>
        <div class="info-cards">
            <div class="info-card"><strong>${result.score}</strong><span>To'g'ri</span></div>
            <div class="info-card"><strong>${result.total - result.score}</strong><span>Noto'g'ri</span></div>
            <div class="info-card"><strong>${position >= 0 ? position + 1 : "—"}</strong><span>Reytingdagi o'rin</span></div>
        </div>
        <div class="ranking">
            <h2>🏆 Umumiy reyting</h2>
            <p class="ranking-note">Oxirgi 30 daqiqada testni yakunlagan eng yaxshi 10 ishtirokchi.</p>
            ${rankingError ? `<p class="error-message">${escapeHTML(rankingError)}</p>` :
                (rankingHTML || "<p>Hozircha natijalar yo'q.</p>")}
        </div>
        <div class="result-buttons">
            <button class="primary-btn" id="reviewBtn">Javoblarni ko'rish</button>
            <button class="secondary-btn" id="restartBtn">Qayta boshlash</button>
        </div>
    `;

    document.getElementById("reviewBtn").addEventListener("click", showReview);
    document.getElementById("restartBtn").addEventListener("click", () => location.reload());
}

function showReview() {
    let reviewHTML = `
        <div class="logo">AJAX<span>TEST</span></div>
        <h2 style="margin-top:25px">Javoblar tahlili</h2>
    `;

    (lastTestResult?.review || []).forEach((item, index) => {
        reviewHTML += `
            <div class="review-item">
                <strong>${index + 1}. ${escapeHTML(item.question)}</strong>
                <p class="${item.is_correct ? "correct-text" : "wrong-text"}">
                    Sizning javobingiz:
                    ${item.selected === null ? "Javob berilmagan" : escapeHTML(item.answers[item.selected])}
                </p>
                <p class="correct-text">To'g'ri javob: ${escapeHTML(item.answers[item.correct])}</p>
            </div>
        `;
    });

    reviewHTML += `<button class="primary-btn" id="backResultBtn">Natijaga qaytish</button>`;
    resultSection.innerHTML = reviewHTML;
    document.getElementById("backResultBtn").addEventListener("click", () => showResult(lastTestResult));
}
