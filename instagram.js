
const fs = require('fs');
//const path = require('path');

class Instagram {
    
    browser = null;
    page = null;
    user = process.env.INSTAGRAM_USER;
    pass = process.env.INSTAGRAM_PASS
    username_slug = process.env.INSTAGRAM_USERNAME_SLUG
    download_images = false
    match_img_regex = /.*\.(webp|jpg)/
    clear_image_url_regex = /https\:\/\/|\?.+/g
    images_to_download = []

    selectors = {
        login: {
            user_input: 'input[name="username"]',
            pass_input: 'input[name="password"]',
            submit: 'button[type="submit"]'
        },
        timeline: {
            post: 'main article a[role="link"]'
        },
        post: {
            description: '._a9zr ._a9zs > span',
            image: 'article[role="presentation"] div._aagv img',
            close_btn: 'svg.x1lliihq.x1n2onr6',
        }
    }

    constructor(browser, page){
        const _self = this;

        this.browser = browser
        this.page = page

        this.page.on('response', async (response) => {
            if(_self.download_images){
                const url = response.url();
                const matches = _self.match_img_regex.exec(url);
                
                if (matches) {
                    _self.images_to_download.push({
                        url,
                        buffer: await response.buffer()
                    })
                }
                
            }
        });
    }

    clearImageUrl(url){
        return url
            .replace(this.clear_image_url_regex,'')
            .replace(/\.|\//g,'')
    }

    async getElementClassElementByQuery(query){
        return await this.page.evaluate((query) => {
            return Array.from(
                    document.querySelectorAll(query)
                ).map(
                    (el)=>(el.getAttribute('class'))
            )
        },query)
    }

    async wait(time){
        return new Promise((resolve)=>{
            setTimeout(resolve, time)
        });
    }

    downloadImage({ url, buffer }){
        const [ _, extension] = this.match_img_regex.exec(url);
        
        const file_name = this.clearImageUrl(url) + '.'+  extension;

        return new Promise((resolve, reject)=>{
            fs.writeFile(`./content/${this.clearImageUrl(url)}.${extension}`, buffer, 'base64', (err)=>{
                err ? reject(err) : resolve()
            });
        })
    }

    async downloadImages(data){
        const _self = this;
        
        const images = data.reduce((acc, { image })=>{

            const item = _self.images_to_download.find(
                ({ url })=>(
                    url===image
                )
            );
            
            if(item){
                acc.push(item)
            }
            
            return acc;
        }, [])

        return await Promise.all(
            images.map(this.downloadImage.bind(_self))
        )
    }

    async login(){
        
        const { user_input, pass_input, submit  } = this.selectors.login

        await this.page.goto('https://www.instagram.com/');
        await this.page.waitForSelector(user_input);
        await this.page.type(user_input, this.user);
        await this.page.type(pass_input, this.pass);
        await this.page.click(submit)

        const cookies = JSON.stringify(await this.page.cookies());
        const sessionStorage = await this.page.evaluate(() =>JSON.stringify(sessionStorage));
        const localStorage = await this.page.evaluate(() => JSON.stringify(localStorage));
      
        fs.writeFile("./session/cookies.json", cookies, ()=>{});
        fs.writeFile("./session/sessionStorage.json", sessionStorage, ()=>{});
        fs.writeFile("./session/localStorage.json", localStorage, ()=>{});

        await this.page.waitForNavigation();
    }

    async chat(profileUrl, msg){
        
        await this.page.goto(profileUrl);

        //const [button] = await page.$x("//button[contains(., 'Message')]");

        /*if(button){
            await button.click()   
        }
        //await this.page.waitForSelector('div[role="dialog"]');
        
        await this.page.waitForNavigation()

        await this.page.waitForSelector('textarea');
        await this.page.type('textarea', msg);
        await page.keyboard.press('Enter');*/
    }

    async closeNotificationModal(){
        const [ button ] = await this.page.$$('div[role="dialog"] button:last-child');
        if(button) {
            button.click()
        }
    }

    async getPostData(link){

        console.log('getPostData')

        this.download_images = true;

        await link.click();

        await this.wait(2000);

        const data = await this.page.evaluate(({ description, image }) => {
            
            const _description =  document.querySelector(description).innerText || null;
            const _image = document.querySelector(image) ? document.querySelector(image).src : null;
            
            console.log(
                _description
            )
            console.log(
                _image
            )

            return {
                description: _description,
                image: _image,
            }

        },this.selectors.post);
        
        console.log(data);

        await this.page.click(this.selectors.post.close_btn);
        this.download_images = false;

        return data
    }

    async getPostDataRecursively(count){
        let data = []
        const links = await this.page.$$(this.selectors.timeline.post)

        while (data.length < count){
            data.push(
                await this.getPostData(
                    links[data.length]
                )
            )
        }

        return data;
    }

    async getLastPosts(profileUrl){
        if(profileUrl){
            try {
            
                const { post } = this.selectors.timeline
                
                await this.page.goto(profileUrl);
                await this.page.waitForSelector(post);
                
                await this.wait(500);

                //await this.closeNotificationModal();
            
                
                const data = await this.getPostDataRecursively(3);
                console.log(data);
                this.downloadImages(data);
                //console.log(data);

                return data


            } catch (e) {
                console.log(e)
                //throw e;
            }
        }
    }
}

module.exports = Instagram