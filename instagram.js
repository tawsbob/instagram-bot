
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
            msg_line: 'section div[role="listbox"]'
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

    imageUrlToPath(url, prefix = ''){
        const [ _, extension] = this.match_img_regex.exec(url);
        const folder_path = `${path.join(this.path_to_save)}/${prefix}-${this.clearImageUrl(url)}.${extension}`

        return folder_path
    }
    clearImageUrlParams(url){
        return url.replace(/\?(.*)/g, '')
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

        const folder_path = this.imageUrlToPath(url, prefix);

        return new Promise((resolve, reject)=>{
            fs.writeFile(folder_path, buffer, 'base64', (err)=>{
                err ? reject(err) : resolve()
            });
        })
    }

    async downloadImages(data, prefix = ''){
        const _self = this;
        
        this.checkFolder()

        console.log(`images to download (${data.length}) in ${_self.images_to_download.length} stored`)

        const images = data.reduce((acc, { image })=>{

            const item = _self.images_to_download.find(
                ({ url })=>(
                    _self.clearImageUrlParams(url) === _self.clearImageUrlParams(image)
                )
            );
            
            if(item){
                acc.push(item)
            }
            
            return acc;
        }, [])

        console.log(`images found in intercept ${images.length}`)

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
        await this.wait(300);

        const msg_sent = await this.page.evaluate(({ query, msg }) => {

            return Array.from(
                document.querySelectorAll(
                    query
                )
            ).reduce((acc, div)=>{
                if(div.innerText.trim() === msg){
                    acc = true;
                }
                return acc;
            }, false)
            

        }, { query: this.selectors.chat.msg_line, msg })
        
        if(msg_sent){
            console.log('mensagem enviada com sucesso!')
        } else {
            console.log('mensagem não confirmada (poder ser que sim ou que não)')
        }
    }

    async closeNotificationModal(){
        const [ button ] = await this.page.$$('div[role="dialog"] button:last-child');
        if(button) {
            button.click()
        }
    }

    async getPostData(link, profile){

        console.log(`getting data from ${profile}`)

        this.download_images = true;

        await link.click();

        await this.wait(2000);

        const data = await this.page.evaluate(({ description, image }) => {
            
            const description_element = document.querySelector(description);
            const image_element = document.querySelector(image);

            const _description =  description_element ? description_element.innerText : null;
            const _image = image_element ? image_element.src : null;
            
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

        return {
            folder_path: data.image ? this.imageUrlToPath(data.image, profile) : null,
            ...data
        }
    }

    async getPostDataRecursively(count, profile){
        let data = []

        const links = await this.page.$$(this.selectors.timeline.post)

        while (data.length < count){
            data.push(
                await this.getPostData(
                    links[data.length],
                    profile
                )
            )
        }

        return data;
    }

    async getLastPosts(profileUrl){

        const profile_name = profileUrl.replace(/(.*)+.com\/|\//g,'') 

        if(profileUrl){
            try {
            
                const { post } = this.selectors.timeline
                
                await this.page.goto(profileUrl);
                await this.page.waitForSelector(post);
                
                await this.wait(500);
            
                
                const posts = await this.getPostDataRecursively(3, profile_name);
                
                console.log('downloading images...')
                await this.downloadImages(posts, profile_name);


                /*prettyJsonToFile({
                    filePath: path.join(this.path_to_save, 'data.json'),
                    data: 
                })*/

                return {
                    profile_name,
                    profileUrl,
                    scrape_date: dayjs().format('DD/MM/YYYY'),
                    posts
                }


            } catch (e) {
                console.log(e)
                //throw e;
            }
        }
    }
}

module.exports = Instagram