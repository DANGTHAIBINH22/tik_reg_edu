import * as puppeteer from 'puppeteer';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import helper from '../helper.pup.js';
import { loginGoogle } from './google_login.js';
import { signupStep, NEXT } from './signup_flow.js';
import { convertToBase64 } from './cookie_utils.js';
import { attachPageListeners } from './page_listeners.js';

const { connect } = puppeteer;
const { clickSelector, checkFunction } = helper;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MAX_RUNTIME_MS = 400000;
const MAX_RUNTIME_AFTER_SIGNUP_MS = 460000;
const WATCHDOG_INTERVAL_MS = 5000;
const MAX_START_ATTEMPTS = 4;
const MAX_FLOW_ERRORS = 4;
const PREPARE_TIMEOUT_MS = 90000;
const MAX_USERNAME_ATTEMPTS = 3;
const MAX_GET_PAGE_ATTEMPTS = 5;
const DEFAULT_MS_TOKEN = 'dgPLMwRWid2QYbccyQeiSKYDERUAnSy-4Pc35X15AO9krko3H0YRTPPIUGKN85D3sEtCU3mwCA8mJb43-09JhZLDJbqcWlak3j3j1qVx4zf32VWg3Qg7faTbLrswHfdL6_O8fIbtrnAtF1bFtTmtkPZpCg==';
const PANEL_URL = 'http://localhost:3000';
const hostSite = () => process.env.HOST_SITE_ACC || PANEL_URL;

const JSON_HEADERS = { 'content-type': 'application/json' };

class Clone {
    constructor({ wsUrl, email_info, folder_avatar, proxy, cron_name, cookies, category, is_stop_username, is_finish_at_username }) {
        this.wsUrl = wsUrl;
        this.email_info = email_info;
        this.folder_avatar = folder_avatar || path.resolve('./pexels');
        this.proxy = proxy || '';
        this.proxys = [];
        this.cron_name = cron_name || '';
        this.alias_name = email_info.alias_name || 'VN';
        this.cookies = cookies || [];
        this.category = category || 'tiktok_reg_vn_edu2';
        this.is_stop_username = Boolean(is_stop_username);
        this.is_finish_at_username = Boolean(is_finish_at_username);
        // is_reg flips to true once TikTok reaches create-username; only then is a timeout worth saving cookies for.
        this.is_reg = false;
        this.is_join = false;
        this.current_retry = 0;
        this.total_input = 0;
        this.total_create_username = 0;
        this.had_sucess_set_username = false;
        this.global_val = {};
    }

    static async setupprofile(params) {
        const clone = new Clone(params);
        const result = await clone.startReg();
        if (result) await clone.persistAccount();
        return result;
    }

    /** Finalizes the cookie string and hands the new account to the panel + local files. */
    async persistAccount() {
        const { info, global_val } = this;
        try {
            const ip = await helper.getIpAddress();
            if (ip) info._2fa = ip;
        } catch (e) {
            console.log('Could not get IP address:', e.message);
        }

        let cookie = this.cookie.replace(/;;/g, ';').replace(/; /, ';');
        if (this.wid && !cookie.includes(';wid=')) cookie += `;wid=${this.wid};`;
        if (this.crypt_sdk && !cookie.includes(';crypt_sdk_b64=')) cookie += `;crypt_sdk_b64=${convertToBase64(this.crypt_sdk)};`;
        if (this.sign_data_key && !cookie.includes(';sign_data_key_b64=')) cookie += `;sign_data_key_b64=${convertToBase64(this.sign_data_key)};`;
        cookie += `;is_join=${this.is_join};`;
        cookie = cookie.replace(/;;/g, ';');
        if (global_val.msToken) cookie = cookie.replace(/msToken=[^;]+/, `msToken=${global_val.msToken}`);

        // Cookie captured on /webcast/room/enter is the one the live-viewing workers need.
        global_val.cookie_enter = global_val.cookie_enter
            ? `${global_val.cookie_enter};wid=${this.wid};is_join=${this.is_join};`
            : '';
        if (global_val.cookie_enter) cookie = global_val.cookie_enter;
        this.cookie = cookie;

        console.log(`${info.username}|${info.password}|${info.email}|${info.email_password}|${cookie}`);
        fs.appendFileSync('acc_reg_vn.txt', `${info.username}|${info.password}|${info.email}|${info.email_password}|${cookie}\n`);

        const meta = {
            cookies: this.cookieObjects,
            wid: this.wid,
            crypt_sdk_b64: convertToBase64(this.crypt_sdk),
            sign_data_key_b64: convertToBase64(this.sign_data_key),
            email_password: this.email_info.password,
            email_pass: this.email_info.password,
            avatar_uri: info.avatar_uri,
            webIdCreatedTime: this.webIdCreatedTime,
            user_agent: this.user_agent,
            update_time: Date.now(),
            is_join: this.is_join,
        };
        if (global_val.msToken) Object.assign(meta, { msToken: global_val.msToken, is_msToken: true });
        if (global_val.cookie_google) meta.cookie_google = global_val.cookie_google;
        if (global_val.url_google) meta.url_google = global_val.url_google;

        const account = {
            category: this.category,
            ...info,
            uId: info.username,
            cookie,
            cookie_enter: global_val.cookie_enter,
            _2fa: info._2fa,
            useragent: this.cron_name,
            status: 1,
            meta,
        };
        await helper.makeRequest({
            method: 'POST',
            url: `${hostSite()}/api/receive-account-tiktok`,
            headers: JSON_HEADERS,
            body: JSON.stringify({ account })
        });
        await helper.appendFile({ path: path.resolve(`./mails_done${this.cron_name}.txt`), data: `${info.email}|${info.password}\n` });
        await helper.deleteEmailEdu({ email: info.email });
    }

    // ---- browser lifecycle -----------------------------------------------------------------------

    async startReg() {
        for (let attempt = 0; attempt < MAX_START_ATTEMPTS; attempt++) {
            const generated = await helper.getInfo({ folder_avatar: this.folder_avatar, alias_name: this.alias_name });
            const email = this.email_info;
            this.info = { ...generated, ...email, email_pass: email.password, email_password: email.password, password: '@Mailedu129' };
            this.cron_name = email.cron_name || '';
            try {
                await this.connectBrowser();
                this.closed = false;
                const result = await Promise.race([this.handleProcess(), this.watchdog()]);
                await this.closeBrowser();
                return result;
            } catch (error) {
                console.error('Error occurred during startReg:', error);
                await this.closeBrowser();
                if (attempt < MAX_START_ATTEMPTS - 1) await delay(5000);
            } finally {
                clearInterval(this.timeoutId);
            }
        }
        return false;
    }

    async closeBrowser() {
        if (this.browser?.isConnected()) {
            await this.browser.close().catch(console.error);
        }
        this.closed = true;
    }

    /** Resolves false (after closing the browser) once the run exceeds its time budget or retries are exhausted. */
    watchdog() {
        this.start_time = Date.now();
        return new Promise((resolve) => {
            this.timeoutId = setInterval(async () => {
                const budget = this.passed ? MAX_RUNTIME_AFTER_SIGNUP_MS : MAX_RUNTIME_MS;
                if (this.current_retry <= 3 && Date.now() - this.start_time <= budget) return;

                console.log(this.email_info.email, 'Timeout reached, closing browser.');
                clearInterval(this.timeoutId);
                try {
                    if (this.is_reg) await this.saveCookies(this.browser);
                    await this.closeBrowser();
                } catch (e) {
                    console.log('error closing', this.email_info.email, e);
                }
                resolve(false);
            }, WATCHDOG_INTERVAL_MS);
        });
    }

    async connectBrowser() {
        const options = { ignoreHTTPSErrors: true, defaultViewport: null, headless: 'new' };
        if (this.wsUrl.includes('ws')) options.browserWSEndpoint = this.wsUrl.toString();
        else options.browserURL = this.wsUrl.toString();
        this.browser = await connect(options);

        try {
            this.browser.on('targetcreated', async (target) => {
                try {
                    // Popups (Google OAuth) must stay untouched: interception without a handler stalls
                    // every request, so accountchooser never navigates back to TikTok.
                    if (target.opener() || target.type() !== 'page') return;
                    const page = await target.page();
                    if (page) await this.setupPageBlocking(page);
                } catch (e) { /* target closed while attaching */ }
            });
            for (const page of await this.browser.pages()) await this.setupPageBlocking(page);
        } catch (e) {
            console.log('Error setting up page blocking on connectBrowser:', e);
        }
        return this.browser;
    }

    /** Keeps video/audio from playing: tab freezes under 5+ parallel profiles otherwise. */
    async setupPageBlocking(page) {
        if (!page || page.isClosed() || page.__blockingSetupDone) return;

        await page.setCacheEnabled(false).catch(() => { });
        await page.setBypassServiceWorker(true).catch(() => { });
        await page.evaluateOnNewDocument(() => {
            try {
                window.HTMLMediaElement.prototype.play = () => new Promise(() => { });
                Object.defineProperty(HTMLMediaElement.prototype, 'autoplay', { get: () => false, set: () => { } });
            } catch (e) { /* already defined */ }

            const injectCss = () => {
                if (document.querySelector('style[data-block-media="1"]')) return;
                const style = document.createElement('style');
                style.setAttribute('data-block-media', '1');
                style.innerHTML = `
                    video, audio { display: none !important; opacity: 0 !important; visibility: hidden !important; width: 0 !important; height: 0 !important; pointer-events: none !important; }
                    [data-e2e="feed-video"], .tiktok-feed-video, div[class*="DivVideoPlayerContainer"], div[class*="DivVideoContainer"] { display: none !important; }
                `;
                (document.head || document.documentElement)?.appendChild(style);
            };
            injectCss();
            document.addEventListener('DOMContentLoaded', injectCss);
            new MutationObserver(() => {
                document.querySelectorAll('video').forEach(v => { try { v.pause(); v.src = ''; } catch (err) { /* detached */ } });
            }).observe(document.documentElement, { childList: true, subtree: true });
        }).catch(() => { });

        for (let attempt = 0; attempt < 3 && !page.__blockingSetupDone; attempt++) {
            try {
                await page.setRequestInterception(true);
                page.__blockingSetupDone = true;
            } catch (err) {
                if (err.message?.includes('already enabled')) page.__blockingSetupDone = true;
                else await delay(200);
            }
        }
    }

    /** Last open tab with the Save-Data header applied; null once the tab is gone or crashed. */
    async getPage(attempt = 0) {
        const pages = await this.browser.pages().catch(() => []);
        if (!pages.length) return null;
        const page = pages[pages.length - 1];
        try {
            await page.setExtraHTTPHeaders({ 'Save-Data': 'on' });
            this.page = page;
            await page.$$('body');
            return page;
        } catch (e) {
            console.log('error getpage', e.message, pages.length);
            if (attempt >= MAX_GET_PAGE_ATTEMPTS) return null;
            await delay(500);
            return this.getPage(attempt + 1);
        }
    }

    // ---- main flow -------------------------------------------------------------------------------

    async handleProcess() {
        const page = (await this.browser.pages()).pop();
        if (!page) {
            await this.browser.close();
            return false;
        }
        attachPageListeners(this, page);
        this.page = page;

        if (await this.handlePrepare(page) === false) return false;

        try {
            await page.goto('https://accounts.google.com/?continue=https://mail.google.com/mail/', { waitUntil: 'networkidle0', timeout: 20000 })
                .catch(() => console.log('google start page not idle'));
            await delay(1000);
            await loginGoogle(this);

            const current = this.page || await this.getPage();
            this.page = current;
            if (!current.url().includes('tiktok.com/signup?lang=vi-VN')) {
                await this.setupPageBlocking(current);
                await current.goto('https://www.tiktok.com/signup?lang=vi-VN', { waitUntil: 'domcontentloaded', timeout: 30000 })
                    .catch(() => console.log('signup page navigation failed'));
            }

            const status = await this.checkBeforeSignup();
            if (!status && this.is_reg) await this.saveCookies(this.browser).catch(() => { });
            await this.closeBrowser();
            return status;
        } catch (e) {
            console.log(this.email_info.email, 'error in signup flow', e);
            return false;
        }
    }

    /** Loads TikTok once with the saved Google cookies and probes the exit IP, so the session looks warmed up. */
    async handlePrepare(page) {
        let timer;
        const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve('timeout'), PREPARE_TIMEOUT_MS); });
        const prepare = (async () => {
            if (this.cookies.length) await page.setCookie(...this.cookies);
            try {
                await this.setupPageBlocking(page);
                await page.goto('https://www.tiktok.com/foryou', { waitUntil: 'domcontentloaded', timeout: 30000 });
                for (let i = 0; i < 3; i++) {
                    await page.keyboard.press('ArrowDown');
                    await delay(2000);
                }
            } catch (e) { /* the IP probes below still run */ }

            const webIdCreatedTime = /webIdCreatedTime":"(.*?)"/.exec(await page.content().catch(() => ''))?.[1];
            if (webIdCreatedTime) this.webIdCreatedTime = this.info.webIdCreatedTime = webIdCreatedTime;

            for (const site of ['https://ipinfo.io/json', 'https://jsonip.com/', 'https://ifconfig.me/all.json']) {
                try {
                    await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 25000 });
                    await delay(5000);
                } catch (e) {
                    console.log(`[PREP_WARN] Failed to load ${site}:`, e.message);
                }
            }
            return true;
        })();

        const result = await Promise.race([prepare, timeout]);
        clearTimeout(timer);
        if (result === 'timeout') {
            console.log(this.info.email, '⚠️ handlePrepare quá 90 giây, hủy luồng');
            return false;
        }
        return result;
    }

    /** Runs the signup state machine until it yields a verdict or the error budget is spent. */
    async checkBeforeSignup() {
        for (; ;) {
            try {
                const result = await signupStep(this);
                if (result !== NEXT) return result;
            } catch (e) {
                console.log('error checkBeforeSignup', e);
                if (++this.current_retry >= MAX_FLOW_ERRORS) return false;
                await delay(2000);
            }
        }
    }

    // ---- persistence -----------------------------------------------------------------------------

    async postCookies(browser, endpoint) {
        const pages = await browser.pages();
        if (!pages.length) return null;
        const client = await pages[pages.length - 1].target().createCDPSession();
        await client.send('Network.enable');
        const { cookies } = await client.send('Network.getAllCookies');
        return helper.makeRequest({
            method: 'POST',
            url: `${hostSite()}${endpoint}`,
            headers: JSON_HEADERS,
            body: JSON.stringify({
                email: this.email_info.email,
                cookies,
                cookie_google: this.global_val.cookie_google,
                url_google: this.global_val.url_google
            })
        });
    }

    async saveCookies(browser) {
        try {
            await this.postCookies(browser, '/api/receive-cookies-tiktok');
        } catch (e) {
            console.log('saveCookies', e);
        }
    }

    async saveCookiesGoogle() {
        if (!this.global_val.passed_google) return console.log('not pass google');
        try {
            const res = await this.postCookies(this.browser, '/api/receive-cookies-google');
            console.log('save cookies google', res?.statusText ?? res?.status);
        } catch (e) {
            console.log('saveCookiesGoogle', e);
        }
    }

    async moveAccountTooMuchUse(emails, category = 'tiktok_too_much') {
        try {
            const response = await axios.post('http://217.15.163.20:3002/api/accounts/move-to-category', {
                accounts: emails,
                category_to: category
            });
            console.log('Successfully saved accounts to panel:', emails, response.data);
        } catch (error) {
            console.error('Error saving accounts to panel:', error.message);
        }
    }

    // ---- TikTok API helpers used by signup_flow --------------------------------------------------

    async getCookieBrowser(page, url) {
        const cookies = await page.cookies(url);
        const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ');
        return this.global_val.msToken
            ? cookieString.replace(/msToken=[^;]+/, `msToken=${this.global_val.msToken}`)
            : cookieString;
    }

    /** msToken from a previously registered account (156 chars = valid) makes the detail API accept the call. */
    pickMsToken() {
        try {
            if (!fs.existsSync('account_reg.txt')) return DEFAULT_MS_TOKEN;
            const tokens = [...fs.readFileSync('account_reg.txt', 'utf-8').matchAll(/msToken=([^;|\s]+)/g)]
                .map(m => m[1]).filter(t => t.length === 156);
            return tokens.length ? tokens[Math.floor(Math.random() * tokens.length)] : DEFAULT_MS_TOKEN;
        } catch (e) {
            return DEFAULT_MS_TOKEN;
        }
    }

    async checkUserDetailFetch({ page, username }) {
        try {
            const data = helper.buildUserDetailUrlJSON({
                username,
                user_agent: this.user_agent,
                cookie_string: this.cookie_string,
                webIdCreatedTime: this.webIdCreatedTime
            });
            return await page.evaluate(async (req) => {
                try {
                    const response = await fetch(req.url, {
                        headers: req.headers, referrer: req.referrer, body: req.body,
                        method: req.method, mode: req.mode, credentials: req.credentials
                    });
                    return await response.json();
                } catch (err) {
                    return { error: err.message };
                }
            }, data);
        } catch (e) {
            console.log('checkUserDetailFetch error:', e.message);
            return null;
        }
    }

    async setCreateUsername() {
        const { info } = this;
        const getPage = this.getPage.bind(this);
        for (let attempt = 0; attempt < MAX_USERNAME_ATTEMPTS; attempt++) {
            await delay(2000);
            const input = await clickSelector(getPage, "input[name='new-username']");
            if (!input) {
                console.log('not found input new-username', info.username);
                return false;
            }
            const page = this.page;
            await page.focus("input[name='new-username']");
            await page.click("input[name='new-username']");
            await delay(1000);
            await page.evaluate(() => {
                const el = document.querySelector('input[name="new-username"]');
                if (el) el.value = '';
            });
            await delay(1000);
            await page.type('input[name="new-username"]', info.username, { delay: 100 });
            await delay(2000);

            const verdict = await checkFunction({
                name: 'username accepted',
                fn: async () => {
                    const [ok, expired] = await Promise.all([
                        page.$x("//span[contains(text(),'Bạn luôn có thể thay đổi điều này sau') or contains(text(),'You can always change this later') or contains(text(),'change this later')]"),
                        page.$x("//span[contains(text(),'Đăng nhập đã hết hạn') or contains(text(),'expired') or contains(text(),'Expired')]"),
                    ]);
                    return { isRetry: !ok[0] && !expired[0], passed: ok[0], expire: expired[0] };
                }
            });
            if (verdict?.passed) return true;
            if (verdict?.expire) return false;
            if (attempt < MAX_USERNAME_ATTEMPTS - 1) info.username = info.newUsername(info);
        }
        return false;
    }

    /** Two update/profile calls: first applies the avatar, then the nickname (TikTok rejects both in one). */
    async setNickname({ page }) {
        for (const nickname of [undefined, this.info.nickname]) {
            try {
                const req = helper.buildUpdateProfileUrlJSON({
                    avatar_uri: this.info.avatar_uri,
                    ...(nickname && { nickname }),
                    user_agent: this.user_agent,
                    cookie_string: this.cookie_string,
                    webIdCreatedTime: this.webIdCreatedTime
                });
                const text = await page.evaluate(async (r) => {
                    const res = await fetch(r.url, {
                        headers: r.headers, referrer: r.referrer, body: r.body,
                        method: r.method, mode: r.mode, credentials: r.credentials
                    });
                    return res.text();
                }, req);
                console.log('result_set', text);
            } catch (e) {
                console.log('result_set', e);
            }
            await delay(3000);
        }
    }
}

export default Clone;
