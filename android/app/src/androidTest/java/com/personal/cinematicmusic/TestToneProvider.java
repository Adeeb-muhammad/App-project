package com.personal.cinematicmusic;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;

/**
 * Serves a generated WAV over a real `content://` URI so the device tests can
 * play the exact kind of Storage Access Framework URI the app imports, instead
 * of a plain file path.
 *
 * Declared in `src/androidTest/AndroidManifest.xml`, so it exists only in the
 * test APK and is never shipped to users.
 */
public class TestToneProvider extends ContentProvider {

    public static final String AUTHORITY = "com.personal.cinematicmusic.testtone";
    public static final Uri TONE_URI = Uri.parse("content://" + AUTHORITY + "/tone.wav");

    private static final String FILE_NAME = "saf-test-tone.wav";
    private static final int DURATION_MS = 6_000;

    @Override
    public boolean onCreate() {
        return true;
    }

    @Override
    public Cursor query(
        Uri uri,
        String[] projection,
        String selection,
        String[] selectionArgs,
        String sortOrder
    ) {
        File file = toneFile();
        String[] columns = projection != null
            ? projection
            : new String[] {OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        Object[] row = new Object[columns.length];
        for (int index = 0; index < columns.length; index += 1) {
            if (OpenableColumns.DISPLAY_NAME.equals(columns[index])) {
                row[index] = FILE_NAME;
            } else if (OpenableColumns.SIZE.equals(columns[index])) {
                row[index] = file.length();
            } else {
                row[index] = null;
            }
        }
        cursor.addRow(row);
        return cursor;
    }

    @Override
    public String getType(Uri uri) {
        return "audio/wav";
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(toneFile(), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("read-only test provider");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("read-only test provider");
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        throw new UnsupportedOperationException("read-only test provider");
    }

    private File toneFile() {
        File file = new File(getContext().getCacheDir(), FILE_NAME);
        if (!file.exists() || file.length() == 0) {
            try {
                TestAudio.writeTone(getContext(), FILE_NAME, 8_000, DURATION_MS);
            } catch (IOException error) {
                throw new IllegalStateException("could not generate the test tone", error);
            }
        }
        return file;
    }
}
