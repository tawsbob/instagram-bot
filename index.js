const dotenv = require('dotenv')
dotenv.config()

const puppeteer = require('puppeteer');
const Instagram = require('./instagram');
const { loadSession } = require('./utils');
const profiles_url = require('./data/profiles');


(async () => {

    const browser = await puppeteer.launch({ headless: false, userDataDir: './browser-cache', });
    const [ page ] = await browser.pages();
    
    page.setViewport({ width: 1280, height: 600 });

    
    const InstagramBot = new Instagram(browser, page)    
    

    //await InstagramBot.login()
    
    await page.goto('https://www.instagram.com/')
    await loadSession(page);
    
    const data = [];

    while (data.length < profiles_url.length){
        data.push(
             await InstagramBot.getLastPosts( profiles_url[data.length])
        )
    }

    console.log(data);

    /*await InstagramBot.chat(
        'king.source.code',
        'teste de confirmação'
    )*/
    
   // await browser.close();
  })();
  
  