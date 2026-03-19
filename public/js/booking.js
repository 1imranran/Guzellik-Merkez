// ========== STATE ==========
const API = '';
let services = [];
let categories = [];
let currentStep = 1;
let selectedService = null;
let selectedStaff = null;
let selectedDate = null;
let selectedTime = null;
let calendarMonth = new Date().getMonth();
let calendarYear = new Date().getFullYear();

// ========== INIT ==========
document.addEventListener('DOMContentLoaded', () => {
    loadServices();
    setupNavbar();
    setupMobileMenu();
});

// ========== NAVBAR SCROLL ==========
function setupNavbar() {
    window.addEventListener('scroll', () => {
        const nav = document.getElementById('navbar');
        if (window.scrollY > 50) nav.classList.add('scrolled');
        else nav.classList.remove('scrolled');
    });
}

function setupMobileMenu() {
    const btn = document.getElementById('mobileMenuBtn');
    const links = document.getElementById('navLinks');
    btn.addEventListener('click', () => {
        links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
        links.style.flexDirection = 'column';
        links.style.position = 'absolute';
        links.style.top = '60px';
        links.style.right = '20px';
        links.style.background = 'var(--bg-card)';
        links.style.padding = '1rem';
        links.style.borderRadius = 'var(--radius-md)';
        links.style.border = '1px solid var(--border)';
    });
}

// ========== SERVICES ==========
async function loadServices() {
    try {
        const res = await fetch(`${API}/api/services`);
        services = await res.json();
        categories = [...new Set(services.map(s => s.category))];
        renderCategoryFilter('categoryFilter', false);
        renderCategoryFilter('bookingCategoryFilter', true);
        renderServices('servicesGrid', false);
        renderServices('bookingServicesGrid', true);
    } catch (err) {
        showToast('Hizmetler yüklenirken hata oluştu', 'error');
    }
}

function renderCategoryFilter(containerId, isBooking) {
    const container = document.getElementById(containerId);
    container.innerHTML = `<button class="category-btn active" onclick="filterCategory('all', '${containerId}', ${isBooking})">Tümü</button>`;
    categories.forEach(cat => {
        container.innerHTML += `<button class="category-btn" onclick="filterCategory('${cat}', '${containerId}', ${isBooking})">${cat}</button>`;
    });
}

function filterCategory(category, filterId, isBooking) {
    // Update active button
    const container = document.getElementById(filterId);
    container.querySelectorAll('.category-btn').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');

    const gridId = isBooking ? 'bookingServicesGrid' : 'servicesGrid';
    renderServices(gridId, isBooking, category === 'all' ? null : category);
}

const categoryIcons = {
    'Saç': '💇‍♀️',
    'Tırnak': '💅',
    'Cilt': '✨',
    'Güzellik': '💄',
    'Epilasyon': '🌟',
    'Genel': '💎'
};

function renderServices(gridId, isBooking, filterCategory) {
    const grid = document.getElementById(gridId);
    let filtered = filterCategory ? services.filter(s => s.category === filterCategory) : services;
    
    grid.innerHTML = filtered.map(s => `
        <div class="service-card ${selectedService && selectedService.id === s.id ? 'selected' : ''}" 
             onclick="${isBooking ? `selectService(${s.id})` : `scrollToBooking(${s.id})`}"
             id="svc-${isBooking ? 'b' : 'l'}-${s.id}">
            <div class="service-icon">${categoryIcons[s.category] || '💎'}</div>
            <h3>${s.name}</h3>
            <p>${s.description || ''}</p>
            <div class="service-meta">
                <span class="service-duration">⏱ ${s.duration_minutes} dk</span>
                <span class="service-price">₺${s.price.toLocaleString('tr-TR')}</span>
            </div>
        </div>
    `).join('');
}

function scrollToBooking(serviceId) {
    selectService(serviceId);
    document.getElementById('booking').scrollIntoView({ behavior: 'smooth' });
}

function selectService(serviceId) {
    selectedService = services.find(s => s.id === serviceId);
    // Reset downstream selections
    selectedStaff = null;
    selectedDate = null;
    selectedTime = null;
    renderServices('bookingServicesGrid', true);
    updateWizardState();
}

// ========== WIZARD NAVIGATION ==========
function updateWizardState() {
    // Update step indicators
    document.querySelectorAll('#wizardSteps .wizard-step').forEach(step => {
        const stepNum = parseInt(step.dataset.step);
        step.classList.remove('active', 'completed');
        if (stepNum === currentStep) step.classList.add('active');
        else if (stepNum < currentStep) step.classList.add('completed');
    });

    // Show correct panel
    document.querySelectorAll('.wizard-panel').forEach(p => p.classList.remove('active'));
    const activePanel = document.getElementById(`step${currentStep}`);
    if (activePanel) activePanel.classList.add('active');

    // Update nav buttons
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const wizardNav = document.getElementById('wizardNav');

    if (currentStep === 0) {
        // Success state
        wizardNav.style.display = 'none';
        document.getElementById('stepSuccess').classList.add('active');
        return;
    }

    wizardNav.style.display = 'flex';
    prevBtn.style.visibility = currentStep > 1 ? 'visible' : 'hidden';

    if (currentStep === 5) {
        nextBtn.textContent = '✓ Randevuyu Onayla';
        nextBtn.className = 'btn btn-primary btn-lg';
    } else {
        nextBtn.textContent = 'Devam →';
        nextBtn.className = 'btn btn-primary';
    }
}

function nextStep() {
    if (!validateStep()) return;

    if (currentStep === 2) loadStaffForService();
    if (currentStep === 3) {
        calendarMonth = new Date().getMonth();
        calendarYear = new Date().getFullYear();
        renderCalendar();
    }
    if (currentStep === 5) {
        renderSummary();
    }

    if (currentStep === 5) {
        submitBooking();
        return;
    }

    currentStep++;

    if (currentStep === 2) loadStaffForService();
    if (currentStep === 3) {
        calendarMonth = new Date().getMonth();
        calendarYear = new Date().getFullYear();
        renderCalendar();
    }
    if (currentStep === 5) renderSummary();

    updateWizardState();
}

function prevStep() {
    if (currentStep > 1) {
        currentStep--;
        updateWizardState();
    }
}

function validateStep() {
    switch (currentStep) {
        case 1:
            if (!selectedService) {
                showToast('Lütfen bir hizmet seçin', 'warning');
                return false;
            }
            return true;
        case 2:
            if (!selectedStaff) {
                showToast('Lütfen bir uzman seçin', 'warning');
                return false;
            }
            return true;
        case 3:
            if (!selectedDate || !selectedTime) {
                showToast('Lütfen tarih ve saat seçin', 'warning');
                return false;
            }
            return true;
        case 4:
            const name = document.getElementById('customerName').value.trim();
            const phone = document.getElementById('customerPhone').value.trim();
            if (!name) { showToast('Lütfen adınızı girin', 'warning'); return false; }
            if (!phone) { showToast('Lütfen telefon numaranızı girin', 'warning'); return false; }
            if (phone.length < 10) { showToast('Geçerli bir telefon numarası girin', 'warning'); return false; }
            return true;
        case 5:
            return true;
        default:
            return true;
    }
}

// ========== STAFF ==========
async function loadStaffForService() {
    if (!selectedService) return;
    const grid = document.getElementById('staffGrid');
    grid.innerHTML = '<div class="loading-spinner"></div><p class="loading-text">Uzmanlar yükleniyor...</p>';

    try {
        const res = await fetch(`${API}/api/staff/by-service/${selectedService.id}`);
        const staff = await res.json();

        if (staff.length === 0) {
            grid.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:2rem">Bu hizmet için uygun uzman bulunmuyor</p>';
            return;
        }

        grid.innerHTML = staff.map(s => `
            <div class="staff-card ${selectedStaff && selectedStaff.id === s.id ? 'selected' : ''}" 
                 onclick="selectStaff(${s.id}, '${s.full_name}', '${s.specialty || ''}')">
                <div class="staff-avatar">${s.full_name.split(' ').map(n => n[0]).join('')}</div>
                <h4>${s.full_name}</h4>
                <p class="specialty">${s.specialty || 'Uzman'}</p>
            </div>
        `).join('');
    } catch (err) {
        grid.innerHTML = '<p style="color:var(--danger);text-align:center">Uzmanlar yüklenirken hata oluştu</p>';
    }
}

function selectStaff(id, name, specialty) {
    selectedStaff = { id, full_name: name, specialty };
    selectedDate = null;
    selectedTime = null;
    loadStaffForService();
}

// ========== CALENDAR ==========
const MONTHS_TR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS_TR = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];

function renderCalendar() {
    const title = document.getElementById('calendarTitle');
    const grid = document.getElementById('calendarGrid');
    title.textContent = `${MONTHS_TR[calendarMonth]} ${calendarYear}`;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const firstDay = new Date(calendarYear, calendarMonth, 1);
    const lastDay = new Date(calendarYear, calendarMonth + 1, 0);
    let startDay = firstDay.getDay();

    let html = DAYS_TR.map(d => `<div class="day-name">${d}</div>`).join('');

    // Empty cells before first day
    for (let i = 0; i < startDay; i++) {
        html += '<div></div>';
    }

    for (let day = 1; day <= lastDay.getDate(); day++) {
        const date = new Date(calendarYear, calendarMonth, day);
        const dateStr = formatDate(date);
        const isPast = date < today;
        const isToday = date.getTime() === today.getTime();
        const isSelected = selectedDate === dateStr;

        html += `<button class="calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}" 
                         ${isPast ? 'disabled' : ''} 
                         onclick="selectDate('${dateStr}')">${day}</button>`;
    }

    grid.innerHTML = html;

    // Nav buttons
    document.getElementById('prevMonth').onclick = () => {
        calendarMonth--;
        if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
        renderCalendar();
    };
    document.getElementById('nextMonth').onclick = () => {
        calendarMonth++;
        if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
        renderCalendar();
    };
}

function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function formatDateTR(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${d} ${MONTHS_TR[parseInt(m) - 1]} ${y}`;
}

async function selectDate(dateStr) {
    selectedDate = dateStr;
    selectedTime = null;
    renderCalendar();
    await loadTimeSlots();
}

// ========== TIME SLOTS ==========
async function loadTimeSlots() {
    const container = document.getElementById('timeSlots');
    container.innerHTML = '<div class="loading-spinner" style="grid-column:1/-1"></div>';

    try {
        const res = await fetch(`${API}/api/appointments/available-slots?staff_id=${selectedStaff.id}&service_id=${selectedService.id}&date=${selectedDate}`);
        const data = await res.json();

        if (!data.slots || data.slots.length === 0) {
            container.innerHTML = `<p style="color:var(--text-muted);grid-column:1/-1;text-align:center;padding:2rem">${data.message || 'Bu tarihte müsait saat bulunmuyor'}</p>`;
            return;
        }

        container.innerHTML = data.slots.map(slot => `
            <button class="time-slot ${selectedTime === slot.start_time ? 'selected' : ''}" 
                    onclick="selectTime('${slot.start_time}', '${slot.end_time}')">
                ${slot.start_time}
            </button>
        `).join('');
    } catch (err) {
        container.innerHTML = '<p style="color:var(--danger);grid-column:1/-1;text-align:center">Saatler yüklenirken hata oluştu</p>';
    }
}

function selectTime(startTime, endTime) {
    selectedTime = startTime;
    selectedEndTime = endTime;
    loadTimeSlots();
}

// ========== SUMMARY ==========
function renderSummary() {
    const container = document.getElementById('bookingSummary');
    const name = document.getElementById('customerName').value.trim();
    const phone = document.getElementById('customerPhone').value.trim();
    const email = document.getElementById('customerEmail').value.trim();
    const notes = document.getElementById('bookingNotes').value.trim();

    container.innerHTML = `
        <div class="summary-item">
            <span class="summary-label">Hizmet</span>
            <span class="summary-value">${selectedService.name}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Uzman</span>
            <span class="summary-value">${selectedStaff.full_name}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Tarih</span>
            <span class="summary-value">${formatDateTR(selectedDate)}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Saat</span>
            <span class="summary-value">${selectedTime} - ${selectedEndTime}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Süre</span>
            <span class="summary-value">${selectedService.duration_minutes} dakika</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Müşteri</span>
            <span class="summary-value">${name}</span>
        </div>
        <div class="summary-item">
            <span class="summary-label">Telefon</span>
            <span class="summary-value">${phone}</span>
        </div>
        ${email ? `<div class="summary-item"><span class="summary-label">E-posta</span><span class="summary-value">${email}</span></div>` : ''}
        ${notes ? `<div class="summary-item"><span class="summary-label">Not</span><span class="summary-value">${notes}</span></div>` : ''}
        <div class="summary-total">
            <span>Toplam</span>
            <span class="price">₺${selectedService.price.toLocaleString('tr-TR')}</span>
        </div>
    `;
}

// ========== SUBMIT ==========
async function submitBooking() {
    const nextBtn = document.getElementById('nextBtn');
    nextBtn.disabled = true;
    nextBtn.textContent = 'Gönderiliyor...';

    try {
        const res = await fetch(`${API}/api/appointments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                staff_id: selectedStaff.id,
                service_id: selectedService.id,
                date: selectedDate,
                start_time: selectedTime,
                customer_name: document.getElementById('customerName').value.trim(),
                customer_phone: document.getElementById('customerPhone').value.trim(),
                customer_email: document.getElementById('customerEmail').value.trim(),
                notes: document.getElementById('bookingNotes').value.trim()
            })
        });

        const data = await res.json();

        if (!res.ok) {
            showToast(data.error || 'Randevu oluşturulamadı', 'error');
            nextBtn.disabled = false;
            nextBtn.textContent = '✓ Randevuyu Onayla';
            return;
        }

        // Success
        currentStep = 0;
        updateWizardState();
        showToast('Randevunuz başarıyla oluşturuldu!', 'success');
    } catch (err) {
        showToast('Bağlantı hatası oluştu', 'error');
        nextBtn.disabled = false;
        nextBtn.textContent = '✓ Randevuyu Onayla';
    }
}

function resetBooking() {
    selectedService = null;
    selectedStaff = null;
    selectedDate = null;
    selectedTime = null;
    currentStep = 1;
    document.getElementById('customerName').value = '';
    document.getElementById('customerPhone').value = '';
    document.getElementById('customerEmail').value = '';
    document.getElementById('bookingNotes').value = '';
    renderServices('bookingServicesGrid', true);
    updateWizardState();
}

// ========== TOAST ==========
function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const icons = { success: '✓', error: '✗', warning: '⚠', info: 'ℹ' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${message}`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100px)';
        toast.style.transition = 'all 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}
