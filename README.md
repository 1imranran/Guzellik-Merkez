# 🌸 Beauty Studio — Güzellik Merkezi Randevu Sistemi

Modern, şık ve tam özellikli güzellik merkezi randevu yönetim sistemi.

## ✨ Özellikler

- **Online Randevu** — Müşteriler 5 adımlı sihirbazla kolayca randevu alır
- **Çakışma Kontrolü** — Aynı personele aynı saat iki randevu engellenir
- **Müsaitlik Hesabı** — Personel çalışma saatleri + dolu slotlar otomatik hesaplanır
- **Admin Dashboard** — Bugünkü/yaklaşan randevular, gelir, istatistikler
- **Hizmet Yönetimi** — Kategori, süre, fiyat ile CRUD
- **Personel Yönetimi** — Çalışma saatleri, hizmet ataması, izin günleri
- **Müşteri Veritabanı** — Arama, randevu geçmişi, otomatik kayıt
- **Gelir Raporları** — Hizmet ve personel bazlı gelir analizi
- **Responsive Tasarım** — Mobil uyumlu, modern dark theme

## 🚀 Kurulum

```bash
# Bağımlılıkları yükle
npm install

# Sunucuyu başlat
npm start
```

Sunucu **http://localhost:3000** adresinde çalışır.

## 🔑 Varsayılan Giriş

| Alan | Değer |
|------|-------|
| Kullanıcı | `admin` |
| Şifre | `admin123` |

## 📂 Proje Yapısı

```
├── server.js           # Express sunucu
├── database.js         # SQLite veritabanı + seed data
├── middleware/
│   └── auth.js         # JWT doğrulama
├── routes/
│   ├── auth.js         # Giriş / Kimlik
│   ├── services.js     # Hizmet CRUD
│   ├── staff.js        # Personel CRUD
│   ├── customers.js    # Müşteri CRUD
│   ├── appointments.js # Randevu + çakışma kontrolü
│   └── reports.js      # Dashboard + raporlar
├── public/
│   ├── index.html      # Müşteri sayfası
│   ├── admin.html      # Admin panel
│   ├── css/
│   │   ├── style.css   # Müşteri stilleri
│   │   └── admin.css   # Admin stilleri
│   └── js/
│       ├── booking.js  # Randevu wizard
│       └── admin.js    # Admin panel JS
└── data/
    └── beauty.db       # SQLite veritabanı (otomatik oluşur)
```

## 🌐 Sayfalar

| Sayfa | URL |
|-------|-----|
| Ana Sayfa | http://localhost:3000 |
| Admin Panel | http://localhost:3000/admin |

## 🛡 API Endpoints

| Method | URL | Açıklama |
|--------|-----|----------|
| POST | `/api/auth/login` | Admin giriş |
| GET | `/api/services` | Hizmet listesi |
| GET | `/api/staff/by-service/:id` | Hizmete göre personel |
| GET | `/api/appointments/available-slots` | Müsait saatler |
| POST | `/api/appointments` | Randevu oluştur |
| GET | `/api/reports/dashboard` | Dashboard verileri |

## 📋 Demo Data

Sistem ilk çalıştırmada otomatik olarak oluşturur:
- **16 hizmet** (Saç, Tırnak, Cilt, Güzellik, Epilasyon)
- **4 personel** (uzmanlık alanlarıyla)
- **Çalışma saatleri** (Pt-Ct 09:00-18:00, Pazar izinli)
