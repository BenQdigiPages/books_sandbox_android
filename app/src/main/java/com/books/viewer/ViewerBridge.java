//***************************************************************************
//* Written by Steve Chiu <steve.chiu@benq.com>
//* BenQ Corporation, All Rights Reserved.
//*
//* NOTICE: All information contained herein is, and remains the property
//* of BenQ Corporation and its suppliers, if any. Dissemination of this
//* information or reproduction of this material is strictly forbidden
//* unless prior written permission is obtained from BenQ Corporation.
//***************************************************************************

package com.books.viewer;

import android.annotation.TargetApi;
import android.app.AlertDialog;
import android.content.Context;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.Handler;
import android.text.TextUtils;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class ViewerBridge {
    private static final String TAG = "ViewerBridge";
    private static final boolean USE_NATIVE_API = true;
    private static final boolean IS_LEGACY = !USE_NATIVE_API || Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP;

    // This is for sandbox only, sandbox has direct mapping from ROOT_URI to ROOT_DIR
    //Environment.getExternalStorageState() //fail

    //System.getenv("EXTERNAL_STORAGE")

    //adb shell 'echo ${SECONDARY_STORAGE%%:*}'
    //ex: veneno: /storage/sdcard1
    String secondaryStorage = System.getenv("SECONDARY_STORAGE");
    public static final File ROOT_DIR = new File(System.getenv("SECONDARY_STORAGE"), "books");
    public static final Uri ROOT_URI = Uri.parse("http://fake.benqguru.com/books/");
    public static final File ROOTVIEWER_DIR = new File(System.getenv("SECONDARY_STORAGE"), "viewer");
    private static final Uri ROOTVIEWER_URI = ROOT_URI.buildUpon().path("/(ROOTVIEWER)/").build();
    private static final Uri ASSETS_URI = ROOT_URI.buildUpon().path("/(ASSETS)/").build();

    public static final String LAYOUT_SINGLE = "single";
    public static final String LAYOUT_SIDE_BY_SIDE = "side_by_side";
    public static final String LAYOUT_CONTINUOUS = "continuous";

    private ViewerActivity mScene;
    private WebView mWebView;
    private Handler mHandler = new Handler();

    private String mBookUri;
    private boolean mIsPdf;
    private boolean mIsLibraryLoaded;
    private HashMap<String, Runnable> mLoadUrlCallbacks = new HashMap<String, Runnable>();

    private int mEvalToken = 1;
    private HashMap<Integer, ValueCallback<String>> mEvalCallbacks = new HashMap<Integer, ValueCallback<String>>();

    public ViewerBridge(ViewerActivity scene, WebView webView) {
        JavascriptCallback mJavascriptInterface = new JavascriptCallback();
        WebChromeClient mWebChromeClient = new WebChromeClient();
        mScene = scene;
        mWebView = webView;

        WebSettings settings = mWebView.getSettings();
        settings.setAppCacheEnabled(false);
        settings.setJavaScriptEnabled(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        //[Bruce] Enable webView Database to let javascript access the localStorage
        settings.setDatabaseEnabled(true);
        String dir = mScene.getApplicationContext().getDir("database", Context.MODE_PRIVATE).getPath();
        settings.setDatabasePath(dir);
        settings.setDomStorageEnabled(true);
        //End : [Bruce]

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            if (0 != (mScene.getApplicationInfo().flags &= ApplicationInfo.FLAG_DEBUGGABLE)) {
                mWebView.setWebContentsDebuggingEnabled(true);
            }
        }

        mWebView.addJavascriptInterface(mJavascriptInterface, "_App");
        mWebView.setWebViewClient(mWebViewClient);
        mWebView.setWebChromeClient(mWebChromeClient);
    }

    private void loadUrl(String url, Runnable callback) {
        synchronized (mLoadUrlCallbacks) {
            mLoadUrlCallbacks.put(url, callback);
        }
        mWebView.loadUrl(url);
    }

    private String loadAssetAsString(String name) {
        try {
            InputStream in = mScene.getAssets().open(name);
            ByteArrayOutputStream buf = new ByteArrayOutputStream();
            try {
                byte[] temp = new byte[1024];
                while (true) {
                    int len = in.read(temp, 0, temp.length);
                    if (len < 0) break;
                    buf.write(temp, 0, len);
                }
                return buf.toString("UTF-8");
            } finally {
                in.close();
            }
        } catch (Exception e) {
            Log.e(TAG, "fail to load asset: " + name, e);
            return "";
        }
    }

    @TargetApi(Build.VERSION_CODES.KITKAT)
    private void _eval(String script, ValueCallback<String> callback) {
        mWebView.evaluateJavascript(script, callback);
    }

    public <T> void eval(String script, final ValueCallback<T> handler) {
        ValueCallback<String> callback = null;
        if (handler != null) {
            callback = new ValueCallback<String>() {
                public void onReceiveValue(String result) {
                    try {
                        JSONTokener tokener = new JSONTokener(result);
                        Object value = tokener.nextValue();
                        handler.onReceiveValue((T) value);
                    } catch (Exception e) {
                        Log.w(TAG, "fail to convert callback result", e);
                        handler.onReceiveValue(null);
                    }
                }
            };
        }

        if (USE_NATIVE_API && Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            _eval(script, callback);
        } else if (callback != null) {
            int token;
            synchronized (mEvalCallbacks) {
                token = mEvalToken++;
                mEvalCallbacks.put(token, callback);
            }
            script = "JSON.stringify(" + script + ")";
            mWebView.loadUrl("javascript:App.onDispatchResult(" + token + ", " + script + ")");
        } else {
            mWebView.loadUrl("javascript:" + script);
        }
    }

    ///
    /// Load ebook from server url
    /// App will act as transparent proxy, and provides offline content
    /// if available
    ///
    /// App may request legacy mode, which can not handle partial GET.
    /// If legacy mode is activated, Viewer should put "Range" header in
    /// query parameter "_Range_", and issue normal HTTP GET request.
    ///
    /// @url: string - base url of ebook
    /// @legacy: bool - true if legacy mode is needed
    ///
    public void loadBook(final String url, boolean isPdf) {
        mBookUri = url;

        if (mIsLibraryLoaded && mIsPdf == isPdf) {
            reloadBook();
            return;
        }

        mIsPdf = isPdf;

        loadUrl("about:blank", new Runnable() {
            public void run() {
                String libraryUrl = ASSETS_URI.toString();
                if(ROOTVIEWER_DIR != null && ROOTVIEWER_DIR.exists()) {
                    libraryUrl = ROOTVIEWER_URI.toString();
                }
                if (mIsPdf) {
                    libraryUrl += "pdf/index.html";
                } else {
                    libraryUrl += "epub/index.html";
                }

                loadUrl(libraryUrl, new Runnable() {
                    public void run() {
                        eval(loadAssetAsString("ViewerBridge.js"), null);
                        mIsLibraryLoaded = true;

                        reloadBook();
                    }
                });
            }
        });
    }

    private void reloadBook() {
        eval("Viewer.loadBook(\"" + mBookUri + "\", " + IS_LEGACY + ")", null);
    }

    ///
    /// Set the text appearance
    ///
    /// @text_size: int - in pt unit
    /// @[r, g, b] - text color
    ///
    public void setTextAppearance(int text_size, int text_color) {
        int r = Color.red(text_color);
        int g = Color.green(text_color);
        int b = Color.blue(text_color);
        eval("Viewer.setTextAppearance(" + text_size + ", [" + r + ", " + g + ", " + b + "])", null);
    }

    ///
    /// Set page background color
    ///
    /// @[r, g, b] - page background color
    ///
    public void setBackgroundColor(int color) {
        int r = Color.red(color);
        int g = Color.green(color);
        int b = Color.blue(color);
        eval("Viewer.setBackgroundColor([" + r + ", " + g + ", " + b + "])", null);
    }

    ///
    /// Set page background image
    ///
    /// @image_url - page background image url
    ///
    public void setBackgroundImage(String image_url) {
        eval("Viewer.setBackgroundImage(\"" + image_url + "\")", null);
    }

    ///
    /// Get an array of available page layout modes for this book
    ///
    /// @mode: string - either "single", "side_by_side" or "continuous"
    ///
    public void getAvailableLayoutModes(final ValueCallback<String[]> callback) {
        eval("Viewer.getAvailableLayoutModes()", new ValueCallback<JSONArray>() {
            public void onReceiveValue(JSONArray json) {
                try {
                    ArrayList<String> list =  new ArrayList<String>();
                    for (int i = 0; i < json.length(); i++) {
                        list.add(json.getString(i));
                    }
                    callback.onReceiveValue(list.toArray(new String[list.size()]));
                } catch (Exception e) {
                    Log.w(TAG, "fail to parse Viewer.getAvailableLayoutModes", e);
                    callback.onReceiveValue(new String[0]);
                }
            }
        });
    }

    ///
    /// Get current page layout mode
    ///
    /// @mode: string - either "single", "side_by_side" or "continuous"
    ///
    public void getLayoutMode(ValueCallback<String> callback) {
        eval("Viewer.getLayoutMode()", callback);
    }

    ///
    /// Set page layout mode
    ///
    /// @mode: string - either "single", "side_by_side" or "continuous"
    ///
    public void setLayoutMode(String mode) {
        eval("Viewer.setLayoutMode(\"" + mode + "\")", null);
    }

    ///
    /// Get current position in the ebook
    ///
    /// @chapter: string - an opaque to represent current chapter
    /// @cfi: string - epub cfi
    /// @current_page: int - page number of current page
    /// @total_pages: int - total number of pages
    ///
    /// Viewer.getCurrentPosition() -> [chapter, cfi, current_page, total_pages]
    ///
    public void getCurrentPosition(final ValueCallback<Object[]> callback) {
        eval("Viewer.getCurrentPosition()", new ValueCallback<JSONArray>() {
            public void onReceiveValue(JSONArray json) {
                try {
                    callback.onReceiveValue(new Object[] {
                            json.getString(0),
                            json.getString(1),
                            json.getInt(2),
                            json.getInt(3),
                    });
                } catch (Exception e) {
                    Log.w(TAG, "fail to parse Viewer.getCurrentPosition", e);
                    callback.onReceiveValue(null);
                }
            }
        });
    }

    ///
    /// Goto the given link in this ebook
    ///
    /// @link: string - target file link (relative to base url)
    ///
    public void gotoLink(String link) {
        eval("Viewer.gotoLink(\"" + link + "\")", null);
    }

    ///
    /// Goto the given position in this ebook
    ///
    /// @cfi: string - epub cfi
    ///
    public void gotoPosition(String cfi) {
        eval("Viewer.gotoPosition(\"" + cfi + "\")", null);
    }

    ///
    /// Toggle the bookmark in the current page.
    ///
    /// If a valid tag is specified, viewer should call App.onAddBookmark
    /// or App.onUpdateBookmark in response.
    ///
    /// If null is specified, viewer should call App.onRemoveBookmark in response,
    /// or do nothing if there is currently no bookmark
    ///
    /// @tag: string or null
    ///     tag - the bookmark tag type
    ///     null - to remove current bookmark
    /// @image_url: tag image url or null
    public void setBookmark(String tag, String tag_image_url) {
        eval("Viewer.toggleBookmark(\"" + tag + "\", \"" + tag_image_url + "\")", null);
    }

    public void removeBookmark() {
        eval("Viewer.toggleBookmark(null, null)", null);
    }

    ///
    /// Search text and mark the found text, the search is case-insensitive
    /// viewer should call App.onSearchFound in response
    ///
    /// @keyword: string or null - the keyword to be found,
    ///     or null to cancel search mode
    ///
    public void startSearch(String keyword) {
        keyword = keyword.replace("\"", "\\\"");
        eval("Viewer.searchText(\"" + keyword + "\")", null);
    }

    public void stopSearch() {
        eval("Viewer.searchText(null)", null);
    }

    public class JavascriptCallback {
        @JavascriptInterface
        public void onDispatchResult(int token, final String result) {
            final ValueCallback<String> callback;
            synchronized (mEvalCallbacks) {
                callback = mEvalCallbacks.remove(token);
            }
            if (callback != null) {
                mHandler.post(new Runnable() {
                    public void run() {
                        callback.onReceiveValue(result);
                    }
                });
            }
        }

        ///
        /// Notify App current title is changed
        ///
        /// @title: string - title to be shown on toolbar
        ///
        @JavascriptInterface
        public void onChangeTitle(final String title) {
            mHandler.post(new Runnable() {
                public void run() {
                    mScene.setTitle(title);
                }
            });
        }

        ///
        /// Notify App current table of content is changed
        ///
        /// @[toc_entry, ...]: array - an json array to the TOC entry
        ///
        @JavascriptInterface
        public void onChangeTOC(final String toc_json) {
            mHandler.post(new Runnable() {
                public void run() {
                    try {
                        mScene.setTableOfContent(new JSONArray(toc_json));
                    } catch (Exception e) {
                        Log.w(TAG, "fail to setTableOfContent = " + toc_json, e);
                    }
                }
            });
        }

        ///
        /// Notify App current view frame is changed
        /// This is needed for PDF annotation
        /// Content offset is the relative position (after scaling) to the top-left corner.
        /// Content offset (x: -10, y: -20) will make top edge 20 pixels off-screen,
        /// left edge 10 pixels off-screen
        ///
        /// @offset_x: number - content offset x
        /// @offset_y: number - content offset y
        /// @scale: number - scale of content view, 1.0 is original size
        ///
        @JavascriptInterface
        public void onChangeView(int offset_x, int offset_y, double scale) {

        }

        ///
        /// Notify App current page is changed to different page
        ///
        /// @chapter: string - an opaque to represent current chapter
        /// @cfi: string - epub cfi
        /// @current_page: int - page number of current page
        /// @total_pages: int - total number of pages
        ///
        @JavascriptInterface
        public void onChangePage(String chapter, String cfi, int current, int total) {
            Log.i(TAG, "onChangePage chapter=" + chapter + ", cfi=" + cfi + ", " + current + " / " + total);
        }

        ///
        /// Notify App user action for tracking
        ///
        /// @action: string - tracking "action" as defined in doc
        /// @cfi: string - tracking "cfi" as defined in doc, may be empty for some action
        ///
        @JavascriptInterface
        public void onTrackAction(String action, String cfi) {
            Log.i(TAG, "onTrackAction action=" + action + ", cfi=" + cfi);
        }

        ///
        /// Notify App to show or hide toolbar
        ///
        /// @visible: bool - set visibility of tool bar
        ///
        @JavascriptInterface
        public void onToggleToolbar(final boolean visible) {
            mHandler.post(new Runnable() {
                public void run() {
                    mScene.setTitleVisible(visible);
                }
            });
        }

        // dummy database
        private HashMap<String, Object[]> mHighlights = new HashMap<String, Object[]>();

        ///
        /// Request App to load highlights for the chapter, App will call callback in response
        /// The callback will receive an array of json object to represent highlights
        ///
        ///     function callback([highlight, ...])
        ///
        /// @chapter: string - an opaque to represent current chapter
        /// @callback: string - name of callback function (can be object member function)
        ///     do not pass function itself, only name (as string) is needed;
        ///     and the function must be accessable from global space
        ///
        @JavascriptInterface
        public void onRequestHighlights(String chapter, final String callback) {
            final JSONArray list = new JSONArray();

            synchronized (mHighlights) {
                for (String key : mHighlights.keySet()) {
                    Object[] item = mHighlights.get(key);
                    String item_chapter = (String) item[0];
                    JSONObject item_highlight = (JSONObject) item[1];
                    if (item_chapter.equals(chapter)) {
                        list.put(item_highlight);
                    }
                }
            }

            // should run in async
            mHandler.post(new Runnable() {
                public void run() {
                    eval(callback + "(" + list.toString() + ")", null);
                }
            });
        }

        ///
        /// Notify App the given highlight need to be added, App will call callback in response
        /// The callback will receive the UUID of new highlight just created
        ///
        ///     function callback(uuid)
        ///
        /// @chapter: string - an opaque to represent current chapter
        /// @highlight - an json object to represent highlight, uuid is absent in this case
        /// @callback: string - name of callback function (can be object member function);
        ///     do not pass function itself, only name (as string) is needed;
        ///     and the function must be accessable from global space
        ///
        @JavascriptInterface
        public void onAddHighlight(String chapter, String highlight_json, final String callback) {
            try {
                JSONObject highlight = new JSONObject(highlight_json);
                final String uuid = UUID.randomUUID().toString();

                synchronized (mHighlights) {
                    mHighlights.put(uuid, new Object[] { chapter, highlight });
                }

                // should run in async
                mHandler.post(new Runnable() {
                    public void run() {
                        eval(callback + "(\"" + uuid + "\")", null);
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "fail onAddHighlight = " + highlight_json, e);
            }
        }

        ///
        /// Notify App the given highlight need to be updated
        ///
        /// @highlight - an json object to represent highlight
        ///
        @JavascriptInterface
        public void onUpdateHighlight(String highlight_json) {
            try {
                JSONObject highlight = new JSONObject(highlight_json);
                String uuid = highlight.getString("uuid");

                synchronized (mHighlights) {
                    Object[] item = mHighlights.get(uuid);
                    if (item != null) {
                        item[1] = highlight;
                    } else {
                        Log.w(TAG, "highlight not found = " + highlight.toString());
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "fail onUpdateHighlight = " + highlight_json, e);
            }
        }

        ///
        /// Notify App the given highlight need to be deleted
        ///
        /// @uuid - uuid of the highlight
        ///
        @JavascriptInterface
        public void onRemoveHighlight(String uuid) {
            synchronized (mHighlights) {
                mHighlights.remove(uuid);
            }
        }

        ///
        /// Notify App the given highlight need to be shared, App will popup sharing dialog
        ///
        /// @uuid - uuid of the highlight
        ///
        @JavascriptInterface
        public void onShareHighlight(final String uuid) {
            mHandler.post(new Runnable() {
                public void run() {
                    new AlertDialog.Builder(mScene)
                            .setTitle("onShareHighlight")
                            .setMessage("uuid=" + uuid)
                            .show();
                }
            });
        }

        ///
        /// Notify App the given highlight need to be annotated, App will popup edit window
        ///
        /// @uuid - uuid of the highlight
        ///
        @JavascriptInterface
        public void onAnnotateHighlight(final String uuid) {
            mHandler.post(new Runnable() {
                public void run() {
                    new AlertDialog.Builder(mScene)
                            .setTitle("onAnnotateHighlight")
                            .setMessage("uuid=" + uuid)
                            .show();
                }
            });
        }

        // dummy database
        private HashMap<String, Object[]> mBookmarks = new HashMap<String, Object[]>();

        ///
        /// Request App to load bookmark for the chapter, App will call callback in response
        /// The callback will receive an array of json object to represent bookmarks
        ///
        ///     function callback([bookmark, ...])
        ///
        /// @chapter: string - an opaque to represent current chapter
        /// @callback: string - name of callback function (can be object member function);
        ///     do not pass function itself, only name (as string) is needed;
        ///     and the function must be accessable from global space
        ///
        @JavascriptInterface
        public void onRequestBookmarks(String chapter, final String callback) {
            final JSONArray list = new JSONArray();

            synchronized (mBookmarks) {
                for (String key : mBookmarks.keySet()) {
                    Object[] item = mBookmarks.get(key);
                    String item_chapter = (String) item[0];
                    JSONObject item_bookmark = (JSONObject) item[1];
                    if (item_chapter.equals(chapter)) {
                        list.put(item_bookmark);
                    }
                }
            }

            // should run in async
            mHandler.post(new Runnable() {
                public void run() {
                    eval(callback + "(" + list.toString() + ")", null);
                }
            });
        }

        ///
        /// Notify App the given bookmark need to be added, App will call callback in response
        /// The callback will receive the UUID of new bookmark just created
        ///
        ///     function callback(uuid)
        ///
        /// @chapter: string - an opaque to represent current chapter
        /// @bookmark - an json object to represent bookmark, uuid is absent in this case
        /// @callback: string - name of callback function (can be object member function);
        ///     do not pass function itself, only name (as string) is needed;
        ///     and the function must be accessable from global space
        ///
        @JavascriptInterface
        public void onAddBookmark(String chapter, String bookmark_json, final String callback) {
            try {
                JSONObject bookmark = new JSONObject(bookmark_json);
                final String uuid = UUID.randomUUID().toString();

                synchronized (mBookmarks) {
                    mBookmarks.put(uuid, new Object[] { chapter, bookmark });
                }

                // should run in async
                mHandler.post(new Runnable() {
                    public void run() {
                        eval(callback + "(\"" + uuid + "\")", null);
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "fail onAddBookmark = " + bookmark_json, e);
            }
        }

        ///
        /// Notify App the given bookmark need to be updated
        ///
        /// @bookmark - an json object to represent bookmark
        ///
        @JavascriptInterface
        public void onUpdateBookmark(String bookmark_json) {
            try {
                JSONObject bookmark = new JSONObject(bookmark_json);
                synchronized (mBookmarks) {
                    String uuid = bookmark.getString("uuid");
                    Object[] item = mBookmarks.get(uuid);
                    if (item != null) {
                        item[1] = bookmark;
                    } else {
                        Log.w(TAG, "bookmark not found = " + bookmark.toString());
                    }
                }
            } catch (Exception e) {
                Log.w(TAG, "fail onUpdateBookmark = " + bookmark_json, e);
            }
        }

        ///
        /// Notify App the given bookmark need to be deleted
        ///
        /// @uuid - uuid of the bookmark
        ///
        @JavascriptInterface
        public void onRemoveBookmark(String uuid) {
            synchronized (mBookmarks) {
                mBookmarks.remove(uuid);
            }
        }

        ///
        /// Notify App the search result is found
        /// View can call this multiple times until App call Viewer.searchText(null)
        ///
        /// @keyword - the search keyword
        /// @result - an json object to represent search result
        ///
        @JavascriptInterface
        public void onSearchResult(final String keyword, final String result_json) {
            mHandler.post(new Runnable() {
                public void run() {
                    try {
                        JSONArray result = new JSONArray(result_json);

                        // FIXME: do something useful other than this
                        Log.i(TAG, "onSearchResult(" + keyword + ") = " + result.toString());
                    } catch (Exception e) {
                        Log.i(TAG, "fail onSearchResult(" + keyword + ") = " + result_json, e);
                    }
                }
            });
        }
    }

    WebViewClient mWebViewClient = new WebViewClient() {
        @Override
        public void onPageFinished(WebView view, String uri) {
            super.onPageFinished(view, uri);

            final Runnable callback;
            synchronized (mLoadUrlCallbacks) {
                callback = mLoadUrlCallbacks.remove(uri);
            }

            if (callback != null) {
                mHandler.post(callback);
            }
        }

        private boolean isRelativeUri(Uri prefixUri, Uri uri) {
            if (!TextUtils.equals(prefixUri.getScheme(), uri.getScheme())) return false;
            if (!TextUtils.equals(prefixUri.getAuthority(), uri.getAuthority())) return false;

            List<String> seg = uri.getPathSegments();
            List<String> prefixSeg = prefixUri.getPathSegments();

            final int prefixSize = prefixSeg.size();
            if (seg.size() < prefixSize) return false;

            for (int i = 0; i < prefixSize; i++) {
                if (!prefixSeg.get(i).equals(seg.get(i))) {
                    return false;
                }
            }

            return true;
        }

        private String getMimeType(Uri uri) {
            String extension = MimeTypeMap.getFileExtensionFromUrl(uri.toString());
            if (extension != null) {
                return MimeTypeMap.getSingleton().getMimeTypeFromExtension(extension);
            } else {
                return "application/octet-stream";
            }
        }

        private WebResourceResponse loadAssetUri(WebView view, Uri uri, String range) {
            HashMap<String, String> headers = new HashMap<String, String>();
            String mimeType = getMimeType(uri);

            try {
                String path;
                InputStream inputStream;
                if(ROOTVIEWER_DIR != null && ROOTVIEWER_DIR.exists()) {
                    path = uri.getPath().substring(ROOTVIEWER_URI.getPath().length());
                    File dir = new File(ViewerBridge.ROOTVIEWER_DIR, path);
                    inputStream = new FileInputStream(dir);
                }
                else {
                    path = uri.getPath().substring(ASSETS_URI.getPath().length());
                    inputStream = mScene.getAssets().open(path);
                }
                headers.put("Cache-Control", "no-cache");

                return createResponse(mimeType, 200, "OK", headers, inputStream);
            } catch (Exception e) {
                Log.w(TAG, "fail to read asset", e);
                return createResponse(mimeType, 404, "Not found", headers, null);
            }
        }

        private WebResourceResponse loadBookUri(WebView view, Uri uri, String range) {
            HashMap<String, String> headers = new HashMap<String, String>();
            String mimeType = getMimeType(uri);

            try {
                String path = uri.getPath().substring(ROOT_URI.getPath().length());
                File file = new File(ROOT_DIR, path);

                if (!file.canRead()) {
                    throw new IOException(file + " can not be read");
                }

                final long total_length = file.length();
                long range_start = 0;
                long range_end = total_length - 1;
                boolean partial = false;

                if (range != null) {
                    range = range.replace("bytes=", "");
                    Pattern p = Pattern.compile("(\\d+)\\-(\\d*)");
                    Matcher m = p.matcher(range);
                    if (m.find()) {
                        partial = true;
                        range_start = Long.parseLong(m.group(1));
                        String str = m.group(2);
                        if (!str.isEmpty()) {
                            range_end = Long.parseLong(str);
                        }
                        if (range_start >= total_length || range_end >= total_length || range_start > range_end) {
                            Log.w(TAG, "request out of range: " + range);
                            headers.put("Content-Range", String.format("bytes */%d", total_length));
                            return createResponse(mimeType, 416, "Requested range not satisfiable", headers, null);
                        }
                    }
                }

                InputStream inputStream = new FileInputStream(file);
                int status = 200;
                String reason = "OK";
                headers.put("Cache-Control", "no-cache");
                headers.put("Accept-Ranges", "bytes");
                headers.put("Content-Encoding", "identity");

                if (partial) {
                    if (range_start > 0) {
                        inputStream.skip(range_start);
                    }
                    inputStream = new BrokenInputStream(inputStream, IS_LEGACY ? 0 : range_start, range_end - range_start + 1);
                    status = 206;
                    reason = "Partial content";
                    headers.put("Content-Range", String.format("bytes %d-%d/%d", range_start, range_end, total_length));
                }

                return createResponse(mimeType, status, reason, headers, inputStream);
            } catch (Exception e) {
                Log.w(TAG, "fail to read file", e);
                return createResponse(mimeType, 404, "Not found", headers, null);
            }
        }

        private WebResourceResponse createResponse(String mimeType, int status, String reason,
                Map<String, String> headers, InputStream inputStream) {
            if (inputStream == null) {
                inputStream = new ByteArrayInputStream(new byte[0]);
            }
            if (IS_LEGACY) {
                String range = headers.get("Content-Range");
                if (range != null) {
                    mimeType += "; " + range.replace("bytes ", "bytes=");
                }
                return new WebResourceResponse(mimeType, "UTF-8", inputStream);
            } else {
                return _createResponse(mimeType, status, reason, headers, inputStream);
            }
        }

        @TargetApi(Build.VERSION_CODES.LOLLIPOP)
        private WebResourceResponse _createResponse(String mimeType, int status, String reason,
                Map<String, String> headers, InputStream inputStream) {
            return new WebResourceResponse(mimeType, "UTF-8", status, reason, headers, inputStream);
        }

        private WebResourceResponse shouldInterceptRequest(WebView view, Uri uri, String range) {
            if (isRelativeUri(ROOTVIEWER_URI, uri)) {
                return loadAssetUri(view, uri, range);
            }

            if (isRelativeUri(ASSETS_URI, uri)) {
                return loadAssetUri(view, uri, range);
            }

            if (isRelativeUri(ROOT_URI, uri)) {
                return loadBookUri(view, uri, range);
            }

            return null;
        }

        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, String url) {
            Uri uri = Uri.parse(url);
            String range = null;
            if (uri.isHierarchical()) {
                range = uri.getQueryParameter("_Range_");
            }
            return shouldInterceptRequest(view, uri, range);
        }

        @Override
        @TargetApi(Build.VERSION_CODES.LOLLIPOP)
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            if (IS_LEGACY) {
                return super.shouldInterceptRequest(view, request);
            } else {
                return shouldInterceptRequest(view, request.getUrl(), request.getRequestHeaders().get("Range"));
            }
        }

        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            Log.e(TAG, "onReceivedError : description=" + description + ", failingUrl=" + failingUrl);
        }
    };

}
