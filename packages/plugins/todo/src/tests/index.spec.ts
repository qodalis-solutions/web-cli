import { CliTodoCommandProcessor } from '../lib/processors/cli-todo-command-processor';
import {
    parseDueDate,
    formatRelativeDate,
    isOverdue,
    migrateTodoItem,
    lineThroughText,
    TodoItem,
} from '../lib/utilities';

// ── Utility tests ───────────────────────────────────────────

describe('Todo Utilities', () => {
    describe('parseDueDate', () => {
        it('should parse "today"', () => {
            const result = parseDueDate('today');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const now = new Date();
            expect(d.getFullYear()).toBe(now.getFullYear());
            expect(d.getMonth()).toBe(now.getMonth());
            expect(d.getDate()).toBe(now.getDate());
        });

        it('should parse "tomorrow"', () => {
            const result = parseDueDate('tomorrow');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            expect(d.getDate()).toBe(tomorrow.getDate());
        });

        it('should parse "yesterday"', () => {
            const result = parseDueDate('yesterday');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            expect(d.getDate()).toBe(yesterday.getDate());
        });

        it('should parse "next week"', () => {
            const result = parseDueDate('next week');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const expected = new Date();
            expected.setDate(expected.getDate() + 7);
            expect(d.getDate()).toBe(expected.getDate());
        });

        it('should parse "next month"', () => {
            const result = parseDueDate('next month');
            expect(result).toBeDefined();
            const d = new Date(result!);
            const expected = new Date();
            expected.setMonth(expected.getMonth() + 1);
            expect(d.getMonth()).toBe(expected.getMonth());
        });

        it('should parse day names', () => {
            const result = parseDueDate('monday');
            expect(result).toBeDefined();
            const d = new Date(result!);
            expect(d.getDay()).toBe(1); // Monday
        });

        it('should parse ISO dates', () => {
            const result = parseDueDate('2026-06-15');
            expect(result).toBeDefined();
            const d = new Date(result!);
            expect(d.getFullYear()).toBe(2026);
            expect(d.getMonth()).toBe(5); // June (0-indexed)
            expect(d.getDate()).toBe(15);
        });

        it('should return null for invalid input', () => {
            expect(parseDueDate('not a date')).toBeNull();
            expect(parseDueDate('abc123')).toBeNull();
        });

        it('should be case-insensitive', () => {
            expect(parseDueDate('TODAY')).toBeDefined();
            expect(parseDueDate('Tomorrow')).toBeDefined();
            expect(parseDueDate('MONDAY')).toBeDefined();
        });
    });

    describe('formatRelativeDate', () => {
        it('should format today', () => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(today.toISOString())).toBe('due: today');
        });

        it('should format tomorrow', () => {
            const d = new Date();
            d.setDate(d.getDate() + 1);
            d.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(d.toISOString())).toBe('due: tomorrow');
        });

        it('should format yesterday as overdue', () => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            d.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(d.toISOString())).toBe('overdue: yesterday');
        });

        it('should format near future days', () => {
            const d = new Date();
            d.setDate(d.getDate() + 5);
            d.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(d.toISOString())).toBe('due: in 5 days');
        });

        it('should format past days as overdue', () => {
            const d = new Date();
            d.setDate(d.getDate() - 3);
            d.setHours(0, 0, 0, 0);
            expect(formatRelativeDate(d.toISOString())).toBe('overdue: 3 days ago');
        });
    });

    describe('isOverdue', () => {
        it('should return false for completed todos', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const todo: TodoItem = {
                id: 1, text: 'test', completed: true,
                createdAt: new Date().toISOString(),
                dueDate: yesterday.toISOString(),
            };
            expect(isOverdue(todo)).toBe(false);
        });

        it('should return false for todos without due date', () => {
            const todo: TodoItem = {
                id: 1, text: 'test', completed: false,
                createdAt: new Date().toISOString(),
            };
            expect(isOverdue(todo)).toBe(false);
        });

        it('should return true for past due incomplete todos', () => {
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const todo: TodoItem = {
                id: 1, text: 'test', completed: false,
                createdAt: new Date().toISOString(),
                dueDate: yesterday.toISOString(),
            };
            expect(isOverdue(todo)).toBe(true);
        });

        it('should return false for future due dates', () => {
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const todo: TodoItem = {
                id: 1, text: 'test', completed: false,
                createdAt: new Date().toISOString(),
                dueDate: tomorrow.toISOString(),
            };
            expect(isOverdue(todo)).toBe(false);
        });
    });

    describe('migrateTodoItem', () => {
        it('should add createdAt to old items', () => {
            const old = { id: 1, text: 'test', completed: false };
            const result = migrateTodoItem(old);
            expect(result.createdAt).toBeDefined();
        });

        it('should preserve existing fields', () => {
            const iso = '2026-01-01T00:00:00.000Z';
            const item = { id: 5, text: 'hello', completed: true, createdAt: iso };
            const result = migrateTodoItem(item);
            expect(result.id).toBe(5);
            expect(result.text).toBe('hello');
            expect(result.completed).toBe(true);
            expect(result.createdAt).toBe(iso);
        });
    });

    describe('lineThroughText', () => {
        it('should add strikethrough characters', () => {
            const result = lineThroughText('abc');
            expect(result).toContain('\u0336');
            expect(result.length).toBeGreaterThan(3);
        });
    });
});

// ── Processor tests ─────────────────────────────────────────

describe('CliTodoCommandProcessor', () => {
    let processor: CliTodoCommandProcessor;

    beforeEach(() => {
        if (typeof localStorage === 'undefined') {
            (window as any).localStorage = {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
            };
        }
        spyOn(localStorage, 'getItem').and.returnValue(null);
        processor = new CliTodoCommandProcessor();
    });

    it('should be created', () => {
        expect(processor).toBeDefined();
    });

    describe('command identity', () => {
        it('should have command name "todo"', () => {
            expect(processor.command).toBe('todo');
        });

        it('should have a description', () => {
            expect(processor.description).toBeDefined();
            expect(processor.description!.length).toBeGreaterThan(0);
        });

        it('should have metadata with an icon', () => {
            expect(processor.metadata).toBeDefined();
            expect(processor.metadata!.icon).toBe('📝');
        });

        it('should have an author', () => {
            expect(processor.author).toBeDefined();
        });

        it('should have a version', () => {
            expect(processor.version).toBeDefined();
        });
    });

    describe('sub-processors', () => {
        it('should have exactly 6 sub-processors', () => {
            expect(processor.processors!.length).toBe(6);
        });

        const expectedCommands = ['ls', 'add', 'edit', 'done', 'toggle', 'rm'];

        expectedCommands.forEach((cmd) => {
            it(`should include "${cmd}" sub-processor`, () => {
                const sub = processor.processors!.find((p) => p.command === cmd);
                expect(sub).toBeDefined();
                expect(sub!.description).toBeDefined();
                expect(typeof sub!.processCommand).toBe('function');
            });
        });

        it('"done" should have alias "complete"', () => {
            const sub = processor.processors!.find((p) => p.command === 'done');
            expect(sub!.aliases).toContain('complete');
        });

        it('"ls" should have alias "list"', () => {
            const sub = processor.processors!.find((p) => p.command === 'ls');
            expect(sub!.aliases).toContain('list');
        });

        it('"rm" should have alias "remove"', () => {
            const sub = processor.processors!.find((p) => p.command === 'rm');
            expect(sub!.aliases).toContain('remove');
        });
    });

    describe('sub-processor configuration', () => {
        it('"add" should have valueRequired and acceptsRawInput', () => {
            const sub = processor.processors!.find((p) => p.command === 'add');
            expect(sub!.valueRequired).toBe(true);
            expect(sub!.acceptsRawInput).toBe(true);
        });

        it('"add" should have a "due" parameter', () => {
            const sub = processor.processors!.find((p) => p.command === 'add');
            const dueParam = sub!.parameters!.find((p) => p.name === 'due');
            expect(dueParam).toBeDefined();
            expect(dueParam!.type).toBe('string');
        });

        it('"edit" should have valueRequired and acceptsRawInput', () => {
            const sub = processor.processors!.find((p) => p.command === 'edit');
            expect(sub!.valueRequired).toBe(true);
            expect(sub!.acceptsRawInput).toBe(true);
        });

        it('"edit" should have a "due" parameter', () => {
            const sub = processor.processors!.find((p) => p.command === 'edit');
            const dueParam = sub!.parameters!.find((p) => p.name === 'due');
            expect(dueParam).toBeDefined();
        });

        it('"done" should have valueRequired and acceptsRawInput', () => {
            const sub = processor.processors!.find((p) => p.command === 'done');
            expect(sub!.valueRequired).toBe(true);
            expect(sub!.acceptsRawInput).toBe(true);
        });

        it('"toggle" should have valueRequired and acceptsRawInput', () => {
            const sub = processor.processors!.find((p) => p.command === 'toggle');
            expect(sub!.valueRequired).toBe(true);
            expect(sub!.acceptsRawInput).toBe(true);
        });

        it('"rm" should have an "all" parameter with alias "a"', () => {
            const sub = processor.processors!.find((p) => p.command === 'rm');
            const allParam = sub!.parameters!.find((p) => p.name === 'all');
            expect(allParam).toBeDefined();
            expect(allParam!.type).toBe('boolean');
            expect(allParam!.aliases).toContain('a');
        });

        it('"ls" should have pending, completed, and overdue parameters', () => {
            const sub = processor.processors!.find((p) => p.command === 'ls');
            expect(sub!.parameters!.find((p) => p.name === 'pending')).toBeDefined();
            expect(sub!.parameters!.find((p) => p.name === 'completed')).toBeDefined();
            expect(sub!.parameters!.find((p) => p.name === 'overdue')).toBeDefined();
        });
    });

    describe('stateConfiguration', () => {
        it('should have stateConfiguration with todos', () => {
            expect(processor.stateConfiguration).toBeDefined();
            expect(processor.stateConfiguration!.initialState['todos']).toBeDefined();
        });
    });

    describe('methods', () => {
        it('should have processCommand', () => {
            expect(typeof processor.processCommand).toBe('function');
        });

        it('should have writeDescription', () => {
            expect(typeof processor.writeDescription).toBe('function');
        });

        it('should have initialize', () => {
            expect(typeof processor.initialize).toBe('function');
        });

        it('should have getTodos', () => {
            expect(typeof processor.getTodos).toBe('function');
            expect(Array.isArray(processor.getTodos())).toBe(true);
        });
    });
});
