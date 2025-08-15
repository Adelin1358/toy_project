// routes/users.js
const express = require('express');
const router = express.Router();

// 현재 로그인한 사용자 정보 확인용 간단 API
router.get('/me', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({ loggedIn: false });
    }
    res.json({
        loggedIn: true,
        userId: req.session.userId,
        username: req.session.username
    });
});

module.exports = router;
