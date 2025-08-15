// models/Memo.js
const mongoose = require('mongoose');

const memoSchema = new mongoose.Schema({
    userId: { type: Number, required: true },  // 세션에 저장한 숫자 ID 사용
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Memo', memoSchema);
