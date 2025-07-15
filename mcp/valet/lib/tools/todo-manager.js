import { randomUUID } from 'crypto';

export class TodoManager {
  constructor(fileHandler, pathResolver) {
    this.fileHandler = fileHandler;
    this.pathResolver = pathResolver;
    this.valetPath = null;
    this.todoTemplate = {
      version: "1.0.0",
      updated: "{{timestamp}}",
      tasks: []
    };
  }

  async initialize(valetPath) {
    this.valetPath = valetPath;
    
    // Ensure todo file exists
    const todoPath = this.pathResolver.getTodoPath();
    const exists = await this.fileHandler.fileExists(todoPath);
    
    if (!exists) {
      const template = { ...this.todoTemplate };
      template.updated = new Date().toISOString();
      const content = JSON.stringify(template, null, 2);
      await this.fileHandler.writeFileContent(todoPath, content);
    }
  }

  async loadTodos() {
    const todoPath = this.pathResolver.getTodoPath();
    const content = await this.fileHandler.readFileContent(todoPath);
    
    if (!content) {
      return { tasks: [], metadata: {} };
    }

    try {
      const todoData = JSON.parse(content);
      return { 
        tasks: todoData.tasks || [], 
        metadata: {
          version: todoData.version,
          updated: todoData.updated
        }
      };
    } catch (error) {
      throw new Error(`Failed to parse todo file: ${error.message}`);
    }
  }

  async saveTodos(tasks) {
    const todoPath = this.pathResolver.getTodoPath();
    
    const todoData = {
      version: "1.0.0",
      updated: new Date().toISOString(),
      tasks: tasks
    };
    
    const content = JSON.stringify(todoData, null, 2);
    await this.fileHandler.writeFileContent(todoPath, content);
  }

  // JSON format eliminates the need for parsing methods

  async addTask(taskData) {
    const { tasks } = await this.loadTodos();
    
    const newTask = {
      id: randomUUID(),
      content: taskData.content || '',
      priority: taskData.priority || 'medium',
      category: taskData.category || 'General',
      completed: false,
      created: new Date().toISOString(),
      due: taskData.due || null,
      notes: taskData.notes || []
    };

    tasks.push(newTask);
    await this.saveTodos(tasks);
    
    return newTask;
  }

  async completeTask(taskId) {
    const { tasks } = await this.loadTodos();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.completed = true;
    task.completed_at = new Date().toISOString();
    
    await this.saveTodos(tasks);
    return task;
  }

  async updateTask(taskId, updates) {
    const { tasks } = await this.loadTodos();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    // Apply updates
    if (updates.content !== undefined) task.content = updates.content;
    if (updates.priority !== undefined) task.priority = updates.priority;
    if (updates.category !== undefined) task.category = updates.category;
    if (updates.due !== undefined) task.due = updates.due;
    if (updates.notes !== undefined) task.notes = updates.notes;
    
    task.updated_at = new Date().toISOString();
    
    await this.saveTodos(tasks);
    return task;
  }

  async removeTask(taskId) {
    const { tasks } = await this.loadTodos();
    const taskIndex = tasks.findIndex(t => t.id === taskId);
    
    if (taskIndex === -1) {
      throw new Error(`Task not found: ${taskId}`);
    }

    const removedTask = tasks.splice(taskIndex, 1)[0];
    await this.saveTodos(tasks);
    
    return removedTask;
  }

  async moveTask(taskId, newCategory) {
    const { tasks } = await this.loadTodos();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) {
      throw new Error(`Task not found: ${taskId}`);
    }

    task.category = newCategory;
    task.updated_at = new Date().toISOString();
    
    await this.saveTodos(tasks);
    return task;
  }

  async getView({ filter = {}, format = 'structured' }) {
    const { tasks } = await this.loadTodos();
    let filteredTasks = tasks;

    // Apply filters
    if (filter.categories) {
      filteredTasks = filteredTasks.filter(task => 
        filter.categories.includes(task.category)
      );
    }

    if (filter.priorities) {
      filteredTasks = filteredTasks.filter(task => 
        filter.priorities.includes(task.priority)
      );
    }

    if (filter.due) {
      const today = new Date().toISOString().split('T')[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      filteredTasks = filteredTasks.filter(task => {
        if (!task.due) return filter.due === 'all';
        
        switch (filter.due) {
          case 'today':
            return task.due === today;
          case 'week':
            return task.due <= weekFromNow;
          case 'overdue':
            return task.due < today;
          case 'all':
            return true;
          default:
            return true;
        }
      });
    }

    if (filter.limit) {
      filteredTasks = filteredTasks.slice(0, filter.limit);
    }

    // Format output
    switch (format) {
      case 'structured':
        return {
          tasks: filteredTasks,
          count: filteredTasks.length,
          categories: [...new Set(filteredTasks.map(t => t.category))]
        };
      case 'markdown':
        return this.formatAsMarkdown(filteredTasks);
      case 'summary':
        return this.formatAsSummary(filteredTasks);
      default:
        return filteredTasks;
    }
  }

  formatAsMarkdown(tasks) {
    const grouped = this.groupTasksByPriority(tasks);
    let markdown = '';
    
    for (const [priority, priorityTasks] of Object.entries(grouped)) {
      if (priorityTasks.length > 0) {
        markdown += `## ${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority\n\n`;
        for (const task of priorityTasks) {
          markdown += `- ${this.formatTaskLine(task)}\n`;
        }
        markdown += '\n';
      }
    }
    
    return markdown;
  }

  formatAsSummary(tasks) {
    const active = tasks.filter(t => !t.completed);
    const completed = tasks.filter(t => t.completed);
    
    return {
      total: tasks.length,
      active: active.length,
      completed: completed.length,
      by_priority: {
        high: active.filter(t => t.priority === 'high').length,
        medium: active.filter(t => t.priority === 'medium').length,
        low: active.filter(t => t.priority === 'low').length
      },
      categories: [...new Set(active.map(t => t.category))]
    };
  }

  groupTasksByPriority(tasks) {
    return {
      high: tasks.filter(t => t.priority === 'high' && !t.completed),
      medium: tasks.filter(t => t.priority === 'medium' && !t.completed),
      low: tasks.filter(t => t.priority === 'low' && !t.completed)
    };
  }

  async getStatistics() {
    const { tasks } = await this.loadTodos();
    return this.formatAsSummary(tasks);
  }
}