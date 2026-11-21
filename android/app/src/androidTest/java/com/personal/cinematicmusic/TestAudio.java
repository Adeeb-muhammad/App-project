package com.personal.cinematicmusic;

import android.content.Context;
import java.io.BufferedOutputStream;
import java.io.DataOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;

/**
 * Generates a mono 16-bit PCM sine tone, so the device tests exercise the real
 * decoder and the real audio output without shipping copyrighted audio.
 */
final class TestAudio {

    private TestAudio() {}

    static File writeTone(Context context, String name, int sampleRate, int durationMs)
        throws IOException {
        File file = new File(context.getCacheDir(), name);
        int samples = (sampleRate * durationMs) / 1000;
        int dataBytes = samples * 2;
        try (DataOutputStream out = new DataOutputStream(
            new BufferedOutputStream(new FileOutputStream(file)))) {
            out.writeBytes("RIFF");
            writeLittleEndianInt(out, 36 + dataBytes);
            out.writeBytes("WAVE");
            out.writeBytes("fmt ");
            writeLittleEndianInt(out, 16);
            writeLittleEndianShort(out, 1); // PCM
            writeLittleEndianShort(out, 1); // mono
            writeLittleEndianInt(out, sampleRate);
            writeLittleEndianInt(out, sampleRate * 2);
            writeLittleEndianShort(out, 2);
            writeLittleEndianShort(out, 16);
            out.writeBytes("data");
            writeLittleEndianInt(out, dataBytes);
            for (int index = 0; index < samples; index += 1) {
                double value = Math.sin(2.0 * Math.PI * 440.0 * index / sampleRate);
                writeLittleEndianShort(out, (int) Math.round(value * 8000));
            }
        }
        return file;
    }

    private static void writeLittleEndianInt(DataOutputStream out, int value) throws IOException {
        out.write(value & 0xff);
        out.write((value >> 8) & 0xff);
        out.write((value >> 16) & 0xff);
        out.write((value >> 24) & 0xff);
    }

    private static void writeLittleEndianShort(DataOutputStream out, int value) throws IOException {
        out.write(value & 0xff);
        out.write((value >> 8) & 0xff);
    }
}
