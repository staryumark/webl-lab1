const form = document.getElementById('point-form');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const tableBody = document.getElementById('results-body');
const error = document.getElementById('error');
const storageMessage = document.getElementById('storage-message');
const storageKey = 'point-check-lab-v1';
const xValues = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
let results = [];

// Принимаем обычные десятичные числа
function readNumber(text) {
    const value = text.trim().replace(',', '.');
    if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(value)) {
        return NaN;
    }
    return Number(value);
}

function isHit(x, y, r) {
    const triangle = x <= 0 && y >= 0 && y <= x + r / 2;
    const circle = x >= 0 && y >= 0 && x * x + y * y <= r * r / 4;
    const rectangle = x >= 0 && x <= r && y <= 0 && y >= -r / 2;
    return triangle || circle || rectangle;
}

// Момент времени
function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString('ru-RU', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    });
}

function renderTable() {
    tableBody.textContent = '';
    if (results.length === 0) {
        const row = tableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 5;
        cell.textContent = 'Проверок пока нет';
        return;
    }
    for (let i = results.length - 1; i >= 0; i--) {
        const item = results[i];
        const row = tableBody.insertRow();
        const values = [item.x, item.y, item.r, item.hit ? 'Попадание' : 'Промах', formatDate(item.timestamp)];
        values.forEach(function (value) {
            row.insertCell().textContent = value;
        });
    }
}

function drawCanvas(r, point) {
    const center = 220;
    const scale = 36;
    const size = r * scale;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(48, 145, 245, 0.75)';
    ctx.beginPath();
    ctx.moveTo(center - size / 2, center);
    ctx.lineTo(center, center - size / 2);
    ctx.lineTo(center, center);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, size / 2, -Math.PI / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(center, center, size, size / 2);

    ctx.strokeStyle = '#263345';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(18, center); ctx.lineTo(422, center);
    ctx.moveTo(center, 422); ctx.lineTo(center, 18);
    ctx.moveTo(415, center - 4); ctx.lineTo(422, center); ctx.lineTo(415, center + 4);
    ctx.moveTo(center - 4, 25); ctx.lineTo(center, 18); ctx.lineTo(center + 4, 25);
    ctx.stroke();
    ctx.fillStyle = '#263345';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('x', 425, center - 8);
    ctx.fillText('y', center + 8, 18);
    ctx.fillText('0', center - 14, center + 16);
    const marks = [-r, -r / 2, r / 2, r];
    const labels = ['−R', '−R/2', 'R/2', 'R'];
    marks.forEach(function (value, index) {
        const px = center + value * scale;
        const py = center - value * scale;
        ctx.beginPath();
        ctx.moveTo(px, center - 4); ctx.lineTo(px, center + 4);
        ctx.moveTo(center - 4, py); ctx.lineTo(center + 4, py);
        ctx.stroke();
        ctx.textAlign = 'center';
        ctx.fillText(labels[index], px, center - 10);
        ctx.textAlign = 'left';
        ctx.fillText(labels[index], center + 9, py + 5);
    });
    if (point) {
        ctx.beginPath();
        ctx.arc(center + point.x * scale, center - point.y * scale, 5, 0, Math.PI * 2);
        ctx.fillStyle = point.hit ? '#16813c' : '#cb2538';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

function showPoint(item) {
    drawCanvas(item.r, item);
    document.getElementById('graph-info').textContent = 'Последняя проверка: X = ' + item.x + ', Y = ' + item.y + ', R = ' + item.r;
}

// Localstorage могло быть изменено
function validSavedResult(item) {
    return item !== null && typeof item === 'object' &&
        xValues.includes(item.x) && Number.isFinite(item.y) && item.y > -5 && item.y < 3 &&
        Number.isFinite(item.r) && item.r > 2 && item.r < 5 &&
        Number.isFinite(item.timestamp) && !Number.isNaN(new Date(item.timestamp).getTime());
}

try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved)) throw new Error('Некорректная история');
    results = saved.filter(validSavedResult);
    results.forEach(function (item) { item.hit = isHit(item.x, item.y, item.r); });
    if (results.length !== saved.length) storageMessage.textContent = 'Некорректные записи истории пропущены.';
} catch (e) {
    storageMessage.textContent = 'Не удалось прочитать историю. Возможно, браузер запретил LocalStorage.';
}
renderTable();
if (results.length > 0) showPoint(results[results.length - 1]);
else drawCanvas(3, null);

form.addEventListener('submit', function (event) {
    event.preventDefault();
    error.textContent = '';
    document.getElementById('result').textContent = '';
    const selectedX = document.querySelector('input[name="x"]:checked');
    const yText = document.getElementById('y').value;
    const rText = document.getElementById('r').value;
    const x = selectedX ? Number(selectedX.value) : NaN;
    const y = readNumber(yText);
    const r = readNumber(rText);
    if (!xValues.includes(x)) { error.textContent = 'Выберите X.'; return; }
    if (!yText.trim()) { error.textContent = 'Введите Y.'; return; }
    if (!Number.isFinite(y)) { error.textContent = 'Y должно быть обычным десятичным числом.'; return; }
    if (y <= -5 || y >= 3) { error.textContent = 'Y должно быть больше −5 и меньше 3.'; return; }
    if (!rText.trim()) { error.textContent = 'Введите R.'; return; }
    if (!Number.isFinite(r)) { error.textContent = 'R должно быть обычным десятичным числом.'; return; }
    if (r <= 2 || r >= 5) { error.textContent = 'R должно быть больше 2 и меньше 5.'; return; }
    const item = { x: x, y: y, r: r, hit: isHit(x, y, r), timestamp: Date.now() };
    results.push(item);
    try {
        localStorage.setItem(storageKey, JSON.stringify(results));
        storageMessage.textContent = '';
    } catch (e) {
        storageMessage.textContent = 'Проверка выполнена, но историю сохранить не удалось. Проверьте доступность и свободное место LocalStorage.';
    }
    renderTable();
    showPoint(item);
    document.getElementById('result').textContent = item.hit ? 'Точка попала в область.' : 'Точка не попала в область.';
});

// Обновляем время
let timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let offset = new Date().getTimezoneOffset();
function refreshTimezone() {
    const nextTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const nextOffset = new Date().getTimezoneOffset();
    if (nextTimezone !== timezone || nextOffset !== offset) {
        timezone = nextTimezone;
        offset = nextOffset;
        renderTable();
    }
}
window.addEventListener('focus', refreshTimezone);
setInterval(refreshTimezone, 1000);
