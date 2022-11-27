const fs = require('fs');
const { drive } = require('./lib/google');
const { storage } = require('./lib/mega');
const MediaFireApi = require('./utils/mediafire');
const mediaFireApi = new MediaFireApi(process.env.MEDIAFIRE_EMAIL, process.env.MEDIAFIRE_PASSWORD);

module.exports = {
    'google': {
        getFiles: async () => {
            const googleDriveFilesReq = await drive.files.list({
                fileId: process.env.GOOGLE_DRIVE_FOLDER_ID,
                q: `'${process.env.GOOGLE_DRIVE_FOLDER_ID}' in parents`
            });
            return {
                files: googleDriveFilesReq.data.files,
                fileNames: googleDriveFilesReq.data.files.map(file => file.name)
            }
        },
        update: async (file, key) => {
            try {
                await drive.files.update({
                    fileId: file.id,
                    media: {
                        body: fs.createReadStream(`/tmp/${key}`),
                    }
                });
                console.log(`Updated ${key} to google drive`);
            }
            catch (e) {
                console.log(`Failed to upload ${key} to google drive`);
                console.log(e);
            }
        },
        upload: async (key) => {
            try {
                await drive.files.create({
                    requestBody: {
                        name: key,
                        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
                    },
                    media: {
                        body: fs.createReadStream(`/tmp/${key}`),
                    }
                });
                console.log(`Uploaded ${key} to google drive`);
            }
            catch (e) {
                console.log(`Failed to upload ${key} to google drive`);
                console.log(e);
            }
        }
    },

    'mediafire': {
        getFiles: async () => {
            await mediaFireApi.login();
            await mediaFireApi.getSessionToken();
            const content = await mediaFireApi.getContent();
            const folders = content.folder_content.folders.filter((folder) => folder.name === 'Backups')
            if (folders.length !== 1) {
                console.log('Please create a folder called "Backups" in your MediaFire account first.');
                return process.exit(1);
            }
            const backupContent = await mediaFireApi.getContent(folders[0].folderkey, 'files');
            return {
                files: backupContent.folder_content.files,
                fileNames: backupContent.folder_content.files.map(file => file.filename)
            }
        },

        update: async (file, key) => {
            await mediaFireApi.getSessionToken();
            const content = await mediaFireApi.getContent();
            const folders = content.folder_content.folders.filter((folder) => folder.name === 'Backups')
            const fileDetails = {
                'quickkey': file.quickkey,
                'hash': file.hash,
                'folderKey': folders[0].folderkey
            }
            try {
                await mediaFireApi.updateFile(`/tmp/${key}`, file.filename, fileDetails);
                console.log(`Updated ${key} to MediaFire`);
            }
            catch (e) {
                console.log(`Failed to upload ${key} to MediaFire`);
                console.log(e);
            }
        },

        upload: async (key) => {
            await mediaFireApi.getSessionToken();
            const content = await mediaFireApi.getContent();
            const folders = content.folder_content.folders.filter((folder) => folder.name === 'Backups')
            try {
                await mediaFireApi.uploadFile(`/tmp/${key}`, createSafeName(key), folders[0].folderkey);
                console.log(`Uploaded ${key} to MediaFire`);
            }
            catch (e) {
                console.log(`Failed to upload ${key} to MediaFire`);
                console.log(e);
            }
        }
    },

    'mega.nz': {
        getFiles: async () => {
            await storage.ready;
            return {
                files: Object.values(storage.files),
                fileNames: Object.values(storage.files).map(file => file.name)
            }
        },
        update: async (_, key) => {
            await storage.ready;
            try {
                const files = Object.values(storage.files);
                const file = files.filter((fileObj) => fileObj.name === key)[0];
                await file.delete(true);
                await storage.upload({ name: key, allowUploadBuffering: true }, fs.createReadStream(`/tmp/${key}`)).complete;
                console.log(`Updated ${key} to mega.nz`);
            }
            catch (e) {
                console.log(`Failed to update ${key} to mega.nz`);
                console.log(e);
            }
        },
        upload: async (key) => {
            await storage.ready;
            try {
                await storage.upload({ name: key, allowUploadBuffering: true }, fs.createReadStream(`/tmp/${key}`)).complete;
                console.log(`Uploaded ${key} to mega.nz`);
            }
            catch (e) {
                console.log(`Failed to upload ${key}`);
                console.log(e);
            }
        }
    }
}

const createSafeName = (fileName) => {
    while (true) {
        if (!fileName.includes('/')) {
            break;
        }
        else {
            fileName = fileName.replace('/', '_');
        }
    }
    return fileName;
}