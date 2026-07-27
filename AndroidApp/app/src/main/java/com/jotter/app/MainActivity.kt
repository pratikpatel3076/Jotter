package com.jotter.app

import android.app.AlertDialog
import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.provider.CalendarContract
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.text.Editable
import android.text.TextWatcher
import android.view.View
import android.view.inputmethod.InputMethodManager
import android.content.Context
import android.widget.*
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import com.google.android.material.floatingactionbutton.FloatingActionButton
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.text.DateFormat
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Locale

class MainActivity : AppCompatActivity() {
    private lateinit var db: JotterDb
    private lateinit var attachmentStore: AttachmentStore
    private lateinit var syncClient: SyncClient
    private lateinit var list: LinearLayout
    private lateinit var search: EditText
    private var activeNote: Note? = null
    private val autosaveHandler = Handler(Looper.getMainLooper())
    private var autosaveTask: Runnable? = null
    private var selectedNotebookId: String? = null
    private var selectedTagId: String? = null
    private var includeArchived = false
    private val undoStack = mutableListOf<Pair<String, String>>()
    private val redoStack = mutableListOf<Pair<String, String>>()
    private var suppressEditorHistory = false
    private var lastHistoryAt = 0L

    private val pickAttachment = registerForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        val note = activeNote ?: return@registerForActivityResult
        if (uri != null) {
            val item = attachmentStore.importUri(note.id, uri)
            db.addAttachment(item)
            openEditor(note.id)
        }
    }

    private val capturePhoto = registerForActivityResult(ActivityResultContracts.TakePicturePreview()) { bitmap ->
        val note = activeNote ?: return@registerForActivityResult
        if (bitmap != null) {
            db.addAttachment(attachmentStore.importBitmap(note.id, bitmap))
            openEditor(note.id)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        db = JotterDb(this)
        attachmentStore = AttachmentStore(this)
        syncClient = SyncClient(this)
        handleShareIntent(intent)
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (activeNote != null) {
                    flushAutosave()
                    showHome()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
        showHome()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleShareIntent(intent)
        showHome()
    }

    private fun handleShareIntent(intent: Intent) {
        if (intent.action != Intent.ACTION_SEND) return
        val text = intent.getStringExtra(Intent.EXTRA_TEXT)
        val title = intent.getStringExtra(Intent.EXTRA_TITLE) ?: "Web clip"
        val stream = intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
        if (!text.isNullOrBlank()) {
            db.createNote(title, text, "webclip", text.takeIf { it.startsWith("http") })
        } else if (stream != null) {
            val note = db.createNote("Shared attachment", "", "file")
            db.addAttachment(attachmentStore.importUri(note.id, stream))
        }
    }

    private fun showHome() {
        activeNote = null
        val root = vertical()
        val header = horizontal().apply {
            setPadding(dp(16), dp(14), dp(16), dp(8))
            gravity = android.view.Gravity.CENTER_VERTICAL
        }
        TextView(this).apply {
            text = "Jotter"
            textSize = 22f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            header.addView(this, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        Button(this).apply {
            text = "Sync"
            setOnClickListener { syncAll() }
            header.addView(this)
        }
        Button(this).apply {
            text = "Tasks"
            setOnClickListener { showTasks() }
            header.addView(this)
        }
        Button(this).apply {
            text = "Dashboard"
            setOnClickListener { showDashboard() }
            header.addView(this)
        }
        Button(this).apply {
            text = "More"
            setOnClickListener { moreDialog() }
            header.addView(this)
        }
        root.addView(header)

        val filters = horizontal().apply {
            setPadding(dp(12), 0, dp(12), dp(8))
            gravity = android.view.Gravity.CENTER_VERTICAL
        }
        val notebooks = listOf(Notebook("", "All notebooks")) + db.listNotebooks()
        Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, notebooks.map { it.name })
            val selectedIndex = notebooks.indexOfFirst { it.id == (selectedNotebookId ?: "") }.coerceAtLeast(0)
            setSelection(selectedIndex)
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    selectedNotebookId = notebooks[position].id.ifBlank { null }
                    if (::list.isInitialized) refreshList()
                }
                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            }
            filters.addView(this, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        Button(this).apply {
            text = "+"
            setOnClickListener { addNotebookDialog() }
            filters.addView(this)
        }
        root.addView(filters)

        val tagFilters = horizontal().apply {
            setPadding(dp(12), 0, dp(12), dp(8))
            gravity = android.view.Gravity.CENTER_VERTICAL
        }
        val tags = listOf(TagItem("", "All tags")) + db.listTags()
        Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, tags.map { if (it.id.isBlank()) it.name else "#${it.name}" })
            val selectedIndex = tags.indexOfFirst { it.id == (selectedTagId ?: "") }.coerceAtLeast(0)
            setSelection(selectedIndex)
            onItemSelectedListener = object : AdapterView.OnItemSelectedListener {
                override fun onItemSelected(parent: AdapterView<*>?, view: View?, position: Int, id: Long) {
                    selectedTagId = tags[position].id.ifBlank { null }
                    if (::list.isInitialized) refreshList()
                }
                override fun onNothingSelected(parent: AdapterView<*>?) = Unit
            }
            tagFilters.addView(this, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
        }
        CheckBox(this).apply {
            text = "Archived"
            isChecked = includeArchived
            setOnCheckedChangeListener { _, checked ->
                includeArchived = checked
                refreshList()
            }
            tagFilters.addView(this)
        }
        root.addView(tagFilters)

        search = EditText(this).apply {
            hint = "Search notes, PDFs, images, attachments"
            setSingleLine(true)
            setPadding(dp(16), 0, dp(16), 0)
            setOnEditorActionListener { _, _, _ -> refreshList(); hideKeyboard(); true }
            addTextChangedListener(object : TextWatcher {
                override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) = Unit
                override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = refreshList()
                override fun afterTextChanged(s: Editable?) = Unit
            })
        }
        root.addView(search)

        val scroll = ScrollView(this)
        list = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(12), dp(8), dp(12), dp(96))
        }
        scroll.addView(list)
        root.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        val fab = FloatingActionButton(this).apply {
            setImageResource(android.R.drawable.ic_input_add)
            setOnClickListener { templatePickerDialog() }
        }
        val frame = FrameLayout(this)
        frame.addView(root)
        frame.addView(fab, FrameLayout.LayoutParams(FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, android.view.Gravity.BOTTOM or android.view.Gravity.END).apply {
            setMargins(0, 0, dp(20), dp(20))
        })
        setContentView(frame)
        refreshList()
    }

    private fun refreshList() {
        list.removeAllViews()
        db.listNotes(search.text.toString(), selectedNotebookId, selectedTagId, includeArchived).forEach { note ->
            list.addView(noteRow(note))
        }
    }

    private fun noteRow(note: Note): View {
        return vertical().apply {
            setPadding(dp(14), dp(12), dp(14), dp(12))
            background = android.graphics.drawable.GradientDrawable().apply {
                cornerRadius = dp(14).toFloat()
                setColor(0xFF1C1C22.toInt())
            }
            val title = TextView(context).apply {
                text = note.title.ifBlank { "Untitled" }
                textSize = 16f
                setTypeface(typeface, android.graphics.Typeface.BOLD)
            }
            val body = TextView(context).apply {
                text = note.content.take(160)
                textSize = 13f
                setTextColor(0xFFB8B8C2.toInt())
            }
            val meta = TextView(context).apply {
                val tags = db.noteTags(note.id).joinToString(" ") { "#${it.name}" }
                text = listOf(note.type, tags, DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(note.updatedAt))
                    .filter { it.isNotBlank() }
                    .joinToString(" · ")
                textSize = 11f
                setTextColor(0xFF8B8B96.toInt())
            }
            val actions = horizontal()
            Button(context).apply {
                text = if (note.isPinned) "Unpin" else "Pin"
                setOnClickListener {
                    db.pinNote(note.id, !note.isPinned)
                    refreshList()
                }
                actions.addView(this)
            }
            Button(context).apply {
                text = if (note.isArchived) "Unarchive" else "Archive"
                setOnClickListener {
                    db.archiveNote(note.id, !note.isArchived)
                    refreshList()
                }
                actions.addView(this)
            }
            Button(context).apply {
                text = "Copy"
                setOnClickListener {
                    db.duplicateNote(note.id)
                    refreshList()
                }
                actions.addView(this)
            }
            Button(context).apply {
                text = "Delete"
                setOnClickListener {
                    db.deleteNote(note.id)
                    refreshList()
                }
                actions.addView(this)
            }
            addView(title)
            if (note.content.isNotBlank()) addView(body)
            addView(meta)
            addView(actions)
            setOnClickListener { openEditor(note.id) }
            (layoutParams as? LinearLayout.LayoutParams)?.setMargins(0, 0, 0, dp(8))
        }.also {
            it.layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
                setMargins(0, 0, 0, dp(8))
            }
        }
    }

    private fun openEditor(noteId: String) {
        val note = db.getNote(noteId) ?: return
        activeNote = note
        autosaveTask?.let { autosaveHandler.removeCallbacks(it) }
        undoStack.clear()
        redoStack.clear()
        lastHistoryAt = 0L
        val root = vertical().apply { setPadding(dp(16), dp(12), dp(16), dp(12)) }
        val top = horizontal()
        Button(this).apply {
            text = "Back"
            setOnClickListener { flushAutosave(); showHome() }
            top.addView(this)
        }
        Button(this).apply {
            text = "Notebook"
            setOnClickListener { moveNotebookDialog(note.id) }
            top.addView(this)
        }
        Button(this).apply {
            text = if (note.isPinned) "Unpin" else "Pin"
            setOnClickListener {
                flushAutosave()
                db.pinNote(note.id, !note.isPinned)
                openEditor(note.id)
            }
            top.addView(this)
        }
        Button(this).apply {
            text = "History"
            setOnClickListener { historyDialog(note.id) }
            top.addView(this)
        }
        Button(this).apply {
            text = "Attach"
            setOnClickListener { pickAttachment.launch("*/*") }
            top.addView(this)
        }
        Button(this).apply {
            text = "Photo"
            setOnClickListener { capturePhoto.launch(null) }
            top.addView(this)
        }
        Button(this).apply {
            text = "Audio"
            setOnClickListener { pickAttachment.launch("audio/*") }
            top.addView(this)
        }
        Button(this).apply {
            text = "Task"
            setOnClickListener { addTaskDialog(note.id) }
            top.addView(this)
        }
        Button(this).apply {
            text = "Calendar"
            setOnClickListener { addCalendarDialog(note.id) }
            top.addView(this)
        }
        Button(this).apply {
            text = "AI"
            setOnClickListener { aiDialog(note.id) }
            top.addView(this)
        }
        Button(this).apply {
            text = "Team"
            setOnClickListener { collaborationDialog(note.id) }
            top.addView(this)
        }
        Button(this).apply {
            text = "Share"
            setOnClickListener { shareDialog(note) }
            top.addView(this)
        }
        root.addView(top)

        val editActions = horizontal()
        lateinit var title: EditText
        lateinit var content: EditText
        fun currentSnapshot() = title.text.toString() to content.text.toString()
        fun applySnapshot(snapshot: Pair<String, String>) {
            suppressEditorHistory = true
            title.setText(snapshot.first)
            content.setText(snapshot.second)
            title.setSelection(title.text.length)
            content.setSelection(content.text.length)
            suppressEditorHistory = false
            scheduleAutosave(note.id, title, content)
        }
        Button(this).apply {
            text = "Undo"
            setOnClickListener {
                if (undoStack.isNotEmpty()) {
                    redoStack.add(currentSnapshot())
                    applySnapshot(undoStack.removeAt(undoStack.lastIndex))
                }
            }
            editActions.addView(this)
        }
        Button(this).apply {
            text = "Redo"
            setOnClickListener {
                if (redoStack.isNotEmpty()) {
                    undoStack.add(currentSnapshot())
                    applySnapshot(redoStack.removeAt(redoStack.lastIndex))
                }
            }
            editActions.addView(this)
        }
        Button(this).apply {
            text = if (note.isArchived) "Unarchive" else "Archive"
            setOnClickListener {
                flushAutosave()
                db.archiveNote(note.id, !note.isArchived)
                showHome()
            }
            editActions.addView(this)
        }
        Button(this).apply {
            text = "Delete"
            setOnClickListener {
                db.deleteNote(note.id)
                showHome()
            }
            editActions.addView(this)
        }
        root.addView(editActions)

        title = EditText(this).apply {
            hint = "Title"
            textSize = 22f
            setText(note.title)
        }
        content = EditText(this).apply {
            hint = "Start writing"
            minLines = 10
            gravity = android.view.Gravity.TOP
            setText(note.content)
        }
        root.addView(title)
        root.addView(content, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))

        val details = TextView(this).apply {
            text = buildString {
                val tasks = db.listTasks(note.id)
                val attachments = db.listAttachments(note.id)
                val events = db.listCalendarLinks(note.id)
                val tags = db.noteTags(note.id)
                val comments = db.listComments(note.id)
                val shares = db.listShares(note.id)
                append("Auto-saving")
                if (tags.isNotEmpty()) append("\nTags: ").append(tags.joinToString(" ") { "#${it.name}" })
                if (note.sourceUrl != null) append("\nSource: ").append(note.sourceUrl)
                if (events.isNotEmpty()) append("\n\nCalendar\n").append(events.joinToString("\n") { "${it.title} - ${formatDateTime(it.startsAt)}" })
                if (tasks.isNotEmpty()) append("\n\nTasks\n").append(tasks.joinToString("\n") { taskLine(it) })
                if (attachments.isNotEmpty()) append("\n\nAttachments\n").append(attachments.joinToString("\n") { "${it.fileName} (${it.mimeType}, ${it.fileSize} bytes)\n${it.previewText}" })
                if (shares.isNotEmpty()) append("\n\nShared with\n").append(shares.joinToString("\n") { "${it.recipient} (${it.permission})" })
                if (comments.isNotEmpty()) append("\n\nComments\n").append(comments.joinToString("\n") { "${it.author}: ${it.body}" })
            }
            setTextColor(0xFFB8B8C2.toInt())
        }
        root.addView(details)

        val watcher = object : TextWatcher {
            private var before = note.title to note.content

            override fun beforeTextChanged(s: CharSequence?, start: Int, count: Int, after: Int) {
                if (!suppressEditorHistory) before = currentSnapshot()
            }

            override fun onTextChanged(s: CharSequence?, start: Int, before: Int, count: Int) = Unit

            override fun afterTextChanged(s: Editable?) {
                if (suppressEditorHistory) return
                if (undoStack.lastOrNull() != before) {
                    undoStack.add(before)
                    if (undoStack.size > 100) undoStack.removeAt(0)
                }
                redoStack.clear()
                scheduleAutosave(note.id, title, content)
            }
        }
        title.addTextChangedListener(watcher)
        content.addTextChangedListener(watcher)
        setContentView(root)
    }

    private fun scheduleAutosave(noteId: String, title: EditText, content: EditText) {
        autosaveTask?.let { autosaveHandler.removeCallbacks(it) }
        autosaveTask = Runnable {
            val current = db.getNote(noteId) ?: return@Runnable
            val newTitle = title.text.toString().ifBlank { "Untitled" }
            val newContent = content.text.toString()
            if (current.title == newTitle && current.content == newContent) return@Runnable
            val now = System.currentTimeMillis()
            if (now - lastHistoryAt > 30_000) {
                db.createHistory(current)
                lastHistoryAt = now
            }
            activeNote = db.saveNote(current.copy(title = newTitle, content = newContent, syncStatus = "pending_update"))
        }
        autosaveHandler.postDelayed(autosaveTask!!, 800)
    }

    private fun flushAutosave() {
        autosaveTask?.let {
            autosaveHandler.removeCallbacks(it)
            it.run()
        }
        autosaveTask = null
    }

    private fun addNotebookDialog() {
        val input = EditText(this).apply { hint = "Notebook name" }
        AlertDialog.Builder(this)
            .setTitle("New notebook")
            .setView(input)
            .setPositiveButton("Create") { _, _ ->
                val notebook = db.addNotebook(input.text.toString())
                selectedNotebookId = notebook.id
                showHome()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun moveNotebookDialog(noteId: String) {
        val notebooks = db.listNotebooks()
        AlertDialog.Builder(this)
            .setTitle("Move to notebook")
            .setItems(notebooks.map { it.name }.toTypedArray()) { _, which ->
                val note = db.getNote(noteId) ?: return@setItems
                db.saveNote(note.copy(notebookId = notebooks[which].id, syncStatus = "pending_update"))
                openEditor(noteId)
            }
            .show()
    }

    private fun historyDialog(noteId: String) {
        flushAutosave()
        val history = db.listHistory(noteId)
        if (history.isEmpty()) {
            Toast.makeText(this, "No history yet", Toast.LENGTH_SHORT).show()
            return
        }
        val labels = history.map {
            DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(it.createdAt)
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Restore history")
            .setItems(labels) { _, which ->
                val current = db.getNote(noteId) ?: return@setItems
                db.createHistory(current)
                db.saveNote(current.copy(title = history[which].title, content = history[which].content, syncStatus = "pending_update"))
                openEditor(noteId)
            }
            .show()
    }

    private fun showDashboard() {
        activeNote = null
        val root = vertical().apply { setPadding(dp(16), dp(12), dp(16), dp(12)) }
        val header = horizontal()
        Button(this).apply {
            text = "Back"
            setOnClickListener { showHome() }
            header.addView(this)
        }
        TextView(this).apply {
            text = "Dashboard"
            textSize = 22f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            header.addView(this)
        }
        root.addView(header)

        val body = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        val notes = db.listNotes(includeArchived = false)
        val pinned = notes.filter { it.isPinned }
        val tasks = db.listTasks().filter { !it.done }
        val events = db.listCalendarLinks().filter { it.startsAt >= System.currentTimeMillis() }.take(5)
        val shortcuts = db.listShortcuts()
        dashboardSection(body, "Shortcuts", shortcuts.map { shortcut ->
            "${shortcut.label} (${shortcut.targetType})" to { openShortcut(shortcut) }
        })
        dashboardSection(body, "Pinned", pinned.take(5).map { it.title to { openEditor(it.id) } })
        dashboardSection(body, "Recent", notes.take(8).map { it.title to { openEditor(it.id) } })
        dashboardSection(body, "Due tasks", tasks.take(8).map { taskLine(it) to { it.noteId?.let { noteId -> openEditor(noteId) } ?: showTasks() } })
        dashboardSection(body, "Agenda", events.map { "${formatDateTime(it.startsAt)} ${it.title}" to { openEditor(it.noteId) } })
        val scroll = ScrollView(this)
        scroll.addView(body)
        root.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun dashboardSection(parent: LinearLayout, title: String, rows: List<Pair<String, () -> Unit>>) {
        TextView(this).apply {
            text = title
            textSize = 18f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            setPadding(0, dp(14), 0, dp(4))
            parent.addView(this)
        }
        if (rows.isEmpty()) {
            TextView(this).apply {
                text = "Nothing here"
                setTextColor(0xFF8B8B96.toInt())
                parent.addView(this)
            }
            return
        }
        rows.forEach { row ->
            Button(this).apply {
                text = row.first
                setOnClickListener { row.second.invoke() }
                parent.addView(this)
            }
        }
    }

    private fun openShortcut(shortcut: ShortcutItem) {
        when (shortcut.targetType) {
            "note" -> openEditor(shortcut.targetId)
            "notebook" -> {
                selectedNotebookId = shortcut.targetId
                showHome()
            }
            "tag" -> {
                selectedTagId = shortcut.targetId
                showHome()
            }
        }
    }

    private fun templatePickerDialog() {
        val templates = db.listTemplates()
        val labels = arrayOf("Blank note") + templates.map { it.name }
        AlertDialog.Builder(this)
            .setTitle("New note")
            .setItems(labels) { _, which ->
                val note = if (which == 0) {
                    db.createNote("", "", notebookId = selectedNotebookId ?: JotterDb.DEFAULT_NOTEBOOK_ID)
                } else {
                    val template = templates[which - 1]
                    db.createNote(template.title, template.content, "template", notebookId = selectedNotebookId ?: JotterDb.DEFAULT_NOTEBOOK_ID)
                }
                openEditor(note.id)
            }
            .show()
    }

    private fun createTemplateFromNote(noteId: String) {
        val note = db.getNote(noteId) ?: return
        val input = EditText(this).apply {
            hint = "Template name"
            setText(note.title)
        }
        AlertDialog.Builder(this)
            .setTitle("Create template")
            .setView(input)
            .setPositiveButton("Create") { _, _ ->
                db.addTemplate(input.text.toString(), note.title, note.content)
                Toast.makeText(this, "Template created", Toast.LENGTH_SHORT).show()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun collaborationDialog(noteId: String) {
        AlertDialog.Builder(this)
            .setTitle("Team")
            .setItems(arrayOf("Share permission", "Add comment", "Activity", "Add shortcut", "Create template")) { _, which ->
                when (which) {
                    0 -> addShareDialog(noteId)
                    1 -> addCommentDialog(noteId)
                    2 -> activityDialog(noteId)
                    3 -> addShortcutDialog(noteId)
                    4 -> createTemplateFromNote(noteId)
                }
            }
            .show()
    }

    private fun addShareDialog(noteId: String) {
        val root = vertical().apply { setPadding(dp(16), dp(8), dp(16), dp(8)) }
        val recipient = EditText(this).apply { hint = "Email or name" }
        val permission = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, listOf("view", "edit"))
        }
        root.addView(recipient)
        root.addView(permission)
        AlertDialog.Builder(this)
            .setTitle("Share note")
            .setView(root)
            .setPositiveButton("Share") { _, _ ->
                db.addShare(noteId, recipient.text.toString(), permission.selectedItem.toString())
                openEditor(noteId)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun addCommentDialog(noteId: String) {
        val input = EditText(this).apply { hint = "Comment" }
        AlertDialog.Builder(this)
            .setTitle("Add comment")
            .setView(input)
            .setPositiveButton("Add") { _, _ ->
                db.addComment(noteId, "Me", input.text.toString())
                openEditor(noteId)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun addShortcutDialog(noteId: String) {
        val note = db.getNote(noteId) ?: return
        db.addShortcut(note.title, "note", note.id)
        Toast.makeText(this, "Shortcut added", Toast.LENGTH_SHORT).show()
    }

    private fun activityDialog(noteId: String? = null) {
        val items = db.listActivity(noteId)
        val labels = items.map { "${formatDateTime(it.createdAt)} ${it.action}\n${it.detail}" }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Activity")
            .setItems(if (labels.isEmpty()) arrayOf("No activity") else labels, null)
            .show()
    }

    private fun aiDialog(noteId: String) {
        AlertDialog.Builder(this)
            .setTitle("AI assistant")
            .setItems(arrayOf("Summarize", "Extract action items", "Rewrite clearly", "Auto-tag", "Ask current note", "AI history")) { _, which ->
                when (which) {
                    0 -> showAiResult(noteId, "summary", summarizeNote(noteId), applyToNote = false)
                    1 -> showAiResult(noteId, "action_items", extractActionItems(noteId), applyToNote = true)
                    2 -> showAiResult(noteId, "rewrite", rewriteNote(noteId), applyToNote = true)
                    3 -> showAiResult(noteId, "auto_tag", autoTagNote(noteId), applyToNote = true)
                    4 -> askNoteDialog(noteId)
                    5 -> aiHistoryDialog(noteId)
                }
            }
            .show()
    }

    private fun showAiResult(noteId: String, action: String, result: String, applyToNote: Boolean) {
        db.addAiAction(noteId, action, result)
        val builder = AlertDialog.Builder(this)
            .setTitle(action.replace('_', ' '))
            .setMessage(result)
            .setNegativeButton("Close", null)
        if (applyToNote) {
            builder.setPositiveButton("Append") { _, _ ->
                val note = db.getNote(noteId) ?: return@setPositiveButton
                db.saveNote(note.copy(content = note.content.trimEnd() + "\n\n" + result, syncStatus = "pending_update"))
                openEditor(noteId)
            }
        }
        builder.show()
    }

    private fun summarizeNote(noteId: String): String {
        val note = db.getNote(noteId) ?: return "No note found."
        val sentences = note.content.split(Regex("""(?<=[.!?])\s+|\n+""")).map { it.trim() }.filter { it.isNotBlank() }
        return if (sentences.isEmpty()) "This note is empty." else sentences.take(3).joinToString("\n- ", prefix = "- ")
    }

    private fun extractActionItems(noteId: String): String {
        val note = db.getNote(noteId) ?: return "No note found."
        val lines = note.content.lines().map { it.trim() }.filter { it.isNotBlank() }
        val candidates = lines.filter {
            it.contains("todo", true) || it.contains("follow", true) || it.contains("call", true) || it.contains("send", true) || it.startsWith("- [ ]")
        }.ifEmpty { lines.take(3) }
        return candidates.joinToString("\n") { "- [ ] ${it.removePrefix("- [ ]").trim()}" }
    }

    private fun rewriteNote(noteId: String): String {
        val note = db.getNote(noteId) ?: return "No note found."
        return note.content.lines()
            .map { it.trim() }
            .filter { it.isNotBlank() }
            .joinToString("\n") { line -> line.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.US) else it.toString() } }
    }

    private fun autoTagNote(noteId: String): String {
        val note = db.getNote(noteId) ?: return ""
        val text = "${note.title} ${note.content}".lowercase()
        val tags = buildList {
            if ("meeting" in text || "agenda" in text) add("#meeting")
            if ("receipt" in text || "invoice" in text || "amount" in text) add("#finance")
            if ("todo" in text || "task" in text || "- [ ]" in text) add("#tasks")
            if ("project" in text || "milestone" in text) add("#project")
        }.ifEmpty { listOf("#note") }
        return tags.joinToString(" ")
    }

    private fun askNoteDialog(noteId: String) {
        val input = EditText(this).apply { hint = "Question" }
        AlertDialog.Builder(this)
            .setTitle("Ask current note")
            .setView(input)
            .setPositiveButton("Ask") { _, _ ->
                val note = db.getNote(noteId) ?: return@setPositiveButton
                val terms = input.text.toString().lowercase().split(Regex("""\s+""")).filter { it.length > 2 }
                val answer = note.content.lines().filter { line -> terms.any { line.contains(it, true) } }.take(6).joinToString("\n").ifBlank { "No direct match found in this note." }
                showAiResult(noteId, "ask", answer, applyToNote = false)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun aiHistoryDialog(noteId: String) {
        val items = db.listAiActions(noteId)
        val labels = items.map { "${formatDateTime(it.createdAt)} ${it.action}\n${it.result.take(160)}" }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("AI history")
            .setItems(if (labels.isEmpty()) arrayOf("No AI actions") else labels, null)
            .show()
    }

    private fun moreDialog() {
        AlertDialog.Builder(this)
            .setTitle("More")
            .setItems(arrayOf("Saved searches", "Save current search", "Attachment OCR queue", "Calendar agenda", "Sync queue", "Export backup", "Templates", "Settings", "Activity")) { _, which ->
                when (which) {
                    0 -> savedSearchesDialog()
                    1 -> saveCurrentSearchDialog()
                    2 -> attachmentQueueDialog()
                    3 -> calendarAgendaDialog()
                    4 -> syncQueueDialog()
                    5 -> exportBackup()
                    6 -> templatesDialog()
                    7 -> settingsDialog()
                    8 -> activityDialog()
                }
            }
            .show()
    }

    private fun showTasks() {
        activeNote = null
        val root = vertical().apply { setPadding(dp(16), dp(12), dp(16), dp(12)) }
        val header = horizontal()
        Button(this).apply {
            text = "Back"
            setOnClickListener { showHome() }
            header.addView(this)
        }
        TextView(this).apply {
            text = "Tasks"
            textSize = 22f
            setTypeface(typeface, android.graphics.Typeface.BOLD)
            header.addView(this)
        }
        root.addView(header)
        val scroll = ScrollView(this)
        val rows = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
        db.listTasks().forEach { task ->
            val row = horizontal().apply { setPadding(0, dp(6), 0, dp(6)) }
            CheckBox(this).apply {
                text = taskLine(task)
                isChecked = task.done
                setOnCheckedChangeListener { _, checked ->
                    db.toggleTask(task.id, checked)
                    showTasks()
                }
                row.addView(this, LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f))
            }
            Button(this).apply {
                text = "Open"
                setOnClickListener { task.noteId?.let { openEditor(it) } }
                row.addView(this)
            }
            Button(this).apply {
                text = "Edit"
                setOnClickListener { editTaskDialog(task) }
                row.addView(this)
            }
            rows.addView(row)
        }
        scroll.addView(rows)
        root.addView(scroll, LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 0, 1f))
        setContentView(root)
    }

    private fun addTaskDialog(noteId: String) {
        val input = EditText(this).apply { hint = "Task title" }
        AlertDialog.Builder(this)
            .setTitle("Add task")
            .setView(input)
            .setPositiveButton("Add") { _, _ ->
                val task = db.addTask(noteId, input.text.toString())
                editTaskDialog(task)
                openEditor(noteId)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun editTaskDialog(task: TaskItem) {
        val root = vertical().apply { setPadding(dp(16), dp(8), dp(16), dp(8)) }
        val due = EditText(this).apply {
            hint = "Due: yyyy-MM-dd HH:mm"
            setText(task.dueAt?.let { formatInputDateTime(it) } ?: "")
        }
        val reminder = EditText(this).apply {
            hint = "Reminder: yyyy-MM-dd HH:mm"
            setText(task.reminderAt?.let { formatInputDateTime(it) } ?: "")
        }
        val priority = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, listOf("Normal", "Medium", "High"))
            setSelection(task.priority.coerceIn(0, 2))
        }
        root.addView(due)
        root.addView(reminder)
        root.addView(priority)
        AlertDialog.Builder(this)
            .setTitle("Task schedule")
            .setView(root)
            .setPositiveButton("Save") { _, _ ->
                val dueAt = parseInputDateTime(due.text.toString())
                val reminderAt = parseInputDateTime(reminder.text.toString())
                db.updateTaskSchedule(task.id, dueAt, reminderAt, priority.selectedItemPosition)
                if (reminderAt != null) scheduleTaskReminder(task, reminderAt)
                task.noteId?.let { openEditor(it) } ?: showTasks()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun addCalendarDialog(noteId: String) {
        val root = vertical().apply { setPadding(dp(16), dp(8), dp(16), dp(8)) }
        val title = EditText(this).apply { hint = "Event title" }
        val startsAt = EditText(this).apply { hint = "Starts: yyyy-MM-dd HH:mm" }
        root.addView(title)
        root.addView(startsAt)
        AlertDialog.Builder(this)
            .setTitle("Link calendar event")
            .setView(root)
            .setPositiveButton("Add") { _, _ ->
                val start = parseInputDateTime(startsAt.text.toString()) ?: System.currentTimeMillis()
                db.addCalendarLink(noteId, title.text.toString().ifBlank { "Meeting note" }, start)
                val note = db.getNote(noteId)
                val calendarIntent = Intent(Intent.ACTION_INSERT).setData(CalendarContract.Events.CONTENT_URI)
                    .putExtra(CalendarContract.Events.TITLE, title.text.toString().ifBlank { note?.title ?: "Jotter event" })
                    .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
                startActivity(calendarIntent)
                openEditor(noteId)
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun savedSearchesDialog() {
        val searches = db.listSavedSearches()
        if (searches.isEmpty()) {
            Toast.makeText(this, "No saved searches", Toast.LENGTH_SHORT).show()
            return
        }
        AlertDialog.Builder(this)
            .setTitle("Saved searches")
            .setItems(searches.map { it.name }.toTypedArray()) { _, which ->
                search.setText(searches[which].query)
                refreshList()
            }
            .show()
    }

    private fun saveCurrentSearchDialog() {
        val query = if (::search.isInitialized) search.text.toString() else ""
        if (query.isBlank()) {
            Toast.makeText(this, "Search text is empty", Toast.LENGTH_SHORT).show()
            return
        }
        val input = EditText(this).apply {
            hint = "Saved search name"
            setText(query)
        }
        AlertDialog.Builder(this)
            .setTitle("Save search")
            .setView(input)
            .setPositiveButton("Save") { _, _ -> db.addSavedSearch(input.text.toString(), query) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun templatesDialog() {
        val templates = db.listTemplates()
        val labels = templates.map { "${it.name}\n${it.title}" }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Templates")
            .setItems(if (labels.isEmpty()) arrayOf("No templates") else labels) { _, which ->
                if (templates.isNotEmpty()) {
                    val template = templates[which]
                    openEditor(db.createNote(template.title, template.content, "template", notebookId = selectedNotebookId ?: JotterDb.DEFAULT_NOTEBOOK_ID).id)
                }
            }
            .setPositiveButton("New") { _, _ -> createBlankTemplateDialog() }
            .show()
    }

    private fun createBlankTemplateDialog() {
        val root = vertical().apply { setPadding(dp(16), dp(8), dp(16), dp(8)) }
        val name = EditText(this).apply { hint = "Template name" }
        val title = EditText(this).apply { hint = "Default title" }
        val content = EditText(this).apply {
            hint = "Template content"
            minLines = 6
            gravity = android.view.Gravity.TOP
        }
        root.addView(name)
        root.addView(title)
        root.addView(content)
        AlertDialog.Builder(this)
            .setTitle("New template")
            .setView(root)
            .setPositiveButton("Create") { _, _ -> db.addTemplate(name.text.toString(), title.text.toString(), content.text.toString()) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun settingsDialog() {
        val root = vertical().apply { setPadding(dp(16), dp(8), dp(16), dp(8)) }
        val density = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, listOf("comfortable", "compact"))
            setSelection(if (db.getPreference("density", "comfortable") == "compact") 1 else 0)
        }
        val theme = Spinner(this).apply {
            adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, listOf("dark", "light"))
            setSelection(if (db.getPreference("theme", "dark") == "light") 1 else 0)
        }
        val ai = CheckBox(this).apply {
            text = "Allow local AI helpers"
            isChecked = db.getPreference("local_ai", "true") == "true"
        }
        root.addView(TextView(this).apply { text = "Density" })
        root.addView(density)
        root.addView(TextView(this).apply { text = "Theme" })
        root.addView(theme)
        root.addView(ai)
        AlertDialog.Builder(this)
            .setTitle("Settings")
            .setView(root)
            .setPositiveButton("Save") { _, _ ->
                db.setPreference("density", density.selectedItem.toString())
                db.setPreference("theme", theme.selectedItem.toString())
                db.setPreference("local_ai", ai.isChecked.toString())
                db.addActivity(null, "settings_updated", "density=${density.selectedItem}, theme=${theme.selectedItem}")
                showHome()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun attachmentQueueDialog() {
        val items = db.listAllAttachments()
        val labels = items.map {
            "${it.fileName}\n${it.mimeType}, ${it.fileSize} bytes\n${it.extractedText.ifBlank { "Queued for future OCR/PDF extraction" }}"
        }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Attachment OCR queue")
            .setItems(if (labels.isEmpty()) arrayOf("No attachments") else labels, null)
            .show()
    }

    private fun calendarAgendaDialog() {
        val links = db.listCalendarLinks()
        val labels = links.map { "${formatDateTime(it.startsAt)} - ${it.title}" }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Calendar agenda")
            .setItems(if (labels.isEmpty()) arrayOf("No linked events") else labels) { _, which ->
                if (links.isNotEmpty()) openEditor(links[which].noteId)
            }
            .show()
    }

    private fun syncQueueDialog() {
        val ops = db.listSyncOperations()
        val labels = ops.map { "${it.status}: ${it.entityType}/${it.operation} ${formatDateTime(it.createdAt)}" }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Sync queue")
            .setItems(if (labels.isEmpty()) arrayOf("No sync operations") else labels, null)
            .show()
    }

    private fun exportBackup() {
        val notes = db.listNotes(includeArchived = true)
        val json = JSONObject()
            .put("exported_at", System.currentTimeMillis())
            .put("templates", JSONArray(db.listTemplates().map {
                JSONObject().put("name", it.name).put("title", it.title).put("content", it.content)
            }))
            .put("activity", JSONArray(db.listActivity().map {
                JSONObject().put("note_id", it.noteId).put("action", it.action).put("detail", it.detail).put("created_at", it.createdAt)
            }))
            .put("notes", JSONArray(notes.map { note ->
                JSONObject()
                    .put("id", note.id)
                    .put("title", note.title)
                    .put("content", note.content)
                    .put("type", note.type)
                    .put("source_url", note.sourceUrl)
                    .put("notebook_id", note.notebookId)
                    .put("created_at", note.createdAt)
                    .put("updated_at", note.updatedAt)
                    .put("tags", JSONArray(db.noteTags(note.id).map { it.name }))
                    .put("tasks", JSONArray(db.listTasks(note.id).map { task ->
                        JSONObject()
                            .put("title", task.title)
                            .put("done", task.done)
                            .put("due_at", task.dueAt)
                            .put("reminder_at", task.reminderAt)
                            .put("priority", task.priority)
                    }))
                    .put("attachments", JSONArray(db.listAttachments(note.id).map { attachment ->
                        JSONObject()
                            .put("file_name", attachment.fileName)
                            .put("mime_type", attachment.mimeType)
                            .put("local_path", attachment.localPath)
                            .put("extracted_text", attachment.extractedText)
                    }))
                    .put("comments", JSONArray(db.listComments(note.id).map { comment ->
                        JSONObject()
                            .put("author", comment.author)
                            .put("body", comment.body)
                            .put("created_at", comment.createdAt)
                    }))
                    .put("shares", JSONArray(db.listShares(note.id).map { share ->
                        JSONObject()
                            .put("recipient", share.recipient)
                            .put("permission", share.permission)
                            .put("created_at", share.createdAt)
                    }))
                    .put("ai_actions", JSONArray(db.listAiActions(note.id).map { action ->
                        JSONObject()
                            .put("action", action.action)
                            .put("result", action.result)
                            .put("created_at", action.createdAt)
                    }))
            }))
        val file = File(filesDir, "jotter-backup-${System.currentTimeMillis()}.json")
        file.writeText(json.toString(2))
        Toast.makeText(this, "Backup exported: ${file.name}", Toast.LENGTH_LONG).show()
    }

    private fun scheduleTaskReminder(task: TaskItem, reminderAt: Long) {
        val noteTitle = task.noteId?.let { db.getNote(it)?.title } ?: "Jotter"
        val intent = Intent(this, ReminderReceiver::class.java)
            .putExtra("title", task.title)
            .putExtra("note_title", noteTitle)
        val pending = PendingIntent.getBroadcast(this, task.id.hashCode(), intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        (getSystemService(Context.ALARM_SERVICE) as AlarmManager).setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, reminderAt, pending)
    }

    private fun taskLine(task: TaskItem): String {
        val priority = when (task.priority) {
            2 -> "High"
            1 -> "Medium"
            else -> "Normal"
        }
        val due = task.dueAt?.let { " due ${formatDateTime(it)}" } ?: ""
        val reminder = task.reminderAt?.let { " reminder ${formatDateTime(it)}" } ?: ""
        return "${if (task.done) "[x]" else "[ ]"} [$priority] ${task.title}$due$reminder"
    }

    private fun parseInputDateTime(value: String): Long? {
        if (value.isBlank()) return null
        return runCatching {
            SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).parse(value)?.time
        }.getOrNull()
    }

    private fun formatInputDateTime(value: Long): String = SimpleDateFormat("yyyy-MM-dd HH:mm", Locale.US).format(value)

    private fun formatDateTime(value: Long): String = DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.SHORT).format(value)


    private fun shareDialog(note: Note) {
        val share = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_SUBJECT, note.title)
            putExtra(Intent.EXTRA_TEXT, "${note.title}\n\n${note.content}")
        }
        startActivity(Intent.createChooser(share, "Share note"))
    }

    private fun syncAll() {
        Thread {
            val ops = db.listSyncOperations("pending")
            var ok = true
            ops.forEach { op ->
                val pushed = when (op.entityType) {
                    "note" -> db.getNote(op.entityId)?.let { syncClient.pushNote(it) } ?: true
                    else -> true
                }
                db.markSyncOperation(op.id, if (pushed) "synced" else "failed", if (pushed) null else "Push failed")
                ok = ok && pushed
            }
            runOnUiThread { Toast.makeText(this, if (ok) "Sync queue processed" else "Some items did not sync", Toast.LENGTH_SHORT).show() }
        }.start()
    }

    private fun vertical() = LinearLayout(this).apply {
        orientation = LinearLayout.VERTICAL
        setBackgroundColor(0xFF0C0C10.toInt())
    }

    private fun horizontal() = LinearLayout(this).apply {
        orientation = LinearLayout.HORIZONTAL
    }

    private fun dp(value: Int): Int = (value * resources.displayMetrics.density).toInt()

    private fun hideKeyboard() {
        (getSystemService(Context.INPUT_METHOD_SERVICE) as InputMethodManager).hideSoftInputFromWindow(search.windowToken, 0)
    }
}
