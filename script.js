// Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.expand();
tg.ready();

// ========== СОСТОЯНИЕ ПРИЛОЖЕНИЯ ==========
let appState = {
    isPaidUser: false,
    freePredictionsLeft: 5, // 5 бесплатных прогнозов
    currentCards: [],
    lastPaymentTime: null
};

// Ключ для хранения
const STORAGE_KEY = 'gor_cost_state';

// DOM элементы
const screens = {
    welcome: document.getElementById('screen-welcome'),
    payment: document.getElementById('screen-payment'),
    result: document.getElementById('screen-result')
};

const buttons = {
    start: document.getElementById('btn-start'),
    donate: document.getElementById('btn-donate'),
    getPrognosis: document.getElementById('btn-get-prognosis'),
    share: document.getElementById('btn-share'),
    new: document.getElementById('btn-new')
};

const paymentNote = document.getElementById('payment-note');

// НАСТРОЙКИ (ПРОВЕРЬТЕ ЭТИ ССЫЛКИ!)
const CONFIG = {
    // Важно: путь должен соответствовать именам файлов!
    CARDS_BASE_URL: "https://raw.githubusercontent.com/Artishoko/gor-cost-prognosis/main/Cards/",
    TOTAL_CARDS: 139, // У вас 108 карт
    INVOICE_URL: "https://t.me/Magic_G_bot?start=invoice_123", // Ваша ссылка
    PAYMENT_AMOUNT: 10
};

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

// Сохранить состояние
function saveAppState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// Загрузить состояние
function loadAppState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            appState = JSON.parse(saved);
        } catch (e) {
            console.error('Ошибка загрузки:', e);
        }
    }
}

// Инициализация приложения
function initApp() {
    loadAppState();
    
    // Проверяем оплаченный доступ (24 часа)
    if (appState.lastPaymentTime && 
        (Date.now() - appState.lastPaymentTime) < 24 * 60 * 60 * 1000) {
        appState.isPaidUser = true;
    }
    
    updatePaymentButton();
    setupEventListeners();
    
    console.log('Приложение инициализировано. Бесплатных прогнозов:', appState.freePredictionsLeft);
}

// Обновить кнопки и текст
function updatePaymentButton() {
    const hasAccess = appState.isPaidUser || appState.freePredictionsLeft > 0;
    buttons.getPrognosis.disabled = !hasAccess;
    
    // Текст на кнопке доната
    if (appState.isPaidUser) {
        buttons.donate.innerHTML = '<span class="star">✅</span> Оплачено';
        buttons.donate.style.opacity = '0.7';
        buttons.donate.style.cursor = 'default';
        paymentNote.textContent = 'Оплаченный доступ активен';
    } else {
        buttons.donate.innerHTML = `<span class="star">⭐</span> Донат ${CONFIG.PAYMENT_AMOUNT} звёзд`;
        buttons.donate.style.opacity = '1';
        buttons.donate.style.cursor = 'pointer';
        
        // Текст о бесплатных прогнозах
        if (appState.freePredictionsLeft > 0) {
            paymentNote.textContent = `Бесплатных прогнозов осталось: ${appState.freePredictionsLeft}`;
        } else {
            paymentNote.textContent = 'Бесплатные прогнозы закончились. Оплатите для продолжения.';
        }
    }
}

// Назначить обработчики кнопок
function setupEventListeners() {
    buttons.start.addEventListener('click', () => showScreen('payment'));
    buttons.donate.addEventListener('click', processPayment);
    buttons.getPrognosis.addEventListener('click', () => {
        generatePrognosis();
        showScreen('result');
    });
    buttons.share.addEventListener('click', sharePrognosis);
    buttons.new.addEventListener('click', () => {
        const hasAccess = appState.isPaidUser || appState.freePredictionsLeft > 0;
        if (hasAccess && appState.currentCards.length > 0) {
            generatePrognosis();
        } else {
            showScreen('payment');
        }
    });
}

// Показать определённый экран
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    if (screenName === 'payment') updatePaymentButton();
}

// Обработка платежа
function processPayment() {
    if (appState.isPaidUser) {
        alert('У вас уже есть оплаченный доступ!');
        return;
    }
    
    tg.openInvoice(CONFIG.INVOICE_URL, (status) => {
        if (status === 'paid') {
            appState.isPaidUser = true;
            appState.lastPaymentTime = Date.now();
            saveAppState();
            updatePaymentButton();
            
            if (tg.showAlert) {
                tg.showAlert('✅ Оплата прошла успешно! Теперь у вас неограниченный доступ.');
            }
        } else if (status === 'failed') {
            alert('Оплата не удалась. Попробуйте еще раз.');
        } else if (status === 'cancelled') {
            console.log('Оплата отменена');
        }
    });
}

// Генерация прогноза
function generatePrognosis() {
    // 1. Проверка доступа
    if (!appState.isPaidUser && appState.freePredictionsLeft <= 0) {
        alert('Бесплатные прогнозы закончились! Оплатите для продолжения.');
        showScreen('payment');
        return;
    }
    
    // 2. Списание бесплатной попытки
    if (!appState.isPaidUser && appState.freePredictionsLeft > 0) {
        appState.freePredictionsLeft--;
        console.log(`Использован бесплатный прогноз. Осталось: ${appState.freePredictionsLeft}`);
        saveAppState();
        updatePaymentButton(); // Обновляем счётчик
    }
    
    // 3. Генерация 6 уникальных карт
    const cards = [];
    while (cards.length < 6) {
        const randomCard = Math.floor(Math.random() * CONFIG.TOTAL_CARDS) + 1;
        if (!cards.includes(randomCard)) cards.push(randomCard);
    }
    
    // 4. Сохранение и отображение
    appState.currentCards = cards;
    saveAppState();
    displayCards(cards);
}

// Отображение карт (ВАЖНО: путь к картинкам)
function displayCards(cardNumbers) {
    const positions = ['success', 'risk', 'mood', 'morning', 'day', 'evening'];
    
    positions.forEach((position, index) => {
        const cardElement = document.getElementById(`card-${position}`);
        const cardNumber = cardNumbers[index];
        
        // КРИТИЧЕСКИ ВАЖНО: путь должен соответствовать именам файлов
        const cardUrl = `${CONFIG.CARDS_BASE_URL}card_(${cardNumber}).jpg`;
        
        const img = cardElement.querySelector('img');
        img.src = cardUrl;
        img.alt = `Карта ${cardNumber}`;
        
        // Анимация
        cardElement.classList.remove('revealed');
        setTimeout(() => cardElement.classList.add('revealed'), index * 100);
    });
}

// Поделиться прогнозом
function sharePrognosis() {
    const shareText = `🔮 Я получил прогноз от "Горностая"! У меня осталось ${appState.freePredictionsLeft} бесплатных прогнозов.`;
    
    if (tg.shareUrl) {
        tg.shareUrl(
            `https://t.me/share/url?url=${encodeURIComponent('https://t.me/your_bot')}&text=${encodeURIComponent(shareText)}`,
            'Мой прогноз на день!'
        );
    } else {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(shareText)}`;
        window.open(shareUrl, '_blank');
    }
}

// ========== ЗАПУСК ==========
document.addEventListener('DOMContentLoaded', initApp);

// Проверка загрузки карт (для отладки)
setTimeout(() => {
    console.log('Проверяем загрузку карт...');
    for(let i = 1; i <= 3; i++) {
        const img = new Image();
        img.src = `${CONFIG.CARDS_BASE_URL}card_(${i}).jpg`;
        img.onload = () => console.log(`✅ Карта ${i} загружена`);
        img.onerror = () => console.error(`❌ Ошибка загрузки карты ${i}`);
    }
}, 1000);
