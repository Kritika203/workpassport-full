# WorkShield browser extension (separate source folder)

This is a Manifest V3 extension. It never scans pages in the background or requires users to share their WorkPassport password.

## Use

1. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select this `extension` folder.
2. Select text on a job posting/message and click the WorkShield toolbar icon; use **Use selected text** or manually paste text. Local rules work without a network connection.
3. To save checks, evidence and external job bookmarks in a private WorkPassport account, log into the WorkPassport website and open **Extension**, click **Generate pairing code**, then enter the one-time code and website-provided **API address** into the extension. Chrome asks you to approve only that API origin. You can revoke any paired browser from the website.
4. Once paired, the **Open WorkPassport** button uses the frontend website URL reported by the backend, not a hardcoded localhost address. Make sure the backend's `WEB_FRONTEND_URL` setting is correct when deployed.

## Privacy and limits

- User-initiated checks are processed locally, and when paired also sent to WorkPassport; a short excerpt and warnings are saved in private check history. The full text is only stored as evidence if the user chooses to save proof.
- The extension keeps small local history/proof/bookmark caches in `chrome.storage.local`. Removing browser copies does **not** delete copies that were previously saved in the account, and vice versa.
- The popup's **Disconnect** deletes its local credential. To revoke an issued credential from the server, use **Remove access** on the website's Extension page.
- External job bookmarks are **not verified jobs**. The scorer is experimental and cannot guarantee that a message or job is safe.
- Install from an unpacked folder for the hackathon; do not claim the extension is published in the Chrome Web Store.
