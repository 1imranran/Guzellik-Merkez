const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../database');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });
        }

        const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
        if (!user) {
            return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
        }

        const valid = bcrypt.compareSync(password, user.password_hash);
        if (!valid) {
            return res.status(401).json({ error: 'Geçersiz kullanıcı adı veya şifre' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            token,
            user: {
                id: user.id,
                username: user.username,
                full_name: user.full_name,
                role: user.role
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
    try {
        const user = db.prepare('SELECT id, username, full_name, role FROM users WHERE id = ?').get(req.user.id);
        if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
        res.json(user);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// PUT /api/auth/password
router.put('/password', authenticateToken, (req, res) => {
    try {
        const { current_password, new_password } = req.body;
        if (!current_password || !new_password) {
            return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli' });
        }
        const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
        if (!bcrypt.compareSync(current_password, user.password_hash)) {
            return res.status(401).json({ error: 'Mevcut şifre hatalı' });
        }
        const hash = bcrypt.hashSync(new_password, 10);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
        res.json({ message: 'Şifre başarıyla güncellendi' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

module.exports = router;
