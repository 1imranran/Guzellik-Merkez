const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data', 'beauty.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initializeDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            full_name TEXT NOT NULL,
            role TEXT DEFAULT 'admin',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            duration_minutes INTEGER NOT NULL DEFAULT 30,
            price REAL NOT NULL DEFAULT 0,
            category TEXT DEFAULT 'Genel',
            image_url TEXT,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS staff (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            specialty TEXT,
            avatar_url TEXT,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS staff_services (
            staff_id INTEGER NOT NULL,
            service_id INTEGER NOT NULL,
            PRIMARY KEY (staff_id, service_id),
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
            FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS staff_schedule (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            staff_id INTEGER NOT NULL,
            day_of_week INTEGER NOT NULL,
            start_time TEXT NOT NULL DEFAULT '09:00',
            end_time TEXT NOT NULL DEFAULT '18:00',
            is_off INTEGER DEFAULT 0,
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
            UNIQUE(staff_id, day_of_week)
        );

        CREATE TABLE IF NOT EXISTS customers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            full_name TEXT NOT NULL,
            phone TEXT NOT NULL,
            email TEXT,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_id INTEGER NOT NULL,
            staff_id INTEGER NOT NULL,
            service_id INTEGER NOT NULL,
            date TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE,
            FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
            FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(date);
        CREATE INDEX IF NOT EXISTS idx_appointments_staff ON appointments(staff_id, date);
        CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments(customer_id);
        CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);
    `);

    // Seed admin user if not exists
    const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (!adminExists) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)').run('admin', hash, 'Yönetici', 'admin');
        console.log('✅ Varsayılan admin kullanıcısı oluşturuldu (admin / admin123)');
    }

    // Seed demo services if empty
    const serviceCount = db.prepare('SELECT COUNT(*) as cnt FROM services').get().cnt;
    if (serviceCount === 0) {
        const services = [
            ['Saç Kesimi', 'Profesyonel saç kesimi ve şekillendirme', 45, 250, 'Saç', 1],
            ['Saç Boyama', 'Tek renk saç boyama işlemi', 90, 500, 'Saç', 2],
            ['Fön', 'Fön ve şekillendirme', 30, 150, 'Saç', 3],
            ['Ombre / Balyaj', 'Modern renk geçişli saç boyama', 120, 1200, 'Saç', 4],
            ['Keratin Bakım', 'Saç keratin bakım uygulaması', 90, 800, 'Saç', 5],
            ['Manikür', 'El bakımı ve oje uygulaması', 45, 200, 'Tırnak', 6],
            ['Pedikür', 'Ayak bakımı ve oje uygulaması', 60, 250, 'Tırnak', 7],
            ['Kalıcı Oje', 'Uzun ömürlü kalıcı oje uygulaması', 45, 300, 'Tırnak', 8],
            ['Protez Tırnak', 'Protez tırnak uygulaması', 90, 600, 'Tırnak', 9],
            ['Cilt Bakımı', 'Derin temizleme ve nemlendirme', 60, 400, 'Cilt', 10],
            ['Hydrafacial', 'Profesyonel hydrafacial uygulaması', 60, 700, 'Cilt', 11],
            ['Kaş Dizaynı', 'Profesyonel kaş şekillendirme', 20, 100, 'Güzellik', 12],
            ['Kirpik Lifting', 'Kirpik lifting uygulaması', 45, 350, 'Güzellik', 13],
            ['İpek Kirpik', 'İpek kirpik uygulaması', 90, 600, 'Güzellik', 14],
            ['Lazer Epilasyon', 'Lazer epilasyon seansı', 30, 500, 'Epilasyon', 15],
            ['Ağda (Tam Bacak)', 'Tam bacak ağda uygulaması', 45, 300, 'Epilasyon', 16],
        ];
        const stmt = db.prepare('INSERT INTO services (name, description, duration_minutes, price, category, sort_order) VALUES (?, ?, ?, ?, ?, ?)');
        for (const s of services) stmt.run(...s);
        console.log('✅ Demo hizmetler oluşturuldu');
    }

    // Seed demo staff if empty
    const staffCount = db.prepare('SELECT COUNT(*) as cnt FROM staff').get().cnt;
    if (staffCount === 0) {
        const staffMembers = [
            ['Ayşe Yılmaz', '0532 111 2233', 'ayse@beauty.com', 'Saç Uzmanı'],
            ['Fatma Demir', '0533 222 3344', 'fatma@beauty.com', 'Cilt Bakım Uzmanı'],
            ['Zeynep Kaya', '0534 333 4455', 'zeynep@beauty.com', 'Tırnak Uzmanı'],
            ['Elif Çelik', '0535 444 5566', 'elif@beauty.com', 'Güzellik Uzmanı'],
        ];
        const staffStmt = db.prepare('INSERT INTO staff (full_name, phone, email, specialty) VALUES (?, ?, ?, ?)');
        const scheduleStmt = db.prepare('INSERT OR IGNORE INTO staff_schedule (staff_id, day_of_week, start_time, end_time, is_off) VALUES (?, ?, ?, ?, ?)');
        const staffServiceStmt = db.prepare('INSERT INTO staff_services (staff_id, service_id) VALUES (?, ?)');

        for (const s of staffMembers) {
            const result = staffStmt.run(...s);
            const staffId = result.lastInsertRowid;
            // Set schedule: Mon-Sat 09:00-18:00, Sunday off
            for (let day = 0; day <= 6; day++) {
                scheduleStmt.run(staffId, day, '09:00', '18:00', day === 0 ? 1 : 0);
            }
        }

        // Assign services to staff
        const allServices = db.prepare('SELECT id, category FROM services').all();
        const allStaff = db.prepare('SELECT id, specialty FROM staff').all();
        
        for (const staff of allStaff) {
            for (const service of allServices) {
                // Assign based on specialty match
                if (staff.specialty.includes('Saç') && service.category === 'Saç') {
                    staffServiceStmt.run(staff.id, service.id);
                } else if (staff.specialty.includes('Cilt') && (service.category === 'Cilt')) {
                    staffServiceStmt.run(staff.id, service.id);
                } else if (staff.specialty.includes('Tırnak') && service.category === 'Tırnak') {
                    staffServiceStmt.run(staff.id, service.id);
                } else if (staff.specialty.includes('Güzellik') && (service.category === 'Güzellik' || service.category === 'Epilasyon')) {
                    staffServiceStmt.run(staff.id, service.id);
                }
            }
        }

        console.log('✅ Demo personel ve çalışma saatleri oluşturuldu');
    }

    console.log('✅ Veritabanı başarıyla başlatıldı');
}

module.exports = { db, initializeDatabase };
