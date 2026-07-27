package com.jotter.app

data class Note(
    val id: String,
    val title: String,
    val content: String,
    val type: String = "rich",
    val sourceUrl: String? = null,
    val notebookId: String = JotterDb.DEFAULT_NOTEBOOK_ID,
    val isPinned: Boolean = false,
    val isArchived: Boolean = false,
    val isDeleted: Boolean = false,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val syncStatus: String = "pending_create"
)

data class Notebook(
    val id: String,
    val name: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class TagItem(
    val id: String,
    val name: String
)

data class NoteHistoryItem(
    val id: String,
    val noteId: String,
    val title: String,
    val content: String,
    val createdAt: Long
)

data class TaskItem(
    val id: String,
    val noteId: String?,
    val title: String,
    val done: Boolean = false,
    val dueAt: Long? = null,
    val reminderAt: Long? = null,
    val priority: Int = 0,
    val completedAt: Long? = null
)

data class AttachmentItem(
    val id: String,
    val noteId: String,
    val fileName: String,
    val mimeType: String,
    val localPath: String,
    val extractedText: String = "",
    val fileSize: Long = 0L,
    val previewText: String = ""
)

data class SavedSearch(
    val id: String,
    val name: String,
    val query: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class CalendarLink(
    val id: String,
    val noteId: String,
    val title: String,
    val startsAt: Long,
    val endsAt: Long? = null
)

data class SyncOperation(
    val id: String,
    val entityType: String,
    val entityId: String,
    val operation: String,
    val createdAt: Long,
    val status: String,
    val error: String? = null
)

data class NoteTemplate(
    val id: String,
    val name: String,
    val title: String,
    val content: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class ShortcutItem(
    val id: String,
    val label: String,
    val targetType: String,
    val targetId: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class CommentItem(
    val id: String,
    val noteId: String,
    val author: String,
    val body: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class SharePermission(
    val id: String,
    val noteId: String,
    val recipient: String,
    val permission: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class ActivityItem(
    val id: String,
    val noteId: String?,
    val action: String,
    val detail: String,
    val createdAt: Long = System.currentTimeMillis()
)

data class AiActionItem(
    val id: String,
    val noteId: String,
    val action: String,
    val result: String,
    val createdAt: Long = System.currentTimeMillis()
)
