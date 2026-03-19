const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Helper: check time overlap
function timesOverlap(start1, end1, start2, end2) {
    return start1 < end2 && start2 < end1;
}

// Helper: add minutes to time string (HH:MM)
function addMinutes(time, minutes) {
    const [h, m] = time.split(':').map(Number);
    const totalMinutes = h * 60 + m + minutes;
    const newH = Math.floor(totalMinutes / 60);
    const newM = totalMinutes % 60;
    return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}`;
}

// Helper: time string to minutes
function timeToMinutes(time) {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + m;
}

// GET /api/appointments (admin)
router.get('/', authenticateToken, (req, res) => {
    try {
        const { date, staff_id, status, start_date, end_date } = req.query;
        let query = `
            SELECT a.*, 
                c.full_name as customer_name, c.phone as customer_phone,
                s.name as service_name, s.duration_minutes, s.price as service_price,
                st.full_name as staff_name
            FROM appointments a
            LEFT JOIN customers c ON a.customer_id = c.id
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE 1=1
        `;
        const params = [];

        if (date) {
            query += ' AND a.date = ?';
            params.push(date);
        }
        if (start_date && end_date) {
            query += ' AND a.date >= ? AND a.date <= ?';
            params.push(start_date, end_date);
        }
        if (staff_id) {
            query += ' AND a.staff_id = ?';
            params.push(staff_id);
        }
        if (status) {
            query += ' AND a.status = ?';
            params.push(status);
        }

        query += ' ORDER BY a.date ASC, a.start_time ASC';
        const appointments = db.prepare(query).all(...params);
        res.json(appointments);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// GET /api/appointments/available-slots?staff_id=X&service_id=Y&date=YYYY-MM-DD (public)
router.get('/available-slots', (req, res) => {
    try {
        const { staff_id, service_id, date } = req.query;
        if (!staff_id || !service_id || !date) {
            return res.status(400).json({ error: 'staff_id, service_id ve date gerekli' });
        }

        // Get service duration
        const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(service_id);
        if (!service) return res.status(404).json({ error: 'Hizmet bulunamadı' });

        // Get day of week (0=Sunday, 1=Monday, ...)
        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();

        // Get staff schedule for this day
        const schedule = db.prepare('SELECT * FROM staff_schedule WHERE staff_id = ? AND day_of_week = ?').get(staff_id, dayOfWeek);
        if (!schedule || schedule.is_off) {
            return res.json({ slots: [], message: 'Personel bu gün çalışmıyor' });
        }

        // Get existing appointments for this staff on this date (non-cancelled)
        const existingAppts = db.prepare(
            "SELECT start_time, end_time FROM appointments WHERE staff_id = ? AND date = ? AND status NOT IN ('cancelled')"
        ).all(staff_id, date);

        // Generate available slots
        const slots = [];
        const slotInterval = 15; // 15 minute intervals
        const workStart = timeToMinutes(schedule.start_time);
        const workEnd = timeToMinutes(schedule.end_time);
        const duration = service.duration_minutes;

        for (let time = workStart; time + duration <= workEnd; time += slotInterval) {
            const slotStart = `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
            const slotEnd = addMinutes(slotStart, duration);

            // Check for conflicts with existing appointments
            let hasConflict = false;
            for (const appt of existingAppts) {
                if (timesOverlap(slotStart, slotEnd, appt.start_time, appt.end_time)) {
                    hasConflict = true;
                    break;
                }
            }

            if (!hasConflict) {
                slots.push({ start_time: slotStart, end_time: slotEnd });
            }
        }

        // Don't show past time slots for today
        const now = new Date();
        const today = now.toISOString().split('T')[0];
        let filteredSlots = slots;
        if (date === today) {
            const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
            filteredSlots = slots.filter(s => s.start_time > currentTime);
        }

        res.json({ slots: filteredSlots, service, date });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// POST /api/appointments (public - booking)
router.post('/', (req, res) => {
    try {
        const { customer_id, customer_name, customer_phone, customer_email, staff_id, service_id, date, start_time, notes } = req.body;

        if (!staff_id || !service_id || !date || !start_time) {
            return res.status(400).json({ error: 'Personel, hizmet, tarih ve saat zorunludur' });
        }

        if ((!customer_id) && (!customer_name || !customer_phone)) {
            return res.status(400).json({ error: 'Müşteri bilgileri zorunludur' });
        }

        // Get service
        const service = db.prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(service_id);
        if (!service) return res.status(404).json({ error: 'Hizmet bulunamadı' });

        // Calculate end time
        const end_time = addMinutes(start_time, service.duration_minutes);

        // Validate staff exists and is active
        const staff = db.prepare('SELECT * FROM staff WHERE id = ? AND is_active = 1').get(staff_id);
        if (!staff) return res.status(404).json({ error: 'Personel bulunamadı' });

        // Check staff works on this day
        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dateObj.getDay();
        const schedule = db.prepare('SELECT * FROM staff_schedule WHERE staff_id = ? AND day_of_week = ?').get(staff_id, dayOfWeek);
        if (!schedule || schedule.is_off) {
            return res.status(400).json({ error: 'Personel bu gün çalışmıyor' });
        }

        // Check time is within work hours
        if (start_time < schedule.start_time || end_time > schedule.end_time) {
            return res.status(400).json({ error: 'Seçilen saat personelin çalışma saatleri dışında' });
        }

        // *** CRITICAL: Check for time conflicts ***
        const conflicts = db.prepare(
            "SELECT * FROM appointments WHERE staff_id = ? AND date = ? AND status NOT IN ('cancelled') AND start_time < ? AND end_time > ?"
        ).all(staff_id, date, end_time, start_time);

        if (conflicts.length > 0) {
            return res.status(409).json({ error: 'Bu saat diliminde personelin başka bir randevusu var. Lütfen başka bir saat seçin.' });
        }

        // Check date is not in the past
        const today = new Date().toISOString().split('T')[0];
        if (date < today) {
            return res.status(400).json({ error: 'Geçmiş tarihe randevu oluşturulamaz' });
        }

        // Create or find customer
        let finalCustomerId = customer_id;
        if (!finalCustomerId) {
            const existingCustomer = db.prepare('SELECT * FROM customers WHERE phone = ?').get(customer_phone);
            if (existingCustomer) {
                finalCustomerId = existingCustomer.id;
                // Update name if different
                if (customer_name && customer_name !== existingCustomer.full_name) {
                    db.prepare('UPDATE customers SET full_name = ? WHERE id = ?').run(customer_name, existingCustomer.id);
                }
            } else {
                const customerResult = db.prepare(
                    'INSERT INTO customers (full_name, phone, email) VALUES (?, ?, ?)'
                ).run(customer_name, customer_phone, customer_email || '');
                finalCustomerId = customerResult.lastInsertRowid;
            }
        }

        // Create appointment
        const result = db.prepare(
            'INSERT INTO appointments (customer_id, staff_id, service_id, date, start_time, end_time, status, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        ).run(finalCustomerId, staff_id, service_id, date, start_time, end_time, 'pending', notes || '');

        const appointment = db.prepare(`
            SELECT a.*, 
                c.full_name as customer_name, c.phone as customer_phone,
                s.name as service_name, s.price as service_price,
                st.full_name as staff_name
            FROM appointments a
            LEFT JOIN customers c ON a.customer_id = c.id
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE a.id = ?
        `).get(result.lastInsertRowid);

        res.status(201).json(appointment);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// PUT /api/appointments/:id (admin)
router.put('/:id', authenticateToken, (req, res) => {
    try {
        const { staff_id, service_id, date, start_time, status, notes } = req.body;
        const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Randevu bulunamadı' });

        const finalStaffId = staff_id || existing.staff_id;
        const finalServiceId = service_id || existing.service_id;
        const finalDate = date || existing.date;
        const finalStartTime = start_time || existing.start_time;
        const finalStatus = status || existing.status;

        // Recalculate end time if service or start_time changed
        let finalEndTime = existing.end_time;
        if (service_id || start_time) {
            const service = db.prepare('SELECT * FROM services WHERE id = ?').get(finalServiceId);
            finalEndTime = addMinutes(finalStartTime, service.duration_minutes);
        }

        // Check conflicts if time/date/staff changed (skip if just status update)
        if (staff_id || date || start_time) {
            const conflicts = db.prepare(
                "SELECT * FROM appointments WHERE staff_id = ? AND date = ? AND id != ? AND status NOT IN ('cancelled') AND start_time < ? AND end_time > ?"
            ).all(finalStaffId, finalDate, req.params.id, finalEndTime, finalStartTime);

            if (conflicts.length > 0) {
                return res.status(409).json({ error: 'Bu saat diliminde çakışma var' });
            }
        }

        db.prepare(`
            UPDATE appointments SET staff_id=?, service_id=?, date=?, start_time=?, end_time=?, status=?, notes=? WHERE id=?
        `).run(finalStaffId, finalServiceId, finalDate, finalStartTime, finalEndTime, finalStatus, notes !== undefined ? notes : existing.notes, req.params.id);

        const appointment = db.prepare(`
            SELECT a.*, 
                c.full_name as customer_name, c.phone as customer_phone,
                s.name as service_name, s.price as service_price,
                st.full_name as staff_name
            FROM appointments a
            LEFT JOIN customers c ON a.customer_id = c.id
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE a.id = ?
        `).get(req.params.id);

        res.json(appointment);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// PUT /api/appointments/:id/status (admin quick status update)
router.put('/:id/status', authenticateToken, (req, res) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Geçersiz durum. Geçerli durumlar: ' + validStatuses.join(', ') });
        }
        const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Randevu bulunamadı' });

        db.prepare('UPDATE appointments SET status = ? WHERE id = ?').run(status, req.params.id);
        
        const appointment = db.prepare(`
            SELECT a.*, 
                c.full_name as customer_name, c.phone as customer_phone,
                s.name as service_name, s.price as service_price,
                st.full_name as staff_name
            FROM appointments a
            LEFT JOIN customers c ON a.customer_id = c.id
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE a.id = ?
        `).get(req.params.id);

        res.json(appointment);
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// DELETE /api/appointments/:id (admin)
router.delete('/:id', authenticateToken, (req, res) => {
    try {
        const existing = db.prepare('SELECT * FROM appointments WHERE id = ?').get(req.params.id);
        if (!existing) return res.status(404).json({ error: 'Randevu bulunamadı' });

        db.prepare('DELETE FROM appointments WHERE id = ?').run(req.params.id);
        res.json({ message: 'Randevu silindi' });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

module.exports = router;
