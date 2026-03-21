import { colorizeJson } from '@qodalis/cli-core';
import { DataExplorerLanguage } from '../models/data-explorer-types';

// ANSI color codes
const R = '\x1b[0m';       // reset
const BB = '\x1b[1;34m';   // bold blue  — keywords
const G = '\x1b[32m';      // green      — strings
const Y = '\x1b[33m';      // yellow     — numbers, booleans
const M = '\x1b[35m';      // magenta    — operators, directives
const C = '\x1b[36m';      // cyan       — types, functions, methods
const GR = '\x1b[90m';     // gray       — comments

/**
 * Highlight a single line of text based on the query language.
 * Uses nano-style regex scanning: iterate left-to-right, match the
 * first applicable token pattern, emit colored output.
 */
export function highlightLine(
    text: string,
    language: DataExplorerLanguage,
): string {
    switch (language) {
        case DataExplorerLanguage.Sql:
            return highlightSql(text);
        case DataExplorerLanguage.Json:
            return colorizeJson(text);
        case DataExplorerLanguage.Graphql:
            return highlightGraphql(text);
        case DataExplorerLanguage.Shell:
            return highlightShell(text);
        case DataExplorerLanguage.Redis:
            return highlightRedis(text);
        case DataExplorerLanguage.Elasticsearch:
            return highlightElasticsearch(text);
        default:
            return text;
    }
}

// ── SQL ──────────────────────────────────────────────────────────────

const SQL_KEYWORDS = new Set([
    'SELECT', 'FROM', 'WHERE', 'INSERT', 'UPDATE', 'DELETE', 'JOIN',
    'ON', 'AND', 'OR', 'NOT', 'IN', 'IS', 'NULL', 'AS', 'ORDER',
    'BY', 'GROUP', 'HAVING', 'LIMIT', 'OFFSET', 'CREATE', 'ALTER',
    'DROP', 'TABLE', 'INDEX', 'VIEW', 'SET', 'VALUES', 'INTO',
    'DISTINCT', 'BETWEEN', 'LIKE', 'EXISTS', 'UNION', 'ALL', 'ANY',
    'CASE', 'WHEN', 'THEN', 'ELSE', 'END', 'BEGIN', 'COMMIT',
    'ROLLBACK', 'PRIMARY', 'KEY', 'FOREIGN', 'REFERENCES',
    'DEFAULT', 'CHECK', 'UNIQUE', 'CASCADE', 'ASC', 'DESC',
    'LEFT', 'RIGHT', 'INNER', 'OUTER', 'CROSS', 'FULL', 'NATURAL',
    'WITH', 'RECURSIVE', 'OVER', 'PARTITION', 'PRAGMA', 'EXPLAIN',
    'REPLACE', 'RETURNING', 'TRUNCATE', 'IF', 'TRUE', 'FALSE',
    'AUTOINCREMENT', 'ROWID', 'GLOB', 'REGEXP', 'VACUUM',
    'ATTACH', 'DETACH', 'REINDEX', 'ANALYZE', 'CONFLICT',
    'CONSTRAINT', 'TRANSACTION', 'TRIGGER', 'PROCEDURE',
    'DECLARE', 'FETCH', 'NEXT', 'FIRST', 'LAST', 'ROWS', 'ONLY',
]);

const SQL_FUNCTIONS = new Set([
    'COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'COALESCE', 'NULLIF',
    'CAST', 'TYPEOF', 'LENGTH', 'SUBSTR', 'SUBSTRING', 'TRIM',
    'UPPER', 'LOWER', 'ABS', 'ROUND', 'RANDOM', 'HEX', 'QUOTE',
    'IFNULL', 'IIF', 'INSTR', 'REPLACE', 'ZEROBLOB', 'TOTAL',
    'GROUP_CONCAT', 'UNICODE', 'CHAR', 'PRINTF', 'LIKE',
    'DATE', 'TIME', 'DATETIME', 'JULIANDAY', 'STRFTIME',
    'ROW_NUMBER', 'RANK', 'DENSE_RANK', 'NTILE', 'LAG', 'LEAD',
    'FIRST_VALUE', 'LAST_VALUE', 'NTH_VALUE',
]);

const SQL_TYPES = new Set([
    'INTEGER', 'INT', 'SMALLINT', 'BIGINT', 'TINYINT',
    'REAL', 'FLOAT', 'DOUBLE', 'DECIMAL', 'NUMERIC',
    'TEXT', 'VARCHAR', 'CHAR', 'NCHAR', 'NVARCHAR', 'CLOB',
    'BLOB', 'BOOLEAN', 'DATE', 'DATETIME', 'TIMESTAMP',
    'SERIAL',
]);

// Token regex: strings, comments, numbers, identifiers, operators, rest
const SQL_TOKEN_RE =
    /('(?:''|[^'])*'?)|("(?:[^"\\]|\\.)*"?)|(--.*$)|(\/\*[\s\S]*?\*\/)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\b[a-zA-Z_]\w*\b)|([<>=!]+|[;,().*+\-/])/g;

function highlightSql(text: string): string {
    let result = '';
    let lastIndex = 0;

    SQL_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = SQL_TOKEN_RE.exec(text)) !== null) {
        if (m.index > lastIndex) {
            result += text.slice(lastIndex, m.index);
        }

        const token = m[0];
        const upper = token.toUpperCase();

        if (m[1] !== undefined || m[2] !== undefined) {
            result += G + token + R;                     // string
        } else if (m[3] !== undefined || m[4] !== undefined) {
            result += GR + token + R;                    // comment
        } else if (m[5] !== undefined) {
            result += Y + token + R;                     // number
        } else if (m[6] !== undefined) {
            if (SQL_KEYWORDS.has(upper)) {
                result += BB + token + R;                // keyword
            } else if (SQL_FUNCTIONS.has(upper)) {
                result += C + token + R;                 // function
            } else if (SQL_TYPES.has(upper)) {
                result += C + token + R;                 // type
            } else {
                result += token;                         // identifier
            }
        } else if (m[7] !== undefined) {
            if (token === ';') {
                result += M + token + R;                 // semicolon
            } else {
                result += token;                         // other operator
            }
        }

        lastIndex = m.index + token.length;
    }

    if (lastIndex < text.length) {
        result += text.slice(lastIndex);
    }
    return result;
}

// ── GraphQL ──────────────────────────────────────────────────────────

const GQL_KEYWORDS = new Set([
    'QUERY', 'MUTATION', 'SUBSCRIPTION', 'FRAGMENT', 'TYPE', 'INPUT',
    'ENUM', 'INTERFACE', 'UNION', 'SCALAR', 'SCHEMA', 'EXTEND',
    'IMPLEMENTS', 'ON', 'DIRECTIVE', 'REPEATABLE',
]);

const GQL_TYPES = new Set(['STRING', 'INT', 'FLOAT', 'BOOLEAN', 'ID']);

const GQL_TOKEN_RE =
    /("""[\s\S]*?"""|"(?:[^"\\]|\\.)*"?)|(#.*$)|(\$[a-zA-Z_]\w*)|(@[a-zA-Z_]\w*)|(\b\d+(?:\.\d+)?\b)|(\b[a-zA-Z_]\w*\b)|([{}()[\]:!=|&])/g;

function highlightGraphql(text: string): string {
    let result = '';
    let lastIndex = 0;

    GQL_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = GQL_TOKEN_RE.exec(text)) !== null) {
        if (m.index > lastIndex) {
            result += text.slice(lastIndex, m.index);
        }

        const token = m[0];

        if (m[1] !== undefined) {
            result += G + token + R;                     // string
        } else if (m[2] !== undefined) {
            result += GR + token + R;                    // comment
        } else if (m[3] !== undefined) {
            result += C + token + R;                     // variable $name
        } else if (m[4] !== undefined) {
            result += M + token + R;                     // directive @name
        } else if (m[5] !== undefined) {
            result += Y + token + R;                     // number
        } else if (m[6] !== undefined) {
            const upper = token.toUpperCase();
            if (GQL_KEYWORDS.has(upper)) {
                result += BB + token + R;                // keyword
            } else if (GQL_TYPES.has(upper)) {
                result += C + token + R;                 // built-in type
            } else if (token === 'true' || token === 'false' || token === 'null') {
                result += Y + token + R;                 // boolean/null
            } else {
                result += token;                         // identifier
            }
        } else if (m[7] !== undefined) {
            result += token;                             // punctuation
        }

        lastIndex = m.index + token.length;
    }

    if (lastIndex < text.length) {
        result += text.slice(lastIndex);
    }
    return result;
}

// ── Redis ─────────────────────────────────────────────────────────────

const REDIS_COMMANDS = new Set([
    'GET', 'SET', 'DEL', 'KEYS', 'HGET', 'HSET', 'HGETALL', 'HDEL',
    'HKEYS', 'HVALS', 'LPUSH', 'RPUSH', 'LRANGE', 'LLEN', 'SADD',
    'SMEMBERS', 'SCARD', 'ZADD', 'ZRANGE', 'ZRANGEBYSCORE', 'INCR',
    'DECR', 'EXPIRE', 'TTL', 'PTTL', 'EXISTS', 'TYPE', 'MGET', 'MSET',
    'SCAN', 'INFO', 'DBSIZE', 'PING', 'FLUSHDB',
]);

const REDIS_FLAGS = new Set([
    'EX', 'NX', 'XX', 'KEEPTTL', 'GT', 'LT', 'CH', 'WITHSCORES',
    'MATCH', 'COUNT', 'LIMIT', 'REV', 'BYSCORE', 'BYLEX',
]);

// Token regex: strings (single/double), numbers, --flags, identifiers
const REDIS_TOKEN_RE =
    /('(?:[^'\\]|\\.)*'?)|("(?:[^"\\]|\\.)*"?)|(--[a-zA-Z_]\w*)|(-?\b\d+\b)|(\b[a-zA-Z_]\w*\b)/g;

function highlightRedis(text: string): string {
    let result = '';
    let lastIndex = 0;

    REDIS_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = REDIS_TOKEN_RE.exec(text)) !== null) {
        if (m.index > lastIndex) {
            result += text.slice(lastIndex, m.index);
        }

        const token = m[0];
        const upper = token.toUpperCase();

        if (m[1] !== undefined || m[2] !== undefined) {
            result += G + token + R;                     // string
        } else if (m[3] !== undefined) {
            result += C + token + R;                     // --flag
        } else if (m[4] !== undefined) {
            result += Y + token + R;                     // number
        } else if (m[5] !== undefined) {
            if (REDIS_COMMANDS.has(upper)) {
                result += BB + token + R;                // command
            } else if (REDIS_FLAGS.has(upper)) {
                result += C + token + R;                 // uppercase flag
            } else {
                result += token;                         // identifier / key name
            }
        }

        lastIndex = m.index + token.length;
    }

    if (lastIndex < text.length) {
        result += text.slice(lastIndex);
    }
    return result;
}

// ── Shell (MongoDB / JavaScript) ─────────────────────────────────────

const SHELL_KEYWORDS = new Set([
    'VAR', 'LET', 'CONST', 'FUNCTION', 'RETURN', 'IF', 'ELSE',
    'FOR', 'WHILE', 'DO', 'SWITCH', 'CASE', 'BREAK', 'CONTINUE',
    'NEW', 'DELETE', 'TYPEOF', 'INSTANCEOF', 'THIS', 'THROW',
    'TRY', 'CATCH', 'FINALLY', 'CLASS', 'EXTENDS', 'IMPORT',
    'EXPORT', 'DEFAULT', 'YIELD', 'ASYNC', 'AWAIT', 'OF', 'IN',
]);

const SHELL_CONSTANTS = new Set([
    'TRUE', 'FALSE', 'NULL', 'UNDEFINED', 'NAN', 'INFINITY',
]);

const SHELL_TOKEN_RE =
    /('(?:[^'\\]|\\.)*'?)|("(?:[^"\\]|\\.)*"?)|(`(?:[^`\\]|\\.)*`?)|(\/\/.*$)|(\/\*[\s\S]*?\*\/)|(\$[a-zA-Z_]\w*)|(\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)|(\.[a-zA-Z_]\w*)|(\b[a-zA-Z_]\w*\b)|([{}()[\];,=<>!+\-*/%&|^~?:])/g;

function highlightShell(text: string): string {
    let result = '';
    let lastIndex = 0;

    SHELL_TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;

    while ((m = SHELL_TOKEN_RE.exec(text)) !== null) {
        if (m.index > lastIndex) {
            result += text.slice(lastIndex, m.index);
        }

        const token = m[0];

        if (m[1] !== undefined || m[2] !== undefined || m[3] !== undefined) {
            result += G + token + R;                     // string
        } else if (m[4] !== undefined || m[5] !== undefined) {
            result += GR + token + R;                    // comment
        } else if (m[6] !== undefined) {
            result += C + token + R;                     // variable $name
        } else if (m[7] !== undefined) {
            result += Y + token + R;                     // number
        } else if (m[8] !== undefined) {
            result += '.' + C + token.slice(1) + R;      // .method
        } else if (m[9] !== undefined) {
            const upper = token.toUpperCase();
            if (SHELL_KEYWORDS.has(upper)) {
                result += BB + token + R;                // keyword
            } else if (SHELL_CONSTANTS.has(upper)) {
                result += Y + token + R;                 // constant
            } else if (token === 'db') {
                result += M + token + R;                 // db object
            } else {
                result += token;                         // identifier
            }
        } else if (m[10] !== undefined) {
            result += token;                             // punctuation
        }

        lastIndex = m.index + token.length;
    }

    if (lastIndex < text.length) {
        result += text.slice(lastIndex);
    }
    return result;
}

// ── Elasticsearch ─────────────────────────────────────────────────────

// Matches: VERB /path?params  (e.g. "GET /my-index/_search?pretty")
// Groups: [1] verb  [2] path (without query)  [3] query string (with ?)
const ES_FIRST_LINE_RE = /^(GET|POST|PUT|DELETE|HEAD)\s+(\/[^?\s]*)(\?[^\s]*)?$/;

// Matches bare paths: starting with _ or / (e.g. "_cat/indices", "/_cluster/health")
const ES_BARE_PATH_RE = /^([/_][^\s?]*)(\?[^\s]*)?$/;

function highlightElasticsearch(text: string): string {
    const trimmed = text.trim();

    // Try to match first-line pattern: VERB /path?params
    const firstLine = ES_FIRST_LINE_RE.exec(trimmed);
    if (firstLine) {
        const leadingSpace = text.slice(0, text.indexOf(trimmed));
        const verb = firstLine[1];
        const path = firstLine[2];
        const query = firstLine[3] ?? '';
        // Reconstruct with colors, preserving any leading whitespace
        return leadingSpace + BB + verb + R + ' ' + C + path + R + (query ? Y + query + R : '');
    }

    // Try to match bare path shortcut: _cat/indices, /_cluster/health, etc.
    const barePath = ES_BARE_PATH_RE.exec(trimmed);
    if (barePath) {
        const leadingSpace = text.slice(0, text.indexOf(trimmed));
        const path = barePath[1];
        const query = barePath[2] ?? '';
        return leadingSpace + C + path + R + (query ? Y + query + R : '');
    }

    // Otherwise treat as JSON body line
    return colorizeJson(text);
}
