const axios = require('axios');
const qs = require('qs');
const FormData = require('form-data');
const fs = require('fs');
const hasha = require('hasha');
const chunkingStreams = require('chunking-streams');
const SizeChunker = chunkingStreams.SizeChunker;

const DEBUG = false;

/* 
SETUP:
    npm install axios qs form-data hasha chunking-streams

USAGE: 
    const MediaFireApi = require('./mediafire');
    const mediaFireApi = new MediaFireApi('email@gmail.com', 'password');

    await mediaFireApi.login();
    await mediaFireApi.getSessionToken();

    await mediaFireApi.check('./myfile', 'myfilename', 'myfolderkey');
    await mediaFireApi.uploadFile('./myfile', 'myfilename', 'myfolderkey');
    
    const myContent = await mediaFireApi.getContent('myfolderkey', 'files');
    const file = myContent.folder_content.files.filter((file) => file.filename == 'myfilename')[0]
    const fileDetails = {
        'quickkey': file.quickkey,
        'hash': file.hash,
        'folderKey': 'myfolderkey'
    } 
    await mediaFireApi.updateFile(`./myfile`, 'myfilename', fileDetails);

    ~ by Roan John - roan@roanj.com
    ~ last updated: 25/11/2022

*/

module.exports = class MediaFireApi {
    constructor(email, password) {
        this.email = email;
        this.password = password;
        this.securityToken = '';
        this.sessionToken = '';
        this.cookies = '';
        this.unitSize = 0;
    }

    async login() {
        await this.setupLogin();
        try {
            const data = qs.stringify({
                'security': this.securityToken,
                'login_email': this.email,
                'login_pass': this.password,
                'login_remember': 'true',
            });
            const config = {
                method: 'post',
                url: 'https://www.mediafire.com/dynamic/client_login/mediafire.php',
                headers: {
                    'authority': 'www.mediafire.com',
                    'accept': '*/*',
                    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                    'content-type': 'application/x-www-form-urlencoded',
                    'cookie': this.cookies,
                    'origin': 'https://www.mediafire.com',
                    'referer': 'https://www.mediafire.com/login/',
                    'sec-ch-ua': '"Google Chrome";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'empty',
                    'sec-fetch-mode': 'cors',
                    'sec-fetch-site': 'same-origin',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
                },
                data: data
            };
            const loginReq = await axios(config);
            if (loginReq.data.errorMessage !== '') {
                this.debug(loginReq);
                console.log('An error occurred above when attempting to login, set DEBUG to true to see a more detailed log of what is going on')
                process.exit(1);
            }
            this.setCookies(loginReq);
            console.log('Successfully logged in..')
        }
        catch (e) {
            this.debug(e);
            console.log('An error occurred above when attempting to login, set DEBUG to true to see a more detailed log of what is going on')
            process.exit(1)
        }
    }

    async setupLogin() {
        try {
            const config = {
                method: 'get',
                url: 'https://www.mediafire.com/login/',
                headers: {
                    'authority': 'www.mediafire.com',
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
                    'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                    'cookie': '',
                    'sec-ch-ua': '"Google Chrome";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
                    'sec-ch-ua-mobile': '?0',
                    'sec-ch-ua-platform': '"Windows"',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'none',
                    'sec-fetch-user': '?1',
                    'upgrade-insecure-requests': '1',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
                },
            }
            const securityTokenReq = await axios(config);
            const securityToken = this.parseHtml(securityTokenReq.data);
            if (!securityToken) {
                throw "Could not find the security token in MediaFire's HTML content which is required within the login system."
            }
            this.setCookies(securityTokenReq);
            this.securityToken = securityToken;
        }
        catch (e) {
            this.debug(e);
            console.log('An error occurred above when attempting to setup the login method, set DEBUG to true to see a more detailed log of what is going on')
            process.exit(1);
        }
    }

    async getSessionToken() {
        const config = {
            method: 'post',
            url: 'https://www.mediafire.com/application/get_session_token.php',
            headers: {
                'authority': 'www.mediafire.com',
                'accept': '*/*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'content-length': '0',
                'cookie': this.cookies,
                'origin': 'https://app.mediafire.com',
                'referer': 'https://app.mediafire.com/',
                'sec-ch-ua': '"Google Chrome";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
            }
        };

        try {
            const getSessionReq = await axios(config);
            this.sessionToken = getSessionReq.data.response.session_token;
        }
        catch (e) {
            this.debug(e);
            console.log('An error occurred above when attempting to fetch the session, set DEBUG to true to see a more detailed log of what is going on')
            process.exit(1);
        }
    }

    async getContent(folderKey = 'myfiles', contentType = 'folders') {
        const data = qs.stringify({
            'session_token': this.sessionToken,
            'response_format': 'json',
            'folder_key': folderKey,
            'content_type': contentType,
            'chunk': '1',
            'chunk_size': '100',
            'details': 'yes',
            'order_direction': 'asc',
            'order_by': 'name',
            'filter': ''
        });
        const config = {
            method: 'post',
            url: 'https://www.mediafire.com/api/1.5/folder/get_content.php',
            headers: {
                'authority': 'www.mediafire.com',
                'accept': 'application/json',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'content-type': 'application/x-www-form-urlencoded',
                'origin': 'https://app.mediafire.com',
                'referer': 'https://app.mediafire.com/',
                'sec-ch-ua': '"Google Chrome";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36'
            },
            data: data
        };

        try {
            const getContentReq = await axios(config);
            return getContentReq.data.response;
        }
        catch (e) {
            this.debug(e);
            console.log('An error occurred above when attempting to fetch content, set DEBUG to true to see a more detailed log of what is going on')
            process.exit(1);
        }
    }

    async check(filePath, fileName, folderKey = 'myfiles') {
        const fileHash = await hasha.fromFile(filePath, { algorithm: 'sha256' });
        const stats = await fs.promises.stat(filePath);
        let data = new FormData();
        data.append('uploads', ``); /* remove this?? */
        data.append('response_format', 'json');
        data.append('session_token', this.sessionToken);
        const config = {
            method: 'get',
            url: `https://www.mediafire.com/api/1.5/upload/check.php?session_token=${this.sessionToken}&uploads=[{"filename":"${fileName}","folder_key":"${folderKey}","size":${stats.size},"hash":"${fileHash}","resumable":"yes","preemptive":"yes"}]&response_format=json`,
            headers: {
                'authority': 'www.mediafire.com',
                'accept': '*/*',
                'accept-language': 'en-GB,en-US;q=0.9,en;q=0.8',
                'origin': 'https://app.mediafire.com',
                'referer': 'https://app.mediafire.com/',
                'sec-ch-ua': '"Google Chrome";v="107", "Chromium";v="107", "Not=A?Brand";v="24"',
                'sec-ch-ua-mobile': '?0',
                'sec-ch-ua-platform': '"Windows"',
                'sec-fetch-dest': 'empty',
                'sec-fetch-mode': 'cors',
                'sec-fetch-site': 'same-site',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
                ...data.getHeaders()
            },
            data: data
        };
        try {
            const checkReq = await axios(config);
            if (checkReq.data.response.result !== 'Success') {
                this.debug(checkReq);
                console.log('An error occurred above when attempting to check a file, set DEBUG to true to see a more detailed log of what is going on')
                process.exit(1);
            }
            else {
                this.unitSize = checkReq.data.response.resumable_upload.unit_size;
            }

        }
        catch (e) {
            this.debug(e);
            console.log('An error occurred above when attempting to check a file, set DEBUG to true to see a more detailed log of what is going on')
            process.exit(1);
        }

    }

    async uploadFile(filePath, fileName, folderKey = 'myfiles') {
        const stats = await fs.promises.stat(filePath);
        await this.check(filePath, fileName, folderKey);
        if (stats.size > 4000000) {
            try {
                await this.uploadMultiChunks(filePath, fileName, folderKey);
            }
            catch (e) {
                this.debug(e);
                console.log('An error occurred above when attempting to check a file, set DEBUG to true to see a more detailed log of what is going on')
                process.exit(1);
            }
        }
        else {
            const fileHash = await hasha.fromFile(filePath, { algorithm: 'sha256' });
            const config = {
                method: 'post',
                url: `http://www.mediafire.com/api/1.5/upload/simple.php?folder_key=${folderKey}&response_format=json&session_token=${this.sessionToken}`,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
                    'Content-Type': 'application/octet-stream',
                    'Referer': 'https://app.mediafire.com/',
                    'X-Filename': fileName,
                    'X-Filesize': stats.size,
                    'X-Filehash': fileHash,
                },
                data: fs.createReadStream(filePath)
            };

            try {
                const uploadFileReq = await axios(config);
                if (uploadFileReq.data.response.doupload.result !== '0') {
                    this.debug(uploadFileReq);
                    console.log('An error occurred above when attempting to upload a file, set DEBUG to true to see a more detailed log of what is going on')
                    process.exit(1);
                }
            }
            catch (e) {
                this.debug(e);
                console.log('An error occurred above when attempting to upload a file, set DEBUG to true to see a more detailed log of what is going on')
                process.exit(1);
            }
        }
    }

    async uploadMultiChunks(filePath, fileName, folderKey) {
        return new Promise(async (resolve, reject) => {
            const stats = await fs.promises.stat(filePath);
            const fileHash = await hasha.fromFile(filePath, { algorithm: 'sha256' });
            const lastChunk = Math.ceil(stats.size / this.unitSize) - 1;
            let input = fs.createReadStream(filePath)
            let chunker = new SizeChunker({
                chunkSize: this.unitSize,
                flushTail: true
            });
            let output;
            chunker.on('chunkStart', (id, done) => {
                output = fs.createWriteStream('/tmp/output-' + id);
                done();
            });
            chunker.on('chunkEnd', async (id, done) => {
                output.end();
                if (id === lastChunk) {
                    for (let i = 0; i <= id; i++) {
                        const chunkHash = await hasha.fromFile(`/tmp/output-${i}`, { algorithm: 'sha256' });
                        const stats = await fs.promises.stat(`/tmp/output-${i}`);
                        const chunkSize = i === lastChunk ? stats.size : this.unitSize;
                        const config = {
                            method: 'post',
                            url: `https://www.mediafire.com/api/1.5/upload/resumable.php?folder_key=${folderKey}&response_format=json&session_token=${this.sessionToken}`,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
                                'Content-Type': 'application/octet-stream',
                                'Referer': 'https://app.mediafire.com/',
                                'X-Filesize': stats.size,
                                'X-Filetype': '',
                                'X-Filehash': fileHash,
                                'X-Filename': fileName,
                                'X-Unit-Hash': chunkHash,
                                'X-Unit-Size': chunkSize,
                                'X-Unit-Id': i,
                            },
                            data: fs.createReadStream(`/tmp/output-${i}`)
                        };
                        try {
                            const uploadFileReq = await axios(config);
                            if (uploadFileReq.data.response.message === 'The supplied Session Token is expired or invalid') {
                                this.securityToken = '';
                                this.sessionToken = '';
                                this.cookies = '';
                                await this.login();
                                await this.getSessionToken();
                                const uploadFileReqRepeat = await axios(config);
                                if (uploadFileReqRepeat.data.response.doupload.result !== '0') {
                                    return reject(uploadFileReqRepeat);
                                }
                            }
                            if (uploadFileReq.data.response.doupload.result !== '0') {
                                return reject(uploadFileReq);
                            }
                        }
                        catch (e) {
                            return reject(e);
                        }
                    }
                    done(resolve(true));
                }
                else {
                    done();
                }
            });

            chunker.on('data', (chunk) => {
                output.write(chunk.data);
            });
            input.pipe(chunker);
        });
    }

    async updateFile(filePath, fileName, details) {
        await this.check(filePath, fileName, details.folderKey);
        const stats = await fs.promises.stat(filePath);
        if (stats.size > 4000000) {
            try {
                await this.updateMultiChunks(filePath, fileName, details);
            }
            catch (e) {
                this.debug(e);
                console.log('An error occurred above when attempting to check a file, set DEBUG to true to see a more detailed log of what is going on')
                process.exit(1);
            }
        }
        else {
            const config = {
                method: 'post',
                url: `https://www.mediafire.com/api/1.5/upload/update.php?session_token=${this.sessionToken}&quick_key=${details.quickkey}&response_format=json`,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
                    'Content-Type': 'application/octet-stream',
                    'Referer': 'https://app.mediafire.com/',
                    'X-Filename': fileName,
                    'X-Filesize': stats.size,
                },
                data: fs.createReadStream(filePath)
            };
            try {
                const updateFileReq = await axios(config);
                if (updateFileReq.data.response.doupload.result !== '0') {
                    this.debug(updateFileReq);
                    console.log('An error occurred above when attempting to update a file, set DEBUG to true to see a more detailed log of what is going on')
                    process.exit(1);
                }
            }
            catch (e) {
                this.debug(e);
                console.log('An error occurred above when attempting to update a file, set DEBUG to true to see a more detailed log of what is going on')
                process.exit(1);
            }
        }
    }

    async updateMultiChunks(filePath, fileName, details) {
        return new Promise(async (resolve, reject) => {
            const stats = await fs.promises.stat(filePath);
            const fileHash = await hasha.fromFile(filePath, { algorithm: 'sha256' });
            const lastChunk = Math.ceil(stats.size / this.unitSize) - 1;
            let input = fs.createReadStream(filePath)
            let chunker = new SizeChunker({
                chunkSize: this.unitSize,
                flushTail: true
            });
            let output;
            chunker.on('chunkStart', (id, done) => {
                output = fs.createWriteStream('/tmp/output-' + id);
                done();
            });
            chunker.on('chunkEnd', async (id, done) => {
                output.end();
                if (id === lastChunk) {
                    for (let i = 0; i <= id; i++) {
                        const chunkHash = await hasha.fromFile(`/tmp/output-${i}`, { algorithm: 'sha256' });
                        const stats = await fs.promises.stat(`/tmp/output-${i}`);
                        const chunkSize = i === lastChunk ? stats.size : this.unitSize;
                        const config = {
                            method: 'post',
                            url: `https://www.mediafire.com/api/1.5/upload/resumable.php?&response_format=json&quick_key=${details.quickkey}&session_token=${this.sessionToken}&source_hash=${details.hash}&target_hash=${chunkHash}`,
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36',
                                'Content-Type': 'application/octet-stream',
                                'Referer': 'https://app.mediafire.com/',
                                'X-Filesize': stats.size,
                                'X-Filetype': '',
                                'X-Filehash': fileHash,
                                'X-Filename': fileName,
                                'X-Unit-Hash': chunkHash,
                                'X-Unit-Size': chunkSize,
                                'X-Unit-Id': i,
                            },
                            data: fs.createReadStream(`/tmp/output-${i}`)
                        };
                        try {
                            const updateFileReq = await axios(config);
                            if (updateFileReq.data.response.message === 'The supplied Session Token is expired or invalid') {
                                this.securityToken = '';
                                this.sessionToken = '';
                                this.cookies = '';
                                await this.login();
                                await this.getSessionToken();
                                const updateFileReqRepeat = await axios(config);
                                if (updateFileReqRepeat.data.response.doupload.result !== '0') {
                                    return reject(updateFileReqRepeat);
                                }
                            }
                            if (updateFileReq.data.response.doupload.result !== '0') {
                                return reject(updateFileReq);
                            }
                        }
                        catch (e) {
                            return reject(e);
                        }
                    }
                    done(resolve(true));
                }
                else {
                    done();
                }
            });

            chunker.on('data', (chunk) => {
                output.write(chunk.data);
            });
            input.pipe(chunker);
        });
    }

    parseHtml(content) {
        const splitContent = content.split('security');
        if (splitContent.length < 2) return false;
        if (splitContent[1] === '') return false;
        if (splitContent[1].split('" value="').length < 2) return false;
        if (splitContent[1].split('" value="')[1] === '') return false;
        if (splitContent[1].split('" value="')[1].split('">').length < 2) return false;
        if (splitContent[1].split('" value="')[1].split('">')[0] === '') return false;
        return splitContent[1].split('" value="')[1].split('">')[0];
    }

    setCookies(req) {
        for (let cookie of req.headers['set-cookie']) {
            this.cookies += `${cookie.split(' ')[0]} `;
        }
    }

    debug(e) {
        if (DEBUG) console.log(e);
    }
}
