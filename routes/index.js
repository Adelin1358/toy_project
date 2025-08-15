// routes/index.js
const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const Memo = require('../models/Memo.js');

const router = express.Router();

/** === 데모용 유저 저장소(메모리) ===
 * 실제 서비스에서는 DB(User 모델)로 바꾸세요.
 */
let users = []; // { id, username, passwordHash }
let nextUserId = 1;

// 로그인 필요 보호 미들웨어
function requireLogin(req, res, next) {
    if (!req.session || !req.session.userId) return res.redirect('/');
    next();
}

// XSS 방지
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, ch => (
        {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;', "'":'&#39;'}[ch]
    ));
}

/* ---------- 인증/계정 ---------- */

// 로그인 페이지 (정적 HTML)
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'pages', 'login.html'));
});

// 회원가입 페이지 (정적 HTML로 리다이렉트)
router.get('/signup', (req, res) => {
    res.redirect('/pages/signup.html');
});

// 회원가입 처리: POST /signup
router.post('/signup', async (req, res) => {
    try {
        const rawUsername = typeof req.body.username === 'string' ? req.body.username : '';
        const rawPassword = typeof req.body.password === 'string' ? req.body.password : '';
        const username = rawUsername.trim();
        const password = rawPassword.trim();

        // 기본 검증
        if (!username || !password) {
            return res.status(400)
                .send('<p>아이디/비밀번호를 입력하세요</p><p><a href="/pages/signup.html">뒤로</a></p>');
        }
        if (username.length > 30) {
            return res.status(400)
                .send('<p>아이디는 30자 이내로 입력하세요</p><p><a href="/pages/signup.html">뒤로</a></p>');
        }
        if (password.length < 4 || password.length > 100) {
            return res.status(400)
                .send('<p>비밀번호는 4~100자로 입력하세요</p><p><a href="/pages/signup.html">뒤로</a></p>');
        }
        if (users.find(u => u.username === username)) {
            return res.status(409)
                .send('<p>이미 존재하는 아이디입니다</p><p><a href="/pages/signup.html">뒤로</a></p>');
        }

        // 비밀번호 해시 저장
        const passwordHash = await bcrypt.hash(password, 10);
        users.push({ id: nextUserId++, username, passwordHash });

        // 가입 후 로그인 화면으로
        res.redirect('/');
    } catch (err) {
        console.error(err);
        res.status(500).send('<p>서버 오류가 발생했습니다</p><p><a href="/pages/signup.html">뒤로</a></p>');
    }
});

// 로그인 처리: POST /login
router.post('/login', async (req, res) => {
    try {
        const rawUsername = typeof req.body.username === 'string' ? req.body.username : '';
        const rawPassword = typeof req.body.password === 'string' ? req.body.password : '';
        const username = rawUsername.trim();
        const password = rawPassword.trim();

        if (!username || !password) {
            return res.status(400)
                .send('<p>아이디/비밀번호를 입력하세요</p><p><a href="/">로그인 화면</a></p>');
        }

        const user = users.find(u => u.username === username);
        if (!user) return authFail(res);

        const ok = await bcrypt.compare(password, user.passwordHash);
        if (!ok) return authFail(res);

        // 세션 기록
        req.session.userId = user.id;
        req.session.username = user.username;

        // 로그인 성공 → 메모 목록으로
        res.redirect('/memo');
    } catch (err) {
        console.error(err);
        res.status(500).send('<p>서버 오류가 발생했습니다</p><p><a href="/">로그인 화면</a></p>');
    }
});

function authFail(res) {
    return res
        .status(401)
        .send('<p>아이디 또는 비밀번호가 올바르지 않습니다</p><p><a href="/">로그인 화면</a></p>');
}

// 로그아웃: POST /logout
router.post('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/'));
});

/* ---------- 메모: 작성/목록 ---------- */

// 메모 작성: POST /memo
router.post('/memo', requireLogin, async (req, res) => {
    try {
        const raw = typeof req.body.content === 'string' ? req.body.content : '';
        const content = raw.trim();

        if (!content) {
            return res.status(400)
                .send('<p>내용을 입력하세요</p><p><a href="/pages/memo-form.html">뒤로</a></p>');
        }
        if (content.length > 2000) {
            return res.status(413)
                .send('<p>메모는 2000자 이내로 작성하세요</p><p><a href="/pages/memo-form.html">뒤로</a></p>');
        }

        await Memo.create({ userId: req.session.userId, content });
        res.redirect('/memo');
    } catch (err) {
        console.error(err);
        res.status(500).send('<p>서버 오류가 발생했습니다</p><p><a href="/pages/memo-form.html">뒤로</a></p>');
    }
});

// 메모 목록: GET /memo  (HTML 기본, ?format=json일 때만 JSON)
router.get('/memo', requireLogin, async (req, res) => {
    try {
        const list = await Memo.find({ userId: req.session.userId })
            .sort({ createdAt: -1 })
            .lean();

        // JSON은 오직 ?format=json 때만 (클라 포맷팅 쉬우라고 ISO로)
        if (req.query.format === 'json') {
            return res.json(list.map(m => ({
                _id: m._id,
                content: m.content,
                createdAt: new Date(m.createdAt).toISOString()
            })));
        }

        const items = list.map(m =>
            `<li>${escapeHtml(m.content)} <small>(${new Date(m.createdAt).toLocaleString()})</small></li>`
        ).join('');

        res.send(`
      <link rel="stylesheet" href="/stylesheets/style.css" />
      <main class="card">
        <h1>${escapeHtml(req.session.username)}님의 메모</h1>
        <ul>${items || '<li>작성한 메모가 없습니다.</li>'}</ul>
        <p><a href="/pages/memo-form.html">새 메모</a> | <a href="/memo?format=json">JSON 보기</a></p>
        <form method="POST" action="/logout" style="margin-top:12px;">
          <button type="submit">로그아웃</button>
        </form>
      </main>
    `);
    } catch (err) {
        console.error(err);
        res.status(500).send('<p>목록을 불러오는 중 오류가 발생했습니다</p><p><a href="/">홈</a></p>');
    }
});

module.exports = router;
