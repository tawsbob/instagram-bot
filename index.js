const dotenv = require('dotenv')
dotenv.config()

const puppeteer = require('puppeteer');
const Instagram = require('./instagram');
const { loadSession } = require('./utils');

(async () => {

    const browser = await puppeteer.launch({ headless: false, userDataDir: './browser-cache', });
    const [ page ] = await browser.pages();
    
    page.setViewport({ width: 1280, height: 926 });

    await loadSession(page);
    const InstagramBot = new Instagram(browser, page)    
    

    //await InstagramBot.login()
    await InstagramBot.getLastPosts('shedcluboficial', 'https://www.instagram.com/shedcluboficial/')
    /*await InstagramBot.chat(
        'https://www.instagram.com/shedcluboficial/',
        'Enviando uma mensagem qualquer'
    )*/

   // await browser.close();
  })();
  
  