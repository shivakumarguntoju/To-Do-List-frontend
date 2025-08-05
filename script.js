// Todo Application Class
class TodoApp {
    constructor() {
        this.todos = [];
        this.currentFilter = 'all';
        this.currentCategory = 'all';
        this.searchTerm = '';
        this.editingId = null;
        
        this.init();
    }
    
    init() {
        this.loadFromStorage();
        this.bindEvents();
        this.render();
        this.updateStats();
    }
    
    // Event Binding
    bindEvents() {
        // Add task form
        document.getElementById('add-task-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.addTask();
        });
        
        // Search input
        document.getElementById('search-input').addEventListener('input', (e) => {
            this.searchTerm = e.target.value.toLowerCase();
            this.render();
        });
        
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setFilter(e.target.dataset.filter);
            });
        });
        
        // Category filter
        document.getElementById('category-filter').addEventListener('change', (e) => {
            this.currentCategory = e.target.value;
            this.render();
        });
        
        // Clear completed button
        document.getElementById('clear-completed').addEventListener('click', () => {
            this.clearCompleted();
        });
        
        // Priority select styling
        document.getElementById('priority-select').addEventListener('change', (e) => {
            e.target.setAttribute('value', e.target.value);
        });
    }
    
    // Add new task
    addTask() {
        const input = document.getElementById('task-input');
        const priority = document.getElementById('priority-select').value;
        const category = document.getElementById('category-select').value;
        const errorMsg = document.getElementById('error-message');
        
        const text = input.value.trim();
        
        // Validation
        if (!text) {
            this.showError('Task cannot be empty');
            return;
        }
        
        if (text.length > 200) {
            this.showError('Task is too long (max 200 characters)');
            return;
        }
        
        // Create new task
        const newTask = {
            id: this.generateId(),
            text: text,
            completed: false,
            priority: priority,
            category: category,
            createdAt: new Date(),
            completedAt: null
        };
        
        this.todos.unshift(newTask);
        this.saveToStorage();
        this.render();
        this.updateStats();
        
        // Reset form
        input.value = '';
        document.getElementById('priority-select').value = 'medium';
        document.getElementById('priority-select').setAttribute('value', 'medium');
        this.hideError();
    }
    
    // Toggle task completion
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
    
    // Delete task
    deleteTask(id) {
        if (confirm('Are you sure you want to delete this task?')) {
            this.todos = this.todos.filter(t => t.id !== id);
            this.saveToStorage();
            this.render();
            this.updateStats();
        }
    }
    
    // Start editing task
    startEdit(id) {
        this.editingId = id;
        this.render();
    }
    
    // Save edited task
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
    
    // Cancel editing
    cancelEdit() {
        this.editingId = null;
        this.render();
    }
    
    // Clear completed tasks
    clearCompleted() {
        const completedCount = this.todos.filter(t => t.completed).length;
        if (completedCount === 0) return;
        
        if (confirm(`Are you sure you want to delete ${completedCount} completed task(s)?`)) {
            this.todos = this.todos.filter(t => !t.completed);
            this.saveToStorage();
            this.render();
            this.updateStats();
        }
    }
    
    // Set filter
    setFilter(filter) {
        this.currentFilter = filter;
        
        // Update active button
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');
        
        this.render();
    }
    
    // Get filtered todos
    getFilteredTodos() {
        return this.todos.filter(todo => {
            // Filter by completion status
            const matchesFilter = 
                this.currentFilter === 'all' ||
                (this.currentFilter === 'active' && !todo.completed) ||
                (this.currentFilter === 'completed' && todo.completed);
            
            // Filter by search term
            const matchesSearch = todo.text.toLowerCase().includes(this.searchTerm);
            
            // Filter by category
            const matchesCategory = this.currentCategory === 'all' || todo.category === this.currentCategory;
            
            return matchesFilter && matchesSearch && matchesCategory;
        });
    }
    
    // Render tasks
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
    
    // Create task element
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
                            <input type="text" class="edit-input" value="${todo.text}" id="edit-input-${todo.id}">
                            <button class="action-btn save-btn" onclick="app.saveEdit('${todo.id}', document.getElementById('edit-input-${todo.id}').value)">💾</button>
                            <button class="action-btn cancel-btn" onclick="app.cancelEdit()">❌</button>
                        </div>
                    ` : `
                        <div class="task-text ${todo.completed ? 'completed' : ''}">${todo.text}</div>
                    `}
                    <div class="task-dates">
                        Created: ${this.formatDate(todo.createdAt)}
                        ${todo.completedAt ? ` • Completed: ${this.formatDate(todo.completedAt)}` : ''}
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
    
    // Update statistics
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
    
    // Utility functions
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    getPriorityIcon(priority) {
        const icons = {
            high: '🔥',
            medium: '⚡',
            low: '🌱'
        };
        return icons[priority] || '⚡';
    }
    
    formatDate(date) {
        return new Date(date).toLocaleDateString();
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
    
    // Local Storage
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
                    completedAt: todo.completedAt ? new Date(todo.completedAt) : null
                }));
            }
        } catch (error) {
            console.error('Failed to load from localStorage:', error);
            this.todos = [];
        }
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new TodoApp();
});