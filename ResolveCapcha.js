import axios from 'axios'

const config = {
    solver: 'EZ-CAPTCHA',
    capKey: 'f507d78eca3042ac8c046fa69b6cc87b144199'
};

async function solvecap(arkoseBlob, key, outlook) {
    try {
        return await new Promise(async (r)=>{
            setTimeout(()=>{
                return r("")
            },180000)
            if (config.solver === 'EZ-CAPTCHA') {
                const apiKeyyy = key;
                let payload = {
                    clientKey: apiKeyyy,
                    task: {
                        websiteURL: 'https://iframe.arkoselabs.com/',
                        websiteKey: 'B7D8911C-5CC8-A9A3-35B0-554ACEE604DA',
                        type: 'FuncaptchaTaskProxyless',
                        data: arkoseBlob,
                        funcaptchaApiJSSubdomain: ''
                    }
                };
    
                let result = await axios.post('https://api.ez-captcha.com/createTask', payload);
                const task_id = result.data.taskId;
    
                payload = { taskId: task_id, clientKey: apiKeyyy };
                let total = 0 
                while (total < 10) {
                    total ++ 
         
                    let log = outlook.log.bind(outlook)
                    log("Getting result captcha...")
                    const capkey = await getResult(payload)
                    if(capkey) {
                        return r(capkey);

                    }
                    await new Promise(resolve => setTimeout(resolve, 1500)); 

                }

                return r("");

            }
        })
    } catch (e) {
        console.error('Solve captcha failed', e);
        return null;
    }
}
async function getResult(payload) {
    try {
        return await new Promise(async (r)=>{
            setTimeout(()=>{
                return r("")
            },10000)

            let result = await axios.post('https://api.ez-captcha.com/getTaskResult', payload);
            const data = result.data;
             if (data.status == 'ready') {
                const capkey = data.solution.token;
                return r(capkey);
            }
            return r("")
          
    })
    } catch (e) {
        console.error('Solve captcha failed', e);
        return null;
    }
}

export { solvecap}