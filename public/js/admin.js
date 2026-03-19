// ========== STATE ==========
const API = '';
let token = localStorage.getItem('beauty_token');
let currentUser = null;
let searchTimeout = null;

const STATUS_LABELS = {
    pending: '⏳ Bekleyen',
    confirmed: '✅ Onaylı',
    completed: '✓ Tamamlanmış',
    cancelled: '✗ İptal',
    no_show: '○ Gelmedi'
};
const MONTHS_TR = ['Ocak','Şubat','Mart','Nisan','Mayıs', 'Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
const DAYS_TR = ['Pazar','Pazartesi','Salı','Çarşamba','Perşembe','Cuma','Cumartesi'];

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    if (token) {
        verifyToken();
    } else {
        showLogin();
    }
    // Set default report dates
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    document.getElementById('reportStart').value = formatDate(monthStart);
    document.getElementById('reportEnd').value = formatDate(today);
    document.getElementById('apptDateFilter').value = formatDate(today);
});

// ========== AUTH ==========
function showLogin() {
    document.getElementById('loginPage').style.display = 'flex';
    document.getElementById('adminLayout').style.display = 'none';
}

function showAdmin() {
    document.getElementById('loginPage').style.display = 'none';
    document.getElementById('adminLayout').style.display = 'flex';
    loadDashboard();
}

async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');
    errorEl.style.display = 'none';

    try {
        const res = await apiFetch('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password })
        });
        if (res.error) {
            errorEl.textContent = res.error;
            errorEl.style.display = 'block';
            return;
        }
        token = res.token;
        localStorage.setItem('beauty_token', token);
        currentUser = res.user;
        document.getElementById('userName').textContent = currentUser.full_name;
        document.getElementById('userAvatar').textContent = currentUser.full_name[0];
        showAdmin();
    } catch (err) {
        errorEl.textContent = 'Bağlantı hatası';
        errorEl.style.display = 'block';
    }
}

async function verifyToken() {
    try {
        const res = await apiFetch('/api/auth/me');
        if (res.error) { logout(); return; }
        currentUser = res;
        document.getElementById('userName').textContent = currentUser.full_name;
        document.getElementById('userAvatar').textContent = currentUser.full_name[0];
        showAdmin();
    } catch { logout(); }
}

function logout() {
    token = null;
    localStorage.removeItem('beauty_token');
    showLogin();
}

// ========== API HELPER ==========
async function apiFetch(url, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...options.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API}${url}`, { ...options, headers });
    return res.json();
}

// ========== NAVIGATION ==========
function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelector(`[data-page="${page}"]`).classList.add('active');

    switch (page) {
        case 'dashboard': loadDashboard(); break;
        case 'appointments': loadAppointments(); break;
        case 'services': loadServices(); break;
        case 'staff': loadStaff(); break;
        case 'customers': loadCustomers(); break;
        case 'reports': loadReports(); break;
    }
}

// ========== DASHBOARD ==========
async function loadDashboard() {
    const today = new Date();
    document.getElementById('dashboardDate').textContent = `${today.getDate()} ${MONTHS_TR[today.getMonth()]} ${today.getFullYear()}, ${DAYS_TR[today.getDay()]}`;

    try {
        const data = await apiFetch('/api/reports/dashboard');
        const s = data.stats;

        // Update pending badge
        const badge = document.getElementById('pendingBadge');
        if (s.pending_count > 0) {
            badge.textContent = s.pending_count;
            badge.style.display = 'inline';
        } else {
            badge.style.display = 'none';
        }

        document.getElementById('statsGrid').innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Bugünkü Randevular</div>
                <div class="stat-value">${s.today_count}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Bekleyen Onay</div>
                <div class="stat-value" style="color:var(--warning)">${s.pending_count}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Bu Hafta</div>
                <div class="stat-value">${s.week_appointments}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Aylık Gelir</div>
                <div class="stat-value gold">₺${s.month_revenue.toLocaleString('tr-TR')}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Toplam Müşteri</div>
                <div class="stat-value">${s.total_customers}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Aktif Hizmet</div>
                <div class="stat-value">${s.total_services}</div>
            </div>
        `;

        // Today's appointments
        const todayBody = document.getElementById('todayApptsBody');
        if (data.today_appointments.length === 0) {
            todayBody.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="icon">📅</div><p>Bugün randevu yok</p></td></tr>';
        } else {
            todayBody.innerHTML = data.today_appointments.map(a => `
                <tr>
                    <td><strong>${a.start_time} - ${a.end_time}</strong></td>
                    <td>${a.customer_name || '-'}</td>
                    <td>${a.service_name || '-'}</td>
                    <td>${a.staff_name || '-'}</td>
                    <td><span class="status-badge status-${a.status}">${STATUS_LABELS[a.status]}</span></td>
                    <td>
                        ${a.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="updateStatus(${a.id},'confirmed')">Onayla</button>` : ''}
                        ${a.status === 'confirmed' ? `<button class="btn btn-success btn-sm" onclick="updateStatus(${a.id},'completed')">Tamamla</button>` : ''}
                        ${['pending','confirmed'].includes(a.status) ? `<button class="btn btn-danger btn-sm" onclick="updateStatus(${a.id},'cancelled')">İptal</button>` : ''}
                    </td>
                </tr>
            `).join('');
        }

        // Upcoming
        const upBody = document.getElementById('upcomingApptsBody');
        if (data.upcoming_appointments.length === 0) {
            upBody.innerHTML = '<tr><td colspan="6" class="empty-state"><p>Yaklaşan randevu yok</p></td></tr>';
        } else {
            upBody.innerHTML = data.upcoming_appointments.map(a => `
                <tr>
                    <td>${formatDateTR(a.date)}</td>
                    <td>${a.start_time}</td>
                    <td>${a.customer_name || '-'}</td>
                    <td>${a.service_name || '-'}</td>
                    <td>${a.staff_name || '-'}</td>
                    <td><span class="status-badge status-${a.status}">${STATUS_LABELS[a.status]}</span></td>
                </tr>
            `).join('');
        }
    } catch (err) {
        showToast('Dashboard yüklenirken hata', 'error');
    }
}

// ========== APPOINTMENTS ==========
async function loadAppointments() {
    const date = document.getElementById('apptDateFilter').value;
    const status = document.getElementById('apptStatusFilter').value;
    let url = '/api/appointments?';
    if (date) url += `date=${date}&`;
    if (status) url += `status=${status}&`;

    try {
        const appts = await apiFetch(url);
        const body = document.getElementById('appointmentsBody');
        if (appts.length === 0) {
            body.innerHTML = '<tr><td colspan="9" class="empty-state"><div class="icon">📅</div><p>Randevu bulunamadı</p></td></tr>';
            return;
        }
        body.innerHTML = appts.map(a => `
            <tr>
                <td>${formatDateTR(a.date)}</td>
                <td>${a.start_time} - ${a.end_time}</td>
                <td><strong>${a.customer_name || '-'}</strong></td>
                <td>${a.customer_phone || '-'}</td>
                <td>${a.service_name || '-'}</td>
                <td>${a.staff_name || '-'}</td>
                <td>₺${(a.service_price || 0).toLocaleString('tr-TR')}</td>
                <td><span class="status-badge status-${a.status}">${STATUS_LABELS[a.status]}</span></td>
                <td>
                    <div style="display:flex;gap:4px;flex-wrap:wrap">
                        ${a.status === 'pending' ? `<button class="btn btn-success btn-sm" onclick="updateStatus(${a.id},'confirmed')">✓</button>` : ''}
                        ${a.status === 'confirmed' ? `<button class="btn btn-success btn-sm" onclick="updateStatus(${a.id},'completed')">✓</button>` : ''}
                        ${['pending','confirmed'].includes(a.status) ? `<button class="btn btn-danger btn-sm" onclick="updateStatus(${a.id},'cancelled')">✗</button>` : ''}
                        <button class="btn btn-outline btn-sm" onclick="deleteAppointment(${a.id})">🗑</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch { showToast('Randevular yüklenirken hata', 'error'); }
}

async function updateStatus(id, status) {
    try {
        await apiFetch(`/api/appointments/${id}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        showToast('Durum güncellendi', 'success');
        loadDashboard();
        loadAppointments();
    } catch { showToast('Güncelleme hatası', 'error'); }
}

async function deleteAppointment(id) {
    if (!confirm('Bu randevuyu silmek istediğinize emin misiniz?')) return;
    try {
        await apiFetch(`/api/appointments/${id}`, { method: 'DELETE' });
        showToast('Randevu silindi', 'success');
        loadAppointments();
        loadDashboard();
    } catch { showToast('Silme hatası', 'error'); }
}

async function openNewAppointmentModal() {
    const [services, staff, customers] = await Promise.all([
        apiFetch('/api/services'),
        apiFetch('/api/staff'),
        apiFetch('/api/customers')
    ]);

    const html = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal">
                <div class="modal-header">
                    <h2>Yeni Randevu</h2>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <form onsubmit="submitNewAppointment(event)">
                    <div class="form-group">
                        <label>Müşteri (mevcut)</label>
                        <select id="modalCustomerId">
                            <option value="">-- Yeni Müşteri --</option>
                            ${customers.map(c => `<option value="${c.id}">${c.full_name} (${c.phone})</option>`).join('')}
                        </select>
                    </div>
                    <div id="newCustomerFields">
                        <div class="form-row">
                            <div class="form-group"><label>Ad Soyad *</label><input id="modalCustName" placeholder="Ad Soyad"></div>
                            <div class="form-group"><label>Telefon *</label><input id="modalCustPhone" placeholder="0532..."></div>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Hizmet *</label>
                            <select id="modalServiceId" required>
                                <option value="">Seçin</option>
                                ${services.map(s => `<option value="${s.id}">${s.name} (${s.duration_minutes}dk - ₺${s.price})</option>`).join('')}
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Uzman *</label>
                            <select id="modalStaffId" required>
                                <option value="">Seçin</option>
                                ${staff.map(s => `<option value="${s.id}">${s.full_name}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Tarih *</label><input type="date" id="modalDate" required></div>
                        <div class="form-group"><label>Saat *</label><input type="time" id="modalTime" required></div>
                    </div>
                    <div class="form-group"><label>Not</label><textarea id="modalNotes" placeholder="Opsiyonel not..."></textarea></div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">İptal</button>
                        <button type="submit" class="btn btn-primary">Randevu Oluştur</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('modalContainer').innerHTML = html;

    // Toggle new customer fields
    document.getElementById('modalCustomerId').addEventListener('change', function() {
        document.getElementById('newCustomerFields').style.display = this.value ? 'none' : 'block';
    });
}

async function submitNewAppointment(e) {
    e.preventDefault();
    const customerId = document.getElementById('modalCustomerId').value;
    const body = {
        service_id: parseInt(document.getElementById('modalServiceId').value),
        staff_id: parseInt(document.getElementById('modalStaffId').value),
        date: document.getElementById('modalDate').value,
        start_time: document.getElementById('modalTime').value,
        notes: document.getElementById('modalNotes').value
    };

    if (customerId) {
        body.customer_id = parseInt(customerId);
    } else {
        body.customer_name = document.getElementById('modalCustName').value;
        body.customer_phone = document.getElementById('modalCustPhone').value;
        if (!body.customer_name || !body.customer_phone) {
            showToast('Müşteri adı ve telefonu gerekli', 'error');
            return;
        }
    }

    try {
        const res = await apiFetch('/api/appointments', { method: 'POST', body: JSON.stringify(body) });
        if (res.error) { showToast(res.error, 'error'); return; }
        showToast('Randevu oluşturuldu', 'success');
        closeModal();
        loadAppointments();
        loadDashboard();
    } catch { showToast('Randevu oluşturulamadı', 'error'); }
}

// ========== SERVICES ==========
async function loadServices() {
    try {
        const services = await apiFetch('/api/services?active=false');
        const body = document.getElementById('servicesBody');
        body.innerHTML = services.map(s => `
            <tr>
                <td><strong>${s.name}</strong><br><small style="color:var(--text-muted)">${s.description || ''}</small></td>
                <td>${s.category}</td>
                <td>${s.duration_minutes} dk</td>
                <td>₺${s.price.toLocaleString('tr-TR')}</td>
                <td><span class="status-badge ${s.is_active ? 'status-completed' : 'status-cancelled'}">${s.is_active ? 'Aktif' : 'Pasif'}</span></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="openServiceModal(${s.id})">✏️</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteService(${s.id})">🗑</button>
                </td>
            </tr>
        `).join('');
    } catch { showToast('Hizmetler yüklenirken hata', 'error'); }
}

async function openServiceModal(id) {
    let service = { name: '', description: '', duration_minutes: 30, price: 0, category: 'Genel', is_active: 1 };
    if (id) {
        service = await apiFetch(`/api/services/${id}`);
    }
    const categories = ['Saç', 'Tırnak', 'Cilt', 'Güzellik', 'Epilasyon', 'Genel'];

    const html = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal">
                <div class="modal-header">
                    <h2>${id ? 'Hizmet Düzenle' : 'Yeni Hizmet'}</h2>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <form onsubmit="submitService(event, ${id || 'null'})">
                    <div class="form-group"><label>Hizmet Adı *</label><input id="svcName" value="${service.name}" required></div>
                    <div class="form-group"><label>Açıklama</label><textarea id="svcDesc">${service.description || ''}</textarea></div>
                    <div class="form-row">
                        <div class="form-group"><label>Süre (dk) *</label><input type="number" id="svcDuration" value="${service.duration_minutes}" required min="5"></div>
                        <div class="form-group"><label>Fiyat (₺) *</label><input type="number" id="svcPrice" value="${service.price}" required min="0" step="0.01"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group">
                            <label>Kategori</label>
                            <select id="svcCategory">${categories.map(c => `<option value="${c}" ${c === service.category ? 'selected' : ''}>${c}</option>`).join('')}</select>
                        </div>
                        <div class="form-group">
                            <label>Durum</label>
                            <select id="svcActive"><option value="1" ${service.is_active ? 'selected' : ''}>Aktif</option><option value="0" ${!service.is_active ? 'selected' : ''}>Pasif</option></select>
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">İptal</button>
                        <button type="submit" class="btn btn-primary">${id ? 'Güncelle' : 'Ekle'}</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('modalContainer').innerHTML = html;
}

async function submitService(e, id) {
    e.preventDefault();
    const body = {
        name: document.getElementById('svcName').value,
        description: document.getElementById('svcDesc').value,
        duration_minutes: parseInt(document.getElementById('svcDuration').value),
        price: parseFloat(document.getElementById('svcPrice').value),
        category: document.getElementById('svcCategory').value,
        is_active: parseInt(document.getElementById('svcActive').value)
    };

    try {
        const url = id ? `/api/services/${id}` : '/api/services';
        const method = id ? 'PUT' : 'POST';
        const res = await apiFetch(url, { method, body: JSON.stringify(body) });
        if (res.error) { showToast(res.error, 'error'); return; }
        showToast(id ? 'Hizmet güncellendi' : 'Hizmet eklendi', 'success');
        closeModal();
        loadServices();
    } catch { showToast('İşlem hatası', 'error'); }
}

async function deleteService(id) {
    if (!confirm('Bu hizmeti silmek istediğinize emin misiniz?')) return;
    try {
        const res = await apiFetch(`/api/services/${id}`, { method: 'DELETE' });
        if (res.error) { showToast(res.error, 'error'); return; }
        showToast('Hizmet silindi', 'success');
        loadServices();
    } catch { showToast('Silme hatası', 'error'); }
}

// ========== STAFF ==========
async function loadStaff() {
    try {
        const staff = await apiFetch('/api/staff?active=false');
        const body = document.getElementById('staffBody');
        body.innerHTML = staff.map(s => `
            <tr>
                <td><strong>${s.full_name}</strong></td>
                <td>${s.specialty || '-'}</td>
                <td>${s.phone || '-'}</td>
                <td>${s.email || '-'}</td>
                <td><span class="status-badge ${s.is_active ? 'status-completed' : 'status-cancelled'}">${s.is_active ? 'Aktif' : 'Pasif'}</span></td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="openStaffModal(${s.id})">✏️</button>
                    <button class="btn btn-outline btn-sm" onclick="openScheduleModal(${s.id}, '${s.full_name}')">📅</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteStaff(${s.id})">🗑</button>
                </td>
            </tr>
        `).join('');
    } catch { showToast('Personel yüklenirken hata', 'error'); }
}

async function openStaffModal(id) {
    let member = { full_name: '', phone: '', email: '', specialty: '', is_active: 1 };
    let assignedServiceIds = [];
    if (id) {
        const data = await apiFetch(`/api/staff/${id}`);
        member = data;
        assignedServiceIds = (data.services || []).map(s => s.id);
    }
    const allServices = await apiFetch('/api/services');

    const html = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal">
                <div class="modal-header">
                    <h2>${id ? 'Personel Düzenle' : 'Yeni Personel'}</h2>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <form onsubmit="submitStaff(event, ${id || 'null'})">
                    <div class="form-row">
                        <div class="form-group"><label>Ad Soyad *</label><input id="staffName" value="${member.full_name}" required></div>
                        <div class="form-group"><label>Uzmanlık</label><input id="staffSpecialty" value="${member.specialty || ''}"></div>
                    </div>
                    <div class="form-row">
                        <div class="form-group"><label>Telefon</label><input id="staffPhone" value="${member.phone || ''}"></div>
                        <div class="form-group"><label>E-posta</label><input id="staffEmail" value="${member.email || ''}"></div>
                    </div>
                    <div class="form-group">
                        <label>Durum</label>
                        <select id="staffActive"><option value="1" ${member.is_active ? 'selected' : ''}>Aktif</option><option value="0" ${!member.is_active ? 'selected' : ''}>Pasif</option></select>
                    </div>
                    <div class="form-group">
                        <label>Sunduğu Hizmetler</label>
                        <div class="checkbox-group">
                            ${allServices.map(s => `
                                <label class="checkbox-label">
                                    <input type="checkbox" name="staffServices" value="${s.id}" ${assignedServiceIds.includes(s.id) ? 'checked' : ''}>
                                    ${s.name}
                                </label>
                            `).join('')}
                        </div>
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">İptal</button>
                        <button type="submit" class="btn btn-primary">${id ? 'Güncelle' : 'Ekle'}</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('modalContainer').innerHTML = html;
}

async function submitStaff(e, id) {
    e.preventDefault();
    const serviceCheckboxes = document.querySelectorAll('input[name="staffServices"]:checked');
    const body = {
        full_name: document.getElementById('staffName').value,
        specialty: document.getElementById('staffSpecialty').value,
        phone: document.getElementById('staffPhone').value,
        email: document.getElementById('staffEmail').value,
        is_active: parseInt(document.getElementById('staffActive').value),
        service_ids: Array.from(serviceCheckboxes).map(c => parseInt(c.value))
    };

    try {
        const url = id ? `/api/staff/${id}` : '/api/staff';
        const method = id ? 'PUT' : 'POST';
        const res = await apiFetch(url, { method, body: JSON.stringify(body) });
        if (res.error) { showToast(res.error, 'error'); return; }
        showToast(id ? 'Personel güncellendi' : 'Personel eklendi', 'success');
        closeModal();
        loadStaff();
    } catch { showToast('İşlem hatası', 'error'); }
}

async function openScheduleModal(staffId, staffName) {
    const data = await apiFetch(`/api/staff/${staffId}`);
    const schedule = data.schedule || [];
    const scheduleMap = {};
    schedule.forEach(s => { scheduleMap[s.day_of_week] = s; });

    const html = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal" style="max-width:600px">
                <div class="modal-header">
                    <h2>📅 ${staffName} - Çalışma Saatleri</h2>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <form onsubmit="submitSchedule(event, ${staffId})">
                    <div class="schedule-grid">
                        ${DAYS_TR.map((day, i) => {
                            const s = scheduleMap[i] || { start_time: '09:00', end_time: '18:00', is_off: 0 };
                            return `
                                <div class="schedule-row">
                                    <label>${day}</label>
                                    <input type="time" id="sched_start_${i}" value="${s.start_time}" ${s.is_off ? 'disabled' : ''}>
                                    <input type="time" id="sched_end_${i}" value="${s.end_time}" ${s.is_off ? 'disabled' : ''}>
                                    <label class="checkbox-label" style="margin:0">
                                        <input type="checkbox" id="sched_off_${i}" ${s.is_off ? 'checked' : ''} 
                                            onchange="toggleDayOff(${i})"> İzinli
                                    </label>
                                </div>
                            `;
                        }).join('')}
                    </div>
                    <div class="form-actions">
                        <button type="button" class="btn btn-outline" onclick="closeModal()">İptal</button>
                        <button type="submit" class="btn btn-primary">Kaydet</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    document.getElementById('modalContainer').innerHTML = html;
}

function toggleDayOff(day) {
    const isOff = document.getElementById(`sched_off_${day}`).checked;
    document.getElementById(`sched_start_${day}`).disabled = isOff;
    document.getElementById(`sched_end_${day}`).disabled = isOff;
}

async function submitSchedule(e, staffId) {
    e.preventDefault();
    const schedule = [];
    for (let i = 0; i < 7; i++) {
        schedule.push({
            day_of_week: i,
            start_time: document.getElementById(`sched_start_${i}`).value,
            end_time: document.getElementById(`sched_end_${i}`).value,
            is_off: document.getElementById(`sched_off_${i}`).checked ? 1 : 0
        });
    }

    try {
        await apiFetch(`/api/staff/${staffId}/schedule`, {
            method: 'PUT',
            body: JSON.stringify({ schedule })
        });
        showToast('Çalışma saatleri güncellendi', 'success');
        closeModal();
    } catch { showToast('Güncelleme hatası', 'error'); }
}

async function deleteStaff(id) {
    if (!confirm('Bu personeli silmek istediğinize emin misiniz?')) return;
    try {
        const res = await apiFetch(`/api/staff/${id}`, { method: 'DELETE' });
        if (res.error) { showToast(res.error, 'error'); return; }
        showToast('Personel silindi', 'success');
        loadStaff();
    } catch { showToast('Silme hatası', 'error'); }
}

// ========== CUSTOMERS ==========
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(loadCustomers, 300);
}

async function loadCustomers() {
    const search = document.getElementById('customerSearch').value;
    const url = search ? `/api/customers?search=${encodeURIComponent(search)}` : '/api/customers';
    try {
        const customers = await apiFetch(url);
        const body = document.getElementById('customersBody');
        if (customers.length === 0) {
            body.innerHTML = '<tr><td colspan="6" class="empty-state"><div class="icon">👥</div><p>Müşteri bulunamadı</p></td></tr>';
            return;
        }
        body.innerHTML = customers.map(c => `
            <tr>
                <td><strong>${c.full_name}</strong></td>
                <td>${c.phone}</td>
                <td>${c.email || '-'}</td>
                <td>${c.appointment_count || 0}</td>
                <td>${c.last_visit ? formatDateTR(c.last_visit) : '-'}</td>
                <td>
                    <button class="btn btn-outline btn-sm" onclick="openCustomerDetail(${c.id})">👁</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteCustomer(${c.id})">🗑</button>
                </td>
            </tr>
        `).join('');
    } catch { showToast('Müşteriler yüklenirken hata', 'error'); }
}

async function openCustomerDetail(id) {
    const customer = await apiFetch(`/api/customers/${id}`);
    const html = `
        <div class="modal-overlay" onclick="if(event.target===this)closeModal()">
            <div class="modal" style="max-width:650px">
                <div class="modal-header">
                    <h2>👤 ${customer.full_name}</h2>
                    <button class="modal-close" onclick="closeModal()">✕</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
                    <div><small style="color:var(--text-muted)">Telefon</small><br><strong>${customer.phone}</strong></div>
                    <div><small style="color:var(--text-muted)">E-posta</small><br><strong>${customer.email || '-'}</strong></div>
                </div>
                ${customer.notes ? `<div style="margin-bottom:1.5rem"><small style="color:var(--text-muted)">Not</small><br>${customer.notes}</div>` : ''}
                <h4 style="margin-bottom:0.5rem">Randevu Geçmişi</h4>
                <table style="font-size:0.82rem">
                    <thead><tr><th>Tarih</th><th>Hizmet</th><th>Uzman</th><th>Durum</th></tr></thead>
                    <tbody>
                        ${(customer.appointments || []).length === 0 ? '<tr><td colspan="4" style="text-align:center;color:var(--text-muted);padding:1rem">Henüz randevu yok</td></tr>' :
                        customer.appointments.map(a => `
                            <tr>
                                <td>${formatDateTR(a.date)} ${a.start_time}</td>
                                <td>${a.service_name || '-'}</td>
                                <td>${a.staff_name || '-'}</td>
                                <td><span class="status-badge status-${a.status}">${STATUS_LABELS[a.status]}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    document.getElementById('modalContainer').innerHTML = html;
}

async function deleteCustomer(id) {
    if (!confirm('Bu müşteriyi ve tüm randevularını silmek istediğinize emin misiniz?')) return;
    try {
        await apiFetch(`/api/customers/${id}`, { method: 'DELETE' });
        showToast('Müşteri silindi', 'success');
        loadCustomers();
    } catch { showToast('Silme hatası', 'error'); }
}

// ========== REPORTS ==========
async function loadReports() {
    const start = document.getElementById('reportStart').value;
    const end = document.getElementById('reportEnd').value;
    if (!start || !end) { showToast('Tarih aralığı seçin', 'warning'); return; }

    try {
        const data = await apiFetch(`/api/reports/revenue?start_date=${start}&end_date=${end}`);
        const t = data.total;

        document.getElementById('reportStats').innerHTML = `
            <div class="stat-card">
                <div class="stat-label">Toplam Randevu</div>
                <div class="stat-value">${t.total_appointments}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Toplam Gelir</div>
                <div class="stat-value gold">₺${t.total_revenue.toLocaleString('tr-TR')}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Ortalama Gelir</div>
                <div class="stat-value">₺${t.total_appointments > 0 ? Math.round(t.total_revenue / t.total_appointments).toLocaleString('tr-TR') : 0}</div>
            </div>
        `;

        document.getElementById('serviceRevenueBody').innerHTML = (data.service_revenue || []).map(s => `
            <tr><td>${s.name}</td><td>${s.count}</td><td>₺${s.revenue.toLocaleString('tr-TR')}</td></tr>
        `).join('') || '<tr><td colspan="3" class="empty-state">Veri yok</td></tr>';

        document.getElementById('staffRevenueBody').innerHTML = (data.staff_revenue || []).map(s => `
            <tr><td>${s.full_name}</td><td>${s.count}</td><td>₺${s.revenue.toLocaleString('tr-TR')}</td></tr>
        `).join('') || '<tr><td colspan="3" class="empty-state">Veri yok</td></tr>';

        document.getElementById('statusBreakdownBody').innerHTML = (data.status_breakdown || []).map(s => `
            <tr><td><span class="status-badge status-${s.status}">${STATUS_LABELS[s.status]}</span></td><td>${s.count}</td></tr>
        `).join('') || '<tr><td colspan="2" class="empty-state">Veri yok</td></tr>';

    } catch { showToast('Rapor yüklenirken hata', 'error'); }
}

// ========== UTILS ==========
function closeModal() {
    document.getElementById('modalContainer').innerHTML = '';
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateTR(dateStr) {
    if (!dateStr) return '-';
    const [y, m, d] = dateStr.split('-');
    return `${d} ${MONTHS_TR[parseInt(m) - 1]} ${y}`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `${type === 'success' ? '✓' : type === 'error' ? '✗' : 'ℹ'} ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
