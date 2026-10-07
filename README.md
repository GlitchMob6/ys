# YouTube Subscription Gate

A lightweight, mobile-responsive subscription-gate web application.

## Flow

1. User visits the page and sees **Subscribe First**.
2. Clicking the button opens your YouTube channel subscribe page in a new tab (or the native YouTube app on mobile).
3. User subscribes on YouTube and returns to the tab.
4. The page detects their return and unlocks **Click Here to Access**.
5. Clicking the access button directs them to the target Google Drive link.

## Configuration

Edit `config.js`:

```javascript
const CONFIG = Object.freeze({
  YOUTUBE_SUBSCRIBE_URL: "https://www.youtube.com/@YOUR_CHANNEL?sub_confirmation=1",
  GOOGLE_DRIVE_URL: "https://drive.google.com/drive/folders/YOUR_FOLDER_ID"
});
```

## Running Locally

Serve the directory with any static server:

```bash
npx serve .
```
