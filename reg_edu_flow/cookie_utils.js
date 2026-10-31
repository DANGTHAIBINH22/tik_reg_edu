/** Cookies a browser would send to `url` (domain, path, secure and expiry all match). */
export function filterCookiesForUrl(cookies, url) {
    const { hostname, pathname, protocol } = new URL(url);
    const now = Date.now() / 1000;

    return cookies.filter(cookie => {
        const domainMatches = hostname.endsWith(cookie.domain.replace(/^\./, ''));
        const pathMatches = pathname.startsWith(cookie.path || '/');
        const secureMatches = !cookie.secure || protocol === 'https:';
        const notExpired = !cookie.expires || cookie.expires > now;
        return domainMatches && pathMatches && secureMatches && notExpired;
    });
}

export function convertToBase64(object) {
    const data = typeof object === 'object' ? JSON.stringify(object) : object;
    try {
        return Buffer.from(data, 'utf-8').toString('base64');
    } catch (e) {
        return '';
    }
}
