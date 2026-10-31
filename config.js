import dotenv from 'dotenv';

dotenv.config();
// console.log(process.env)
export const config = {
    GOLOGIN_API_TOKEN: process.env.GOLOGIN_API_TOKEN,
    EXECUTABLE_PATH: process.env.EXECUTABLE_PATH,
    TMP_DIR: process.env.TMP_DIR,
    FIREBASE_DB_URL: process.env.FIREBASE_DB_URL,
    WINMALL_API_URL: process.env.WINMALL_API_URL,
    WINMALL_CLIENT_ID: process.env.WINMALL_CLIENT_ID,
    AMAC_ACCOUNT_API: process.env.AMAC_ACCOUNT_API,
    EXTENDSIONS: process.env.EXTENDSIONS,
    PATH_EMAIL:  process.env.PATH_EMAIL,
    VISION_FOLDER_ID: process.env.VISION_FOLDER_ID,
    X_TOKEN: process.env.X_TOKEN
};