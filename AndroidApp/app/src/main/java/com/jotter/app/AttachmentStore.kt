package com.jotter.app

import android.content.Context
import android.graphics.Bitmap
import android.net.Uri
import android.provider.OpenableColumns
import java.io.File
import java.io.FileOutputStream
import java.util.UUID

class AttachmentStore(private val context: Context) {
    fun importUri(noteId: String, uri: Uri): AttachmentItem {
        val resolver = context.contentResolver
        val name = resolver.query(uri, null, null, null, null)?.use { cursor ->
            val idx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
            if (cursor.moveToFirst() && idx >= 0) cursor.getString(idx) else null
        } ?: "attachment-${System.currentTimeMillis()}"
        val mime = resolver.getType(uri) ?: "application/octet-stream"
        val dir = File(context.filesDir, "attachments/$noteId").apply { mkdirs() }
        val outFile = File(dir, "${UUID.randomUUID()}-$name")
        resolver.openInputStream(uri)?.use { input ->
            outFile.outputStream().use { output -> input.copyTo(output) }
        }
        val extracted = when {
            mime.startsWith("text/") -> outFile.readText().take(50_000)
            mime.startsWith("image/") -> "Image captured for OCR queue: $name"
            mime == "application/pdf" -> "PDF captured for text extraction: $name"
            else -> ""
        }
        return AttachmentItem(
            id = UUID.randomUUID().toString(),
            noteId = noteId,
            fileName = name,
            mimeType = mime,
            localPath = outFile.absolutePath,
            extractedText = extracted,
            fileSize = outFile.length(),
            previewText = extracted.take(240)
        )
    }

    fun importBitmap(noteId: String, bitmap: Bitmap): AttachmentItem {
        val name = "photo-${System.currentTimeMillis()}.png"
        val dir = File(context.filesDir, "attachments/$noteId").apply { mkdirs() }
        val outFile = File(dir, "${UUID.randomUUID()}-$name")
        FileOutputStream(outFile).use { output ->
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, output)
        }
        return AttachmentItem(
            id = UUID.randomUUID().toString(),
            noteId = noteId,
            fileName = name,
            mimeType = "image/png",
            localPath = outFile.absolutePath,
            extractedText = "Image captured for OCR queue: $name",
            fileSize = outFile.length(),
            previewText = "Image captured for OCR queue: $name"
        )
    }
}
