// app.js
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

// ✅ Mongo 연결 추가
const mongoose = require('mongoose');
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/moru_notes';
const dbReady = mongoose.connect(MONGODB_URI)
    .then(() => console.log('✅ MongoDB connected:', MONGODB_URI))
    .catch(err => {
        console.error('❌ MongoDB connection error:', err);
        throw err; // bin/www에서 catch 가능하도록 throw
    });

// ✅ 라우터/세션
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const session = require('express-session');

var app = express();

// (pug 기본설정은 안 써도 됨)
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 정적 파일
app.use(express.static(path.join(__dirname, 'public')));

// 세션
app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret',
    resave: false,
    saveUninitialized: false,   // ✅ 빈 세션 저장 방지
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,            // HTTPS라면 true
        maxAge: 1000 * 60 * 60    // 1h
    }
    // store: 프로덕션은 MemoryStore 대신 Redis 등 사용 권장
}));

// 라우팅
app.use('/', indexRouter);
app.use('/users', usersRouter);

// 404
app.use(function (req, res) {
    res.status(404).send('<h1>404</h1><a href="/">홈으로</a>');
});

// ✅ 여기! app과 dbReady를 함께 export
module.exports = { app, dbReady };
