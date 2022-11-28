
const fs = require('fs');
const dayjs = require('dayjs');
const path = require('path');
const { prettyJsonToFile } = require('./utils');

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
    path_to_save = path.join('./content', dayjs().format('DD_MM_YYYY'))
    
    selectors = {
        profile: {
            header_btns: 'main header button',
        },
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
        },
        chat : {
            textarea: 'section textarea[placeholder="Message..."]',
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

    checkFolder(){
        if (!fs.existsSync(this.path_to_save)){
            fs.mkdirSync(this.path_to_save);
        }
    }

    downloadImage({ url, buffer }, prefix){

        const [ _, extension] = this.match_img_regex.exec(url);
        const folder_path = `${path.join(this.path_to_save)}/${prefix}-${this.clearImageUrl(url)}.${extension}`

        return new Promise((resolve, reject)=>{
            fs.writeFile(folder_path, buffer, 'base64', (err)=>{
                err ? reject(err) : resolve()
            });
        })
    }

    async downloadImages(data, prefix = ''){
        const _self = this;
        
        this.checkFolder()

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
            images.map((info)=>(this.downloadImage(info, prefix)))
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
        const localStorage = await this.page.evaluate(() => JSON.stringify(localStorage));
      
        fs.writeFile("./session/cookies.json", cookies, ()=>{});
        fs.writeFile("./session/sessionStorage.json", sessionStorage, ()=>{});
        fs.writeFile("./session/localStorage.json", localStorage, ()=>{});

        await this.page.waitForNavigation();
    }

    async chat(profile_slug, msg){
        
        await this.page.goto(`https://www.instagram.com/${profile_slug}/`);

        await this.page.waitForSelector(this.selectors.profile.header_btns)

        const [_, msg_btn ] = await this.page.$$(
            this.selectors.profile.header_btns
        );

        if(msg_btn){
            await msg_btn.click()   
        }
        
        await this.page.waitForNavigation()
        await this.page.waitForSelector(this.selectors.chat.textarea)

        await this.page.type(this.selectors.chat.textarea, msg);
        await this.page.keyboard.press('Enter');

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

    async getLastPosts(profile_name, profileUrl){
        if(profileUrl){
            try {
            
                const { post } = this.selectors.timeline
                
                await this.page.goto(profileUrl);
                await this.page.waitForSelector(post);
                
                await this.wait(500);

                //await this.closeNotificationModal();
            
                
                const data = await this.getPostDataRecursively(3);
                
                await this.downloadImages(data, profile_name);

                prettyJsonToFile({
                    filePath: path.join(this.path_to_save, 'data.json'),
                    data
                })

                return data


            } catch (e) {
                console.log(e)
                //throw e;
            }
        }
    }
}

module.exports = Instagram