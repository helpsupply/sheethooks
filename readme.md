# Sheethooks

## Webhooks for monitoring and appending to Google Sheets

## Setup

1. Clone this repository and install the firebase tools (`npm install -g firebase-tools`)
2. Initialize a new firebase project (`firebase init`, configure with Functions, PubSub)
3. Setup a config sheet based on the template (coming soon)
4. Set the sheet ID (the long random string in the URL to be the config sheet by `firebase functions:config:set sheet.config_id="XXXX"`
5. Enable billing (from the project settings) and the Google Apps API for the firebase project (from here https://console.cloud.google.com/apis/library)
6. Find the service account ID from https://console.cloud.google.com/iam-admin/serviceaccounts, it should look like `projectname@appspot.gserviceaccount.com`
7. Share your config sheet and any sheets you would like to sync to/from with this email.
8. `firebase deploy`
