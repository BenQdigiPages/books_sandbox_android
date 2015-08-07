books_sandbox_android
=====================

Proof of concept app for Android viewer

+ Require Android Studio
+ Viewer code should be placed into `books_sandbox_ios/viewer`
+ Sample books should be placed into `books_sandbox_ios/books`
    + epub file should be in `.epub` format, sanbox will unzip file file if necessary
    + pdf file need to be packaged with `.epub` format, and with `.pdf.epub` suffix

Notes
-----

+ All other files are all owned by App
+ `ViewerBridge.js` is glue file that Android App will inject into webView during loading, it is not part of viewer
+ iOS will have different `ViewerBridge.js`, it is platform dependent
+ Regardless bridge implementation difference between iOS and Android, viewer API is the same
