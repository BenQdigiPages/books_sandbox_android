//***************************************************************************
//* Written by Steve Chiu <steve.chiu@benq.com>
//* BenQ Corporation, All Rights Reserved.
//*
//* NOTICE: All information contained herein is, and remains the property
//* of BenQ Corporation and its suppliers, if any. Dissemination of this
//* information or reproduction of this material is strictly forbidden
//* unless prior written permission is obtained from BenQ Corporation.
//***************************************************************************

package com.books.sandbox;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.res.AssetManager;
import android.os.Bundle;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.widget.AdapterView;
import android.widget.BaseAdapter;
import android.widget.ImageButton;
import android.widget.ListView;
import android.widget.TextView;

import com.books.viewer.ViewerActivity;
import com.books.viewer.ViewerBridge;

import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public class MainActivity extends Activity {
    private static final String TAG = "MainActivity";

    private ListAdapter mListAdapter;
    private ListView mListView;
    private ArrayList<String> mItems;
    private ImageButton mBtnOptions;
    private ImageButton mBtnBookmark;
    private ImageButton mBtnMonkey;

    private class ListAdapter extends BaseAdapter {
        @Override
        public int getCount() {
            return mItems.size();
        }

        @Override
        public Object getItem(int pos) {
            return pos;
        }

        @Override
        public long getItemId(int pos) {
            return pos;
        }

        @Override
        public View getView(int pos, View view, ViewGroup parent) {
            if (view == null) {
                view = getLayoutInflater().inflate(R.layout.item, parent, false);
            }

            String info = mItems.get(pos);
            TextView title = (TextView)view.findViewById(R.id.text_title);
            title.setText(info);

            return view;
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.main);

        findBooks();

        mListAdapter = new ListAdapter();
        mListView = (ListView) findViewById(R.id.list);
        mListView.setAdapter(mListAdapter);

        mListView.setOnItemClickListener(new ListView.OnItemClickListener() {
            public void onItemClick(AdapterView<?> parent, View view, int pos, long id) {
                selectBook(mItems.get(pos));
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        getActionBar().show();
    }

    private void findBooks() {

        mItems = new ArrayList<>();
        ViewerBridge.getBaseDir(this.getApplicationContext());
        //File internalBooksPath = new File(ViewerBridge.ASSETS_URI.getPath());
        File basedir = ViewerBridge.mContext.getExternalFilesDir(null);
        File internalBooksPath = new File(basedir.getPath() + "/assets/");
        if(internalBooksPath != null && internalBooksPath.isDirectory()) {
            File sdPath = internalBooksPath;
            if(sdPath != null && sdPath.isDirectory()) {
                File file[] = sdPath.listFiles();
                Log.d("Files", "Size: "+ file.length);
                for (int i=0; i < file.length; i++)
                {
                    Log.d("Files", "FileName:" + file[i].getName());
                    String strfile = file[i].getName();
                    if (strfile.endsWith(".epub")) {
                        mItems.add(strfile);
                    }
                }

                return;
            }
        }

        AssetManager assets = getAssets();

        try {
            String[] files = assets.list("");
            for (String file : files) {
                if (file.endsWith(".epub")) {
                    mItems.add(file);
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "unable to list books", e);
        }
    }

    private void selectBook(String name) {
        String url = ViewerBridge.BOOK_URI.toString() + name + "/";
        File dir = new File(ViewerBridge.getRootDir(this), name);
        dir.mkdirs();

        File meta = new File(dir, "META-INF");
        if (!meta.exists()) {
            try {
                extractBook(dir, name);
            } catch (Exception e) {
                new AlertDialog.Builder(this)
                        .setTitle("Extract book failed")
                        .setMessage("Can not extract book, error = " + e)
                        .show();
                return;
            }
        }

        Intent it = new Intent(this, ViewerActivity.class);
        it.putExtra("url", url);
        it.putExtra("is_pdf", name.endsWith(".pdf.epub"));
        startActivity(it);
    }

    public void extractBook(File root, String book) throws Exception {
        File dir = new File(ViewerBridge.ASSETS_URI.getPath()+"/"+book);

        InputStream in;
        if (dir.exists() == true)
            in = new FileInputStream(dir);
        else
            in = getAssets().open(book);

        ZipInputStream zip = new ZipInputStream(new BufferedInputStream(in));
        byte[] buffer = new byte[1024];

        while (true) {
            ZipEntry entry = zip.getNextEntry();
            if (entry == null) break;
            if (entry.isDirectory()) continue;

            File file = new File(root, entry.getName());
            file.getParentFile().mkdirs();

            FileOutputStream out = new FileOutputStream(file);
            while (true) {
                int len = zip.read(buffer, 0, buffer.length);
                if (len < 0) break;
                out.write(buffer, 0, len);
            }

            out.close();
            zip.closeEntry();
        }

        zip.close();
    }
}
