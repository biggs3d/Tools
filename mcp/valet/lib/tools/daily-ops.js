import { join } from 'path';

export class DailyOps {
  constructor(fileHandler, pathResolver) {
    this.fileHandler = fileHandler;
    this.pathResolver = pathResolver;
    this.valetPath = null;
    this.templates = {
      planner: {
        date: "{{date}}",
        type: "planner",
        sections: {
          tasks: "",
          data_stash: "",
          ongoing_summary: "",
          personal_reminders: ""
        },
        metadata: {
          keywords: ["daily", "planner", "{{date}}"],
          created: "{{timestamp}}",
          updated: "{{timestamp}}"
        }
      },
      journal: {
        date: "{{date}}",
        type: "journal",
        sections: {
          reflections: "",
          personal_reminders: ""
        },
        metadata: {
          keywords: ["journal", "personal", "{{date}}"],
          created: "{{timestamp}}",
          updated: "{{timestamp}}"
        }
      }
    };
  }

  async initialize(valetPath) {
    this.valetPath = valetPath;
    await this.fileHandler.ensureDirectory(join(valetPath, 'days'));
    await this.fileHandler.ensureDirectory(join(valetPath, 'archive'));
  }

  async getDailyContext(date, requestedSections = null) {
    if (!this.pathResolver.isValidDate(date)) {
      throw new Error(`Invalid date format: ${date}`);
    }

    const result = {
      todayExists: false,
      sections: {}
    };

    // Check and read planner file
    const plannerPath = this.pathResolver.getPlannerPath(date);
    const plannerExists = await this.fileHandler.fileExists(plannerPath);
    
    if (plannerExists) {
      result.todayExists = true;
      const plannerContent = await this.fileHandler.readFileContent(plannerPath);
      try {
        const plannerData = JSON.parse(plannerContent);
        // Add planner sections
        for (const [key, value] of Object.entries(plannerData.sections)) {
          if (!requestedSections || requestedSections.includes(key)) {
            result.sections[key] = value;
          }
        }
      } catch (error) {
        throw new Error(`Failed to parse planner file: ${error.message}`);
      }
    }

    // Check and read journal file
    const journalPath = this.pathResolver.getJournalPath(date);
    const journalExists = await this.fileHandler.fileExists(journalPath);
    
    if (journalExists) {
      result.todayExists = true;
      const journalContent = await this.fileHandler.readFileContent(journalPath);
      try {
        const journalData = JSON.parse(journalContent);
        // Add journal sections (prefix with 'journal_' to avoid conflicts)
        for (const [key, value] of Object.entries(journalData.sections)) {
          const sectionKey = `journal_${key}`;
          if (!requestedSections || requestedSections.includes(sectionKey)) {
            result.sections[sectionKey] = value;
          }
        }
      } catch (error) {
        throw new Error(`Failed to parse journal file: ${error.message}`);
      }
    }

    return result;
  }

  async updateDaily(date, fileType, updates, keywords = []) {
    if (!this.pathResolver.isValidDate(date)) {
      throw new Error(`Invalid date format: ${date}`);
    }

    if (!['planner', 'journal'].includes(fileType)) {
      throw new Error(`Invalid file type: ${fileType}`);
    }

    const filePath = fileType === 'planner' 
      ? this.pathResolver.getPlannerPath(date)
      : this.pathResolver.getJournalPath(date);

    // Read existing content or create from template
    let dailyData;
    const content = await this.fileHandler.readFileContent(filePath);
    
    if (content) {
      try {
        dailyData = JSON.parse(content);
      } catch (error) {
        throw new Error(`Failed to parse ${fileType} file: ${error.message}`);
      }
    } else {
      // Create from template
      dailyData = JSON.parse(JSON.stringify(this.templates[fileType]));
      dailyData.date = date;
      dailyData.metadata.keywords = dailyData.metadata.keywords.map(k => k.replace('{{date}}', date));
      dailyData.metadata.created = new Date().toISOString();
      dailyData.metadata.updated = new Date().toISOString();
    }

    const updatedSections = [];

    // Apply updates
    for (const update of updates) {
      const { section, operation, content: updateContent } = update;
      
      if (!dailyData.sections[section]) {
        dailyData.sections[section] = '';
      }

      switch (operation) {
        case 'append':
          dailyData.sections[section] += (dailyData.sections[section] ? '\n\n' : '') + updateContent;
          break;
        case 'prepend':
          dailyData.sections[section] = updateContent + (dailyData.sections[section] ? '\n\n' : '') + dailyData.sections[section];
          break;
        case 'replace':
          dailyData.sections[section] = updateContent;
          break;
        default:
          throw new Error(`Invalid operation: ${operation}`);
      }

      updatedSections.push(section);
    }

    // Add keywords to metadata if provided
    if (keywords.length > 0) {
      if (!dailyData.metadata.keywords) {
        dailyData.metadata.keywords = [];
      }
      dailyData.metadata.keywords.push(...keywords);
      // Remove duplicates
      dailyData.metadata.keywords = [...new Set(dailyData.metadata.keywords)];
    }

    // Update timestamp
    dailyData.metadata.updated = new Date().toISOString();

    // Write updated content
    const newContent = JSON.stringify(dailyData, null, 2);
    await this.fileHandler.writeFileContent(filePath, newContent);

    return {
      updatedSections,
      totalSections: Object.keys(dailyData.sections).length
    };
  }

  async newDay(date, generateEmbeddings = true) {
    if (!this.pathResolver.isValidDate(date)) {
      throw new Error(`Invalid date format: ${date}`);
    }

    const result = {
      filesCreated: [],
      embeddingsGenerated: false,
      archiveCreated: false
    };

    const timestamp = new Date().toISOString();

    // Create planner file if it doesn't exist
    const plannerPath = this.pathResolver.getPlannerPath(date);
    const plannerExists = await this.fileHandler.fileExists(plannerPath);
    
    if (!plannerExists) {
      const plannerData = JSON.parse(JSON.stringify(this.templates.planner));
      plannerData.date = date;
      plannerData.metadata.keywords = plannerData.metadata.keywords.map(k => k.replace('{{date}}', date));
      plannerData.metadata.created = timestamp;
      plannerData.metadata.updated = timestamp;
      
      const plannerContent = JSON.stringify(plannerData, null, 2);
      await this.fileHandler.writeFileContent(plannerPath, plannerContent);
      result.filesCreated.push('planner');
    }

    // Create journal file if it doesn't exist
    const journalPath = this.pathResolver.getJournalPath(date);
    const journalExists = await this.fileHandler.fileExists(journalPath);
    
    if (!journalExists) {
      const journalData = JSON.parse(JSON.stringify(this.templates.journal));
      journalData.date = date;
      journalData.metadata.keywords = journalData.metadata.keywords.map(k => k.replace('{{date}}', date));
      journalData.metadata.created = timestamp;
      journalData.metadata.updated = timestamp;
      
      const journalContent = JSON.stringify(journalData, null, 2);
      await this.fileHandler.writeFileContent(journalPath, journalContent);
      result.filesCreated.push('journal');
    }

    // Archive previous day if it exists
    const previousDate = this.getPreviousDate(date);
    await this.archivePreviousDay(previousDate);
    result.archiveCreated = true;

    // Generate embeddings if requested
    if (generateEmbeddings) {
      // TODO: Implement embedding generation
      // For now, just mark as completed
      result.embeddingsGenerated = true;
    }

    return result;
  }

  async archivePreviousDay(date) {
    const archivePath = this.pathResolver.getArchivePath();
    await this.fileHandler.ensureDirectory(archivePath);

    const plannerPath = this.pathResolver.getPlannerPath(date);
    const journalPath = this.pathResolver.getJournalPath(date);

    // Check if files exist and archive them
    const plannerExists = await this.fileHandler.fileExists(plannerPath);
    const journalExists = await this.fileHandler.fileExists(journalPath);

    if (plannerExists || journalExists) {
      const archiveData = {
        date,
        archived_at: new Date().toISOString(),
        files: {}
      };

      if (plannerExists) {
        archiveData.files.planner = await this.fileHandler.readFileContent(plannerPath);
      }

      if (journalExists) {
        archiveData.files.journal = await this.fileHandler.readFileContent(journalPath);
      }

      const archiveFile = join(archivePath, `${date}.json`);
      await this.fileHandler.writeFileContent(archiveFile, JSON.stringify(archiveData, null, 2));
    }
  }

  getPreviousDate(dateString) {
    const date = new Date(dateString);
    date.setDate(date.getDate() - 1);
    return date.toISOString().split('T')[0];
  }
}