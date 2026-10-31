import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import assert from 'assert';
import { config } from './config.js';
import helper from './helper.pup.js';
import { showWindowsStacked } from './show_scr.js';
import { createDirectoryIfNotExists, ensureFileExists } from './utils.js';
import { clearProfile, stopProfile } from './reg_edu_flow/gologin_api.js';
import { WorkerPool, ProfileTask } from './reg_edu_flow/profile_pool.js';
import { RegistrationTask } from './reg_edu_flow/registration_task.js';
import { readUaMajor, chromeVersion } from './reg_edu_flow/ua_version.js';

const execAsync = promisify(exec);
const args = global.sharedArgs || process.argv.slice(2);
const [OS_TYPE_ARG, NUM_OF_PROFILES, ALIAS_NAME, CRON_NAME, MAX_CONCURRENT, STOP_USERNAME_ARG, FINISH_AT_USERNAME_ARG] = args;

const REG_TIMEOUT_MS = 420000;
const MIN_PROXIES = 4;
const START_URL = 'https://ipv4.jsonip.com/';
const CHROME_VERSION = '151.0.7827.102';
const UA_TEMPLATES = {
    mac: (v) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`,
    lin: (v) => `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`,
    win: (v) => `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`,
    android: (v) => `Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v} Safari/537.36`,
};

const options = {
    aliasName: ALIAS_NAME || 'VN',
    cronName: CRON_NAME,
    isStopUsername: STOP_USERNAME_ARG === 'true',
    finishAtUsername: FINISH_AT_USERNAME_ARG === 'true',
};

let maxConcurrent = parseInt(MAX_CONCURRENT) || Math.min(os.cpus().length, 2);
let startedProfileIds = [];

process.on('uncaughtException', (error) => {
    const kind = error instanceof assert.AssertionError ? 'Assertion' : 'Unexpected';
    console.error(`[ERROR] ${kind}:`, error.message, new Date().toLocaleString());
});
process.on('unhandledRejection', (reason) => {
    console.error('[ERROR] Unhandled Promise Rejection:', reason, new Date().toLocaleString());
});

const exitWithDelay = async (code, message) => {
    if (message) console.log(message);
    await helper.delay(helper.getRandomInt(10000, 60000));
    process.exit(code);
};

/** Sticky-session residential proxies; with VPS_IP set they are tunnelled through the VPS smart proxy. */
function buildProxies(count) {
    const sid = () => Math.random().toString(36).slice(2, 10);
    const proxies = Array.from({ length: count }, () =>
        `pic71109827-region-US-sid-${sid()}-t-120:4iuz5trt@sg.arxlabs.io:3010`);
    if (!process.env.VPS_IP) return proxies;

    const vpsPort = parseInt(process.env.VPS_PROXY_PORT) || 8877;
    const wrapped = proxies.map((p) => {
        const at = p.lastIndexOf('@');
        const creds = p.slice(0, at);
        const [host, port] = p.slice(at + 1).split(':');
        const colon = creds.indexOf(':');
        return `${creds.slice(0, colon)}__${host}__${port}:${creds.slice(colon + 1)}@${process.env.VPS_IP}:${vpsPort}`;
    });
    console.log('[PROXY] VPS mode ON — proxy[0]:', wrapped[0]);
    return wrapped;
}

async function runVpsSelfUpdate() {
    // Kept from the original flow: VPS machines pull the latest code before every run.
    if (process.env.IS_VPS !== 'true') return;
    for (const command of ['git reset --hard', 'git pull']) {
        await execAsync(command);
    }
}

async function createProfiles(emails, proxies) {
    const CHROME_VERSION = chromeVersion(readUaMajor());
    console.log(`[PHASE 1] Creating profiles... requested Chrome ${CHROME_VERSION}`);
    const tasks = emails.map((email, idx) => new ProfileTask({
        email: email.email,
        proxy: proxies[idx % proxies.length],
        userAgent: UA_TEMPLATES[OS_TYPE_ARG]?.(CHROME_VERSION) ?? UA_TEMPLATES.mac(CHROME_VERSION),
        startUrl: START_URL,
        version: CHROME_VERSION,
        platform: OS_TYPE_ARG,
        osType: OS_TYPE_ARG,
        cronName: CRON_NAME,
    }));
    const results = await new WorkerPool(maxConcurrent).execute(tasks);
    return results.filter(r => r.success).map(r => r.data);
}

async function registerAll(profiles, emails, proxies) {
    console.log('[PHASE 2] Processing registrations...');
    const tasks = profiles.map((profileData) => {
        const emailInfo = emails.find(e => e.email === profileData.email);
        if (!emailInfo) throw new Error(`Email data not found for ${profileData.email}`);
        return new RegistrationTask({
            profileData, emailInfo, proxys: proxies, proxy: profileData.proxy, options, timeout: REG_TIMEOUT_MS
        });
    });
    return new WorkerPool(Math.min(maxConcurrent, profiles.length)).execute(tasks);
}

function printStats({ emails, profiles, regResults, startedAt }) {
    const ok = regResults.filter(r => r.success && r.data.success);
    const failed = regResults.filter(r => !r.success || !r.data.success);
    const avg = ok.length ? (ok.reduce((s, r) => s + r.data.duration, 0) / ok.length / 1000).toFixed(1) : 0;

    console.log('\n[FINAL STATS]');
    console.log(`Profiles Created: ${profiles.length}/${emails.length}`);
    console.log(`Registrations Successful: ${ok.length}/${regResults.length}`);
    console.log(`Average Registration Time: ${avg}s`);
    console.log(`Total Processing Time: ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
    console.log(`Concurrent Threads Used: ${maxConcurrent}`);
    if (failed.length) {
        console.log('\n[FAILED EMAILS]');
        failed.forEach(f => console.log(`- ${f.data?.email || 'Unknown'}: ${f.error || f.data?.error || 'Unknown error'}`));
    }
}

async function main() {
    const startedAt = Date.now();
    console.log(`[INFO] Starting registration with ${maxConcurrent} concurrent threads. ${new Date().toUTCString()}`);
    await runVpsSelfUpdate();

    await Promise.all([
        createDirectoryIfNotExists('./images'),
        ensureFileExists('./account_reg_no_avatar.txt'),
        ensureFileExists('./email_failed.txt')
    ]);
    await clearProfile();
    await helper.ensureGoLoginRunning();

    const proxies = buildProxies(Math.max(MIN_PROXIES, parseInt(NUM_OF_PROFILES) || MIN_PROXIES));
    const pathFile = path.resolve(config.PATH_EMAIL === 'REG_NO_CAPTCHA' ? './noneaccount.txt' : './output_captcha.txt');
    const emails = (await helper.getEmail({
        length: NUM_OF_PROFILES, pathFile, type: 'UNLIMIT_GMAIL_EDU_MAIL3979', id_service: '60', cron_name: CRON_NAME
    })).slice(0, NUM_OF_PROFILES);
    if (!emails.length) return exitWithDelay(1, '[ERROR] No emails available');
    console.log(`[INFO] Processing ${emails.length} emails`);

    const profiles = await createProfiles(emails, proxies);
    console.log(`[PHASE 1] Created ${profiles.length}/${emails.length} profiles`);
    if (!profiles.length) return exitWithDelay(1, '[ERROR] No profiles created successfully');
    startedProfileIds = profiles.map(p => p.profileId);
    maxConcurrent = profiles.length;

    if (os.type() !== 'Darwin' && os.type() !== 'Linux') {
        try { showWindowsStacked(); } catch (e) { console.log('[WARN] showWindowsStacked error:', e.message); }
    }

    const regResults = await registerAll(profiles, emails, proxies);
    printStats({ emails, profiles, regResults, startedAt });
    console.log(`\nProcess exit: ${new Date().toUTCString()}`);
}

async function cleanup() {
    console.log('[CLEANUP] Stopping started profiles...');
    await Promise.all(startedProfileIds.map(id => stopProfile(id)));
}

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, async () => {
        console.log(`\n[SIGNAL] Received ${signal}, cleaning up...`);
        await cleanup();
        process.exit(0);
    });
}

if (!OS_TYPE_ARG || !NUM_OF_PROFILES) {
    console.error('Usage: node reg_edu_run.js <OS_TYPE> <NUM_PROFILES> [ALIAS_NAME] [CRON_NAME] [MAX_CONCURRENT] [IS_STOP_USERNAME] [FINISH_AT_USERNAME]');
    process.exit(1);
}
console.log('👉 reg_edu_run.js', { OS_TYPE: OS_TYPE_ARG, NUM_OF_PROFILES, ALIAS_NAME, CRON_NAME, MAX_CONCURRENT });

main()
    .then(() => process.exit(1))
    .catch(async (error) => {
        console.error('[FATAL] Unhandled error in main:', error);
        await cleanup();
        process.exit(1);
    });
