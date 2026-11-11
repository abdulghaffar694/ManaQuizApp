/* ============================================================
   QUIZ APP - FRONTEND LOGIC (plain JavaScript, no framework)
   Questions now come from the backend API instead of a
   hardcoded array. Login token is kept in localStorage.
   ============================================================ */

const API = 'http://localhost:5000/api';  // backend base URL
const QUIZ_LENGTH = 10;                    // max questions per quiz

// ---------- App state ----------
let token = localStorage.getItem('quizToken');
let currentUser = JSON.parse(localStorage.getItem('quizUser') || 'null');

let questions = [];   // loaded from GET /api/questions
let current = 0;      // index of the question being shown
let score = 0;        // correct answers so far
let locked = false;   // true after an option was chosen (stops double clicking)
let authMode = 'login';

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);

// Fetch wrapper: adds the token, parses JSON, throws readable errors
async function api(path, method = 'GET', body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;

  let res;
  try {
    res = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Is "node server.js" running?');
  }

  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && token) {
    logout();
    throw new Error('Session expired. Please log in again.');
  }
  if (!res.ok) throw new Error(data.message || 'Something went wrong');
  return data;
}

// Shuffle an array (Fisher-Yates) so every quiz feels different
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ============================================================
   NAVIGATION
   ============================================================ */
const PAGES = ['auth', 'quiz', 'result', 'leaderboard', 'admin'];

function showPage(name) {
  PAGES.forEach((p) => $('page-' + p).classList.toggle('hidden', p !== name));

  // highlight active nav button (result page counts as "quiz")
  const navName = name === 'result' ? 'quiz' : name;
  document.querySelectorAll('.nav-btn[data-page]').forEach((b) => {
    b.classList.toggle('active', b.dataset.page === navName);
  });

  // load data for the page being opened
  if (name === 'quiz') startQuiz();
  if (name === 'leaderboard') loadLeaderboard();
  if (name === 'admin') loadAdmin();
}

function updateNav() {
  const loggedIn = !!token;
  $('navbar').classList.toggle('hidden', !loggedIn);
  $('nav-admin').classList.toggle('hidden', !(currentUser && currentUser.role === 'admin'));
}

document.querySelectorAll('.nav-btn[data-page]').forEach((btn) => {
  btn.addEventListener('click', () => showPage(btn.dataset.page));
});

/* ============================================================
   1. LOGIN / REGISTER
   ============================================================ */
function setAuthMode(mode) {
  authMode = mode;
  $('tab-login').classList.toggle('active', mode === 'login');
  $('tab-register').classList.toggle('active', mode === 'register');
  $('auth-submit').textContent = mode === 'login' ? 'Login' : 'Create Account';
  $('auth-error').textContent = '';
}
$('tab-login').addEventListener('click', () => setAuthMode('login'));
$('tab-register').addEventListener('click', () => setAuthMode('register'));

$('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('auth-error').textContent = '';
  try {
    const data = await api('/' + authMode, 'POST', {
      username: $('auth-username').value,
      password: $('auth-password').value,
    });
    // save the session
    token = data.token;
    currentUser = data.user;
    localStorage.setItem('quizToken', token);
    localStorage.setItem('quizUser', JSON.stringify(currentUser));

    $('auth-form').reset();
    updateNav();
    showPage('quiz');
  } catch (err) {
    $('auth-error').textContent = err.message;
  }
});

function logout() {
  token = null;
  currentUser = null;
  localStorage.removeItem('quizToken');
  localStorage.removeItem('quizUser');
  updateNav();
  showPage('auth');
}
$('btn-logout').addEventListener('click', logout);

/* ============================================================
   2. QUIZ PAGE  (same logic as before, data now from the API)
   ============================================================ */
async function startQuiz() {
  $('quiz-error').textContent = '';
  $('quiz-question').textContent = 'Loading questions...';
  $('quiz-options').innerHTML = '';
  $('btn-next').disabled = true;

  try {
    const all = await api('/questions');
    if (all.length === 0) {
      $('quiz-question').textContent = 'No questions yet. Ask the admin to add some!';
      $('quiz-counter').textContent = 'Question 0 / 0';
      $('progress-bar').style.width = '0%';
      return;
    }
    questions = shuffle(all).slice(0, QUIZ_LENGTH);
    current = 0;
    score = 0;
    renderQuestion();
  } catch (err) {
    $('quiz-question').textContent = 'Could not load the quiz';
    $('quiz-error').textContent = err.message;
  }
}

function renderQuestion() {
  locked = false;
  const q = questions[current];

  $('quiz-counter').textContent = `Question ${current + 1} / ${questions.length}`;
  $('quiz-score').textContent = `Score: ${score}`;
  $('progress-bar').style.width = (current / questions.length) * 100 + '%';
  $('quiz-category').textContent = q.category || 'General';
  $('quiz-question').textContent = q.question;

  $('btn-next').disabled = true;
  $('btn-next').textContent = current === questions.length - 1 ? 'Finish' : 'Next';

  // build the 4 option buttons (textContent keeps it safe from HTML injection)
  const box = $('quiz-options');
  box.innerHTML = '';
  q.options.forEach((text, index) => {
    const btn = document.createElement('button');
    btn.className = 'option';
    btn.textContent = text;
    btn.addEventListener('click', () => selectAnswer(index));
    box.appendChild(btn);
  });
}

function selectAnswer(index) {
  if (locked) return;
  locked = true;

  const q = questions[current];
  const buttons = $('quiz-options').children;

  if (index === q.answer) {
    buttons[index].classList.add('correct');      // right answer -> green
    score++;
  } else {
    buttons[index].classList.add('wrong');        // wrong answer -> red
    buttons[q.answer].classList.add('correct');   // also reveal the right one in green
  }

  // lock all options after answering
  Array.from(buttons).forEach((b) => (b.disabled = true));

  $('quiz-score').textContent = `Score: ${score}`;
  $('btn-next').disabled = false;
}

$('btn-next').addEventListener('click', () => {
  current++;
  if (current < questions.length) {
    renderQuestion();
  } else {
    $('progress-bar').style.width = '100%';
    finishQuiz();
  }
});

/* ============================================================
   3. RESULT PAGE  (also saves the score to the backend)
   ============================================================ */
async function finishQuiz() {
  const total = questions.length;
  const percent = Math.round((score / total) * 100);

  let message = 'Keep practicing, you will get there! 💪';
  if (percent >= 90) message = 'Outstanding! You are a genius! 🌟';
  else if (percent >= 70) message = 'Great job! 🎯';
  else if (percent >= 50) message = 'Good effort! 👍';

  $('result-score').textContent = `${score} / ${total}`;
  $('result-percent').textContent = percent + '%';
  $('result-ring').style.setProperty('--pct', percent);
  $('result-message').textContent = message;
  $('result-best').textContent = 'Saving your score...';
  showPage('result');

  try {
    const data = await api('/submit-score', 'POST', { score, total });
    $('result-best').textContent = `Your best score: ${data.bestScore}`;
    currentUser.bestScore = data.bestScore;
    localStorage.setItem('quizUser', JSON.stringify(currentUser));
  } catch (err) {
    $('result-best').textContent = 'Score not saved: ' + err.message;
  }
}

$('btn-play-again').addEventListener('click', () => showPage('quiz'));
$('btn-to-board').addEventListener('click', () => showPage('leaderboard'));

/* ============================================================
   4. LEADERBOARD PAGE
   ============================================================ */
async function loadLeaderboard() {
  $('board-error').textContent = '';
  const body = $('board-body');
  body.innerHTML = '';

  try {
    const board = await api('/leaderboard');
    const medals = ['🥇', '🥈', '🥉'];

    board.forEach((p, i) => {
      const tr = document.createElement('tr');
      if (currentUser && p.username === currentUser.username) tr.className = 'me';

      [medals[i] || i + 1, p.username, p.bestScore, p.attempts].forEach((val) => {
        const td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });

    if (board.length === 0) $('board-error').textContent = 'No players yet.';
  } catch (err) {
    $('board-error').textContent = err.message;
  }
}

/* ============================================================
   5. ADMIN PANEL  (add / delete questions)
   ============================================================ */
function adminMessage(text, ok) {
  const el = $('admin-msg');
  el.textContent = text;
  el.className = 'message ' + (ok ? 'success' : 'error');
}

async function loadAdmin() {
  if (!currentUser || currentUser.role !== 'admin') {
    $('adm-list').textContent = 'Admin access only.';
    return;
  }
  try {
    const list = await api('/questions');
    $('adm-count').textContent = list.length;

    const box = $('adm-list');
    box.innerHTML = '';
    list.forEach((q) => {
      const row = document.createElement('div');
      row.className = 'adm-item';

      const info = document.createElement('div');
      const title = document.createElement('span');
      title.textContent = q.question;
      const meta = document.createElement('small');
      meta.textContent = `${q.category} • Answer: ${q.options[q.answer]}`;
      info.append(title, meta);

      const del = document.createElement('button');
      del.className = 'btn-del';
      del.textContent = 'Delete';
      del.addEventListener('click', () => deleteQuestion(q.id));

      row.append(info, del);
      box.appendChild(row);
    });
  } catch (err) {
    adminMessage(err.message, false);
  }
}

$('admin-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    await api('/questions', 'POST', {
      question: $('adm-question').value,
      options: [0, 1, 2, 3].map((i) => $('adm-opt' + i).value),
      answer: Number($('adm-answer').value),
      category: $('adm-category').value,
    });
    $('admin-form').reset();
    adminMessage('Question added ✔', true);
    loadAdmin();
  } catch (err) {
    adminMessage(err.message, false);
  }
});

async function deleteQuestion(id) {
  if (!confirm('Delete this question?')) return;
  try {
    await api('/questions/' + id, 'DELETE');
    adminMessage('Question deleted', true);
    loadAdmin();
  } catch (err) {
    adminMessage(err.message, false);
  }
}

/* ============================================================
   START
   ============================================================ */
updateNav();
if (token) showPage('quiz');
else showPage('auth');