books_sandbox_android
=====================

Proof of concept app for Android viewer

+ Require Android Studio
+ Viewer code should be placed into `books_sandbox_ios/viewer`
+ Sample book should be placed into sdcard with `book` folder name

Notes
-----

+ All other files are all owned by App
+ `ViewerBridge.js` is glue file that Android App will inject into webView during loading, it is not part of viewer
+ iOS will have different `ViewerBridge.js`, it is platform dependent
+ Regardless bridge implementation difference between iOS and Android, viewer API is the same
