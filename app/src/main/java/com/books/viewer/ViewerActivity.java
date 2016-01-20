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

import android.app.Activity;
import android.app.AlertDialog;
import android.graphics.Color;
import android.os.Bundle;
import android.text.TextUtils;
import android.util.Log;
import android.view.GestureDetector;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.webkit.ValueCallback;
import android.webkit.WebView;
import android.widget.ImageButton;
import android.widget.RelativeLayout;
import android.widget.TextView;

import com.books.sandbox.R;

import org.json.JSONArray;
import org.json.JSONObject;

public class ViewerActivity extends Activity implements PopupMenu.OnClickPopupListener {
    private static final String TAG = "ViewerActivity";

    private ViewerBridge mBridge;
    private RelativeLayout mTitleBar;
    private TextView mTitle;
    private ImageButton mBtnTOC;
    private ImageButton mBtnOptions;
    private ImageButton mBtnBookmark;
    private ImageButton mBtnMonkey;
    private View mLoading;
    private WebView mWebView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        Log.d(TAG, "onCreate");
        super.onCreate(savedInstanceState);
        setContentView(R.layout.viewer);
        getActionBar().hide();

        String url = getIntent().getStringExtra("url");
        boolean is_pdf = getIntent().getBooleanExtra("is_pdf", false);

        if (url == null) {
            finish();
            return;
        }

        mTitleBar = (RelativeLayout) findViewById(R.id.title_bar);
        mTitle = (TextView) findViewById(R.id.title);
        mWebView = (WebView) findViewById(R.id.webview);
        mLoading = findViewById(R.id.loading);
        mLoading.setOnTouchListener(new View.OnTouchListener() {
            @Override
            public boolean onTouch(View v, MotionEvent event) {
                return true;
            }
        });

        mBridge = new ViewerBridge(this, mWebView);

        mBtnTOC = (ImageButton) findViewById(R.id.btn_toc);
        mBtnTOC.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                onClickTOC();
            }
        });

        mBtnOptions = (ImageButton) findViewById(R.id.btn_options);
        mBtnOptions.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                onClickOptions();
            }
        });

        mBtnBookmark = (ImageButton) findViewById(R.id.btn_bookmark);
        mBtnBookmark.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                onClickBookmark();
            }
        });

        mBtnMonkey = (ImageButton) findViewById(R.id.btn_monkey);
        mBtnMonkey.setOnClickListener(new View.OnClickListener() {
            public void onClick(View v) {
                onClickMonkey();
            }
        });

        mBridge.loadBook(url, is_pdf);
        mBridge.enableTrialPage(getBookInfoJson());

        initGesture();
    }

    private JSONArray mTOC;

    private JSONObject getBookInfoJson() {
        JSONObject json = new JSONObject();
        try {
            json.put("c_title", "accessible_epub_3");
            json.put("author", "茉莉戈波提爾曼寧");
            json.put("publisher_name", "owl");
            json.put("publish_date", "2015/05/18");
            json.put("isbn", "9789579684255");
            json.put("book_format", "REFLOWABLE");
            json.put("cur_version", "V001.0001");
        } catch (Exception e) {
            e.printStackTrace();
        }
        return json;
    }

    public void setTableOfContent(JSONArray toc) {
        mTOC = toc;
    }

    public void setTitle(String title) {
        mTitle.setText(title);
    }

    public void setTitleVisible(boolean visible) {
        mTitleBar.setVisibility(visible ? View.VISIBLE : View.INVISIBLE);
    }

    public void setLoadingVisible(boolean visible) {
        mLoading.setVisibility(visible ? View.VISIBLE : View.INVISIBLE);
    }

    private void onClickTOC() {
        PopupMenu popup = new PopupMenu(this);
        popup.setOnClickPopupListener(this);

        if (mTOC == null) {
            popup.setReadOnly(true);
            popup.add(0, "No TOC are available", null);
            popup.showAsDropDown(mBtnTOC);
            return;
        }

        for (int i = 0; i < mTOC.length(); i++) {
            try {
                JSONObject item = mTOC.getJSONObject(i);
                String title = item.getString("title");
                int level = item.getInt("level");
                while (level-- > 0) {
                    title = "    " + title;
                }
                final String link = item.getString("link");
                popup.add(0, title, new Runnable() {
                    public void run() {
                        mBridge.gotoLink(link);
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "fail to get TOC", e);
            }
        }

        popup.showAsDropDown(mBtnTOC);
    }

    private int mTextSize = 18;
    private int mTextColor = Color.BLACK;

    private void onClickOptions() {
        PopupMenu popup = new PopupMenu(this);
        popup.setOnClickPopupListener(this);

        popup.add(0, "Font scale +25%", new Runnable() {
            public void run() {
                mTextSize = mTextSize * 125 / 100;
                mBridge.setTextAppearance(mTextSize, mTextColor);
            }
        });

        popup.add(0, "Font scale -25%", new Runnable() {
            public void run() {
                mTextSize = mTextSize * 75 / 100;
                mBridge.setTextAppearance(mTextSize, mTextColor);
            }
        });

        popup.add(0, "Background: normal", new Runnable() {
            public void run() {
                mTextColor = Color.BLACK;
                mBridge.setTextAppearance(mTextSize, mTextColor);
                mBridge.setBackgroundColor(Color.WHITE);
            }
        });

        popup.add(0, "Background: reverse", new Runnable() {
            public void run() {
                mTextColor = Color.WHITE;
                mBridge.setTextAppearance(mTextSize, mTextColor);
                mBridge.setBackgroundColor(Color.BLACK);
            }
        });

        popup.add(0, "Background: paper", new Runnable() {
            public void run() {
                mTextColor = Color.BLACK;
                mBridge.setTextAppearance(mTextSize, mTextColor);
                mBridge.setBackgroundImage("file:///android_res/drawable/paper1.jpg");
            }
        });

        popup.add(0, "Mode: single", new Runnable() {
            public void run() {
                mBridge.setLayoutMode("single");
            }
        });

        popup.add(0, "Mode: side_by_side", new Runnable() {
            public void run() {
                mBridge.setLayoutMode("side_by_side");
            }
        });

        popup.add(0, "Mode: continuous", new Runnable() {
            public void run() {
                mBridge.setLayoutMode("continuous");
            }
        });

        popup.showAsDropDown(mBtnOptions);
    }

    private void onClickBookmark() {
        PopupMenu popup = new PopupMenu(this);
        popup.setOnClickPopupListener(this);

        popup.add(R.drawable.btn_pinklabel, "Bookmark: red (left page)", new Runnable() {
            public void run() {
                mBridge.setBookmark("red", 0);
            }
        });

        popup.add(R.drawable.btn_yellowlabel, "Bookmark: yellow (left page)", new Runnable() {
            public void run() {
                mBridge.setBookmark("yellow", 0);
            }
        });

        popup.add(R.drawable.btn_bluelabel, "Bookmark: blue (left page)", new Runnable() {
            public void run() {
                mBridge.setBookmark("blue", 0);
            }
        });

        popup.add(R.drawable.btn_nonelabel, "Remove bookmark (left page)", new Runnable() {
            public void run() {
                mBridge.removeBookmark(0);
            }
        });

        popup.add(R.drawable.btn_pinklabel, "Bookmark: red (right page)", new Runnable() {
            public void run() {
                mBridge.setBookmark("red", 1);
            }
        });

        popup.add(R.drawable.btn_yellowlabel, "Bookmark: yellow (right page)", new Runnable() {
            public void run() {
                mBridge.setBookmark("yellow", 1);
            }
        });

        popup.add(R.drawable.btn_bluelabel, "Bookmark: blue (right page)", new Runnable() {
            public void run() {
                mBridge.setBookmark("blue", 1);
            }
        });

        popup.add(R.drawable.btn_nonelabel, "Remove bookmark (right page)", new Runnable() {
            public void run() {
                mBridge.removeBookmark(1);
            }
        });

        popup.showAsDropDown(mBtnBookmark);
    }

    private void onClickMonkey() {
        PopupMenu popup = new PopupMenu(this);
        popup.setOnClickPopupListener(this);

        popup.add(0, "Viewer.getAvailableLayoutModes", new Runnable() {
            public void run() {
                mBridge.getAvailableLayoutModes(new ValueCallback<String[]>() {
                    public void onReceiveValue(String[] modes) {
                        alert("Viewer.getAvailableLayoutModes", "modes = " + TextUtils.join(" | ", modes));
                    }
                });
            }
        });

        popup.add(0, "Viewer.getLayoutMode", new Runnable() {
            public void run() {
                mBridge.getLayoutMode(new ValueCallback<String>() {
                    public void onReceiveValue(String value) {
                        alert("Viewer.getLayoutMode", "mode = " + value);
                    }
                });
            }
        });

        popup.add(0, "Viewer.getCurrentPosition", new Runnable() {
            public void run() {
                mBridge.getCurrentPosition(new ValueCallback<Object[]>() {
                    public void onReceiveValue(Object[] value) {
                        alert("Viewer.getCurrentPosition",
                                "chapter = " + value[0]
                                        + "\ncfi = " + value[1]
                                        + "\ncurrent = " + value[2]
                                        + "\ntotal = " + value[3]);
                    }
                });
            }
        });

        popup.showAsDropDown(mBtnMonkey);
    }

    public void onClickPopup(PopupMenu menu, Object key) {
        Runnable runnable = (Runnable) key;
        runnable.run();
        menu.dismiss();
    }

    private void alert(String title, String message) {
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setMessage(message)
                .show();
    }

    private void initGesture() {
        final GestureDetector.OnGestureListener mGuestureListener = new GestureDetector.SimpleOnGestureListener() {
            private static final int FLING_MIN_DISTANCE = 100;

            @Override
            public boolean onFling(MotionEvent e1, MotionEvent e2, float velocityX, float velocityY) {
                if (e1.getX() - e2.getX() > FLING_MIN_DISTANCE) {
                    mBridge.gotoNext();
                    return true;
                }
                if (e1.getX() - e2.getX() < -FLING_MIN_DISTANCE) {
                    mBridge.gotoPrevious();
                    return true;
                }
                return false;
            }
        };


        final GestureDetector mGuesture = new GestureDetector(this, mGuestureListener);

        mWebView.setOnTouchListener(new View.OnTouchListener() {
            private final int EPUB_FOOTER_HEIGHT = 40;
            private boolean isTriggerGuesture = true;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        if (event.getY() >= v.getMeasuredHeight() - EPUB_FOOTER_HEIGHT) {
                            isTriggerGuesture = false;
                            return false;
                        }
                        break;
                    case MotionEvent.ACTION_UP:
                    case MotionEvent.ACTION_CANCEL:
                        if (isTriggerGuesture == false) {
                            isTriggerGuesture = true;
                            return false;
                        }
                        break;
                    default:
                        if (isTriggerGuesture == false)
                            return false;
                }

                return mGuesture.onTouchEvent(event);
            }
        });
    }
}
