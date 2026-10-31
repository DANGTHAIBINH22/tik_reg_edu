import fs from 'fs';
import path from 'path';

const DEBUG_DIR = path.resolve('./debug');
const BODY_PREVIEW_CHARS = 200;
const NET_PATTERN = /\/passport\/|\/api\/(?:user|login|signup|oauth|check|common|update|upload)|accounts\.google\.com\/(?:gsi|o\/oauth2|signin\/oauth)|\/oauth\//;
const MAX_REPORTED_BODY = 300;

const shorten = (text, max) => (text || '').replace(/\s+/g, ' ').trim().slice(0, max);

/** One-line step report: `[STEP] <email> <step> <key=value ...>`. */
export function traceStep(email, step, data = {}) {
    const fields = Object.entries(data).map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`).join(' ');
    console.log(`[STEP] ${email} ${step} ${fields}`.trim());
}

async function describeResponse(response) {
    const request = response.request();
    const url = new URL(response.url());
    let body = '';
    try { body = shorten(await response.text(), MAX_REPORTED_BODY); } catch (e) { body = '(unreadable body)'; }
    return `${request.method()} ${response.status()} ${url.pathname} ${body}`;
}

/** Logs status + short body of auth-related responses, plus main-frame navigations, for one page. */
export function attachNetworkTrace(email, page, label = 'page') {
    page.on('response', async (response) => {
        try {
            if (NET_PATTERN.test(response.url())) console.log(`[NET:${label}] ${email} ${await describeResponse(response)}`);
        } catch (e) { /* page closed mid-read */ }
    });
    page.on('framenavigated', (frame) => {
        if (frame === page.mainFrame()) console.log(`[NAV:${label}] ${email} ${shorten(frame.url(), 160)}`);
    });
    page.on('close', () => console.log(`[CLOSE:${label}] ${email}`));
}

/** Reports URL, visible text and saves a screenshot, so a stuck page can be inspected afterwards. */
export async function snapshotPage(email, page, label) {
    try {
        const text = await page.evaluate(() => document.body?.innerText || '');
        const file = path.join(DEBUG_DIR, `${email.split('@')[0]}_${label}.png`);
        fs.mkdirSync(DEBUG_DIR, { recursive: true });
        await page.screenshot({ path: file });
        traceStep(email, `snapshot:${label}`, { url: shorten(page.url(), 160), text: shorten(text, BODY_PREVIEW_CHARS), shot: file });
    } catch (e) {
        traceStep(email, `snapshot:${label}`, { error: e.message });
    }
}
