/**
 * ครูสวน AI — Frontend Single Page Application
 * Connected to Express Backend & Typhoon LLM
 */

const API_BASE = (window.location.protocol === 'file:' || ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && window.location.port !== '3000' && window.location.port !== ''))
  ? 'http://localhost:3000/api'
  : '/api';

// Application State
const state = {
  token: localStorage.getItem('krusuan_token') || '',
  currentUser: null,
  activeView: 'home',
  plots: [],
  currentPlotId: null,
  currentPlotDetail: null,
  todayTasks: [],
  executingTask: null,
  currentConversationId: null,
  chatMessages: [],
  isAiStreaming: false,
  marketProducts: [],
  notifications: [],
  farmFilter: 'ALL',
  vapiInstance: null,
  voiceCallActive: false,
};

// ==========================================
// 🚀 INITIALIZATION
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
  setupCropOptionRadios();
  setDefaultPlantingDate();
  await ensureAuthentication();
  handleHashNavigation();
  window.addEventListener('hashchange', handleHashNavigation);
});

function setDefaultPlantingDate() {
  const dateInput = document.getElementById('input-planting-date');
  if (dateInput && !dateInput.value) {
    const today = new Date().toISOString().split('T')[0];
    dateInput.value = today;
  }
}

// Setup crop selection styling in add plot modal
function setupCropOptionRadios() {
  const options = document.querySelectorAll('.crop-option');
  const customField = document.getElementById('custom-crop-field');

  options.forEach((opt) => {
    opt.addEventListener('click', () => {
      options.forEach((o) => {
        o.classList.remove('border-primary', 'bg-primary-container/10', 'shadow-sm');
        o.classList.add('border-outline-variant/40', 'bg-white');
        const r = o.querySelector('input[type="radio"]');
        if (r) r.checked = false;
      });

      opt.classList.remove('border-outline-variant/40', 'bg-white');
      opt.classList.add('border-primary', 'bg-primary-container/10', 'shadow-sm');

      const radio = opt.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        if (radio.value === 'CUSTOM') {
          if (customField) customField.classList.remove('hidden');
          document.getElementById('input-custom-crop-name')?.focus();
        } else {
          if (customField) customField.classList.add('hidden');
        }
      }
    });
  });

  // Tree Status Options (Mature / Young / New)
  const treeOptions = document.querySelectorAll('.tree-status-opt');
  treeOptions.forEach((opt) => {
    opt.addEventListener('click', () => {
      treeOptions.forEach((o) => {
        o.classList.remove('border-primary', 'bg-primary-container/10', 'shadow-xs');
        o.classList.add('border-outline-variant/40', 'bg-white');
        const r = o.querySelector('input[type="radio"]');
        if (r) r.checked = false;
        const txt = o.querySelector('.text-xs');
        if (txt) {
          txt.classList.remove('text-primary', 'font-black');
          txt.classList.add('text-on-background', 'font-bold');
        }
      });
      opt.classList.remove('border-outline-variant/40', 'bg-white');
      opt.classList.add('border-primary', 'bg-primary-container/10', 'shadow-xs');
      const radio = opt.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
      const txt = opt.querySelector('.text-xs');
      if (txt) {
        txt.classList.add('text-primary', 'font-black');
        txt.classList.remove('text-on-background', 'font-bold');
      }
    });
  });
}

function updateCalculatedArea() {
  const rai = parseFloat(document.getElementById('input-rai')?.value) || 0;
  const ngan = parseFloat(document.getElementById('input-ngan')?.value) || 0;
  const sqWa = parseFloat(document.getElementById('input-sqwa')?.value) || 0;
  const total = (rai * 1600) + (ngan * 400) + (sqWa * 4);
  const badge = document.getElementById('calculated-sqm-badge');
  if (badge) {
    badge.textContent = `รวม: ${total.toLocaleString()} ตร.ม.`;
  }
}

// ==========================================
// 🔐 AUTHENTICATION & USER MANAGEMENT
// ==========================================
async function ensureAuthentication() {
  if (state.token) {
    try {
      const res = await apiRequest('/auth/me');
      if (res && res.data) {
        state.currentUser = res.data;
        updateUserUI();
        await refreshAllData();
        return;
      }
    } catch (e) {
      if (e.status === 401 || e.status === 403) {
        console.warn('Existing token invalid or expired. Please sign in.');
        localStorage.removeItem('krusuan_token');
        state.token = '';
        state.currentUser = null;
      } else {
        console.warn('Network or temporary server reload, keeping user session:', e.message);
        // Do not discard token on server reboot or network drop
        try {
          await refreshAllData();
          return;
        } catch (ignored) {}
      }
    }
  }

  // Auth-first: Require the user to register or login
  openModal('modal-auth');
  switchAuthTab('login');
}

function updateUserUI() {
  if (!state.currentUser) return;
  const nameEl = document.getElementById('desktop-user-name');
  const locEl = document.getElementById('desktop-user-location');
  const greetEl = document.getElementById('home-greeting-name');
  const avatarEl = document.getElementById('desktop-user-avatar');
  const mobAvatarEl = document.getElementById('mobile-user-avatar-btn');

  const avatar = state.currentUser.profileImage || '🧑‍🌾';

  if (nameEl) nameEl.textContent = state.currentUser.name;
  if (locEl) locEl.textContent = state.currentUser.location || 'อ.พุนพิน จ.สุราษฎร์ธานี';
  if (greetEl) greetEl.textContent = state.currentUser.name;
  if (avatarEl) avatarEl.textContent = avatar;
  if (mobAvatarEl) mobAvatarEl.textContent = avatar;
}

// Open User Profile & Stats Modal
async function openUserProfileModal() {
  if (!state.currentUser) {
    openModal('modal-auth');
    return;
  }

  try {
    const res = await apiRequest('/users/me');
    if (res && res.data) {
      state.currentUser = res.data;
      updateUserUI();

      const user = res.data;
      const stats = user.stats || { plotsCount: state.plots.length, completedTasksCount: 0, harvestsCount: 0, daysActive: 1 };
      const avatar = user.profileImage || '🧑‍🌾';

      document.getElementById('profile-avatar-display').textContent = avatar;
      document.getElementById('profile-display-name').textContent = user.name;
      document.getElementById('profile-display-phone').textContent = `เบอร์โทรศัพท์: ${user.phone}`;
      document.getElementById('profile-input-name').value = user.name || '';
      document.getElementById('profile-input-location').value = user.location || '';
      document.getElementById('profile-input-avatar').value = avatar;

      document.getElementById('profile-stat-plots').textContent = stats.plotsCount ?? state.plots.length;
      document.getElementById('profile-stat-tasks').textContent = stats.completedTasksCount ?? 0;
      document.getElementById('profile-stat-harvests').textContent = stats.harvestsCount ?? 0;
      document.getElementById('profile-stat-days').textContent = stats.daysActive ?? 1;

      selectProfileAvatar(avatar);
    }
  } catch (err) {
    console.error('Failed to load profile details:', err);
  }

  openModal('modal-user-profile');
}

function selectProfileAvatar(emoji) {
  const hiddenInput = document.getElementById('profile-input-avatar');
  if (hiddenInput) hiddenInput.value = emoji;

  const display = document.getElementById('profile-avatar-display');
  if (display) display.textContent = emoji;

  document.querySelectorAll('#profile-avatar-selector .avatar-opt-btn').forEach((btn) => {
    if (btn.textContent.trim() === emoji) {
      btn.classList.remove('border-transparent', 'bg-surface-container-low');
      btn.classList.add('border-primary', 'bg-surface-container-high');
    } else {
      btn.classList.remove('border-primary', 'bg-surface-container-high');
      btn.classList.add('border-transparent', 'bg-surface-container-low');
    }
  });
}

async function handleUpdateProfile(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const location = form.location.value.trim();
  const profileImage = form.profileImage.value;

  try {
    const res = await apiRequest('/users/me', {
      method: 'PUT',
      body: JSON.stringify({ name, location, profileImage }),
    });

    state.currentUser = res.data;
    updateUserUI();
    closeModal('modal-user-profile');
    showToast('แก้ไขข้อมูลเกษตรกรเรียบร้อยแล้ว 🌱', 'success');
  } catch (err) {
    showToast(err.message || 'ไม่สามารถแก้ไขข้อมูลได้', 'error');
  }
}

// Switch Login / Register Tabs in Auth Modal
function switchAuthTab(tab) {
  const loginTab = document.getElementById('auth-tab-login');
  const regTab = document.getElementById('auth-tab-register');
  const loginForm = document.getElementById('form-auth-login');
  const regForm = document.getElementById('form-auth-register');
  const title = document.getElementById('auth-modal-title');
  const subtitle = document.getElementById('auth-modal-subtitle');

  if (tab === 'login') {
    loginTab.classList.add('bg-white', 'text-primary', 'font-black', 'shadow-sm');
    loginTab.classList.remove('text-on-surface-variant', 'font-bold');
    regTab.classList.remove('bg-white', 'text-primary', 'font-black', 'shadow-sm');
    regTab.classList.add('text-on-surface-variant', 'font-bold');
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    title.textContent = 'ยินดีต้อนรับสู่ ครูสวน AI';
    subtitle.textContent = 'เข้าสู่ระบบเพื่อจัดการแปลงเกษตรและปรึกษา AI';
  } else {
    regTab.classList.add('bg-white', 'text-primary', 'font-black', 'shadow-sm');
    regTab.classList.remove('text-on-surface-variant', 'font-bold');
    loginTab.classList.remove('bg-white', 'text-primary', 'font-black', 'shadow-sm');
    loginTab.classList.add('text-on-surface-variant', 'font-bold');
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    title.textContent = 'เริ่มต้นใช้งาน ครูสวน AI 🌱';
    subtitle.textContent = 'สมัครสมาชิกเพื่อสร้างแปลงเกษตรและปรึกษา AI';
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const phone = form.phone.value.trim();
  const password = form.password.value;
  const btn = document.getElementById('btn-login-submit');

  btn.disabled = true;
  btn.textContent = 'กำลังเข้าสู่ระบบ...';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, password }),
    }).then((r) => r.json());

    if (!res.success) {
      throw new Error(res.error || 'เบอร์โทรศัพท์หรือรหัสผ่านไม่ถูกต้อง');
    }

    state.token = res.data.token;
    state.currentUser = res.data.user;
    localStorage.setItem('krusuan_token', state.token);

    updateUserUI();
    closeModal('modal-auth');
    showToast(`ยินดีต้อนรับคุณ ${state.currentUser.name} 👋`, 'success');
    await refreshAllData();
    navigate('home');
  } catch (err) {
    showToast(err.message || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'เข้าสู่ระบบ 🚀';
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const name = form.name.value.trim();
  const phone = form.phone.value.trim();
  const password = form.password.value;
  const location = form.location.value.trim();
  const btn = document.getElementById('btn-register-submit');

  btn.disabled = true;
  btn.textContent = 'กำลังสร้างบัญชี...';

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, password, location }),
    }).then((r) => r.json());

    if (!res.success) {
      throw new Error(res.error || 'ไม่สามารถสมัครสมาชิกได้');
    }

    state.token = res.data.token;
    state.currentUser = res.data.user;
    localStorage.setItem('krusuan_token', state.token);

    updateUserUI();
    closeModal('modal-auth');

    if (typeof confetti === 'function') {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }

    showToast(`🎉 สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${state.currentUser.name}`, 'success');
    await refreshAllData();
    navigate('home');
  } catch (err) {
    showToast(err.message || 'เกิดข้อผิดพลาดในการสมัครสมาชิก', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'สมัครสมาชิกและเริ่มใช้งาน 🎉';
  }
}

async function quickDemoLogin(showToastNotice = true) {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '0812345678', password: '123456' }),
    }).then((r) => r.json());

    if (res.success) {
      state.token = res.data.token;
      state.currentUser = res.data.user;
      localStorage.setItem('krusuan_token', state.token);
      updateUserUI();
      closeModal('modal-auth');
      if (showToastNotice) {
        showToast('เข้าสู่ระบบด้วยบัญชีตัวอย่างสำเร็จแล้ว 🚀', 'success');
      }
      await refreshAllData();
      navigate('home');
    }
  } catch (err) {
    console.error('Demo login error:', err);
  }
}

function logout() {
  localStorage.removeItem('krusuan_token');
  state.token = '';
  state.currentUser = null;
  state.plots = [];
  state.todayTasks = [];
  closeModal('modal-user-profile');
  showToast('ออกจากระบบเรียบร้อยแล้ว', 'info');
  openModal('modal-auth');
  switchAuthTab('login');
}

// ==========================================
// 🧭 ROUTING & NAVIGATION
// ==========================================
function handleHashNavigation() {
  const hash = window.location.hash.replace('#', '') || 'home';
  if (hash.startsWith('farm-detail/')) {
    const plotId = hash.replace('farm-detail/', '');
    openFarmDetail(plotId, false);
  } else {
    navigate(hash, false);
  }
}

function navigate(viewName, updateHash = true) {
  state.activeView = viewName;
  if (updateHash) {
    window.location.hash = viewName;
  }

  // Hide all views
  document.querySelectorAll('.view-section').forEach((el) => {
    el.classList.add('hidden');
  });

  // Show active view
  const targetView = document.getElementById(`view-${viewName}`);
  if (targetView) {
    targetView.classList.remove('hidden');
  }

  // Update Desktop Nav Active States
  document.querySelectorAll('#desktop-nav .nav-btn').forEach((btn) => {
    const nav = btn.getAttribute('data-nav');
    if (nav === viewName) {
      btn.classList.add('bg-primary-container', 'text-on-primary-container', 'font-bold', 'shadow-sm');
      btn.classList.remove('text-on-surface-variant');
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.classList.add('fill');
    } else {
      btn.classList.remove('bg-primary-container', 'text-on-primary-container', 'font-bold', 'shadow-sm');
      btn.classList.add('text-on-surface-variant');
      const icon = btn.querySelector('.material-symbols-outlined');
      if (icon) icon.classList.remove('fill');
    }
  });

  // Update Mobile Nav Active States
  document.querySelectorAll('.mobile-nav-btn').forEach((btn) => {
    const mob = btn.getAttribute('data-mobilenav');
    const icon = btn.querySelector('.material-symbols-outlined');
    if (mob === viewName) {
      btn.classList.add('text-primary');
      btn.classList.remove('text-on-surface-variant');
      if (icon) icon.classList.add('fill');
    } else {
      btn.classList.remove('text-primary');
      btn.classList.add('text-on-surface-variant');
      if (icon) icon.classList.remove('fill');
    }
  });

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // View specific refresh
  if (viewName === 'chat' && !state.currentConversationId) {
    initChatView();
  }
}

// ==========================================
// 📡 API CLIENT HELPER
// ==========================================
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  let json = {};
  try {
    json = await res.json();
  } catch (parseErr) {
    const err = new Error('เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง');
    err.status = res.status;
    throw err;
  }

  if (!res.ok || json.success === false) {
    const errorMsg = json.error || 'เกิดข้อผิดพลาดในการเชื่อมต่อ';
    const err = new Error(errorMsg);
    err.status = res.status;
    throw err;
  }
  return json;
}

// ==========================================
// 🔄 DATA REFRESHERS
// ==========================================
async function refreshAllData() {
  if (!state.token) return;
  try {
    await Promise.all([
      loadPlots(),
      loadTodayTasks(),
      loadMarketProducts(),
      loadNotifications(),
    ]);
  } catch (err) {
    console.error('Error refreshing data:', err);
  }
}

async function loadPlots() {
  const res = await apiRequest('/plots');
  state.plots = res.data || [];
  renderHomePlots();
  renderAllPlots();
  populateChatPlotSelector();
}

async function loadTodayTasks() {
  const res = await apiRequest('/tasks/today');
  state.todayTasks = res.data?.tasks || [];
  const count = state.todayTasks.length;

  // Update badges
  const badgeEl = document.getElementById('badge-task-count');
  const mobBadgeEl = document.getElementById('mobile-badge-task-count');
  if (badgeEl) badgeEl.textContent = count;
  if (mobBadgeEl) mobBadgeEl.textContent = count;

  // Update home banner text
  const homeBanner = document.getElementById('home-task-banner-title');
  if (homeBanner) {
    homeBanner.textContent = count > 0 ? `มี ${count} ภารกิจที่ต้องทำ` : 'คุณทำครบทุกภารกิจวันนี้แล้ว 🎉';
  }

  const tasksSummary = document.getElementById('tasks-summary-text');
  if (tasksSummary) {
    tasksSummary.textContent = count > 0 ? `วันนี้มี ${count} ภารกิจที่คุณต้องทำ` : 'เก่งมากครับ! วันนี้ไม่มีภารกิจค้างแล้ว';
  }

  renderTasksList();
}

async function loadMarketProducts() {
  const res = await apiRequest('/market');
  state.marketProducts = res.data || [];
  renderMarketProducts();
}

async function loadNotifications() {
  const res = await apiRequest('/notifications');
  state.notifications = res.data || [];
  renderNotifications();
}

// ==========================================
// 🎨 RENDERERS: PLOTS & FARMS
// ==========================================
function renderHomePlots() {
  const container = document.getElementById('home-plots-grid');
  if (!container) return;

  if (state.plots.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-3xl p-8 text-center shadow-tactile border border-outline-variant/30">
        <span class="text-4xl">🌱</span>
        <h4 class="font-bold text-base text-on-background mt-2">ยังไม่มีแปลงเกษตร</h4>
        <p class="text-xs text-on-surface-variant mt-1">เริ่มต้นสร้างแปลงแรกของคุณ และให้ AI ช่วยวางแผนได้เลยครับ</p>
        <button onclick="openModal('modal-create-plot')" class="mt-4 px-5 py-2.5 bg-primary text-white text-xs font-bold rounded-full shadow-sm hover:scale-105 transition-transform">
          ＋ เพิ่มแปลงใหม่
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.plots
    .slice(0, 4)
    .map(
      (plot) => `
    <div onclick="openFarmDetail('${plot.id}')" class="bg-white rounded-3xl p-5 shadow-tactile hover:shadow-tactile-hover flex flex-col gap-3.5 transition-all duration-200 cursor-pointer border border-outline-variant/20 hover:scale-[1.02] group">
      <div class="flex items-start gap-3.5">
        <div class="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform">
          ${plot.cropEmoji || '🌱'}
        </div>
        <div class="flex-1 min-w-0">
          <div class="inline-flex items-center gap-1 px-2.5 py-0.5 bg-primary-container/20 text-primary text-[10px] font-bold rounded-full mb-1">
            <span>${plot.cropCycle?.currentStage || 'กำลังดูแล'}</span>
          </div>
          <h4 class="font-bold text-base text-on-background truncate">${plot.name}</h4>
          <p class="text-xs text-outline">วันที่ ${plot.dayCount || 1} • ${plot.areaFormatted || 'แปลงเกษตร'}</p>
        </div>
      </div>

      <div>
        <div class="flex justify-between text-xs font-bold mb-1">
          <span class="text-on-surface-variant">ความคืบหน้า</span>
          <span class="text-primary">${plot.cropCycle?.progress || 0}%</span>
        </div>
        <div class="w-full h-2.5 bg-surface-container rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-primary-container to-primary rounded-full transition-all duration-500" style="width: ${plot.cropCycle?.progress || 0}%;"></div>
        </div>
      </div>

      <div class="mt-auto pt-1 flex justify-end">
        <span class="text-xs font-bold text-primary group-hover:translate-x-1 transition-transform flex items-center gap-1">
          ดูแปลง <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
        </span>
      </div>
    </div>
  `
    )
    .join('');
}

function renderAllPlots() {
  const container = document.getElementById('all-plots-grid');
  if (!container) return;

  const filtered = state.plots.filter((p) => {
    if (state.farmFilter === 'ACTIVE') return p.status === 'ACTIVE';
    if (state.farmFilter === 'HARVESTED') return p.status === 'HARVESTED';
    if (state.farmFilter === 'NEAR_HARVEST') return (p.cropCycle?.progress || 0) >= 80;
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-3xl p-10 text-center shadow-tactile border border-outline-variant/30">
        <span class="text-4xl">🌾</span>
        <h4 class="font-bold text-lg text-on-background mt-2">ไม่พบแปลงเกษตรในหมวดนี้</h4>
        <p class="text-xs text-on-surface-variant mt-1">ลองเปลี่ยนตัวกรอง หรือเพิ่มแปลงเกษตรใหม่ได้เลยครับ</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered
    .map(
      (plot) => `
    <div onclick="openFarmDetail('${plot.id}')" class="bg-white rounded-3xl p-6 shadow-tactile hover:shadow-tactile-hover flex flex-col gap-4 relative overflow-hidden group hover:scale-[1.02] transition-all duration-200 cursor-pointer border border-outline-variant/20">
      <div class="flex justify-between items-start">
        <div class="flex gap-3.5 items-center">
          <div class="w-14 h-14 bg-surface-container rounded-2xl flex items-center justify-center text-3xl shadow-sm">
            ${plot.cropEmoji || '🌱'}
          </div>
          <div>
            <h3 class="font-bold text-base text-on-background">${plot.name}</h3>
            <p class="text-xs text-outline flex items-center gap-1 mt-0.5">
              <span class="material-symbols-outlined text-[14px]">calendar_today</span>
              <span>วันที่ ${plot.dayCount || 1} • ${plot.areaFormatted || ''}</span>
            </p>
          </div>
        </div>
        <div class="flex items-center gap-1">
          <span class="px-2.5 py-1 bg-surface-container-low text-primary text-[10px] font-bold rounded-full border border-primary/20">
            ${plot.cropCycle?.currentStage || 'กำลังดูแล'}
          </span>
          <button type="button" onclick="event.stopPropagation(); confirmDeletePlot('${plot.id}', '${plot.name.replace(/'/g, "\\'")}')" class="w-8 h-8 rounded-full hover:bg-red-50 text-on-surface-variant/40 hover:text-red-600 transition-colors flex items-center justify-center cursor-pointer" title="ลบแปลงนี้">
            <span class="material-symbols-outlined text-[18px]">delete</span>
          </button>
        </div>
      </div>

      <div class="space-y-1.5">
        <div class="flex justify-between text-xs font-bold">
          <span class="text-on-surface-variant">ความก้าวหน้า</span>
          <span class="text-primary font-extrabold">${plot.cropCycle?.progress || 0}%</span>
        </div>
        <div class="w-full bg-surface-container rounded-full h-3 overflow-hidden shadow-inner">
          <div class="bg-gradient-to-r from-primary-container to-primary h-3 rounded-full transition-all duration-500" style="width: ${plot.cropCycle?.progress || 0}%"></div>
        </div>
      </div>

      <button class="mt-2 w-full bg-surface-container-low text-primary text-xs font-bold py-3 rounded-2xl border border-outline-variant/40 hover:bg-primary hover:text-white transition-all duration-200 flex items-center justify-center gap-1.5">
        <span>เปิดแปลง</span>
        <span class="material-symbols-outlined text-[16px] group-hover:translate-x-1 transition-transform">arrow_forward</span>
      </button>
    </div>
  `
    )
    .join('');
}

function setFarmFilter(filter) {
  state.farmFilter = filter;
  document.querySelectorAll('.farm-filter-btn').forEach((btn) => {
    const f = btn.getAttribute('data-filter');
    if (f === filter) {
      btn.classList.remove('bg-white', 'text-on-surface-variant', 'border-outline-variant/50');
      btn.classList.add('bg-primary', 'text-white', 'border-transparent');
    } else {
      btn.classList.add('bg-white', 'text-on-surface-variant', 'border-outline-variant/50');
      btn.classList.remove('bg-primary', 'text-white', 'border-transparent');
    }
  });
  renderAllPlots();
}

function filterFarms() {
  const query = document.getElementById('farm-search-input')?.value.toLowerCase() || '';
  const cards = document.querySelectorAll('#all-plots-grid > div');
  cards.forEach((card) => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(query) ? '' : 'none';
  });
}

// Handle Add Plot Submit
async function handleCreatePlot(e) {
  e.preventDefault();
  const form = e.target;
  const selectedCropRadio = form.querySelector('input[name="cropName"]:checked');
  let cropName = selectedCropRadio ? selectedCropRadio.value : 'ทุเรียน';

  if (cropName === 'CUSTOM') {
    const customName = document.getElementById('input-custom-crop-name')?.value.trim();
    if (!customName) {
      showToast('กรุณาระบุชื่อพืชที่ต้องการปลูกครับ', 'error');
      return;
    }
    cropName = customName;
  }

  const name = form.name.value.trim();
  const rai = parseFloat(form.rai?.value) || 0;
  const ngan = parseFloat(form.ngan?.value) || 0;
  const sqWa = parseFloat(form.sqWa?.value) || 0;
  const totalArea = (rai * 1600) + (ngan * 400) + (sqWa * 4);

  const location = form.location.value.trim();
  const soilType = form.soilType.value;
  const waterSource = form.waterSource.value;
  const plantingDate = form.plantingDate.value;
  const treeStatus = form.querySelector('input[name="treeStatus"]:checked')?.value || 'MATURE';

  const btn = document.getElementById('btn-submit-create-plot');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin text-lg">⏳</span><span>กำลังสร้างแปลงและ AI วางแผน...</span>`;
  }

  try {
    const res = await apiRequest('/plots', {
      method: 'POST',
      body: JSON.stringify({
        name,
        cropName,
        area: totalArea > 0 ? totalArea : null,
        rai,
        ngan,
        sqWa,
        location,
        soilType,
        waterSource,
        plantingDate: plantingDate || new Date().toISOString(),
        treeStatus,
      }),
    });

    closeModal('modal-create-plot');
    form.reset();
    setDefaultPlantingDate();
    updateCalculatedArea();

    if (typeof confetti === 'function') {
      confetti({ particleCount: 70, spread: 60, origin: { y: 0.6 } });
    }

    showToast(`🎉 สร้างแปลง "${name}" (${cropName}) สำเร็จแล้ว!`, 'success');
    await refreshAllData();

    if (res.data?.plot?.id) {
      openFarmDetail(res.data.plot.id);
    }
  } catch (err) {
    console.error('Create plot error:', err);
    showToast(err.message || 'ไม่สามารถสร้างแปลงได้ กรุณาลองใหม่', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span>สร้างแปลงและเริ่มระบบนำทาง</span><span class="material-symbols-outlined text-[20px]">arrow_forward</span>`;
    }
  }
}

// ==========================================
// 🌳 RENDERER: FARM DETAIL VIEW
// ==========================================
async function openFarmDetail(plotId, updateHash = true) {
  state.currentPlotId = plotId;
  if (updateHash) {
    window.location.hash = `farm-detail/${plotId}`;
  }

  try {
    const res = await apiRequest(`/plots/${plotId}`);
    state.currentPlotDetail = res.data;
    renderFarmDetailView(res.data);
    navigate('farm-detail', false);
  } catch (err) {
    showToast(err.message || 'ไม่สามารถโหลดข้อมูลแปลงได้', 'error');
  }
}

function renderFarmDetailView(plot) {
  const emoji = plot.produceInfo?.emoji || plot.cropEmoji || '🌱';
  const produceName = plot.produceInfo?.produce || `ผลผลิต ${plot.cropName}`;
  const areaText = plot.areaFormatted || `${plot.area || '-'} ตร.ม.`;
  const isMature = plot.isMatureTree || (plot.dayCount && plot.dayCount >= 365);
  const treeAgeYears = plot.treeAgeYears || (plot.dayCount ? (plot.dayCount / 365).toFixed(1) : null);

  // Title & Hero Header
  document.getElementById('farm-detail-title').textContent = plot.name;
  document.getElementById('farm-detail-subtitle').textContent = isMature
    ? `เริ่มปลูกเมื่อ ${plot.dayCount} วันที่แล้ว (อายุประมาณ ${treeAgeYears} ปี) • ${plot.cropName} (${areaText})`
    : `เริ่มปลูกเมื่อ ${plot.dayCount} วันที่แล้ว • ${plot.cropName} (${areaText})`;

  document.getElementById('farm-detail-bg-emoji').textContent = emoji;
  document.getElementById('farm-detail-stage-badge').textContent = isMature
    ? `🥭 วงจรประจำฤดูกาล: ${plot.cropCycle?.currentStage || 'ดูแลผลผลิต'}`
    : `🌱 ระยะ: ${plot.cropCycle?.currentStage || 'ดูแล'}`;

  document.getElementById('farm-detail-progress-text').textContent = `${plot.cropCycle?.progress || (isMature ? 85 : 10)}%`;
  document.getElementById('farm-detail-day-count').textContent = isMature
    ? `อายุต้นประมาณ ${treeAgeYears} ปี (รอบการดูแลประจำฤดูกาล)`
    : `วันที่ ${plot.dayCount} จากรอบประมาณ ${plot.cropDefinition?.totalDays || 100} วัน`;

  document.getElementById('farm-detail-progress-bar').style.width = `${plot.cropCycle?.progress || (isMature ? 85 : 10)}%`;

  // Update Harvest Button Label & Emoji
  const harvestBtn = document.getElementById('btn-farm-harvest');
  if (harvestBtn) {
    harvestBtn.innerHTML = `<span>${emoji}</span><span>บันทึกการเก็บเกี่ยว (${produceName})</span>`;
  }

  // Plot details
  document.getElementById('farm-detail-loc').textContent = plot.location || 'แปลงเกษตรหลัก';
  document.getElementById('farm-detail-soil').textContent = plot.soilType || 'ดินร่วนปนทราย';
  document.getElementById('farm-detail-water').textContent = plot.waterSource || 'น้ำบาดาล / สระน้ำ';
  document.getElementById('farm-detail-harvest-date').textContent = plot.expectedHarvestDate
    ? new Date(plot.expectedHarvestDate).toLocaleDateString('th-TH')
    : 'อีกประมาณ 30 วัน';

  // Render Vertical Crop Journey Timeline
  const timelineContainer = document.getElementById('farm-detail-timeline');
  const stageDefs = plot.cropDefinition?.stages || [];
  const currentStage = plot.cropCycle?.currentStage;

  let passedCurrent = false;

  timelineContainer.innerHTML = stageDefs
    .map((stage) => {
      const isCurrent = stage.name === currentStage || stage.label === currentStage;
      let statusIcon = 'lock';
      let nodeBg = 'bg-surface-container-high text-outline';
      let titleColor = 'text-outline';
      let desc = stage.description || `ประมาณ ${stage.days} วัน`;

      if (!passedCurrent) {
        if (isCurrent) {
          statusIcon = 'radio_button_checked';
          nodeBg = 'bg-primary text-white border-4 border-primary-container animate-pulse-subtle shadow-tactile';
          titleColor = 'text-primary font-black';
          desc = isMature
            ? `● กำลังดำเนินการในฤดูกาลนี้ (อายุต้น ${treeAgeYears} ปี)`
            : `● กำลังดำเนินการอยู่ (วันที่ ${plot.dayCount})`;
          passedCurrent = true;
        } else {
          statusIcon = 'check';
          nodeBg = 'bg-primary text-white shadow-sm';
          titleColor = 'text-on-background font-bold';
          desc = '✓ ผ่านการดูแลช่วงนี้เรียบร้อยแล้ว';
        }
      }

      return `
      <div class="timeline-item relative flex gap-4 md:gap-6 pb-6">
        <div class="timeline-line"></div>
        <div class="relative z-10 w-11 h-11 rounded-full ${nodeBg} flex items-center justify-center shrink-0 border-2 border-white text-base">
          <span class="material-symbols-outlined text-[20px]">${statusIcon}</span>
        </div>
        <div class="flex-1 pt-1.5">
          <div class="flex items-center gap-2">
            <span class="text-xl">${stage.emoji || '🌱'}</span>
            <h4 class="text-base md:text-lg ${titleColor}">${stage.label || stage.name}</h4>
          </div>
          <p class="text-xs text-on-surface-variant mt-0.5">${desc}</p>
        </div>
      </div>
    `;
    })
    .join('');

  // Render Farm Journal
  const journalContainer = document.getElementById('farm-detail-journal-list');
  const entries = plot.journalEntries || [];

  if (entries.length === 0) {
    journalContainer.innerHTML = `
      <p class="text-xs text-outline text-center py-4">ยังไม่มีบันทึกในแปลงนี้</p>
    `;
  } else {
    journalContainer.innerHTML = entries
      .map(
        (entry) => `
      <div class="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/30 flex items-start gap-3">
        <span class="text-2xl">${entry.emoji || '📝'}</span>
        <div class="flex-1 min-w-0">
          <h5 class="font-bold text-xs text-on-background truncate">${entry.title}</h5>
          <p class="text-[11px] text-on-surface-variant mt-0.5 line-clamp-2">${entry.content || ''}</p>
          <span class="text-[10px] text-outline mt-1 block">${new Date(entry.createdAt).toLocaleDateString('th-TH')}</span>
        </div>
      </div>
    `
      )
      .join('');
  }
}

// ==========================================
// 🗑️ DELETE PLOT HANDLERS
// ==========================================
let plotToDeleteId = null;
let plotToDeleteName = '';

function confirmDeletePlot(plotId, plotName) {
  plotToDeleteId = plotId;
  plotToDeleteName = plotName || 'แปลงเกษตรนี้';

  const msg = document.getElementById('delete-plot-modal-msg');
  if (msg) {
    msg.innerHTML = `คุณต้องการลบแปลง <strong>"${plotToDeleteName}"</strong> ใช่หรือไม่?<br><span class="text-error font-medium">ข้อมูลภารกิจและการบันทึกทั้งหมดของแปลงนี้จะถูกลบอย่างถาวร</span>`;
  }
  openModal('modal-delete-plot');
}

function handleDeleteCurrentPlot() {
  if (!state.currentPlotDetail) return;
  confirmDeletePlot(state.currentPlotDetail.id, state.currentPlotDetail.name);
}

async function executeDeletePlot() {
  if (!plotToDeleteId) return;

  const btn = document.getElementById('btn-confirm-delete-plot');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin text-sm">⏳</span><span>กำลังลบ...</span>`;
  }

  try {
    await apiRequest(`/plots/${plotToDeleteId}`, {
      method: 'DELETE',
    });

    closeModal('modal-delete-plot');
    showToast(`🗑️ ลบแปลง "${plotToDeleteName}" เรียบร้อยแล้ว`, 'success');

    plotToDeleteId = null;
    plotToDeleteName = '';

    await refreshAllData();
    navigate('farms');
  } catch (err) {
    console.error('Delete plot error:', err);
    showToast(err.message || 'ไม่สามารถลบแปลงได้ กรุณาลองใหม่อีกครั้ง', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">delete_forever</span><span>ยืนยันลบ</span>`;
    }
  }
}

// Open Harvest Modal
function openHarvestModal() {
  const plot = state.currentPlotDetail;
  if (!plot) return;

  const emoji = plot.produceInfo?.emoji || plot.cropEmoji || '🥭';
  const produceName = plot.produceInfo?.produce || `ผลผลิต ${plot.cropName}`;
  const unit = plot.produceInfo?.unit || 'กก.';

  const modalEmoji = document.getElementById('harvest-modal-emoji');
  const topEmoji = document.getElementById('harvest-modal-top-emoji');
  const title = document.getElementById('harvest-modal-title');
  const desc = document.getElementById('harvest-modal-produce-desc');
  const qtyLabel = document.getElementById('harvest-modal-qty-label');

  if (modalEmoji) modalEmoji.textContent = emoji;
  if (topEmoji) topEmoji.textContent = emoji;
  if (title) title.textContent = `${plot.name} (${plot.cropName})`;
  if (desc) desc.textContent = `ยินดีด้วยครับ ผลผลิต "${produceName}" พร้อมบันทึกและนำสู่ตลาดแล้ว!`;
  if (qtyLabel) qtyLabel.textContent = `ปริมาณที่เก็บได้ (${unit}) *`;

  openModal('modal-harvest');
}

async function handleHarvestSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const quantity = parseFloat(form.quantity.value);
  const qualityGrade = form.qualityGrade.value;
  const notes = form.notes.value;
  const plot = state.currentPlotDetail;

  if (!plot || !plot.id) {
    showToast('ไม่พบข้อมูลแปลงที่เลือก', 'error');
    return;
  }

  try {
    const res = await apiRequest(`/plots/${plot.id}/harvests`, {
      method: 'POST',
      body: JSON.stringify({
        quantity,
        unit: plot.produceInfo?.unit || 'กก.',
        qualityGrade,
        notes,
      }),
    });

    closeModal('modal-harvest');
    form.reset();

    if (typeof confetti === 'function') {
      confetti({ particleCount: 90, spread: 80, origin: { y: 0.6 } });
    }

    showToast(`🎉 บันทึกการเก็บเกี่ยว ${quantity} ${plot.produceInfo?.unit || 'กก.'} สำเร็จและส่งสู่ตลาดแล้ว!`, 'success');
    await refreshAllData();
    openFarmDetail(plot.id, false);
  } catch (err) {
    showToast(err.message || 'เกิดข้อผิดพลาดในการบันทึกการเก็บเกี่ยว', 'error');
  }
}

// Add Journal Entry
async function handleAddJournalSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const title = form.title.value.trim();
  const content = form.content.value.trim();
  const plot = state.currentPlotDetail;

  if (!plot || !plot.id) return;

  try {
    await apiRequest(`/plots/${plot.id}/journal`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        content,
        type: 'NOTE',
        emoji: '📝',
      }),
    });

    closeModal('modal-add-journal');
    form.reset();
    showToast('จดบันทึกไดอารี่แปลงเรียบร้อยแล้ว 🌱', 'success');
    openFarmDetail(plot.id, false);
  } catch (err) {
    showToast(err.message || 'ไม่สามารถจดบันทึกได้', 'error');
  }
}

// ==========================================
// 📋 RENDERER: TODAY'S TASKS & EXECUTION
// ==========================================
function renderTasksList() {
  const container = document.getElementById('tasks-container');
  if (!container) return;

  if (state.todayTasks.length === 0) {
    container.innerHTML = `
      <div class="bg-white rounded-3xl p-10 text-center shadow-tactile border border-outline-variant/30 space-y-3">
        <div class="w-20 h-20 mx-auto rounded-full bg-secondary-container flex items-center justify-center text-4xl">
          🌱
        </div>
        <h3 class="text-xl font-bold text-primary">เก่งมากครับ!</h3>
        <p class="text-sm text-on-surface-variant">วันนี้คุณทำภารกิจครบทั้งหมดแล้ว พักผ่อนหรือปรึกษาครูสวนเพิ่มเติมได้เลยครับ</p>
        <button onclick="navigate('chat')" class="px-6 py-3 bg-primary text-white rounded-full font-bold text-sm shadow-tactile hover:scale-105 transition-transform">
          💬 คุยกับครูสวน AI
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = state.todayTasks
    .map(
      (task, idx) => `
    <div class="bg-white rounded-3xl p-6 shadow-tactile border border-outline-variant/20 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-tactile-hover transition-all">
      <div class="flex gap-4 items-start">
        <div class="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-3xl shrink-0">
          ${task.emoji || '📋'}
        </div>
        <div>
          <span class="text-[10px] font-black text-primary tracking-widest block uppercase">ภารกิจ 0${idx + 1}</span>
          <h3 class="text-lg font-bold text-on-background mt-0.5">${task.title}</h3>
          <div class="flex flex-wrap items-center gap-2 text-xs text-on-surface-variant mt-1">
            <span class="inline-flex items-center gap-1 font-semibold text-primary">
              <span class="material-symbols-outlined text-[14px]">potted_plant</span>
              ${task.plot?.name || 'แปลงเกษตร'}
            </span>
            <span>•</span>
            <span class="text-outline">⏱ ${task.estimatedTime || 15} นาที</span>
          </div>
        </div>
      </div>

      <button onclick="openTaskExecution('${task.id}')" class="w-full md:w-auto px-6 py-3 bg-primary text-white font-bold rounded-2xl hover:bg-on-primary-container shadow-tactile active:scale-95 transition-all flex items-center justify-center gap-2 text-sm cursor-pointer">
        <span>เริ่มทำภารกิจ</span>
        <span class="material-symbols-outlined text-[18px]">arrow_forward</span>
      </button>
    </div>
  `
    )
    .join('');
}

function openTaskExecution(taskId) {
  const task = state.todayTasks.find((t) => t.id === taskId);
  if (!task) return;

  state.executingTask = task;
  document.getElementById('task-exec-title').textContent = task.title;
  document.getElementById('task-exec-emoji').textContent = task.emoji || '💧';
  document.getElementById('task-exec-heading').textContent = `${task.title} กันครับ 🌱`;
  document.getElementById('task-exec-desc').textContent = task.description || 'ปฏิบัติตามคำแนะนำของครูสวนเพื่อผลผลิตที่ดีที่สุด';

  let tipText = 'รดบริเวณโคนต้น และสังเกตการเจริญเติบโตของพืชอย่างสม่ำเสมอ';
  if (task.instructions) {
    try {
      const parsed = JSON.parse(task.instructions);
      if (Array.isArray(parsed) && parsed.length > 0) {
        tipText = parsed.map((p) => `• ${p.text}`).join('\n');
      }
    } catch (e) {}
  }
  document.getElementById('task-exec-tip').innerText = tipText;

  document.getElementById('task-exec-file').value = '';
  document.getElementById('task-exec-note').value = '';
  document.getElementById('task-file-label').textContent = 'เลือกรูปภาพ / ถ่ายภาพ';

  openModal('modal-task-exec');
}

function previewTaskFile(input) {
  if (input.files && input.files[0]) {
    document.getElementById('task-file-label').textContent = `📷 ${input.files[0].name}`;
  }
}

async function submitTaskCompletion() {
  if (!state.executingTask) return;
  const taskId = state.executingTask.id;
  const note = document.getElementById('task-exec-note').value;
  const fileInput = document.getElementById('task-exec-file');

  const btn = document.getElementById('btn-complete-task');
  btn.disabled = true;
  btn.textContent = 'กำลังบันทึก...';

  try {
    if (fileInput.files && fileInput.files[0]) {
      const formData = new FormData();
      formData.append('file', fileInput.files[0]);
      formData.append('note', note);
      formData.append('type', 'PHOTO');
      await fetch(`${API_BASE}/tasks/${taskId}/evidence`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${state.token}` },
        body: formData,
      });
    }

    await apiRequest(`/tasks/${taskId}/complete`, {
      method: 'PUT',
      body: JSON.stringify({ note }),
    });

    closeModal('modal-task-exec');

    if (typeof confetti === 'function') {
      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
    }

    showToast('🎉 ทำภารกิจสำเร็จเรียบร้อยแล้ว!', 'success');
    await refreshAllData();
  } catch (err) {
    showToast(err.message || 'ไม่สามารถบันทึกภารกิจได้', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="material-symbols-outlined">check_circle</span><span>✓ ทำภารกิจนี้เสร็จแล้ว</span>`;
  }
}

// ==========================================
// 💬 CHAT CONTROLLER (ครูสวน AI — Typhoon)
// ==========================================
async function initChatView() {
  try {
    const res = await apiRequest('/chat/conversations');
    const convos = res.data || [];
    if (convos.length > 0) {
      state.currentConversationId = convos[0].id;
      await loadChatHistory(state.currentConversationId);
    } else {
      const newRes = await apiRequest('/chat/conversations', {
        method: 'POST',
        body: JSON.stringify({ title: 'ปรึกษาครูสวน AI' }),
      });
      state.currentConversationId = newRes.data.id;
      renderWelcomeChatMessage();
    }
  } catch (err) {
    console.error('Error init chat:', err);
    renderWelcomeChatMessage();
  }
}

function populateChatPlotSelector() {
  const sel = document.getElementById('chat-plot-selector');
  if (!sel) return;

  const currentVal = sel.value;
  sel.innerHTML = `<option value="">🌱 บริบททั่วไป</option>` +
    state.plots.map((p) => `<option value="${p.id}">${p.cropEmoji || '🌱'} ${p.name}</option>`).join('');
  
  if (currentVal) sel.value = currentVal;
}

function changeChatPlotContext() {
  const plotId = document.getElementById('chat-plot-selector')?.value;
  if (plotId) {
    const plot = state.plots.find((p) => p.id === plotId);
    showToast(`เปลี่ยนบริบทการตอบเป็น: ${plot?.name || 'แปลงเกษตร'}`, 'info');
  }
}

async function loadChatHistory(conversationId) {
  try {
    const res = await apiRequest(`/chat/conversations/${conversationId}`);
    state.chatMessages = res.data?.messages || [];
    renderChatMessages();
  } catch (err) {
    renderWelcomeChatMessage();
  }
}

function renderWelcomeChatMessage() {
  const box = document.getElementById('chat-messages-box');
  if (!box) return;

  box.innerHTML = `
    <div class="flex gap-3 items-start">
      <div class="w-10 h-10 rounded-2xl bg-secondary-container flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-primary/20">
        <img src="/images/logo.png" alt="ครูสวน AI" class="w-full h-full object-cover" />
      </div>
      <div class="bg-surface-container-low rounded-3xl rounded-tl-none p-4 max-w-[85%] text-sm text-on-background shadow-tactile border border-outline-variant/30 leading-relaxed">
        <p class="font-bold text-primary mb-1">สวัสดีครับ ${state.currentUser?.name || 'เกษตรกร'} 👋</p>
        <p>ผมคือ <strong>ครูสวน AI</strong> ผู้ช่วยอัจฉริยะด้านการเกษตร สงสัยเรื่องศัตรูพืช การใส่ปุ๋ย การจัดการน้ำ หรือการตลาดผลผลิต ถามผมได้ตลอดเวลาเลยครับ 🌱</p>
      </div>
    </div>
  `;

  renderQuickChatActions([
    'ช่วงนี้ควรรดน้ำอย่างไรดี?',
    'ใบพืชเริ่มเหลืองเกิดจากอะไร?',
    'ขอสูตรปุ๋ยหมักบำรุงดิน',
    'เทคนิคตัดแต่งกิ่งให้ผลดก',
  ]);
}

function formatMarkdownChat(text) {
  if (!text) return '';
  let html = String(text);

  // Escape HTML tags to prevent XSS
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // Clean raw horizontal rules
  html = html.replace(/^---+$/gm, '');

  // Bold **text**
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-primary">$1</strong>');

  // Headers (### or ####) -> clean bold subtitles
  html = html.replace(/^#{1,6}\s*(.*?)$/gm, '<h4 class="font-bold text-sm mt-2 mb-1 text-on-background">$1</h4>');

  // Blockquotes (> text) -> styled highlight callout box
  html = html.replace(/^&gt;\s*(.*?)$/gm, '<div class="bg-primary/10 border-l-4 border-primary px-3 py-1.5 rounded-r-xl my-2 text-xs font-semibold text-primary">$1</div>');

  // Bullet items (- item or * item)
  html = html.replace(/^[\*\-]\s+(.*?)$/gm, '<div class="flex items-start gap-1.5 my-1"><span class="text-primary font-bold">•</span><span>$1</span></div>');

  // Numbered lists (1. item)
  html = html.replace(/^(\d+)\.\s+(.*?)$/gm, '<div class="flex items-start gap-1.5 my-1"><span class="font-bold text-primary">$1.</span><span>$2</span></div>');

  // Convert double newlines into clean spacing
  html = html.replace(/\n\n+/g, '<div class="h-2"></div>').replace(/\n/g, '<br>');

  return html;
}

function renderChatMessages() {
  const box = document.getElementById('chat-messages-box');
  if (!box) return;

  if (state.chatMessages.length === 0) {
    renderWelcomeChatMessage();
    return;
  }

  box.innerHTML = state.chatMessages
    .map((msg) => {
      const isUser = msg.role === 'user';
      const formattedContent = isUser
        ? `<p class="whitespace-pre-line">${msg.content}</p>`
        : `<div class="leading-relaxed">${formatMarkdownChat(msg.content)}</div>`;

      return `
      <div class="flex gap-3 items-start ${isUser ? 'flex-row-reverse' : ''}">
        <div class="w-10 h-10 rounded-2xl ${isUser ? 'bg-primary text-white font-bold' : 'bg-secondary-container'} flex items-center justify-center text-xl shrink-0 shadow-sm overflow-hidden border border-outline-variant/30">
          ${isUser ? (state.currentUser?.profileImage || '🧑‍🌾') : '<img src="/images/logo.png" alt="ครูสวน AI" class="w-full h-full object-cover" />'}
        </div>
        <div class="${isUser ? 'bg-primary text-white rounded-tr-none' : 'bg-surface-container-low text-on-background rounded-tl-none border border-outline-variant/30'} rounded-3xl p-4 max-w-[85%] text-sm shadow-tactile leading-relaxed">
          ${formattedContent}
        </div>
      </div>
    `;
    })
    .join('');

  box.scrollTop = box.scrollHeight;
}

function renderQuickChatActions(actions) {
  const container = document.getElementById('chat-quick-actions');
  if (!container) return;

  container.innerHTML = actions
    .map(
      (a) => `
    <button onclick="quickAskAI('${a}')" class="px-3.5 py-1.5 bg-surface-container-low hover:bg-surface-container text-xs font-semibold text-primary rounded-full transition-colors shrink-0 shadow-xs border border-primary/20">
      💡 ${a}
    </button>
  `
    )
    .join('');
}

function quickAskAI(text) {
  navigate('chat');
  const input = document.getElementById('chat-input-text');
  if (input) {
    input.value = text;
    sendChatMessage();
  }
}

async function sendChatMessage() {
  const input = document.getElementById('chat-input-text');
  const text = input?.value.trim();
  if (!text || state.isAiStreaming) return;

  input.value = '';
  const plotId = document.getElementById('chat-plot-selector')?.value || undefined;

  // Append user message
  state.chatMessages.push({ role: 'user', content: text });
  renderChatMessages();

  // Create loading bubble
  const box = document.getElementById('chat-messages-box');
  const loadingDiv = document.createElement('div');
  loadingDiv.id = 'ai-loading-bubble';
  loadingDiv.className = 'flex gap-3 items-start';
  loadingDiv.innerHTML = `
    <div class="w-10 h-10 rounded-2xl bg-secondary-container flex items-center justify-center overflow-hidden shrink-0 shadow-sm border border-primary/20">
      <img src="/images/logo.png" alt="ครูสวน AI" class="w-full h-full object-cover animate-pulse" />
    </div>
    <div class="bg-surface-container-low rounded-3xl rounded-tl-none p-4 text-sm text-on-background border border-outline-variant/30 shadow-tactile flex items-center gap-2">
      <div class="w-2 h-2 rounded-full bg-primary animate-ping"></div>
      <span>ครูสวน AI กำลังคิดคำตอบ...</span>
    </div>
  `;
  box.appendChild(loadingDiv);
  box.scrollTop = box.scrollHeight;

  state.isAiStreaming = true;

  try {
    const res = await apiRequest('/chat/message', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: state.currentConversationId,
        message: text,
        plotId,
      }),
    });

    loadingDiv.remove();

    if (res.data?.conversationId) {
      state.currentConversationId = res.data.conversationId;
    }

    if (res.data?.reply) {
      state.chatMessages.push({ role: 'assistant', content: res.data.reply });
      renderChatMessages();
    }
  } catch (err) {
    loadingDiv.remove();
    if (err.status === 404) {
      state.currentConversationId = null;
    }
    showToast(err.message || 'ไม่สามารถส่งข้อความได้', 'error');
  } finally {
    state.isAiStreaming = false;
  }
}

function clearChatMessages() {
  state.chatMessages = [];
  renderWelcomeChatMessage();
}

function triggerVoiceInput() {
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
    showToast('เบราว์เซอร์ไม่รองรับการแปลงเสียงเป็นข้อความ กรุณาพิมพ์แทนครับ', 'info');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  recognition.lang = 'th-TH';
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  const micBtn = document.querySelector('button[onclick="triggerVoiceInput()"]');
  const input = document.getElementById('chat-input-text');
  const originalPlaceholder = input?.placeholder || '';

  if (micBtn) {
    micBtn.classList.add('animate-pulse', 'text-red-500', 'bg-red-50');
  }
  if (input) {
    input.placeholder = '🎙️ กำลังฟังเสียงของคุณ... พูดได้เลยครับ';
  }

  showToast('🎙️ กำลังฟังเสียงภาษาไทย... พูดได้เลยครับ', 'info');

  let finalTranscript = '';

  recognition.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; ++i) {
      if (e.results[i].isFinal) {
        finalTranscript += e.results[i][0].transcript;
      } else {
        interim += e.results[i][0].transcript;
      }
    }

    if (input) {
      const liveText = finalTranscript || interim;
      input.value = cleanThaiTranscript(liveText);
    }
  };

  recognition.onend = () => {
    if (micBtn) {
      micBtn.classList.remove('animate-pulse', 'text-red-500', 'bg-red-50');
    }
    if (input) {
      input.placeholder = originalPlaceholder;
      if (input.value.trim()) {
        input.value = cleanThaiTranscript(input.value);
        showToast(`🎙️ จับเสียงสำเร็จ: "${input.value}"`, 'success');
        input.focus();
      }
    }
  };

  recognition.onerror = (err) => {
    if (micBtn) {
      micBtn.classList.remove('animate-pulse', 'text-red-500', 'bg-red-50');
    }
    if (input) {
      input.placeholder = originalPlaceholder;
    }
    console.warn('Speech recognition event:', err.error);
    if (err.error !== 'no-speech') {
      showToast('ไม่สามารถจับเสียงได้ชัดเจน กรุณาลองพูดใหม่อีกครั้งครับ', 'error');
    }
  };

  try {
    recognition.start();
  } catch (err) {
    console.warn('Speech recognition start failed:', err);
  }
}

// ==========================================
// 🛒 MARKET RENDERER
// ==========================================
function renderMarketProducts() {
  const container = document.getElementById('market-products-grid');
  if (!container) return;

  if (state.marketProducts.length === 0) {
    container.innerHTML = `
      <div class="col-span-full bg-white rounded-3xl p-10 text-center shadow-tactile border border-outline-variant/30 space-y-3">
        <span class="text-4xl">🛒</span>
        <h4 class="font-bold text-lg text-on-background">ยังไม่มีผลผลิตในตลาด</h4>
        <p class="text-xs text-on-surface-variant">เมื่อคุณบันทึกการเก็บเกี่ยวในแปลง ผลผลิตจะนำมาแสดงและประเมินราคากลางที่นี่ครับ</p>
      </div>
    `;
    return;
  }

  container.innerHTML = state.marketProducts
    .map(
      (prod) => `
    <div class="bg-white rounded-3xl p-6 shadow-tactile border border-outline-variant/20 flex flex-col justify-between gap-4 hover:shadow-tactile-hover transition-all">
      <div class="flex items-start gap-4">
        <div class="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center text-3xl shrink-0 shadow-sm">
          ${prod.cropEmoji || '🥭'}
        </div>
        <div class="flex-1 min-w-0">
          <span class="px-2.5 py-0.5 bg-secondary-container text-on-secondary-container text-[10px] font-bold rounded-full">
            เกรด ${prod.qualityGrade || 'A'}
          </span>
          <h4 class="font-bold text-base text-on-background mt-1 truncate">${prod.cropName}</h4>
          <p class="text-xs text-primary font-extrabold mt-0.5">ปริมาณ: ${prod.quantity} ${prod.unit || 'กก.'}</p>
        </div>
      </div>

      <div class="p-3 bg-surface-container-low rounded-2xl text-xs space-y-1">
        <div class="flex justify-between">
          <span class="text-outline">ราคากลางประเมิน</span>
          <span class="font-bold text-on-background">${prod.expectedPrice ? prod.expectedPrice + ' บาท' : 'กำลังประเมิน'}</span>
        </div>
        <div class="flex justify-between">
          <span class="text-outline">สถานะ</span>
          <span class="font-bold text-primary">พร้อมส่งมอบ</span>
        </div>
      </div>

      <button onclick="showToast('เปิดการเจรจาซื้อขายเรียบร้อยแล้ว เจ้าหน้าที่จะติดต่อกลับครับ', 'success')" class="w-full py-3 bg-primary text-white rounded-2xl text-xs font-bold shadow-tactile hover:bg-on-primary-container transition-all flex items-center justify-center gap-1.5 cursor-pointer">
        <span>ติดต่อผู้รับซื้อ / เสนอขาย</span>
        <span class="material-symbols-outlined text-[16px]">point_of_sale</span>
      </button>
    </div>
  `
    )
    .join('');
}

// ==========================================
// 🔔 NOTIFICATIONS RENDERER
// ==========================================
function renderNotifications() {
  const list = document.getElementById('drawer-notif-list');
  const dot = document.getElementById('badge-notif-dot');
  if (!list) return;

  const unread = state.notifications.filter((n) => !n.isRead);
  if (dot) {
    if (unread.length > 0) dot.classList.remove('hidden');
    else dot.classList.add('hidden');
  }

  if (state.notifications.length === 0) {
    list.innerHTML = `
      <p class="text-xs text-outline text-center py-8">ไม่มีการแจ้งเตือนในขณะนี้</p>
    `;
    return;
  }

  list.innerHTML = state.notifications
    .map(
      (n) => `
    <div class="p-3.5 bg-surface-container-low rounded-2xl border border-outline-variant/30 space-y-1">
      <div class="flex justify-between items-start">
        <h5 class="font-bold text-xs text-on-background">${n.title}</h5>
        <span class="text-[10px] text-outline">${new Date(n.createdAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <p class="text-xs text-on-surface-variant">${n.body || ''}</p>
    </div>
  `
    )
    .join('');
}

function toggleNotificationDrawer() {
  const drawer = document.getElementById('drawer-notif');
  if (drawer) {
    drawer.classList.toggle('hidden');
  }
}

// ==========================================
// 🧰 MODAL & TOAST UTILITIES
// ==========================================
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const bg =
    type === 'success'
      ? 'bg-primary text-white'
      : type === 'error'
      ? 'bg-error text-white'
      : 'bg-on-background text-white';

  toast.className = `${bg} px-4 py-3 rounded-2xl shadow-tactile-lg text-xs font-bold flex items-center gap-2 transform transition-all duration-300 translate-y-2 opacity-0 pointer-events-auto`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '⚠️' : 'ℹ️'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  }, 10);

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// 🌾 IN-APP SENIOR STORYTELLER CONTROLLER
// ==========================================
const storytellerState = {
  selectedTheme: 'fertilizer_soil',
  session: null,
  vapiClient: null,
  sseSource: null,
  timerInterval: null,
  secondsElapsed: 0,
  isPaused: false,
  isMuted: false,
};

function selectInAppTheme(themeId) {
  storytellerState.selectedTheme = themeId;
  document.querySelectorAll('.inapp-theme-card').forEach((el) => {
    el.classList.remove('border-primary', 'bg-primary-container/10', 'shadow-sm');
    el.classList.add('border-outline-variant/40', 'bg-white');
  });

  const activeCard = document.getElementById(`inapp-theme-${themeId}`);
  if (activeCard) {
    activeCard.classList.remove('border-outline-variant/40', 'bg-white');
    activeCard.classList.add('border-primary', 'bg-primary-container/10', 'shadow-sm');
  }
}

function selectInAppFarmerQuick(fullName, displayName, phone, province, crop, years) {
  const nameInput = document.getElementById('inapp-farmer-name');
  const phoneInput = document.getElementById('inapp-farmer-phone');
  const provInput = document.getElementById('inapp-farmer-province');
  const cropInput = document.getElementById('inapp-farmer-crop');

  if (nameInput) nameInput.value = displayName;
  if (phoneInput) phoneInput.value = phone;
  if (provInput) provInput.value = province;
  if (cropInput) cropInput.value = crop;
}

function resetInAppFarmerForm() {
  const nameInput = document.getElementById('inapp-farmer-name');
  const phoneInput = document.getElementById('inapp-farmer-phone');
  if (nameInput) {
    nameInput.value = '';
    nameInput.focus();
  }
  if (phoneInput) phoneInput.value = '';
}

async function startInAppStorytelling() {
  const farmerName = document.getElementById('inapp-farmer-name')?.value.trim() || 'เกษตรกรผู้มีประสบการณ์';
  const phone = document.getElementById('inapp-farmer-phone')?.value.trim();
  const province = document.getElementById('inapp-farmer-province')?.value || 'สุราษฎร์ธานี';
  const crop = document.getElementById('inapp-farmer-crop')?.value || 'ทุเรียน';

  const btn = document.getElementById('btn-inapp-start-story');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<div class="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div><span>กำลังจัดเตรียมศาลา...</span>`;
  }

  try {
    const res = await fetch('/api/storyteller/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        farmerName,
        phone,
        province,
        crop,
        topicTheme: storytellerState.selectedTheme,
        experience: 20,
      }),
    }).then((r) => r.json());

    if (!res.success || !res.data) {
      throw new Error(res.error || 'ไม่สามารถเริ่มห้องเล่าเรื่องได้');
    }

    storytellerState.session = res.data;

    // Switch view to Live Panel completely
    document.getElementById('inapp-story-lobby')?.classList.add('hidden');
    document.getElementById('inapp-story-summary')?.classList.add('hidden');
    document.getElementById('inapp-story-live')?.classList.remove('hidden');

    // Setup tags in Live Room
    const themeLabel = res.data.theme?.title || 'ภูมิปัญญาการเกษตร';
    const farmerTag = document.getElementById('inapp-live-farmer-tag');
    const themeTag = document.getElementById('inapp-live-theme-tag');
    if (farmerTag) farmerTag.textContent = `กำลังเรียนรู้จาก: ${res.data.farmer?.displayName || farmerName}`;
    if (themeTag) themeTag.textContent = `🌱 ${themeLabel}`;

    // Reset live transcript
    const tBox = document.getElementById('inapp-transcript-container');
    if (tBox) {
      tBox.innerHTML = `
        <div class="flex gap-3 items-start">
          <div class="w-10 h-10 rounded-full bg-surface-container text-primary font-bold flex items-center justify-center flex-shrink-0 text-xl border border-outline-variant/30">
            🌱
          </div>
          <div class="bg-surface-container-low rounded-2xl rounded-tl-none p-4 text-on-background font-medium border border-primary/20 max-w-[88%] leading-relaxed">
            <span class="font-bold text-primary block text-sm mb-1">หลานครูสวน AI:</span>
            ${res.data.assistantOverrides?.firstMessage || `สวัสดีครับ${farmerName} สบายดีไหมครับ วันนี้ดีใจมากที่ได้มาฟังเรื่องเล่าจากลุงครับ...`}
          </div>
        </div>
      `;
    }

    // Connect SSE for live events
    connectInAppSSE(res.data.interviewId);

    // Start Live Timer
    startInAppTimer();

    // Start Real-time Vapi Voice
    await connectInAppVapiVoice(res.data);

    showToast('เชื่อมต่อห้องสนทนาเสียงสดสำเร็จแล้วครับ 🎙️', 'success');

  } catch (err) {
    console.error('Error starting storyteller session:', err);
    showToast(err.message || 'ไม่สามารถเปิดห้องเล่าเรื่องได้ กรุณาลองใหม่ครับ', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<span class="text-3xl">🎙️</span><span>เริ่มเล่าเรื่องกับครูสวนเลย</span><span class="material-symbols-outlined text-2xl">arrow_forward</span>`;
    }
  }
}

function startInAppTimer() {
  if (storytellerState.timerInterval) clearInterval(storytellerState.timerInterval);
  storytellerState.secondsElapsed = 0;
  storytellerState.timerInterval = setInterval(() => {
    if (!storytellerState.isPaused) {
      storytellerState.secondsElapsed++;
      const mins = String(Math.floor(storytellerState.secondsElapsed / 60)).padStart(2, '0');
      const secs = String(storytellerState.secondsElapsed % 60).padStart(2, '0');
      const el = document.getElementById('inapp-live-timer');
      if (el) el.textContent = `${mins}:${secs}`;
    }
  }, 1000);
}

async function waitForVapiSDK(timeoutMs = 3500) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (window.Vapi || window.vapiSDK) return true;
    await new Promise((r) => setTimeout(r, 150));
  }
  return Boolean(window.Vapi || window.vapiSDK);
}

async function connectInAppVapiVoice(config) {
  try {
    await waitForVapiSDK(4000);

    // Make sure vapi button is visible for live session
    document.querySelectorAll('#vapi-support-btn, .vapi-btn, .vapi-btn-round').forEach((el) => {
      el.style.display = '';
    });

    if (storytellerState.vapiClient && typeof storytellerState.vapiClient.stop === 'function') {
      try { storytellerState.vapiClient.stop(); } catch (e) {}
    }

    let client = null;

    if (window.vapiSDK && typeof window.vapiSDK.run === 'function') {
      client = window.vapiSDK.run({
        apiKey: config.publicKey,
        assistant: config.assistantId,
        assistantOverrides: config.assistantOverrides,
      });
      storytellerState.vapiClient = client;

      // Auto-trigger audio stream immediately without manual clicking
      setTimeout(() => {
        const vapiBtn = document.getElementById('vapi-support-btn') || document.querySelector('.vapi-btn');
        if (vapiBtn && typeof vapiBtn.click === 'function') {
          vapiBtn.click();
        }
      }, 250);
    } else {
      const VapiClass = window.Vapi?.default || window.Vapi;
      if (typeof VapiClass === 'function') {
        client = new VapiClass(config.publicKey);
        storytellerState.vapiClient = client;
        await client.start(config.assistantId, config.assistantOverrides);
      }
    }

    if (!client) {
      console.warn('Vapi client could not be instantiated');
      return;
    }

    client.on('call-start', () => {
      const el = document.getElementById('inapp-speaker-status');
      if (el) el.textContent = 'ครูสวน AI กำลังตั้งใจฟังคุณลุง...';
      const glow = document.getElementById('inapp-avatar-glow');
      if (glow) glow.classList.add('animate-pulse');
    });

    client.on('speech-start', () => {
      const el = document.getElementById('inapp-speaker-status');
      if (el) el.textContent = 'ครูสวน AI กำลังพูดตอบรับ...';
      const glow = document.getElementById('inapp-avatar-glow');
      if (glow) glow.style.transform = 'scale(1.15)';
    });

    client.on('speech-end', () => {
      const el = document.getElementById('inapp-speaker-status');
      if (el) el.textContent = 'ครูสวน AI กำลังตั้งใจฟังคุณลุงเล่า...';
      const glow = document.getElementById('inapp-avatar-glow');
      if (glow) glow.style.transform = 'scale(1)';
    });

    client.on('volume-level', (level) => {
      const glow = document.getElementById('inapp-avatar-glow');
      if (glow) glow.style.transform = `scale(${1 + Math.min(level, 1) * 0.35})`;
    });

    // Real-time speech transcript from both User and AI
    client.on('message', (message) => {
      if (message.type === 'transcript') {
        const speaker = message.role === 'assistant' ? 'ai' : 'user';
        const text = message.transcript;
        const isPartial = message.transcriptType === 'partial';
        updateInAppLiveTranscript(speaker, text, isPartial);
      }
    });

    client.on('call-end', () => {
      finishInAppStory();
    });

    client.on('error', (err) => {
      console.error('Vapi in-app error:', err);
      let msg = err?.message || String(err);
      if (msg.includes('Permission') || msg.includes('NotAllowedError')) {
        showToast('🎙️ กรุณากด "อนุญาต (Allow)" การใช้ไมโครโฟนบนเบราว์เซอร์', 'error');
      }
    });

  } catch (err) {
    console.error('Failed to init in-app Vapi call:', err);
  }
}

function cleanThaiTranscript(text) {
  if (!text || typeof text !== 'string') return '';
  let t = text.trim();

  // 1. Initial phonetic & English filler corrections
  t = t.replace(/^ON\s+/i, 'อ๋อ ');
  t = t.replace(/\bON\b/gi, 'อ๋อ');
  t = t.replace(/\bOK\b/gi, 'โอเค');
  t = t.replace(/ประ\s*ภัสสร\s*ฟ\s*ล\s*า/g, 'ฟอสฟอรัส');
  t = t.replace(/ประภัสสรฟลา/g, 'ฟอสฟอรัส');
  t = t.replace(/ภัสสร\s*ฟ\s*ล\s*า/g, 'ฟอสฟอรัส');
  t = t.replace(/ฟ\s*ล\s*า/g, 'ฟอสฟอรัส');
  t = t.replace(/ร้อย\s*ห้องโถง/g, 'ลองกอง');
  t = t.replace(/ร้อยห้องโถง/g, 'ลองกอง');
  t = t.replace(/สุด\s*ผู้หญิง\s*สีดำ/g, 'สูตรปุ๋ยหมัก');
  t = t.replace(/สุดผู้หญิงสีดำ/g, 'สูตรปุ๋ยหมัก');
  t = t.replace(/สุด\s*ผู้หญิง/g, 'สูตรปุ๋ย');

  // 2. Collapse artificial intra-word spaces between Thai characters
  while (/([\u0E00-\u0E7F])\s+([\u0E00-\u0E7F])/.test(t)) {
    t = t.replace(/([\u0E00-\u0E7F])\s+([\u0E00-\u0E7F])/g, '$1$2');
  }

  // 3. Post-clean common agricultural words & compound terms
  t = t.replace(/ประภัสสรฟลา/g, 'ฟอสฟอรัส');
  t = t.replace(/ร้อยห้องโถง/g, 'ลองกอง');
  t = t.replace(/สุดผู้หญิง/g, 'สูตรปุ๋ย');
  t = t.replace(/ปุยหมัก/g, 'ปุ๋ยหมัก');
  t = t.replace(/ปุย/g, 'ปุ๋ย');
  t = t.replace(/นำ้หมัก/g, 'น้ำหมัก');
  t = t.replace(/นำ้/g, 'น้ำ');

  // Clean spacing after greetings/particles
  t = t.replace(/^(อ๋อ|โอ้โห|สวัสดีครับ|สวัสดีค่ะ)([ก-๙])/g, '$1 $2');

  return t;
}

function updateInAppLiveTranscript(speaker, text, isPartial = false) {
  if (!text || !text.trim()) return;
  const cleanText = cleanThaiTranscript(text);
  if (!cleanText) return;

  const box = document.getElementById('inapp-transcript-container');
  if (!box) return;

  const isAI = speaker === 'ai' || speaker === 'assistant';
  const avatar = isAI ? '🌱' : '👴';
  const name = isAI ? 'หลานครูสวน AI' : 'คุณลุง/คุณป้า (ท่านกำลังพูด)';
  const nameColor = isAI ? 'text-primary font-bold' : 'text-yellow-300 font-bold';

  let partialBubble = document.getElementById(`live-partial-${speaker}`);

  if (isPartial) {
    if (!partialBubble) {
      partialBubble = document.createElement('div');
      partialBubble.id = `live-partial-${speaker}`;
      partialBubble.className = `flex gap-3 items-start ${isAI ? '' : 'flex-row-reverse'} transition-opacity duration-200`;
      box.appendChild(partialBubble);
    }
    const bgStyle = isAI
      ? 'bg-surface-container-low text-on-background border border-primary/30 rounded-2xl rounded-tl-none opacity-90'
      : 'bg-primary/90 text-white rounded-2xl rounded-tr-none shadow-sm';

    const avatarHtml = isAI
      ? `<img src="/images/logo.png" alt="ครูสวน AI" class="w-full h-full object-cover rounded-full" />`
      : `<span>👴</span>`;

    partialBubble.innerHTML = `
      <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-xl flex-shrink-0 border border-outline-variant/30 overflow-hidden shadow-xs">
        ${avatarHtml}
      </div>
      <div class="${bgStyle} p-3.5 max-w-[85%] leading-relaxed font-medium">
        <div class="flex items-center gap-1 text-xs mb-1 ${nameColor}">
          <span>${name}:</span>
          <span class="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span>
        </div>
        ${cleanText}
      </div>
    `;
  } else {
    // Final transcript
    if (partialBubble) {
      partialBubble.remove();
    }
    appendInAppTranscript(speaker, cleanText);
  }

  box.scrollTop = box.scrollHeight;
}

function appendInAppTranscript(speaker, text) {
  if (!text || !text.trim()) return;
  const cleanText = cleanThaiTranscript(text);
  if (!cleanText) return;

  const box = document.getElementById('inapp-transcript-container');
  if (!box) return;

  const isAI = speaker === 'ai' || speaker === 'assistant';
  const div = document.createElement('div');
  div.className = `flex gap-3 items-start ${isAI ? '' : 'flex-row-reverse'}`;

  const avatar = isAI ? '🌱' : '👴';
  const name = isAI ? 'หลานครูสวน AI' : 'คุณลุง/คุณป้า';
  const bgStyle = isAI
    ? 'bg-surface-container-low text-on-background border border-primary/20 rounded-2xl rounded-tl-none'
    : 'bg-primary text-white rounded-2xl rounded-tr-none shadow-sm';
  const nameColor = isAI ? 'text-primary font-bold' : 'text-yellow-300 font-bold';

  const avatarHtml = isAI
    ? `<img src="/images/logo.png" alt="ครูสวน AI" class="w-full h-full object-cover rounded-full" />`
    : `<span>👴</span>`;

  div.innerHTML = `
    <div class="w-10 h-10 rounded-full bg-surface-container flex items-center justify-center text-xl flex-shrink-0 border border-outline-variant/30 overflow-hidden shadow-xs">
      ${avatarHtml}
    </div>
    <div class="${bgStyle} rounded-2xl p-3.5 max-w-[85%] leading-relaxed font-medium">
      <span class="block text-xs mb-1 ${nameColor}">${name}:</span>
      ${cleanText}
    </div>
  `;

  box.appendChild(div);
  box.scrollTop = box.scrollHeight;
}

function connectInAppSSE(interviewId) {
  if (storytellerState.sseSource) {
    try { storytellerState.sseSource.close(); } catch (e) {}
  }
  
  const sse = new EventSource(`/api/interviews/${interviewId}/stream`);
  storytellerState.sseSource = sse;

  sse.addEventListener('transcript', (e) => {
    try {
      const seg = JSON.parse(e.data);
      appendInAppTranscript(seg.speaker, seg.text);
    } catch (err) {}
  });

  sse.addEventListener('insight', (e) => {
    try {
      const ins = JSON.parse(e.data);
      showInAppWisdomHighlight(ins.title || ins.statement);
    } catch (err) {}
  });

  sse.addEventListener('message', (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === 'transcript') {
        appendInAppTranscript(data.speaker, data.text);
      }
    } catch (err) {}
  });
}

function showInAppWisdomHighlight(text) {
  const box = document.getElementById('inapp-wisdom-highlight-box');
  const label = document.getElementById('inapp-wisdom-highlight-text');
  if (box && label) {
    label.textContent = text;
    box.classList.remove('hidden');
    showToast(`💡 สกัดภูมิปัญญาใหม่: ${text}`, 'success');
  }
}

function toggleInAppPauseCall() {
  storytellerState.isPaused = !storytellerState.isPaused;
  const label = document.getElementById('inapp-pause-label');
  const icon = document.getElementById('inapp-pause-icon');

  if (storytellerState.isPaused) {
    if (label) label.textContent = 'เล่าต่อ';
    if (icon) icon.textContent = 'play_arrow';
    if (storytellerState.vapiClient && typeof storytellerState.vapiClient.setMuted === 'function') {
      try { storytellerState.vapiClient.setMuted(true); } catch (e) {}
    }
  } else {
    if (label) label.textContent = 'พักจิบน้ำ';
    if (icon) icon.textContent = 'pause';
    if (storytellerState.vapiClient && typeof storytellerState.vapiClient.setMuted === 'function') {
      try { storytellerState.vapiClient.setMuted(false); } catch (e) {}
    }
  }
}

function toggleInAppMute() {
  storytellerState.isMuted = !storytellerState.isMuted;
  const circle = document.getElementById('inapp-mute-circle');
  const label = document.getElementById('inapp-mute-label');
  const icon = document.getElementById('inapp-mute-icon');

  if (storytellerState.isMuted) {
    if (circle) circle.className = 'w-14 h-14 rounded-full bg-error-container text-on-error-container flex items-center justify-center text-2xl shadow-sm';
    if (label) {
      label.textContent = 'ไมค์ปิดอยู่';
      label.className = 'text-xs font-bold text-error';
    }
    if (icon) icon.textContent = 'mic_off';
    if (storytellerState.vapiClient && typeof storytellerState.vapiClient.setMuted === 'function') {
      try { storytellerState.vapiClient.setMuted(true); } catch (e) {}
    }
  } else {
    if (circle) circle.className = 'w-14 h-14 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center text-2xl shadow-sm';
    if (label) {
      label.textContent = 'เปิดไมค์';
      label.className = 'text-xs font-bold text-primary';
    }
    if (icon) icon.textContent = 'mic';
    if (storytellerState.vapiClient && typeof storytellerState.vapiClient.setMuted === 'function') {
      try { storytellerState.vapiClient.setMuted(false); } catch (e) {}
    }
  }
}

async function finishInAppStory() {
  const interviewId = storytellerState.session?.interviewId;
  if (!interviewId) {
    resetInAppStoryteller();
    return;
  }

  const btn = document.getElementById('btn-inapp-end-story');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="animate-spin text-xl">⏳</span><span>กำลังรวบรวมคัมภีร์ภูมิปัญญา...</span>`;
  }

  // Cleanly stop Vapi client and mic
  if (storytellerState.vapiClient) {
    try {
      if (typeof storytellerState.vapiClient.stop === 'function') {
        storytellerState.vapiClient.stop();
      }
    } catch (e) {}
    storytellerState.vapiClient = null;
  }

  // Remove any rogue vapi button widget if present
  try {
    document.querySelectorAll('#vapi-support-btn, .vapi-btn, .vapi-btn-round').forEach((el) => el.remove());
  } catch (e) {}

  if (storytellerState.sseSource) {
    try { storytellerState.sseSource.close(); } catch (e) {}
    storytellerState.sseSource = null;
  }

  if (storytellerState.timerInterval) {
    clearInterval(storytellerState.timerInterval);
    storytellerState.timerInterval = null;
  }

  try {
    await fetch(`/api/storyteller/${interviewId}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingUrl: null }),
    });
  } catch (err) {
    console.warn('End storyteller session call warning:', err);
  }

  await loadInAppSummary(interviewId);
}

async function loadInAppSummary(interviewId) {
  try {
    const rawRes = await fetch(`/api/storyteller/${interviewId}/summary`);
    if (!rawRes.ok) {
      throw new Error(`Summary HTTP error: ${rawRes.status}`);
    }
    const res = await rawRes.json();
    if (res.success && res.data) {
      const d = res.data;

      const nameEl = document.getElementById('inapp-sum-farmer-name');
      const metaEl = document.getElementById('inapp-sum-farmer-meta');
      const listEl = document.getElementById('inapp-sum-topics-list');

      if (nameEl) nameEl.textContent = d.farmer?.fullName || d.farmer?.displayName || 'ปราชญ์เกษตรกร';
      if (metaEl) metaEl.textContent = `ปราชญ์ชาวสวน${d.crop || 'การเกษตร'} จ.${d.farmer?.province || 'ภาคใต้'} • ประสบการณ์ ${d.farmer?.yearsExperience || 20} ปี`;

      if (listEl && d.coveredTopics && d.coveredTopics.length > 0) {
        listEl.innerHTML = d.coveredTopics
          .map(
            (t) => `
            <div class="bg-surface-container-low p-4 rounded-2xl border border-primary/20 space-y-1.5 shadow-xs">
              <div class="flex items-center gap-2">
                <span class="text-xl">✨</span>
                <h5 class="font-extrabold text-on-background text-sm sm:text-base">${t.topic}</h5>
              </div>
              <p class="text-xs sm:text-sm text-on-surface-variant leading-relaxed pl-7">${t.summary || ''}</p>
              ${t.quote ? `<div class="text-[11px] text-tertiary italic pl-7 pt-1">🗣️ "${t.quote}"</div>` : ''}
            </div>
          `
          )
          .join('');
      } else if (listEl) {
        listEl.innerHTML = `
          <div class="p-4 bg-surface-container-low rounded-2xl border border-outline-variant/30 text-center text-xs text-on-surface-variant">
            🌾 ได้บันทึกเสียงและข้อมูลเข้าระบบเรียบร้อยแล้ว
          </div>
        `;
      }

      if (typeof confetti === 'function') {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }

      document.getElementById('inapp-story-lobby')?.classList.add('hidden');
      document.getElementById('inapp-story-live')?.classList.add('hidden');
      document.getElementById('inapp-story-summary')?.classList.remove('hidden');

      showToast('🎉 บันทึกคัมภีร์ภูมิปัญญาปราชญ์เกษตรกรเรียบร้อยแล้ว!', 'success');
    }
  } catch (err) {
    console.error('Error loading summary:', err);
    // Show summary screen even on error
    document.getElementById('inapp-story-lobby')?.classList.add('hidden');
    document.getElementById('inapp-story-live')?.classList.add('hidden');
    document.getElementById('inapp-story-summary')?.classList.remove('hidden');
    showToast('บันทึกเรื่องเล่าเรียบร้อยแล้ว', 'info');
  }
}

function resetInAppStoryteller() {
  // Remove any leftover floating vapi elements
  try {
    document.querySelectorAll('#vapi-support-btn, .vapi-btn, .vapi-btn-round').forEach((el) => el.remove());
  } catch (e) {}

  document.getElementById('inapp-story-live')?.classList.add('hidden');
  document.getElementById('inapp-story-summary')?.classList.add('hidden');
  document.getElementById('inapp-story-lobby')?.classList.remove('hidden');

  const btn = document.getElementById('btn-inapp-start-story');
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = `<span class="text-3xl">🎙️</span><span>เริ่มเล่าเรื่องกับครูสวนเลย</span><span class="material-symbols-outlined text-2xl">arrow_forward</span>`;
  }
}
