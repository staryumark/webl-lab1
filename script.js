const form = document.getElementById('point-form');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const tableBody = document.getElementById('results-body');
const error = document.getElementById('error');
const storageMessage = document.getElementById('storage-message');
const storageKey = 'point-check-lab-v1';
const canvasSize = 440;
// X сверяем строкой
const xValues = ['-2', '-1.5', '-1', '-0.5', '0', '0.5', '1', '1.5', '2'];
const maxInputLength = 40;
let results = [];

//"2.5" -> { int: 25n, scale: 1 }
function parseDecimal(text) {
    if (typeof text !== 'string') return null;
    const value = text.trim().replace(',', '.');
    const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))$/.exec(value);
    if (!match) return null;
    const sign = match[1] === '-' ? -1n : 1n;
    const intPart = match[2] || '0';
    const fracPart = (match[3] !== undefined ? match[3] : match[4]) || '';
    return { int: sign * BigInt(intPart + fracPart), scale: fracPart.length };
}

function align(a, b) {
    const scale = Math.max(a.scale, b.scale);
    return [
        a.int * 10n ** BigInt(scale - a.scale),
        b.int * 10n ** BigInt(scale - b.scale)
    ];
}

function compare(a, b) {
    const [x, y] = align(a, b);
    return x < y ? -1 : x > y ? 1 : 0;
}

function formatDecimal(d) {
    const digits = (d.int < 0n ? -d.int : d.int).toString().padStart(d.scale + 1, '0');
    const intPart = digits.slice(0, digits.length - d.scale);
    const fracPart = digits.slice(digits.length - d.scale).replace(/0+$/, '');
    const text = intPart + (fracPart ? '.' + fracPart : '');
    return (d.int < 0n ? '-' : '') + text;
}

const Y_MIN = parseDecimal('-5');
const Y_MAX = parseDecimal('3');
const R_MIN = parseDecimal('2');
const R_MAX = parseDecimal('5');

function inOpenRange(value, min, max) {
    return compare(value, min) > 0 && compare(value, max) < 0;
}

//2y <= 2x + R, 4(x² + y²) <= R², 2y >= -R
function isHit(xd, yd, rd) {
    const scale = Math.max(xd.scale, yd.scale, rd.scale);
    const up = function (d) { return d.int * 10n ** BigInt(scale - d.scale); };
    const x = up(xd), y = up(yd), r = up(rd);
    const triangle = x <= 0n && y >= 0n && 2n * y <= 2n * x + r;
    const circle = x >= 0n && y >= 0n && 4n * (x * x + y * y) <= r * r;
    const rectangle = x >= 0n && x <= r && y <= 0n && 2n * y >= -r;
    return triangle || circle || rectangle;
}

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
    canvas.width = canvasSize;
    canvas.height = canvasSize;
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
    const labels = marks.map(formatLabel);
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
        ctx.arc(center + Number(point.x) * scale, center - Number(point.y) * scale, 5, 0, Math.PI * 2);
        ctx.fillStyle = point.hit ? '#16813c' : '#cb2538';
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
}

function formatLabel(value) {
    return String(Number(value.toFixed(3))).replace('-', '−');
}

function showPoint(item) {
    drawCanvas(Number(item.r), item);
    document.getElementById('graph-info').textContent = 'Последняя проверка: X = ' + item.x + ', Y = ' + item.y + ', R = ' + item.r;
}

// LocalStorage можно изменить вручную
function restoreSavedResult(item) {
    if (item === null || typeof item !== 'object') return null;
    const xText = typeof item.x === 'number' ? String(item.x) : item.x;
    const yText = typeof item.y === 'number' ? String(item.y) : item.y;
    const rText = typeof item.r === 'number' ? String(item.r) : item.r;
    if (typeof xText !== 'string' || !xValues.includes(xText)) return null;
    const x = parseDecimal(xText);
    const y = parseDecimal(yText);
    const r = parseDecimal(rText);
    if (!y || !inOpenRange(y, Y_MIN, Y_MAX)) return null;
    if (!r || !inOpenRange(r, R_MIN, R_MAX)) return null;
    if (!Number.isFinite(item.timestamp) || Number.isNaN(new Date(item.timestamp).getTime())) return null;
    return {
        x: xText, y: formatDecimal(y), r: formatDecimal(r),
        hit: isHit(x, y, r), timestamp: item.timestamp
    };
}

try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (!Array.isArray(saved)) throw new Error('Некорректная история');
    results = saved.map(restoreSavedResult).filter(function (item) { return item !== null; });
    if (results.length !== saved.length) storageMessage.textContent = 'Некорректные записи истории пропущены.';
} catch (e) {
    storageMessage.textContent = 'Не удалось прочитать историю. Возможно, браузер запретил LocalStorage.';
}
renderTable();
function showLastState() {
    if (results.length > 0) showPoint(results[results.length - 1]);
    else {
        drawCanvas(3, null);
        document.getElementById('graph-info').textContent = 'Для примера показан радиус R = 3.';
    }
}
showLastState();

// При вводе корректного R график сразу перерисовывается под него
document.getElementById('r').addEventListener('input', function () {
    const r = parseDecimal(this.value);
    if (!r || !inOpenRange(r, R_MIN, R_MAX)) {
        showLastState();
        return;
    }
    const rText = formatDecimal(r);
    const last = results[results.length - 1];
    drawCanvas(Number(rText), last && last.r === rText ? last : null);
    document.getElementById('graph-info').textContent = 'Область для R = ' + rText;
});

form.addEventListener('submit', function (event) {
    event.preventDefault();
    error.textContent = '';
    document.getElementById('result').textContent = '';
    const checked = form.querySelectorAll('input[type="radio"][name="x"]:checked');
    const xText = checked.length === 1 ? checked[0].value : '';
    const yText = String(document.getElementById('y').value);
    const rText = String(document.getElementById('r').value);

    if (!xValues.includes(xText)) { error.textContent = 'Выберите X из предложенных значений.'; return; }
    if (!yText.trim()) { error.textContent = 'Введите Y.'; return; }
    if (yText.length > maxInputLength) { error.textContent = 'Y слишком длинное (не больше ' + maxInputLength + ' символов).'; return; }
    const y = parseDecimal(yText);
    if (!y) { error.textContent = 'Y должно быть обычным десятичным числом.'; return; }
    if (!inOpenRange(y, Y_MIN, Y_MAX)) { error.textContent = 'Y должно быть больше −5 и меньше 3.'; return; }
    if (!rText.trim()) { error.textContent = 'Введите R.'; return; }
    if (rText.length > maxInputLength) { error.textContent = 'R слишком длинное (не больше ' + maxInputLength + ' символов).'; return; }
    const r = parseDecimal(rText);
    if (!r) { error.textContent = 'R должно быть обычным десятичным числом.'; return; }
    if (!inOpenRange(r, R_MIN, R_MAX)) { error.textContent = 'R должно быть больше 2 и меньше 5.'; return; }

    const x = parseDecimal(xText);
    const item = {
        x: xText, y: formatDecimal(y), r: formatDecimal(r),
        hit: isHit(x, y, r), timestamp: Date.now()
    };
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
