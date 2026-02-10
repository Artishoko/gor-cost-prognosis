// Telegram WebApp API
const tg = window.Telegram.WebApp;
tg.expand(); // Раскрываем на весь экран
tg.ready();

// Состояние приложения
let appState = {
    paid: false,
    currentCards: [],
    lastPaymentTime: null
};

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

// НАСТРОЙКИ (ВНИМАТЕЛЬНО ПРОВЕРЬТЕ ЭТИ ССЫЛКИ!)
const CONFIG = {
    // ВАЖНО: Используйте raw-ссылку на папку с картами. Убедитесь, что в папке Cards/ лежат файлы card1.jpg, card2.jpg...
    CARDS_BASE_URL: "https://raw.githubusercontent.com/Artishoko/gor-cost-prognosis/main/Cards/",
    TOTAL_CARDS: 133, // Укажите реальное количество ваших картинок
    INVOICE_URL: "https://t.me/Magic_G_bot?start=invoice_123", // Ссылка на инвойс от @BotFather
    PAYMENT_AMOUNT: 10 // Сумма в звёздах
};

// Инициализация приложения
function initApp() {
    // === ЛОГИКА ДЛЯ ПЕРВЫХ 100 БЕСПЛАТНЫХ ПОЛЬЗОВАТЕЛЕЙ ===
    const freeAccessKey = 'hasFreeAccess';
    const freeAccessGivenKey = 'freeAccessCounter';

    // Получаем текущий счётчик
    let freeAccessCounter = parseInt(localStorage.getItem(freeAccessGivenKey)) || 0;
    const userAlreadyGotFreeAccess = localStorage.getItem(freeAccessKey);

    // Если пользователь ещё не получал доступ и счётчик меньше 100
    if (!userAlreadyGotFreeAccess && freeAccessCounter < 100) {
        appState.paid = true; // Даём доступ
        localStorage.setItem(freeAccessKey, 'true'); // Помечаем пользователя
        freeAccessCounter++; // Увеличиваем счётчик
        localStorage.setItem(freeAccessGivenKey, freeAccessCounter.toString());
        console.log(`Бесплатный доступ выдан. Всего получило: ${freeAccessCounter}/100 пользователей.`);
    }

    // === ОРИГИНАЛЬНАЯ ЛОГИКА ИНИЦИАЛИЗАЦИИ ===
    // Проверяем, был ли уже оплачен прогноз ранее (из сохранённого состояния)
    const savedState = localStorage.getItem('gor_cost_app_state');
    if (savedState) {
        try {
            appState = JSON.parse(savedState);
            // Проверяем, не прошло ли больше 24 часа с последней оплаты
            if (appState.lastPaymentTime && 
                (Date.now() - appState.lastPaymentTime) < 24 * 60 * 60 * 1000) {
                appState.paid = true;
            } else {
                appState.paid = false;
            }
        } catch (e) {
            console.error('Ошибка загрузки состояния:', e);
        }
    }
    
    // Обновляем кнопки в зависимости от состояния оплаты
    updatePaymentButton();
    // Назначаем обработчики событий
    setupEventListeners();
}

// Назначаем обработчики кнопок
function setupEventListeners() {
    buttons.start.addEventListener('click', () => showScreen('payment'));
    buttons.donate.addEventListener('click', processPayment);
    buttons.getPrognosis.addEventListener('click', () => {
        generatePrognosis();
        showScreen('result');
    });
    buttons.share.addEventListener('click', sharePrognosis);
    buttons.new.addEventListener('click', () => {
        if (appState.paid && appState.currentCards.length > 0) {
            generatePrognosis(); // Новый расклад, если оплачено
        } else {
            showScreen('payment'); // Иначе возврат к оплате
        }
    });
}

// Показать определённый экран
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
    if (screenName === 'payment') updatePaymentButton();
}

// Обновить состояние кнопки оплаты
function updatePaymentButton() {
    buttons.getPrognosis.disabled = !appState.paid;
    
    if (appState.paid) {
        buttons.donate.innerHTML = '<span class="star">✅</span> Оплачено';
        buttons.donate.style.opacity = '0.7';
        buttons.donate.style.cursor = 'default';
    } else {
        buttons.donate.innerHTML = `<span class="star">⭐</span> Донат ${CONFIG.PAYMENT_AMOUNT} звёзд`;
        buttons.donate.style.opacity = '1';
        buttons.donate.style.cursor = 'pointer';
    }
}

// Обработка платежа через Telegram Stars
function processPayment() {
    if (appState.paid) {
        alert('Вы уже оплатили прогноз на сегодня!');
        return;
    }
    
    tg.openInvoice(CONFIG.INVOICE_URL, (status) => {
        if (status === 'paid') {
            appState.paid = true;
            appState.lastPaymentTime = Date.now();
            saveState();
            updatePaymentButton();
            
            if (tg.showAlert) {
                tg.showAlert('✅ Оплата прошла успешно! Теперь можете получить прогноз.');
            }
        } else if (status === 'failed') {
            alert('Оплата не удалась. Попробуйте еще раз.');
        } else if (status === 'cancelled') {
            console.log('Пользователь отменил оплату');
        }
    });
}

// Генерация случайных карт
function generatePrognosis() {
    if (!appState.paid) {
        alert('Сначала нужно оплатить прогноз!');
        return;
    }
    
    const cards = [];
    while (cards.length < 6) {
        const randomCard = Math.floor(Math.random() * CONFIG.TOTAL_CARDS) + 1;
        if (!cards.includes(randomCard)) cards.push(randomCard);
    }
    
    appState.currentCards = cards;
    saveState();
    displayCards(cards);
}

// Отображение карт на экране результата
function displayCards(cardNumbers) {
    const positions = ['success', 'risk', 'mood', 'morning', 'day', 'evening'];
    
    positions.forEach((position, index) => {
        const cardElement = document.getElementById(`card-${position}`);
        const cardNumber = cardNumbers[index];
        // Формируем правильный URL карты
        const cardUrl = `${CONFIG.CARDS_BASE_URL}card_(${cardNumber}).jpg`;
        
        const img = cardElement.querySelector('img');
        img.src = cardUrl;
        img.alt = `Карта ${cardNumber}`;
        
        cardElement.classList.remove('revealed');
        setTimeout(() => cardElement.classList.add('revealed'), index * 100);
    });
}

// Поделиться прогнозом
function sharePrognosis() {
    if (tg.shareUrl) {
        const shareText = `🔮 Мой прогноз на день от "Прогноз от Горностая"!\n\nПрисоединяйся: https://t.me/${tg.initDataUnsafe.user?.username || 'your_bot'}`;
        tg.shareUrl(
            `https://t.me/share/url?url=${encodeURIComponent('https://t.me/your_bot')}&text=${encodeURIComponent(shareText)}`,
            'Посмотри мой прогноз на день!'
        );
    } else {
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Я получил прогноз на день!')}`;
        window.open(shareUrl, '_blank');
    }
}

// Сохранить состояние в localStorage
function saveState() {
    localStorage.setItem('gor_cost_app_state', JSON.stringify(appState));
}

// Запуск приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', initApp);

// Функция для проверки загрузки карт (для отладки)
function testCardsLoad() {
    console.log("🔄 Тестируем загрузку карт...");
    for(let i = 1; i <= 3; i++) { // Проверяем только первые 3 карты
        const img = new Image();
        img.src = `${CONFIG.CARDS_BASE_URL}card${i}.jpg`;
        img.onload = () => console.log(`✅ Карта ${i} загружена: ${img.src}`);
        img.onerror = () => console.error(`❌ Ошибка загрузки карты ${i}: ${img.src}`);
    }
}
// Проверка через секунду после загрузки
setTimeout(testCardsLoad, 1000);
