class TodoApp {
    constructor() {
        this.todos = [];
        this.currentFilter = 'all';
        this.currentCategory = 'all';
        this.searchTerm = '';
        this.editingId = null;
        this.reminderTimers = {};

        this.init();
    }

    init() {
        this.loadFromStorage();
        this.setTodayMinForDateInputs();
        this.bindEvents();
        this.render();
        this.updateStats();
        this.initReminders();
    }

    setTodayMinForDateInputs() {
        this.fromInput  = document.getElementById('from-date-input');
        this.dueInput   = document.getElementById('due-date-input');
        this.remInput   = document.getElementById('reminder-input');
        const now = new Date();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2,'0');
        const min = String(now.getMinutes()).padStart(2,'0');
        const today = `${yyyy}-${mm}-${dd}`;
        const nowDT = `${today}T${hh}:${min}`;

        this.fromInput.min = today;
        this.dueInput.min = today;
        this.remInput.min = nowDT;

        this.fromInput.addEventListener('change', () => this.updateDateFieldConstraints());
        this.dueInput.addEventListener('change', () => this.updateDateFieldConstraints());
        this.updateDateFieldConstraints();
    }

    updateDateFieldConstraints() {
        const fromVal = this.fromInput.value;
        const dueVal  = this.dueInput.value;

        // DueDate cannot be before FromDate
        if (fromVal) {
            this.dueInput.min = fromVal;
        } else {
            const today = (new Date()).toISOString().split('T')[0];
            this.dueInput.min = today;
        }

        // Reminder min: now or fromDate if in future
        let reminderMin = new Date();
        if (fromVal) {
            let fromDateStart = new Date(fromVal + "T00:00");
            if (fromDateStart > reminderMin) reminderMin = fromDateStart;
        }
        this.remInput.min = reminderMin.toISOString().slice(0,16);

        // Reminder max: dueDate (end of that day)
        if (dueVal) {
            let dueDT = new Date(dueVal + "T23:59");
            this.remInput.max = dueDT.toISOString().slice(0,16);
        } else {
            this.remInput.removeAttribute('max');
        }
    }

    bindEvents() {
        document.getElementById('add-task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });

        document.getElementById('search-input').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.render();
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });

        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.render();
        });

        document.getElementById('clear-completed').addEventListener('click', () => {
            this.clearCompleted();
        });

        document.getElementById('priority-select').addEventListener('change', (e) => {
            e.target.setAttribute('value', e.target.value);
        });
    }

    addTask() {
        const input = document.getElementById('task-input');
        const priority = document.getElementById('priority-select').value;
        const category = document.getElementById('category-select').value;
        const fromDate = this.fromInput.value;
        const dueDate = this.dueInput.value;
        const reminder = this.remInput.value;
        const text = input.value.trim();
        const today = (new Date()).toISOString().split('T')[0];

        // Text validation
        if (!text) return this.showError('Task cannot be empty');
        if (text.length > 200) return this.showError('Task is too long (max 200 characters)');

        // 1. FromDate cannot be past date
        if (fromDate && fromDate < today) {
            return this.showError('From Date cannot be in the past');
        }
        // 2. DueDate cannot be before FromDate
        if (dueDate && fromDate && dueDate < fromDate) {
            return this.showError('Due Date cannot be before From Date');
        }
        // 3. Reminder must be between FromDate and DueDate and in the future
if (reminder) {
    // Convert entered dates to ISO strings for comparison
    const reminderDt = reminder; // string: "YYYY-MM-DDTHH:MM"
    const fromDt = fromDate ? fromDate + "T00:00" : null; // start of day
    const dueDt = dueDate ? dueDate + "T23:59" : null;    // end of day

    // Reminder not in past
    if (reminderDt < (new Date()).toISOString().slice(0,16)) {
        return this.showError('Reminder cannot be in the past');
    }
    // If From Date is set, reminder must be ON or after it
    if (fromDt && reminderDt < fromDt) {
        return this.showError('Reminder must be on or after From Date');
    }
    // If Due Date is set, reminder must be ON or before it
    if (dueDt && reminderDt > dueDt) {
        return this.showError('Reminder must be on or before Due Date');
    }
}


        // Create new task
        const newTask = {
            id: this.generateId(),
            text: text,
            completed: false,
            priority: priority,
            category: category,
            createdAt: new Date(),
            completedAt: null,
            fromDate: fromDate ? new Date(fromDate) : null,
            dueDate: dueDate ? new Date(dueDate) : null,
            reminder: reminder ? new Date(reminder) : null
        };

        this.todos.unshift(newTask);
        this.saveToStorage();
        this.render();
        this.updateStats();
        this.resetForm();
        this.updateDateFieldConstraints();
        if (newTask.reminder) {
            this.scheduleReminder(newTask);
        }
    }

    resetForm() {
        document.getElementById('task-input').value = '';
        document.getElementById('priority-select').value = 'medium';
        document.getElementById('priority-select').setAttribute('value', 'medium');
        this.fromInput.value = '';
        this.dueInput.value = '';
        this.remInput.value = '';
        this.hideError();
    }

    toggleTask(id) {
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.completed = !todo.completed;
            todo.completedAt = todo.completed ? new Date() : null;
            this.saveToStorage();
            this.render();
            this.updateStats();
        }
    }

    deleteTask(id) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.cancelReminder(id);
            this.todos = this.todos.filter(t => t.id !== id);
            this.saveToStorage();
            this.render();
            this.updateStats();
        }
    }

    startEdit(id) {
        this.editingId = id;
        this.render();
    }

    saveEdit(id, newText) {
        const text = newText.trim();
        if (!text) {
            alert('Task cannot be empty');
            return;
        }
        const todo = this.todos.find(t => t.id === id);
        if (todo) {
            todo.text = text;
            this.editingId = null;
            this.saveToStorage();
            this.render();
        }
    }

    cancelEdit() {
        this.editingId = null;
        this.render();
    }

    clearCompleted() {
        const completedCount = this.todos.filter(t => t.completed).length;
        if (completedCount === 0) return;
        if (confirm(`Are you sure you want to delete ${completedCount} completed task(s)?`)) {
            this.todos.forEach(todo => { if (todo.completed) this.cancelReminder(todo.id)});
            this.todos = this.todos.filter(t => !t.completed);
            this.saveToStorage();
            this.render();
            this.updateStats();
        }
    }

    setFilter(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        this.render();
    }

    getFilteredTodos() {
        return this.todos.filter(todo => {
            const matchesFilter =
                this.currentFilter === 'all' ||
                (this.currentFilter === 'active' && !todo.completed) ||
                (this.currentFilter === 'completed' && todo.completed);
            const matchesSearch = todo.text.toLowerCase().includes(this.searchTerm);
            const matchesCategory = this.currentCategory === 'all' || todo.category === this.currentCategory;
            return matchesFilter && matchesSearch && matchesCategory;
        });
    }

    render() {
        const container = document.getElementById('tasks-container');
        const emptyState = document.getElementById('empty-state');
        const filteredTodos = this.getFilteredTodos();

        if (filteredTodos.length === 0) {
            container.innerHTML = '';
            container.appendChild(emptyState);
            return;
        }

        container.innerHTML = '';
        filteredTodos.forEach(todo => {
            const taskElement = this.createTaskElement(todo);
            container.appendChild(taskElement);
        });

        // Update clear completed button
        const completedCount = this.todos.filter(t => t.completed).length;
        const clearBtn = document.getElementById('clear-completed');
        if (completedCount > 0) {
            clearBtn.style.display = 'block';
            clearBtn.textContent = `🗑️ Clear Completed (${completedCount})`;
        } else {
            clearBtn.style.display = 'none';
        }
    }

    renderTaskDates(todo) {
        const d = (date, label) => date ? `<span class="task-date-label">${label}:</span> ${this.formatDate(date)}<br>` : '';
        const dueSoon = todo.dueDate && !todo.completed && this.isDueSoon(todo.dueDate);
        return (
            d(todo.fromDate, "From") +
            d(todo.dueDate, "Due") +
            (todo.reminder ? `<span class="task-date-label">Reminder:</span>
                <span class="reminder-time">${this.formatDateTime(todo.reminder)}</span><br>` : '') +
            (dueSoon ? '<span style="color:#f87171;font-weight:bold;">⚠️ Due soon!</span><br>' : '') +
            `Created: ${this.formatDate(todo.createdAt)}` +
            (todo.completedAt ? ` • Completed: ${this.formatDate(todo.completedAt)}` : '')
        );
    }

    isDueSoon(dueDate) {
        const now = new Date();
        const due = new Date(dueDate);
        return due.getTime() - now.getTime() < 1000*60*60*24 && due.getTime() > now.getTime();
    }

    createTaskElement(todo) {
        const taskDiv = document.createElement('div');
        taskDiv.className = `task-item priority-${todo.priority}`;

        const isEditing = this.editingId === todo.id;
        taskDiv.innerHTML = `
            <div class="task-content">
                <div class="task-checkbox ${todo.completed ? 'checked' : ''}" onclick="app.toggleTask('${todo.id}')">
                    ${todo.completed ? '✓' : ''}
                </div>
                <div class="task-info">
                    <div class="task-meta">
                        <span class="priority-icon">${this.getPriorityIcon(todo.priority)}</span>
                        <span class="category-badge ${todo.category}">${todo.category}</span>
                    </div>
                    ${isEditing ? `
                        <div class="edit-form">
                            <input type="text" class="edit-input" value="${todo.text.replace(/"/g, '&quot;')}" id="edit-input-${todo.id}">
                            <button class="action-btn save-btn" onclick="app.saveEdit('${todo.id}', document.getElementById('edit-input-${todo.id}').value)">💾</button>
                            <button class="action-btn cancel-btn" onclick="app.cancelEdit()">❌</button>
                        </div>
                    ` : `
                        <div class="task-text ${todo.completed ? 'completed' : ''}">${todo.text}</div>
                    `}
                    <div class="task-dates">
                        ${this.renderTaskDates(todo)}
                    </div>
                </div>
                ${!isEditing ? `
                    <div class="task-actions">
                        <button class="action-btn edit-btn" onclick="app.startEdit('${todo.id}')" ${todo.completed ? 'disabled' : ''}>✏️</button>
                        <button class="action-btn delete-btn" onclick="app.deleteTask('${todo.id}')">🗑️</button>
                    </div>
                ` : ''}
            </div>
        `;
        return taskDiv;
    }

    updateStats() {
        const total = this.todos.length;
        const completed = this.todos.filter(t => t.completed).length;
        const pending = total - completed;
        const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

        document.getElementById('total-tasks').textContent = total;
        document.getElementById('completed-tasks').textContent = completed;
        document.getElementById('pending-tasks').textContent = pending;
        document.getElementById('progress-rate').textContent = `${progress}%`;
    }

    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    getPriorityIcon(priority) {
        const icons = { high: '🔥', medium: '⚡', low: '🌱' };
        return icons[priority] || '⚡';
    }

    formatDate(date) {
        if (!date) return '';
        if (typeof date === "string") date = new Date(date);
        return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,0)}-${String(date.getDate()).padStart(2,0)}`;
    }
    formatDateTime(date) {
        if (!date) return '';
        if (typeof date === "string") date = new Date(date);
        let d = this.formatDate(date);
        let h = String(date.getHours()).padStart(2,'0');
        let m = String(date.getMinutes()).padStart(2,'0');
        return `${d} ${h}:${m}`;
    }

    showError(message) {
        const errorMsg = document.getElementById('error-message');
        errorMsg.textContent = message;
        errorMsg.classList.add('show');
        setTimeout(() => this.hideError(), 5000);
    }
    hideError() {
        const errorMsg = document.getElementById('error-message');
        errorMsg.classList.remove('show');
    }

    saveToStorage() {
        try {
            localStorage.setItem('todoApp_tasks', JSON.stringify(this.todos));
        } catch (error) {
            console.error('Failed to save to localStorage:', error);
        }
    }

    loadFromStorage() {
        try {
            const saved = localStorage.getItem('todoApp_tasks');
            if (saved) {
                this.todos = JSON.parse(saved).map(todo => ({
                    ...todo,
                    createdAt: new Date(todo.createdAt),
                    completedAt: todo.completedAt ? new Date(todo.completedAt) : null,
                    fromDate: todo.fromDate ? new Date(todo.fromDate) : null,
                    dueDate: todo.dueDate ? new Date(todo.dueDate) : null,
                    reminder: todo.reminder ? new Date(todo.reminder) : null
                }));
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            this.todos = [];
        }
    }

    // --- Reminder system ---
    initReminders() {
        this.todos.forEach(todo => {
            if (todo.reminder && !todo.completed && todo.reminder > new Date()) {
                this.scheduleReminder(todo);
            }
        });
        // Uncomment for notifications:
        // if ("Notification" in window && Notification.permission !== "granted") Notification.requestPermission();
    }

    scheduleReminder(todo) {
        if (todo.completed) return;
        const now = new Date();
        const delta = todo.reminder - now;
        if (delta <= 0) return;
        this.cancelReminder(todo.id);
        this.reminderTimers[todo.id] = setTimeout(() => {
            // To use browser notifications uncomment below:
            /*
            if ("Notification" in window && Notification.permission === "granted") {
                new Notification("TaskFlow Reminder", {
                    body: `⏰ "${todo.text}" (${todo.category})`,
                });
            }
            */
            alert(`⏰ Task Reminder: "${todo.text}" [${todo.category}]`);
            delete this.reminderTimers[todo.id];
        }, delta);
    }

    cancelReminder(id) {
        if (this.reminderTimers[id]) {
            clearTimeout(this.reminderTimers[id]);
            delete this.reminderTimers[id];
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new TodoApp();
});
