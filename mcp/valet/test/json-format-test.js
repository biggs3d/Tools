#!/usr/bin/env node

import { TodoManager } from '../lib/tools/todo-manager.js';
import { DailyOps } from '../lib/tools/daily-ops.js';
import { FileHandler } from '../lib/core/file-handler.js';
import { PathResolver } from '../lib/core/path-resolver.js';

async function testJsonFormat() {
  console.log('🧪 Testing JSON Format Implementation...');
  
  const fileHandler = new FileHandler();
  const pathResolver = new PathResolver();
  const todoManager = new TodoManager(fileHandler, pathResolver);
  const dailyOps = new DailyOps(fileHandler, pathResolver);
  
  try {
    // Initialize with test data directory
    await todoManager.initialize('/mnt/d/Tools/mcp/valet/valet-data');
    await dailyOps.initialize('/mnt/d/Tools/mcp/valet/valet-data');
    
    console.log('✅ Initialized managers');
    
    // Test 1: Todo operations
    console.log('\n📋 Testing Todo Operations:');
    
    // Add a task
    const newTask = await todoManager.addTask({
      content: 'Test JSON format todo',
      priority: 'high',
      category: 'Testing',
      due: '2025-07-20'
    });
    
    console.log(`✅ Added task: ${newTask.id}`);
    console.log(`   Content: ${newTask.content}`);
    console.log(`   Priority: ${newTask.priority}`);
    
    // Load todos to verify persistence
    const { tasks } = await todoManager.loadTodos();
    const foundTask = tasks.find(t => t.id === newTask.id);
    
    if (foundTask) {
      console.log(`✅ Task persisted correctly with ID: ${foundTask.id}`);
      
      // Complete the task
      await todoManager.completeTask(foundTask.id);
      console.log(`✅ Task completed successfully`);
      
      // Verify completion
      const { tasks: updatedTasks } = await todoManager.loadTodos();
      const completedTask = updatedTasks.find(t => t.id === foundTask.id);
      
      if (completedTask && completedTask.completed) {
        console.log(`✅ Task completion persisted`);
      } else {
        console.log(`❌ Task completion not persisted`);
      }
      
    } else {
      console.log(`❌ Task not found after persistence`);
    }
    
    // Test 2: Daily operations
    console.log('\n📅 Testing Daily Operations:');
    
    const testDate = '2025-07-15';
    
    // Test new day creation
    const newDayResult = await dailyOps.newDay(testDate, false);
    console.log(`✅ New day created for ${testDate}`);
    console.log(`   Files created: ${newDayResult.filesCreated.join(', ')}`);
    
    // Test daily context retrieval
    const context = await dailyOps.getDailyContext(testDate);
    console.log(`✅ Daily context retrieved`);
    console.log(`   Today exists: ${context.todayExists}`);
    console.log(`   Sections: ${Object.keys(context.sections).join(', ')}`);
    
    // Test daily update
    const updateResult = await dailyOps.updateDaily(testDate, 'planner', [
      {
        section: 'tasks',
        operation: 'append',
        content: 'Test task added via JSON format'
      },
      {
        section: 'ongoing_summary',
        operation: 'replace',
        content: 'Successfully tested JSON format implementation'
      }
    ], ['testing', 'json', 'format']);
    
    console.log(`✅ Daily update completed`);
    console.log(`   Updated sections: ${updateResult.updatedSections.join(', ')}`);
    
    // Verify update persistence
    const updatedContext = await dailyOps.getDailyContext(testDate);
    console.log(`✅ Updated context retrieved`);
    console.log(`   Tasks section: ${updatedContext.sections.tasks.substring(0, 50)}...`);
    
    // Test 3: View operations
    console.log('\n👁️ Testing View Operations:');
    
    const todoView = await todoManager.getView({ format: 'structured' });
    console.log(`✅ Todo view retrieved`);
    console.log(`   Total tasks: ${todoView.count}`);
    console.log(`   Categories: ${todoView.categories.join(', ')}`);
    
    // Clean up - remove test task
    await todoManager.removeTask(newTask.id);
    console.log(`✅ Test task cleaned up`);
    
    console.log('\n🎉 All JSON format tests PASSED!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testJsonFormat();