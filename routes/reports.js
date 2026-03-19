const express = require('express');
const { db } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/dashboard
router.get('/dashboard', authenticateToken, (req, res) => {
    try {
        const today = new Date().toISOString().split('T')[0];

        // Today's appointments
        const todayAppts = db.prepare(`
            SELECT a.*, 
                c.full_name as customer_name, c.phone as customer_phone,
                s.name as service_name, s.price as service_price, s.duration_minutes,
                st.full_name as staff_name
            FROM appointments a
            LEFT JOIN customers c ON a.customer_id = c.id
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE a.date = ?
            ORDER BY a.start_time ASC
        `).all(today);

        // Stats
        const todayCount = todayAppts.length;
        const pendingCount = db.prepare("SELECT COUNT(*) as cnt FROM appointments WHERE status = 'pending' AND date >= ?").get(today).cnt;
        const totalCustomers = db.prepare('SELECT COUNT(*) as cnt FROM customers').get().cnt;
        const totalServices = db.prepare('SELECT COUNT(*) as cnt FROM services WHERE is_active = 1').get().cnt;

        // This month revenue (completed appointments)
        const monthStart = today.substring(0, 7) + '-01';
        const monthRevenue = db.prepare(`
            SELECT COALESCE(SUM(s.price), 0) as total 
            FROM appointments a 
            LEFT JOIN services s ON a.service_id = s.id 
            WHERE a.status = 'completed' AND a.date >= ? AND a.date <= ?
        `).get(monthStart, today).total;

        // This week appointment count
        const weekStart = new Date();
        weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        const weekAppts = db.prepare(
            "SELECT COUNT(*) as cnt FROM appointments WHERE date >= ? AND date <= ? AND status NOT IN ('cancelled')"
        ).get(weekStartStr, today).cnt;

        // Upcoming appointments (next 7 days)
        const next7 = new Date();
        next7.setDate(next7.getDate() + 7);
        const next7Str = next7.toISOString().split('T')[0];
        const upcomingAppts = db.prepare(`
            SELECT a.*, 
                c.full_name as customer_name, c.phone as customer_phone,
                s.name as service_name, s.price as service_price,
                st.full_name as staff_name
            FROM appointments a
            LEFT JOIN customers c ON a.customer_id = c.id
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE a.date > ? AND a.date <= ? AND a.status NOT IN ('cancelled','completed')
            ORDER BY a.date ASC, a.start_time ASC
            LIMIT 20
        `).all(today, next7Str);

        res.json({
            today_appointments: todayAppts,
            upcoming_appointments: upcomingAppts,
            stats: {
                today_count: todayCount,
                pending_count: pendingCount,
                week_appointments: weekAppts,
                total_customers: totalCustomers,
                total_services: totalServices,
                month_revenue: monthRevenue
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

// GET /api/reports/revenue?start_date=X&end_date=Y
router.get('/revenue', authenticateToken, (req, res) => {
    try {
        const { start_date, end_date } = req.query;
        if (!start_date || !end_date) {
            return res.status(400).json({ error: 'start_date ve end_date gerekli' });
        }

        // Daily revenue
        const dailyRevenue = db.prepare(`
            SELECT a.date, COUNT(*) as appointment_count, COALESCE(SUM(s.price), 0) as revenue
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            WHERE a.status = 'completed' AND a.date >= ? AND a.date <= ?
            GROUP BY a.date
            ORDER BY a.date ASC
        `).all(start_date, end_date);

        // Revenue by service
        const serviceRevenue = db.prepare(`
            SELECT s.name, s.category, COUNT(*) as count, COALESCE(SUM(s.price), 0) as revenue
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            WHERE a.status = 'completed' AND a.date >= ? AND a.date <= ?
            GROUP BY a.service_id
            ORDER BY revenue DESC
        `).all(start_date, end_date);

        // Revenue by staff
        const staffRevenue = db.prepare(`
            SELECT st.full_name, COUNT(*) as count, COALESCE(SUM(s.price), 0) as revenue
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            LEFT JOIN staff st ON a.staff_id = st.id
            WHERE a.status = 'completed' AND a.date >= ? AND a.date <= ?
            GROUP BY a.staff_id
            ORDER BY revenue DESC
        `).all(start_date, end_date);

        // Total
        const total = db.prepare(`
            SELECT COUNT(*) as total_appointments, COALESCE(SUM(s.price), 0) as total_revenue
            FROM appointments a
            LEFT JOIN services s ON a.service_id = s.id
            WHERE a.status = 'completed' AND a.date >= ? AND a.date <= ?
        `).get(start_date, end_date);

        // Status breakdown
        const statusBreakdown = db.prepare(`
            SELECT status, COUNT(*) as count
            FROM appointments
            WHERE date >= ? AND date <= ?
            GROUP BY status
        `).all(start_date, end_date);

        res.json({
            daily_revenue: dailyRevenue,
            service_revenue: serviceRevenue,
            staff_revenue: staffRevenue,
            status_breakdown: statusBreakdown,
            total
        });
    } catch (err) {
        res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
    }
});

module.exports = router;
