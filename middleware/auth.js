const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'beauty-salon-secret-key-2024';

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Yetkilendirme gerekli' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(403).json({ error: 'Geçersiz veya süresi dolmuş token' });
    }
}

module.exports = { authenticateToken, JWT_SECRET };
