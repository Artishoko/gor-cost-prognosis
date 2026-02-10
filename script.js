// Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.expand(); // Раскрываем на весь экран
tg.ready();

// ========== НОВАЯ СТРУКТУРА ДАННЫХ ==========
let appState = {
    isPaidUser: false,           // Статус оплаченного доступа
    freePredictionsLeft: 5,      // Осталось бесплатных прогнозов (5 для новых пользователей)
    currentCards: [],
    lastPaymentTime: null,
    totalPredictionsMade: 0      // Всего сделано прогнозов (для статистики)
};

// Ключ для хранения в localStorage (новая версия)
const STORAGE_KEY = 'gor_cost_app_state_v3';

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

// Настройки приложения
const CONFIG = {
    CARDS_BASE_URL: "https://raw.githubusercontent.com/Artishoko/gor-cost-prognosis/main/Cards/",
    TOTAL_CARDS: 133, // Убедитесь, что это число соответствует вашим файлам!
    INVOICE_URL: "https://t.me/Magic_G_bot?start=invoice_123", // Ваша ссылка на инвойс
    PAYMENT_AMOUNT: 10 // Сумма в звёздах
};

// ========== ОСНОВНЫЕ ФУНКЦИИ ==========

// Сохранить состояние в localStorage
function saveAppState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// Загрузить состояние из localStorage
function loadAppState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            // Объединяем с дефолтными значениями на случай изменения структуры
            appState = { ...appState, ...parsed };
        } catch (e) {
            console.error('Ошибка загрузки состояния:', e);
        }
    }
}

// Инициализация приложения
function initApp() {
    // 1. Загружаем сохранённое состояние
    loadAppState();
    
    // 2. Проверяем оплаченный доступ (действителен 24 часа)
    if (appState.lastPaymentTime && 
        (Date.now() - appState.lastPaymentTime) < 24 * 60 * 60 * 1000) {
        appState.isPaidUser = true;
    }
    
    // 3. Сохраняем состояние (если новый пользователь - сохраняем 5 прогнозов)
    saveAppState();
    
    // 4. Обновляем интерфейс
    updatePaymentButton();
    setupEventListeners();
    
    // 5. Логи для отладки
    console.log(`📊 Статус: ${appState.freePredictionsLeft} бесплатных прогнозов осталось, оплата: ${appState.isPaidUser ? 'ДА' : 'НЕТ'}`);
}

// Обновить кнопки в зависимости от состояния
function updatePaymentButton() {
    // Есть ли доступ к новому прогнозу?
    const hasAccess = appState.isPaidUser || appState.freePredictionsLeft > 0;
    
    buttons.getPrognosis.disabled = !hasAccess;
    
    // Текст на кнопке доната
    if (appState.isPaidUser) {
        buttons.donate.innerHTML = '<span class="star">✅</span> Оплачено (доступ открыт)';
        buttons.donate.style.opacity = '0.7';
        buttons.donate.style.cursor = 'default';
    } else if (appState.freePredictionsLeft > 0) {
        buttons.donate.innerHTML = `<span class="star">⭐</span> Донат ${CONFIG.PAYMENT_AMOUNT} звёзд`;
        buttons.donate.style.opacity = '1';
        buttons.donate.style.cursor = 'pointer';
        
        // Добавляем счётчик бесплатных прогнозов
        const note = document.querySelector('.payment-note');
        if (note) {
            note.textContent = `Бесплатных прогнозов осталось: ${appState.freePredictionsLeft}`;
        }
    } else {
        buttons.donate.innerHTML = `<span class="star">⭐</span> Донат ${CONFIG.PAYMENT_AMOUNT} звёзд`;
        buttons.donate.style.opacity = '1';
        buttons.donate.style.cursor = 'pointer';
        
        const note = document.querySelector('.payment-note');
        if (note) {
            note.textContent = 'Бесплатные прогнозы закончились. Оплатите для продолжения.';
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
        // Проверяем доступ перед генерацией нового прогноза
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
            // Успешная оплата
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
            console.log('Пользователь отменил оплату');
        }
    });
}

// Генерация прогноза (ОСНОВНАЯ ЛОГИКА)
function generatePrognosis() {
    // 1. ПРОВЕРКА ДОСТУПА
    if (!appState.isPaidUser && appState.freePredictionsLeft <= 0) {
        alert('Бесплатные прогнозы закончились! Оплатите для продолжения.');
        showScreen('payment');
        return;
    }
    
    // 2. СПИСАНИЕ БЕСПЛАТНОЙ ПОПЫТКИ (если не оплачено)
    if (!appState.isPaidUser && appState.freePredictionsLeft > 0) {
        appState.freePredictionsLeft--;
        console.log(`🎁 Использован бесплатный прогноз. Осталось: ${appState.freePredictionsLeft}`);
    }
    
    // 3. ГЕНЕРАЦИЯ КАРТ
    const cards = [];
    while (cards.length < 6) {
        const randomCard = Math.floor(Math.random() * CONFIG.TOTAL_CARDS) + 1;
        if (!cards.includes(randomCard)) cards.push(randomCard);
    }
    
    // 4. ОБНОВЛЕНИЕ СТАТИСТИКИ
    appState.currentCards = cards;
    appState.totalPredictionsMade++;
    saveAppState();
    
    // 5. ОТОБРАЖЕНИЕ И ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
    displayCards(cards);
    updatePaymentButton(); // Обновляем счётчик на кнопках
    
    // Показываем информацию о статусе
    const statusInfo = appState.isPaidUser 
        ? '✅ Оплаченный доступ' 
        : `🎁 Бесплатных прогнозов осталось: ${appState.freePredictionsLeft}`;
    console.log(statusInfo);
}

// Отображение карт
function displayCards(cardNumbers) {
    const positions = ['success', 'risk', 'mood', 'morning', 'day', 'evening'];
    
    positions.forEach((position, index) => {
        const cardElement = document.getElementById(`card-${position}`);
        const cardNumber = cardNumbers[index];
        
        // ФОРМИРУЕМ ПРАВИЛЬНЫЙ ПУТЬ К КАРТИНКЕ
        // Убедитесь, что имена файлов соответствуют!
        const cardUrl = `${CONFIG.CARDS_BASE_URL}card_${cardNumber}.jpg`;
        
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
    if (tg.shareUrl) {
        const shareText = `🔮 Я только что получил прогноз от "Горностая"! У меня осталось ${appState.freePredictionsLeft} бесплатных прогнозов. Попробуй и ты!`;
        tg.shareUrl(
            `https://t.me/share/url?url=${encodeURIComponent('https://t.me/your_bot')}&text=${encodeURIComponent(shareText)}`,
            'Мой прогноз на день!'
        );
    } else {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Я получил прогноз на день!')}`;
        window.open(shareUrl, '_blank');
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ==========

// Проверка загрузки карт
function testCardsLoad() {
    console.log("🔄 Проверяем загрузку карт...");
    // Проверяем только первые 3 карты для примера
    for(let i = 1; i <= 3; i++) {
        const img = new Image();
        img.src = `${CONFIG.CARDS_BASE_URL}card_(${i}).jpg`;
        img.onload = () => console.log(`✅ Карта ${i} загружена`);
        img.onerror = () => console.error(`❌ Ошибка загрузки карты ${i}. Проверьте путь: ${img.src}`);
    }
}

// Сбросить состояние (для тестирования)
function resetAppState() {
    if (confirm('Сбросить все данные? Это удалит статистику.')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}

// ========== ЗАПУСК ПРИЛОЖЕНИЯ ==========
document.addEventListener('DOMContentLoaded', initApp);
setTimeout(testCardsLoad, 1000);

// Добавляем кнопку сброса в консоль для тестирования (только в development)
if (window.location.href.includes('github.io')) {
    console.log('🔧 Для тестирования используйте resetAppState() в консоли');
            }
