const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers (admin)
router.get('/', authenticateToken, (req, res) => {
    try {
        const search = req.query.search;
        let customers;
        if (search) {
            customers = db.prepare(`
                SELECT c.*, 
                    (SELECT COUNT(*) FROM appointments WHERE customer_id = c.id) as appointment_count,
                    (SELECT MAX(date) FROM appointments WHERE customer_id = c.id) as last_visit
                FROM customers c 
                WHERE c.full_name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?
                ORDER BY c.full_name ASC
            `).all(`%${search}%`, `%${search}%`, `%${search}%`);
        } else {
            customers = db.prepare(`
                SELECT c.*, 
                    (SELECT COUNT(*) FROM appointments WHERE customer_id = c.id) as appointment_count,
                    (SELECT MAX(date) FROM appointments WHERE customer_id = c.id) as last_visit
                FROM customers c ORDER BY c.created_at DESC
            `).all();
        }
        res.json(customers);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// GET /api/customers/:id (admin)
router.get('/:id', authenticateToken, (req, res) => {
    try {
        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!customer) return res.status(404).json({ error: 'Müşteri bulunamadı' });

        const appointments = db.prepare(`
            SELECT a.*, s.name as service_name, st.full_name as staff_name 
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE a.customer_id = ?
            ORDER BY a.date DESC, a.start_time DESC
        `).all(req.params.id);

        res.json({ ...customer, appointments });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// POST /api/customers
router.post('/', (req, res) => {
    try {
        const { full_name, phone, email, notes } = req.body;
        if (!full_name || !phone) {
            return res.status(400).json({ error: 'İsim ve telefon zorunludur' });
        }

        // Check if customer with same phone exists
        const existing = db.prepare('SELECT * FROM customers WHERE phone = ?').get(phone);
        if (existing) {
            // Update name/email if provided
            if (full_name) {
                db.prepare('UPDATE customers SET full_name = ?, email = COALESCE(?, email) WHERE id = ?')
                    .run(full_name, email, existing.id);
            }
            const updated = db.prepare('SELECT * FROM customers WHERE id = ?').get(existing.id);
            return res.json(updated);
        }

        const result = db.prepare(
            'INSERT INTO customers (full_name, phone, email, notes) VALUES (?, ?, ?, ?)'
        ).run(full_name, phone, email || '', notes || '');

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(result.lastInsertRowid);
        res.status(201).json(customer);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// PUT /api/customers/:id (admin)
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const { full_name, phone, email, notes } = req.body;
        const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Müşteri bulunamadı' });

        db.prepare('UPDATE customers SET full_name=?, phone=?, email=?, notes=? WHERE id=?').run(
            full_name || existing.full_name,
            phone || existing.phone,
            email !== undefined ? email : existing.email,
            notes !== undefined ? notes : existing.notes,
            req.params.id
        );

        const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        res.json(customer);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// DELETE /api/customers/:id (admin)
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM customers WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Müşteri bulunamadı' });

        db.prepare('DELETE FROM customers WHERE id = ?').run(req.params.id);
        res.json({ message: 'Müşteri silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

module.exports = router;
