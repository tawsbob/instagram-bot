const dayjs = require('dayjs');
const fs = require('fs');

const default_encoding = 'utf8';

const evaluateLocalStorage = (data) => {
    for (const [key, value] of Object.entries(data)) {
    localStorage[key] = value;
    }
}

async function loadSession(page){
    try {

        const [ 
            cookiesString,
            localStorageString
        ] = await Promise.all([
            fs.promises.readFile("./session/cookies.json", default_encoding),
            fs.promises.readFile("./session/localStorage.json", default_encoding)
        ])
        
       
        const cookies        = JSON.parse(cookiesString);
        const localStorage  = JSON.parse(localStorageString);

        await Promise.all([
            page.setCookie(...cookies),
            page.evaluate(evaluateLocalStorage, {
                ...localStorage,
                //hack prevent notification pop up to show on screen
                ig_notifications_dismiss: dayjs().add(5, 'day').valueOf()
            }),
        ])

        
    } catch(e){
        console.log(e)
    }
}



function prettyJsonToFile({ filePath = 'nopath.json', data, encoding = 'utf8'  }){
    return new Promise((resolve, reject)=>{
        if(data){
            fs.writeFile(filePath, JSON.stringify(data, null, 4), encoding, (err) => {
                if (err){
                    reject(err)
                } else {
                    resolve()
                }
              })
        } else {
            reject('no json data to save')
        }
    })
}

module.exports = {
    loadSession,
    prettyJsonToFile
}