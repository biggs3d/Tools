# Coding Standards

## Core Development Principles

### SOLID Principles

#### 1. Single Responsibility Principle (SRP)
- Each class/module should have only one reason to change
- Keep functions focused on a single task
- If a file exceeds ~300 lines, consider splitting it

#### 2. Open/Closed Principle (OCP)
- Software entities should be open for extension but closed for modification
- Use composition and dependency injection over direct modifications
- Prefer plugin architectures and strategy patterns

#### 3. Liskov Substitution Principle (LSP)
- Derived classes must be substitutable for their base classes
- Implementations should honor the contracts defined by interfaces
- Avoid surprising behavior in inherited classes

#### 4. Interface Segregation Principle (ISP)
- Clients should not be forced to depend on interfaces they don't use
- Prefer many small, specific interfaces over large, general ones
- Split interfaces based on client needs

#### 5. Dependency Inversion Principle (DIP)
- High-level modules should not depend on low-level modules
- Both should depend on abstractions
- Abstractions should not depend on details; details should depend on abstractions

### Modular Code Organization
- **Extract shared logic** into reusable functions
- **Keep files focused** - single responsibility or orchestration only
- **File size limits**: If a file exceeds ~300 lines, consider splitting
- **Example**: Instead of duplicating validation logic, create a shared utility

### Architecture & Design
- **Always ask**: "Is there a simpler, more elegant approach?"
- **SOLID principles**: Apply consistently, especially Single Responsibility
- **Composition over inheritance**: Use plugin systems and component composition
- **Scalability check**: "Will this be easy to extend? To modify?"

### Self-Reflection Questions
These questions help identify improvement opportunities:
- How could you set yourself up for better success next time?
- What patterns emerged that could be extracted?
- Is there a simpler or more elegant architecture?
- What would make this easier to modify in the future?