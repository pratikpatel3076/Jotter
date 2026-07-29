package com.jotter.app

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import java.util.UUID

class JotterDb(context: Context) : SQLiteOpenHelper(context, "jotter_native.db", null, 4) {
    companion object {
        const val DEFAULT_NOTEBOOK_ID = "default"
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE notes(
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                type TEXT NOT NULL,
                source_url TEXT,
                notebook_id TEXT NOT NULL DEFAULT '$DEFAULT_NOTEBOOK_ID',
                is_pinned INTEGER NOT NULL DEFAULT 0,
                is_archived INTEGER NOT NULL DEFAULT 0,
                is_deleted INTEGER NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                sync_status TEXT NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE tasks(
                id TEXT PRIMARY KEY,
                note_id TEXT,
                title TEXT NOT NULL,
                done INTEGER NOT NULL DEFAULT 0,
                due_at INTEGER,
                reminder_at INTEGER,
                priority INTEGER NOT NULL DEFAULT 0,
                completed_at INTEGER
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE attachments(
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                file_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                local_path TEXT NOT NULL,
                extracted_text TEXT NOT NULL DEFAULT '',
                file_size INTEGER NOT NULL DEFAULT 0,
                preview_text TEXT NOT NULL DEFAULT ''
            )
            """.trimIndent()
        )
        createPhaseTables(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        if (oldVersion < 2) {
            addColumnIfMissing(db, "notes", "notebook_id", "TEXT NOT NULL DEFAULT '$DEFAULT_NOTEBOOK_ID'")
            addColumnIfMissing(db, "notes", "created_at", "INTEGER NOT NULL DEFAULT 0")
            db.execSQL("UPDATE notes SET created_at = updated_at WHERE created_at = 0")
            createPhaseTables(db)
        }
        if (oldVersion < 3) {
            addColumnIfMissing(db, "tasks", "reminder_at", "INTEGER")
            addColumnIfMissing(db, "tasks", "priority", "INTEGER NOT NULL DEFAULT 0")
            addColumnIfMissing(db, "tasks", "completed_at", "INTEGER")
            addColumnIfMissing(db, "attachments", "file_size", "INTEGER NOT NULL DEFAULT 0")
            addColumnIfMissing(db, "attachments", "preview_text", "TEXT NOT NULL DEFAULT ''")
            createPhaseTables(db)
        }
        if (oldVersion < 4) {
            createPhaseTables(db)
        }
    }

    private fun createPhaseTables(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS notebooks(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS tags(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL UNIQUE
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS note_tags(
                note_id TEXT NOT NULL,
                tag_id TEXT NOT NULL,
                PRIMARY KEY(note_id, tag_id)
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS note_history(
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS saved_searches(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                query TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS calendar_links(
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                title TEXT NOT NULL,
                starts_at INTEGER NOT NULL,
                ends_at INTEGER
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS sync_ops(
                id TEXT PRIMARY KEY,
                entity_type TEXT NOT NULL,
                entity_id TEXT NOT NULL,
                operation TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                status TEXT NOT NULL,
                error TEXT
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS conflicts(
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                local_title TEXT NOT NULL,
                local_content TEXT NOT NULL,
                remote_title TEXT NOT NULL,
                remote_content TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                resolved_at INTEGER
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS templates(
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS shortcuts(
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                target_type TEXT NOT NULL,
                target_id TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS preferences(
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS comments(
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                author TEXT NOT NULL,
                body TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS share_permissions(
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                recipient TEXT NOT NULL,
                permission TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS activity_log(
                id TEXT PRIMARY KEY,
                note_id TEXT,
                action TEXT NOT NULL,
                detail TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS ai_actions(
                id TEXT PRIMARY KEY,
                note_id TEXT NOT NULL,
                action TEXT NOT NULL,
                result TEXT NOT NULL,
                created_at INTEGER NOT NULL
            )
            """.trimIndent()
        )
        db.insertWithOnConflict("notebooks", null, ContentValues().apply {
            put("id", DEFAULT_NOTEBOOK_ID)
            put("name", "Inbox")
            put("created_at", System.currentTimeMillis())
        }, SQLiteDatabase.CONFLICT_IGNORE)
        seedDefaultTemplates(db)
    }

    private fun seedDefaultTemplates(db: SQLiteDatabase) {
        val templates = listOf(
            NoteTemplate("meeting-template", "Meeting notes", "Meeting notes", "Agenda\n- \n\nNotes\n- \n\nDecisions\n- \n\nAction items\n- [ ] "),
            NoteTemplate("project-template", "Project plan", "Project plan", "Goal\n\nMilestones\n- \n\nRisks\n- \n\nNext actions\n- [ ] "),
            NoteTemplate("daily-template", "Daily notes", "Daily notes", "Focus\n- \n\nNotes\n- \n\nTasks\n- [ ] "),
            NoteTemplate("receipt-template", "Receipt", "Receipt", "Vendor\n\nAmount\n\nDate\n\nNotes\n")
        )
        templates.forEach { template ->
            db.insertWithOnConflict("templates", null, ContentValues().apply {
                put("id", template.id)
                put("name", template.name)
                put("title", template.title)
                put("content", template.content)
                put("created_at", template.createdAt)
            }, SQLiteDatabase.CONFLICT_IGNORE)
        }
    }

    private fun addColumnIfMissing(db: SQLiteDatabase, table: String, column: String, definition: String) {
        val exists = db.rawQuery("PRAGMA table_info($table)", null).use { cursor ->
            var found = false
            while (cursor.moveToNext()) {
                if (cursor.getString(cursor.getColumnIndexOrThrow("name")) == column) found = true
            }
            found
        }
        if (!exists) db.execSQL("ALTER TABLE $table ADD COLUMN $column $definition")
    }

    fun listNotes(query: String = "", notebookId: String? = null, tagId: String? = null, includeArchived: Boolean = false): List<Note> {
        val selectionArgs = mutableListOf<String>()
        val queryBuilder = StringBuilder("n.is_deleted = 0")

        if (query.isNotBlank()) {
            val q = "%${query.lowercase()}%"
            queryBuilder.append(" AND (lower(n.title) LIKE ? OR lower(n.content) LIKE ? OR lower(a.file_name) LIKE ? OR lower(a.extracted_text) LIKE ?)")
            repeat(4) { selectionArgs.add(q) }
        }

        if (notebookId != null) {
            queryBuilder.append(" AND n.notebook_id = ?")
            selectionArgs.add(notebookId)
        }

        if (tagId != null) {
            queryBuilder.append(" AND nt.tag_id = ?")
            selectionArgs.add(tagId)
        }

        if (!includeArchived) {
            queryBuilder.append(" AND n.is_archived = 0")
        }

        val cursor = readableDatabase.rawQuery(
            """
            SELECT DISTINCT n.* FROM notes n
            LEFT JOIN attachments a ON a.note_id = n.id
            LEFT JOIN note_tags nt ON nt.note_id = n.id
            WHERE ${queryBuilder}
            ORDER BY n.is_pinned DESC, n.updated_at DESC
            """.trimIndent(),
            selectionArgs.toTypedArray()
        )
        return cursor.use {
            buildList {
                while (it.moveToNext()) add(cursorToNote(it))
            }
        }
    }

    fun getNote(id: String): Note? {
        return readableDatabase.query("notes", null, "id=?", arrayOf(id), null, null, null).use {
            if (it.moveToFirst()) cursorToNote(it) else null
        }
    }

    fun saveNote(note: Note): Note {
        val saved = note.copy(updatedAt = System.currentTimeMillis())
        writableDatabase.insertWithOnConflict("notes", null, saved.toValues(), SQLiteDatabase.CONFLICT_REPLACE)
        syncInlineTags(saved.id, saved.content)
        addSyncOperation("note", saved.id, if (saved.syncStatus == "pending_create") "create" else "update")
        return saved
    }

    fun createNote(title: String, content: String, type: String = "rich", sourceUrl: String? = null, notebookId: String = DEFAULT_NOTEBOOK_ID): Note {
        return saveNote(Note(UUID.randomUUID().toString(), title.ifBlank { "Untitled" }, content, type, sourceUrl, notebookId))
    }

    fun duplicateNote(id: String): Note? {
        val source = getNote(id) ?: return null
        return saveNote(source.copy(id = UUID.randomUUID().toString(), title = "${source.title} copy", createdAt = System.currentTimeMillis(), syncStatus = "pending_create"))
    }

    fun deleteNote(id: String) {
        val values = ContentValues().apply {
            put("is_deleted", 1)
            put("sync_status", "pending_delete")
            put("updated_at", System.currentTimeMillis())
        }
        writableDatabase.update("notes", values, "id=?", arrayOf(id))
        addSyncOperation("note", id, "delete")
    }

    fun archiveNote(id: String, archived: Boolean) {
        writableDatabase.update("notes", ContentValues().apply {
            put("is_archived", if (archived) 1 else 0)
            put("sync_status", "pending_update")
            put("updated_at", System.currentTimeMillis())
        }, "id=?", arrayOf(id))
        addSyncOperation("note", id, "update")
    }

    fun pinNote(id: String, pinned: Boolean) {
        writableDatabase.update("notes", ContentValues().apply {
            put("is_pinned", if (pinned) 1 else 0)
            put("sync_status", "pending_update")
            put("updated_at", System.currentTimeMillis())
        }, "id=?", arrayOf(id))
        addSyncOperation("note", id, "update")
    }

    fun createHistory(note: Note) {
        writableDatabase.insert("note_history", null, ContentValues().apply {
            put("id", UUID.randomUUID().toString())
            put("note_id", note.id)
            put("title", note.title)
            put("content", note.content)
            put("created_at", System.currentTimeMillis())
        })
    }

    fun listHistory(noteId: String): List<NoteHistoryItem> {
        return readableDatabase.query("note_history", null, "note_id=?", arrayOf(noteId), null, null, "created_at DESC", "30").use {
            buildList {
                while (it.moveToNext()) add(NoteHistoryItem(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    noteId = it.getString(it.getColumnIndexOrThrow("note_id")),
                    title = it.getString(it.getColumnIndexOrThrow("title")),
                    content = it.getString(it.getColumnIndexOrThrow("content")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
    }

    fun listNotebooks(): List<Notebook> {
        return readableDatabase.query("notebooks", null, null, null, null, null, "name ASC").use {
            buildList {
                while (it.moveToNext()) add(Notebook(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    name = it.getString(it.getColumnIndexOrThrow("name")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
    }

    fun addNotebook(name: String): Notebook {
        val notebook = Notebook(UUID.randomUUID().toString(), name.ifBlank { "Notebook" })
        writableDatabase.insert("notebooks", null, ContentValues().apply {
            put("id", notebook.id)
            put("name", notebook.name)
            put("created_at", notebook.createdAt)
        })
        return notebook
    }

    fun listTags(): List<TagItem> {
        return readableDatabase.query("tags", null, null, null, null, null, "name ASC").use {
            buildList {
                while (it.moveToNext()) add(TagItem(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    name = it.getString(it.getColumnIndexOrThrow("name"))
                ))
            }
        }
    }

    fun noteTags(noteId: String): List<TagItem> {
        return readableDatabase.rawQuery(
            "SELECT t.* FROM tags t INNER JOIN note_tags nt ON nt.tag_id = t.id WHERE nt.note_id = ? ORDER BY t.name",
            arrayOf(noteId)
        ).use {
            buildList {
                while (it.moveToNext()) add(TagItem(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    name = it.getString(it.getColumnIndexOrThrow("name"))
                ))
            }
        }
    }

    private fun syncInlineTags(noteId: String, content: String) {
        writableDatabase.delete("note_tags", "note_id=?", arrayOf(noteId))
        Regex("""(?<!\w)#([A-Za-z0-9_-]{2,40})""").findAll(content).map { it.groupValues[1].lowercase() }.distinct().forEach { name ->
            val tagId = readableDatabase.query("tags", arrayOf("id"), "name=?", arrayOf(name), null, null, null).use {
                if (it.moveToFirst()) it.getString(0) else UUID.randomUUID().toString().also { id ->
                    writableDatabase.insert("tags", null, ContentValues().apply {
                        put("id", id)
                        put("name", name)
                    })
                }
            }
            writableDatabase.insertWithOnConflict("note_tags", null, ContentValues().apply {
                put("note_id", noteId)
                put("tag_id", tagId)
            }, SQLiteDatabase.CONFLICT_IGNORE)
        }
    }

    fun addTask(noteId: String?, title: String, dueAt: Long? = null, reminderAt: Long? = null, priority: Int = 0): TaskItem {
        val task = TaskItem(UUID.randomUUID().toString(), noteId, title, dueAt = dueAt, reminderAt = reminderAt, priority = priority)
        writableDatabase.insert("tasks", null, ContentValues().apply {
            put("id", task.id)
            put("note_id", task.noteId)
            put("title", task.title)
            put("done", 0)
            put("due_at", task.dueAt)
            put("reminder_at", task.reminderAt)
            put("priority", task.priority)
        })
        addSyncOperation("task", task.id, "create")
        return task
    }

    fun listTasks(noteId: String? = null): List<TaskItem> {
        val selection = noteId?.let { "note_id=?" }
        val args = noteId?.let { arrayOf(it) }
        return readableDatabase.query("tasks", null, selection, args, null, null, "done ASC").use {
            buildList {
                while (it.moveToNext()) add(
                    TaskItem(
                        id = it.getString(it.getColumnIndexOrThrow("id")),
                        noteId = it.getString(it.getColumnIndexOrThrow("note_id")),
                        title = it.getString(it.getColumnIndexOrThrow("title")),
                        done = it.getInt(it.getColumnIndexOrThrow("done")) == 1,
                        dueAt = if (it.isNull(it.getColumnIndexOrThrow("due_at"))) null else it.getLong(it.getColumnIndexOrThrow("due_at")),
                        reminderAt = if (it.isNull(it.getColumnIndexOrThrow("reminder_at"))) null else it.getLong(it.getColumnIndexOrThrow("reminder_at")),
                        priority = it.getInt(it.getColumnIndexOrThrow("priority")),
                        completedAt = if (it.isNull(it.getColumnIndexOrThrow("completed_at"))) null else it.getLong(it.getColumnIndexOrThrow("completed_at"))
                    )
                )
            }
        }
    }

    fun toggleTask(id: String, done: Boolean) {
        writableDatabase.update("tasks", ContentValues().apply {
            put("done", if (done) 1 else 0)
            put("completed_at", if (done) System.currentTimeMillis() else null)
        }, "id=?", arrayOf(id))
        addSyncOperation("task", id, "update")
    }

    fun updateTaskSchedule(id: String, dueAt: Long?, reminderAt: Long?, priority: Int) {
        writableDatabase.update("tasks", ContentValues().apply {
            put("due_at", dueAt)
            put("reminder_at", reminderAt)
            put("priority", priority)
        }, "id=?", arrayOf(id))
        addSyncOperation("task", id, "update")
    }

    fun addAttachment(item: AttachmentItem) {
        writableDatabase.insertWithOnConflict("attachments", null, ContentValues().apply {
            put("id", item.id)
            put("note_id", item.noteId)
            put("file_name", item.fileName)
            put("mime_type", item.mimeType)
            put("local_path", item.localPath)
            put("extracted_text", item.extractedText)
            put("file_size", item.fileSize)
            put("preview_text", item.previewText)
        }, SQLiteDatabase.CONFLICT_REPLACE)
        addSyncOperation("attachment", item.id, "create")
    }

    fun listAttachments(noteId: String): List<AttachmentItem> {
        return readableDatabase.query("attachments", null, "note_id=?", arrayOf(noteId), null, null, "file_name ASC").use {
            buildList {
                while (it.moveToNext()) add(
                    AttachmentItem(
                        id = it.getString(it.getColumnIndexOrThrow("id")),
                        noteId = it.getString(it.getColumnIndexOrThrow("note_id")),
                        fileName = it.getString(it.getColumnIndexOrThrow("file_name")),
                        mimeType = it.getString(it.getColumnIndexOrThrow("mime_type")),
                        localPath = it.getString(it.getColumnIndexOrThrow("local_path")),
                        extractedText = it.getString(it.getColumnIndexOrThrow("extracted_text")),
                        fileSize = it.getLong(it.getColumnIndexOrThrow("file_size")),
                        previewText = it.getString(it.getColumnIndexOrThrow("preview_text"))
                    )
                )
            }
        }
    }

    fun listAllAttachments(): List<AttachmentItem> {
        return readableDatabase.query("attachments", null, null, null, null, null, "file_name ASC").use {
            buildList {
                while (it.moveToNext()) add(
                    AttachmentItem(
                        id = it.getString(it.getColumnIndexOrThrow("id")),
                        noteId = it.getString(it.getColumnIndexOrThrow("note_id")),
                        fileName = it.getString(it.getColumnIndexOrThrow("file_name")),
                        mimeType = it.getString(it.getColumnIndexOrThrow("mime_type")),
                        localPath = it.getString(it.getColumnIndexOrThrow("local_path")),
                        extractedText = it.getString(it.getColumnIndexOrThrow("extracted_text")),
                        fileSize = it.getLong(it.getColumnIndexOrThrow("file_size")),
                        previewText = it.getString(it.getColumnIndexOrThrow("preview_text"))
                    )
                )
            }
        }
    }

    fun addSavedSearch(name: String, query: String): SavedSearch {
        val saved = SavedSearch(UUID.randomUUID().toString(), name.ifBlank { query }, query)
        writableDatabase.insert("saved_searches", null, ContentValues().apply {
            put("id", saved.id)
            put("name", saved.name)
            put("query", saved.query)
            put("created_at", saved.createdAt)
        })
        return saved
    }

    fun listSavedSearches(): List<SavedSearch> {
        return readableDatabase.query("saved_searches", null, null, null, null, null, "created_at DESC").use {
            buildList {
                while (it.moveToNext()) add(SavedSearch(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    name = it.getString(it.getColumnIndexOrThrow("name")),
                    query = it.getString(it.getColumnIndexOrThrow("query")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
    }

    fun addCalendarLink(noteId: String, title: String, startsAt: Long, endsAt: Long? = null): CalendarLink {
        val link = CalendarLink(UUID.randomUUID().toString(), noteId, title, startsAt, endsAt)
        writableDatabase.insert("calendar_links", null, ContentValues().apply {
            put("id", link.id)
            put("note_id", link.noteId)
            put("title", link.title)
            put("starts_at", link.startsAt)
            put("ends_at", link.endsAt)
        })
        addSyncOperation("calendar_link", link.id, "create")
        return link
    }

    fun listCalendarLinks(noteId: String? = null): List<CalendarLink> {
        val selection = noteId?.let { "note_id=?" }
        val args = noteId?.let { arrayOf(it) }
        return readableDatabase.query("calendar_links", null, selection, args, null, null, "starts_at ASC").use {
            buildList {
                while (it.moveToNext()) add(CalendarLink(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    noteId = it.getString(it.getColumnIndexOrThrow("note_id")),
                    title = it.getString(it.getColumnIndexOrThrow("title")),
                    startsAt = it.getLong(it.getColumnIndexOrThrow("starts_at")),
                    endsAt = if (it.isNull(it.getColumnIndexOrThrow("ends_at"))) null else it.getLong(it.getColumnIndexOrThrow("ends_at"))
                ))
            }
        }
    }

    fun addSyncOperation(entityType: String, entityId: String, operation: String) {
        writableDatabase.insert("sync_ops", null, ContentValues().apply {
            put("id", UUID.randomUUID().toString())
            put("entity_type", entityType)
            put("entity_id", entityId)
            put("operation", operation)
            put("created_at", System.currentTimeMillis())
            put("status", "pending")
        })
    }

    fun listSyncOperations(status: String? = null): List<SyncOperation> {
        val selection = status?.let { "status=?" }
        val args = status?.let { arrayOf(it) }
        return readableDatabase.query("sync_ops", null, selection, args, null, null, "created_at DESC", "100").use {
            buildList {
                while (it.moveToNext()) add(SyncOperation(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    entityType = it.getString(it.getColumnIndexOrThrow("entity_type")),
                    entityId = it.getString(it.getColumnIndexOrThrow("entity_id")),
                    operation = it.getString(it.getColumnIndexOrThrow("operation")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at")),
                    status = it.getString(it.getColumnIndexOrThrow("status")),
                    error = it.getString(it.getColumnIndexOrThrow("error"))
                ))
            }
        }
    }

    fun markSyncOperation(id: String, status: String, error: String? = null) {
        writableDatabase.update("sync_ops", ContentValues().apply {
            put("status", status)
            put("error", error)
        }, "id=?", arrayOf(id))
    }

    fun listTemplates(): List<NoteTemplate> {
        return readableDatabase.query("templates", null, null, null, null, null, "name ASC").use {
            buildList {
                while (it.moveToNext()) add(NoteTemplate(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    name = it.getString(it.getColumnIndexOrThrow("name")),
                    title = it.getString(it.getColumnIndexOrThrow("title")),
                    content = it.getString(it.getColumnIndexOrThrow("content")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
    }

    fun addTemplate(name: String, title: String, content: String): NoteTemplate {
        val template = NoteTemplate(UUID.randomUUID().toString(), name.ifBlank { title.ifBlank { "Template" } }, title, content)
        writableDatabase.insert("templates", null, ContentValues().apply {
            put("id", template.id)
            put("name", template.name)
            put("title", template.title)
            put("content", template.content)
            put("created_at", template.createdAt)
        })
        addActivity(null, "template_created", template.name)
        return template
    }

    fun addShortcut(label: String, targetType: String, targetId: String): ShortcutItem {
        val shortcut = ShortcutItem(UUID.randomUUID().toString(), label, targetType, targetId)
        writableDatabase.insert("shortcuts", null, ContentValues().apply {
            put("id", shortcut.id)
            put("label", shortcut.label)
            put("target_type", shortcut.targetType)
            put("target_id", shortcut.targetId)
            put("created_at", shortcut.createdAt)
        })
        return shortcut
    }

    fun listShortcuts(): List<ShortcutItem> {
        return readableDatabase.query("shortcuts", null, null, null, null, null, "created_at DESC").use {
            buildList {
                while (it.moveToNext()) add(ShortcutItem(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    label = it.getString(it.getColumnIndexOrThrow("label")),
                    targetType = it.getString(it.getColumnIndexOrThrow("target_type")),
                    targetId = it.getString(it.getColumnIndexOrThrow("target_id")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
    }

    fun setPreference(key: String, value: String) {
        writableDatabase.insertWithOnConflict("preferences", null, ContentValues().apply {
            put("key", key)
            put("value", value)
        }, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun getPreference(key: String, defaultValue: String): String {
        return readableDatabase.query("preferences", arrayOf("value"), "key=?", arrayOf(key), null, null, null).use {
            if (it.moveToFirst()) it.getString(0) else defaultValue
        }
    }

    fun addComment(noteId: String, author: String, body: String): CommentItem {
        val comment = CommentItem(UUID.randomUUID().toString(), noteId, author.ifBlank { "Me" }, body)
        writableDatabase.insert("comments", null, ContentValues().apply {
            put("id", comment.id)
            put("note_id", comment.noteId)
            put("author", comment.author)
            put("body", comment.body)
            put("created_at", comment.createdAt)
        })
        addActivity(noteId, "comment_added", comment.body.take(80))
        addSyncOperation("comment", comment.id, "create")
        return comment
    }

    fun listComments(noteId: String): List<CommentItem> {
        return readableDatabase.query("comments", null, "note_id=?", arrayOf(noteId), null, null, "created_at DESC").use {
            buildList {
                while (it.moveToNext()) add(CommentItem(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    noteId = it.getString(it.getColumnIndexOrThrow("note_id")),
                    author = it.getString(it.getColumnIndexOrThrow("author")),
                    body = it.getString(it.getColumnIndexOrThrow("body")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
    }

    fun addShare(noteId: String, recipient: String, permission: String): SharePermission {
        val share = SharePermission(UUID.randomUUID().toString(), noteId, recipient, permission)
        writableDatabase.insert("share_permissions", null, ContentValues().apply {
            put("id", share.id)
            put("note_id", share.noteId)
            put("recipient", share.recipient)
            put("permission", share.permission)
            put("created_at", share.createdAt)
        })
        addActivity(noteId, "share_added", "${share.recipient} (${share.permission})")
        addSyncOperation("share", share.id, "create")
        return share
    }

    fun listShares(noteId: String): List<SharePermission> {
        return readableDatabase.query("share_permissions", null, "note_id=?", arrayOf(noteId), null, null, "created_at DESC").use {
            buildList {
                while (it.moveToNext()) add(SharePermission(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    noteId = it.getString(it.getColumnIndexOrThrow("note_id")),
                    recipient = it.getString(it.getColumnIndexOrThrow("recipient")),
                    permission = it.getString(it.getColumnIndexOrThrow("permission")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
    }

    fun addActivity(noteId: String?, action: String, detail: String): ActivityItem {
        val item = ActivityItem(UUID.randomUUID().toString(), noteId, action, detail)
        writableDatabase.insert("activity_log", null, ContentValues().apply {
            put("id", item.id)
            put("note_id", item.noteId)
            put("action", item.action)
            put("detail", item.detail)
            put("created_at", item.createdAt)
        })
        return item
    }

    fun listActivity(noteId: String? = null): List<ActivityItem> {
        val selection = noteId?.let { "note_id=?" }
        val args = noteId?.let { arrayOf(it) }
        return readableDatabase.query("activity_log", null, selection, args, null, null, "created_at DESC", "100").use {
            buildList {
                while (it.moveToNext()) add(ActivityItem(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    noteId = if (it.isNull(it.getColumnIndexOrThrow("note_id"))) null else it.getString(it.getColumnIndexOrThrow("note_id")),
                    action = it.getString(it.getColumnIndexOrThrow("action")),
                    detail = it.getString(it.getColumnIndexOrThrow("detail")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
    }

    fun addAiAction(noteId: String, action: String, result: String): AiActionItem {
        val item = AiActionItem(UUID.randomUUID().toString(), noteId, action, result)
        writableDatabase.insert("ai_actions", null, ContentValues().apply {
            put("id", item.id)
            put("note_id", item.noteId)
            put("action", item.action)
            put("result", item.result)
            put("created_at", item.createdAt)
        })
        addActivity(noteId, "ai_$action", result.take(80))
        return item
    }

    fun listAiActions(noteId: String): List<AiActionItem> {
        return readableDatabase.query("ai_actions", null, "note_id=?", arrayOf(noteId), null, null, "created_at DESC").use {
            buildList {
                while (it.moveToNext()) add(AiActionItem(
                    id = it.getString(it.getColumnIndexOrThrow("id")),
                    noteId = it.getString(it.getColumnIndexOrThrow("note_id")),
                    action = it.getString(it.getColumnIndexOrThrow("action")),
                    result = it.getString(it.getColumnIndexOrThrow("result")),
                    createdAt = it.getLong(it.getColumnIndexOrThrow("created_at"))
                ))
            }
        }
    }

    private fun cursorToNote(cursor: android.database.Cursor): Note {
        return Note(
            id = cursor.getString(cursor.getColumnIndexOrThrow("id")),
            title = cursor.getString(cursor.getColumnIndexOrThrow("title")),
            content = cursor.getString(cursor.getColumnIndexOrThrow("content")),
            type = cursor.getString(cursor.getColumnIndexOrThrow("type")),
            sourceUrl = cursor.getString(cursor.getColumnIndexOrThrow("source_url")),
            notebookId = cursor.getString(cursor.getColumnIndexOrThrow("notebook_id")),
            isPinned = cursor.getInt(cursor.getColumnIndexOrThrow("is_pinned")) == 1,
            isArchived = cursor.getInt(cursor.getColumnIndexOrThrow("is_archived")) == 1,
            isDeleted = cursor.getInt(cursor.getColumnIndexOrThrow("is_deleted")) == 1,
            createdAt = cursor.getLong(cursor.getColumnIndexOrThrow("created_at")),
            updatedAt = cursor.getLong(cursor.getColumnIndexOrThrow("updated_at")),
            syncStatus = cursor.getString(cursor.getColumnIndexOrThrow("sync_status"))
        )
    }

    private fun Note.toValues(): ContentValues = ContentValues().apply {
        put("id", id)
        put("title", title)
        put("content", content)
        put("type", type)
        put("source_url", sourceUrl)
        put("notebook_id", notebookId)
        put("is_pinned", if (isPinned) 1 else 0)
        put("is_archived", if (isArchived) 1 else 0)
        put("is_deleted", if (isDeleted) 1 else 0)
        put("created_at", createdAt)
        put("updated_at", updatedAt)
        put("sync_status", syncStatus)
    }
}
