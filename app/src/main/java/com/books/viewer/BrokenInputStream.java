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

import android.support.annotation.NonNull;

import java.io.IOException;
import java.io.InputStream;

/**
 * Android Chromium Range header handling is very broken.
 * It will handle Range request very differently.
 *
 * If the request has Range header, Chromium will attempt to skip to start of
 * range before reading, but it won't handle end of Range properly.
 *
 * Chromium will think the stream start from 0 and assume it have at least
 * (offset + length) bytes.
 *
 * The real stream start from its current position (x), and have at least (length)
 * bytes. Absolute value of (x) is unknown, just take the current position of stream.
 *
 * Chromium    0                  (offset)                (offset + length)
 *             |===========================================|
 *             |---------------------|---------------------|
 *                                   |=====================|
 * Real Stream                      (x)                   (x + length)
 *
 * What Chromium does:
 *
 * 1. it first call available(), that must return >= (offset + length), or it fails
 *    immediately
 * 2. then it call skip(offset)
 * 3. then it call n = read(buffer, 0, buffer_size) multiple times, until sum(n) == (length)
 *
 * The BrokenInputStream will emulate available() and skip() to satisfy Chromium
 * assumption.
 */
public class BrokenInputStream extends InputStream {
    private final InputStream mInput;
    private final long mStart;
    private final long mEnd;
    private long mPos = 0;

    public BrokenInputStream(InputStream in, long offset, long length) {
        mStart = offset;
        mEnd = offset + length;
        mInput = in;
    }

    private void ensureReadingSafety() throws IOException {
        if (mPos < mStart) {
            throw new IOException("attempt to read unknown position: " + mPos + " < " + mStart);
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
    public int read(@NonNull byte[] buffer) throws IOException {
        return this.read(buffer, 0, buffer.length);
    }

    @Override
    public int read(@NonNull byte[] buffer, int offset, int len) throws IOException {
        if (mPos >= mEnd) {
            return -1;
        }

        ensureReadingSafety();

        long limit = Math.min(len, mEnd - mPos);
        int n = mInput.read(buffer, offset, (int) limit);

        if (n > 0) {
            mPos += n;
        }

        return n;
    }

    @Override
    public long skip(long len) throws IOException {
        long skipped = 0;

        if (mPos < mStart) {
            skipped = Math.min(len, mStart - mPos);
            mPos += skipped;
            len -= skipped;
        }

        if (len > 0) {
            long n = mInput.skip(len);
            mPos += n;
            skipped += n;
        }

        return skipped;
    }

    @Override
    public int available() throws IOException {
        return (int) Math.max(0, mEnd - mPos);
    }

    @Override
    public void close() throws IOException {
        mInput.close();
    }
}
