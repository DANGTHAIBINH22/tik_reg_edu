import path from 'path';
import helper from '../helper.pup.js';
import { filterCookiesForUrl } from './cookie_utils.js';

const { clickXpath } = helper;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const GMAIL_INBOX = 'https://mail.google.com/mail/u/0/?sw=2#inbox';
const NAV_TIMEOUT_MS = 25000;
const MAX_IDENTIFIER_VISITS = 6;
const IDENTIFIER_RELOAD_AT = 5;
const PWD_POLL_MS = 3000;
const PWD_CHECK_NEW_TAB_AT = 3;
const PWD_RELOAD_AT = 6;
const NEXT_BUTTON = '//span[contains(text(), "Next")] | //span[contains(text(), "Tiếp theo")]';

const STEP_DONE = Symbol('done');

/** Fills an input via keyboard, then forces the value so a dropped keystroke cannot break the login. */
async function fillInput(clone, page, selector, value) {
    await clickXpath(clone.getPage.bind(clone), `//input[@name="${selector}"]`, 0, 3);
    await delay(500);
    await page.keyboard.type(value, { delay: 400 });
    await delay(1000);
    await page.evaluate((sel, val) => {
        const input = document.querySelector(`input[name="${sel}"]`);
        if (input) {
            input.value = val;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }, selector, value);
}

async function gotoInbox(clone, page) {
    clone.global_val.passed_google = true;
    await page.goto(GMAIL_INBOX, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS }).catch(() => { });
    await delay(2000);
}

async function markEmailDead(clone, { moveToPanel }) {
    const { info } = clone;
    clone.email_bloked = true;
    if (moveToPanel) await clone.moveAccountTooMuchUse([info.email], 'tiktok_too_much');
    await helper.appendFile({ path: path.resolve(`./mails_done${clone.cron_name}.txt`), data: `${info.email}|${info.password}\n` });
    if (!moveToPanel) await helper.deleteEmailEdu({ email: info.email });
}

/**
 * The password step often stays on challenge/pwd although Google already accepted it, so after a few
 * polls probe myaccount.google.com in a fresh tab and adopt it when it is signed in.
 */
async function waitPasswordAccepted(clone, page) {
    const email = clone.email_info.email;
    for (let poll = 1; ; poll++) {
        await delay(PWD_POLL_MS);
        if (!page.url().includes('accounts.google.com/v3/signin/challenge/pwd')) return;

        if (poll >= PWD_CHECK_NEW_TAB_AT) {
            const probe = await clone.browser.newPage().catch(() => null);
            if (probe) {
                await probe.goto('https://myaccount.google.com/?hl=en&pli=1', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
                await delay(2000);
                const url = probe.url();
                const signedIn = url.includes('myaccount.google.com') && !/signin|challenge/.test(url);
                const nextStep = /speedbump|signin\/challenge\/iap|passkeyenrollment|mail\.google\.com/.test(url);
                if (signedIn || nextStep) {
                    console.log(email, 'google probe tab moved on:', url);
                    if (signedIn) clone.global_val.passed_google = true;
                    await page.close().catch(() => { });
                    clone.page = probe;
                    return;
                }
                await probe.close().catch(() => { });
            }
        }
        if (poll >= PWD_RELOAD_AT) {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }).catch(() => { });
            await delay(2000);
            return;
        }
        if (poll % 2 === 0) await clickXpath(clone.getPage.bind(clone), NEXT_BUTTON, 0, 3).catch(() => { });
    }
}

async function saveGmailSession(clone, page, bodyHtml, currentUrl) {
    if (currentUrl === GMAIL_INBOX || currentUrl === 'https://mail.google.com/mail/u/0/#inbox') {
        const client = await page.target().createCDPSession();
        await client.send('Network.enable');
        const { cookies } = await client.send('Network.getAllCookies');
        clone.global_val.cookie_google = filterCookiesForUrl(cookies, GMAIL_INBOX)
            .map(c => `${c.name}=${c.value}`).join('; ');
        const url = helper.getString(bodyHtml, 'iframe id="embedded_data_iframe" src="', '"')
            || helper.getString(bodyHtml, 'link data-recorded-src="', '"');
        clone.global_val.url_google = url.replaceAll('&amp;', '&');
    }
    await clone.saveCookiesGoogle();
    await delay(2000);
}

/** One look at the current Google URL. Returns true/false when the login is decided, else STEP_DONE to poll again. */
async function loginStep(clone, page) {
    const email = clone.email_info.email;
    const currentUrl = page.url();
    console.log(email, 'currentUrl', currentUrl);

    if (currentUrl.includes('chrome-error://chromewebdata/') || currentUrl.includes('adslfail.viettel.vn')) return false;

    if (currentUrl.includes('signin/deletedaccount') || currentUrl.includes('speedbump/disabled/explanation') || currentUrl.includes('/v3/signin/rejected?')) {
        await markEmailDead(clone, { moveToPanel: true });
        return false;
    }

    if (currentUrl.includes('workspace.google.com/intl')) {
        await page.goto('https://accounts.google.com/?continue=https://mail.google.com/mail/', { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    } else if (currentUrl.includes('accounts.google.com/v3/signin/confirmidentifier?authuse')
        || currentUrl.includes('passkeyenrollment') || currentUrl.includes('speedbump')) {
        if (currentUrl.includes('speedbump/workspacetermsofservice')) {
            await clickXpath(clone.getPage.bind(clone), '//span[contains(text(), "I understand")] | //span[contains(text(), "Tôi hiểu")]', 0, 3);
        } else if (currentUrl.includes('passkeyenrollment')) {
            await clickXpath(clone.getPage.bind(clone), '//span[contains(text(), "Not now")] | //span[contains(text(), "Để sau")]', 0, 3);
        } else if (currentUrl.includes('speedbump')) {
            await clickXpath(clone.getPage.bind(clone), '//input[@type="submit"]', 0, 3);
        }
        await delay(2000);
        await gotoInbox(clone, page);
    } else if (currentUrl.includes('accounts.google.com/v3/signin/identifier')) {
        clone.total_input++;
        if (clone.total_input === IDENTIFIER_RELOAD_AT) await page.reload().catch(() => { });
        else if (clone.total_input >= MAX_IDENTIFIER_VISITS) return false;
        else {
            await fillInput(clone, page, 'identifier', email);
            await clickXpath(clone.getPage.bind(clone), NEXT_BUTTON, 0, 3);
        }
    } else if (currentUrl.includes('/restart?continue') || currentUrl.includes('signin/challenge/iap')) {
        await markEmailDead(clone, { moveToPanel: false });
        return false;
    } else if (currentUrl.includes('https://myaccount.google.com')) {
        return true;
    } else if (currentUrl.startsWith('https://www.google.com/account/about')) {
        await page.goto('https://accounts.google.com', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => { });
    } else if (currentUrl.startsWith('https://mail.google.com/mail/u/0')) {
        const bodyHtml = await page.evaluate(() => document.body.innerHTML);
        await saveGmailSession(clone, page, bodyHtml, currentUrl);
        return true;
    } else if (currentUrl.includes('accounts.google.com/v3/signin/challenge/pwd')) {
        await fillInput(clone, page, 'Passwd', clone.email_info.password);
        await clickXpath(clone.getPage.bind(clone), NEXT_BUTTON, 0, 3);
        await delay(2000);
        await waitPasswordAccepted(clone, page);
    }
    await delay(2000);
    return STEP_DONE;
}

/** Signs the profile in to Google (accounts.google.com -> Gmail inbox); resolves true once a Google session exists. */
export async function loginGoogle(clone) {
    if (clone.email_bloked) return false;
    for (; ;) {
        try {
            const page = clone.page || await clone.getPage();
            const result = await loginStep(clone, page);
            if (result !== STEP_DONE) return result;
        } catch (e) {
            console.log(clone.email_info.email, 'error loginGoogle', e.message);
            return false;
        }
    }
}
