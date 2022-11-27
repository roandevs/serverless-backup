const aws = require('aws-sdk');
const path = require('path');
const fs = require('fs');

const s3 = new aws.S3({
    accessKeyId: process.env.S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
    region: process.env.S3_REGION,
});

module.exports.listObjects = async () => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
    };
    return new Promise((resolve, reject) => {
        s3.listObjects(params, (err, data) => {
            if (err) {
                return reject(err);
            }
            return resolve(data);
        });
    });
}

module.exports.downloadObjectByKey = async (key) => {
    const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
    };
    const dirname = path.dirname(`/tmp/${key}`);
    try {
        await fs.promises.access(dirname);
    }
    catch (e) {
        await fs.promises.mkdir(dirname, { recursive: true });
    }
    const tempPath = fs.createWriteStream(path.join('/tmp/', `${key}`));
    return new Promise((resolve, _) => {
        s3.getObject(params).createReadStream().pipe(tempPath).on("close", (e) => {
            return resolve();
        });
    });
}

