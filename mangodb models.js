const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true },
  password: String,
  role: { type: String, default: 'student' }, // admin ya student
  totalScore: { type: Number, default: 0 }
});

const QuestionSchema = new mongoose.Schema({
  question: String,
  options: [String],
  answer: Number,
  category: { type: String, default: 'General' }, // JS, Python, GK
  difficulty: { type: String, default: 'Medium' }, // Easy, Medium, Hard
  timeLimit: { type: Number, default: 30 } // 30 sec
});

module.exports = {
  User: mongoose.model('User', UserSchema),
  Question: mongoose.model('Question', QuestionSchema)
};