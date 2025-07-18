// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyAKhybAig1k_CCL8wMYThaI1Mw9ixrwkbI",
  authDomain: "taptaka-bd.firebaseapp.com",
  projectId: "taptaka-bd",
  storageBucket: "taptaka-bd.appspot.com",
  messagingSenderId: "587795392431",
  appId: "1:587795392431:web:9b9bc9a3a8d567e9b9f15a",
  measurementId: "G-B7G6TNQ30D"
};

// --- App Constants & Global Variables ---
const NEW_USER_REFERRAL_BONUS = 100;
const REFERRER_BONUS = 50;
const DAILY_BONUS_AMOUNT = 50, DAILY_CHECKIN_AMOUNT = 25;
const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000, MIN_USERNAME_LENGTH = 3;
const spinSegments = [
    { value: 10, label: "10" }, 
    { value: 50, label: "50" },
    { value: 100, label: "100" }, 
    { value: 0, label: "TRY AGAIN" },
    { value: 50, label: "BONUS" },
    { value: 20, label: "20" },
    { value: 200, label: "JACKPOT!" },
    { value: 100, label: "100" }
];
const segmentColors = ["#E53935", "#1E88E5", "#43A047", "#5E35B1", "#00ACC1", "#FDD835", "#D81B60", "#FB8C00"];
const NUM_SPIN_SEGMENTS = spinSegments.length;
let isSpinning = false;
let currentRotation = 0;
let app, auth, db, storage, currentUser = null;
let userRef, userDataListener, tasksRef, tasksListener, mainTasksRef, mainTasksListener, appConfigRef, appConfigListener, historyRef, historyListener, notificationsRef, notificationsListener, globalSupportRef, globalSupportListener, globalChatRef, fakePayoutsInterval = null;
let userCoins = 0, userReferralCode = null, userLastEarnedTimestamps = {}, hasEnteredReferral = false;
let userLastDailyBonusClaim = 0, userLastSpinClaim = 0, userLastDailyCheckinClaim = 0;
let userCreatedAt = 0, userUsername = null, userAvatarUrl = null, appLogoUrl = 'https://i.ibb.co/p3wH2XG/logo.png';
let appConfigData = {}, activeTasksData = {}, mainTasksData = {};
const taskTimers = {}; let bonusTimerInterval = null, spinTimerInterval = null, checkinTimerInterval = null, clockInterval = null;
let unreadNotificationCount = 0, lastKnownUnreadCount = 0;
let initialDataLoaded = false;
let previousTicketState = {};
let previousWithdrawalState = {};
let spinReadyNotified = false;
let appLoadStartTime = Date.now();
let activeMessageOptionsMenu = null;
let chatListeners = {};
let replyingToMessage = null;
const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];
const neonGlowElements = [
    '.action-card', '.form-group input', '.form-group select', '.form-group textarea',
    '.btn-primary', '.btn-login', '.earn-btn', '.wallet-action-btn',
    '.history-item', '.task-card', '.referral-link-box', '.enter-referral-code-section',
    '.settings-card', '.support-ticket', '.content-page'
];

function formatBalance(num) {
    if (typeof num !== 'number' || isNaN(num)) return '0';
    if (num < 1000) return num.toString();
    const suffixes = ["", "K", "M", "B", "T"];
    const tier = Math.floor(Math.log10(Math.abs(num)) / 3);
    if(tier === 0) return num.toString();
    const suffix = suffixes[tier];
    const scale = Math.pow(10, tier * 3);
    const scaled = num / scale;
    const formatted = scaled.toFixed(1);
    return formatted.endsWith('.0') ? formatted.slice(0, -2) + suffix : formatted + suffix;
}

function clearAllTimers() {
    Object.keys(taskTimers).forEach(key => clearInterval(taskTimers[key]));
    if(bonusTimerInterval) clearInterval(bonusTimerInterval); bonusTimerInterval = null;
    if(spinTimerInterval) clearInterval(spinTimerInterval); spinTimerInterval = null;
    if(checkinTimerInterval) clearInterval(checkinTimerInterval); checkinTimerInterval = null;
    if(clockInterval) clearInterval(clockInterval); clockInterval = null;
    if(fakePayoutsInterval) clearInterval(fakePayoutsInterval); fakePayoutsInterval = null;
}

try {
    if (typeof firebase !== 'undefined' && firebaseConfig.apiKey && firebaseConfig.projectId) {
        app = firebase.initializeApp(firebaseConfig);
        auth = firebase.auth(); 
        db = firebase.database(); 
        storage = firebase.storage();
    } else { throw new Error("Firebase config missing or SDK not loaded."); }
} catch(e) {
    console.error("Firebase init error:", e);
    document.body.innerHTML = `<div style="color: red; padding: 20px; text-align:center;">Critical Error. Check console.<br>${e.message}</div>`;
}

// DOM Element Caching
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loadingOverlay = document.getElementById('loading-overlay');
const loginFormEl = document.getElementById('login-form'), signupFormEl = document.getElementById('signup-form'), forgotPasswordFormEl = document.getElementById('forgot-password-form');
const coinBalanceElement = document.getElementById('coin-balance'), withdrawCoinBalanceElement = document.getElementById('withdraw-coin-balance');
const authMessageGlobal = document.getElementById('auth-message-global');
const currentYearElement = document.getElementById('currentYear');
const bannerImageElement = document.getElementById('bannerImage');
const tasksListElement = document.getElementById('tasks-list'), mainTasksListElement = document.getElementById('tasks-list-main');
const historyListElement = document.getElementById('history-list');
const referralLinkDisplay = document.getElementById('referralLinkDisplay');
const appLogoElement = document.getElementById('appLogo');
const withdrawInfoElement = document.getElementById('withdraw-info');
const enterReferralSection = document.getElementById('enterReferralSection');
const dailyBonusBtn = document.getElementById('dailyBonusBtn'), dailyBonusTimer = document.getElementById('dailyBonusTimer');
const dailyCheckinBtn = document.getElementById('dailyCheckinBtn'), dailyCheckinTimer = document.getElementById('dailyCheckinTimer');
const spinWheelCanvas = document.getElementById('spinWheelCanvas'), spinButton = document.getElementById('spin-btn');
const dailySpinResult = document.getElementById('dailySpinResult'), dailySpinTimer = document.getElementById('dailySpinTimer');
const withdrawAmountInput = document.getElementById('withdrawAmount'), estimatedCurrencyAmountSpan = document.getElementById('estimatedCurrencyAmount');
const welcomeMessageContainer = document.getElementById('welcomeMessageContainer'), welcomeMessageElement = document.getElementById('welcomeMessage');
const settingsUserEmail = document.getElementById('settingsUserEmail'), settingsUserId = document.getElementById('settingsUserId'), settingsUsernameText = document.getElementById('settingsUsername-text');
const submitWithdrawalBtn = document.getElementById('submitWithdrawalBtn');
const notificationButton = document.getElementById('notificationButton'), notificationBadge = document.getElementById('notificationBadge');
const notificationHistoryListEl = document.getElementById('notification-history-list');
const supportTicketsListEl = document.getElementById('support-tickets-list');
const leaderboardListEl = document.getElementById('leaderboard-list');
const globalChatPage = document.getElementById('page-global-chat');

function showToast(message, type = 'success', duration = 4000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let iconClass = 'fa-info-circle';
    if (type === 'success') iconClass = 'fa-check-circle';
    if (type === 'error') iconClass = 'fa-times-circle';
    toast.innerHTML = `<i class="fas ${iconClass}"></i> ${message}`;
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        toast.addEventListener('transitionend', () => toast.remove());
    }, duration);
}

function showMessage(elementId, message, type) { const el = document.getElementById(elementId); if(el) { el.textContent = message; el.className = `message-area ${type}`; el.style.display = 'block'; } }
function clearMessage(id) { const el = document.getElementById(id); if(el) { el.textContent = ''; el.style.display = 'none'; el.className = 'message-area'; } }

function showAuthForm(name) {
    clearMessage('login-message'); clearMessage('signup-message'); clearMessage('forgot-password-message');
    loginFormEl.style.display = name === 'login' ? 'block' : 'none';
    signupFormEl.style.display = name === 'signup' ? 'block' : 'none';
    forgotPasswordFormEl.style.display = name === 'forgot' ? 'block' : 'none';
    authContainer.style.display = 'flex'; appContainer.style.display = 'none';
    authMessageGlobal.style.display = 'none';
    const storedRefCode = sessionStorage.getItem('referralCode');
    const refCodeInput = document.getElementById('signup-referral-code');
    if (name === 'signup' && storedRefCode && refCodeInput) {
        refCodeInput.value = storedRefCode;
    }
}
function formatTimeRemaining(ms) { if (ms <= 0) return "Ready!"; const s = Math.ceil(ms/1000), h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60; return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}:${sec.toString().padStart(2,'0')}`; }
function togglePasswordVisibility(id, icon) { const i = document.getElementById(id); if(!i||!icon) return; i.type = i.type==='password'?'text':'password'; icon.classList.toggle('fa-eye'); icon.classList.toggle('fa-eye-slash'); }

function showLoadingOverlay() { if(loadingOverlay) loadingOverlay.classList.remove('hidden'); }
function hideLoadingOverlay() {
    const elapsedTime = Date.now() - appLoadStartTime;
    const timeToWait = Math.max(0, 1500 - elapsedTime);
    setTimeout(() => { if (loadingOverlay) loadingOverlay.classList.add('hidden'); }, timeToWait);
}

function requestNotificationPermission() { if (!("Notification" in window)) console.log("This browser does not support desktop notification"); else if (Notification.permission === "default") Notification.requestPermission().then(p => { if (p === "granted") showSystemNotification("Notifications Enabled!", "You will now receive important updates."); }); }
function showSystemNotification(title, body) { if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body: body, icon: appLogoUrl }); }

auth.onAuthStateChanged(user => {
    detachAllListeners();
    clearAllTimers();
    if (user) { currentUser = user; checkUserStatusAndProceed(currentUser); }
    else { currentUser = null; resetAppStateForLogout(); }
});

function resetAppStateForLogout() {
     if(clockInterval) clearInterval(clockInterval); clockInterval = null;
     if(welcomeMessageContainer) welcomeMessageContainer.innerHTML = `<h3 id="welcomeMessage" style="display: none; font-weight: 500;"></h3>`;
     initialDataLoaded = false; userCoins = 0; userReferralCode = null; userLastEarnedTimestamps = {};
     hasEnteredReferral = false; userLastDailyBonusClaim = 0; userLastSpinClaim = 0; userLastDailyCheckinClaim = 0; spinReadyNotified = true;
     userCreatedAt = 0; userUsername = null; userAvatarUrl = null; activeTasksData = {}; appConfigData = {}; mainTasksData = {};
     unreadNotificationCount = 0; lastKnownUnreadCount = 0; updateNotificationBadge();
     previousWithdrawalState = {}; previousTicketState = {};
     authContainer.style.display = 'flex'; appContainer.style.display = 'none';
     globalChatPage.classList.remove('show');
     if(authMessageGlobal) { authMessageGlobal.textContent = ''; authMessageGlobal.style.display = 'none'; }
     coinBalanceElement.textContent = '0'; withdrawCoinBalanceElement.textContent = '0';
     tasksListElement.innerHTML = ''; mainTasksListElement.innerHTML = ''; historyListElement.innerHTML = '';
     ['settingsUsername-text', 'settingsUserEmail', 'settingsUserId'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = 'Loading...'; });
     history.replaceState(null, '', window.location.pathname);
     showAuthForm('login');
     hideLoadingOverlay();
}

// MODIFIED: This function now patiently waits for user data to appear after sign-up, fixing the race condition.
function checkUserStatusAndProceed(user) {
    if (!db || !user) {
        hideLoadingOverlay();
        return;
    }

    const userStatusRef = db.ref(`users/${user.uid}`);
    let listener = null;
    let timeoutId = null;

    const cleanup = () => {
        if (listener) {
            userStatusRef.off('value', listener);
            listener = null;
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    };

    listener = userStatusRef.on('value', snapshot => {
        const userData = snapshot.val();

        // If data exists, we can proceed.
        if (userData) {
            cleanup(); // Stop listening and clear timeout.

            if (userData.isBlocked || userData.isBanned) {
                showToast(userData.isBanned ? "Account banned." : "Account blocked.", 'error');
                auth.signOut();
            } else {
                // The main, long-term listener for user data.
                setupUserDataListener(user.uid);
                // Listeners for other parts of the app.
                setupAppConfigListener();
                setupGlobalSupportListener(user.uid);
            }
        }
        // If userData is null, we do nothing and just wait. 
        // The listener will fire again when the data is created.
    }, error => {
        cleanup();
        showToast("Error checking account status.", 'error');
        auth.signOut();
    });

    // Add a timeout to prevent an infinite wait if the database write fails for some reason.
    timeoutId = setTimeout(() => {
        // This code runs only if the listener did not find data within 5 seconds.
        if (listener) { // Check if we are still listening
            cleanup();
            showToast("Account creation failed. Please try again.", 'error');
            auth.signOut();
        }
    }, 5000); // 5-second timeout.
}

async function createUserInDatabase(user, username, referredByCode = null) {
    const rc = generateReferralCode(user.uid);
    // 1. Prepare the initial user data with default values.
    const initialUserData = {
        email: user.email,
        username: username,
        avatarUrl: user.photoURL || null,
        coins: 0,
        totalEarnings: 0,
        isAdmin: false, isBlocked: false, isBanned: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP,
        lastEarnedTimestamps: {},
        referralCode: rc,
        hasEnteredReferralCode: false, // Default to false, will be updated on successful referral
        referredBy: null,
        lastDailyBonusClaim: 0, lastSpinClaim: 0, lastDailyCheckinClaim: 0,
        provider: user.providerData[0].providerId
    };

    // 2. Immediately create the user's record in the database.
    // This solves the "Account data missing" race condition.
    await db.ref('users/' + user.uid).set(initialUserData);

    // 3. If a referral code was provided, process it.
    if (referredByCode) {
        const referrerSnapshot = await db.ref('users').orderByChild('referralCode').equalTo(referredByCode).once('value');
        if (referrerSnapshot.exists()) {
            let referrerUid;
            referrerSnapshot.forEach(child => { referrerUid = child.key; });

            // A valid referrer was found. Now update both the new user and the referrer.
            if (referrerUid) {
                // Update the referrer's account with their bonus.
                await db.ref(`users/${referrerUid}`).update({
                    coins: firebase.database.ServerValue.increment(REFERRER_BONUS),
                    totalEarnings: firebase.database.ServerValue.increment(REFERRER_BONUS),
                    [`referrals/list/${user.uid}`]: firebase.database.ServerValue.TIMESTAMP
                });
                addNotificationForUser(referrerUid, 'New Referral!', `${username} used your code. You earned +${REFERRER_BONUS} coins!`, 'reward');

                // Update the new user's account with their bonus and referral info.
                await db.ref('users/' + user.uid).update({
                    coins: NEW_USER_REFERRAL_BONUS,
                    totalEarnings: NEW_USER_REFERRAL_BONUS,
                    referredBy: referrerUid,
                    hasEnteredReferralCode: true // Set to true only on success.
                });
            }
        }
    }

    // 4. Send a welcome notification to the new user.
    addNotificationForUser(user.uid, 'Welcome to TapTak!', `You successfully created your account. Start earning!`, 'welcome');
}


function addNotification(title, message, type = 'info') { if (!currentUser || !db) return; addNotificationForUser(currentUser.uid, title, message, type); }
function addNotificationForUser(userId, title, message, type = 'info') {
    if (!db || !userId) return;
    let iconClass = 'fa-info-circle', notifType = type;
    switch(type) {
        case 'success': iconClass = 'fa-check-circle'; break; case 'reward': iconClass = 'fa-star'; break;
        case 'alert': iconClass = 'fa-exclamation-triangle'; break; case 'message': iconClass = 'fa-envelope'; break;
        case 'cancelled': iconClass = 'fa-times-circle'; notifType = 'alert'; break; case 'rejected': iconClass = 'fa-ban'; notifType = 'rejected'; break;
        case 'welcome': iconClass = 'fa-hands-helping'; notifType = 'success'; break;
    }
    const newNotification = { title, message, type: notifType, icon: iconClass, timestamp: firebase.database.ServerValue.TIMESTAMP, read: false };
    db.ref(`users/${userId}/notifications`).push(newNotification);
    if (document.hidden) showSystemNotification(title, message);
}

function setupNotificationListener(userId) {
    if (!db || !userId) return; detachNotificationListener();
    notificationsRef = db.ref(`users/${userId}/notifications`).orderByChild('timestamp').limitToLast(50);
    notificationsListener = notificationsRef.on('value', snapshot => {
        unreadNotificationCount = 0; snapshot.forEach(child => { if(child.val().read === false) unreadNotificationCount++; });
        if (initialDataLoaded && unreadNotificationCount > lastKnownUnreadCount) document.getElementById('notificationSound')?.play().catch(()=>{});
        lastKnownUnreadCount = unreadNotificationCount;
        updateNotificationBadge();
        if (document.getElementById('page-notification-history').classList.contains('active-page')) loadNotificationHistory();
    });
}
function detachNotificationListener() { if (notificationsRef && notificationsListener) { notificationsRef.off('value', notificationsListener); notificationsRef = null; notificationsListener = null; } }

function updateNotificationBadge() { if (!notificationBadge) return; notificationBadge.style.display = unreadNotificationCount > 0 ? 'flex' : 'none'; notificationBadge.textContent = unreadNotificationCount > 9 ? '9+' : unreadNotificationCount; }
function renderNotifications(notifications = [], targetElement) {
    if (!targetElement) return; targetElement.innerHTML = ''; if (notifications.length === 0) { targetElement.innerHTML = `<div class="empty-state">No notification history.</div>`; return; }
    notifications.forEach(notif => { const item = document.createElement('div'); item.className = `notification-item ${!notif.read ? 'unread' : ''}`; item.dataset.id = notif.id; const date = notif.timestamp ? new Date(notif.timestamp).toLocaleString() : ''; item.innerHTML = `<button class="notification-delete-btn"><i class="fas fa-trash-alt"></i></button><div class="notification-icon type-${notif.type || 'info'}"><i class="fas ${notif.icon || 'fa-info-circle'}"></i></div><div class="notification-content"><p class="notification-title">${notif.title}</p><p class="notification-message">${notif.message}</p>${date ? `<p class="notification-timestamp">${date}</p>` : ''}</div>`; targetElement.appendChild(item); });
}
function deleteNotification(notificationId, element) {
    if (!currentUser || !db) return;
    if (element) { element.style.transition = 'opacity 0.3s, transform 0.3s, margin-bottom 0.3s, padding-top 0.3s, padding-bottom 0.3s, height 0.3s'; element.style.opacity = '0'; element.style.transform = 'scale(0.95)'; element.style.marginBottom = '0px'; element.style.paddingTop = '0px'; element.style.paddingBottom = '0px'; element.style.height = '0px'; setTimeout(() => element.remove(), 300); }
    db.ref(`users/${currentUser.uid}/notifications/${notificationId}`).remove().catch(e => showToast("Sync Error.", "error"));
}

function loadNotificationHistory() {
     if (!db || !currentUser || !notificationHistoryListEl) return; notificationHistoryListEl.innerHTML = '<div class="loading-indicator">Loading history...</div>';
     db.ref(`users/${currentUser.uid}/notifications`).orderByChild('timestamp').once('value').then(s => { const d = s.val()||{}; const n=Object.keys(d).map(k=>({id:k,...d[k]})).sort((a,b)=>b.timestamp-a.timestamp); renderNotifications(n,notificationHistoryListEl); markAllNotificationsAsRead(); }).catch(() => { notificationHistoryListEl.innerHTML = `<div class="error-message">Could not load.</div>`; showToast('Failed to load notifications.', 'error'); });
}
function markAllNotificationsAsRead() { if (!db || !currentUser || unreadNotificationCount === 0) return; const u = {}; db.ref(`users/${currentUser.uid}/notifications`).orderByChild('read').equalTo(false).once('value', s => { s.forEach(c => { u[c.key + '/read'] = true; }); if (Object.keys(u).length > 0) db.ref(`users/${currentUser.uid}/notifications`).update(u); }); }
function detachAllListeners() { detachUserDataListener(); detachTasksListener(); detachMainTasksListener(); detachAppConfigListener(); detachHistoryListener(); detachNotificationListener(); detachGlobalSupportListener(); detachGlobalChatListener(); }

function setupUserDataListener(userId) {
    if (!db || !userId) return; detachUserDataListener();
    userRef = db.ref('users/' + userId);
    userDataListener = userRef.on('value', s => {
        const d = s.val(); if (d) {
            userCoins = d.coins ?? 0; userReferralCode = d.referralCode ?? null; userLastEarnedTimestamps = d.lastEarnedTimestamps ?? {}; hasEnteredReferral = d.hasEnteredReferralCode ?? false;
            userLastDailyBonusClaim = d.lastDailyBonusClaim ?? 0; userLastDailyCheckinClaim = d.lastDailyCheckinClaim ?? 0; userLastSpinClaim = d.lastSpinClaim ?? 0;
            userCreatedAt = d.createdAt ?? 0; userUsername = d.username ?? (currentUser.displayName || 'Anonymous'); userAvatarUrl = d.avatarUrl || null;
            
            coinBalanceElement.textContent = formatBalance(userCoins); withdrawCoinBalanceElement.textContent = userCoins.toLocaleString();
            document.getElementById('wallet-page-balance').textContent = formatBalance(userCoins); document.getElementById('wallet-page-username').textContent = userUsername || 'TAPTAK USER';
            
            if (!initialDataLoaded) initializeHomePageDisplay();

            if (referralLinkDisplay) referralLinkDisplay.textContent = userReferralCode ? `${window.location.origin}${window.location.pathname}?ref=${userReferralCode}` : 'Generating...';
            settingsUserEmail.textContent = currentUser?.email || 'N/A'; settingsUserId.textContent = currentUser?.uid || 'N/A'; settingsUsernameText.textContent = userUsername || 'Not Set';
            document.getElementById('referral-count').textContent = d.referrals?.list ? Object.keys(d.referrals.list).length : 0; document.getElementById('referral-bonus').textContent = Object.values(d.referrals?.list || {}).length * REFERRER_BONUS;

            updateReferralSectionVisibility(); updateDailyBonusButtonState(); updateDailyCheckinButtonState(); updateDailySpinButtonState(); calculateEstimatedCurrency();

            if (!initialDataLoaded) {
                authContainer.style.display = 'none'; appContainer.style.display = 'flex';
                setupNotificationListener(userId);
                const initialPage = window.location.hash.substring(1) || 'page-home'; showPage(initialPage);
                initialDataLoaded = true;
                hideLoadingOverlay();
            }
        } else { if (auth.currentUser?.uid === userId) auth.signOut(); }
    }, e => { showToast(`Data load error. Please reload.`, 'error'); auth.signOut(); });
}
function detachUserDataListener() { if (userRef && userDataListener) { userRef.off('value', userDataListener); userRef = null; userDataListener = null; } }

function initializeHomePageDisplay() {
    if (!welcomeMessageContainer) return; let welcomeEl = document.getElementById('welcomeMessage'); if (welcomeEl) { welcomeEl.textContent = `Welcome, ${userUsername}!`; welcomeEl.style.display = 'block'; }
    setTimeout(() => { if(welcomeEl) welcomeEl.style.display = 'none'; if (!document.getElementById('live-clock')) { const clockEl = document.createElement('div'); clockEl.id = 'live-clock'; clockEl.className = 'live-clock'; welcomeMessageContainer.appendChild(clockEl); updateClock(); if(clockInterval) clearInterval(clockInterval); clockInterval = setInterval(updateClock, 1000); } }, 5000);
}
function updateClock() { const clockEl = document.getElementById('live-clock'); if (!clockEl) { if(clockInterval) clearInterval(clockInterval); return; } const n = new Date(), h = n.getHours().toString().padStart(2,'0'), m = n.getMinutes().toString().padStart(2,'0'), s = n.getSeconds().toString().padStart(2,'0'); clockEl.innerHTML = `<span class="clock-segment">${h}</span><span class="clock-separator">:</span><span class="clock-segment">${m}</span><span class="clock-separator">:</span><span class="clock-segment">${s}</span>`; }

function loadTasks() { if (!db || !currentUser) return; detachTasksListener(); tasksRef = db.ref('tasks').orderByChild('active').equalTo(true); tasksListElement.innerHTML = '<div class="loading-indicator">Loading tasks...</div>'; tasksListener = tasksRef.on('value', s => { activeTasksData = s.val() || {}; tasksListElement.innerHTML = ''; if (Object.keys(activeTasksData).length === 0) { tasksListElement.innerHTML = '<p style="text-align:center;">No tasks available.</p>'; return; } Object.keys(activeTasksData).forEach(id => { tasksListElement.appendChild(createTaskCardElement(id, activeTasksData[id])); manageTaskCooldown(id, activeTasksData[id]); }); }, e => { tasksListElement.innerHTML = '<div class="error-message">Error loading tasks.</div>'; }); }
function detachTasksListener() { if (tasksRef && tasksListener) { tasksRef.off('value', tasksListener); tasksRef = null; tasksListener = null; } }

function setupAppConfigListener() { if (!db) return; detachAppConfigListener(); appConfigRef = db.ref('appConfig'); appConfigListener = appConfigRef.on('value', s => { appConfigData = { ...appConfigData, ...s.val() }; appLogoUrl = appConfigData.appLogoUrl || 'https://i.ibb.co/p3wH2XG/logo.png'; bannerImageElement.src = appConfigData.bannerImageUrl || 'https://i.ibb.co/hR2Y33n/banner.jpg'; appLogoElement.src = appLogoUrl; if (withdrawInfoElement) { const min = appConfigData.minWithdrawalAmount || 1000, rate = appConfigData.tokenToCurrencyRate || 1000, sym = appConfigData.currencySymbol || 'BDT'; withdrawInfoElement.textContent = `Minimum: ${min.toLocaleString()} Coins. (${rate.toLocaleString()} Coins ≈ 1 ${sym})`; calculateEstimatedCurrency(); document.getElementById('minWithdrawalInstruction').textContent = min.toLocaleString(); } }, e => console.error("AppConfig err:", e)); }
function detachAppConfigListener() { if (appConfigRef && appConfigListener) { appConfigRef.off('value', appConfigListener); appConfigRef = null; appConfigListener = null; } }

function handleWithdrawalRejection(wdData) { if (!wdData || !wdData.userId || wdData.userId !== currentUser.uid) return; const amount = wdData.amount; if (!amount || amount <= 0) return; db.ref(`users/${currentUser.uid}/coins`).set(firebase.database.ServerValue.increment(amount)).then(() => { showToast(`${amount.toLocaleString()} coins refunded.`, 'error'); addNotification('Withdrawal Rejected', `Request for ${amount.toLocaleString()} coins rejected. Coins refunded.`, 'rejected'); }).catch(() => showToast('Critical error refunding coins.', 'error')); }
function loadHistory() { if (!db || !currentUser) return; detachHistoryListener(); historyRef = db.ref('withdrawals').orderByChild('userId').equalTo(currentUser.uid); historyListElement.innerHTML = '<div class="loading-indicator">Loading history...</div>'; historyListener = historyRef.on('value', s => { const newWds = s.val() || {}; if (initialDataLoaded && Object.keys(previousWithdrawalState).length > 0) Object.keys(newWds).forEach(id => { const cur = newWds[id], prev = previousWithdrawalState[id]; if (prev && prev.status === 'pending') { if (cur.status === 'rejected') handleWithdrawalRejection(cur); else if (cur.status === 'approved') { showToast(`Withdrawal of ${cur.amount.toLocaleString()} coins approved!`, 'success'); addNotification('Withdrawal Approved!', `Request for ${cur.amount.toLocaleString()} coins approved.`, 'success'); } } }); previousWithdrawalState = newWds; historyListElement.innerHTML = ''; if (Object.keys(newWds).length === 0) { historyListElement.innerHTML = '<p style="text-align: center;">No withdrawal history.</p>'; return; } const sortedKeys = Object.keys(newWds).sort((a, b) => (newWds[b].requestTimestamp || 0) - (newWds[a].requestTimestamp || 0)); sortedKeys.forEach(k => historyListElement.appendChild(createHistoryItemElement(k, newWds[k]))); }, e => { historyListElement.innerHTML = `<div class="error-message">Error loading history.</div>`; }); }
function detachHistoryListener() { if (historyRef && historyListener) { historyRef.off('value', historyListener); historyRef = null; historyListener = null; previousWithdrawalState = {}; } }

// MODIFIED: Generates fake payouts for demonstration purposes
function loadLivePayouts() {
    const container = document.getElementById('live-payouts-ticker-container');
    if (!container) return;
    if (fakePayoutsInterval) clearInterval(fakePayoutsInterval);
    
    const names = ["Rahim", "Karim", "Sabbir", "Mithun", "Ayesha", "Fatema", "Nusrat", "Jannat", "Rohan", "Fahim"];
    const amounts = [5000, 10000, 7500, 12000, 20000, 8000];
    
    let payouts = [];
    for(let i = 0; i < 15; i++) {
        payouts.push({
            username: names[Math.floor(Math.random() * names.length)],
            amount: amounts[Math.floor(Math.random() * amounts.length)]
        });
    }

    function renderPayouts() {
        const tickerWrap = document.createElement('div');
        tickerWrap.className = 'payout-ticker-wrap';
        let payoutHtml = '';
        payouts.forEach(payout => {
            payoutHtml += `<div class="payout-item"><span class="username">${payout.username}</span><span class="amount"><i class="fas fa-check-circle"></i> ${payout.amount.toLocaleString()} Coins</span></div>`;
        });
        tickerWrap.innerHTML = payoutHtml + payoutHtml; 
        container.innerHTML = '';
        container.appendChild(tickerWrap);
    }

    renderPayouts();

    fakePayoutsInterval = setInterval(() => {
        payouts.shift();
        payouts.push({
            username: names[Math.floor(Math.random() * names.length)],
            amount: amounts[Math.floor(Math.random() * amounts.length)]
        });
        renderPayouts();
    }, 4000); // Add a new payout every 4 seconds
}


function manageTaskCooldown(taskId, taskData) { const btn = document.getElementById(`visit-btn-${taskId}`); const actionArea = btn?.parentElement; if (!btn || !actionArea) return; let timerDisplay = document.getElementById(`timer-task-${taskId}`); if (!timerDisplay) { timerDisplay = document.createElement('div'); timerDisplay.id = `timer-task-${taskId}`; timerDisplay.className = 'timer-display'; actionArea.prepend(timerDisplay); } if (taskTimers[taskId]) clearInterval(taskTimers[taskId]); const check = () => { const last = userLastEarnedTimestamps[taskId] || 0; const cooldown = (taskData.cooldownMinutes || 1440) * 60 * 1000; const rem = cooldown - (Date.now() - last); if (rem > 0) { btn.style.display = 'none'; timerDisplay.style.display = 'block'; timerDisplay.textContent = formatTimeRemaining(rem); if (!taskTimers[taskId]) taskTimers[taskId] = setInterval(check, 1000); } else { btn.style.display = 'inline-block'; timerDisplay.style.display = 'none'; btn.disabled = false; btn.textContent = 'Visit Link'; if (taskTimers[taskId]) { clearInterval(taskTimers[taskId]); delete taskTimers[taskId]; } } }; check(); }
function createTaskCardElement(taskId, task) { const card = document.createElement('div'); card.className = 'task-card'; card.id = `task-${taskId}`; card.innerHTML = `<div class="task-card-header"><div class="task-card-icon"><i class="fas fa-mouse-pointer"></i></div><div class="task-info"><div class="task-title">${task.title||'N/A'}</div><div class="task-description">${task.description||''}</div></div></div><div class="task-card-footer"><div class="task-reward">Reward: ${task.reward||0} Coins</div><div class="task-action" id="action-area-${taskId}"><button class="earn-btn" id="visit-btn-${taskId}" onclick="startVisitTask('${taskId}', '${task.linkUrl}')">Visit Link</button></div></div>`; return card; }
function createHistoryItemElement(withdrawalId, item) { const div = document.createElement('div'); const sClass = `status-${(item.status||'unknown').replace(/\s+/g,'-').toLowerCase()}`; div.className = `history-item`; const rD = item.requestTimestamp ? new Date(item.requestTimestamp).toLocaleString() : 'N/A'; const cBtn = item.status==='pending' ? `<button class="earn-btn" style="background-color:#ffc107;color:#333;margin-top:10px;padding:5px 10px;font-size:0.85em;" onclick="cancelWithdrawalRequest('${withdrawalId}')">Cancel</button>`:''; div.innerHTML=`<div class="history-item-row"><span class="history-item-label">Amount:</span><span class="history-item-value">${(item.amount||0).toLocaleString()} Coins</span></div><div class="history-item-row"><span class="history-item-label">Method:</span><span class="history-item-value">${item.method||'N/A'}</span></div><div class="history-item-row"><span class="history-item-label">Status:</span><span class="history-item-status ${sClass}">${item.status||'Unknown'}</span></div><div class="history-item-details"><strong>Details:</strong> ${item.accountDetails||'N/A'}</div><div class="timestamp">Requested: ${rD}</div>${cBtn}`; return div; }

async function signupUser() {
    clearMessage('signup-message'); if (!auth || !db) return;
    const uIn = document.getElementById('signup-username'), eIn = document.getElementById('signup-email'), pIn = document.getElementById('signup-password');
    const u = uIn.value.trim(), e = eIn.value.trim(), p = pIn.value;
    const refCode = document.getElementById('signup-referral-code').value.trim().toUpperCase();
    if (!u || u.length < MIN_USERNAME_LENGTH) { showMessage('signup-message', `Username min ${MIN_USERNAME_LENGTH} chars.`, 'error'); return; }
    if (!e || p.length < 6) { showMessage('signup-message', "Valid email & password (min 6 chars) required.", 'error'); return; }
    try {
        showMessage('signup-message', 'Creating account...', 'info');
        const cred = await auth.createUserWithEmailAndPassword(e, p);
        const user = cred.user;
        await user.updateProfile({ displayName: u });
        await createUserInDatabase(user, u, refCode || sessionStorage.getItem('referralCode')); 
        showToast('Signup successful! Welcome.', 'success');
    } catch (err) {
        let m = err.code === 'auth/email-already-in-use' ? "Email already registered." : err.code === 'auth/invalid-email' ? "Invalid email." : err.code === 'auth/weak-password' ? "Password is too weak." : err.message;
        showMessage('signup-message', m, 'error');
    }
}

async function signInWithGoogle() {
    if (!auth || !db) return; const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        if (result.additionalUserInfo.isNewUser) {
            const user = result.user;
            const displayName = user.displayName || user.email.split('@')[0];
            await createUserInDatabase(user, displayName, sessionStorage.getItem('referralCode'));
            showToast('Account created successfully!', 'success');
        } else { showToast('Welcome back!', 'success'); }
    } catch(err) {
        let m = err.code === 'auth/popup-closed-by-user' ? "Sign-in cancelled." : err.code === 'auth/account-exists-with-different-credential' ? "Account exists. Sign in with password." : `Google Sign-In failed.`;
        showToast(m, 'error');
    }
}

function loginUser() { clearMessage('login-message'); if (!auth) return; const e = document.getElementById('login-email').value.trim(), p = document.getElementById('login-password').value; if (!e || !p) { showMessage('login-message', "Enter email and password.", 'error'); return; } auth.signInWithEmailAndPassword(e,p).then(()=>showToast('Login successful!', 'success')).catch(err=>{let m=['auth/user-not-found','auth/wrong-password','auth/invalid-credential'].includes(err.code) ? "Incorrect email or password." : "Login failed."; showMessage('login-message', m, 'error');}); }
function logoutUser() { if(auth?.currentUser) auth.signOut().then(() => showToast('Logged out', 'info')); }
function sendPasswordReset() { clearMessage('forgot-password-message'); if (!auth) return; const e = document.getElementById('forgot-email').value; if (!e) { showMessage('forgot-password-message', "Enter your email.", 'error'); return; } auth.sendPasswordResetEmail(e).then(() => { showMessage('forgot-password-message', "Reset email sent!", 'success'); document.getElementById('forgot-email').value = ''; }).catch(err => { showMessage('forgot-password-message', 'Error sending email.', 'error'); }); }

function showPage(pageId, isPopState = false) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    globalChatPage.classList.remove('show');
    if (pageId === 'page-global-chat') { globalChatPage.classList.add('show'); if (!isPopState) history.pushState({page: pageId},'', `#${pageId}`); loadGlobalChat(); cancelReply(); return; }
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active-page'); window.scrollTo(0, 0);
        if (!isPopState && `#${pageId}` !== window.location.hash) history.pushState({page: pageId},'',`#${pageId}`);
        if (pageId === 'page-visit-earn') loadTasks();
        else if (pageId === 'page-tasks') loadMainTasks();
        else if (pageId === 'page-history') loadHistory();
        else if (pageId === 'page-notification-history') loadNotificationHistory();
        else if (pageId === 'page-support') loadSupportHistory();
        else if (pageId === 'page-leaderboard') loadLeaderboard();
        else if (pageId === 'page-wallet') loadLivePayouts();
    } else showPage('page-home', isPopState);
    closeMenu();
}

window.onpopstate = e => showPage(e.state ? e.state.page : (auth.currentUser ? 'page-home' : 'login'), true);
const menuDropdown = document.getElementById('dropdownMenu');
function toggleMenu(e) { e.stopPropagation(); menuDropdown?.classList.toggle('open'); }
function closeMenu() { menuDropdown?.classList.remove('open'); }
document.addEventListener('click', e => { if (menuDropdown?.classList.contains('open') && !menuDropdown.contains(e.target) && e.target !== document.getElementById('menuIcon')) closeMenu(); });

function startVisitTask(taskId, url) { const btn = document.getElementById(`visit-btn-${taskId}`); if (!btn || btn.disabled) return; btn.disabled = true; btn.textContent = 'Processing...'; window.open(url, '_blank'); showToast('Task started! Reward coming soon.', 'info'); setTimeout(() => { claimVisitTaskReward(taskId); }, 4000); }
function claimVisitTaskReward(taskId) { if (!currentUser || !db || !activeTasksData[taskId]) return; const task = activeTasksData[taskId], reward = task.reward || 0; const u = { [`users/${currentUser.uid}/coins`]: firebase.database.ServerValue.increment(reward), [`users/${currentUser.uid}/totalEarnings`]: firebase.database.ServerValue.increment(reward), [`users/${currentUser.uid}/lastEarnedTimestamps/${taskId}`]: firebase.database.ServerValue.TIMESTAMP }; db.ref().update(u).then(() => { showToast(`+${reward} Coins Added!`, 'success'); addNotification('Task Complete!', `You earned +${reward} coins for "${task.title}".`, 'reward'); manageTaskCooldown(taskId, task); }).catch(() => showToast('Could not claim reward.', 'error')); }

function updateTimerAndButton(btn, timerEl, lastClaim, intervalVar, callback) { if (!btn || !timerEl) return; if (intervalVar) clearInterval(intervalVar); const update = () => { const rem = ONE_DAY_MILLIS - (Date.now() - lastClaim); if (rem > 0) { btn.disabled = true; if(callback.isSpin) dailySpinResult.textContent = 'SpinToday'; else btn.textContent = callback.claimedText; timerEl.className = 'earn-timer claimed'; timerEl.textContent = formatTimeRemaining(rem); if (!intervalVar) intervalVar = setInterval(update, 1000); } else { btn.disabled = false; btn.textContent = callback.readyText; if(callback.isSpin) dailySpinResult.textContent = ''; timerEl.className = 'earn-timer ready available'; timerEl.textContent = 'Available Now!'; if (intervalVar) { clearInterval(intervalVar); intervalVar = null; } if (callback.onReady) callback.onReady(); } }; update(); return intervalVar; }
function updateDailyBonusButtonState() { bonusTimerInterval = updateTimerAndButton(dailyBonusBtn, dailyBonusTimer, userLastDailyBonusClaim, bonusTimerInterval, { claimedText: "Claimed", readyText: "Claim Bonus" }); }
function updateDailyCheckinButtonState() { checkinTimerInterval = updateTimerAndButton(dailyCheckinBtn, dailyCheckinTimer, userLastDailyCheckinClaim, checkinTimerInterval, { claimedText: "Checked-in", readyText: "Check-in" }); }
function updateDailySpinButtonState() { spinTimerInterval = updateTimerAndButton(spinButton, dailySpinTimer, userLastSpinClaim, spinTimerInterval, { readyText: "SPIN", isSpin: true, onReady: () => { if (initialDataLoaded && !spinReadyNotified) { showSpecialPopup(); spinReadyNotified = true; } } }); }

function claimDaily(amount, lastClaimProp, successMsg, rewardTitle, btn) { if (!currentUser || !db || btn.disabled) return; if (Date.now() - (userLastEarnedTimestamps[lastClaimProp] || 0) < ONE_DAY_MILLIS) { showToast("Already claimed today.", 'error'); return; } btn.disabled = true; const u = { [`users/${currentUser.uid}/coins`]: firebase.database.ServerValue.increment(amount), [`users/${currentUser.uid}/totalEarnings`]: firebase.database.ServerValue.increment(amount), [`users/${currentUser.uid}/${lastClaimProp}`]: firebase.database.ServerValue.TIMESTAMP }; db.ref().update(u).then(() => { showToast(successMsg, 'success'); addNotification(rewardTitle, `You received +${amount} Coins.`, 'reward'); }).catch(() => { showToast('Error claiming.', 'error'); btn.disabled = false; }); }
function claimDailyBonus() { claimDaily(DAILY_BONUS_AMOUNT, 'lastDailyBonusClaim', `+${DAILY_BONUS_AMOUNT} Coins!`, 'Daily Bonus!', dailyBonusBtn); }
function claimDailyCheckin() { claimDaily(DAILY_CHECKIN_AMOUNT, 'lastDailyCheckinClaim', `+${DAILY_CHECKIN_AMOUNT} Coins!`, 'Daily Check-in!', dailyCheckinBtn); }

function drawSpinWheel() { if (!spinWheelCanvas) return; const ctx = spinWheelCanvas.getContext('2d'); const r = spinWheelCanvas.width / 2; const angle = 2*Math.PI/NUM_SPIN_SEGMENTS; ctx.clearRect(0,0,spinWheelCanvas.width,spinWheelCanvas.height); for (let i = 0; i < NUM_SPIN_SEGMENTS; i++) { const start = i * angle - Math.PI/2 - angle/2; const end = start + angle; ctx.beginPath(); ctx.moveTo(r,r); ctx.arc(r,r,r-10,start,end); ctx.closePath(); ctx.fillStyle = segmentColors[i]; ctx.fill(); ctx.save(); ctx.translate(r,r); ctx.rotate(start+angle/2); ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = 'bold 28px Arial'; ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 5; ctx.fillText(spinSegments[i].label, r*0.65, 0); ctx.restore(); } }

// MODIFIED: Shows a confirmation message after spinning
function doDailySpin() {
    if (isSpinning || spinButton.disabled) return;
    if (Date.now() - userLastSpinClaim < ONE_DAY_MILLIS) { showToast("Already spun today!", 'error'); return; }
    isSpinning = true; spinButton.disabled = true; spinButton.parentElement.classList.add('spinning'); dailySpinResult.textContent = ''; dailySpinResult.className = '';
    const winIndex = Math.floor(Math.random() * NUM_SPIN_SEGMENTS), winSegment = spinSegments[winIndex], reward = winSegment.value;
    const rotations = 360 * (Math.floor(Math.random() * 2) + 5), randomOffset = Math.random() * (360 / NUM_SPIN_SEGMENTS - 10) + 5;
    const finalRotation = rotations - (winIndex * (360 / NUM_SPIN_SEGMENTS) + randomOffset);
    currentRotation += finalRotation; spinWheelCanvas.style.transform = `rotate(${currentRotation}deg)`;
    setTimeout(() => {
        isSpinning = false; spinButton.parentElement.classList.remove('spinning');
        const resultText = reward > 0 ? `Congratulations! You have won ${reward} Coins!` : `Better luck next time.`;
        showToast(resultText, reward > 0 ? 'success' : 'info');
        dailySpinResult.innerHTML = reward > 0 ? `🎉 You won ${reward} Coins! 🎉` : `😕 ${winSegment.label} 😕`;
        dailySpinResult.classList.add(reward > 0 ? 'success' : 'fail');
        if (winSegment.label === 'JACKPOT!') triggerJackpotConfetti();
        const updates = { [`users/${currentUser.uid}/lastSpinClaim`]: firebase.database.ServerValue.TIMESTAMP };
        if (reward > 0) { updates[`users/${currentUser.uid}/coins`] = firebase.database.ServerValue.increment(reward); updates[`users/${currentUser.uid}/totalEarnings`] = firebase.database.ServerValue.increment(reward); }
        db.ref().update(updates).then(() => { addNotification(winSegment.label === 'JACKPOT!' ? '🎉 JACKPOT! 🎉' : 'Spin Wheel Win!', reward > 0 ? `You won +${reward} Coins.` : 'Try again tomorrow!', reward > 0 ? 'reward' : 'info'); updateDailySpinButtonState(); }).catch(() => { showToast('Error processing spin.', 'error'); updateDailySpinButtonState(); });
    }, 8000);
}

function triggerJackpotConfetti() { const c = document.getElementById('jackpot-confetti-container'); if (!c) return; for (let i=0;i<100;i++) { const co = document.createElement('div'); co.className='confetti'; co.style.left=`${Math.random()*100}vw`; co.style.animationDelay=`${Math.random()*2}s`; co.style.backgroundColor=`hsl(${Math.random()*360},100%,50%)`; c.appendChild(co); } setTimeout(()=>c.innerHTML='',4000); }
function displayRealDate() { const d = document.getElementById('real-date-display'); if (!d) return; const n = new Date(); const o = { weekday:'long',year:'numeric',month:'long',day:'numeric' }; d.textContent = n.toLocaleDateString('en-US', o); }
function handleWithdrawMethodChange(s) { const i = s.value === 'Other'; document.getElementById('other-account-name-group').style.display = i?'block':'none'; document.getElementById('other-account-number-group').style.display = i?'block':'none'; document.getElementById('account-details-group').style.display = i?'none':'block'; }

function requestWithdrawal() {
    if (!currentUser || !db) return; if (submitWithdrawalBtn) { submitWithdrawalBtn.disabled = true; submitWithdrawalBtn.textContent = 'Submitting...'; }
    const enableBtn = () => { if (submitWithdrawalBtn) { submitWithdrawalBtn.disabled = false; submitWithdrawalBtn.textContent = 'Submit Request'; } };
    const amount = parseInt(document.getElementById('withdrawAmount').value), method = document.getElementById('withdrawMethod').value;
    let details;
    if (method === 'Other') { const name = document.getElementById('otherAccountName').value.trim(), num = document.getElementById('otherAccountNumber').value.trim(); if (!name || !num) { showToast("Enter Account Name and Number.", 'error'); enableBtn(); return; } details = `Name: ${name}, Number/ID: ${num}`; }
    else details = document.getElementById('accountDetails').value.trim();
    const minWd = appConfigData.minWithdrawalAmount || 1000;
    if (isNaN(amount) || !method || !details || amount < minWd || amount > userCoins) { showToast("Invalid request. Check details and balance.", 'error'); enableBtn(); return; }
    const rate = appConfigData.tokenToCurrencyRate || 0, currencyAmount = rate > 0 ? (amount / rate).toFixed(2) : 0;
    const wdData = { userId: currentUser.uid, userEmail: currentUser.email, username: userUsername, amount, method, accountDetails: details, status: "pending", requestTimestamp: firebase.database.ServerValue.TIMESTAMP, conversionRateSnapshot: rate, currencyAmountSnapshot: parseFloat(currencyAmount) };
    db.ref(`users/${currentUser.uid}`).transaction(d => { if (d && d.coins >= amount) { d.coins -= amount; return d; } return; }, (err, com) => { if (err || !com) { showToast("Request failed. Insufficient balance.", 'error'); enableBtn(); } else db.ref('withdrawals').push(wdData).then(() => { addNotification('Withdrawal Requested', `${amount.toLocaleString()} coins request sent via ${method}.`, 'info'); ['withdrawAmount', 'accountDetails', 'otherAccountName', 'otherAccountNumber'].forEach(id => document.getElementById(id).value = ''); document.getElementById('withdrawMethod').value = ''; handleWithdrawMethodChange(document.getElementById('withdrawMethod')); if(estimatedCurrencyAmountSpan) estimatedCurrencyAmountSpan.textContent = ''; enableBtn(); showWithdrawalSuccessPage(); }).catch(() => { showToast("Submission failed. Refunding.", 'error'); db.ref(`users/${currentUser.uid}/coins`).set(firebase.database.ServerValue.increment(amount)); enableBtn(); }); });
}
async function cancelWithdrawalRequest(wdId) { if (!currentUser || !db) return; showConfirmationPopup('Cancel Request', 'Are you sure?', async () => { showToast('Processing...', 'info'); const wdRef = db.ref(`withdrawals/${wdId}`); try { const s = await wdRef.once('value'), d = s.val(); if (!d || d.userId !== currentUser.uid || d.status !== 'pending') throw new Error("Request cannot be cancelled."); await db.ref(`users/${currentUser.uid}/coins`).set(firebase.database.ServerValue.increment(d.amount)); await wdRef.update({ status: 'cancelled by user' }); showToast(`Request cancelled. ${d.amount.toLocaleString()} coins refunded.`, 'success'); addNotification('Withdrawal Cancelled', `Request for ${d.amount.toLocaleString()} coins cancelled.`, 'cancelled'); } catch (e) { showToast(`Cancellation failed: ${e.message}`, 'error'); } }); }
function calculateEstimatedCurrency() { if (!estimatedCurrencyAmountSpan || !withdrawAmountInput || !appConfigData) return; const a = parseInt(withdrawAmountInput.value), r = appConfigData.tokenToCurrencyRate || 0, s = appConfigData.currencySymbol || '$'; estimatedCurrencyAmountSpan.textContent = (!isNaN(a) && a > 0 && r > 0 && s) ? `≈ ${(a/r).toFixed(2)} ${s}` : ''; }
if(withdrawAmountInput) withdrawAmountInput.addEventListener('input', calculateEstimatedCurrency);
function generateReferralCode(userId) { return `CZ${userId.substring(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`; }
function copyReferralLink() { const l = referralLinkDisplay?.textContent; if (navigator.clipboard && l?.startsWith('http')) navigator.clipboard.writeText(l).then(() => showToast('Referral link copied!', 'success')).catch(() => showToast('Failed to copy.', 'error')); }
function updateReferralSectionVisibility() { if(enterReferralSection) { if (hasEnteredReferral) enterReferralSection.classList.add('hidden'); else { enterReferralSection.classList.remove('hidden'); clearMessage('referralCodeMessage'); document.getElementById('enteredReferralCodeInput').value = ''; } } }
async function submitReferralCode() { if (!currentUser || hasEnteredReferral) return; const codeInput = document.getElementById('enteredReferralCodeInput'); const code = codeInput.value.trim().toUpperCase(); const submitBtn = document.getElementById('submitReferralCodeBtn'); if (!code) { showToast("Please enter a code.", 'error'); return; } if (code === userReferralCode) { showToast("You cannot use your own code.", 'error'); return; } submitBtn.disabled = true; submitBtn.textContent = 'Checking...'; try { const refSnapshot = await db.ref('users').orderByChild('referralCode').equalTo(code).once('value'); if (!refSnapshot.exists()) throw new Error("Invalid referral code."); let refUid, refUsername; refSnapshot.forEach(c => { refUid = c.key; refUsername = c.val().username; }); if (!refUid || refUid === currentUser.uid) throw new Error("You cannot use your own code."); const updates = {}; updates[`/users/${currentUser.uid}/coins`] = firebase.database.ServerValue.increment(NEW_USER_REFERRAL_BONUS); updates[`/users/${currentUser.uid}/totalEarnings`] = firebase.database.ServerValue.increment(NEW_USER_REFERRAL_BONUS); updates[`/users/${currentUser.uid}/referredBy`] = refUid; updates[`/users/${currentUser.uid}/hasEnteredReferralCode`] = true; updates[`/users/${refUid}/coins`] = firebase.database.ServerValue.increment(REFERRER_BONUS); updates[`/users/${refUid}/totalEarnings`] = firebase.database.ServerValue.increment(REFERRER_BONUS); updates[`/users/${refUid}/referrals/list/${currentUser.uid}`] = firebase.database.ServerValue.TIMESTAMP; await db.ref().update(updates); showToast(`Success! You received ${NEW_USER_REFERRAL_BONUS} coins.`, 'success'); addNotification('Referral Success!', `You earned +${NEW_USER_REFERRAL_BONUS} coins for using a code.`, 'reward'); updateReferralSectionVisibility(); } catch (e) { showToast(e.message, 'error'); } finally { submitBtn.disabled = false; submitBtn.textContent = 'Submit Code'; } }

function submitSupportTicket() { if (!currentUser || !db) return; const msgArea = document.getElementById('supportMessage'), message = msgArea.value.trim(); if (!message) { showToast('Please enter a message.', 'error'); return; } const ticketData = { userId: currentUser.uid, userEmail: currentUser.email, username: userUsername, message, timestamp: firebase.database.ServerValue.TIMESTAMP, status: 'open', reply: null }; showToast('Sending message...', 'info'); db.ref('support_tickets').push(ticketData).then(() => { showToast('Message sent!', 'success'); msgArea.value = ''; addNotification('Message Sent', 'Support ticket submitted.', 'success'); }).catch(e => showToast(`Failed: ${e.message}`, 'error')); }
function setupGlobalSupportListener(userId) { if (!db || !userId) return; detachGlobalSupportListener(); globalSupportRef = db.ref('support_tickets').orderByChild('userId').equalTo(userId); globalSupportListener = globalSupportRef.on('value', s => { const d = s.val() || {}; if (!initialDataLoaded) { previousTicketState = d; return; } Object.keys(d).forEach(k => { const cur = d[k], prev = previousTicketState[k]; if (cur.reply && cur.replyTimestamp && (!prev || cur.replyTimestamp !== prev.replyTimestamp)) addNotification("Admin Replied", `Admin replied to your ticket.`, 'message'); }); previousTicketState = d; }); }
function detachGlobalSupportListener() { if (globalSupportRef && globalSupportListener) { globalSupportRef.off('value', globalSupportListener); globalSupportRef = null; globalSupportListener = null; previousTicketState = {}; } }
function loadSupportHistory() { if (!db || !currentUser) return; supportTicketsListEl.innerHTML = '<div class="loading-indicator">Loading messages...</div>'; db.ref('support_tickets').orderByChild('userId').equalTo(currentUser.uid).once('value').then(s => { supportTicketsListEl.innerHTML = ''; const d = s.val() || {}; const keys = Object.keys(d).sort((a,b) => d[b].timestamp - d[a].timestamp); if (keys.length === 0) { supportTicketsListEl.innerHTML = '<div class="empty-state">No messages sent.</div>'; return; } keys.forEach(k => supportTicketsListEl.appendChild(createSupportTicketElement(k, d[k]))); }).catch(() => supportTicketsListEl.innerHTML = `<div class="error-message">Could not load history.</div>`); }
function createSupportTicketElement(id, t) { const div = document.createElement('div'); div.className = 'support-ticket'; div.dataset.id = id; const date = new Date(t.timestamp).toLocaleString(); div.innerHTML = `<button class="notification-delete-btn"><i class="fas fa-trash-alt"></i></button> <div class="ticket-message">${t.message}</div> <div class="ticket-meta"> <span class="ticket-status ticket-status-${t.status}">${t.status}</span> <span>${date}</span> </div> ${t.reply ? `<div class="ticket-reply"> <p class="ticket-reply-header">Admin Reply:</p> <p>${t.reply}</p> </div>` : ''}`; return div; }
function deleteSupportTicket(id, el) { if(!currentUser || !db) return; if (el) { el.style.transition = 'opacity 0.3s, transform 0.3s'; el.style.opacity = '0'; el.style.transform = 'scale(0.95)'; setTimeout(() => el.remove(), 300); } db.ref(`support_tickets/${id}`).remove().catch(() => showToast("Sync Error.", "error")); }

function toggleUsernameEdit(isEditing) { document.getElementById('settingsUsername-text').style.display = isEditing ? 'none' : 'block'; document.getElementById('username-display-actions').style.display = isEditing ? 'none' : 'block'; const inputEl = document.getElementById('username-edit-input'); inputEl.style.display = isEditing ? 'block' : 'none'; document.getElementById('username-edit-actions').style.display = isEditing ? 'flex' : 'none'; if (isEditing) { inputEl.value = userUsername; inputEl.focus(); } }
function saveUsername() { const newUsername = document.getElementById('username-edit-input').value.trim(); if (!newUsername || newUsername.length < MIN_USERNAME_LENGTH) { showToast(`Username min ${MIN_USERNAME_LENGTH} chars.`, 'error'); return; } if (newUsername === userUsername) { toggleUsernameEdit(false); return; } showConfirmationPopup('Change Username', `Change username to "${newUsername}"?`, async () => { showToast('Saving...', 'info'); try { await currentUser.updateProfile({ displayName: newUsername }); await db.ref(`users/${currentUser.uid}`).update({ username: newUsername }); showToast('Username updated!', 'success'); toggleUsernameEdit(false); } catch (e) { showToast(`Error: ${e.message}`, 'error'); } }); }
function copyUserInfo(id) { const el = document.getElementById(id), text = el?.textContent; if (el && navigator.clipboard && text) navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success')); }
function changeUserPassword() { if (!auth?.currentUser) return; const curP = document.getElementById('settings-current-password').value, newP = document.getElementById('settings-new-password').value, conP = document.getElementById('settings-confirm-password').value; if (!curP || !newP || !conP) { showToast("All password fields required.",'error'); return; } if (newP.length < 6) { showToast("New password min 6 chars.",'error'); return; } if (newP !== conP) { showToast("Passwords do not match.",'error'); return; } showToast("Authenticating...",'info'); const cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, curP); currentUser.reauthenticateWithCredential(cred).then(() => { showToast("Updating password...",'info'); currentUser.updatePassword(newP).then(() => { showToast("Password changed!",'success'); ['settings-current-password', 'settings-new-password', 'settings-confirm-password'].forEach(id => document.getElementById(id).value = ''); }).catch(e => showToast(`Error: ${e.message}`, 'error')); }).catch(() => showToast("Incorrect current password.", 'error')); }
function deleteUserAccount() { if (!currentUser || !db) return; showConfirmationPopup('Delete Account', 'DANGER! This will permanently delete your account and all data. Cannot be undone.', () => { showToast('Deleting account...', 'info'); const userId = currentUser.uid; currentUser.delete().then(() => db.ref(`users/${userId}`).remove()).then(() => alert('Account deleted.')) .catch(e => showToast(e.code === 'auth/requires-recent-login' ? 'Please log in again to delete account.' : `Error: ${e.message}`, 'error')); }); }
function showSpecialPopup() { const o = document.getElementById('special-popup-overlay'); if (!o) return; document.getElementById('popup-cta-btn').onclick = () => { hideSpecialPopup(); showPage('page-daily-earning'); }; o.classList.add('show'); document.getElementById('notificationSound')?.play().catch(()=>{}); }
function hideSpecialPopup() { document.getElementById('special-popup-overlay')?.classList.remove('show'); }
function showWithdrawalSuccessPage() { document.getElementById('withdrawal-success-page')?.classList.add('show'); }
function hideWithdrawalSuccessPage() { document.getElementById('withdrawal-success-page')?.classList.remove('show'); showPage('page-history'); }

function loadMainTasks() { if (!db || !currentUser) return; detachMainTasksListener(); mainTasksRef = db.ref('main_tasks'); mainTasksListElement.innerHTML = '<div class="loading-indicator">Loading tasks...</div>'; mainTasksListener = mainTasksRef.on('value', s => { mainTasksData = s.val() || {}; mainTasksListElement.innerHTML = ''; if (Object.keys(mainTasksData).length === 0) { mainTasksListElement.innerHTML = '<p style="text-align:center;">No weekly tasks.</p>'; return; } Object.keys(mainTasksData).forEach(id => { mainTasksListElement.appendChild(createMainTaskCardElement(id, mainTasksData[id])); manageMainTaskCooldown(id, mainTasksData[id]); }); }, () => { mainTasksListElement.innerHTML = '<div class="error-message">Error loading tasks.</div>'; }); }
function createMainTaskCardElement(id, t) { const card = document.createElement('div'); card.className = 'task-card'; card.id = `main-task-${id}`; card.innerHTML = `<div class="task-card-header"><div class="task-card-icon"><i class="fas ${t.icon || 'fa-tasks'}"></i></div><div class="task-info"><div class="task-title">${t.title}</div><div class="task-description">${t.description}</div></div></div><div class="task-card-footer"><div class="task-reward">Reward: ${t.reward} Coins</div><div class="task-action" id="action-area-main-${id}"><div id="timer-main-task-${id}" class="timer-display"></div><button class="earn-btn" id="claim-btn-main-${id}" onclick="claimMainTaskReward('${id}')">Claim</button></div></div>`; return card; }
function detachMainTasksListener() { if (mainTasksRef && mainTasksListener) { mainTasksRef.off('value', mainTasksListener); mainTasksRef = null; mainTasksListener = null; } }
function manageMainTaskCooldown(id, t) { const btn = document.getElementById(`claim-btn-main-${id}`), timer = document.getElementById(`timer-main-task-${id}`); if (!btn || !timer) return; if (taskTimers[id]) clearInterval(taskTimers[id]); const cd = 7 * 24 * 60 * 60 * 1000; const check = () => { const rem = cd - (Date.now() - (userLastEarnedTimestamps[id] || 0)); if (rem > 0) { btn.style.display = 'none'; timer.style.display = 'block'; timer.textContent = `Available in: ${formatTimeRemaining(rem)}`; if (!taskTimers[id]) taskTimers[id] = setInterval(check, 1000); } else { btn.style.display = 'inline-block'; timer.style.display = 'none'; btn.disabled = false; btn.textContent = `Do Task`; if (taskTimers[id]) { clearInterval(taskTimers[id]); delete taskTimers[id]; } } }; check(); }
function claimMainTaskReward(id) { if (!currentUser || !db || !mainTasksData[id]) return; const task = mainTasksData[id], reward = task.reward || 0, btn = document.getElementById(`claim-btn-main-${id}`); if(btn) btn.disabled = true; const u = { [`users/${currentUser.uid}/coins`]: firebase.database.ServerValue.increment(reward), [`users/${currentUser.uid}/totalEarnings`]: firebase.database.ServerValue.increment(reward), [`users/${currentUser.uid}/lastEarnedTimestamps/${id}`]: firebase.database.ServerValue.TIMESTAMP }; db.ref().update(u).then(() => { showToast(`+${reward} Coins!`, 'success'); addNotification('Weekly Task Complete!', `You earned +${reward} coins for "${task.title}".`, 'reward'); manageMainTaskCooldown(id, task); }).catch(() => { showToast('Could not claim reward.', 'error'); if(btn) btn.disabled = false; }); }

function loadLeaderboard() { if (!leaderboardListEl || !db) return; leaderboardListEl.innerHTML = `<div class="loading-indicator">Loading...</div>`; db.ref('users').orderByChild('coins').limitToLast(100).once('value', s => { leaderboardListEl.innerHTML = ''; if (!s.exists()) { leaderboardListEl.innerHTML = '<div class="empty-state">Leaderboard is empty.</div>'; return; } const users = []; s.forEach(c => { users.push({ id: c.key, ...c.val() }); }); users.sort((a,b) => (b.coins||0) - (a.coins||0)).forEach((u,i) => { const r = i+1; const item=document.createElement('div'); item.className='leaderboard-item'; if(r<=3) item.classList.add(`rank-${r}`); if(currentUser&&u.id===currentUser.uid) item.classList.add('current-user-entry'); let rankDisplay = r<=3 ? `<i class="fas fa-trophy leaderboard-trophy"></i>` : `<span class="leaderboard-rank-number">${r}</span>`; item.innerHTML = `${rankDisplay}<div class="leaderboard-user-details"><div class="leaderboard-username">${u.username||'Anonymous'}</div></div><div class="leaderboard-coins"><i class="fas fa-coins"></i><span>${formatBalance(u.coins||0)}</span></div>`; leaderboardListEl.appendChild(item); }); }).catch(e => { leaderboardListEl.innerHTML = `<div class="error-message">Could not load leaderboard.</div>`; }); }

function loadGlobalChat() { if (!db || !currentUser) return; detachGlobalChatListener(); const chatListEl = document.getElementById('chat-messages-list'); chatListEl.innerHTML = '<div class="loading-indicator">Loading chat...</div>'; globalChatRef = db.ref('global_chat').orderByChild('timestamp').limitToLast(100); const onChildAdded = s => { if (chatListEl.querySelector('.loading-indicator')) chatListEl.innerHTML = ''; const el = createChatMessageElement(s.key, s.val()); chatListEl.appendChild(el); if (chatListEl.scrollHeight - chatListEl.scrollTop < chatListEl.clientHeight + 200) chatListEl.scrollTop = chatListEl.scrollHeight; }; const onChildChanged = s => { const el = document.getElementById(`msg-${s.key}`); if(el) el.replaceWith(createChatMessageElement(s.key, s.val())); }; const onChildRemoved = s => { const el = document.getElementById(`msg-${s.key}`); if (el) { el.style.transition = 'opacity 0.3s, transform 0.3s'; el.style.opacity = '0'; el.style.transform = 'scale(0.8)'; setTimeout(() => el.remove(), 300); } }; chatListeners.child_added = globalChatRef.on('child_added', onChildAdded); chatListeners.child_changed = globalChatRef.on('child_changed', onChildChanged); chatListeners.child_removed = globalChatRef.on('child_removed', onChildRemoved); }
function detachGlobalChatListener() { if (globalChatRef) Object.values(chatListeners).forEach(l => globalChatRef.off('value', l)); globalChatRef = null; chatListeners = {}; }
function createChatMessageElement(key, d) { const isSent = currentUser && d.uid === currentUser.uid; const container = document.createElement('div'); container.id = `msg-${key}`; container.className = `chat-message-container ${isSent ? 'sent' : 'received'}`; const item = document.createElement('div'); item.className = 'chat-message-item'; let replyHtml = ''; if (d.replyTo) replyHtml = `<div class="reply-context"><span class="reply-context-user">${d.replyTo.username || 'User'}</span><span class="reply-context-text">${d.replyTo.text || '...'}</span></div>`; const ts = d.timestamp ? new Date(d.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : ''; item.innerHTML = `${isSent ? '' : `<div class="username">${d.username||'Anonymous'}</div>`}${replyHtml}<div class="text">${d.text}</div><div class="timestamp">${ts}</div>`; item.onclick = (e) => { e.stopPropagation(); if(currentUser) showMessageOptionsMenu(e, key, isSent, d); }; container.appendChild(item); let reactionsHtml = ''; if (d.reactions) { reactionsHtml = '<div class="reactions-container">'; for (const emoji in d.reactions) { const count = Object.keys(d.reactions[emoji]).length; if (count > 0) reactionsHtml += `<div class="reaction-emoji" onclick="event.stopPropagation(); if(currentUser) reactToMessage('${key}', '${emoji}')">${emoji} ${count}</div>`; } reactionsHtml += '</div>'; } if (reactionsHtml) item.insertAdjacentHTML('afterend', reactionsHtml); return container; }
function showMessageOptionsMenu(e, key, isSent, d) { closeMessageOptionsMenu(); const menu = document.createElement('div'); menu.className = 'message-options-menu'; let items = `<button class="option-btn" onclick="setupReply('${key}', '${d.username||'User'}', \`${d.text.replace(/'/g, "\\'")}\`); closeMessageOptionsMenu();"><i class="fas fa-reply"></i> Reply</button><button class="option-btn" onclick="copyMessageText(\`${d.text.replace(/`/g, "\\`")}\`); closeMessageOptionsMenu();"><i class="fas fa-copy"></i> Copy</button>`; if (isSent) items += `<button class="option-btn unsend-btn" onclick="unsendMessage('${key}'); closeMessageOptionsMenu();"><i class="fas fa-trash"></i> Unsend</button>`; items += '<hr><div class="emoji-picker">'; availableReactions.forEach(emoji => { items += `<button class="emoji-btn" onclick="reactToMessage('${key}', '${emoji}'); closeMessageOptionsMenu();">${emoji}</button>`; }); items += '</div>'; menu.innerHTML = items; document.body.appendChild(menu); activeMessageOptionsMenu = menu; const rect = e.target.closest('.chat-message-item').getBoundingClientRect(); menu.style.left = `${rect.left+window.scrollX}px`; menu.style.top = `${rect.bottom+window.scrollY+5}px`; if (menu.offsetLeft+menu.offsetWidth > window.innerWidth-10) menu.style.left = `${window.innerWidth-menu.offsetWidth-10}px`; if (menu.offsetTop+menu.offsetHeight > window.innerHeight-10) menu.style.top = `${rect.top+window.scrollY-menu.offsetHeight-5}px`; setTimeout(() => document.addEventListener('click', closeMessageOptionsMenu, { once: true }), 0); }
function closeMessageOptionsMenu() { if (activeMessageOptionsMenu) { activeMessageOptionsMenu.remove(); activeMessageOptionsMenu = null; } }
function copyMessageText(text) { navigator.clipboard.writeText(text).then(() => showToast('Message copied!', 'success')); }
function sendChatMessage() { if (!db || !currentUser) return; const input = document.getElementById('chat-message-input'), text = input.value.trim(); if (!text || text.length > 500) { showToast(text.length > 500 ? "Message too long." : "Enter a message.", "error"); return; } const data = { uid: currentUser.uid, username: userUsername, text: text, timestamp: firebase.database.ServerValue.TIMESTAMP, reactions: null, replyTo: replyingToMessage }; db.ref('global_chat').push(data).then(() => { input.value = ''; cancelReply(); input.style.height = 'auto'; }).catch(e => showToast(`Send error: ${e.message}`, 'error')); }
function setupReply(key, user, text) { replyingToMessage = { msgId: key, username: user, text: text.substring(0, 50) + (text.length > 50 ? '...' : '') }; const bar = document.getElementById('chat-reply-bar'); bar.querySelector('.reply-context-user').textContent = `Replying to ${user}`; bar.querySelector('.reply-context-text').textContent = replyingToMessage.text; bar.style.display = 'flex'; document.getElementById('chat-message-input').focus(); closeMessageOptionsMenu(); }
function cancelReply() { replyingToMessage = null; document.getElementById('chat-reply-bar').style.display = 'none'; }
function unsendMessage(key) { showConfirmationPopup('Unsend Message', 'Are you sure?', () => { db.ref(`global_chat/${key}`).remove().then(() => showToast("Message unsent.", "info")).catch(e => showToast("Error: " + e.message, "error")); }); }
function reactToMessage(key, emoji) { const ref = db.ref(`global_chat/${key}/reactions/${emoji}/${currentUser.uid}`); ref.once('value', s => s.exists() ? ref.remove() : ref.set(true)); }

function applyTheme(theme) { document.body.className = ''; document.body.classList.add(theme); if (localStorage.getItem('taptak-ui-animations') !== 'false') document.body.classList.add('ui-animations-on'); applyNeonGlow(localStorage.getItem('taptak-neon-glow') || 'green'); localStorage.setItem('taptak-theme', theme); document.querySelectorAll('#theme-selector input[name="theme"]').forEach(r => { r.checked = r.value === theme; }); if(initialDataLoaded) showToast(`${theme.split('-')[0].charAt(0).toUpperCase() + theme.slice(1).split('-')[0]} mode on.`, 'info'); }
function applyUiAnimations(enabled) { document.body.classList.toggle('ui-animations-on', enabled); localStorage.setItem('taptak-ui-animations', String(enabled)); applyNeonGlow(localStorage.getItem('taptak-neon-glow') || 'green'); if(initialDataLoaded) showToast(`UI animations ${enabled ? 'on' : 'off'}.`, 'info'); }
function applyNeonGlow(color) { const elements = document.querySelectorAll(neonGlowElements.join(', ')); elements.forEach(el => el.classList.remove('neon-pulse', 'neon-green', 'neon-red', 'neon-gold', 'neon-blue')); if (localStorage.getItem('taptak-ui-animations') !== 'false' && color !== 'off') elements.forEach(el => el.classList.add('neon-pulse', `neon-${color}`)); localStorage.setItem('taptak-neon-glow', color); }
function showConfirmationPopup(title, message, onYes) { const o = document.getElementById('confirmation-popup-overlay'); document.getElementById('confirmation-popup-title').textContent = title; document.getElementById('confirmation-popup-message').textContent = message; const y = document.getElementById('confirmation-popup-yes'), n = document.getElementById('confirmation-popup-no'); const close = () => o.classList.remove('show'); const yesH = () => { onYes(); close(); }; const newY = y.cloneNode(true); y.parentNode.replaceChild(newY, y); newY.addEventListener('click', yesH); n.onclick = close; o.onclick = close; o.querySelector('.confirmation-popup-content').onclick = e => e.stopPropagation(); o.classList.add('show'); }

document.addEventListener('DOMContentLoaded', () => {
    currentYearElement.textContent = new Date().getFullYear(); drawSpinWheel(); requestNotificationPermission(); displayRealDate();
    if (spinButton) spinButton.addEventListener('click', doDailySpin);
    
    try { const p = new URLSearchParams(window.location.search), c = p.get('ref'); if (c) { sessionStorage.setItem('referralCode', c.trim().toUpperCase()); history.replaceState(null, '', window.location.pathname); } } catch (e) { console.error("URL param error:", e); }
    
    notificationHistoryListEl.addEventListener('click', e => { const b = e.target.closest('.notification-delete-btn'); if (b) { const i = e.target.closest('.notification-item'), id = i?.dataset.id; if(id) deleteNotification(id, i); } });
    supportTicketsListEl.addEventListener('click', e => { const b = e.target.closest('.notification-delete-btn'); if (b) { const i = e.target.closest('.support-ticket'), id = i?.dataset.id; if(id) showConfirmationPopup('Delete Message', 'Are you sure?', () => deleteSupportTicket(id, i)); } });
    const chatInput = document.getElementById('chat-message-input'); chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }); chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = `${this.scrollHeight}px`; });

    const savedTheme = localStorage.getItem('taptak-theme') || 'light-mode';
    let animationsEnabled = localStorage.getItem('taptak-ui-animations') !== 'false', savedGlow = localStorage.getItem('taptak-neon-glow') || 'green';
    if (localStorage.getItem('taptak-first-visit') === null) { animationsEnabled = true; savedGlow = 'green'; localStorage.setItem('taptak-ui-animations', 'true'); localStorage.setItem('taptak-neon-glow', 'green'); localStorage.setItem('taptak-first-visit', 'done'); }
    applyTheme(savedTheme); applyUiAnimations(animationsEnabled); applyNeonGlow(savedGlow);
    document.querySelector(`#theme-selector input[value="${savedTheme}"]`)?.setAttribute('checked', 'checked'); document.getElementById('ui-animations-toggle').checked = animationsEnabled; document.getElementById('neon-glow-selector').value = savedGlow;
    document.getElementById('theme-selector').addEventListener('change', e => { if (e.target.name === 'theme') applyTheme(e.target.value); });
    document.getElementById('ui-animations-toggle').addEventListener('change', e => applyUiAnimations(e.target.checked));
    document.getElementById('neon-glow-selector').addEventListener('change', e => { applyNeonGlow(e.target.value); if(initialDataLoaded) showToast(`Neon glow set to ${e.target.value}.`, 'info'); });
});
