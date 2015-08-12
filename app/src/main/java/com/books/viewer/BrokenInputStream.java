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

import java.io.IOException;
import java.io.InputStream;

/**
 * Android Chromium Range header handling is very broken.
 * It will handle Range request very differently.
 *
 * If the request has Range header, Chromium will attempt to skip to start of range before reading.
 * But it won't handle end of Range properly.
 */
public class BrokenInputStream extends InputStream {
    private final InputStream mInput;
    private final long mStart;
    private final long mEnd;
    private final long mTotal;

    private long mPos = 0;

    public BrokenInputStream(InputStream in, long start, long end, long total) {
        this.mStart = start;
        this.mTotal = total;
        this.mEnd = end;
        this.mInput = in;
    }

    private void ensureReadingSafety() throws IOException {
        if (mPos < mStart) {
            mInput.skip(mStart - mPos);
        }
    }

    @Override
    public int read() throws IOException {
        if (mPos >= mEnd) {
            return -1;
        }

        ensureReadingSafety();

        int result = mInput.read();
        mPos++;
        return result;
    }

    @Override
    public int read(byte[] b) throws IOException {
        return this.read(b, 0, b.length);
    }

    @Override
    public int read(byte[] b, int off, int len) throws IOException {
        if (mPos >= mEnd) {
            return -1;
        }

        ensureReadingSafety();

        long maxRead = mEnd >= 0 ? Math.min(len, mEnd - mPos) : len;
        int bytesRead = mInput.read(b, off, (int) maxRead);

        if (bytesRead < 0) {
            return bytesRead;
        }

        mPos += bytesRead;
        return bytesRead;
    }

    @Override
    public long skip(long n) throws IOException {
        long toSkip = Math.min(n, mEnd - mPos);
        long skippedBytes = mInput.skip(toSkip);
        mPos += skippedBytes;
        return skippedBytes;
    }

    @Override
    public int available() throws IOException {
        if (mPos >= mEnd) {
            return 0;
        }

        return mInput.available();
    }

    @Override
    public void close() throws IOException {
        mInput.close();
    }
}
