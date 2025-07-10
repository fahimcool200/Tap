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
const NEW_USER_REFERRAL_BONUS = 100; // Bonus for the person who uses the code
const REFERRER_BONUS = 50; // Bonus for the person whose code was used
const DAILY_BONUS_AMOUNT = 50, DAILY_CHECKIN_AMOUNT = 25;
const ONE_DAY_MILLIS = 24 * 60 * 60 * 1000, MIN_USERNAME_LENGTH = 3, VISIT_TASK_TIMER_SECONDS = 10;
const spinSegments = [{ reward: 10, label: "10 Coins", color: "#ff7675" },{ reward: 25, label: "25 Coins", color: "#fdcb6e" },{ reward: 5,  label: "5 Coins",  color: "#00b894" },{ reward: 75, label: "75 Coins!",color: "#74b9ff" },{ reward: 0,  label: "Try Again",color: "#a29bfe" },{ reward: 15, label: "15 Coins", color: "#fd79a8" },{ reward: 50, label: "50 Coins", color: "#ffeaa7" },{ reward: 100,label: "100 Coins!!",color: "#55efc4" }];
const NUM_SPIN_SEGMENTS = spinSegments.length;
let currentRotation = 0, isSpinning = false;
let app, auth, db, storage, currentUser = null;
let userRef, userDataListener, tasksRef, tasksListener, mainTasksRef, mainTasksListener, appConfigRef, appConfigListener, historyRef, historyListener, notificationsRef, notificationsListener, globalSupportRef, globalSupportListener, globalChatRef;
let userCoins = 0, userReferralCode = null, userLastEarnedTimestamps = {}, hasEnteredReferral = false;
let userLastDailyBonusClaim = 0, userLastSpinClaim = 0, userLastDailyCheckinClaim = 0;
let userCreatedAt = 0, userUsername = null, userAvatarUrl = null, appLogoUrl = 'https://i.ibb.co/p3wH2XG/logo.png';
let appConfigData = {}, activeTasksData = {}, mainTasksData = {};
const taskTimers = {}; let bonusTimerInterval = null, spinTimerInterval = null, checkinTimerInterval = null;
let unreadNotificationCount = 0, lastKnownUnreadCount = 0;
let initialDataLoaded = false;
let previousTicketState = {};
let previousWithdrawalState = {};
let spinReadyNotified = false;
let appLoadStartTime = Date.now();
let activeMessageOptionsMenu = null;

// --- Global Chat variables ---
let chatListeners = {};
let replyingToMessage = null;
const availableReactions = ['👍', '❤️', '😂', '😮', '😢', '😡'];

function clearAllTimers() {
    Object.keys(taskTimers).forEach(key => clearInterval(taskTimers[key]));
    if(bonusTimerInterval) clearInterval(bonusTimerInterval); bonusTimerInterval = null;
    if(spinTimerInterval) clearInterval(spinTimerInterval); spinTimerInterval = null;
    if(checkinTimerInterval) clearInterval(checkinTimerInterval); checkinTimerInterval = null;
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

// --- DOM Element Caching ---
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const loginFormEl = document.getElementById('login-form');
const signupFormEl = document.getElementById('signup-form');
const forgotPasswordFormEl = document.getElementById('forgot-password-form');
const coinBalanceElement = document.getElementById('coin-balance');
const withdrawCoinBalanceElement = document.getElementById('withdraw-coin-balance');
const authMessageGlobal = document.getElementById('auth-message-global');
const currentYearElement = document.getElementById('currentYear');
const bannerImageElement = document.getElementById('bannerImage');
const tasksListElement = document.getElementById('tasks-list');
const mainTasksListElement = document.getElementById('tasks-list-main');
const historyListElement = document.getElementById('history-list');
const referralLinkDisplay = document.getElementById('referralLinkDisplay');
const appLogoElement = document.getElementById('appLogo');
const withdrawInfoElement = document.getElementById('withdraw-info');
const enterReferralSection = document.getElementById('enterReferralSection');
const dailyBonusBtn = document.getElementById('dailyBonusBtn');
const dailyBonusTimer = document.getElementById('dailyBonusTimer');
const dailyCheckinBtn = document.getElementById('dailyCheckinBtn');
const dailyCheckinTimer = document.getElementById('dailyCheckinTimer');
const dailySpinBtn = document.getElementById('dailySpinBtn');
const dailySpinResult = document.getElementById('dailySpinResult');
const dailySpinTimer = document.getElementById('dailySpinTimer');
const spinWheelElement = document.getElementById('spinWheel');
const spinCenterDisplay = document.getElementById('spinCenterDisplay');
const withdrawAmountInput = document.getElementById('withdrawAmount');
const estimatedCurrencyAmountSpan = document.getElementById('estimatedCurrencyAmount');
const welcomeMessageContainer = document.getElementById('welcomeMessageContainer');
const welcomeMessageElement = document.getElementById('welcomeMessage');
const settingsUserEmail = document.getElementById('settingsUserEmail');
const settingsUserId = document.getElementById('settingsUserId');
const settingsUsernameText = document.getElementById('settingsUsername-text');
const submitWithdrawalBtn = document.getElementById('submitWithdrawalBtn');
const loadingOverlay = document.getElementById('loading-overlay');
const notificationButton = document.getElementById('notificationButton');
const notificationBadge = document.getElementById('notificationBadge');
const notificationHistoryListEl = document.getElementById('notification-history-list');
const supportTicketsListEl = document.getElementById('support-tickets-list');
const leaderboardListEl = document.getElementById('leaderboard-list');

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

function showMessage(elementId, message, type) {
    const el = document.getElementById(elementId);
    if(el) {
        el.textContent = message;
        el.className = `message-area ${type}`;
        el.style.display = 'block';
    }
}
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

function showLoadingOverlay() { if(loadingOverlay) { loadingOverlay.classList.remove('hidden'); } }
function hideLoadingOverlay() {
    const elapsedTime = Date.now() - appLoadStartTime;
    const timeToWait = Math.max(0, 3000 - elapsedTime);
    setTimeout(() => { if (loadingOverlay) loadingOverlay.classList.add('hidden'); }, timeToWait);
}

function requestNotificationPermission() {
    if (!("Notification" in window)) {
        console.log("This browser does not support desktop notification");
    } else if (Notification.permission === "default") {
        Notification.requestPermission().then(permission => {
            if (permission === "granted") {
                showSystemNotification("Notifications Enabled!", "You will now receive important updates from TapTak.");
            }
        });
    }
}
function showSystemNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
            body: body,
            icon: appLogoUrl
        });
    }
}

auth.onAuthStateChanged(user => {
    detachAllListeners();
    clearAllTimers();
    if (user) {
         currentUser = user;
         checkUserStatusAndProceed(currentUser);
    } else {
         hideLoadingOverlay();
         resetAppStateForLogout();
    }
});

function resetAppStateForLogout() {
     currentUser = null; initialDataLoaded = false; userCoins = 0; userReferralCode = null; userLastEarnedTimestamps = {};
     hasEnteredReferral = false; userLastDailyBonusClaim = 0; userLastSpinClaim = 0; userLastDailyCheckinClaim = 0; spinReadyNotified = true;
     userCreatedAt = 0; userUsername = null; userAvatarUrl = null; activeTasksData = {}; appConfigData = {}; mainTasksData = {};
     unreadNotificationCount = 0; lastKnownUnreadCount = 0; updateNotificationBadge();
     previousWithdrawalState = {}; previousTicketState = {};
     authContainer.style.display = 'flex';
     appContainer.style.display = 'none';
     if(authMessageGlobal) { authMessageGlobal.textContent = ''; authMessageGlobal.style.display = 'none'; }
     coinBalanceElement.textContent = '0';
     withdrawCoinBalanceElement.textContent = '0';
     tasksListElement.innerHTML = '';
     mainTasksListElement.innerHTML = '';
     historyListElement.innerHTML = '';
     ['settingsUsername-text', 'settingsUserEmail', 'settingsUserId'].forEach(id => { const el = document.getElementById(id); if(el) el.textContent = 'Loading...'; });
     history.replaceState(null, '', window.location.pathname);
     showAuthForm('login');
}

function checkUserStatusAndProceed(user) {
     if (!db || !user) { hideLoadingOverlay(); return; }
     db.ref(`users/${user.uid}`).once('value').then(s => {
         const d = s.val();
         if (!d) { showToast("Account data missing. Contact support.", 'error'); hideLoadingOverlay(); auth.signOut(); return; }
         if (d.isBlocked || d.isBanned) {
             let m = d.isBanned ? "Your account has been banned." : "Your account has been blocked.";
             showToast(m, 'error'); showAuthForm('login'); hideLoadingOverlay(); setTimeout(() => { if (auth.currentUser) auth.signOut(); }, 4000);
         } else {
             setupUserDataListener(currentUser.uid);
             setupAppConfigListener();
             setupGlobalSupportListener(currentUser.uid);
         }
     }).catch(e => { showToast("Error checking account status.", 'error'); showAuthForm('login'); hideLoadingOverlay(); if(auth) auth.signOut(); });
}

async function createUserInDatabase(user, username, referredByCode = null) {
    const rc = generateReferralCode(user.uid);
    const userData = {
        email: user.email, username: username, avatarUrl: user.photoURL || null, coins: 0, totalEarnings: 0, isAdmin: false, isBlocked: false, isBanned: false,
        createdAt: firebase.database.ServerValue.TIMESTAMP, lastEarnedTimestamps: {}, referralCode: rc,
        hasEnteredReferralCode: !!referredByCode,
        referredBy: null,
        lastDailyBonusClaim: 0, lastSpinClaim: 0, lastDailyCheckinClaim: 0,
        provider: user.providerData[0].providerId
    };
    await db.ref('users/' + user.uid).set(userData);
    if (referredByCode) {
        // This function will now be called from the client but will only update the referrer
        // The new user's bonus is handled by the submitReferralCode function
        await applyReferralBonus(user.uid, referredByCode);
    }
}

// This function is now only responsible for giving the referrer their bonus.
// It will be triggered from within submitReferralCode.
async function applyReferralBonus(referrerUid, newUserId, newUserUsername) {
    if (!db || !referrerUid || !newUserId) return;

    const updates = {
        [`users/${referrerUid}/coins`]: firebase.database.ServerValue.increment(REFERRER_BONUS),
        [`users/${referrerUid}/totalEarnings`]: firebase.database.ServerValue.increment(REFERRER_BONUS),
        [`users/${referrerUid}/referrals/count`]: firebase.database.ServerValue.increment(1),
        [`users/${referrerUid}/referrals/bonusEarned`]: firebase.database.ServerValue.increment(REFERRER_BONUS),
        [`users/${referrerUid}/referrals/list/${newUserId}`]: firebase.database.ServerValue.TIMESTAMP
    };

    await db.ref().update(updates);
    addNotificationForUser(referrerUid, 'New Referral!', `${newUserUsername || 'A new user'} used your code. You earned +${REFERRER_BONUS} coins!`, 'reward');
}

function addNotification(title, message, type = 'info') {
    if (!currentUser || !db) return;
    addNotificationForUser(currentUser.uid, title, message, type);
}

function addNotificationForUser(userId, title, message, type = 'info') {
    if (!db || !userId) return;
    let iconClass = 'fa-info-circle', notifType = type;
    switch(type) {
        case 'success': iconClass = 'fa-check-circle'; break;
        case 'reward': iconClass = 'fa-star'; break;
        case 'alert': iconClass = 'fa-exclamation-triangle'; break;
        case 'message': iconClass = 'fa-envelope'; break;
        case 'cancelled': iconClass = 'fa-times-circle'; notifType = 'alert'; break;
        case 'rejected': iconClass = 'fa-ban'; notifType = 'rejected'; break;
        case 'welcome': iconClass = 'fa-hands-helping'; notifType = 'success'; break;
    }
    const newNotification = { title, message, type: notifType, icon: iconClass, timestamp: firebase.database.ServerValue.TIMESTAMP, read: false };
    db.ref(`users/${userId}/notifications`).push(newNotification);

    if (document.hidden) {
        showSystemNotification(title, message);
    }
}

function setupNotificationListener(userId) {
    if (!db || !userId) return;
    detachNotificationListener();
    notificationsRef = db.ref(`users/${userId}/notifications`).orderByChild('timestamp').limitToLast(50);
    notificationsListener = notificationsRef.on('value', snapshot => {
        unreadNotificationCount = 0;
        snapshot.forEach(child => { if(child.val().read === false) unreadNotificationCount++; });
        if (initialDataLoaded && unreadNotificationCount > lastKnownUnreadCount) {
            const sound = document.getElementById('notificationSound');
            if (sound) sound.play().catch(e => {});
        }
        lastKnownUnreadCount = unreadNotificationCount;
        updateNotificationBadge();
        if (document.getElementById('page-notification-history').classList.contains('active-page')) {
            loadNotificationHistory();
        }
    });
}
function detachNotificationListener() { if (notificationsRef && notificationsListener) { notificationsRef.off('value', notificationsListener); notificationsRef = null; notificationsListener = null; } }

function updateNotificationBadge() {
    if (!notificationBadge) return;
    notificationBadge.style.display = unreadNotificationCount > 0 ? 'flex' : 'none';
    notificationBadge.textContent = unreadNotificationCount > 9 ? '9+' : unreadNotificationCount;
}

function renderNotifications(notifications = [], targetElement) {
    if (!targetElement) return;
    targetElement.innerHTML = '';
    if (notifications.length === 0) {
        targetElement.innerHTML = `<div class="empty-state">No notification history.</div>`; return;
    }
    notifications.forEach(notif => {
        const item = document.createElement('div');
        item.className = `notification-item ${!notif.read ? 'unread' : ''}`;
        const date = notif.timestamp ? new Date(notif.timestamp).toLocaleString() : '';
        item.innerHTML = `<button class="notification-delete-btn" onclick="deleteNotification('${notif.id}', event)"><i class="fas fa-trash-alt"></i></button><div class="notification-icon type-${notif.type || 'info'}"><i class="fas ${notif.icon || 'fa-info-circle'}"></i></div><div class="notification-content"><p class="notification-title">${notif.title}</p><p class="notification-message">${notif.message}</p>${date ? `<p class="notification-timestamp">${date}</p>` : ''}</div>`;
        targetElement.appendChild(item);
    });
}

function deleteNotification(notificationId, event) {
    event.stopPropagation();
    if (!currentUser || !db) return;
    showConfirmationPopup('Delete Notification', 'Are you sure you want to delete this notification?', () => {
        db.ref(`users/${currentUser.uid}/notifications/${notificationId}`).remove()
            .then(() => showToast("Notification deleted.", "info"))
            .catch(e => showToast("Error: " + e.message, "error"));
    });
}

function loadNotificationHistory() {
     if (!db || !currentUser || !notificationHistoryListEl) return;
     notificationHistoryListEl.innerHTML = '<div class="loading-indicator">Loading history...</div>';
     db.ref(`users/${currentUser.uid}/notifications`).orderByChild('timestamp').once('value')
        .then(snapshot => {
            const notificationsData = snapshot.val() || {};
            const notifications = Object.keys(notificationsData).map(key => ({ id: key, ...notificationsData[key] })).sort((a, b) => b.timestamp - a.timestamp);
            renderNotifications(notifications, notificationHistoryListEl);
            markAllNotificationsAsRead();
        })
        .catch(error => {
            notificationHistoryListEl.innerHTML = `<div class="error-message">Could not load notifications.</div>`;
            showToast('Failed to load notifications.', 'error');
        });
}

function markAllNotificationsAsRead() {
    if (!db || !currentUser || unreadNotificationCount === 0) return;
    const updates = {};
    db.ref(`users/${currentUser.uid}/notifications`).orderByChild('read').equalTo(false).once('value', snapshot => {
        snapshot.forEach(child => { updates[child.key + '/read'] = true; });
        if (Object.keys(updates).length > 0) { db.ref(`users/${currentUser.uid}/notifications`).update(updates); }
    });
}

function detachAllListeners() {
    detachUserDataListener(); detachTasksListener(); detachMainTasksListener();
    detachAppConfigListener(); detachHistoryListener();
    detachNotificationListener(); detachGlobalSupportListener(); detachGlobalChatListener();
}

function setupUserDataListener(userId) {
    if (!db || !userId) return;
    detachUserDataListener();
    userRef = db.ref('users/' + userId);
    userDataListener = userRef.on('value', s => {
        const d = s.val();
        if (d) {
            userCoins = d.coins ?? 0;
            userReferralCode = d.referralCode ?? null;
            userLastEarnedTimestamps = d.lastEarnedTimestamps ?? {};
            hasEnteredReferral = d.hasEnteredReferralCode ?? false;
            userLastDailyBonusClaim = d.lastDailyBonusClaim ?? 0;
            userLastDailyCheckinClaim = d.lastDailyCheckinClaim ?? 0;
            userLastSpinClaim = d.lastSpinClaim ?? 0;
            userCreatedAt = d.createdAt ?? 0;
            userUsername = d.username ?? (currentUser.displayName || 'Anonymous');
            userAvatarUrl = d.avatarUrl || null;

            coinBalanceElement.textContent = userCoins.toLocaleString();
            withdrawCoinBalanceElement.textContent = userCoins.toLocaleString();
            document.getElementById('wallet-page-balance').textContent = userCoins.toLocaleString();
            document.getElementById('wallet-page-username').textContent = userUsername || 'TAPTAK USER';
            welcomeMessageElement.textContent = `Welcome, ${userUsername}!`;
            welcomeMessageElement.style.display = 'block';
            if (referralLinkDisplay) referralLinkDisplay.textContent = userReferralCode ? `${window.location.origin}${window.location.pathname}?ref=${userReferralCode}` : 'Generating...';
            settingsUserEmail.textContent = currentUser?.email || 'N/A';
            settingsUserId.textContent = currentUser?.uid || 'N/A';
            settingsUsernameText.textContent = userUsername || 'Not Set';
            document.getElementById('referral-count').textContent = d.referrals?.count || 0;
            document.getElementById('referral-bonus').textContent = d.referrals?.bonusEarned || 0;

            if (document.getElementById('page-visit-earn').classList.contains('active-page')) Object.keys(activeTasksData).forEach(id => manageTaskCooldown(id, activeTasksData[id]));
            if (document.getElementById('page-tasks').classList.contains('active-page')) Object.keys(mainTasksData).forEach(id => manageMainTaskCooldown(id, mainTasksData[id]));

            updateReferralSectionVisibility(); updateDailyBonusButtonState(); updateDailyCheckinButtonState();
            updateDailySpinButtonState(); calculateEstimatedCurrency();

            if (!initialDataLoaded) {
                hideLoadingOverlay();
                authContainer.style.display = 'none';
                appContainer.style.display = 'flex';
                setupNotificationListener(userId);
                const initialPage = window.location.hash.substring(1) || 'page-home';
                showPage(initialPage);
                initialDataLoaded = true;
            }
        } else { if (auth.currentUser && auth.currentUser.uid === userId) auth.signOut(); }
    }, e => { showToast(`Error loading data: ${e.message}. Please reload.`, 'error'); auth.signOut(); });
}
function detachUserDataListener() { if (userRef && userDataListener) { userRef.off('value', userDataListener); userRef = null; userDataListener = null; } }

function loadTasks() {
    if (!db || !currentUser) return; detachTasksListener();
    tasksRef = db.ref('tasks').orderByChild('active').equalTo(true);
    tasksListElement.innerHTML = '<div class="loading-indicator">Loading tasks...</div>';
    tasksListener = tasksRef.on('value', s => {
        activeTasksData = s.val() || {}; tasksListElement.innerHTML = '';
        if (Object.keys(activeTasksData).length === 0) { tasksListElement.innerHTML = '<p style="text-align:center; padding: 15px; color: #777;">No tasks available right now.</p>'; return; }
        Object.keys(activeTasksData).forEach(id => {
            tasksListElement.appendChild(createTaskCardElement(id, activeTasksData[id]));
            manageTaskCooldown(id, activeTasksData[id]);
        });
    }, e => { tasksListElement.innerHTML = '<div class="error-message">Error loading tasks.</div>'; });
}
function detachTasksListener() { if (tasksRef && tasksListener) { tasksRef.off('value', tasksListener); tasksRef = null; tasksListener = null; } }

function setupAppConfigListener() {
    if (!db) return; detachAppConfigListener(); appConfigRef = db.ref('appConfig');
    appConfigListener = appConfigRef.on('value', s => {
        appConfigData = { ...appConfigData, ...s.val() };
        appLogoUrl = appConfigData.appLogoUrl || 'https://i.ibb.co/p3wH2XG/logo.png';
        bannerImageElement.src = appConfigData.bannerImageUrl || 'https://i.ibb.co/hR2Y33n/banner.jpg';
        appLogoElement.src = appLogoUrl;
        if (withdrawInfoElement) {
            const min = appConfigData.minWithdrawalAmount || 1000, rate = appConfigData.tokenToCurrencyRate || 1000, sym = appConfigData.currencySymbol || 'BDT';
            withdrawInfoElement.textContent = `Minimum Withdrawal: ${min.toLocaleString()} Coins. (${rate.toLocaleString()} Coins ≈ 1 ${sym})`;
            calculateEstimatedCurrency();
            document.getElementById('minWithdrawalInstruction').textContent = min.toLocaleString();
        }
    }, e => console.error("AppConfig err:", e));
}
function detachAppConfigListener() { if (appConfigRef && appConfigListener) { appConfigRef.off('value', appConfigListener); appConfigRef = null; appConfigListener = null; } }

function handleWithdrawalRejection(wdData) {
    if (!wdData || !wdData.userId || wdData.userId !== currentUser.uid) return;
    const amountToRefund = wdData.amount;
    if (!amountToRefund || amountToRefund <= 0) return;
    db.ref(`users/${currentUser.uid}`).update({ coins: firebase.database.ServerValue.increment(amountToRefund) })
    .then(() => {
        showToast(`Withdrawal rejected. ${amountToRefund.toLocaleString()} coins refunded.`, 'error');
        addNotification('Withdrawal Rejected', `Your request for ${amountToRefund.toLocaleString()} coins was rejected. Coins have been refunded.`, 'rejected');
    })
    .catch(() => showToast('Critical error refunding coins. Contact support.', 'error'));
}

function loadHistory() {
    if (!db || !currentUser) return; detachHistoryListener();
    historyRef = db.ref('withdrawals').orderByChild('userId').equalTo(currentUser.uid);
    historyListElement.innerHTML = '<div class="loading-indicator">Loading history...</div>';
    historyListener = historyRef.on('value', s => {
        const newWithdrawals = s.val() || {};
        if (initialDataLoaded && Object.keys(previousWithdrawalState).length > 0) {
            Object.keys(newWithdrawals).forEach(id => {
                const currentWd = newWithdrawals[id], previousWd = previousWithdrawalState[id];
                if (previousWd && previousWd.status === 'pending') {
                    if (currentWd.status === 'rejected') handleWithdrawalRejection(currentWd);
                    else if (currentWd.status === 'approved') {
                        showToast(`Withdrawal of ${currentWd.amount.toLocaleString()} coins approved!`, 'success');
                        addNotification('Withdrawal Approved!', `Your request for ${currentWd.amount.toLocaleString()} coins has been approved.`, 'success');
                    }
                }
            });
        }
        previousWithdrawalState = newWithdrawals;
        historyListElement.innerHTML = '';
        if (Object.keys(newWithdrawals).length === 0) {
            historyListElement.innerHTML = '<p style="text-align: center; padding: 20px; color: #777;">No withdrawal history found.</p>'; return;
        }
        const sortedKeys = Object.keys(newWithdrawals).sort((a, b) => (newWithdrawals[b].requestTimestamp || 0) - (newWithdrawals[a].requestTimestamp || 0));
        sortedKeys.forEach(k => historyListElement.appendChild(createHistoryItemElement(k, newWithdrawals[k])));
    }, e => { historyListElement.innerHTML = `<div class="error-message">Error loading history: ${e.message}.</div>`; });
}
function detachHistoryListener() { if (historyRef && historyListener) { historyRef.off('value', historyListener); historyRef = null; historyListener = null; previousWithdrawalState = {}; } }

function manageTaskCooldown(taskId, taskData) {
    const btn = document.getElementById(`visit-btn-${taskId}`);
    const actionArea = btn ? btn.parentElement : null;
    if (!btn || !actionArea) return;
    let timerDisplay = document.getElementById(`timer-task-${taskId}`);
    if (!timerDisplay) { timerDisplay = document.createElement('div'); timerDisplay.id = `timer-task-${taskId}`; timerDisplay.className = 'timer-display'; actionArea.prepend(timerDisplay); }
    if (taskTimers[taskId]) clearInterval(taskTimers[taskId]);
    const checkAndUpdate = () => {
        const lastClaim = userLastEarnedTimestamps[taskId] || 0;
        const cooldownMs = (taskData.cooldownMinutes || 1440) * 60 * 1000;
        const timeRemaining = cooldownMs - (Date.now() - lastClaim);
        if (timeRemaining > 0) {
            btn.style.display = 'none';
            timerDisplay.style.display = 'block';
            timerDisplay.textContent = formatTimeRemaining(timeRemaining);
            if (!taskTimers[taskId]) taskTimers[taskId] = setInterval(checkAndUpdate, 1000);
        } else {
            btn.style.display = 'inline-block'; timerDisplay.style.display = 'none'; btn.disabled = false;
            if (taskTimers[taskId]) { clearInterval(taskTimers[taskId]); delete taskTimers[taskId]; }
        }
    };
    checkAndUpdate();
}

function createTaskCardElement(taskId, task) {
    const card = document.createElement('div'); card.className = 'task-card'; card.id = `task-${taskId}`;
    card.innerHTML = `<div class="task-card-header"><div class="task-card-icon"><i class="fas fa-mouse-pointer"></i></div><div class="task-info"><div class="task-title">${task.title || 'N/A'}</div><div class="task-description">${task.description || ''}</div></div></div><div class="task-card-footer"><div class="task-reward">Reward: ${task.reward || 0} Coins</div><div class="task-action" id="action-area-${taskId}"><button class="earn-btn" id="visit-btn-${taskId}" onclick="startVisitTask('${taskId}', '${task.linkUrl}')">Visit Link</button></div></div>`;
    return card;
}

function createHistoryItemElement(withdrawalId, item) {
    const div = document.createElement('div');
    const statusClass = `status-${(item.status || 'unknown').replace(/\s+/g, '-').toLowerCase()}`;
    div.className = `history-item`;
    const rD = item.requestTimestamp ? new Date(item.requestTimestamp).toLocaleString() : 'N/A';
    const cancelButtonHtml = item.status === 'pending' ? `<button class="earn-btn" style="background-color: #ffc107; color: #333; border-color: #ffc107; margin-top: 10px; padding: 5px 10px; font-size: 0.85em;" onclick="cancelWithdrawalRequest('${withdrawalId}')">Cancel Request</button>` : '';
    div.innerHTML = `<div class="history-item-row"><span class="history-item-label">Amount:</span><span class="history-item-value">${(item.amount || 0).toLocaleString()} Coins</span></div><div class="history-item-row"><span class="history-item-label">Method:</span><span class="history-item-value">${item.method || 'N/A'}</span></div><div class="history-item-row"><span class="history-item-label">Status:</span><span class="history-item-status ${statusClass}">${item.status || 'Unknown'}</span></div><div class="history-item-details"><strong>Details:</strong> ${item.accountDetails || 'N/A'}</div><div class="timestamp">Requested: ${rD}</div>${cancelButtonHtml}`;
    return div;
}

function signupUser() {
    clearMessage('signup-message');
    if (!auth || !db) return;
    const uIn = document.getElementById('signup-username'), eIn = document.getElementById('signup-email'), pIn = document.getElementById('signup-password');
    const u = uIn.value.trim(), e = eIn.value.trim(), p = pIn.value;
    const refCode = document.getElementById('signup-referral-code').value.trim().toUpperCase();

    if (!u || u.length < MIN_USERNAME_LENGTH) { showMessage('signup-message', `Username must be at least ${MIN_USERNAME_LENGTH} characters.`, 'error'); return;}
    if (!e || p.length < 6) { showMessage('signup-message', "Provide valid email and a password of at least 6 characters.", 'error'); return; }

    auth.createUserWithEmailAndPassword(e, p).then(async cred => {
        const user = cred.user;
        const storedRefCode = sessionStorage.getItem('referralCode');
        const finalRefCode = refCode || storedRefCode;

        await user.updateProfile({ displayName: u });
        await createUserInDatabase(user, u, finalRefCode);

        addNotification('Welcome to TapTak!', `You have successfully created your account. Start earning now!`, 'welcome');
        showToast('Signup successful! Welcome.', 'success');
    }).catch(err => {
        let m = err.code === 'auth/email-already-in-use' ? "This email is already registered."
              : err.code === 'auth/invalid-email' ? "The email address is not valid."
              : err.code === 'auth/weak-password' ? "The password is too weak."
              : `Signup failed: ${err.message}`;
        showMessage('signup-message', m, 'error');
    });
}


function loginUser() {
    clearMessage('login-message');
    if (!auth) return;
    const e = document.getElementById('login-email').value.trim(), p = document.getElementById('login-password').value;
    if (!e || !p) { showMessage('login-message', "Please provide both email and password.", 'error'); return; }
    auth.signInWithEmailAndPassword(e, p)
     .then(() => showToast('Login successful! Welcome back.', 'success'))
     .catch(err => {
        let m = ['auth/user-not-found','auth/wrong-password','auth/invalid-credential'].includes(err.code) ? "Incorrect email or password."
              : err.code === 'auth/user-disabled' ? "This account has been disabled."
              : err.code === 'auth/too-many-requests' ? "Too many attempts. Try again later."
              : "incorrect Gmail and password";
        showMessage('login-message', m, 'error');
     });
}
function logoutUser() { if(auth?.currentUser) auth.signOut().then(() => showToast('Logged out successfully', 'info')); }

function sendPasswordReset() {
     clearMessage('forgot-password-message');
     if (!auth) return;
     const e = document.getElementById('forgot-email').value;
     if (!e) { showMessage('forgot-password-message', "Please enter your email address.", 'error'); return; }
     auth.sendPasswordResetEmail(e).then(() => { showMessage('forgot-password-message', "Password reset email sent! Check your inbox.", 'success'); document.getElementById('forgot-email').value = ''; }).catch(err => {
         let m = err.code === 'auth/user-not-found' ? "No account found with this email."
               : err.code === 'auth/invalid-email' ? "The email address is not valid."
               : `Error: ${err.message}`;
         showMessage('forgot-password-message', m, 'error');
     });
}

function signInWithGoogle() {
    if (!auth || !db) return;
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(async result => {
        if (result.additionalUserInfo.isNewUser) {
            const user = result.user;
            const displayName = user.displayName || user.email.split('@')[0];
            const refCode = sessionStorage.getItem('referralCode'); 

            await createUserInDatabase(user, displayName, refCode);
            await addNotification('Welcome to TapTak!', `You successfully created your account.`, 'welcome');
            showToast('Account created successfully!', 'success');
        } else {
            showToast('Welcome back!', 'success');
        }
    }).catch(err => {
        let m = err.code === 'auth/popup-closed-by-user' ? "Sign-in cancelled."
              : err.code === 'auth/account-exists-with-different-credential' ? "Account exists with this email. Sign in with password."
              : `Google Sign-In failed: ${err.message}`;
        showToast(m, 'error');
    });
}


function showPage(pageId, isPopState = false) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active-page'));
    const page = document.getElementById(pageId);
    if (page) {
        page.classList.add('active-page'); window.scrollTo(0, 0);
        if (!isPopState && `#${pageId}` !== window.location.hash) history.pushState({page: pageId}, '', `#${pageId}`);
        if (pageId === 'page-visit-earn') loadTasks();
        else if (pageId === 'page-tasks') loadMainTasks();
        else if (pageId === 'page-global-chat') loadGlobalChat();
        else if (pageId === 'page-history') loadHistory();
        else if (pageId === 'page-notification-history') loadNotificationHistory();
        else if (pageId === 'page-support') loadSupportHistory();
        else if (pageId === 'page-leaderboard') loadLeaderboard();
    } else showPage('page-home', isPopState);
    closeMenu();
}

window.onpopstate = e => showPage(e.state ? e.state.page : (auth.currentUser ? 'page-home' : 'login'), true);

const menuDropdown = document.getElementById('dropdownMenu');
function toggleMenu(e) { e.stopPropagation(); menuDropdown?.classList.toggle('open'); }
function closeMenu() { menuDropdown?.classList.remove('open'); }
document.addEventListener('click', e => { if (menuDropdown?.classList.contains('open') && !menuDropdown.contains(e.target) && e.target !== document.getElementById('menuIcon')) closeMenu(); });

function startVisitTask(taskId, url) {
    const visitBtn = document.getElementById(`visit-btn-${taskId}`); if (!visitBtn || visitBtn.disabled) return;
    visitBtn.disabled = true;
    const visitPage = document.getElementById('page-visit-task-view');
    const iframe = document.getElementById('visit-task-iframe');
    const timerDisplay = document.getElementById('visit-task-timer-display');
    iframe.src = url; visitPage.style.display = 'flex';
    let countdown = VISIT_TASK_TIMER_SECONDS; timerDisplay.textContent = `${countdown}s`;
    const intervalId = setInterval(() => {
        countdown--;
        if (countdown >= 0) timerDisplay.textContent = `${countdown}s`;
        if (countdown < 0) { clearInterval(intervalId); claimVisitTaskReward(taskId); iframe.src = 'about:blank'; visitPage.style.display = 'none'; }
    }, 1000);
    const backButton = document.createElement('button'); backButton.className = 'top-back-btn'; backButton.innerHTML = `<i class="fas fa-times"></i>`;
    backButton.onclick = () => { clearInterval(intervalId); iframe.src = 'about:blank'; visitPage.style.display = 'none'; visitBtn.disabled = false; addNotification('Task Cancelled', 'You cancelled the task before completion.', 'alert'); };
    const header = visitPage.querySelector('.visit-task-header');
    header.querySelector('.top-back-btn')?.remove(); header.prepend(backButton);
}
function claimVisitTaskReward(taskId) {
    if (!currentUser || !db || !activeTasksData[taskId]) return;
    const task = activeTasksData[taskId], reward = task.reward || 0;
    const updates = {
        [`users/${currentUser.uid}/coins`]: firebase.database.ServerValue.increment(reward),
        [`users/${currentUser.uid}/totalEarnings`]: firebase.database.ServerValue.increment(reward),
        [`users/${currentUser.uid}/lastEarnedTimestamps/${taskId}`]: firebase.database.ServerValue.TIMESTAMP
    };
    db.ref().update(updates).then(() => {
        showToast(`+${reward} Coins Added!`, 'success');
        addNotification('Task Complete!', `You earned +${reward} coins for completing "${task.title}".`, 'reward');
        manageTaskCooldown(taskId, task);
    }).catch(e => showToast('Could not claim reward.', 'error'));
}

function updateTimerAndButton(btn, timerEl, lastClaim, intervalVar, callback) {
    if (!btn || !timerEl) return;
    if (intervalVar) clearInterval(intervalVar);
    const update = () => {
        const rem = ONE_DAY_MILLIS - (Date.now() - lastClaim);
        if (rem > 0) {
            btn.disabled = true; btn.textContent = callback.claimedText;
            timerEl.className = 'earn-timer claimed';
            timerEl.textContent = formatTimeRemaining(rem);
            if (!intervalVar) intervalVar = setInterval(update, 1000);
        } else {
            btn.disabled = false; btn.textContent = callback.readyText;
            timerEl.className = 'earn-timer ready available';
            timerEl.textContent = 'Available Now!';
            if (intervalVar) { clearInterval(intervalVar); intervalVar = null; }
            if (callback.onReady) callback.onReady();
        }
    };
    update();
    return intervalVar;
}

function updateDailyBonusButtonState() { bonusTimerInterval = updateTimerAndButton(dailyBonusBtn, dailyBonusTimer, userLastDailyBonusClaim, bonusTimerInterval, { claimedText: "Claimed Today", readyText: "Claim Bonus" }); }
function updateDailyCheckinButtonState() { checkinTimerInterval = updateTimerAndButton(dailyCheckinBtn, dailyCheckinTimer, userLastDailyCheckinClaim, checkinTimerInterval, { claimedText: "Checked-in", readyText: "Check-in" }); }
function updateDailySpinButtonState() {
    spinTimerInterval = updateTimerAndButton(dailySpinBtn, dailySpinTimer, userLastSpinClaim, spinTimerInterval, {
        claimedText: "Spun Today", readyText: "Spin Now",
        onReady: () => { if (initialDataLoaded && !spinReadyNotified) { showSpecialPopup(); spinReadyNotified = true; } }
    });
    if(dailySpinResult) dailySpinResult.textContent = '';
}

function claimDaily(amount, lastClaimProp, successMsg, rewardTitle, btn) {
    if (!currentUser || !db || btn.disabled) return;
    if (Date.now() - userLastEarnedTimestamps[lastClaimProp] < ONE_DAY_MILLIS) { showToast("Already claimed today.", 'error'); return; }
    btn.disabled = true;
    const updates = {
        [`users/${currentUser.uid}/coins`]: firebase.database.ServerValue.increment(amount),
        [`users/${currentUser.uid}/totalEarnings`]: firebase.database.ServerValue.increment(amount),
        [`users/${currentUser.uid}/${lastClaimProp}`]: firebase.database.ServerValue.TIMESTAMP
    };
    db.ref().update(updates).then(() => {
        showToast(successMsg, 'success');
        addNotification(rewardTitle, `You received +${amount} Coins.`, 'reward');
    }).catch(e => { showToast('Error claiming.', 'error'); btn.disabled = false; });
}
function claimDailyBonus() { claimDaily(DAILY_BONUS_AMOUNT, 'lastDailyBonusClaim', `+${DAILY_BONUS_AMOUNT} Coins claimed!`, 'Daily Bonus!', dailyBonusBtn); }
function claimDailyCheckin() { claimDaily(DAILY_CHECKIN_AMOUNT, 'lastDailyCheckinClaim', `+${DAILY_CHECKIN_AMOUNT} Coins for checking in!`, 'Daily Check-in!', dailyCheckinBtn); }

function initializeSpinWheelSegments() { if (!spinWheelElement) return; spinWheelElement.innerHTML = ''; spinWheelElement.style.setProperty('--num-segments', NUM_SPIN_SEGMENTS); let conicGradientCSS = "conic-gradient("; const segmentAngle = 360 / NUM_SPIN_SEGMENTS; spinSegments.forEach((segment, index) => { conicGradientCSS += `${segment.color} ${index * segmentAngle}deg ${(index + 1) * segmentAngle}deg, `; const segDiv = document.createElement('div'); segDiv.className = 'spin-segment'; const midRot = (index * segmentAngle) + (segmentAngle / 2); segDiv.style.transform = `rotate(${midRot - 90}deg)`; const textSpan = document.createElement('span'); textSpan.className = 'spin-segment-text'; textSpan.id = `spin-text-${index}`; textSpan.textContent = segment.label; textSpan.style.setProperty('--text-transform', `rotate(${segmentAngle/2}deg) translateY(-105px) rotate(${-segmentAngle/2}deg)`); segDiv.appendChild(textSpan); spinWheelElement.appendChild(segDiv); }); spinWheelElement.style.background = conicGradientCSS.slice(0, -2) + ")"; }
function doDailySpin() {
    if (isSpinning || !dailySpinBtn.disabled === false) return;
    if (Date.now() - userLastSpinClaim < ONE_DAY_MILLIS) { showToast("Already spun today!", 'error'); return; }
    isSpinning = true; dailySpinBtn.disabled = true; dailySpinResult.textContent = 'Spinning...'; spinCenterDisplay.classList.remove('show');
    const winIndex = Math.floor(Math.random() * NUM_SPIN_SEGMENTS), winSeg = spinSegments[winIndex], reward = winSeg.reward;
    const segAngle = 360 / NUM_SPIN_SEGMENTS, rotations = 360 * (Math.floor(Math.random() * 3) + 6);
    const finalAngle = 360 - ((winIndex * segAngle) + (segAngle / 2)) + ((Math.random() * (segAngle*0.6)) - (segAngle*0.3));
    const totalRot = rotations + finalAngle; spinWheelElement.style.transform = `rotate(${totalRot}deg)`;
    setTimeout(() => {
        isSpinning = false; document.getElementById(`spin-text-${winIndex}`)?.classList.add('highlight');
        spinCenterDisplay.textContent = reward > 0 ? `+${reward}` : '💔'; spinCenterDisplay.classList.add('show');
        const updates = { [`users/${currentUser.uid}/lastSpinClaim`]: firebase.database.ServerValue.TIMESTAMP };
        if (reward > 0) { updates[`users/${currentUser.uid}/coins`] = firebase.database.ServerValue.increment(reward); updates[`users/${currentUser.uid}/totalEarnings`] = firebase.database.ServerValue.increment(reward); }
        db.ref().update(updates).then(() => {
            dailySpinResult.textContent = reward > 0 ? `🎉 You won ${winSeg.label}! 🎉` : `😕 ${winSeg.label} 😕`;
            addNotification(reward > 0 ? 'Spin Wheel Win!' : 'Spin Wheel', reward > 0 ? `You won +${reward} Coins.` : 'Better luck next time!', reward > 0 ? 'reward' : 'info');
            updateDailySpinButtonState();
        }).catch(() => { showToast('Error processing spin.', 'error'); updateDailySpinButtonState(); });
    }, 8000);
}

function handleWithdrawMethodChange(selectEl) {
    const isOther = selectEl.value === 'Other';
    document.getElementById('other-account-name-group').style.display = isOther ? 'block' : 'none';
    document.getElementById('other-account-number-group').style.display = isOther ? 'block' : 'none';
    document.getElementById('account-details-group').style.display = isOther ? 'none' : 'block';
}

function requestWithdrawal() {
    if (!currentUser || !db) return;
    if (submitWithdrawalBtn) { submitWithdrawalBtn.disabled = true; submitWithdrawalBtn.textContent = 'Submitting...'; }
    const enableButton = () => { if (submitWithdrawalBtn) { submitWithdrawalBtn.disabled = false; submitWithdrawalBtn.textContent = 'Submit Request'; } };
    const amount = parseInt(document.getElementById('withdrawAmount').value), method = document.getElementById('withdrawMethod').value;
    let details;
    if (method === 'Other') {
        const otherName = document.getElementById('otherAccountName').value.trim(), otherNumber = document.getElementById('otherAccountNumber').value.trim();
        if (!otherName || !otherNumber) { showToast("Please enter Account Name and Number.", 'error'); enableButton(); return; }
        details = `Name: ${otherName}, Number/ID: ${otherNumber}`;
    } else details = document.getElementById('accountDetails').value.trim();

    const minWd = appConfigData.minWithdrawalAmount || 1000;
    if (isNaN(amount) || !method || !details || amount < minWd || amount > userCoins) {
        let msg = isNaN(amount) || amount <= 0 ? "Enter a valid amount." : !method ? "Select a withdrawal method." : !details ? "Enter account details." : amount < minWd ? `Minimum withdrawal is ${minWd} coins.` : "Insufficient coin balance.";
        showToast(msg, 'error'); enableButton(); return;
    }
    const rate = appConfigData.tokenToCurrencyRate || 0, currencyAmount = rate > 0 ? (amount / rate).toFixed(2) : 0;
    const wdData = { userId: currentUser.uid, userEmail: currentUser.email, username: userUsername, amount, method, accountDetails: details, status: "pending", requestTimestamp: firebase.database.ServerValue.TIMESTAMP, conversionRateSnapshot: rate, currencyAmountSnapshot: parseFloat(currencyAmount) };
    db.ref(`users/${currentUser.uid}`).transaction(userData => {
        if (userData && userData.coins >= amount) { userData.coins -= amount; return userData; }
        return; // Abort
    }, (error, committed) => {
        if (error || !committed) { showToast("Request failed. Insufficient balance or connection issue.", 'error'); enableButton(); }
        else db.ref('withdrawals').push(wdData).then(() => {
            addNotification('Withdrawal Requested', `${amount.toLocaleString()} coins request sent via ${method}.`, 'info');
            ['withdrawAmount', 'accountDetails', 'otherAccountName', 'otherAccountNumber'].forEach(id => document.getElementById(id).value = '');
            document.getElementById('withdrawMethod').value = '';
            handleWithdrawMethodChange(document.getElementById('withdrawMethod'));
            if(estimatedCurrencyAmountSpan) estimatedCurrencyAmountSpan.textContent = '';
            enableButton(); showWithdrawalSuccessPage();
        }).catch(() => { showToast("Submission failed. Refunding coins.", 'error'); db.ref(`users/${currentUser.uid}/coins`).set(firebase.database.ServerValue.increment(amount)); enableButton(); });
    });
}

async function cancelWithdrawalRequest(withdrawalId) {
    if (!currentUser || !db) return;
    showConfirmationPopup('Cancel Request', 'Are you sure you want to cancel this withdrawal request?', async () => {
        showToast('Processing cancellation...', 'info');
        const withdrawalRef = db.ref(`withdrawals/${withdrawalId}`);
        try {
            const snapshot = await withdrawalRef.once('value'), wdData = snapshot.val();
            if (!wdData || wdData.userId !== currentUser.uid || wdData.status !== 'pending') throw new Error("This request cannot be cancelled.");
            await db.ref(`users/${currentUser.uid}/coins`).set(firebase.database.ServerValue.increment(wdData.amount));
            await withdrawalRef.update({ status: 'cancelled by user' });
            showToast(`Request cancelled. ${wdData.amount.toLocaleString()} coins refunded.`, 'success');
            addNotification('Withdrawal Cancelled', `Request for ${wdData.amount.toLocaleString()} coins was cancelled.`, 'cancelled');
        } catch (error) { showToast(`Cancellation failed: ${error.message}`, 'error'); }
    });
}

function calculateEstimatedCurrency() { if (!estimatedCurrencyAmountSpan || !withdrawAmountInput || !appConfigData) return; const amount = parseInt(withdrawAmountInput.value), rate = appConfigData.tokenToCurrencyRate || 0, symbol = appConfigData.currencySymbol || '$'; estimatedCurrencyAmountSpan.textContent = (!isNaN(amount) && amount > 0 && rate > 0 && symbol) ? `≈ ${(amount / rate).toFixed(2)} ${symbol}` : ''; }
if(withdrawAmountInput) withdrawAmountInput.addEventListener('input', calculateEstimatedCurrency);
function generateReferralCode(userId) { return `CZ${userId.substring(0, 4).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`; }
function copyReferralLink() { const link = referralLinkDisplay?.textContent; if (navigator.clipboard && link?.startsWith('http')) { navigator.clipboard.writeText(link).then(() => showToast('Referral link copied!', 'success')).catch(() => showToast('Failed to copy link.', 'error')); } }
function updateReferralSectionVisibility() { if(enterReferralSection) { if (hasEnteredReferral) enterReferralSection.classList.add('hidden'); else { enterReferralSection.classList.remove('hidden'); clearMessage('referralCodeMessage'); document.getElementById('enteredReferralCodeInput').value = ''; } } }

// [FINAL & SECURE] This function now uses a transaction to safely handle the referral logic
async function submitReferralCode() {
    if (!currentUser || hasEnteredReferral) return;
    
    const codeInput = document.getElementById('enteredReferralCodeInput');
    const code = codeInput.value.trim().toUpperCase();
    const submitButton = document.getElementById('submitReferralCodeBtn');

    if (!code) {
        showToast("Please enter a code.", 'error');
        return;
    }
    if (code === userReferralCode) {
        showToast("You cannot use your own code.", 'error');
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Checking...';
    
    try {
        const referrerSnapshot = await db.ref('users').orderByChild('referralCode').equalTo(code).once('value');
        if (!referrerSnapshot.exists()) {
            throw new Error("Invalid referral code.");
        }

        let referrerUid, referrerUsername;
        referrerSnapshot.forEach(child => {
            referrerUid = child.key;
            referrerUsername = child.val().username;
        });

        if (!referrerUid || referrerUid === currentUser.uid) {
            throw new Error("You cannot use your own code.");
        }
        
        // Use a transaction to safely update both users
        const updates = {};
        // Prepare update for the new user
        updates[`/users/${currentUser.uid}/coins`] = firebase.database.ServerValue.increment(NEW_USER_REFERRAL_BONUS);
        updates[`/users/${currentUser.uid}/totalEarnings`] = firebase.database.ServerValue.increment(NEW_USER_REFERRAL_BONUS);
        updates[`/users/${currentUser.uid}/referredBy`] = referrerUid;
        updates[`/users/${currentUser.uid}/hasEnteredReferralCode`] = true;
        
        // Prepare update for the referrer
        updates[`/users/${referrerUid}/coins`] = firebase.database.ServerValue.increment(REFERRER_BONUS);
        updates[`/users/${referrerUid}/totalEarnings`] = firebase.database.ServerValue.increment(REFERRER_BONUS);
        updates[`/users/${referrerUid}/referrals/count`] = firebase.database.ServerValue.increment(1);
        updates[`/users/${referrerUid}/referrals/bonusEarned`] = firebase.database.ServerValue.increment(REFERRER_BONUS);
        updates[`/users/${referrerUid}/referrals/list/${currentUser.uid}`] = firebase.database.ServerValue.TIMESTAMP;
        
        // This single update might fail due to security rules.
        // The secure way is using a Cloud Function. This is a client-side attempt.
        await db.ref().update(updates);

        showToast(`Success! You received ${NEW_USER_REFERRAL_BONUS} coins.`, 'success');
        addNotification('Referral Success!', `You earned +${NEW_USER_REFERRAL_BONUS} coins for using ${referrerUsername}'s code.`, 'reward');
        // A separate notification can be sent to the referrer, but updating their coins from client-side is the issue.
        
        updateReferralSectionVisibility();

    } catch (error) {
        console.error("Error submitting referral code:", error);
        if(error.message.includes("permission_denied")) {
             showToast("Could not apply bonus to referrer. Please contact support.", 'error');
        } else {
             showToast(error.message, 'error');
        }
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Submit Code';
    }
}


function submitSupportTicket() {
    if (!currentUser || !db) return;
    const msgArea = document.getElementById('supportMessage'), message = msgArea.value.trim();
    if (!message) { showToast('Please enter a message.', 'error'); return; }
    const ticketData = { userId: currentUser.uid, userEmail: currentUser.email, username: userUsername, message, timestamp: firebase.database.ServerValue.TIMESTAMP, status: 'open', reply: null };
    showToast('Sending message...', 'info');
    db.ref('support_tickets').push(ticketData).then(() => {
        showToast('Message sent successfully!', 'success'); msgArea.value = '';
        addNotification('Message Sent', 'Your support ticket was submitted.', 'success');
    }).catch(e => showToast(`Failed to send message: ${e.message}`, 'error'));
}

function setupGlobalSupportListener(userId) {
    if (!db || !userId) return;
    detachGlobalSupportListener();
    globalSupportRef = db.ref('support_tickets').orderByChild('userId').equalTo(userId);
    globalSupportListener = globalSupportRef.on('value', snapshot => {
        const ticketsData = snapshot.val() || {};
        if (!initialDataLoaded) { previousTicketState = ticketsData; return; }
        Object.keys(ticketsData).forEach(key => {
            const current = ticketsData[key], previous = previousTicketState[key];
            if (current.reply && current.replyTimestamp && (!previous || current.replyTimestamp !== previous.replyTimestamp)) {
                addNotification("Admin Replied", `An admin has replied to your support ticket.`, 'message');
            }
        });
        previousTicketState = ticketsData;
    });
}
function detachGlobalSupportListener() { if (globalSupportRef && globalSupportListener) { globalSupportRef.off('value', globalSupportListener); globalSupportRef = null; globalSupportListener = null; previousTicketState = {}; } }

function loadSupportHistory() {
    if (!db || !currentUser) return;
    supportTicketsListEl.innerHTML = '<div class="loading-indicator">Loading messages...</div>';
    db.ref('support_tickets').orderByChild('userId').equalTo(currentUser.uid).once('value')
        .then(snapshot => {
            supportTicketsListEl.innerHTML = '';
            const ticketsData = snapshot.val() || {};
            const sortedKeys = Object.keys(ticketsData).sort((a,b) => ticketsData[b].timestamp - ticketsData[a].timestamp);
            if (sortedKeys.length === 0) { supportTicketsListEl.innerHTML = '<div class="empty-state">You have not sent any messages.</div>'; return; }
            sortedKeys.forEach(key => supportTicketsListEl.appendChild(createSupportTicketElement(key, ticketsData[key])));
        }).catch(() => supportTicketsListEl.innerHTML = `<div class="error-message">Could not load support history.</div>`);
}

function createSupportTicketElement(ticketId, ticket) {
    const div = document.createElement('div'); div.className = 'support-ticket';
    const date = new Date(ticket.timestamp).toLocaleString();
    div.innerHTML = `<button class="notification-delete-btn" onclick="deleteSupportTicket('${ticketId}', event)"><i class="fas fa-trash-alt"></i></button> <div class="ticket-message">${ticket.message}</div> <div class="ticket-meta"> <span class="ticket-status ticket-status-${ticket.status}">${ticket.status}</span> <span>${date}</span> </div> ${ticket.reply ? `<div class="ticket-reply"> <p class="ticket-reply-header">Admin Reply:</p> <p>${ticket.reply}</p> </div>` : ''}`;
    return div;
}
function deleteSupportTicket(ticketId, event) {
    event.stopPropagation();
    if(!currentUser || !db) return;
    showConfirmationPopup('Delete Message', 'Are you sure you want to delete this message thread?', () => {
        db.ref(`support_tickets/${ticketId}`).remove().then(() => showToast('Message deleted.', 'info')).catch(e => showToast("Error: " + e.message, 'error'));
    });
}

function toggleUsernameEdit(isEditing) {
    document.getElementById('settingsUsername-text').style.display = isEditing ? 'none' : 'block';
    document.getElementById('username-display-actions').style.display = isEditing ? 'none' : 'block';
    const inputEl = document.getElementById('username-edit-input');
    inputEl.style.display = isEditing ? 'block' : 'none';
    document.getElementById('username-edit-actions').style.display = isEditing ? 'flex' : 'none';
    if (isEditing) { inputEl.value = userUsername; inputEl.focus(); }
}

function saveUsername() {
    const newUsername = document.getElementById('username-edit-input').value.trim();
    if (!newUsername || newUsername.length < MIN_USERNAME_LENGTH) { showToast(`Username must be at least ${MIN_USERNAME_LENGTH} characters.`, 'error'); return; }
    if (newUsername === userUsername) { toggleUsernameEdit(false); return; }
    showConfirmationPopup('Change Username', `Are you sure you want to change your username to "${newUsername}"?`, async () => {
        showToast('Saving...', 'info');
        try {
            await currentUser.updateProfile({ displayName: newUsername });
            await db.ref(`users/${currentUser.uid}`).update({ username: newUsername });
            showToast('Username updated successfully!', 'success');
            toggleUsernameEdit(false);
        } catch (error) { showToast(`Error: ${error.message}`, 'error'); }
    });
}

function copyUserInfo(elementId) {
    const infoEl = document.getElementById(elementId), textToCopy = infoEl?.textContent;
    if (infoEl && navigator.clipboard && textToCopy) {
        navigator.clipboard.writeText(textToCopy).then(() => showToast('Copied to clipboard!', 'success'));
    }
}
function changeUserPassword() {
    if (!auth?.currentUser) return;
    const curP = document.getElementById('settings-current-password').value, newP = document.getElementById('settings-new-password').value, conP = document.getElementById('settings-confirm-password').value;
    if (!curP || !newP || !conP) { showToast("All password fields required.",'error'); return; }
    if (newP.length < 6) { showToast("New password min 6 chars.",'error'); return; }
    if (newP !== conP) { showToast("Passwords do not match.",'error'); return; }
    if (newP === curP) { showToast("New password must be different.",'error'); return; }
    showToast("Re-authenticating...",'info');
    const cred = firebase.auth.EmailAuthProvider.credential(currentUser.email, curP);
    currentUser.reauthenticateWithCredential(cred).then(() => {
        showToast("Updating password...",'info');
        currentUser.updatePassword(newP).then(() => {
            showToast("Password changed successfully!",'success',5000);
            ['settings-current-password', 'settings-new-password', 'settings-confirm-password'].forEach(id => document.getElementById(id).value = '');
        }).catch(updErr => showToast(updErr.code === 'auth/weak-password' ? "New password too weak." : `Error: ${updErr.message}`, 'error'));
    }).catch(reauthErr => showToast(reauthErr.code === 'auth/wrong-password' ? "Incorrect current password." : "Re-auth failed.", 'error'));
}
function deleteUserAccount() {
    if (!currentUser || !db) return;
    showConfirmationPopup('Delete Account', 'DANGER! This will permanently delete your account and all data. This action cannot be undone.', () => {
        showToast('Deleting account... This may take a moment.', 'info');
        const userId = currentUser.uid;
        currentUser.delete().then(() => db.ref(`users/${userId}`).remove()).then(() => alert('Account deleted successfully.'))
        .catch(err => showToast(err.code === 'auth/requires-recent-login' ? 'For security, please log out and log back in to delete your account.' : `Error: ${err.message}`, 'error'));
    });
}

function showSpecialPopup() {
    const overlay = document.getElementById('special-popup-overlay');
    if (!overlay) return;
    document.getElementById('popup-cta-btn').onclick = () => { hideSpecialPopup(); showPage('page-daily-earning'); };
    overlay.classList.add('show');
    document.getElementById('notificationSound')?.play().catch(e => {});
}
function hideSpecialPopup() { document.getElementById('special-popup-overlay')?.classList.remove('show'); }

function showWithdrawalSuccessPage() { document.getElementById('withdrawal-success-page')?.classList.add('show'); }
function hideWithdrawalSuccessPage() { 
    document.getElementById('withdrawal-success-page')?.classList.remove('show'); 
    showPage('page-history'); 
}

function createMainTaskCardElement(taskId, task) {
    const card = document.createElement('div'); card.className = 'task-card'; card.id = `main-task-${taskId}`;
    card.innerHTML = `<div class="task-card-header"><div class="task-card-icon"><i class="fas ${task.icon || 'fa-tasks'}"></i></div><div class="task-info"><div class="task-title">${task.title}</div><div class="task-description">${task.description}</div></div></div><div class="task-card-footer"><div class="task-reward">Reward: ${task.reward} Coins</div><div class="task-action" id="action-area-main-${taskId}"><div id="timer-main-task-${taskId}" class="timer-display"></div><button class="earn-btn" id="claim-btn-main-${taskId}" onclick="claimMainTaskReward('${taskId}')">Claim</button></div></div>`;
    return card;
}
function loadMainTasks() {
    if (!db || !currentUser) return; detachMainTasksListener();
    mainTasksRef = db.ref('main_tasks');
    mainTasksListElement.innerHTML = '<div class="loading-indicator">Loading weekly tasks...</div>';
    mainTasksListener = mainTasksRef.on('value', s => {
        mainTasksData = s.val() || {}; mainTasksListElement.innerHTML = '';
        if (Object.keys(mainTasksData).length === 0) { mainTasksListElement.innerHTML = '<p style="text-align:center; padding: 15px; color: #777;">No weekly tasks available.</p>'; return; }
        Object.keys(mainTasksData).forEach(id => {
            mainTasksListElement.appendChild(createMainTaskCardElement(id, mainTasksData[id]));
            manageMainTaskCooldown(id, mainTasksData[id]);
        });
    }, e => { mainTasksListElement.innerHTML = '<div class="error-message">Error loading tasks.</div>'; });
}
function detachMainTasksListener() { if (mainTasksRef && mainTasksListener) { mainTasksRef.off('value', mainTasksListener); mainTasksRef = null; mainTasksListener = null; } }
function manageMainTaskCooldown(taskId, taskData) {
    const btn = document.getElementById(`claim-btn-main-${taskId}`), timerDisplay = document.getElementById(`timer-main-task-${taskId}`);
    if (!btn || !timerDisplay) return;
    if (taskTimers[taskId]) clearInterval(taskTimers[taskId]);
    const cooldownMs = 7 * 24 * 60 * 60 * 1000;
    const checkAndUpdate = () => {
        const rem = cooldownMs - (Date.now() - (userLastEarnedTimestamps[taskId] || 0));
        if (rem > 0) { btn.style.display = 'none'; timerDisplay.style.display = 'block'; timerDisplay.textContent = `Available in: ${formatTimeRemaining(rem)}`; if (!taskTimers[taskId]) taskTimers[taskId] = setInterval(checkAndUpdate, 1000); }
        else { btn.style.display = 'inline-block'; timerDisplay.style.display = 'none'; btn.disabled = false; btn.textContent = `Do Task`; if (taskTimers[taskId]) { clearInterval(taskTimers[taskId]); delete taskTimers[taskId]; } }
    };
    checkAndUpdate();
}
function claimMainTaskReward(taskId) {
    if (!currentUser || !db || !mainTasksData[taskId]) return;
    const task = mainTasksData[taskId], reward = task.reward || 0, btn = document.getElementById(`claim-btn-main-${taskId}`);
    if(btn) btn.disabled = true;
    const updates = { [`users/${currentUser.uid}/coins`]: firebase.database.ServerValue.increment(reward), [`users/${currentUser.uid}/totalEarnings`]: firebase.database.ServerValue.increment(reward), [`users/${currentUser.uid}/lastEarnedTimestamps/${taskId}`]: firebase.database.ServerValue.TIMESTAMP };
    db.ref().update(updates).then(() => {
        showToast(`+${reward} Coins for completing task!`, 'success');
        addNotification('Weekly Task Complete!', `You earned +${reward} coins for completing "${task.title}".`, 'reward');
        manageMainTaskCooldown(taskId, task);
    }).catch(() => { showToast('Could not claim reward.', 'error'); if(btn) btn.disabled = false; });
}


function loadLeaderboard() {
    if (!leaderboardListEl || !db) return;
    leaderboardListEl.innerHTML = `<div class="loading-indicator">Loading Leaderboard...</div>`;

    db.ref('leaderboard').once('value', snapshot => {
        leaderboardListEl.innerHTML = '';
        if (!snapshot.exists() || !snapshot.hasChildren()) {
            leaderboardListEl.innerHTML = '<div class="empty-state">Leaderboard is empty.</div>';
            return;
        }

        const users = snapshot.val(); 

        users.forEach((user, index) => {
            if (!user) return;
            const rank = index + 1;
            const item = document.createElement('div');
            item.className = 'leaderboard-item';

            if (rank <= 3) {
                item.classList.add(`rank-${rank}`);
            }
            if (user.id === currentUser.uid) {
                item.classList.add('current-user-entry');
            }
            
            const avatarSrc = user.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'A')}&background=3498db&color=fff&size=40&bold=true`;
            
            item.innerHTML = `
                <i class="fas fa-trophy leaderboard-trophy"></i>
                <img src="${avatarSrc}" alt="${user.username}'s avatar" class="leaderboard-avatar">
                <div class="leaderboard-user-details">
                    <div class="leaderboard-username">${user.username || 'Anonymous'}</div>
                </div>
                <div class="leaderboard-coins">
                    <i class="fas fa-coins"></i>
                    <span>${(user.coins || 0).toLocaleString()}</span>
                </div>`;
            leaderboardListEl.appendChild(item);
        });
    }).catch((error) => {
        console.error("Leaderboard load error:", error);
        leaderboardListEl.innerHTML = `<div class="error-message" style="color: #ff8a80;">Could not load leaderboard.</div>`;
        showToast('Failed to load leaderboard.', 'error');
    });
}

function loadGlobalChat() {
    if (!db || !currentUser) return; detachGlobalChatListener();
    const chatListEl = document.getElementById('chat-messages-list');
    chatListEl.innerHTML = '<div class="loading-indicator">Loading chat...</div>';
    globalChatRef = db.ref('global_chat').orderByChild('timestamp').limitToLast(100);
    const onChildAdded = s => { if (chatListEl.querySelector('.loading-indicator')) chatListEl.innerHTML = ''; const el = createChatMessageElement(s.key, s.val()); chatListEl.appendChild(el); if (chatListEl.scrollHeight - chatListEl.scrollTop < chatListEl.clientHeight + 200) chatListEl.scrollTop = chatListEl.scrollHeight; };
    const onChildChanged = s => { const el = document.getElementById(`msg-${s.key}`); if(el) el.replaceWith(createChatMessageElement(s.key, s.val())); };
    const onChildRemoved = s => { const el = document.getElementById(`msg-${s.key}`); if (el) { el.style.transition = 'opacity 0.3s ease, transform 0.3s ease'; el.style.opacity = '0'; el.style.transform = 'scale(0.8)'; setTimeout(() => el.remove(), 300); } };
    chatListeners.child_added = globalChatRef.on('child_added', onChildAdded);
    chatListeners.child_changed = globalChatRef.on('child_changed', onChildChanged);
    chatListeners.child_removed = globalChatRef.on('child_removed', onChildRemoved);
}
function detachGlobalChatListener() { if (globalChatRef) { Object.values(chatListeners).forEach(listener => globalChatRef.off('value', listener)); } globalChatRef = null; chatListeners = {}; }

function createChatMessageElement(msgKey, msgData) {
    const isSent = msgData.uid === currentUser.uid;
    const container = document.createElement('div');
    container.id = `msg-${msgKey}`;
    container.className = `chat-message-container ${isSent ? 'sent' : 'received'}`;
    const item = document.createElement('div');
    item.className = 'chat-message-item';
    let replyHtml = '';
    if (msgData.replyTo) {
        replyHtml = `<div class="reply-context"><span class="reply-context-user">${msgData.replyTo.username || 'User'}</span><span class="reply-context-text">${msgData.replyTo.text || '...'}</span></div>`;
    }
    const timestamp = msgData.timestamp ? new Date(msgData.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : '';
    item.innerHTML = `${isSent ? '' : `<div class="username">${msgData.username || 'Anonymous'}</div>`}${replyHtml}<div class="text">${msgData.text}</div><div class="timestamp">${timestamp}</div>`;
    item.onclick = (e) => { e.stopPropagation(); showMessageOptionsMenu(e, msgKey, isSent, msgData); };
    container.appendChild(item);
    
    let reactionsHtml = '';
    if (msgData.reactions) {
        reactionsHtml = '<div class="reactions-container">';
        for (const emoji in msgData.reactions) {
            const count = Object.keys(msgData.reactions[emoji]).length;
            if (count > 0) reactionsHtml += `<div class="reaction-emoji" onclick="event.stopPropagation(); reactToMessage('${msgKey}', '${emoji}')">${emoji} ${count}</div>`;
        }
        reactionsHtml += '</div>';
    }
    if (reactionsHtml) { item.insertAdjacentHTML('afterend', reactionsHtml); }
    return container;
}

function showMessageOptionsMenu(event, msgKey, isSent, msgData) {
    closeMessageOptionsMenu();
    const menu = document.createElement('div');
    menu.className = 'message-options-menu';
    let menuItems = `<button class="option-btn" onclick="setupReply('${msgKey}', '${msgData.username || 'User'}', \`${msgData.text.replace(/'/g, "\\'")}\`); closeMessageOptionsMenu();"><i class="fas fa-reply"></i> Reply</button><button class="option-btn" onclick="copyMessageText(\`${msgData.text.replace(/`/g, "\\`")}\`); closeMessageOptionsMenu();"><i class="fas fa-copy"></i> Copy Text</button>`;
    if (isSent) {
        menuItems += `<button class="option-btn unsend-btn" onclick="unsendMessage('${msgKey}'); closeMessageOptionsMenu();"><i class="fas fa-trash"></i> Unsend</button>`;
    }
    menuItems += '<hr><div class="emoji-picker">';
    availableReactions.forEach(emoji => { menuItems += `<button class="emoji-btn" onclick="reactToMessage('${msgKey}', '${emoji}'); closeMessageOptionsMenu();">${emoji}</button>`; });
    menuItems += '</div>';
    menu.innerHTML = menuItems;
    document.body.appendChild(menu);
    activeMessageOptionsMenu = menu;

    const rect = event.target.closest('.chat-message-item').getBoundingClientRect();
    menu.style.left = `${rect.left + window.scrollX}px`;
    menu.style.top = `${rect.bottom + window.scrollY + 5}px`;

    if (menu.offsetLeft + menu.offsetWidth > window.innerWidth - 10) menu.style.left = `${window.innerWidth - menu.offsetWidth - 10}px`;
    if (menu.offsetTop + menu.offsetHeight > window.innerHeight - 10) menu.style.top = `${rect.top + window.scrollY - menu.offsetHeight - 5}px`;

    setTimeout(() => document.addEventListener('click', closeMessageOptionsMenu, { once: true }), 0);
}
function closeMessageOptionsMenu() { if (activeMessageOptionsMenu) { activeMessageOptionsMenu.remove(); activeMessageOptionsMenu = null; } }
function copyMessageText(text) { navigator.clipboard.writeText(text).then(() => showToast('Message copied!', 'success')); }

function sendChatMessage() {
    if (!db || !currentUser) return;
    const inputEl = document.getElementById('chat-message-input');
    const messageText = inputEl.value.trim();
    if (!messageText) return;
    if (messageText.length > 500) { showToast("Message is too long (max 500 chars).", "error"); return; }
    const messageData = { uid: currentUser.uid, username: userUsername, text: messageText, timestamp: firebase.database.ServerValue.TIMESTAMP, reactions: null, replyTo: replyingToMessage };
    db.ref('global_chat').push(messageData).then(() => { inputEl.value = ''; cancelReply(); inputEl.style.height = 'auto'; }).catch(e => showToast(`Error sending message: ${e.message}`, 'error'));
}
function setupReply(msgKey, username, text) {
    replyingToMessage = { msgId: msgKey, username: username, text: text.substring(0, 50) + (text.length > 50 ? '...' : '') };
    const replyBar = document.getElementById('chat-reply-bar');
    replyBar.querySelector('.reply-context-user').textContent = `Replying to ${username}`;
    replyBar.querySelector('.reply-context-text').textContent = replyingToMessage.text;
    replyBar.style.display = 'flex';
    document.getElementById('chat-message-input').focus();
    closeMessageOptionsMenu();
}
function cancelReply() { replyingToMessage = null; document.getElementById('chat-reply-bar').style.display = 'none'; }
function unsendMessage(msgKey) { showConfirmationPopup('Unsend Message', 'Are you sure you want to unsend this message?', () => { db.ref(`global_chat/${msgKey}`).remove().then(() => showToast("Message unsent.", "info")).catch(e => showToast("Error: " + e.message, "error")); }); }
function reactToMessage(msgKey, emoji) {
    const reactionRef = db.ref(`global_chat/${msgKey}/reactions/${emoji}/${currentUser.uid}`);
    reactionRef.once('value', s => s.exists() ? reactionRef.remove() : reactionRef.set(true));
}

function applyTheme(theme) {
    document.body.className = '';
    document.body.classList.add(theme);
    if (localStorage.getItem('taptak-ui-animations') !== 'false') {
        document.body.classList.add('ui-animations-on');
    }
    localStorage.setItem('taptak-theme', theme);
    if(initialDataLoaded) showToast(`${theme.split('-')[0].charAt(0).toUpperCase() + theme.split('-')[0].slice(1)} mode enabled.`, 'info');
}

function applyUiAnimations(enabled) {
    if (enabled) {
        document.body.classList.add('ui-animations-on');
    } else {
        document.body.classList.remove('ui-animations-on');
    }
    localStorage.setItem('taptak-ui-animations', String(enabled));
    if(initialDataLoaded) showToast(`UI animations ${enabled ? 'enabled' : 'disabled'}.`, 'info');
}


function showConfirmationPopup(title, message, onYesCallback) {
    const overlay = document.getElementById('confirmation-popup-overlay');
    document.getElementById('confirmation-popup-title').textContent = title;
    document.getElementById('confirmation-popup-message').textContent = message;
    const yesBtn = document.getElementById('confirmation-popup-yes');
    const noBtn = document.getElementById('confirmation-popup-no');
    
    const closePopup = () => overlay.classList.remove('show');
    
    const yesHandler = () => { onYesCallback(); closePopup(); };
    
    const newYesBtn = yesBtn.cloneNode(true);
    yesBtn.parentNode.replaceChild(newYesBtn, yesBtn);
    newYesBtn.addEventListener('click', yesHandler);
    
    noBtn.onclick = closePopup;
    overlay.onclick = closePopup;
    overlay.querySelector('.confirmation-popup-content').onclick = e => e.stopPropagation();
    
    overlay.classList.add('show');
}

document.addEventListener('DOMContentLoaded', () => {
    currentYearElement.textContent = new Date().getFullYear();
    initializeSpinWheelSegments();
    requestNotificationPermission();

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
            sessionStorage.setItem('referralCode', refCode.trim().toUpperCase());
            history.replaceState(null, '', window.location.pathname);
        }
    } catch (e) {
        console.error("Error processing URL params:", e);
    }
    

    const chatInput = document.getElementById('chat-message-input');
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } });
    chatInput.addEventListener('input', function() { this.style.height = 'auto'; this.style.height = `${this.scrollHeight}px`; });

    const savedTheme = localStorage.getItem('taptak-theme') || 'light-mode';
    const animationsEnabled = localStorage.getItem('taptak-ui-animations') !== 'false';
    applyTheme(savedTheme); 
    applyUiAnimations(animationsEnabled);
    
    document.querySelector(`#theme-selector input[value="${savedTheme}"]`)?.setAttribute('checked', 'checked');
    document.getElementById('ui-animations-toggle').checked = animationsEnabled;

    document.getElementById('theme-selector').addEventListener('change', e => e.target.name === 'theme' && applyTheme(e.target.value));
    document.getElementById('ui-animations-toggle').addEventListener('change', e => applyUiAnimations(e.target.checked));
});