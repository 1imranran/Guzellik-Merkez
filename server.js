const express = require('express');
const cors = require('cors');
const path = require('path');
const { initializeDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/services', require('./routes/services'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/appointments', require('./routes/appointments'));
app.use('/api/reports', require('./routes/reports'));

// SPA fallback
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
    console.log(`\n🌸 ═══════════════════════════════════════════`);
    console.log(`   Güzellik Merkezi Randevu Sistemi`);
    console.log(`   Sunucu çalışıyor: http://localhost:${PORT}`);
    console.log(`   Admin Panel:      http://localhost:${PORT}/admin`);
    console.log(`   Admin Giriş:      admin / admin123`);
    console.log(`🌸 ═══════════════════════════════════════════\n`);
});

module.exports = app;
