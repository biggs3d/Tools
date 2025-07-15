import { readFile, writeFile, access, constants } from 'fs/promises';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { ConfigLoader } from './config-loader.js';
import { FileHandler } from './file-handler.js';
import { PathResolver } from './path-resolver.js';
import { TodoManager } from '../tools/todo-manager.js';
import { DailyOps } from '../tools/daily-ops.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class ValetServer {
  constructor() {
    this.configLoader = new ConfigLoader();
    this.fileHandler = new FileHandler();
    this.pathResolver = new PathResolver();
    this.todoManager = new TodoManager(this.fileHandler, this.pathResolver);
    this.dailyOps = new DailyOps(this.fileHandler, this.pathResolver);
    
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;

    try {
      // Load configuration
      await this.configLoader.load();
      
      // Set up VALET directory path
      const valetPath = this.pathResolver.resolveValetPath();
      await this.fileHandler.ensureDirectory(valetPath);
      
      // Initialize components
      await this.todoManager.initialize(valetPath);
      await this.dailyOps.initialize(valetPath);
      
      this.initialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize VALET server: ${error.message}`);
    }
  }

  async getDailyContext({ date, sections, includeGlobalTodo, includePreviousDay }) {
    if (!this.initialized) {
      throw new Error('VALET server not initialized');
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const result = {
        success: true,
        date: targetDate,
        todayExists: false,
        sections: {}
      };

      // Get daily files context
      const dailyContext = await this.dailyOps.getDailyContext(targetDate, sections);
      result.sections = dailyContext.sections;
      result.todayExists = dailyContext.todayExists;

      // Include global todo if requested
      if (includeGlobalTodo) {
        result.globalTodo = await this.todoManager.getView({ format: 'structured' });
      }

      // Include previous day summary if requested
      if (includePreviousDay) {
        const previousDate = this.getPreviousDate(targetDate);
        const previousContext = await this.dailyOps.getDailyContext(previousDate, ['ongoing_summary']);
        result.previousDay = {
          date: previousDate,
          summary: previousContext.sections.ongoing_summary || 'No previous day summary found'
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateDaily({ date, fileType, updates, keywords }) {
    if (!this.initialized) {
      throw new Error('VALET server not initialized');
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const result = await this.dailyOps.updateDaily(targetDate, fileType, updates, keywords);
      
      return {
        success: true,
        date: targetDate,
        fileType,
        updatedSections: result.updatedSections,
        keywords: keywords || []
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async newDay({ skipEmbeddings, date }) {
    if (!this.initialized) {
      throw new Error('VALET server not initialized');
    }

    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      
      const result = await this.dailyOps.newDay(targetDate, !skipEmbeddings);
      
      return {
        success: true,
        date: targetDate,
        filesCreated: result.filesCreated,
        embeddingsGenerated: result.embeddingsGenerated,
        archiveCreated: result.archiveCreated
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async todoOperations({ action, task, filter }) {
    if (!this.initialized) {
      throw new Error('VALET server not initialized');
    }

    try {
      let result;
      
      switch (action) {
        case 'add':
          result = await this.todoManager.addTask(task);
          break;
        case 'complete':
          result = await this.todoManager.completeTask(task.id);
          break;
        case 'update':
          result = await this.todoManager.updateTask(task.id, task);
          break;
        case 'remove':
          result = await this.todoManager.removeTask(task.id);
          break;
        case 'move':
          result = await this.todoManager.moveTask(task.id, task.category);
          break;
        default:
          throw new Error(`Unknown action: ${action}`);
      }

      return {
        success: true,
        action,
        result,
        statistics: await this.todoManager.getStatistics()
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async todoView({ filter, format }) {
    if (!this.initialized) {
      throw new Error('VALET server not initialized');
    }

    try {
      const result = await this.todoManager.getView({ filter, format });
      
      return {
        success: true,
        format,
        filter,
        result
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  getPreviousDate(dateString) {
    const date = new Date(dateString);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }
}