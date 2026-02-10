// Telegram WebApp API

function initApp() {
    // === КОД ДЛЯ ПРОВЕРКИ "ПЕРВЫХ 100" ЧЕРЕЗ LOCALSTORAGE ===
    const freeAccessKey = 'hasFreeAccess'; // Ключ для хранения метки у пользователя
    const freeAccessGivenKey = 'freeAccessCounter'; // Ключ для нашего "счётчика"
    
    // 1. Пытаемся получить наш "счётчик" из localStorage
    let freeAccessCounter = parseInt(localStorage.getItem(freeAccessGivenKey)) || 0;
    
    // 2. Проверяем, получал ли уже ЭТОТ пользователь бесплатный доступ
    const userAlreadyGotFreeAccess = localStorage.getItem(freeAccessKey);
    
    // 3. Если пользователь еще не получал доступ И счётчик меньше 100
    if (!userAlreadyGotFreeAccess && freeAccessCounter < 100) {
        // Даём ему бесплатный доступ
        appState.paid = true;
        // Помечаем, чтобы больше не давать
        localStorage.setItem(freeAccessKey, 'true');
        // Увеличиваем наш "счётчик" на 1
        freeAccessCounter++;
        localStorage.setItem(freeAccessGivenKey, freeAccessCounter.toString());
        
        console.log(`Бесплатный доступ выдан. Всего получило: ${freeAccessCounter}/100 пользователей.`);
    }
    // === КОНЕЦ ДОБАВЛЕННОГО КОДА ===
    
    // ... остальная существующая логика функции initApp() ...
    // Проверяем, был ли уже оплачен прогноз
    const savedState = localStorage.getItem('gor_cost_app_state');
    // ... и так далее ...
}

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

// Настройки (ЗАМЕНИТЕ ЭТИ ССЫЛКИ!)
const CONFIG = {
    // Замените на ваши реальные ссылки
    CARDS_BASE_URL: "https://github.com/Artishoko/gor-cost-prognosis/blob/f3edc4f54480da780cdf863bc975b48e33b72d6d/Cards/", // Папка с картами на GitHub
    TOTAL_CARDS: 139,
    INVOICE_URL: "https://t.me/Magic_G_bot?start=invoice_123", // Получите у @BotFather
    PAYMENT_AMOUNT: 10 // Звёзд
};

// Инициализация
function initApp() {
    // Проверяем, был ли уже оплачен прогноз
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
    // Старт
    buttons.start.addEventListener('click', () => {
        showScreen('payment');
    });
    
    // Донат через Telegram Stars
    buttons.donate.addEventListener('click', () => {
        processPayment();
    });
    
    // Получить прогноз
    buttons.getPrognosis.addEventListener('click', () => {
        generatePrognosis();
        showScreen('result');
    });
    
    // Поделиться
    buttons.share.addEventListener('click', sharePrognosis);
    
    // Новый прогноз
    buttons.new.addEventListener('click', () => {
        if (appState.paid && appState.currentCards.length > 0) {
            // Если уже оплачено, генерируем новый расклад
            generatePrognosis();
        } else {
            // Иначе возвращаем к оплате
            showScreen('payment');
        }
    });
}

// Показать определенный экран
function showScreen(screenName) {
    // Скрываем все экраны
    Object.values(screens).forEach(screen => {
        screen.classList.remove('active');
    });
    
    // Показываем нужный экран
    screens[screenName].classList.add('active');
    
    // Обновляем состояние кнопок
    if (screenName === 'payment') {
        updatePaymentButton();
    }
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
    
    // Открываем инвойс для оплаты
    tg.openInvoice(CONFIG.INVOICE_URL, (status) => {
        if (status === 'paid') {
            // Успешная оплата
            appState.paid = true;
            appState.lastPaymentTime = Date.now();
            saveState();
            updatePaymentButton();
            
            // Показываем уведомление в Telegram
            if (tg.showAlert) {
                tg.showAlert('✅ Оплата прошла успешно! Теперь можете получить прогноз.');
            }
        } else if (status === 'failed') {
            alert('Оплата не удалась. Попробуйте еще раз.');
        } else if (status === 'cancelled') {
            // Пользователь отменил оплату
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
    
    // Генерируем 6 уникальных случайных чисел от 1 до 108
    const cards = [];
    while (cards.length < 6) {
        const randomCard = Math.floor(Math.random() * CONFIG.TOTAL_CARDS) + 1;
        if (!cards.includes(randomCard)) {
            cards.push(randomCard);
        }
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
        
        // Формируем URL карты (предполагаем, что карты названы card1.jpg, card2.jpg и т.д.)
        const cardUrl = `${CONFIG.CARDS_BASE_URL}card${cardNumber}.jpg`;
        
        // Устанавливаем изображение
        const img = cardElement.querySelector('img');
        img.src = cardUrl;
        img.alt = `Карта ${cardNumber}`;
        
        // Добавляем анимацию
        cardElement.classList.remove('revealed');
        setTimeout(() => {
            cardElement.classList.add('revealed');
        }, index * 100); // Задержка для эффекта последовательного открытия
    });
}

// Поделиться прогнозом
function sharePrognosis() {
    if (tg.shareUrl) {
        // В реальном приложении здесь можно сгенерировать изображение с раскладом
        // Для простоты делимся ссылкой на бота
        const shareText = `🔮 Мой прогноз на день от "Прогноз от Горностая"!\n\nПрисоединяйся: https://t.me/${tg.initDataUnsafe.user?.username || 'your_bot'}`;
        
        tg.shareUrl(
            `https://t.me/share/url?url=${encodeURIComponent('https://t.me/your_bot')}&text=${encodeURIComponent(shareText)}`,
            'Посмотри мой прогноз на день!'
        );
    } else {
        // Для браузера или если функция недоступна
        const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent('Я получил прогноз на день!')}`;
        window.open(shareUrl, '_blank');
    }
}

// Сохранить состояние в localStorage
function saveState() {
    localStorage.setItem('gor_cost_app_state', JSON.stringify(appState));
}

// Запуск приложения при загрузке
document.addEventListener('DOMContentLoaded', initApp);

// Функция для отладки (можно удалить в продакшене)
function debugGenerateFree() {
    appState.paid = true;
    updatePaymentButton();
    buttons.getPrognosis.disabled = false;
    console.log('Режим отладки: оплата активирована');
}

// Для тестирования можно раскомментировать:
// debugGenerateFree();

// Функция для проверки загрузки карт
function testCardsLoad() {
    console.log("🔄 Тестируем загрузку карт...");
    
    // Проверяем первые 5 карт
    for(let i = 1; i <= 5; i++) {
        const img = new Image();
        img.src = `${CONFIG.CARDS_BASE_URL}card${i}.jpg`;
        
        img.onload = function() {
            console.log(`✅ Карта ${i} загружена успешно: ${img.src}`);
        };
        
        img.onerror = function() {
            console.error(`❌ Ошибка загрузки карты ${i}: ${img.src}`);
        };
    }
}

// Вызвать после загрузки страницы
setTimeout(testCardsLoad, 1000);
