# ☁️ Serverless Backup - My personal serverless backup system

## Information

- This is a completely serverless-based backup system which utilizes serverless technologies to backup my everyday files to multiple cloud providers.

- The idea is that your S3 bucket would be setup to be auto-mounted on your desktop on bootup using [rclone](https://rclone.org/) and would be treated like it's another hard drive on your filesystem. Then every 24 hours using AWS EventBridge, you can execute this code in Lambda which will connect to your S3 bucket with the right credentials and automatically back them up to multiple cloud providers, even if your desktop is offline or not available, as the S3 bucket is hosted by AWS and the execution through Lambda is handled by AWS.

- The reason for using multiple providers is so that you don't rely on just one and have at-least one guaranteed backup incase a provider goes down or you lose access to an account that hosted your backups. You also don't have to maintain a server for your backups, as the serverless framework by AWS takes care of that.

- Technologies involve using: AWS S3 buckets for initially storing my files, AWS Lambda for transferring the files across multiple cloud providers & AWS EventBridge for periodically executing the backup process every 24 hours.

## Features & Limitations

- Built in handler system to allow the execution of backing your files up to different cloud providers. By default, there are handlers for your files to be backed up to google drive, mediafire and mega.nz. You can of course extend this or specify in settings.json which providers you want and don't want to use. 

- Configurable settings to specify which providers you want to use, which files you want and don't want backed up within the process.

- This was built originally with the aim to be ran and used with no operating costs, so obviously this comes with AWS' limit of 5GB of size on your S3 bucket for free, after that it costs around $0.023 per GB you use, more information can be found about that [here](https://aws.amazon.com/s3/pricing/). Other services such as Lambda have limiitations too, but they would not be exceeded in this use-case. 

- Lambda initially is designed to have a maximum execution time of 15 minutes, so if your file is too big or/and you're using a provider that has slow download speeds, then you may want to use the settings file to specify which files you want and don't want uploaded, then you can also make a seperate Lambda functions to handle the big files on its own.


## Brief Setup Instructions

1. Create an AWS account, then proceed with creating an S3 bucket and setting up programmatic access via IAM. See [this example](https://medium.com/@shamnad.p.s/how-to-create-an-s3-bucket-and-aws-access-key-id-and-secret-access-key-for-accessing-it-5653b6e54337) for more on how to do this.

2. Setup rclone to auto-mount your S3 bucket on bootup and treat it like as if it's another hard-drive. See [this example](https://www.nakivo.com/blog/mount-amazon-s3-as-a-drive-how-to-guide/) for more on how to do this.


3. Setup programmatic access to your cloud providers i.e. for Google Drive you may want to follow [this example](https://blog.tericcabrel.com/upload-file-to-google-drive-with-nodejs/). For [mega.nz](https://mega.nz) and [MediaFire](https://mediafire.com), all you have to do is register an account and set the email and password in your environment variables.

4. Create a Lambda function, set the Runtime to Node.js 16.x. Go to the configuration section and edit the general configuration to have 10240 MB for Ephemeral storage, 3008 MB for Memory and the timeout to to 15 minutes. You can change this to your needs, depending on how many files you are backing up and their sizes, however use the values I specified if you're unsure as they're the maximum. 

5. In the configuration tab, go to the environment variables section and set the environment variables. Below this instructions section is a table with all the environment variables used within this project, set the necessary ones for your use-case. 

6. On your local machine, clone this repository, install node & npm, go to the directory where this repository is and run `npm install`, then create a zip with all the files in the directory inside of the zip. Go back to Lambda's console and on the code tab, click upload from a .zip file and attach the zip. 

7. in Lambda, go to the Test tab and click the Test button to see if the backup process works. You can use [AWS CloudWatch](https://aws.amazon.com/cloudwatch/) to monitor what files are being uploaded at the moment and to discover if anything goes wrong.

8. If step 7 was successful, then head to AWS EventBridge, go to the rules section and create a new rule that runs on a schedule/regular rate, i.e. every 24 hours. Then set the target to a Lambda function, and choose your function that you created earlier. Then proceed and create the rule, this should then execute your backup process every so often, depending on the rate you set. 

## Environment Variables (to set in your Lambda function)


#### You only have to set the environment variables for the providers *you* are using, i.e. if you are using mega.nz only, you do not have to configure the values for any google-related environment variables or mediafire related variables, however the **S3** ones are always required to be filled out.

| Variable Name | Value |
| ------------- | ------------- |
| S3_BUCKET_NAME | The name of your S3 bucket tied to your account, see [this example](https://medium.com/@shamnad.p.s/how-to-create-an-s3-bucket-and-aws-access-key-id-and-secret-access-key-for-accessing-it-5653b6e54337) for more on how to create & fetch this. |
| S3_REGION | The region of where your S3 bucket is located in, you would of set this while creating your S3 bucket, however it's also possible to fetch this info from AWS S3's management panel. |
| S3_ACCESS_KEY_ID | Your access key ID for your S3 bucket which can be setup with IAM on AWS, see [this example](https://medium.com/@shamnad.p.s/how-to-create-an-s3-bucket-and-aws-access-key-id-and-secret-access-key-for-accessing-it-5653b6e54337) for more on how to create & fetch this. |
| S3_SECRET_ACCESS_KEY | Your secret access key for your S3 bucket which can be setup with IAM on AWS, see [this example](https://medium.com/@shamnad.p.s/how-to-create-an-s3-bucket-and-aws-access-key-id-and-secret-access-key-for-accessing-it-5653b6e54337) for more on how to create & fetch this. |
| GOOGLE_CLIENT_ID  | Your google app client ID, see [this example](https://blog.tericcabrel.com/upload-file-to-google-drive-with-nodejs/) for more on how to create & fetch this. |
| GOOGLE_CLIENT_ID  | Your google app client ID, see [this example](https://blog.tericcabrel.com/upload-file-to-google-drive-with-nodejs/) for more on how to create & fetch this. |
| GOOGLE_CLIENT_SECRET  | Your google app client secret, see [this example](https://blog.tericcabrel.com/upload-file-to-google-drive-with-nodejs/) for more on how to create & fetch this. |
| GOOGLE_DRIVE_FOLDER_ID  | The folder ID of where your backed up files are going to, you can create this folder in Google Drive's [Web UI](https://drive.google.com) and once you enter the folder, it's normally specified in the URL bar after '/drive/folders/' |
| GOOGLE_REFRESH_TOKEN  | Your google app refresh token, see [this example](https://blog.tericcabrel.com/upload-file-to-google-drive-with-nodejs/) for more on how to create & fetch this. |
| MEDIAFIRE_EMAIL  | Your email for your MediaFire account, used within MediaFire's web authentication protocol. See my implementation of interacting with MediaFire's API [here](https://gist.github.com/roandevs/7849b567011874283cf3e01f940a1609). |
| MEDIAFIRE_PASSWORD  | Your password for your MediaFire account, used within MediaFire's web authentication protocol. See my implementation of interacting with MediaFire's API [here](https://gist.github.com/roandevs/7849b567011874283cf3e01f940a1609). |
| MEGA_EMAIL  | Your email for your mega.nz account, used within mega.nz's authentication protocol. See the implementation of interacting with mega.nz's API [here](https://mega.js.org/). |
| MEGA_PASSWORD  | Your password for your mega.nz account, used within mega.nz's authentication protocol. See the implementation of interacting with mega.nz's API [here](https://mega.js.org/). |

## Settings (settings.json)

| Name  | Editing Required | Value |
| ------------- | ------------- | ------------- |
| enabledHandlers  | Yes  | Set the providers you want to utilize in the form of an array i.e. `['google', 'mega.nz', 'mediafire']` or any of your own that you have implemented. They must be available in handlers.js or the execution of the code will stop once the code detects that this handler is not found. |
| filesToUpload  | No  | Specify which files you want to upload in the form of an array i.e. `['File1', 'File2', 'ImportantFile']`, if you want to choose specific ones out of many files on the S3 bucket. By default, if the array is empty, it will use ALL the files.  |
| filesToExclude  | No  | Specify which files you do not want to upload in the form of an array i.e. `['plaintextpasswords.txt', 'averybigfile.zip']`, if you want to exclude a specific file out of many files on the S3 bucket. By default, if the array is empty, it will just use the files that was selected to upload based on `filesToUpload`.  |


## Plans

- Make a desktop app that has a clean and easy to use UI that lets a user specify their configuration, AWS account and then proceeds to auto setup the S3 buckets, installs and uses rclone to mount your S3 bucket, auto publishes your Lambda function and sets up your EventBridge rule to auto backup your files, all done with minimal user interaction.
