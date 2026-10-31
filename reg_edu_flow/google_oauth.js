import helper from '../helper.pup.js';

import { traceStep, attachNetworkTrace, snapshotPage } from './debug_trace.js';

const { clickXpath } = helper;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const CHANNEL_READY_TIMEOUT_MS = 20000;
const POPUP_OPEN_TIMEOUT_MS = 15000;
const POPUP_FLOW_TIMEOUT_MS = 90000;
const POPUP_POLL_MS = 500;
const GSI_BLANK_GRACE_MS = 3000;
const MAX_POPUP_OPEN_TRIES = 3;
const MAX_BLANK_POPUP_RETRIES = 2;
const MIN_CLICK_GAP_MS = 3000;
const ACCOUNT_CLICK_GAP_MS = 15000; // chooser -> consent can take a while behind a slow proxy
const FALLBACK_LOGIN_CHANNEL_INDEX = 3;
const FALLBACK_SIGNUP_CHANNEL_INDEX = 2;

export const OAUTH_REASON = {
    DONE: 'done',
    NO_POPUP: 'no_popup',
    GRANULAR_CONSENT: 'granular_consent',
    OAUTH_ERROR: 'oauth_error',
    POPUP_BLANK: 'popup_blank',
    TIMEOUT: 'timeout',
};

/**
 * TikTok renders the Google channel as an empty spinner until accounts.google.com/gsi/client has
 * loaded (slow behind proxy); a click before that opens no popup.
 * @returns index of the Google item among div[role='link'], or -1 on timeout.
 */
async function waitGoogleChannelReady(page, timeout) {
    try {
        const handle = await page.waitForFunction(() => {
            const items = [...document.querySelectorAll("div[role='link']")];
            const idx = items.findIndex(el => /google/i.test(el.innerText || ''));
            return idx >= 0 && window.google?.accounts ? idx : false;
        }, { timeout, polling: 500 });
        return await handle.jsonValue();
    } catch (e) {
        return -1;
    }
}

/** Resolves the popup opened by `mainPage`, or null. Uses opener() so unrelated tabs are never mistaken for it. */
async function waitForPopup(browser, mainPage, pagesBefore) {
    const target = await browser.waitForTarget(
        (t) => t.type() === 'page' && t.opener() === mainPage.target(),
        { timeout: POPUP_OPEN_TIMEOUT_MS }
    ).catch(() => null);
    if (target) return target.page();

    const fresh = (await browser.pages()).find(p => !pagesBefore.includes(p));
    return fresh || null;
}

/** Clicks the first xpath match at most once per MIN_CLICK_GAP_MS; returns whether a click happened. */
async function clickThrottled(state, key, page, xpath, gap = MIN_CLICK_GAP_MS) {
    if (Date.now() - (state.lastClick[key] || 0) < gap) return false;
    const [element] = await page.$x(xpath).catch(() => []);
    if (!element) return false;
    state.lastClick[key] = Date.now();
    await element.click().catch(() => { });
    return true;
}

async function isGsiScriptMissing(popup) {
    return popup.evaluate(() => typeof window.gis === 'undefined').catch(() => false);
}

/**
 * Drives the Google popup until it closes. One poll = one look at the popup URL, so there are no
 * nested waits and every exit has an explicit reason.
 */
async function driveGooglePopup(popup, email) {
    const state = { lastClick: {}, gsiSince: 0 };
    const emailLower = email.toLowerCase();
    const accountXpath = `//div[contains(@data-email,"${emailLower}") or contains(@data-identifier,"${emailLower}")]`;
    const consentXpath = '//*[self::span or self::button][normalize-space(text())="Continue" or normalize-space(text())="Tiếp tục"]';
    const deadline = Date.now() + POPUP_FLOW_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (popup.isClosed()) return OAUTH_REASON.DONE;
        const url = popup.url();

        if (url.includes('accounts.google.com/v3/signin/identifier')) return OAUTH_REASON.GRANULAR_CONSENT;
        if (url.includes('/oauth/error?authError')) return OAUTH_REASON.OAUTH_ERROR;

        if (url.includes('accounts.google.com/gsi/transform')) {
            // gsi/transform posts the token to TikTok from Google's own script; if that script failed to
            // load the popup stays blank forever, so the caller has to restart the whole flow.
            state.gsiSince ||= Date.now();
            if (Date.now() - state.gsiSince > GSI_BLANK_GRACE_MS && await isGsiScriptMissing(popup)) {
                return OAUTH_REASON.POPUP_BLANK;
            }
        } else {
            state.gsiSince = 0;
        }

        if (url.includes('speedbump')) {
            if (await clickThrottled(state, 'speedbump', popup, '//input[@type="submit"]')) {
                console.log(email, 'click speedbump');
            }
        } else if (await clickThrottled(state, 'account', popup, accountXpath, ACCOUNT_CLICK_GAP_MS)) {
            console.log(email, 'selected account in chooser');
        } else if (await clickThrottled(state, 'consent', popup, consentXpath)) {
            console.log(email, 'clicked consent Continue');
        }
        await delay(POPUP_POLL_MS);
    }
    console.log(email, 'google popup timeout at', popup.isClosed() ? 'closed' : popup.url().slice(0, 160));
    return OAUTH_REASON.TIMEOUT;
}

async function clickGoogleChannel(mainPage, fallbackIndex, email) {
    const readyIndex = await waitGoogleChannelReady(mainPage, CHANNEL_READY_TIMEOUT_MS);
    console.log(email, 'google channel index', readyIndex);
    const index = readyIndex >= 0 ? readyIndex : fallbackIndex;
    await clickXpath(() => mainPage, "//div[@role='link']", index, 2, true);
}

/** Page.url() throws while the main frame is being replaced by the OAuth redirect; treat that as "changed". */
const safeUrl = (page) => {
    try { return page.url(); } catch (e) { return null; }
};

/** Brings TikTok back to the front and waits for it to leave /signup|/login after the popup closed. */
async function settleMainPage(mainPage, urlBefore) {
    await mainPage.bringToFront().catch(() => { });
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline && safeUrl(mainPage) === urlBefore) await delay(500);
}

/**
 * Signs in to TikTok through the Google OAuth popup.
 * @param {import('./clone_reg.js').default} clone
 * @param {{ isLoginPage: boolean }} options TikTok's login modal lists one more channel than signup.
 * @returns {Promise<{ ok: boolean, reason: string }>}
 */
export async function authorizeWithGoogle(clone, { isLoginPage }) {
    const email = clone.email_info.email;
    const mainPage = await clone.getPage();
    const fallbackIndex = isLoginPage ? FALLBACK_LOGIN_CHANNEL_INDEX : FALLBACK_SIGNUP_CHANNEL_INDEX;
    let reason = OAUTH_REASON.NO_POPUP;

    for (let retry = 0; retry <= MAX_BLANK_POPUP_RETRIES; retry++) {
        let popup = null;
        const urlBefore = safeUrl(mainPage);
        for (let tries = 0; tries < MAX_POPUP_OPEN_TRIES && !popup; tries++) {
            const pagesBefore = await clone.browser.pages();
            await clickGoogleChannel(mainPage, fallbackIndex, email);
            popup = await waitForPopup(clone.browser, mainPage, pagesBefore);
        }
        if (!popup) {
            traceStep(email, 'oauth:popup_not_found', { mainUrl: urlBefore });
            return { ok: false, reason: OAUTH_REASON.NO_POPUP };
        }
        attachNetworkTrace(email, popup, 'popup');
        traceStep(email, 'oauth:popup_opened', { url: safeUrl(popup), mainUrl: urlBefore });

        reason = await driveGooglePopup(popup, email);
        console.log(email, 'google popup finished:', reason);

        if (reason === OAUTH_REASON.POPUP_BLANK) {
            await popup.close().catch(() => { });
            await delay(2000);
            continue;
        }
        if (reason === OAUTH_REASON.DONE) {
            await settleMainPage(mainPage, urlBefore);
            traceStep(email, 'oauth:main_after_popup', { urlBefore, urlAfter: safeUrl(mainPage), changed: safeUrl(mainPage) !== urlBefore });
            await snapshotPage(email, mainPage, 'after_popup');
        }
        break;
    }
    return { ok: reason === OAUTH_REASON.DONE, reason };
}
