import helper from '../helper.pup.js';
import { appendContentToFile } from '../utils.js';
import { name_viet } from '../name_viet.js';
import { name_viet as name_us } from '../name_us.js';
import { authorizeWithGoogle } from './google_oauth.js';
import { bumpUaMajor } from './ua_version.js';
import { traceStep, snapshotPage } from './debug_trace.js';

const { clickSelector, clickXpath, actionBeforeCapcha, checkFunction, getString, getRandomInt } = helper;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A step returns NEXT to re-read the page, or a boolean when the whole signup is decided. */
export const NEXT = Symbol('next');

const WEBCAST_URL = 'https://webcast.tiktok.com';
const MAX_SIGNUP_VISITS = 6;
const SIGNUP_RELOAD_AT = 5;
const AGE_GATE_RELOAD_AT = 3;
const BIRTHDAY_WAIT_SECONDS = 30;
const SET_NICKNAME_WAIT_MS = 31000; // TikTok rate-limits profile updates right after the avatar upload
const MAX_LIVE_ROOM_VIEWERS = 40;
const BIRTHDAY_LABELS = ['Tháng', 'Ngày', 'Năm', 'Month', 'Day', 'Year'];
const LIVE_ROOM_START_INDEX = 3;

const customNicknames = new Set(
    [...name_viet, ...name_us].map(item => item.split('|')[0]?.trim()).filter(Boolean)
);
const hasCustomNickname = (nickname) => Boolean(nickname) && customNicknames.has(nickname.trim());

let changedAgent = false;

const movePointer = (page) => page.mouse.move(getRandomInt(300, 350), getRandomInt(400, 500));

async function readState(clone) {
    // clone.page can point at a frame that the OAuth redirect swapped out; getPage() re-selects the live tab.
    const page = await clone.getPage();
    if (!page) throw new Error('No live page (tab closed or crashed)');
    try {
        const url = page.url();
        const [bodyText, bodyHtml] = await Promise.all([
            page.evaluate(() => document.body.innerText),
            page.evaluate(() => document.body.innerHTML),
        ]);
        console.log(clone.info.email, 'currentUrl', url);
        return { clone, page, url, bodyText, bodyHtml };
    } catch (e) {
        console.log('Error get begin page', e.message);
        await page.reload().catch(() => { });
        await delay(5000);
        return null;
    }
}

/** Copies TikTok's per-device security state (wid, sdk keys, cookies) from the page onto the clone. */
async function captureSession(clone, page, bodyHtml) {
    const wid = /wid":"(.*?)"/.exec(bodyHtml)?.[1];
    const webIdCreatedTime = /webIdCreatedTime":"(.*?)"/.exec(bodyHtml)?.[1];
    if (wid) clone.wid = wid;
    if (webIdCreatedTime) clone.webIdCreatedTime = clone.info.webIdCreatedTime = webIdCreatedTime;

    const sdk = await page.evaluate(() => ({
        crypt_sdk: localStorage['security-sdk/s_sdk_crypt_sdk'],
        sign_data_key: localStorage['security-sdk/s_sdk_sign_data_key/tt_fetch'],
    }));
    if (sdk.crypt_sdk) clone.crypt_sdk = sdk.crypt_sdk;
    if (sdk.sign_data_key) clone.sign_data_key = sdk.sign_data_key;

    clone.user_agent = await page.browser().userAgent();
    const cookieString = `${await clone.getCookieBrowser(page, 'https://www.tiktok.com')};wid=${clone.wid};`;
    clone.cookie_string = clone.cookie = cookieString;
    return cookieString;
}

/** Resolves the account's username from its cookie; null when the session is not logged in. */
async function fetchUsername(clone, cookieString) {
    const dataUser = await helper.checkCookieLive({ cookie_string: cookieString, proxy: clone.proxy, proxy_list: [clone.proxy] });
    console.log('data_user', dataUser);
    const username = JSON.parse(dataUser.body).data.username;
    if (username) clone.info.username = username;
    return username || null;
}

async function gotoWebcast(clone, page) {
    await page.goto(WEBCAST_URL, { waitUntil: 'networkidle0' });
    await delay(2000);
    return NEXT;
}

// ---- individual states -------------------------------------------------------------------------

async function handleSessionExpired({ clone, page }) {
    await page.reload();
    await clickSelector(clone.getPage.bind(clone), "#loginContainer form div[tabindex='0']", 0, 2, true);
    console.log(clone.info.email, 'pass cancel Đăng nhập đã hết hạn');
    return NEXT;
}

async function handlePrivacyChoice({ clone, page }) {
    console.log(clone.info.email, 'riêng tư');
    const publicSpan = await checkFunction({
        name: 'Tài khoản công khai span',
        fn: async () => (await page.$x("//span[text()='Tài khoản công khai'] | //span[contains(text(),'Tài khoản công khai')][contains(text(),'Chọn')]"))[0]
    });
    if (publicSpan) await publicSpan.click();
    const publicDiv = await checkFunction({
        name: 'div Tài khoản công khai',
        fn: async () => (await page.$x("//div[text()='Tài khoản công khai'] | //div[contains(text(),'Tài khoản công khai')][contains(text(),'Chọn')]"))[0]
    });
    if (publicDiv) await publicDiv.click();
    await movePointer(page);
    await delay(2000);
    return NEXT;
}

async function handleChromeError({ page }) {
    await delay(4000);
    await page.reload().catch(() => { });
    await delay(3000);
    return NEXT;
}

async function handleDownloadApp({ clone }) {
    const { info } = clone;
    if (!changedAgent) {
        helper.changeAgentVer();
        bumpUaMajor();
        changedAgent = true;
    }
    await appendContentToFile('./email_failed.txt', `${info.email}|${info.email_password}\n`);
    return false;
}

/** Final state: webcast.tiktok.com means the session is fully warmed up; persist the account. */
async function handleWebcast({ clone, page }) {
    const { info } = clone;
    await delay(2000);
    const cookies = await page.cookies('https://www.tiktok.com');
    const client = await page.target().createCDPSession();
    await client.send('Network.enable');
    const { cookies: cookieObjects } = await client.send('Network.getAllCookies');

    let cookieString = `${cookies.map(c => `${c.name}=${c.value}`).join('; ')};wid=${clone.wid};`;
    const replaceMsToken = (token) => { cookieString = cookieString.replace(/msToken=[^;]+/, `msToken=${token}`); };
    if (clone.global_val.msTokenGood) replaceMsToken(clone.global_val.msTokenGood);
    const msTokenCookie = cookieObjects.find(c => c.domain.includes('.tiktok.com') && c.name === 'msToken');
    if (msTokenCookie) replaceMsToken(msTokenCookie.value);

    clone.cookie = cookieString;
    clone.cookieObjects = cookieObjects;

    try {
        const dataUser = await helper.checkCookieLive({ cookie_string: cookieString, proxy: clone.proxy, proxy_list: [clone.proxy] });
        console.log('data_user', dataUser);
        const username = JSON.parse(dataUser.body).data.username;
        if (username) info.username = username;
    } catch (e) {
        console.log('error reading username', e.message);
    }

    const msToken = cookieString.match(/msToken=([^;]+)/)?.[1];
    if (msToken) console.log(info.email, '🎯 msToken length:', msToken.length);
    if (msToken && msToken.length < 156) console.log(info.email, 'msToken length is less than 156');

    const row = [info.username, info.password, info.email, info.email_password, cookieString,
        info.birthday_year, info.birthday_month, info.birthday_day, info.last_name, info.first_name,
        new Date().toLocaleString()].join('|');
    await appendContentToFile('./account_reg.txt', `${row}\n`);
    return true;
}

/** Picks a small live room, enters it, then continues to webcast (only used with is_stop_username / REG_WATCH_LIVE). */
async function handleLive({ clone, page, bodyHtml }) {
    const { info } = clone;
    const cookieString = await captureSession(clone, page, bodyHtml);
    if (!await fetchUsername(clone, cookieString)) return false;
    if (!clone.reload_live) {
        clone.reload_live = true;
        await delay(2000);
        return NEXT;
    }

    const cookies = await page.cookies('https://www.tiktok.com');
    const roomCookie = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const liveLinks = await page.$$eval('a[href*="/live"]', els => els
        .map(el => el.href).filter(href => href.includes('tiktok.com/@') && href.includes('/live')));

    let roomIndex = LIVE_ROOM_START_INDEX;
    const checked = new Set();
    try {
        for (let i = 1; i < liveLinks.length; i++) {
            const roomUser = getString(liveLinks[i], 'tiktok.com/@', '/live');
            if (checked.has(roomUser)) continue;
            const room = await helper.getRoomId3({ name: roomUser, proxy: clone.proxy });
            if (room.data.user.status == 2 && room.data.liveRoom.liveRoomStats.userCount < MAX_LIVE_ROOM_VIEWERS) {
                roomIndex = i + 1;
                console.log('index_live_select', roomIndex, roomUser);
                break;
            }
            checked.add(roomUser);
        }
    } catch (e) { /* fall back to the default room index */ }

    await clickXpath(clone.getPage.bind(clone), '//a[contains(@href, "/live")]', roomIndex);
    await delay(20000);
    const roomName = getString(`${page.url()}/`, '@', '/');
    const check = await helper.checkInToRoom({
        name: roomName, username: info.username, proxy: clone.proxy, proxy_list: [clone.proxy], cookie_string: roomCookie
    });
    console.log('data_check', check, 'is_join', clone.is_join);
    // The online_audience response listener may already have flagged the join; never downgrade it.
    if (check.is_join || !clone.is_join) clone.is_join = info.is_join = check.is_join;
    clone.check_room_status = check.status;
    if (!clone.is_join || !clone.check_room_status) console.log(info.username, 'not join', roomName);

    return gotoWebcast(clone, page);
}

async function uploadAvatar(clone, page, cookieString) {
    console.log('Building upload image request metadata...');
    const uploadData = await helper.buildUploadImageUrlJSON({
        path_image: clone.info.avatar,
        user_agent: clone.user_agent,
        cookie_string: cookieString,
        webIdCreatedTime: clone.webIdCreatedTime
    });
    try {
        const result = await page.evaluate(async (upload) => {
            const bytes = Uint8Array.from(atob(upload.base64Data), ch => ch.charCodeAt(0));
            const formData = new FormData();
            formData.append('file', new Blob([bytes], { type: 'image/png' }), 'avatar.png');
            formData.append('source', 0);
            const res = await fetch(upload.url, { method: 'POST', headers: upload.headers, body: formData, credentials: 'include' });
            return res.json();
        }, uploadData);
        console.log('Upload result:', result);
        clone.info.avatar_uri = result?.data?.uri || '';
    } catch (err) {
        console.log('❌ Error in page evaluate upload:', err.message);
        clone.info.avatar_uri = '';
    }
}

/** True when the account still has TikTok's default nickname/avatar and needs the profile setup. */
async function needsProfileSetup(clone, page) {
    const { info } = clone;
    const existsArgs = (username) => ({ username, proxy: clone.proxy, proxy_list: [clone.proxy], cookie_string: '', retryCount: 2 });
    let exists = await helper.checkUserExist(existsArgs(info.username));
    if (!exists.is_exist) {
        exists = await helper.checkUserExist(existsArgs(info.username_success));
        if (exists.is_exist) info.username = info.username_success;
    }
    try {
        const detail = await clone.checkUserDetailFetch({ page, username: info.username_success || info.username });
        if (detail?.userInfo?.user) return !hasCustomNickname(detail.userInfo.user.nickname);
    } catch (e) {
        console.log('Error checking user detail fetch, falling back:', e.message);
    }
    return !hasCustomNickname(exists?.nickname);
}

async function handleForYou({ clone, page, bodyHtml }) {
    const cookieString = await captureSession(clone, page, bodyHtml);
    if (!await fetchUsername(clone, cookieString)) return false;
    const needsSetup = await needsProfileSetup(clone, page);

    if (clone.is_finish_at_username) return gotoWebcast(clone, page);
    if (clone.is_stop_username) {
        await page.goto('https://www.tiktok.com/live', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await delay(2000);
        return NEXT;
    }

    clone.proxys = await helper.getProxySite(600);
    clone.proxy = clone.proxys[Math.floor(Math.random() * clone.proxys.length)];
    if (needsSetup) {
        await uploadAvatar(clone, page, cookieString);
        console.log('chờ setNickname');
        await delay(SET_NICKNAME_WAIT_MS);
        await clone.setNickname({ page });
    }
    await delay(2000);
    return gotoWebcast(clone, page);
}

async function handleTikTokHome({ page }) {
    await delay(5000);
    const target = process.env.REG_WATCH_LIVE ? 'https://www.tiktok.com/live' : WEBCAST_URL;
    await page.goto(target, { waitUntil: 'networkidle0' }).catch(() => { });
    await movePointer(page);
    await delay(2000);
    return NEXT;
}

async function handleProfilePage({ clone, page, bodyHtml }) {
    const { info } = clone;
    await checkFunction({ name: 'nav-profile', fn: async () => (await page.$x('//*[@data-e2e="nav-profile"]'))[0] });
    const bodyText = await page.evaluate(() => document.body.innerText);
    const wid = /wid":"(.*?)"/.exec(bodyHtml)?.[1];
    if (wid) clone.wid = wid;
    const sdk = await page.evaluate(() => ({
        crypt_sdk: localStorage['security-sdk/s_sdk_crypt_sdk'],
        sign_data_key: localStorage['security-sdk/s_sdk_sign_data_key/tt_fetch'],
    }));
    clone.crypt_sdk = sdk.crypt_sdk;
    clone.sign_data_key = sdk.sign_data_key;

    if (bodyText.includes('Không thể tìm thấy tài khoản này')) {
        console.log('Không thể tìm thấy tài khoản này', info.email);
        const html = await page.evaluate(() => document.body.innerHTML);
        info.username = getString(html, '"uniqueId":"', '"');
        if (!info.username?.trim()) return false;
        await page.goto(`https://www.tiktok.com/@${info.username}?lang=vi-VN`, { timeout: 30000 }).catch(() => { });
        await delay(2000);
        return NEXT;
    }

    await delay(2000);
    const editButtons = await checkFunction({
        name: 'Sửa hồ sơ',
        maxTime: 10,
        fn: async () => {
            const [div, span] = await Promise.all([
                page.$x("//div[text()='Sửa hồ sơ'] | //div[text()='Edit profile']"),
                page.$x("//span[text()='Sửa hồ sơ'] | //span[text()='Edit profile']"),
            ]);
            return div[0] || span[0] ? [span[0], div[0]] : null;
        }
    });
    const [editSpan, editDiv] = editButtons || [];
    await actionBeforeCapcha({
        getPage: clone.getPage.bind(clone),
        page,
        fn: async () => {
            if (editSpan) await editSpan.click();
            if (editDiv) await editDiv.click();
        }
    });
    if (!editSpan && !editDiv) {
        await page.reload();
        return NEXT;
    }
    await delay(2000);
    console.log(info.email, 'Have click edit profile');

    const nameXpath = '//*[@data-e2e="edit-profile-name-input"]//input';
    const nameInput = await clickXpath(clone.getPage.bind(clone), nameXpath, 0, 2, true);
    if (nameInput) {
        await nameInput.click({ clickCount: 2 });
        await page.keyboard.type(info.nickname);
        await delay(700);
    }
    await page.evaluate((xpath, value) => {
        const input = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        if (input) {
            input.value = value;
            input.dispatchEvent(new Event('input'));
        }
    }, nameXpath, info.nickname);
    await delay(1000);

    const fileInput = await checkFunction({ name: 'input[@type="file"]', fn: async () => (await page.$x('//input[@type="file"]'))[0] });
    if (fileInput && info.avatar) {
        await fileInput.uploadFile(info.avatar);
        await delay(2000);
        await clickXpath(clone.getPage.bind(clone), '//button[contains(text(), "Đăng ký")]', 0, 2, true);
    }
    await delay(2000);
    await clickXpath(clone.getPage.bind(clone), '//button[@data-e2e="edit-profile-save"]', 0, 2, true);
    await delay(2000);
    await actionBeforeCapcha({
        getPage: clone.getPage.bind(clone),
        page,
        fn: async () => { await clickXpath(clone.getPage.bind(clone), '//button[@data-e2e="set-username-popup-confirm"]'); }
    });
    await delay(7000);

    if (page.url().includes(info.username)) {
        await page.goto(process.env.REG_WATCH_LIVE ? 'https://www.tiktok.com/live' : WEBCAST_URL, { waitUntil: 'networkidle0' });
        await delay(2000);
    }
    return NEXT;
}

async function handleCreateUsername({ clone, page, bodyHtml }) {
    const { info } = clone;
    await captureSession(clone, page, bodyHtml);
    clone.is_reg = true;
    await clone.checkUserDetailFetch({ page, username: info.username_success || info.username });

    if (clone.is_finish_at_username) {
        const cookieString = clone.cookie_string;
        if (!await fetchUsername(clone, cookieString)) return false;
        return gotoWebcast(clone, page);
    }
    if (clone.is_stop_username) {
        await page.goto('https://www.tiktok.com/live', { waitUntil: 'domcontentloaded', timeout: 10000 });
        await delay(2000);
        return NEXT;
    }

    clone.total_create_username++;
    if (bodyHtml.includes('id="captcha-verify-container-main-page"')) {
        console.log('HAVE CAPTCHA');
        await actionBeforeCapcha({
            getPage: clone.getPage.bind(clone),
            page,
            fn: async () => {
                await clickXpath(clone.getPage.bind(clone), "//*[@id='captcha_refresh_button']", 0, 2);
                await delay(1000);
            }
        });
        await delay(2000);
        return NEXT;
    }

    if (!clone.passed_username) clone.passed_username = await clone.setCreateUsername();

    if (!clone.passed_username || clone.total_create_username == 2) {
        await clickSelector(clone.getPage.bind(clone), "#loginContainer form div[tabindex='0']", 0, 2, true);
        console.log(info.email, 'pass cancel');
    } else {
        console.log(info.email, 'pass input username');
        await delay(2000);
        await clickSelector(clone.getPage.bind(clone), "#loginContainer button[type='submit']", 0, 2, true);
        console.log(info.email, 'pass submit new username');
    }
    clone.passed_username = true;
    await delay(2000);
    return NEXT;
}

/** Picks month/day/year in TikTok's custom dropdowns. Returns NEXT if the page left signup meanwhile. */
async function fillBirthday(clone, page) {
    const { info } = clone;
    const labelXpath = `//div[${BIRTHDAY_LABELS.map(l => `normalize-space(.)="${l}"`).join(' or ')}]`;
    const optionIds = [
        `#Month-options-item-${info.birthday_month - 1}`,
        `#Day-options-item-${info.birthday_day - 1}`,
        `#Year-options-item-${new Date().getFullYear() - info.birthday_year - 1}`,
    ];

    for (let waited = 0; waited < BIRTHDAY_WAIT_SECONDS; waited++) {
        const dropdowns = await page.$x(labelXpath);
        if (dropdowns.length) {
            for (const dropdown of dropdowns) {
                await delay(4000);
                await dropdown.click().catch(() => dropdown.evaluate(el => el.click()));
                await delay(3000);
                for (const id of optionIds) await page.click(id).catch(() => { });
            }
            return true;
        }
        const url = page.url();
        if (!url.includes('/signup') && !url.includes('/login')) return NEXT;
        await delay(1000);
    }
    return false;
}

async function handleSignupForm({ clone, page, url, bodyText, bodyHtml }) {
    const { info } = clone;
    const email = info.email;
    const isAgeGate = url.includes('age-gate');

    await movePointer(page);
    clone.total_input++;
    if (clone.total_input === SIGNUP_RELOAD_AT) {
        await page.reload().catch(() => { });
        await delay(2000);
        return NEXT;
    }
    if (clone.total_input >= MAX_SIGNUP_VISITS) return false;
    await delay(2000);

    if (!isAgeGate) {
        const { ok, reason } = await authorizeWithGoogle(clone, { isLoginPage: url.includes('/login') });
        if (!ok) {
            console.log(email, 'google oauth failed:', reason);
            return false;
        }
        console.log(email, 'done google oauth');
        await delay(5000);
        traceStep(email, 'signup:5s_after_oauth', { url: page.url() });
        // The OAuth redirect replaced the page, so everything read before the click is stale. While
        // TikTok is still on the plain signup page, wait for the birthday form here rather than looping
        // back (a loop pass would click the Google button a second time).
        const fresh = await readState(clone);
        const stillOnSignup = fresh && /\/signup|\/login/.test(fresh.url) && !fresh.url.includes('age-gate');
        traceStep(email, 'signup:after_oauth_state', { url: fresh?.url, stillOnSignup: Boolean(stillOnSignup) });
        if (fresh) await snapshotPage(email, fresh.page, 'after_oauth_5s');
        return stillOnSignup ? submitBirthday(clone, fresh.page) : NEXT;
    }

    if (bodyText.includes('Rất tiếc, đã xảy ra lỗi, vui lòng thử lại sau')) {
        console.log(email, 'wrong input info');
        if (info.retryCodes >= 4) await page.reload().catch((e) => console.log(email, 'page reload', e.message));
        info.retryCodes = (info.retryCodes || 0) + 1;
        await actionBeforeCapcha({ getPage: clone.getPage.bind(clone), page, fn: async () => { } });
        await delay(2000);
        return NEXT;
    }

    if (bodyHtml.includes('captcha_container')) {
        console.log(email, 'capcha input info');
        await actionBeforeCapcha({
            getPage: clone.getPage.bind(clone),
            page,
            fn: async () => {
                const html = await page.evaluate(() => document.body.innerHTML);
                await delay(2000);
                if (!html.includes('captcha_container')) {
                    await clickSelector(clone.getPage.bind(clone), "#loginContainer button[type='submit']", 0, 2, true);
                }
            }
        });
        await delay(2000);
        return NEXT;
    }

    // Only real age-gate visits count: the reload drops TikTok's pending OAuth signup, so it must not
    // trigger on the plain /signup passes that happen while Google retries.
    clone.ageGateCheckCount = (clone.ageGateCheckCount || 0) + 1;
    if (clone.ageGateCheckCount >= AGE_GATE_RELOAD_AT) {
        console.log(email, '⚠️ Đứng tại age-gate, reload lại trang để kiểm tra...');
        clone.ageGateCheckCount = 0;
        await page.reload({ waitUntil: 'domcontentloaded', timeout: 20000 }).catch(() => { });
        await delay(2000);
        return NEXT;
    }
    return submitBirthday(clone, page);
}

async function submitBirthday(clone, page) {
    const email = clone.info.email;
    console.log(email, 'input info');
    await delay(2000);
    const filled = await fillBirthday(clone, page);
    traceStep(email, 'birthday:fill_result', { result: filled === NEXT ? 'left_signup' : filled });
    if (filled === NEXT) return NEXT;
    if (!filled) {
        await snapshotPage(email, page, 'birthday_not_found');
        await page.reload().catch((e) => console.log(email, 'page reload error', e.message));
        await delay(1000);
        return NEXT;
    }

    clone.passed = true;
    await delay(4000);
    let clickedOnce = false;
    await actionBeforeCapcha({
        getPage: clone.getPage.bind(clone),
        page,
        fn: async () => {
            const refreshed = await clickXpath(clone.getPage.bind(clone), "//*[@id='captcha_refresh_button']", 0, 2);
            if (!refreshed || !clickedOnce) {
                await clickSelector(clone.getPage.bind(clone), "#loginContainer button[type='submit']", 0, 2, true);
            }
            clickedOnce = true;
            await delay(1000);
        }
    });
    await delay(2000);
    return NEXT;
}

// ---- dispatcher --------------------------------------------------------------------------------

async function dispatch(state) {
    const { clone, url, bodyText } = state;
    const username = clone.info.username;

    if (bodyText?.includes('Đăng nhập đã hết hạn')) return handleSessionExpired(state);
    if (bodyText?.includes('Quản lý quyền riêng tư của tài khoản')) return handlePrivacyChoice(state);
    if (url.includes('chrome-error://chromewebdata/')) return handleChromeError(state);
    if (url.includes('/login/download-app')) return handleDownloadApp(state);
    if (url.includes('webcast.tiktok.com')) return handleWebcast(state);
    if (url.includes('www.tiktok.com/live')) return handleLive(state);
    if (url.includes('tiktok.com/foryou')) return handleForYou(state);
    if (username && url.includes(username)) return handleProfilePage(state);
    if (/^https:\/\/www\.tiktok\.com\/?(\?lang=)?$/.test(url)) return handleTikTokHome(state);
    if (url.includes('/signup/create-username') || state.bodyHtml?.includes('new-username')) return handleCreateUsername(state);
    if (url.includes('/signup') || url.includes('/login')) return handleSignupForm(state);
    await delay(2000);
    return NEXT;
}

/** One pass of the signup state machine. */
export async function signupStep(clone) {
    if (clone.email_bloked) return false;
    const state = await readState(clone);
    if (!state) return NEXT;

    await state.page.evaluate(() => {
        document.querySelectorAll('[data-e2e="feed-video"]').forEach(el => el.remove());
    }).catch(() => { });
    return dispatch(state);
}
