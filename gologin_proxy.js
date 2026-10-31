import axios from 'axios';
import { config } from './config.js';
import { getProxyByCountryISORandom } from './pyproxy.js';

export async function getGologinProxyRand() {
    let region = getProxyByCountryISORandom()
    // region = "us";
    // console.log(regions)
    // process.exit(1)
    let url = "https://api.gologin.com/users-proxies/mobile-proxy"
    let headers = {
        "Authorization": "Bearer " + config.GOLOGIN_API_TOKEN,
        "Content-Type": "application/json"
    }

    return await axios.post(url, {
        "browserId": "",
        "countryCode": region,
        "isDC": true,
        "isMobile": false
    }, {headers})
    
}
