/**
 * human_simulator.js
 * 
 * Module mô phỏng hành vi người dùng tự nhiên (Human Emulation) chống phát hiện Bot:
 * 1. Di chuyển chuột đường cong Cubic Bézier với gia tốc giảm dần (Human Easing).
 * 2. Click vật lý có thời gian giữ chuột (Click Dwell Time) và độ lệch ngẫu nhiên khỏi tâm tuyệt đối.
 * 3. Gõ phím sinh trắc học (Human Keystroke Dynamics) với độ trễ biến thiên từng ký tự.
 */

function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomDelay(min = 100, max = 300) {
    const ms = getRandomInt(min, max);
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Hàm nội suy Cubic Bézier
 */
function cubicBezier(p0, p1, p2, p3, t) {
    const cX = 3 * (p1.x - p0.x);
    const bX = 3 * (p2.x - p1.x) - cX;
    const aX = p3.x - p0.x - cX - bX;

    const cY = 3 * (p1.y - p0.y);
    const bY = 3 * (p2.y - p1.y) - cY;
    const aY = p3.y - p0.y - cY - bY;

    const x = ((aX * t + bX) * t + cX) * t + p0.x;
    const y = ((aY * t + bY) * t + cY) * t + p0.y;
    return { x, y };
}

/**
 * Hàm Easing mô phỏng người thật: khởi đầu tự nhiên, tăng tốc lướt qua, giảm tốc khi tiếp cận
 */
function easeInOutQuad(t) {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/**
 * Di chuyển chuột theo đường cong tự nhiên từ vị trí hiện tại tới tọa độ mục tiêu
 * @param {import('puppeteer').Page} page
 * @param {number} targetX
 * @param {number} targetY
 * @param {{steps?: number}} [options]
 */
async function humanMouseMove(page, targetX, targetY, options = {}) {
    if (!page || page.isClosed()) return;

    // Lấy tọa độ chuột hiện tại, nếu chưa có thì khởi tạo ngẫu nhiên trên màn hình
    let currentX = page.__currentMouseX ?? getRandomInt(100, 400);
    let currentY = page.__currentMouseY ?? getRandomInt(100, 400);

    const deltaX = targetX - currentX;
    const deltaY = targetY - currentY;
    const distance = Math.hypot(deltaX, deltaY);

    // Tính số bước dựa trên khoảng cách (tối thiểu 15 bước, tối đa 40 bước)
    const baseSteps = options.steps || Math.min(Math.max(Math.floor(distance / 15), 15), 40);

    // Tạo 2 điểm điều khiển P1, P2 lệch khỏi đường thẳng để tạo đường cong tự nhiên
    const deviation = Math.min(distance * 0.25, 80);
    const perpX = -deltaY / (distance || 1);
    const perpY = deltaX / (distance || 1);

    const factor1 = (Math.random() - 0.5) * 2 * deviation;
    const factor2 = (Math.random() - 0.5) * 2 * deviation;

    const p0 = { x: currentX, y: currentY };
    const p1 = {
        x: currentX + deltaX * 0.33 + perpX * factor1,
        y: currentY + deltaY * 0.33 + perpY * factor1
    };
    const p2 = {
        x: currentX + deltaX * 0.66 + perpX * factor2,
        y: currentY + deltaY * 0.66 + perpY * factor2
    };
    const p3 = { x: targetX, y: targetY };

    for (let i = 1; i <= baseSteps; i++) {
        const rawT = i / baseSteps;
        const easedT = easeInOutQuad(rawT);
        const point = cubicBezier(p0, p1, p2, p3, easedT);

        await page.mouse.move(point.x, point.y).catch(() => {});
        page.__currentMouseX = point.x;
        page.__currentMouseY = point.y;

        // Thời gian nghỉ ngắn giữa các bước (3 - 10ms)
        const stepDelay = getRandomInt(3, 10);
        await new Promise(r => setTimeout(r, stepDelay));
    }

    // Đảm bảo kết thúc chính xác tại mục tiêu
    await page.mouse.move(targetX, targetY).catch(() => {});
    page.__currentMouseX = targetX;
    page.__currentMouseY = targetY;
}

/**
 * Click chuột có mô phỏng sinh trắc học (Dwell click, độ lệch tâm ngẫu nhiên)
 * @param {import('puppeteer').Page} page
 * @param {any} elementOrSelector ElementHandle hoặc chuỗi CSS selector
 * @param {{dwellMin?: number, dwellMax?: number, hoverMin?: number, hoverMax?: number}} [options]
 */
async function humanClick(page, elementOrSelector, options = {}) {
    if (!page || page.isClosed()) return false;

    try {
        let element = elementOrSelector;
        if (typeof elementOrSelector === 'string') {
            element = await page.$(elementOrSelector);
        }
        if (!element) return false;

        const box = await element.boundingBox();
        if (!box) {
            // Fallback nếu không tính được bounding box (ví dụ phần tử ẩn)
            await element.click().catch(() => {});
            return true;
        }

        // Tạo độ lệch ngẫu nhiên trong phạm vi 30% bán kính để tránh click đúng tâm tuyệt đối
        const offsetX = (Math.random() - 0.5) * (box.width * 0.4);
        const offsetY = (Math.random() - 0.5) * (box.height * 0.4);

        const targetX = box.x + box.width / 2 + offsetX;
        const targetY = box.y + box.height / 2 + offsetY;

        // 1. Di chuyển chuột mượt mà tới phần tử
        await humanMouseMove(page, targetX, targetY);

        // 2. Hover nhẹ trên nút (người thật quan sát nút trước khi bấm)
        await randomDelay(options.hoverMin || 80, options.hoverMax || 200);

        // 3. Nhấn chuột xuống (mouse down)
        await page.mouse.down().catch(() => {});

        // 4. Click Dwell Time (thời gian giữ chuột vật lý của người thật: 60 - 130ms)
        await randomDelay(options.dwellMin || 60, options.dwellMax || 130);

        // 5. Nhả chuột (mouse up)
        await page.mouse.up().catch(() => {});

        // 6. Nghỉ ngắn sau thao tác click
        await randomDelay(80, 200);

        return true;
    } catch (err) {
        console.log('humanClick fallback error:', err.message);
        try {
            if (elementOrSelector && typeof elementOrSelector.click === 'function') {
                await elementOrSelector.click().catch(() => {});
                return true;
            }
        } catch (e) {}
        return false;
    }
}

/**
 * Gõ bàn phím theo nhịp sinh học người thật (Keystroke Dynamics)
 * @param {import('puppeteer').Page} page
 * @param {string} text
 * @param {any} [elementOrSelector] Ô input mục tiêu (nếu có sẽ click trước khi gõ)
 * @param {{clearFirst?: boolean}} [options]
 */
async function humanType(page, text, elementOrSelector = null, options = {}) {
    if (!page || page.isClosed() || typeof text !== 'string') return;

    if (elementOrSelector) {
        await humanClick(page, elementOrSelector);
        await randomDelay(100, 250);

        if (options.clearFirst) {
            // Chọn toàn bộ text và xóa bằng phím tự nhiên
            const isMac = process.platform === 'darwin';
            const modifier = isMac ? 'Meta' : 'Control';
            await page.keyboard.down(modifier);
            await page.keyboard.press('KeyA');
            await page.keyboard.up(modifier);
            await randomDelay(50, 100);
            await page.keyboard.press('Backspace');
            await randomDelay(100, 200);
        }
    }

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const isUpper = char >= 'A' && char <= 'Z';
        const isSpecial = '!@#$%^&*()_+{}|:"<>?~`-=[]\\;\',./'.includes(char);

        // Tính toán độ trễ tự nhiên theo loại ký tự
        let delayMs = getRandomInt(45, 110);
        if (isUpper || isSpecial) {
            // Ký tự hoa hoặc đặc biệt cần nhấn giữ Shift nên độ trễ dài hơn
            delayMs = getRandomInt(140, 260);
        }

        // Xác suất 6% người dùng dừng lại suy nghĩ một nhịp ngắn (300 - 550ms)
        if (Math.random() < 0.06 && i > 0 && i < text.length - 1) {
            await randomDelay(280, 500);
        }

        await page.keyboard.type(char, { delay: delayMs }).catch(() => {});
    }

    await randomDelay(150, 300);
}

export {
    getRandomInt,
    randomDelay,
    humanMouseMove,
    humanClick,
    humanType
};

export default {
    getRandomInt,
    randomDelay,
    humanMouseMove,
    humanClick,
    humanType
};
