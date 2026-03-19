const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/staff - List all staff (public with limited info)
router.get('/', (req, res) => {
    try {
        const activeOnly = req.query.active !== 'false';
        let query = 'SELECT * FROM staff';
        if (activeOnly) query += ' WHERE is_active = 1';
        query += ' ORDER BY full_name ASC';
        const staff = db.prepare(query).all();
        res.json(staff);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// GET /api/staff/:id
router.get('/:id', (req, res) => {
    try {
        const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
        if (!member) return res.status(404).json({ error: 'Personel bulunamadı' });

        // Get assigned services
        const services = db.prepare(`
            SELECT s.* FROM services s 
            INNER JOIN staff_services ss ON s.id = ss.service_id 
            WHERE ss.staff_id = ? AND s.is_active = 1
        `).all(req.params.id);

        // Get schedule
        const schedule = db.prepare('SELECT * FROM staff_schedule WHERE staff_id = ? ORDER BY day_of_week').all(req.params.id);

        res.json({ ...member, services, schedule });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// GET /api/staff/by-service/:serviceId - Get staff for a specific service (public)
router.get('/by-service/:serviceId', (req, res) => {
    try {
        const staff = db.prepare(`
            SELECT s.* FROM staff s 
            INNER JOIN staff_services ss ON s.id = ss.staff_id 
            WHERE ss.service_id = ? AND s.is_active = 1
            ORDER BY s.full_name
        `).all(req.params.serviceId);
        res.json(staff);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// POST /api/staff (admin)
router.post('/', authenticateToken, (req, res) => {
    try {
        const { full_name, phone, email, specialty, avatar_url, service_ids } = req.body;
        if (!full_name) {
            return res.status(400).json({ error: 'İsim zorunludur' });
        }

        const result = db.prepare(
            'INSERT INTO staff (full_name, phone, email, specialty, avatar_url) VALUES (?, ?, ?, ?, ?)'
        ).run(full_name, phone || '', email || '', specialty || '', avatar_url || '');

        const staffId = result.lastInsertRowid;

        // Set default schedule (Mon-Sat 09:00-18:00, Sunday off)
        const scheduleStmt = db.prepare('INSERT INTO staff_schedule (staff_id, day_of_week, start_time, end_time, is_off) VALUES (?, ?, ?, ?, ?)');
        for (let day = 0; day <= 6; day++) {
            scheduleStmt.run(staffId, day, '09:00', '18:00', day === 0 ? 1 : 0);
        }

        // Assign services
        if (service_ids && service_ids.length > 0) {
            const svcStmt = db.prepare('INSERT INTO staff_services (staff_id, service_id) VALUES (?, ?)');
            for (const sid of service_ids) {
                svcStmt.run(staffId, sid);
            }
        }

        const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(staffId);
        res.status(201).json(member);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// PUT /api/staff/:id (admin)
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const { full_name, phone, email, specialty, avatar_url, is_active, service_ids } = req.body;
        const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Personel bulunamadı' });

        db.prepare(`
            UPDATE staff SET full_name=?, phone=?, email=?, specialty=?, avatar_url=?, is_active=? WHERE id=?
        `).run(
            full_name || existing.full_name,
            phone !== undefined ? phone : existing.phone,
            email !== undefined ? email : existing.email,
            specialty !== undefined ? specialty : existing.specialty,
            avatar_url !== undefined ? avatar_url : existing.avatar_url,
            is_active !== undefined ? is_active : existing.is_active,
            req.params.id
        );

        // Update service assignments if provided
        if (service_ids !== undefined) {
            db.prepare('DELETE FROM staff_services WHERE staff_id = ?').run(req.params.id);
            if (service_ids.length > 0) {
                const svcStmt = db.prepare('INSERT INTO staff_services (staff_id, service_id) VALUES (?, ?)');
                for (const sid of service_ids) {
                    svcStmt.run(req.params.id, sid);
                }
            }
        }

        const member = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
        res.json(member);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// PUT /api/staff/:id/schedule (admin)
router.put('/:id/schedule', authenticateToken, (req, res) => {
    try {
        const { schedule } = req.body;
        if (!schedule || !Array.isArray(schedule)) {
            return res.status(400).json({ error: 'Çalışma saatleri gerekli' });
        }

        const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Personel bulunamadı' });

        const stmt = db.prepare(`
            INSERT OR REPLACE INTO staff_schedule (staff_id, day_of_week, start_time, end_time, is_off) 
            VALUES (?, ?, ?, ?, ?)
        `);

        for (const s of schedule) {
            stmt.run(req.params.id, s.day_of_week, s.start_time || '09:00', s.end_time || '18:00', s.is_off ? 1 : 0);
        }

        const updatedSchedule = db.prepare('SELECT * FROM staff_schedule WHERE staff_id = ? ORDER BY day_of_week').all(req.params.id);
        res.json(updatedSchedule);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// DELETE /api/staff/:id (admin)
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM staff WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Personel bulunamadı' });

        const futureAppts = db.prepare(
            "SELECT COUNT(*) as cnt FROM appointments WHERE staff_id = ? AND date >= date('now') AND status NOT IN ('cancelled','completed')"
        ).get(req.params.id);

        if (futureAppts.cnt > 0) {
            return res.status(400).json({ error: 'Bu personelin gelecekteki randevuları var. Önce onları iptal edin.' });
        }

        db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
        res.json({ message: 'Personel silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

module.exports = router;
