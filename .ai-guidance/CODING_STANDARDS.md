# Universal Coding Standards

This document contains coding principles that apply to ANY software project, regardless of language, framework, or domain. These standards focus on creating maintainable, scalable, and elegant code.

## Core Principles

### 1. SOLID Principles

#### Single Responsibility Principle (SRP)
- Each module/class/function should have ONE reason to change
- If you find yourself using "AND" to describe what something does, split it

#### Open/Closed Principle (OCP)
- Open for extension, closed for modification
- Use abstractions and interfaces to allow new features without changing existing code

#### Liskov Substitution Principle (LSP)
- Derived classes must be substitutable for their base classes
- Don't break contracts established by parent types

#### Interface Segregation Principle (ISP)
- Many specific interfaces are better than one general-purpose interface
- Clients shouldn't depend on interfaces they don't use

#### Dependency Inversion Principle (DIP)
- Depend on abstractions, not concretions
- High-level modules shouldn't depend on low-level modules

### 2. Code Organization

#### File Size & Complexity
- **Target**: Keep files under 300 lines
- **Hard limit**: 500 lines should trigger a refactor
- **Cognitive load**: If you can't understand a file in 5 minutes, it's too complex

#### Module Structure
```
// ❌ Bad: Everything in one file
class UserService {
  validateUser() { /* 50 lines */ }
  saveUser() { /* 100 lines */ }
  sendEmail() { /* 75 lines */ }
  generateReport() { /* 150 lines */ }
}

// ✅ Good: Separated concerns
class UserValidator { /* validation logic */ }
class UserRepository { /* persistence logic */ }
class EmailService { /* email logic */ }
class UserService { /* orchestration only */ }
```

#### Function Design
- **Do one thing well**: If you need "AND" in the function name, split it
- **Ideal length**: 5-40 lines
- **Maximum parameters**: 3-4 (use parameter objects for more)
- **Pure functions**: Prefer functions without side effects

### 3. Architectural Thinking

#### Before Implementation Ask:
1. **Is there a simpler way?** - The best code is often the code you don't write
2. **Will this scale?** - Consider 10x current load/requirements
3. **Is this flexible?** - Can requirements change without major rewrites?
4. **Is this testable?** - Can you unit test without complex mocks?

#### Design Patterns
- **Know them**: Understand common patterns (Factory, Strategy, Observer, etc.)
- **Don't force them**: Not every problem needs a design pattern
- **Composition > Inheritance**: Prefer composing behaviors over deep inheritance

### 4. Code Reusability

#### DRY (Don't Repeat Yourself)
- **Rule of three**: Extract common code after the third duplication
- **Abstraction levels**: Keep abstractions at appropriate levels
- **Premature abstraction**: Sometimes a little duplication is better than wrong abstraction

#### Shared Logic Extraction
```typescript
// ❌ Bad: Duplicated validation
function validateUserEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateContactEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ✅ Good: Shared validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email);
}
```

### 5. Maintainability

#### Self-Documenting Code
- **Clear naming**: `calculateTotalPrice()` not `calc()` or `process()`
- **Reveal intent**: `if (user.isActive())` not `if (user.status === 1)`
- **Avoid magic numbers**: Use named constants

#### Future-Proofing
- **Configuration over hardcoding**: Externalize values that might change
- **Extensibility points**: Design with hooks for future features
- **Backward compatibility**: Consider migration paths for changes

### 6. Performance Considerations

#### Optimization Rules
1. **Make it work** - Correctness first
2. **Make it right** - Clean, maintainable code
3. **Make it fast** - Optimize only when necessary

#### Common Pitfalls
- **Premature optimization**: Profile before optimizing
- **N+1 queries**: Batch operations when possible
- **Memory leaks**: Clean up resources (event listeners, timers, etc.)

### 7. Error Handling

#### Defensive Programming
- **Fail fast**: Detect errors early
- **Explicit over implicit**: Make error cases obvious
- **Recovery strategies**: Have fallbacks for critical paths

```typescript
// ❌ Bad: Silent failure
function divide(a: number, b: number) {
  if (b === 0) return 0; // Hidden behavior
  return a / b;
}

// ✅ Good: Explicit handling
function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}
```

### 8. Continuous Improvement

#### After Each Feature
1. **Refactor opportunities**: What patterns emerged?
2. **Extract utilities**: What code was duplicated?
3. **Simplify**: Can anything be made clearer?
4. **Document learnings**: What would help next time?

#### Code Review Mindset
- **Question complexity**: "Is there a simpler way?"
- **Think maintenance**: "Will I understand this in 6 months?"
- **Consider team**: "Can a junior developer modify this safely?"

## Red Flags 🚩

Watch for these signs that indicate refactoring is needed:

1. **"It's complicated to explain"** - Complex code is often wrong code
2. **Copy-paste programming** - Time to extract shared functionality
3. **Long parameter lists** - Consider parameter objects
4. **Deep nesting** - Extract methods or early returns
5. **Comments explaining "what"** - Code should be self-documenting
6. **Test complexity** - Hard to test often means poor design

## Summary

Good code is:
- **Simple**: Solves the problem with minimal complexity
- **Clear**: Intent is obvious to readers
- **Flexible**: Adapts to changing requirements
- **Tested**: Behavior is verified and documented
- **Maintainable**: Future changes are straightforward

Remember: Write code for humans to read, not just computers to execute. Always optimize for clarity and maintainability over cleverness.