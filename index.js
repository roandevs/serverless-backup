const handlers = require('./handlers');
const settings = require('./settings.json');
const aws = require('./lib/aws');
const path = require('path');
const fs = require('fs');

exports.handler = async (event) => {
    for (let handler of settings.enabledHandlers) {
        if (!Object.keys(handlers).includes(handler)) {
            console.log(`Handler ${handler} does not exist in handlers.js!`);
            process.exit(1);
        }
    }
    const objects = await aws.listObjects(); /* Fetch all the objects on the S3 bucket to backup */
    const filesToUpload = settings.filesToUpload.length === 0 ? objects.Contents : objects.Contents.filter((object) => settings.filesToUpload.includes(object.Key));
    const filteredObjects = settings.filesToExclude.length === 0 ? filesToUpload : filesToUpload.filter((object) => !settings.filesToExclude.includes(object.Key));
    for (let content of filteredObjects) {
        await aws.downloadObjectByKey(content.Key);
        for (let handler of settings.enabledHandlers) {
            const { files, fileNames } = await handlers[handler].getFiles();
            if (fileNames.includes(content.Key)) {
                const file = files[fileNames.indexOf(content.Key)];
                await handlers[handler].update(file, content.Key);
            }
            else {
                await handlers[handler].upload(content.Key);
            }
        }
        await fs.promises.rm(path.join(`/tmp/${content.Key}`), { recursive: true });
    }
}
