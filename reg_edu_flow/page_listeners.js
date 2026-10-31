import axios from 'axios';
import path from 'path';
import helper from '../helper.pup.js';
import { attachNetworkTrace } from './debug_trace.js';

const GOOD_MS_TOKEN_LENGTH = 156;
// TikTok error codes on passport endpoints. 1091 = email already used too much; the rest abort the run.
const CODE_EMAIL_OVERUSED = 1091;
const ABORT_CODES_REGION = [7, 4, 2020];

const toCookieString = (setCookie) => [].concat(setCookie || []).join('; ');

/** Serves a patched webmssdk.js that exposes TikTok's signing internals as window.__tsign(2). */
async function respondWithPatchedSdk(request) {
    const url = request.url();
    try {
        console.log('webmssdk url', url);
        const { data } = await axios.get(url);
        const body = data
            .replace('/fe/sdk-web/plugins"};var', '/fe/sdk-web/plugins"};window.__tsign = t;var')
            .replace('function(n){for(var t=n,r=t.o[6][0],i=786;i<1030;i++)', 'function(n){window.__tsign2 = n;for(var t=n,r=t.o[6][0],i=786;i<1030;i++)');
        await request.respond({ status: 200, contentType: 'application/javascript', body });
    } catch (e) {
        console.error('Lỗi khi tải hoặc sửa webmssdk.js:', e.message);
        await request.continue().catch(() => { });
    }
}

function onRequest(clone) {
    return async (request) => {
        try {
            const url = request.url();
            if (url.includes('/webmssdk.js')) return await respondWithPatchedSdk(request);
            if (url.includes('/webcast/room/enter') && request.method() === 'POST') {
                clone.global_val.cookie_enter = request.headers().cookie;
            }
            await request.continue();
        } catch (e) { /* request already handled or page closed */ }
    };
}

async function markEmailOverused(clone) {
    const { info } = clone;
    clone.current_retry = 4;
    clone.email_bloked = true;
    await clone.moveAccountTooMuchUse([info.email], 'tiktok_too_much');
    await helper.appendFile({ path: path.resolve(`./mails_done${clone.cron_name}.txt`), data: `${info.email}|${info.password}\n` });
}

async function handlePassportFailure(clone, endpoint, body) {
    const code = body?.data?.error_code;
    console.log(clone.info.email, `${endpoint} failed`, body?.data);
    if (code === CODE_EMAIL_OVERUSED) return markEmailOverused(clone);
    if (endpoint === 'region' && ABORT_CODES_REGION.includes(code)) clone.current_retry = 4;
}

function trackMsToken(clone, response) {
    const match = toCookieString(response.headers()['set-cookie']).match(/msToken=([^;]+)/);
    if (!match) return;
    const token = match[1];
    clone.global_val.msToken = token;
    if (token.length === GOOD_MS_TOKEN_LENGTH) {
        clone.global_val.msTokenGood = token;
        console.log(clone.info.email, `🎯 msToken from ${response.url().split('?')[0]}`, token);
    }
}

/** Reads a JSON response body, or null when it is not JSON (redirects, empty bodies). */
const readJson = (response) => response.json().catch(() => null);

const RESPONSE_HANDLERS = [
    ['captcha/verify', async (clone, response) => {
        if (!response.url().includes('verification')) return;
        const body = await readJson(response);
        if (body) console.log('Verify', body.message, body.code);
    }],
    ['api/update/profile', async (clone, response) => {
        const body = await readJson(response);
        // Unreadable body is treated as success: the nickname check below only matters for a parsed reply.
        clone.update_profile = !body || body.user?.nickname === clone.info.nickname;
        console.log(clone.update_profile ? 'Update profile success' : 'Update profile failed');
    }],
    ['api/upload/image', async (clone, response) => {
        const body = await readJson(response);
        if (!body) return;
        console.log(body.data?.uri ? 'Upload avatar success' : `Upload avatar failed ${JSON.stringify(body)}`);
        clone.upload_avatar = true;
    }],
    ['passport/web/auth/login_only', async (clone, response) => {
        const body = await readJson(response);
        if (body && body.message !== 'success') await handlePassportFailure(clone, 'login_only', body);
    }],
    ['/passport/web/region', async (clone, response) => {
        const body = await readJson(response);
        if (body && body.message !== 'success') await handlePassportFailure(clone, 'region', body);
    }],
    ['passport/web/email/register_verify_login', async (clone, response) => {
        clone.global_val.register_verify_login_done = true;
        const body = await readJson(response);
        if (!body) return;
        if (body.message === 'success') {
            clone.info.username_success = clone.username_success = body.data.name;
            clone.reg_success = true;
            clone.global_val.register_verify_login_captcha = false;
        } else {
            console.log(clone.info.email, 'Register verify login failed');
            clone.global_val.register_verify_login_captcha = true;
        }
    }],
    ['passport/web/account/set', async (clone, response) => {
        const body = await readJson(response);
        if (!body) return;
        const { info } = clone;
        if (body.message === 'success') {
            console.log('web/account success');
            info.username = info.username_set;
            clone.had_sucess_set_username = true;
        } else {
            console.log('web/account failed');
            if (!clone.had_sucess_set_username) info.username = info.username_success;
        }
    }],
    ['passport/web/email/send_code', async (clone, response) => {
        clone.global_val.email_send_code_done = true;
        const body = await readJson(response);
        if (body?.message === 'success') clone.global_val.email_send_code_captcha = false;
        else if (body?.message === 'error') clone.global_val.email_send_code_captcha = true;
    }],
    ['/webcast/ranklist/online_audience', async (clone, response) => {
        const body = await readJson(response);
        if (!body) return;
        clone.check_room_status = true;
        if (clone.is_join) return;
        const joined = Boolean(body.data?.self_info?.rank);
        console.log(joined ? 'have join' : 'have notjoin', clone.info.username || body.data?.self_info?.user?.display_id);
        clone.is_join = clone.info.is_join = joined;
    }],
];

function onResponse(clone) {
    return async (response) => {
        try {
            trackMsToken(clone, response);
            const url = response.url();
            for (const [needle, handler] of RESPONSE_HANDLERS) {
                if (url.includes(needle)) await handler(clone, response);
            }
        } catch (e) { /* a listener must never crash the flow */ }
    };
}

/** Wires the request/response taps the signup flow depends on (SDK patch, msToken, passport verdicts). */
export function attachPageListeners(clone, page) {
    page.on('error', async (err) => {
        console.log(clone.email_info.email, 'Error happened somewhere in the page:', err);
        await clone.closeBrowser();
    });
    page.on('dialog', (dialog) => {
        console.log('dialog', dialog.message());
        dialog.accept().catch(() => { });
    });
    page.on('requestfailed', (req) => {
        const errorText = req.failure()?.errorText || '';
        if (/ERR_PROXY|ERR_TUNNEL|tunnel connection failed|ERR_CONNECTION_CLOSED/i.test(errorText)) {
            console.log('[PROXY AUTH POPUP DETECTED]', errorText);
        }
    });
    attachNetworkTrace(clone.email_info.email, page, 'main');
    page.on('request', onRequest(clone));
    page.on('response', onResponse(clone));
    return page.setRequestInterception(true).catch(() => { });
}
