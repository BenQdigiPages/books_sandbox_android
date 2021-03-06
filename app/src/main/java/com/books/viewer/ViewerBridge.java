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
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.text.TextUtils;
import android.util.Log;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceResponse;
import android.widget.Toast;

import com.books.sandbox.R;

import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.xwalk.core.JavascriptInterface;
import org.xwalk.core.XWalkPreferences;
import org.xwalk.core.XWalkResourceClient;
import org.xwalk.core.XWalkView;

import java.io.BufferedInputStream;
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

    // This is for sandbox only, sandbox has direct mapping from BOOK_URI to BOOT_DIR
    private static File BOOT_DIR;
    public static final String ROOT_PATH = "http://fake.benqguru.com";
    public static final Uri BOOK_URI = Uri.parse(ROOT_PATH+"/books/");
    public static final Uri ASSETS_URI =  Uri.parse(ROOT_PATH + "/(ASSETS)/");
    public static final Uri RES_URI =  Uri.parse(ROOT_PATH + "/(RES)/");

    public static final String LAYOUT_SINGLE = "single";
    public static final String LAYOUT_SIDE_BY_SIDE = "side_by_side";
    public static final String LAYOUT_CONTINUOUS = "continuous";

    public static Context mContext;

    private ViewerActivity mScene;
    private XWalkView mXWalkView;
    private Handler mHandler = new Handler();

    private String mBookUri;
    private boolean mIsPdf;
    private boolean mIsLibraryLoaded;
    private final HashMap<String, Runnable> mLoadUrlCallbacks = new HashMap<String, Runnable>();

    private int mEvalToken = 1;
    private final HashMap<Integer, ValueCallback<String>> mEvalCallbacks = new HashMap<Integer, ValueCallback<String>>();

    private final HashMap<String, Integer> mResourceMap = new HashMap<String, Integer>();
    {
        mResourceMap.put("viewer_pagebar_control", R.drawable.viewer_pagebar_control);
        mResourceMap.put("ic_viewer_prepage", R.drawable.ic_viewer_prepage);
        mResourceMap.put("ic_viewer_prepage_press", R.drawable.ic_viewer_prepage_press);
        mResourceMap.put("ic_viewer_prepage_r", R.drawable.ic_viewer_prepage_r);
        mResourceMap.put("ic_viewer_prepage_r_press", R.drawable.ic_viewer_prepage_r_press);
        mResourceMap.put("ic_viewer_preview", R.drawable.ic_viewer_preview);
        mResourceMap.put("ic_viewer_preview_press", R.drawable.ic_viewer_preview_press);
        mResourceMap.put("ic_popup_cancel", R.drawable.ic_popup_cancel);
        mResourceMap.put("bg_popup_btn", R.drawable.bg_popup_btn);
        mResourceMap.put("pager1", R.drawable.paper1);
    }

    public static void getBaseDir(Context context) {

        mContext = context;
    }

    public static File getRootDir(Context context) {

        if (BOOT_DIR != null) return BOOT_DIR;

        File dir = context.getExternalFilesDir("books");
        dir.mkdirs();
        if (dir.exists()) {
            BOOT_DIR = dir;
            return dir;
        }

        dir = new File(context.getFilesDir(), "books");
        dir.mkdirs();
        BOOT_DIR = dir;
        return dir;
    }

    public ViewerBridge(ViewerActivity scene, XWalkView webView) {
        JavascriptCallback javascriptInterface = new JavascriptCallback();
        WebChromeClient webChromeClient = new WebChromeClient();
        mScene = scene;
        mXWalkView = webView;

        XWalkPreferences.setValue(XWalkPreferences.JAVASCRIPT_CAN_OPEN_WINDOW, true);

//        WebSettings settings = mXWalkView.getSettings();
//        settings.setAppCacheEnabled(false);
//        settings.setJavaScriptEnabled(true);
//        settings.setJavaScriptCanOpenWindowsAutomatically(true);
//        //[Bruce] Enable webView Database to let javascript access the localStorage
//        settings.setDatabaseEnabled(true);
//        String dir = mScene.getApplicationContext().getDir("database", Context.MODE_PRIVATE).getPath();
//        settings.setDatabasePath(dir);
//        settings.setDomStorageEnabled(true);
//        settings.setRenderPriority(WebSettings.RenderPriority.HIGH);
//        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
//        //End : [Bruce]

//        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.KITKAT) {
            if (0 != (mScene.getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE)) {
                XWalkPreferences.setValue(XWalkPreferences.REMOTE_DEBUGGING, true);
            }
//        }

        mXWalkView.addJavascriptInterface(javascriptInterface, "_App");
        mXWalkView.setResourceClient(new QXWalkResourceClient(mXWalkView));
    }

    private void loadUrl(String url, Runnable callback) {
        synchronized (mLoadUrlCallbacks) {
            mLoadUrlCallbacks.put(url, callback);
        }
        mXWalkView.load(url, null);
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
        mXWalkView.evaluateJavascript(script, callback);
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

        if (callback != null) {
            int token;
            synchronized (mEvalCallbacks) {
                token = mEvalToken++;
                mEvalCallbacks.put(token, callback);
            }
            script = "JSON.stringify(" + script + ")";
            mXWalkView.evaluateJavascript("App.onDispatchResult(" + token + ", " + script + ")", null);
        } else {
            mXWalkView.evaluateJavascript(script, callback);
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
        Log.d(TAG, "loadBook " + url);
        mBookUri = url;

        if (mIsLibraryLoaded && mIsPdf == isPdf) {
            reloadBook();
            return;
        }

        mIsPdf = isPdf;

        loadUrl("about:blank", new Runnable() {
            public void run() {
                String libraryUrl = ASSETS_URI.toString();
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
                    ArrayList<String> list = new ArrayList<String>();
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
    /// Goto the previous screen (with one or two pages) in this ebook
    ///
    public void gotoPrevious() {
        eval("Viewer.gotoPrevious()", null);
    }

    ///
    /// Goto the next screen (with one or two pages) in this ebook
    ///
    public void gotoNext() {
        eval("Viewer.gotoNext()", null);
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
                    callback.onReceiveValue(new Object[]{
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
    ///     color - the bookmark color type, either "red", "yellow" or "blue"
    ///     null - to remove current bookmark
    /// @page_offset: either 0 or 1
    ///     for single page mode, page_offset is always 0
    ///     for side by side mode, 0 is for left page, 1 is for right page
    ///
    public void setBookmark(String color, int pageOffset) {
        eval("Viewer.toggleBookmark(\"" + color + "\", " + pageOffset + ")", null);
    }

    public void removeBookmark(int pageOffset) {
        eval("Viewer.toggleBookmark(null, " + pageOffset + ")", null);
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


    ///
    /// Notify viewer that the book is trial.
    /// Need to create the trial page in the end.
    ///
    ///@book_info: Json object - related book infomations in trial page
    ///
    public void enableTrialPage(JSONObject book_info) {
        eval("Viewer.enableTrialPage" + "(" + book_info.toString() + ")", null);
    }

    ///
    /// Get relayout page from cfi.
    ///
    /// @cfi: string - epub cfi
    /// @page: int - page of cfi
    ///

    public void getPageFromCfi(String cfi, ValueCallback<Integer> callback) {
        eval("Viewer.getPageFromCfi(\"" + cfi + "\")", callback);
    }

    ///
    /// Notify viewer that highlights is modified.
    ///
    /// @list_highlights: Json array - an array of object to represent highlights
    ///
    public void updateHighlights() {
        JSONArray list_highlights = new JSONArray();
        eval("Viewer.updateHighlights" + "(" + list_highlights.toString() + ")", null);
    }

    ///
    /// Notify viewer that bookmarks is modified.
    ///
    /// @list_bookmarks: Json array - an array of object to represent bookmarks
    ///
    public void updateBookmarks() {
        JSONArray list_bookmarks = new JSONArray();

        eval("Viewer.updateBookmarks" + "(" + list_bookmarks.toString() + ")", null);
    }

    // [Bruce]
    public void gesturableOnStart(float scale,float ds) {
        eval("Viewer.gesturableOnStart(\"" + scale + "\",\"" + ds + "\")", null);
    }

    public void gesturableOnMove(float scale,float ds) {
        eval("Viewer.gesturableOnMove(\"" + scale + "\",\"" + ds + "\")", null);
    }

    public void gesturableOnEnd(float scale,float ds) {
        eval("Viewer.gesturableOnEnd(\"" + scale + "\",\"" + ds + "\")", null);
    }
    public void gesturableCenterCoordinate(float centerX,float centerY) {
        eval("Viewer.gesturableCenterCoordinate(\"" + centerX + "\",\"" + centerY + "\")", null);
    }

    public void draggableOnMove(float dx,float dy) {
        eval("Viewer.draggableOnMove(\"" + dx + "\",\"" + dy + "\")", null);
    }
    public void draggableOnEnd() {
        eval("Viewer.draggableOnEnd(null)", null);
    }
    // End : [Bruce]

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
            Toast.makeText(mContext, (String) "onChangeTitle", Toast.LENGTH_LONG).show();
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
            Toast.makeText(mContext, (String) "onChangeTOC", Toast.LENGTH_LONG).show();
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
            Toast.makeText(mContext, (String) "onChangeView", Toast.LENGTH_LONG).show();

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
            Toast.makeText(mContext, (String) "onChangePage", Toast.LENGTH_LONG).show();
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
            Toast.makeText(mContext, (String) "onTrackAction", Toast.LENGTH_LONG).show();
            Log.i(TAG, "onTrackAction action=" + action + ", cfi=" + cfi);
        }

        ///
        /// Notify App to show or hide toolbar
        ///
        /// @visible: bool - set visibility of tool bar
        ///
        @JavascriptInterface
        public void onToggleToolbar(final boolean visible) {
            Toast.makeText(mContext, (String) "onToggleToolbar", Toast.LENGTH_LONG).show();
            mHandler.post(new Runnable() {
                public void run() {
                    mScene.setTitleVisible(visible);
                }
            });
        }

        ///
        /// Notify App to show or hide loading
        ///
        /// @visible: bool - set visibility of loading
        ///
        @JavascriptInterface
        public void onToggleLoading(final boolean visible) {
            Toast.makeText(mContext, (String) "onToggleLoading", Toast.LENGTH_LONG).show();
            mHandler.post(new Runnable() {
                public void run() {
                    mScene.setLoadingVisible(visible);
                }
            });
        }

        ///
        /// Notify App to show or hide action mode
        ///
        /// @visible: bool - set visibility of action mode
        /// @selectColor: String - the current highlight color type, either "red", "yellow" or "blue".
        ///
        @JavascriptInterface
        public void onToggleActionMode(final boolean visible, final String selectColor) {
            Toast.makeText(mContext, "onToggleActionMode\nvisible=" + visible + "\nselectColor" + selectColor, Toast.LENGTH_LONG).show();
        }

        ///
        /// Notify App that thumbnail bar is show or hide
        ///
        /// @visible: bool - visibility of thumbnail bar
        ///
        @JavascriptInterface
        public void onToggleThumbnailbar(final boolean visible) {
            Toast.makeText(mContext, "onToggleThumbnailbar\nvisible=" + visible, Toast.LENGTH_LONG).show();
        }


        // dummy database
        private final HashMap<String, JSONObject> mHighlights = new HashMap<String, JSONObject>();

        ///
        /// Request App to load highlights for this book, App will call callback in response
        /// The callback will receive an array of object to represent highlights
        ///
        ///     function callback([highlight, ...])
        ///
        /// @callback: string - name of callback function (can be object member function)
        ///     do not pass function itself, only name (as string) is needed;
        ///     and the function must be accessable from global space
        ///
        @JavascriptInterface
        public void onRequestHighlights(final String callback) {
            Toast.makeText(mContext, (String) "onRequestHighlights", Toast.LENGTH_LONG).show();


            final JSONArray list = new JSONArray();

            synchronized (mHighlights) {
                for (JSONObject item_highlight : mHighlights.values()) {
                    list.put(item_highlight);
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
        /// @highlight - an object to represent highlight, uuid is absent in this case
        /// @callback: string - name of callback function (can be object member function);
        ///     do not pass function itself, only name (as string) is needed;
        ///     and the function must be accessable from global space
        ///
        @JavascriptInterface
        public void onAddHighlight(String highlight_json, final String callback) {
            Toast.makeText(mContext, (String) "onAddHighlight", Toast.LENGTH_LONG).show();
            try {
                JSONObject highlight = new JSONObject(highlight_json);
                final String uuid = UUID.randomUUID().toString();

                synchronized (mHighlights) {
                    mHighlights.put(uuid, highlight);
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
            Toast.makeText(mContext, (String) "onUpdateHighlight", Toast.LENGTH_LONG).show();
            try {
                JSONObject highlight = new JSONObject(highlight_json);
                String uuid = highlight.getString("uuid");

                synchronized (mHighlights) {
                    mHighlights.put(uuid, highlight);
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
            Toast.makeText(mContext, (String) "onRemoveHighlight", Toast.LENGTH_LONG).show();
            synchronized (mHighlights) {
                mHighlights.remove(uuid);
            }
        }

        ///
        /// Notify App the given highlight need to be shared, App will popup sharing toast
        ///
        /// @uuid - uuid of the highlight
        ///
        @JavascriptInterface
        public void onShareHighlight(final String uuid) {
            Toast.makeText(mContext, "onShareHighlight\nuuid=" + uuid, Toast.LENGTH_LONG).show();
        }

        ///
        /// Notify App the given highlight need to be annotated, App will popup edit window
        ///
        /// @uuid - uuid of the highlight
        ///
        @JavascriptInterface
        public void onAnnotateHighlight(final String uuid) {
            Toast.makeText(mContext, "onAnnotateHighlight\nuuid=" + uuid, Toast.LENGTH_LONG).show();
        }

        // dummy database
        private final HashMap<String, JSONObject> mBookmarks = new HashMap<String, JSONObject>();

        ///
        /// Request App to load bookmark for this book, App will call callback in response
        /// The callback will receive an array of json object to represent bookmarks
        ///
        ///     function callback([bookmark, ...])
        ///
        /// @callback: string - name of callback function (can be object member function);
        ///     do not pass function itself, only name (as string) is needed;
        ///     and the function must be accessable from global space
        ///
        @JavascriptInterface
        public void onRequestBookmarks(final String callback) {
            Toast.makeText(mContext, (String) "onRequestBookmarks", Toast.LENGTH_LONG).show();
            final JSONArray list = new JSONArray();

            synchronized (mBookmarks) {
                for (JSONObject item_bookmark : mBookmarks.values()) {
                    list.put(item_bookmark);
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
        /// @bookmark - an object to represent bookmark, uuid is absent in this case
        /// @callback: string - name of callback function (can be object member function);
        ///     do not pass function itself, only name (as string) is needed;
        ///     and the function must be accessable from global space
        ///
        @JavascriptInterface
        public void onAddBookmark(String bookmark_json, final String callback) {
            Toast.makeText(mContext, (String) "onAddBookmark", Toast.LENGTH_LONG).show();
            try {
                JSONObject bookmark = new JSONObject(bookmark_json);
                final String uuid = UUID.randomUUID().toString();

                synchronized (mBookmarks) {
                    mBookmarks.put(uuid, bookmark);
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
        /// @bookmark - an object to represent bookmark
        ///
        @JavascriptInterface
        public void onUpdateBookmark(String bookmark_json) {
            Toast.makeText(mContext, (String) "onUpdateBookmark", Toast.LENGTH_LONG).show();
            try {
                JSONObject bookmark = new JSONObject(bookmark_json);
                synchronized (mBookmarks) {
                    String uuid = bookmark.getString("uuid");
                    mBookmarks.put(uuid, bookmark);
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
            Toast.makeText(mContext, (String) "onRemoveBookmark", Toast.LENGTH_LONG).show();
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
            Toast.makeText(mContext, (String) "onSearchResult", Toast.LENGTH_LONG).show();
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

        ///
        /// Notify App to go the product page of book.
        ///
        /// http://www.books.com.tw/products/<book_item>
        ///
        @JavascriptInterface
        public void onGoToBookIntro() {
            Toast.makeText(mContext, (String) "onGoToBookIntro", Toast.LENGTH_LONG).show();
        }

        ///
        /// Notify App the book need to be shared, App will popup sharing toast
        ///
        @JavascriptInterface
        public void onShareBookInfo() {
            Toast.makeText(mContext, (String) "onShareBookInfo", Toast.LENGTH_LONG).show();
        }

        ///
        /// Notify App save and show log.
        ///
        /// @tag Used to identify the source of a log message.
        /// @msg The message you would like logged.
        ///
        @JavascriptInterface
        public void onLog(final String tag, final String msg) {
            Toast.makeText(mContext, (String) "onLog\ntag=" + tag + "\nmsg=" + msg, Toast.LENGTH_LONG).show();
        }

        ///
        /// Get page direction from App.
        ///
        ///     function callback(pageDirection)
        ///
        /// @callback: string - name of callback function (can be object member function);
        ///     do not pass function itself, only name (as string) is needed;
        ///     and the function must be accessable from global space
        ///
        @JavascriptInterface
        public void getPageDirection(final String callback) {
            Toast.makeText(mContext, (String) "getPageDirection", Toast.LENGTH_LONG).show();
            mHandler.post(new Runnable() {
                public void run() {
                    eval(callback + "(\"" + "0" + "\")", null);
                }
            });
        }

        ///
        /// Set App controll funcation enable or disable.
        ///
        /// @enable - true or false.
        ///
        @JavascriptInterface
        public void setControlEnable(final boolean enable) {
            Toast.makeText(mContext, "setControlEnable enable=" + enable, Toast.LENGTH_LONG).show();
        }

        ///
        /// Notify App that touch listener is enable or disable
        ///
        /// @enable: bool - enable of touch listener
        ///
        @JavascriptInterface
        public void onToggleTouchEnable(final boolean enable) {
            Toast.makeText(mContext, "onToggleTouchEnable enable=" + enable, Toast.LENGTH_LONG).show();
        }

        ///
        /// Notify App show page dircetion tip.
        ///
        /// @pageDirection: int - Set the page dircetion, 0(Left) or 1(Right).
        ///
        @JavascriptInterface
        public void showPageDircetionTip(final int pageDirection) {
            Toast.makeText(mContext, "showPageDircetionTip pageDirection=" + pageDirection, Toast.LENGTH_LONG).show();
        }
    }

    private class QXWalkResourceClient extends XWalkResourceClient {

        public QXWalkResourceClient(XWalkView view) {
            super(view);
        }

        @Override
        public void onLoadStarted(XWalkView view, String url) {
            super.onLoadStarted(view, url);
        }

        @Override
        public void onLoadFinished(XWalkView view, String url) {
            super.onLoadFinished(view, url);
            view.getNavigationHistory().clear();
            final Runnable callback;
            synchronized (mLoadUrlCallbacks) {
                callback = mLoadUrlCallbacks.remove(url);
            }

            if (callback != null) {
                mHandler.post(callback);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(XWalkView view, String url) {
            Log.v(TAG, "onLoadStarted url=" + url);
            if(url != null) {
                if (url.startsWith(ROOT_PATH)) {
                    return super.shouldOverrideUrlLoading(view, url);
                } else if (url.startsWith("http://")) {
                    view.getContext().startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                    return true;
                }
            }
            return false;
        }

        @Override
        public WebResourceResponse shouldInterceptLoadRequest(XWalkView view, String url) {
            Uri uri = Uri.parse(url);
            String range = null;
            if (uri.isHierarchical()) {
                range = uri.getQueryParameter("_Range_");
            }
            return shouldInterceptRequest(view, uri, range);
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

        private WebResourceResponse loadAssetUri(XWalkView view, Uri uri, String range) {
            HashMap<String, String> headers = new HashMap<String, String>();
            String mimeType = getMimeType(uri);

            try {
                String path = uri.getPath().substring(ASSETS_URI.getPath().length());
                InputStream inputStream;

                File basedir = ViewerBridge.mContext.getExternalFilesDir(null);
                File internalBooksPath = new File(basedir.getPath() + "/assets/");
                if (internalBooksPath != null && internalBooksPath.isDirectory()) {
                    File dir = new File(internalBooksPath.getPath() + "/" + path);
                    inputStream = new FileInputStream(dir);
                } else
                    inputStream = mScene.getAssets().open(path);
                headers.put("Cache-Control", "no-cache");

                return createResponse(mimeType, 200, "OK", headers, inputStream);
            } catch (Exception e) {
                Log.w(TAG, "fail to read asset", e);
                return createResponse(mimeType, 404, "Not found", headers, null);
            }
        }

        private WebResourceResponse loadResUri(XWalkView view, Uri uri, String range) {
            HashMap<String, String> headers = new HashMap<String, String>();
            String mimeType = getMimeType(uri);

            try {
                String fileName = uri.getPath().substring(RES_URI.getPath().length());
                InputStream inputStream;

                File basedir = ViewerBridge.mContext.getExternalFilesDir(null);
                File internalBooksPath = new File(basedir.getPath() + "/res/");
                if (internalBooksPath != null && internalBooksPath.isDirectory()) {
                    File dir = new File(internalBooksPath.getPath() + "/" + fileName);
                    inputStream = new FileInputStream(dir);
                } else
                    inputStream = mScene.getResources().openRawResource(mResourceMap.get(fileName));
                inputStream = new BufferedInputStream(inputStream); //Jacky
                headers.put("Cache-Control", "no-cache");

                return createResponse(mimeType, 200, "OK", headers, inputStream);
            } catch (Exception e) {
                Log.w(TAG, "fail to read asset", e);
                return createResponse(mimeType, 404, "Not found", headers, null);
            }
        }

        private WebResourceResponse loadBookUri(XWalkView view, Uri uri, String range) {
            HashMap<String, String> headers = new HashMap<String, String>();
            String mimeType = getMimeType(uri);

            try {
                String path = uri.getPath().substring(BOOK_URI.getPath().length());
                File file = new File(getRootDir(mScene), path);

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

        private WebResourceResponse shouldInterceptRequest(XWalkView view, Uri uri, String range) {
            if (isRelativeUri(ASSETS_URI, uri)) {
                return loadAssetUri(view, uri, range);
            }

            if (isRelativeUri(RES_URI, uri)) {
                return loadResUri(view, uri, range);
            }

            if (isRelativeUri(BOOK_URI, uri)) {
                return loadBookUri(view, uri, range);
            }

            return null;
        }

    };

}
