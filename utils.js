const fs = require('fs');

async function loadSession(page){
    try {

        const cookiesString = await fs.readFile("./session/cookies.json");
        const cookies = JSON.parse(cookiesString);

        const sessionStorageString = await fs.readFile("./session/sessionStorage.json");
        const sessionStorage = JSON.parse(sessionStorageString);

        const localStorageString = await fs.readFile("./session/localStorage.json");
        const localStorage = JSON.parse(localStorageString);

        await page.setCookie(...cookies);

        await page.evaluate((data) => {
            for (const [key, value] of Object.entries(data)) {
            sessionStorage[key] = value;
            }
        }, sessionStorage);

        await page.evaluate((data) => {
            for (const [key, value] of Object.entries(data)) {
            localStorage[key] = value;
            }
        }, sessionStorage);
    } catch(e){
        console.log(e)
    }
}

module.exports = {
    loadSession
}