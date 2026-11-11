const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static(__dirname));

const JWT_SECRET = "7th-semester-secret-key-123";
const DB_FILE = path.join(__dirname, 'quiz-db.json');

// ===== FILE ME SAVE HOGA - Restart pe delete nahi hoga =====
let users = [];
let questions = [];
let nextUserId = 1;
let nextQId = 1;

function saveDB() {
  fs.writeFileSync(DB_FILE, JSON.stringify({ users, questions, nextUserId, nextQId }, null, 2));
}

function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      users = data.users || [];
      questions = data.questions || [];
      nextUserId = data.nextUserId || 1;
      nextQId = data.nextQId || 1;
      console.log("Old data load ho gaya - Questions:", questions.length, "Users:", users.length);
      return true;
    } catch (e) { console.log("DB file kharab thi, naya bana raha hu"); }
  }
  return false;
}

async function createDefaultData() {
  const hashed = await bcrypt.hash("admin123", 10);
  users.push({
    id: nextUserId++,
    username: "admin",
    name: "admin",
    email: "admin@quiz.com",
    password: hashed,
    role: "admin",
    bestScore: 0,
    attempts: 0
  });
  const sample = [
    { question: "Pakistan ka capital kya hai?", options: ["Karachi", "Lahore", "Islamabad", "Quetta"], answer: 2, category: "GK" },
    { question: "2 + 2 = ?", options: ["3", "4", "5", "6"], answer: 1, category: "GK" },
    { question: "HTML ka full form kya hai?", options: ["Hyper Text Markup Language", "High Text Machine Language", "Hyper Tabular Markup Language", "None"], answer: 0, category: "JS" },
    { question: "JavaScript me variable kaise banate hain?", options: ["var", "let", "const", "Sab sahi hain"], answer: 3, category: "JS" },
    { question: "Python ka creator kaun hai?", options: ["Guido van Rossum", "Bill Gates", "Steve Jobs", "Mark Zuckerberg"], answer: 0, category: "Python" },
  ];
  sample.forEach(q => questions.push({ id: nextQId++, ...q }));
  saveDB();
}

// Pehle purana data load karo, agar nahi hai to naya banao
if (!loadDB()) {
  createDefaultData();
}

function auth(req, res, next) {
  let token = req.headers['authorization'];
  if (!token) return res.status(401).json({ message: "No Token" });
  if (token.startsWith('Bearer ')) token = token.slice(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) { return res.status(401).json({ message: "Invalid Token" }); }
}

app.post('/api/register', async (req, res) => {
  const username = req.body.username || req.body.name || req.body.email;
  const password = req.body.password;
  if (!username || !password) return res.status(400).json({ message: "Username aur password chahiye" });
  const exists = users.find(u => u.username === username);
  if (exists) return res.status(400).json({ message: "User already exists" });
  const hashed = await bcrypt.hash(password, 10);
  const user = { id: nextUserId++, username, name: username, email: username, password: hashed, role: 'student', bestScore: 0, attempts: 0 };
  users.push(user);
  saveDB();
  const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET);
  res.json({ token, user: { username: user.username, role: user.role, bestScore: 0 } });
});

app.post('/api/login', async (req, res) => {
  const username = req.body.username || req.body.email || req.body.name;
  const password = req.body.password;
  const user = users.find(u => u.username === username);
  if (!user) return res.status(400).json({ message: "User not found" });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Wrong Password" });
  const token = jwt.sign({ id: user.id, role: user.role, username: user.username }, JWT_SECRET);
  res.json({ token, user: { username: user.username, role: user.role, bestScore: user.bestScore } });
});

app.get('/api/questions', auth, async (req, res) => {
  const { category } = req.query;
  let list = questions;
  if (category && category !== 'All') list = list.filter(q => q.category === category);
  res.json(list);
});

app.post('/api/questions', auth, async (req, res) => {
  const { question, options, answer, category } = req.body;
  const q = { id: nextQId++, question, options, answer: Number(answer), category: category || 'General' };
  questions.push(q);
  saveDB();
  res.json(q);
});

app.delete('/api/questions/:id', auth, async (req, res) => {
  const id = Number(req.params.id);
  questions = questions.filter(q => q.id !== id);
  saveDB();
  res.json({ message: "Deleted" });
});

app.post('/api/submit-score', auth, async (req, res) => {
  const { score } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (user) {
    user.attempts = (user.attempts || 0) + 1;
    if (score > user.bestScore) user.bestScore = score;
    saveDB();
    res.json({ bestScore: user.bestScore });
  } else {
    res.json({ bestScore: score });
  }
});

app.post('/api/submit', auth, async (req, res) => {
  const { score } = req.body;
  const user = users.find(u => u.id === req.user.id);
  if (user) {
    user.attempts = (user.attempts || 0) + 1;
    if (score > user.bestScore) user.bestScore = score;
    saveDB();
    res.json({ message: "Score Saved", bestScore: user.bestScore });
  } else res.json({ message: "Score Saved" });
});

app.get('/api/leaderboard', auth, async (req, res) => {
  const top = [...users].sort((a, b) => b.bestScore - a.bestScore).slice(0, 10)
    .map(u => ({ username: u.username, bestScore: u.bestScore, attempts: u.attempts || 0 }));
  res.json(top);
});

app.listen(5000, () => console.log("Server running on http://localhost:5000 - Data ab File me save hoga"));