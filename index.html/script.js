// ======================= НАСТРОЙКИ FIREBASE =======================
const firebaseConfig = {
    apiKey: "AIzaSyAafBLjstJcF5PFH8ZJQ_7nqwJsqrzCPJY",
    authDomain: "grib-kazino.firebaseapp.com",
    projectId: "grib-kazino",
    storageBucket: "grib-kazino.appspot.com",
    messagingSenderId: "928749498697",
    appId: "1:928749498697:web:2a445786634ac69473f250",
    measurementId: "G-CRLBR3R1X8"
};

const USE_FIREBASE = false; // ВКЛЮЧИТЬ ОНЛАЙН РЕЖИМ

console.log('=== ГРИБ КАЗИНО v4.0 ===');
console.log('🌐 Онлайн режим: ВКЛЮЧЕН');

// ======================= ИСПРАВЛЕННЫЙ FIREBASE МЕНЕДЖЕР =======================
class FirebaseManager {
    constructor() {
        this.db = null;
        this.usersRef = null;
        this.onlineRef = null;
        this.isConnected = false;
        this.unsubscribers = [];
        
        if (USE_FIREBASE) {
            this.initFirebase();
        }
    }
    
    async initFirebase() {
        try {
            console.log('🔥 Инициализация Firebase...');
            
            // Проверяем загрузку Firebase
            if (typeof firebase === 'undefined') {
                console.error('❌ Firebase SDK не загружен. Проверьте HTML.');
                return;
            }
            
            // Инициализация Firebase
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore();
            
          
            // Создаем ссылки на коллекции
            this.usersRef = this.db.collection('users');
            this.onlineRef = this.db.collection('online');
            
            this.isConnected = true;
            console.log('✅ Firebase успешно подключен');
            
        } catch (error) {
            console.error('❌ Критическая ошибка Firebase:', error);
            console.error('🔧 Детали:', error.message);
            this.isConnected = false;
        }
    }
    
    // ========== СОХРАНЕНИЕ ПОЛЬЗОВАТЕЛЯ ==========
    async saveUser(user) {
        if (!this.isConnected || !this.usersRef) {
            console.log('💾 Локальное сохранение');
            return this.saveUserLocal(user);
        }
        
        try {
            await this.usersRef.doc(user.username).set({
                username: user.username,
                avatar: user.avatar || '👤',
                balance: user.balance || 1000,
                password: user.password || '',
                createdAt: user.createdAt || new Date().toISOString(),
                gamesPlayed: user.gamesPlayed || 0,
                gamesWon: user.gamesWon || 0,
                lastActive: new Date().toISOString(),
                isAdmin: user.isAdmin || false
            }, { merge: true });
            
            console.log('☁️ Пользователь сохранен:', user.username);
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения:', error);
            return this.saveUserLocal(user);
        }
    }
    
    // ========== СОХРАНЕНИЕ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ ==========
    async saveUsers(users) {
        if (!this.isConnected || !this.usersRef) {
            return this.saveUsersLocal(users);
        }
        
        try {
            const batch = this.db.batch();
            
            Object.values(users).forEach(user => {
                const userRef = this.usersRef.doc(user.username);
                batch.set(userRef, {
                    username: user.username,
                    avatar: user.avatar || '👤',
                    balance: user.balance || 1000,
                    password: user.password || '',
                    createdAt: user.createdAt || new Date().toISOString(),
                    gamesPlayed: user.gamesPlayed || 0,
                    gamesWon: user.gamesWon || 0,
                    lastActive: new Date().toISOString(),
                    isAdmin: user.isAdmin || false
                }, { merge: true });
            });
            
            await batch.commit();
            console.log('☁️ Все пользователи сохранены в облако');
            return true;
        } catch (error) {
            console.error('❌ Ошибка сохранения всех:', error);
            return this.saveUsersLocal(users);
        }
    }
    
    // ========== ЗАГРУЗКА ПОЛЬЗОВАТЕЛЕЙ ==========
    async loadUsers() {
        if (!this.isConnected || !this.usersRef) {
            return this.loadUsersLocal();
        }
        
        try {
            const snapshot = await this.usersRef.get();
            const users = {};
            
            snapshot.forEach(doc => {
                const user = doc.data();
                users[user.username] = user;
            });
            
            console.log('☁️ Загружено из облака:', Object.keys(users).length, 'пользователей');
            return users;
        } catch (error) {
            console.error('❌ Ошибка загрузки:', error);
            return this.loadUsersLocal();
        }
    }
    
    // ========== УДАЛЕНИЕ ПОЛЬЗОВАТЕЛЯ ==========
    async deleteUser(username) {
        if (!this.isConnected || !this.usersRef) {
            return this.deleteUserLocal(username);
        }
        
        try {
            await this.usersRef.doc(username).delete();
            console.log('☁️ Пользователь удален из облака:', username);
            return true;
        } catch (error) {
            console.error('❌ Ошибка удаления:', error);
            return this.deleteUserLocal(username);
        }
    }
    
    // ========== ОНЛАЙН СТАТУС ==========
    async setUserOnline(username) {
        if (!this.isConnected || !this.onlineRef) {
            return false;
        }
        
        try {
            await this.onlineRef.doc(username).set({
                username: username,
                online: true,
                lastSeen: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            
            console.log('👤 Онлайн:', username);
            return true;
        } catch (error) {
            console.error('❌ Ошибка онлайн статуса:', error);
            return false;
        }
    }
    
    async setUserOffline(username) {
        if (!this.isConnected || !this.onlineRef) {
            return false;
        }
        
        try {
            await this.onlineRef.doc(username).delete();
            console.log('👤 Оффлайн:', username);
            return true;
        } catch (error) {
            console.error('❌ Ошибка оффлайн статуса:', error);
            return false;
        }
    }
    
    // ========== ПОДПИСКА НА ОНЛАЙН ПОЛЬЗОВАТЕЛЕЙ ==========
    subscribeToOnlineUsers(callback) {
        if (!this.isConnected || !this.onlineRef) {
            console.log('⚠️ Онлайн обновления отключены');
            return () => {};
        }
        
        try {
            const unsubscribe = this.onlineRef.onSnapshot(snapshot => {
                const onlineUsers = [];
                snapshot.forEach(doc => {
                    onlineUsers.push(doc.data().username);
                });
                callback(onlineUsers);
            }, error => {
                console.error('❌ Ошибка подписки:', error);
            });
            
            this.unsubscribers.push(unsubscribe);
            return unsubscribe;
        } catch (error) {
            console.error('❌ Ошибка создания подписки:', error);
            return () => {};
        }
    }
    
    // ========== ПОДПИСКА НА ИЗМЕНЕНИЯ ПОЛЬЗОВАТЕЛЯ ==========
    subscribeToUserChanges(username, callback) {
        if (!this.isConnected || !this.usersRef) {
            return () => {};
        }
        
        try {
            const unsubscribe = this.usersRef.doc(username).onSnapshot(doc => {
                if (doc.exists) {
                    callback(doc.data());
                }
            });
            
            this.unsubscribers.push(unsubscribe);
            return unsubscribe;
        } catch (error) {
            console.error('❌ Ошибка подписки на пользователя:', error);
            return () => {};
        }
    }
    
    // ========== ЛОКАЛЬНЫЕ ФУНКЦИИ ==========
    saveUserLocal(user) {
        const users = JSON.parse(localStorage.getItem('casinoUsers') || '{}');
        users[user.username] = user;
        localStorage.setItem('casinoUsers', JSON.stringify(users));
        return true;
    }
    
    saveUsersLocal(users) {
        localStorage.setItem('casinoUsers', JSON.stringify(users));
        return true;
    }
    
    loadUsersLocal() {
        return JSON.parse(localStorage.getItem('casinoUsers') || '{}');
    }
    
    deleteUserLocal(username) {
        const users = JSON.parse(localStorage.getItem('casinoUsers') || '{}');
        delete users[username];
        localStorage.setItem('casinoUsers', JSON.stringify(users));
        return true;
    }
    
    // ========== ОЧИСТКА ==========
    cleanup() {
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];
    }
}

// ... остальной код класса CasinoSystem БЕЗ ИЗМЕНЕНИЙ ...
// (используйте ваш предыдущий код класса CasinoSystem)

// ======================= ОБНОВЛЕННЫЙ КЛАСС КАЗИНО =======================
class CasinoSystem {
    constructor() {
        this.currentUser = null;
        this.users = {};
        this.gameHistory = JSON.parse(localStorage.getItem('gameHistory')) || {};
        this.onlineUsers = new Set();
        this.realTimeOnlineUsers = new Set();
        this.unsubscribers = [];
        
        // Менеджер Firebase
        this.firebaseManager = new FirebaseManager();
        
        // Секретный пароль для админа
        this.adminPassword = '7777';
        
        this.init();
    }

    async init() {
        console.log('🚀 Запуск онлайн казино...');
        
        // Ждем инициализации Firebase
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Загрузка пользователей
        this.users = await this.firebaseManager.loadUsers();
        console.log('👥 Загружено пользователей:', Object.keys(this.users).length);
        
        // Создаем аккаунт админа если его нет
        if (!this.users['Admin 👑']) {
            this.users['Admin 👑'] = {
                username: 'Admin 👑',
                avatar: '👑',
                balance: 999999,
                createdAt: new Date().toISOString(),
                gamesPlayed: 0,
                gamesWon: 0,
                lastActive: new Date().toISOString(),
                isAdmin: true,
                password: this.hashPassword('7777')
            };
            await this.saveUsers();
            console.log('👑 Аккаунт администратора создан');
        }
        
        this.loadElements();
        this.setupEventListeners();
        this.updateOnlineUsers();
        this.updateLeaderboard();
        this.updateStats();
        
        // Автовход
        const lastUser = localStorage.getItem('lastUser');
        if (lastUser && this.users[lastUser]) {
            this.autoLogin(lastUser);
        }
        
        console.log('✅ Онлайн казино готово!');
        console.log('🔗 Поделитесь ссылкой с друзьями!');
    }

    loadElements() {
        // Основные экраны
        this.authScreen = document.getElementById('auth-screen');
        this.gameScreen = document.getElementById('game-screen');
        
        // Элементы авторизации
        this.authTabs = document.querySelectorAll('.auth-tab');
        this.authForms = document.querySelectorAll('.auth-form');
        
        // Поля формы входа
        this.loginUsername = document.getElementById('login-username');
        this.loginPassword = document.getElementById('login-password');
        this.loginBtn = document.getElementById('login-btn');
        
        // Поля формы регистрации
        this.registerUsername = document.getElementById('register-username');
        this.registerPassword = document.getElementById('register-password');
        this.registerPasswordConfirm = document.getElementById('register-password-confirm');
        this.registerBtn = document.getElementById('register-btn');
        this.avatarOptions = document.querySelectorAll('.avatar-option');
        
        // Поля формы удаления
        this.deleteUsername = document.getElementById('delete-username');
        this.deletePassword = document.getElementById('delete-password');
        this.deleteConfirm = document.getElementById('delete-confirm');
        this.deleteBtn = document.getElementById('delete-btn');
        
        // Игровая информация
        this.currentAvatarEl = document.getElementById('current-avatar');
        this.currentUsernameEl = document.getElementById('current-username');
        this.balanceEl = document.getElementById('balance');
        
        // Кнопки управления
        this.logoutBtn = document.getElementById('logout-btn');
        this.addCoinsBtn = document.getElementById('add-coins');
        this.deleteAccountBtn = document.getElementById('delete-account-btn');
        
        // Админские элементы
        this.adminBadge = document.getElementById('admin-badge');
        
        // Списки
        this.onlineUsersEl = document.getElementById('online-users');
        this.playersListEl = document.getElementById('players-list');
        this.leaderboardListEl = document.getElementById('leaderboard-list');
        this.historyListEl = document.getElementById('history-list');
        this.statsText = document.getElementById('stats-text');
        
        // Модальное окно удаления
        this.deleteModal = document.getElementById('delete-modal');
        this.deleteAccountName = document.getElementById('delete-account-name');
        this.confirmDeleteBtn = document.getElementById('confirm-delete');
        this.cancelDeleteBtn = document.getElementById('cancel-delete');
        
        // Инициализация игр
        this.initGames();
    }

    setupEventListeners() {
        // Переключение вкладок авторизации
        this.authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                this.switchAuthTab(tabName);
            });
        });

        // Выбор аватара
        this.avatarOptions.forEach(option => {
            option.addEventListener('click', () => {
                this.avatarOptions.forEach(o => o.classList.remove('selected'));
                option.classList.add('selected');
            });
        });

        // Вход
        this.loginBtn.addEventListener('click', () => this.login());
        this.loginPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.login();
        });

        // Регистрация
        this.registerBtn.addEventListener('click', () => this.register());

        // Управление аккаунтом
        this.logoutBtn.addEventListener('click', () => this.logout());
        this.addCoinsBtn.addEventListener('click', () => this.addCoins(500));
        this.deleteAccountBtn.addEventListener('click', () => this.openDeleteModal());

        // Удаление аккаунта
        this.deleteConfirm.addEventListener('change', () => {
            this.deleteBtn.disabled = !this.deleteConfirm.checked;
        });
        
        this.deleteBtn.addEventListener('click', () => this.deleteAccount());
        this.confirmDeleteBtn.addEventListener('click', () => this.confirmDeleteAccount());
        this.cancelDeleteBtn.addEventListener('click', () => this.closeDeleteModal());

        // Закрытие модального окна
        this.deleteModal.addEventListener('click', (e) => {
            if (e.target === this.deleteModal) {
                this.closeDeleteModal();
            }
        });

        // Переключение между играми
        document.querySelectorAll('.game-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const game = btn.getAttribute('data-game');
                this.switchGame(game);
            });
        });
        
        // Автосохранение
        setInterval(() => {
            if (this.currentUser) {
                this.saveUsers();
            }
        }, 30000);
    }

    hashPassword(password) {
        let hash = 0;
        for (let i = 0; i < password.length; i++) {
            const char = password.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }

    verifyPassword(inputPassword, storedHash) {
        return this.hashPassword(inputPassword) === storedHash;
    }

    switchAuthTab(tabName) {
        this.authTabs.forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            }
        });

        this.authForms.forEach(form => {
            form.classList.remove('active');
            if (form.id === `${tabName}-form`) {
                form.classList.add('active');
            }
        });

        this.clearFormErrors();
    }

    clearFormErrors() {
        document.querySelectorAll('.error-message').forEach(el => {
            el.classList.remove('show');
        });
    }

    showError(elementId, message) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.classList.add('show');
            setTimeout(() => {
                element.classList.remove('show');
            }, 3000);
        }
    }

    isAdmin(username) {
        return this.users[username] && this.users[username].isAdmin === true;
    }

    autoLogin(username) {
        console.log('🔐 Автовход:', username);
        this.currentUser = username;
        this.onlineUsers.add(username);
        this.switchToGameScreen();
        this.updateUserInterface();
        this.updateOnlineUsers();
        this.updateLeaderboard();
        this.renderGameHistory();
        this.updateStats();
        
        // Устанавливаем онлайн статус
        if (USE_FIREBASE) {
            this.firebaseManager.setUserOnline(username);
            this.subscribeToRealtimeUpdates();
        }
        
        if (this.isAdmin(username)) {
            this.showMessage('👑 С возвращением, администратор!', 'success');
        } else {
            this.showMessage(`С возвращением, ${username}! 👋`, 'success');
        }
    }

    async login() {
        const username = this.loginUsername.value.trim();
        const password = this.loginPassword.value;
        
        if (!username) {
            this.showError('login-error', 'Введите имя!');
            return;
        }
        
        if (!password) {
            this.showError('login-error', 'Введите пароль!');
            return;
        }
        
        // Админский вход
        const adminNames = ['admin', 'админ', 'administrator', 'администратор'];
        const isAdminName = adminNames.includes(username.toLowerCase());
        
        if (isAdminName) {
            if (password !== this.adminPassword) {
                this.showError('login-error', 'Неверный пароль!');
                return;
            }
            
            if (!this.users['Admin 👑']) {
                this.users['Admin 👑'] = {
                    username: 'Admin 👑',
                    avatar: '👑',
                    balance: 999999,
                    createdAt: new Date().toISOString(),
                    gamesPlayed: 0,
                    gamesWon: 0,
                    lastActive: new Date().toISOString(),
                    isAdmin: true,
                    password: this.hashPassword(password)
                };
                this.showMessage('👑 Админ создан!', 'success');
            } else {
                this.users['Admin 👑'].lastActive = new Date().toISOString();
                this.showMessage('👑 Добро пожаловать!', 'success');
            }
            
            this.currentUser = 'Admin 👑';
            await this.saveUsers();
            localStorage.setItem('lastUser', 'Admin 👑');
            this.onlineUsers.add('Admin 👑');
            
            if (USE_FIREBASE) {
                await this.firebaseManager.setUserOnline('Admin 👑');
                this.subscribeToRealtimeUpdates();
            }
            
            this.switchToGameScreen();
            this.updateUserInterface();
            this.updateOnlineUsers();
            this.updateLeaderboard();
            this.renderGameHistory();
            this.updateStats();
            return;
        }
        
        // Обычный пользователь
        if (!this.users[username]) {
            this.showError('login-error', 'Пользователь не найден!');
            return;
        }
        
        const user = this.users[username];
        if (!user.password) {
            user.password = this.hashPassword(password);
            await this.saveUsers();
            this.showMessage('🔐 Пароль установлен!', 'success');
        } else if (!this.verifyPassword(password, user.password)) {
            this.showError('login-error', 'Неверный пароль!');
            return;
        }
        
        user.lastActive = new Date().toISOString();
        this.currentUser = username;
        await this.saveUsers();
        localStorage.setItem('lastUser', username);
        this.onlineUsers.add(username);
        
        if (USE_FIREBASE) {
            await this.firebaseManager.setUserOnline(username);
            this.subscribeToRealtimeUpdates();
        }
        
        this.switchToGameScreen();
        this.updateUserInterface();
        this.updateOnlineUsers();
        this.updateLeaderboard();
        this.renderGameHistory();
        this.updateStats();
        this.showMessage(`👋 С возвращением, ${username}!`, 'success');
    }

    async register() {
        const username = this.registerUsername.value.trim();
        const password = this.registerPassword.value;
        const passwordConfirm = this.registerPasswordConfirm.value;
        const selectedAvatar = document.querySelector('.avatar-option.selected');
        const avatar = selectedAvatar ? selectedAvatar.getAttribute('data-avatar') : '👤';
        
        if (!username) {
            this.showError('register-error', 'Введите имя!');
            return;
        }
        
        if (username.length < 3) {
            this.showError('register-error', 'Имя от 3 символов!');
            return;
        }
        
        if (username.length > 15) {
            this.showError('register-error', 'Имя до 15 символов!');
            return;
        }
        
        if (this.users[username]) {
            this.showError('register-error', 'Имя занято!');
            return;
        }
        
        if (!password) {
            this.showError('register-error', 'Введите пароль!');
            return;
        }
        
        if (password.length < 4) {
            this.showError('register-error', 'Пароль от 4 символов!');
            return;
        }
        
        if (password !== passwordConfirm) {
            this.showError('register-error', 'Пароли не совпадают!');
            return;
        }
        
        // Создаем пользователя
        this.users[username] = {
            username: username,
            avatar: avatar,
            balance: 1000,
            createdAt: new Date().toISOString(),
            gamesPlayed: 0,
            gamesWon: 0,
            lastActive: new Date().toISOString(),
            isAdmin: false,
            password: this.hashPassword(password)
        };
        
        await this.saveUsers();
        this.showMessage(`🎉 ${username} создан!`, 'success');
        
        // Автовход
        this.currentUser = username;
        localStorage.setItem('lastUser', username);
        this.onlineUsers.add(username);
        
        if (USE_FIREBASE) {
            await this.firebaseManager.setUserOnline(username);
            this.subscribeToRealtimeUpdates();
        }
        
        this.switchToGameScreen();
        this.updateUserInterface();
        this.updateOnlineUsers();
        this.updateLeaderboard();
        this.renderGameHistory();
        this.updateStats();
        
        // Очистка формы
        this.registerUsername.value = '';
        this.registerPassword.value = '';
        this.registerPasswordConfirm.value = '';
    }

    deleteAccount() {
        const username = this.deleteUsername.value.trim();
        const password = this.deletePassword.value;
        
        if (!username) {
            this.showError('delete-error', 'Введите имя!');
            return;
        }
        
        if (!password) {
            this.showError('delete-error', 'Введите пароль!');
            return;
        }
        
        if (!this.users[username]) {
            this.showError('delete-error', 'Пользователь не найден!');
            return;
        }
        
        const user = this.users[username];
        if (!this.verifyPassword(password, user.password)) {
            this.showError('delete-error', 'Неверный пароль!');
            return;
        }
        
        this.openDeleteModal(username);
    }

    openDeleteModal(username = null) {
        if (username) {
            this.deleteAccountName.textContent = username;
        } else {
            if (!this.currentUser) return;
            this.deleteAccountName.textContent = this.currentUser;
        }
        
        this.deleteModal.style.display = 'flex';
    }

    closeDeleteModal() {
        this.deleteModal.style.display = 'none';
    }

    async confirmDeleteAccount() {
        const username = this.deleteAccountName.textContent;
        
        if (!username || !this.users[username]) {
            this.showMessage('❌ Пользователь не найден!', 'error');
            this.closeDeleteModal();
            return;
        }
        
        // Удаление
        delete this.users[username];
        if (this.gameHistory[username]) delete this.gameHistory[username];
        this.onlineUsers.delete(username);
        this.realTimeOnlineUsers.delete(username);
        
        if (USE_FIREBASE) {
            await this.firebaseManager.setUserOffline(username);
            await this.firebaseManager.deleteUser(username);
        }
        
        if (this.currentUser === username) {
            this.currentUser = null;
            localStorage.removeItem('lastUser');
            this.switchToAuthScreen();
        }
        
        await this.saveUsers();
        localStorage.setItem('gameHistory', JSON.stringify(this.gameHistory));
        
        this.updateOnlineUsers();
        this.updateLeaderboard();
        this.updateStats();
        this.showMessage(`✅ ${username} удален!`, 'success');
        this.closeDeleteModal();
        this.deleteUsername.value = '';
        this.deletePassword.value = '';
        this.deleteConfirm.checked = false;
        this.deleteBtn.disabled = true;
        this.switchAuthTab('login');
    }

    async logout() {
        if (this.currentUser) {
            if (USE_FIREBASE) {
                await this.firebaseManager.setUserOffline(this.currentUser);
                this.unsubscribeFromRealtimeUpdates();
            }
            
            this.onlineUsers.delete(this.currentUser);
            this.updateOnlineUsers();
            this.currentUser = null;
            localStorage.removeItem('lastUser');
            this.switchToAuthScreen();
            this.showMessage('Вы вышли 👋', 'info');
        }
    }

    switchToGameScreen() {
        this.authScreen.style.display = 'none';
        this.gameScreen.style.display = 'block';
        
        setTimeout(() => {
            this.gameScreen.style.opacity = '1';
        }, 10);
        
        this.switchGame('slots');
    }

    switchToAuthScreen() {
        this.gameScreen.style.opacity = '0';
        
        setTimeout(() => {
            this.gameScreen.style.display = 'none';
            this.authScreen.style.display = 'flex';
            this.loginUsername.value = '';
            this.loginPassword.value = '';
            this.switchAuthTab('login');
        }, 300);
    }

    switchGame(gameId) {
        document.querySelectorAll('.game-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`.game-btn[data-game="${gameId}"]`);
        if (activeBtn) activeBtn.classList.add('active');
        
        document.querySelectorAll('.game-section').forEach(section => {
            section.classList.remove('active');
        });
        
        const gameSection = document.getElementById(`${gameId}-game`);
        if (gameSection) gameSection.classList.add('active');
    }

    updateUserInterface() {
        if (!this.currentUser || !this.users[this.currentUser]) return;
        
        const user = this.users[this.currentUser];
        this.currentAvatarEl.textContent = user.avatar;
        this.currentUsernameEl.textContent = user.username;
        this.balanceEl.textContent = user.balance;
        
        const isAdmin = this.isAdmin(this.currentUser);
        if (this.addCoinsBtn) this.addCoinsBtn.style.display = isAdmin ? 'flex' : 'none';
        if (this.adminBadge) this.adminBadge.style.display = isAdmin ? 'block' : 'none';
        if (this.deleteAccountBtn) this.deleteAccountBtn.style.display = 'flex';
    }

    async updateBalance(amount) {
        if (!this.currentUser || !this.users[this.currentUser]) return;
        
        const user = this.users[this.currentUser];
        user.balance += amount;
        user.lastActive = new Date().toISOString();
        
        if (amount > 0) user.gamesWon = (user.gamesWon || 0) + 1;
        user.gamesPlayed = (user.gamesPlayed || 0) + 1;
        
        this.balanceEl.textContent = user.balance;
        await this.saveUsers();
        
        if (amount > 0) {
            this.showMessage(`🎉 +${amount} монет!`, 'success');
        } else if (amount < 0) {
            this.showMessage(`💸 ${amount} монет`, 'info');
        }
        
        this.updateLeaderboard();
    }

    async addCoins(amount) {
        if (!this.currentUser || !this.isAdmin(this.currentUser)) {
            this.showMessage('❌ Только администратор!', 'error');
            return;
        }
        
        const targetUsername = prompt(
            '👤 Введите имя игрока:\n' +
            '(Оставьте пустым чтобы добавить себе)'
        );
        
        if (targetUsername === null) return;
        
        if (targetUsername.trim() === '') {
            this.users[this.currentUser].balance += amount;
            this.balanceEl.textContent = this.users[this.currentUser].balance;
            await this.saveUsers();
            this.showMessage(`✅ Добавлено ${amount} монет`, 'success');
            this.addToHistory(`Админ добавил ${amount} монет себе`, amount);
        } else if (this.users[targetUsername]) {
            this.users[targetUsername].balance += amount;
            await this.saveUsers();
            this.showMessage(`✅ Добавлено ${amount} монет игроку ${targetUsername}`, 'success');
            this.addToHistory(`Админ добавил ${amount} монет игроку ${targetUsername}`, 0);
            
            if (this.onlineUsers.has(targetUsername) || this.realTimeOnlineUsers.has(targetUsername)) {
                this.updateLeaderboard();
                this.updateOnlineUsers();
            }
        } else {
            this.showMessage(`❌ Игрок "${targetUsername}" не найден`, 'error');
        }
    }

    updateOnlineUsers() {
        if (this.onlineUsersEl) this.onlineUsersEl.innerHTML = '';
        if (this.playersListEl) this.playersListEl.innerHTML = '';
        
        // Объединяем локальных и Firebase онлайн пользователей
        const allOnlineUsers = USE_FIREBASE ? 
            [...new Set([...this.onlineUsers, ...this.realTimeOnlineUsers])] : 
            [...this.onlineUsers];
        
        allOnlineUsers.forEach(username => {
            const user = this.users[username];
            if (!user) return;
            
            // Для экрана входа
            if (this.onlineUsersEl) {
                const userBadge = document.createElement('div');
                userBadge.className = 'user-badge';
                userBadge.innerHTML = `
                    <span class="avatar">${user.avatar}</span>
                    <span>${username}</span>
                    <span class="online-indicator">●</span>
                `;
                this.onlineUsersEl.appendChild(userBadge);
            }
            
            // Для экрана игры
            if (this.playersListEl) {
                const playerItem = document.createElement('div');
                const isAdminPlayer = user.isAdmin;
                playerItem.className = `player-item ${isAdminPlayer ? 'admin-player' : ''}`;
                playerItem.innerHTML = `
                    <div class="player-avatar">${user.avatar}</div>
                    <div class="player-name">${user.username} ${isAdminPlayer ? '👑' : ''}</div>
                    <div class="player-balance">${user.balance} <i class="fas fa-coins"></i></div>
                    ${USE_FIREBASE ? '<div class="realtime-indicator" title="В реальном времени">🔥</div>' : ''}
                `;
                this.playersListEl.appendChild(playerItem);
            }
        });
        
        if (allOnlineUsers.length === 0 && this.playersListEl) {
            this.playersListEl.innerHTML = '<p style="color: #aaa; text-align: center;">Никого нет онлайн</p>';
        }
        
        this.updateStats();
    }

    updateStats() {
        if (!this.statsText) return;
        const totalUsers = Object.keys(this.users).length;
        const onlineCount = USE_FIREBASE ? 
            new Set([...this.onlineUsers, ...this.realTimeOnlineUsers]).size : 
            this.onlineUsers.size;
        
        this.statsText.textContent = `Всего игроков: ${totalUsers} | Онлайн: ${onlineCount}`;
    }

    updateLeaderboard() {
        if (!this.leaderboardListEl) return;
        this.leaderboardListEl.innerHTML = '';
        
        const sortedUsers = Object.values(this.users)
            .sort((a, b) => b.balance - a.balance)
            .slice(0, 10);
        
        sortedUsers.forEach((user, index) => {
            const item = document.createElement('div');
            const isCurrentUser = user.username === this.currentUser;
            const isAdminUser = user.isAdmin;
            item.className = `leaderboard-item ${isCurrentUser ? 'current-user' : ''} ${isAdminUser ? 'admin-user' : ''}`;
            item.innerHTML = `
                <div class="leaderboard-rank">${index + 1}</div>
                <div class="leaderboard-avatar">${user.avatar}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${user.username} ${isAdminUser ? '👑' : ''}</div>
                    <div class="leaderboard-stats">Игр: ${user.gamesPlayed || 0} | Побед: ${user.gamesWon || 0}</div>
                </div>
                <div class="leaderboard-balance">${user.balance} <i class="fas fa-coins"></i></div>
            `;
            this.leaderboardListEl.appendChild(item);
        });
        
        if (sortedUsers.length === 0) {
            this.leaderboardListEl.innerHTML = '<p style="color: #aaa; text-align: center; padding: 20px;">Еще нет игроков</p>';
        }
    }

    renderGameHistory() {
        if (!this.currentUser || !this.historyListEl) return;
        this.historyListEl.innerHTML = '';
        const history = this.gameHistory[this.currentUser] || [];
        
        if (history.length === 0) {
            const welcomeLi = document.createElement('li');
            welcomeLi.innerHTML = `
                <span class="history-time">[${new Date().toLocaleTimeString()}]</span>
                <span class="history-action">Добро пожаловать в казино!</span>
                <span class="history-amount win">+0</span>
            `;
            this.historyListEl.appendChild(welcomeLi);
        }
        
        history.slice(-15).reverse().forEach(record => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span class="history-time">[${new Date(record.time).toLocaleTimeString()}]</span>
                <span class="history-action">${record.action}</span>
                <span class="history-amount ${record.amount > 0 ? 'win' : 'lose'}">
                    ${record.amount > 0 ? '+' : ''}${record.amount}
                </span>
            `;
            this.historyListEl.appendChild(li);
        });
    }

    addToHistory(action, amount = 0) {
        if (!this.currentUser) return;
        
        if (!this.gameHistory[this.currentUser]) {
            this.gameHistory[this.currentUser] = [];
        }
        
        this.gameHistory[this.currentUser].push({
            time: new Date().toISOString(),
            action: action,
            amount: amount
        });
        
        if (this.gameHistory[this.currentUser].length > 100) {
            this.gameHistory[this.currentUser].shift();
        }
        
        localStorage.setItem('gameHistory', JSON.stringify(this.gameHistory));
        this.renderGameHistory();
    }

    showMessage(text, type = 'info') {
        const messageEl = document.getElementById('funMessage');
        if (!messageEl) return;
        
        messageEl.textContent = text;
        messageEl.className = `fun-message ${type}`;
        
        setTimeout(() => {
            messageEl.textContent = 'Удачи и веселья! 🎉';
            messageEl.className = 'fun-message';
        }, 4000);
    }

    async saveUsers() {
        try {
            localStorage.setItem('casinoUsers', JSON.stringify(this.users));
            
            if (USE_FIREBASE) {
                await this.firebaseManager.saveUsers(this.users);
                
                if (this.currentUser) {
                    await this.firebaseManager.setUserOnline(this.currentUser);
                }
            }
            
        } catch (error) {
            console.error('❌ Ошибка сохранения:', error);
        }
    }

    subscribeToRealtimeUpdates() {
        if (!USE_FIREBASE) return;
        
        // 1. Подписка на онлайн пользователей
        const onlineUnsub = this.firebaseManager.subscribeToOnlineUsers((onlineUsers) => {
            this.realTimeOnlineUsers = new Set(onlineUsers);
            this.updateOnlineUsers();
        });
        this.unsubscribers.push(onlineUnsub);
        
        // 2. Подписка на изменения текущего пользователя
        if (this.currentUser) {
            const userUnsub = this.firebaseManager.subscribeToUserChanges(this.currentUser, (userData) => {
                if (userData) {
                    this.users[this.currentUser] = userData;
                    this.updateUserInterface();
                    this.updateLeaderboard();
                }
            });
            this.unsubscribers.push(userUnsub);
        }
    }
    
    unsubscribeFromRealtimeUpdates() {
        this.unsubscribers.forEach(unsub => unsub());
        this.unsubscribers = [];
        this.firebaseManager.cleanup();
    }

    // Игры (без изменений)
    initGames() {
        this.initSlots();
        this.initDice();
        this.initCards();
        this.initRoulette();
    }

    initSlots() {
        const slotsBetEl = document.getElementById('slots-bet');
        const spinBtn = document.getElementById('spinBtn');
        const slot1 = document.getElementById('slot1');
        const slot2 = document.getElementById('slot2');
        const slot3 = document.getElementById('slot3');
        const slotsResult = document.getElementById('slots-result');
        const betBtns = document.querySelectorAll('#slots-game .bet-btn');
        
        if (!spinBtn || !slotsBetEl) return;
        
        let slotsBet = 50;
        const symbols = ['🍒', '🍋', '🍉', '🍇', '🔔', '⭐', '7️⃣'];
        
        slotsBetEl.textContent = slotsBet;
        
        betBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const change = parseInt(btn.getAttribute('data-change'));
                slotsBet += change;
                
                if (slotsBet < 10) slotsBet = 10;
                if (slotsBet > 200) slotsBet = 200;
                if (this.currentUser && this.users[this.currentUser]) {
                    if (slotsBet > this.users[this.currentUser].balance) {
                        slotsBet = this.users[this.currentUser].balance || 10;
                    }
                }
                
                slotsBetEl.textContent = slotsBet;
                document.querySelector('#slots-game .current-bet').textContent = slotsBet;
            });
        });
        
        spinBtn.addEventListener('click', () => {
            if (!this.currentUser) {
                this.showMessage('Войдите в аккаунт! 🔑', 'error');
                return;
            }
            
            const user = this.users[this.currentUser];
            if (user.balance < slotsBet) {
                this.showMessage('Недостаточно средств! 💸', 'error');
                return;
            }
            
            this.updateBalance(-slotsBet);
            spinBtn.disabled = true;
            let spins = 0;
            const maxSpins = 30;
            
            [slot1, slot2, slot3].forEach(slot => slot.classList.add('spinning'));
            
            const spinInterval = setInterval(() => {
                slot1.textContent = symbols[Math.floor(Math.random() * symbols.length)];
                slot2.textContent = symbols[Math.floor(Math.random() * symbols.length)];
                slot3.textContent = symbols[Math.floor(Math.random() * symbols.length)];
                
                spins++;
                if (spins > maxSpins) {
                    clearInterval(spinInterval);
                    const final1 = symbols[Math.floor(Math.random() * symbols.length)];
                    const final2 = symbols[Math.floor(Math.random() * symbols.length)];
                    const final3 = symbols[Math.floor(Math.random() * symbols.length)];
                    
                    slot1.textContent = final1;
                    slot2.textContent = final2;
                    slot3.textContent = final3;
                    
                    [slot1, slot2, slot3].forEach(slot => slot.classList.remove('spinning'));
                    
                    let win = 0;
                    let message = '';
                    
                    if (final1 === final2 && final2 === final3) {
                        win = slotsBet * 10;
                        message = `🎰 ДЖЕКПОТ! 🎰 Вы выиграли ${win} монет!`;
                        this.addToHistory('Слоты: Джекпот!', win);
                    } else if (final1 === final2 || final2 === final3 || final1 === final3) {
                        win = slotsBet * 2;
                        message = `🎰 Два одинаковых! Вы выиграли ${win} монет!`;
                        this.addToHistory('Слоты: Два одинаковых', win);
                    } else {
                        message = `🎰 Повезет в следующий раз! Вы проиграли ${slotsBet} монет.`;
                        this.addToHistory('Слоты: Проигрыш', -slotsBet);
                    }
                    
                    if (win > 0) this.updateBalance(win);
                    
                    slotsResult.textContent = message;
                    slotsResult.className = win > 0 ? 'result win' : 'result lose';
                    spinBtn.disabled = false;
                }
            }, 100);
        });
    }

    initDice() {
        const dice = document.getElementById('dice');
        const diceBetEl = document.getElementById('dice-bet');
        const diceChoices = document.querySelectorAll('.dice-choice');
        const diceResult = document.getElementById('dice-result');
        
        if (!dice || !diceBetEl) return;
        
        let diceBet = 30;
        diceBetEl.textContent = diceBet;
        
        diceChoices.forEach(choice => {
            choice.addEventListener('click', () => {
                if (!this.currentUser) {
                    this.showMessage('Войдите в аккаунт! 🔑', 'error');
                    return;
                }
                
                const playerChoice = choice.getAttribute('data-choice');
                const user = this.users[this.currentUser];
                
                if (user.balance < diceBet) {
                    this.showMessage('Недостаточно средств! 💸', 'error');
                    return;
                }
                
                this.updateBalance(-diceBet);
                dice.textContent = '🎲';
                dice.classList.add('rolling');
                diceChoices.forEach(btn => btn.disabled = true);
                
                setTimeout(() => {
                    const diceValue = Math.floor(Math.random() * 6) + 1;
                    dice.textContent = this.getDiceEmoji(diceValue);
                    dice.classList.remove('rolling');
                    
                    const isHigh = diceValue > 3;
                    const playerWon = (playerChoice === 'high' && isHigh) || 
                                     (playerChoice === 'low' && !isHigh);
                    
                    if (playerWon) {
                        const win = diceBet * 2;
                        this.updateBalance(win);
                        diceResult.textContent = `🎲 Поздравляем! Выпало ${diceValue}. Вы выиграли ${win} монет!`;
                        diceResult.className = 'result win';
                        this.addToHistory('Кости: Выигрыш', win);
                    } else {
                        diceResult.textContent = `🎲 Увы! Выпало ${diceValue}. Вы проиграли ${diceBet} монет.`;
                        diceResult.className = 'result lose';
                        this.addToHistory('Кости: Проигрыш', -diceBet);
                    }
                    
                    diceChoices.forEach(btn => btn.disabled = false);
                }, 1000);
            });
        });
    }

    getDiceEmoji(value) {
        const diceEmojis = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
        return diceEmojis[value - 1] || '🎲';
    }

    initCards() {
        const card = document.getElementById('card');
        const cardsBetEl = document.getElementById('cards-bet');
        const cardChoices = document.querySelectorAll('.card-choice');
        const cardsResult = document.getElementById('cards-result');
        
        if (!card || !cardsBetEl) return;
        
        let cardsBet = 40;
        cardsBetEl.textContent = cardsBet;
        const redSuits = ['♥️', '♦️'];
        const blackSuits = ['♠️', '♣️'];
        
        cardChoices.forEach(choice => {
            choice.addEventListener('click', () => {
                if (!this.currentUser) {
                    this.showMessage('Войдите в аккаунт! 🔑', 'error');
                    return;
                }
                
                const playerChoice = choice.getAttribute('data-color');
                const user = this.users[this.currentUser];
                
                if (user.balance < cardsBet) {
                    this.showMessage('Недостаточно средств! 💸', 'error');
                    return;
                }
                
                this.updateBalance(-cardsBet);
                card.textContent = '🂠';
                cardChoices.forEach(btn => btn.disabled = true);
                
                setTimeout(() => {
                    const isRed = Math.random() > 0.5;
                    const suit = isRed ? 
                        redSuits[Math.floor(Math.random() * redSuits.length)] : 
                        blackSuits[Math.floor(Math.random() * blackSuits.length)];
                    
                    const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
                    const value = values[Math.floor(Math.random() * values.length)];
                    
                    card.textContent = suit;
                    card.style.color = isRed ? '#e74c3c' : '#2c3e50';
                    card.title = `${value} ${suit}`;
                    
                    const playerWon = (playerChoice === 'red' && isRed) || 
                                     (playerChoice === 'black' && !isRed);
                    
                    if (playerWon) {
                        const win = cardsBet * 2;
                        this.updateBalance(win);
                        cardsResult.textContent = `🃏 Угадали! ${value}${suit}. Вы выиграли ${win} монет!`;
                        cardsResult.className = 'result win';
                        this.addToHistory('Карты: Выигрыш', win);
                    } else {
                        cardsResult.textContent = `🃏 Не угадали! ${value}${suit}. Вы проиграли ${cardsBet} монет.`;
                        cardsResult.className = 'result lose';
                        this.addToHistory('Карты: Проигрыш', -cardsBet);
                    }
                    
                    cardChoices.forEach(btn => btn.disabled = false);
                }, 1000);
            });
        });
    }

    initRoulette() {
        const rouletteBetEl = document.getElementById('roulette-bet');
        const spinRouletteBtn = document.getElementById('spin-roulette');
        const rouletteResult = document.getElementById('roulette-result');
        const rouletteWheel = document.querySelector('.roulette-wheel');
        
        if (!rouletteBetEl || !spinRouletteBtn) return;
        
        let rouletteBet = 50;
        rouletteBetEl.textContent = rouletteBet;
        
        const rouletteBetBtns = document.querySelectorAll('#roulette-game .bet-btn');
        rouletteBetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const change = parseInt(btn.getAttribute('data-change'));
                rouletteBet += change;
                
                if (rouletteBet < 10) rouletteBet = 10;
                if (rouletteBet > 500) rouletteBet = 500;
                
                rouletteBetEl.textContent = rouletteBet;
                document.querySelector('#roulette-game .current-bet').textContent = rouletteBet;
            });
        });
        
        spinRouletteBtn.addEventListener('click', () => {
            if (!this.currentUser) {
                this.showMessage('Войдите в аккаунт! 🔑', 'error');
                return;
            }
            
            const user = this.users[this.currentUser];
            if (user.balance < rouletteBet) {
                this.showMessage('Недостаточно средств! 💸', 'error');
                return;
            }
            
            this.updateBalance(-rouletteBet);
            spinRouletteBtn.disabled = true;
            rouletteWheel.style.transition = 'transform 3s cubic-bezier(0.1, 0, 0.2, 1)';
            
            const spins = 3 + Math.random() * 2;
            const degrees = spins * 360 + Math.floor(Math.random() * 360);
            rouletteWheel.style.transform = `rotate(${degrees}deg)`;
            
            setTimeout(() => {
                const winningNumber = Math.floor(Math.random() * 37);
                const winningColor = winningNumber === 0 ? 'зеленое' : 
                                  (winningNumber % 2 === 0 ? 'черное' : 'красное');
                
                const playerWins = Math.random() > 0.5;
                const win = playerWins ? rouletteBet * 2 : 0;
                
                if (playerWins) {
                    this.updateBalance(win);
                    rouletteResult.textContent = `🎡 Выигрышное число: ${winningNumber} (${winningColor})! Вы выиграли ${win} монет!`;
                    rouletteResult.className = 'result win';
                    this.addToHistory('Рулетка: Выигрыш', win);
                } else {
                    rouletteResult.textContent = `🎡 Выигрышное число: ${winningNumber} (${winningColor}). Вы проиграли ${rouletteBet} монет.`;
                    rouletteResult.className = 'result lose';
                    this.addToHistory('Рулетка: Проигрыш', -rouletteBet);
                }
                
                setTimeout(() => {
                    rouletteWheel.style.transition = 'none';
                    rouletteWheel.style.transform = 'rotate(0deg)';
                    setTimeout(() => {
                        rouletteWheel.style.transition = 'transform 3s cubic-bezier(0.1, 0, 0.2, 1)';
                    }, 50);
                }, 1000);
                
                spinRouletteBtn.disabled = false;
            }, 3000);
        });
    }
}

// ======================= ГЛОБАЛЬНЫЕ ФУНКЦИИ =======================
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const icon = input.parentNode.querySelector('.fa-eye');
    if (!icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
}

function switchTab(tabName) {
    if (window.casino && window.casino.switchAuthTab) {
        window.casino.switchAuthTab(tabName);
    } else {
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.getAttribute('data-tab') === tabName) {
                tab.classList.add('active');
            }
        });
        
        document.querySelectorAll('.auth-form').forEach(form => {
            form.classList.remove('active');
            if (form.id === `${tabName}-form`) {
                form.classList.add('active');
            }
        });
    }
}

window.togglePassword = togglePassword;
window.switchTab = switchTab;

// ======================= ЗАПУСК =======================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎰 Гриб казино запускается...');
    
    try {
        window.casino = new CasinoSystem();
        console.log('✅ Онлайн казино готово!');
        console.log('👑 Админ: Admin 👑 / 7777');
        console.log('🌐 Поделитесь ссылкой с друзьями!');
    } catch (error) {
        console.error('💥 Ошибка запуска:', error);
        document.getElementById('auth-screen').style.display = 'flex';
        document.getElementById('game-screen').style.display = 'none';
        alert('Ошибка загрузки игры. Проверьте консоль (F12).');
    }
});