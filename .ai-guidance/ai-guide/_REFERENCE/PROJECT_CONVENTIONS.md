# Project Conventions

This document outlines the project structure, naming conventions, testing practices, and development workflows for the Phoenix framework.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Naming Conventions](#naming-conventions)
3. [File Organization](#file-organization)
4. [Testing Strategy](#testing-strategy)
5. [Code Style Guidelines](#code-style-guidelines)
6. [Development Workflow](#development-workflow)
7. [Error Handling](#error-handling)
8. [Performance Guidelines](#performance-guidelines)

## Project Structure

### Monorepo Architecture

The project uses an Nx monorepo structure with separate apps and libraries:

```
/workspaces/project-hmi/
├── client/                    # Frontend code
│   ├── apps/                 # Applications
│   │   ├── myapp.app/       # Main React application
│   │   └── myapp.desktop/   # Electron desktop app
│   └── libs/                # Shared libraries
│       ├── myapp/           # Application-specific libraries
│       │   ├── myapp.api/   # API interfaces
│       │   ├── myapp.components/ # UI components
│       │   ├── myapp.core/  # Core ViewModels and services
│       │   ├── myapp.model/ # Data models
│       │   └── myapp.registration/ # Component registration
│       └── phoenix/         # Phoenix framework libraries
│           ├── phoenix.api/ # Framework API interfaces
│           ├── phoenix.components/ # UI components
│           ├── phoenix.core/ # Core framework
│           └── phoenix.model/ # Framework models
├── model/                   # Shared model definitions
├── server/                  # Backend C# services
├── ai-guide/               # AI documentation
└── configuration/          # Configuration files
```

### Application Layer Structure

Within each application/library, follow this structure:

```
src/
├── lib/                    # Main library code
│   ├── components/         # React components (organized by feature)
│   ├── viewModels/        # MobX ViewModels
│   ├── services/          # Business services
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   └── assets/            # Static assets
├── test/                  # Test files
└── index.ts              # Main export file
```

### Component Library Structure

For component libraries, organize by feature/domain with lowercase folder names:

```
libs/alpha/alpha.components/src/
├── index.ts               # ONLY index.ts at package level
└── lib/
    ├── entry/            # Entry/main view components
    │   ├── entryView.tsx
    │   └── entryView.css
    ├── toolbar/          # Toolbar components
    │   ├── topToolbar.tsx
    │   └── topToolbar.css
    └── rails/            # Rail components
        ├── rail.tsx
        ├── rail.css
        ├── railGroup.tsx
        └── railGroup.css
```

**Important**: Do NOT create index.ts files in individual component folders. Only maintain one index.ts at the package level that directly exports all components.

## Naming Conventions

### Files and Directories

| Type | Convention | Example |
|------|------------|---------|
| ViewModels | `*ViewModel.ts` | `teamManagementViewModel.ts` |
| Views/Components | `*View.tsx` | `teamManagementView.tsx` |
| Entity ViewModels | `*EntityViewModel.ts` | `teamEntityViewModel.ts` |
| Services | `*Service.ts` | `authenticationService.ts` |
| Models | `*.ts` (descriptive) | `team.ts`, `user.ts` |
| Types | `*Types.ts` | `navigationTypes.ts` |
| Utilities | `*Utils.ts` | `dateUtils.ts` |
| CSS Files | `*.css` (match component) | `teamManagement.css` |
| Test Files | `*.test.ts` | `teamViewModel.test.ts` |
| Directories | lowercase | `rails/`, `toolbar/`, `entry/` |

### Class and Interface Names

```typescript
// ViewModels - PascalCase with "ViewModel" suffix
export class TeamManagementViewModel extends BaseViewModel { }
export class TeamEntityViewModel extends BaseEntityViewModel<Team> { }

// Views - PascalCase with "View" suffix
export const TeamManagementView = observer(({ viewModel }) => { });

// Services - PascalCase with "Service" suffix
export class AuthenticationService implements IAuthenticationService { }

// Interfaces - PascalCase with "I" prefix
export interface ITeamService { }
export interface IValidationVM { }

// Types - PascalCase
export type TeamStatus = 'active' | 'inactive' | 'pending';

// Enums - PascalCase
export enum TransmitterType {
    TxRx = 0,
    TxOnly = 1,
    RxOnly = 2
}
```

### Variable Names

```typescript
// Observable properties - camelCase with descriptive names
@observable private _selectedTeamId: string | null = null;
@observable isLoading: boolean = false;
@observable errorMessage: string | null = null;

// Computed properties - camelCase, often with "get" prefix
@computed get selectedTeam(): Team | null { }
@computed get hasUnsavedChanges(): boolean { }

// Actions - camelCase, often with verb prefix
@action setSelectedTeam(teamId: string): void { }
@action async loadTeams(): Promise<void> { }

// Methods - camelCase with descriptive verbs
private validateInput(input: string): boolean { }
private handleTeamSelection(team: Team): void { }
```

## File Organization

### Feature-Based Organization

Organize code by feature/domain rather than by technical type:

```
libs/myapp/myapp.core/src/lib/
├── teams/                 # Team management feature
│   ├── teamViewModel.ts
│   ├── teamEntityViewModel.ts
│   ├── teamService.ts
│   └── teamTypes.ts
├── platforms/             # Platform management feature
│   ├── platformViewModel.ts
│   ├── platformEntityViewModel.ts
│   └── platformService.ts
└── shared/               # Shared utilities
    ├── baseViewModel.ts
    ├── validationUtils.ts
    └── types.ts
```

### Component Co-location

Keep related files close together:

```
components/teamManagement/
├── teamManagementView.tsx     # Main component
├── teamManagementViewModel.ts # ViewModel
├── teamManagement.css         # Styles
├── teamManagement.test.ts     # Tests
└── components/               # Child components
    ├── teamItem/
    │   ├── teamItemView.tsx
    │   ├── teamItemViewModel.ts
    │   └── teamItem.css
    └── teamForm/
        ├── teamFormView.tsx
        └── teamFormViewModel.ts
```

## Testing Strategy

### Testing Framework

The project uses **Vitest** for unit testing with the following structure:

```typescript
// teamViewModel.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { TeamViewModel } from './teamViewModel';
import { createMockServices } from '../test/mockServices';

describe('TeamViewModel', () => {
    let viewModel: TeamViewModel;
    let mockServices: ReturnType<typeof createMockServices>;

    beforeEach(() => {
        mockServices = createMockServices();
        viewModel = new TeamViewModel(mockServices);
    });

    describe('initialization', () => {
        it('should initialize with default values', () => {
            expect(viewModel.isLoading).toBe(false);
            expect(viewModel.teams).toEqual([]);
            expect(viewModel.selectedTeam).toBeNull();
        });
    });

    describe('loadTeams', () => {
        it('should load teams successfully', async () => {
            const mockTeams = [{ id: '1', name: 'Team A' }];
            mockServices.teamService.getAll.mockResolvedValue(mockTeams);

            await viewModel.loadTeams();

            expect(viewModel.isLoading).toBe(false);
            expect(viewModel.teams).toEqual(mockTeams);
            expect(mockServices.teamService.getAll).toHaveBeenCalledOnce();
        });
    });
});
```

### Test Categories

1. **Unit Tests** - Test individual ViewModels and services
2. **Integration Tests** - Test ViewModel-Service interactions
3. **Component Tests** - Test React components with ViewModels
4. **E2E Tests** - Test complete user workflows (when applicable)

### Testing Conventions

```typescript
// Test file structure
describe('ComponentName', () => {
    describe('initialization', () => {
        // Test initial state
    });

    describe('method/action name', () => {
        // Test specific functionality
    });

    describe('computed properties', () => {
        // Test computed values
    });

    describe('error handling', () => {
        // Test error scenarios
    });
});

// Mock services
const createMockServices = () => ({
    teamService: {
        getAll: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn()
    },
    authService: {
        getCurrentUser: vi.fn(),
        logout: vi.fn()
    }
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test teamViewModel.test.ts

# TypeScript compilation check
npx tsc --noEmit
```

## CSS Architecture

### BEM-Style Naming Conventions

Use BEM (Block, Element, Modifier) style for CSS class names:

```css
/* Block - Component root */
.entry-view { }

/* Element - Component parts */
.entry-view__background { }
.entry-view__content { }

/* Modifier - Component variations */
.rail--left { }
.rail--right { }
```

### CSS Variables

Always use CSS variables for theming:

```css
/* ✅ GOOD - Using theme variables */
.top-toolbar {
    background-color: var(--neutral3);
    color: var(--neutral11);
}

/* ❌ BAD - Hardcoded colors */
.top-toolbar {
    background-color: #222222;
    color: #b4b4b4;
}
```

### Shared Utility Classes

Define shared utility classes at appropriate component levels:

```css
/* Shared utility in parent component */
.chipped {
    clip-path: polygon(0 0, calc(100% - 1.6rem) 0, 100% 1.6rem, 100% 100%, 0 100%);
}
```

## Code Style Guidelines

### TypeScript Rules

1. **No `any` types** - Always use proper typing
2. **Strict null checks** - Handle null/undefined explicitly
3. **Explicit return types** - For public methods and complex functions
4. **Interface segregation** - Small, focused interfaces

```typescript
// ✅ GOOD - Explicit types
interface ITeamService {
    getTeam(id: string): Promise<Team | null>;
    createTeam(data: CreateTeamRequest): Promise<Team>;
}

// ❌ BAD - Using any
const teamData: any = response.data;

// ✅ GOOD - Proper typing
const teamData: Team = response.data as Team;
```

### MobX Guidelines

1. **Always use `makeObservable(this)`** in constructor
2. **Mark all mutating methods as `@action`**
3. **Use `@computed` for derived values**
4. **Use `runInAction` after `await`**

```typescript
// ✅ GOOD MobX pattern
export class TeamViewModel extends BaseViewModel {
    @observable teams: Team[] = [];
    @observable isLoading: boolean = false;

    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this); // Required!
    }

    @computed get activeTeams(): Team[] {
        return this.teams.filter(team => team.isActive);
    }

    @action async loadTeams(): Promise<void> {
        this.isLoading = true;
        try {
            const teams = await this.teamService.getAll();
            runInAction(() => {
                this.teams = teams;
            });
        } finally {
            runInAction(() => {
                this.isLoading = false;
            });
        }
    }
}
```

### React Component Guidelines

1. **Use `observer` for components that consume observables**
2. **Prefer functional components over class components**
3. **Use descriptive prop interfaces**
4. **Keep components focused and small**
5. **Extend HTML attributes for better type safety**

```typescript
// ✅ GOOD React component
interface TeamListViewProps extends React.HTMLAttributes<HTMLDivElement> {
    viewModel: TeamListViewModel;
    onTeamSelect?: (team: Team) => void;
}

export const TeamListView = observer(({ viewModel, onTeamSelect, ...rest }: TeamListViewProps) => {
    return (
        <div className="team-list" {...rest}>
            {viewModel.isLoading && <LoadingSpinner />}
            
            {viewModel.activeTeams.map(team => (
                <TeamItemView
                    key={team.id}
                    team={team}
                    onClick={() => onTeamSelect?.(team)}
                />
            ))}
        </div>
    );
});
```

### Layout Patterns

1. **Use Flexbox for component layouts**
2. **Avoid absolute positioning unless necessary for overlays**
3. **Components should participate in document flow**
4. **Use `rem` units for sizing (1rem = 10px as defined in base CSS)**

```css
/* ✅ GOOD - Flexbox layout */
.entry-view {
    display: flex;
    flex-direction: column;
    height: 100vh;
}

.entry-view__background {
    flex: 1;
    display: flex;
    flex-direction: row;
}

/* ❌ AVOID - Absolute positioning for main layout */
.rail {
    position: absolute; /* Only for overlays */
    top: 0;
    left: 0;
}
```

## Development Workflow

### Creating a New Feature

1. **Create directory structure**:
```bash
mkdir -p src/lib/newfeature
cd src/lib/newfeature
```

2. **Create ViewModel**:
```typescript
// newFeatureViewModel.ts
export class NewFeatureViewModel extends BaseViewModel {
    public static class: string = 'NewFeatureViewModel';
    
    constructor(services: IFrameworkServices) {
        super(services);
        makeObservable(this);
    }
}
```

3. **Create View**:
```tsx
// newFeatureView.tsx
export const NewFeatureView = observer(({ viewModel }: { viewModel: NewFeatureViewModel }) => {
    return <div>New Feature Content</div>;
});
```

4. **Write Tests**:
```typescript
// newFeatureViewModel.test.ts
describe('NewFeatureViewModel', () => {
    // Test cases
});
```

5. **Add to exports**:
```typescript
// index.ts
export { NewFeatureViewModel } from './lib/newfeature/newFeatureViewModel';
export { NewFeatureView } from './lib/newfeature/newFeatureView';
```

### Development Commands

```bash
# Start development server
npm run dev

# Build the project
npm run build

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run type-check

# Build and watch for changes
npm run build:watch
```

## Error Handling

### ViewModel Error Handling

```typescript
export class BaseViewModel {
    @observable errorMessage: string | null = null;
    @observable isLoading: boolean = false;

    @action protected setError(error: string | Error): void {
        this.errorMessage = error instanceof Error ? error.message : error;
    }

    @action protected clearError(): void {
        this.errorMessage = null;
    }

    @action protected async executeWithErrorHandling<T>(
        operation: () => Promise<T>,
        loadingFlag?: boolean
    ): Promise<T | null> {
        if (loadingFlag) this.isLoading = true;
        this.clearError();

        try {
            const result = await operation();
            return result;
        } catch (error) {
            this.setError(error as Error);
            return null;
        } finally {
            if (loadingFlag) {
                runInAction(() => {
                    this.isLoading = false;
                });
            }
        }
    }
}
```

## Performance Guidelines

### MobX Performance

1. **Use `@computed` for expensive calculations**
2. **Minimize observable depth**
3. **Use `reaction` for side effects**
4. **Avoid creating objects in render**

```typescript
// ✅ GOOD - Cached computation
@computed get expensiveCalculation(): number {
    return this.largeDataSet.reduce((sum, item) => sum + item.value, 0);
}

// ❌ BAD - Computed in render
const MyComponent = observer(() => {
    const total = viewModel.largeDataSet.reduce((sum, item) => sum + item.value, 0);
    return <div>{total}</div>;
});
```

### React Performance

1. **Use `React.memo` for expensive components**
2. **Implement `useMemo` for expensive calculations**
3. **Use `useCallback` for event handlers**
4. **Avoid inline object creation**

```typescript
// ✅ GOOD - Memoized component
export const ExpensiveComponent = React.memo(observer(({ data }) => {
    const processedData = useMemo(() => {
        return data.map(processItem);
    }, [data]);

    return <div>{processedData}</div>;
}));
```

### Bundle Size Optimization

1. **Use dynamic imports for large features**
2. **Tree-shake unused code**
3. **Optimize image assets**
4. **Use code splitting at route level**

```typescript
// Dynamic import for large features
const LazyFeature = React.lazy(() => import('./features/ExpensiveFeature'));

// Usage with Suspense
<Suspense fallback={<LoadingSpinner />}>
    <LazyFeature />
</Suspense>
```

Following these conventions ensures consistency across the codebase and makes it easier for new developers (and AI assistants) to understand and contribute to the project effectively.