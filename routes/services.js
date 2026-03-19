const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/services - List all services (public)
router.get('/', (req, res) => {
    try {
        const activeOnly = req.query.active !== 'false';
        let query = 'SELECT * FROM services';
        if (activeOnly) query += ' WHERE is_active = 1';
        query += ' ORDER BY sort_order ASC, name ASC';
        const services = db.prepare(query).all();
        res.json(services);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// GET /api/services/categories
router.get('/categories', (req, res) => {
    try {
        const categories = db.prepare('SELECT DISTINCT category FROM services WHERE is_active = 1 ORDER BY category').all();
        res.json(categories.map(c => c.category));
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// GET /api/services/:id
router.get('/:id', (req, res) => {
    try {
        const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
        if (!service) return res.status(404).json({ error: 'Hizmet bulunamadı' });
        res.json(service);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// POST /api/services (admin)
router.post('/', authenticateToken, (req, res) => {
    try {
        const { name, description, duration_minutes, price, category, image_url, sort_order } = req.body;
        if (!name || !duration_minutes || price === undefined) {
            return res.status(400).json({ error: 'Ad, süre ve fiyat zorunludur' });
        }
        const result = db.prepare(
            'INSERT INTO services (name, description, duration_minutes, price, category, image_url, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).run(name, description || '', duration_minutes, price, category || 'Genel', image_url || '', sort_order || 0);
        const service = db.prepare('SELECT * FROM services WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(service);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// PUT /api/services/:id (admin)
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const { name, description, duration_minutes, price, category, image_url, is_active, sort_order } = req.body;
        const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Hizmet bulunamadı' });

        db.prepare(`
            UPDATE services SET name=?, description=?, duration_minutes=?, price=?, category=?, image_url=?, is_active=?, sort_order=?
            WHERE id=?
        `).run(
            name || existing.name,
            description !== undefined ? description : existing.description,
            duration_minutes || existing.duration_minutes,
            price !== undefined ? price : existing.price,
            category || existing.category,
            image_url !== undefined ? image_url : existing.image_url,
            is_active !== undefined ? is_active : existing.is_active,
            sort_order !== undefined ? sort_order : existing.sort_order,
            req.params.id
        );
        const service = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
        res.json(service);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// DELETE /api/services/:id (admin)
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Hizmet bulunamadı' });
        
        // Check if there are future appointments with this service
        const futureAppts = db.prepare(
            "SELECT COUNT(*) as cnt FROM appointments WHERE service_id = ? AND date >= date('now') AND status NOT IN ('cancelled','completed')"
        ).get(req.params.id);
        
        if (futureAppts.cnt > 0) {
            return res.status(400).json({ error: 'Bu hizmete ait gelecekteki randevular var. Önce onları iptal edin.' });
        }
        
        db.prepare('DELETE FROM services WHERE id = ?').run(req.params.id);
        res.json({ message: 'Hizmet silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

module.exports = router;
