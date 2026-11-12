export enum DataExplorerLanguage {
    Sql = 'sql',
    Json = 'json',
    Shell = 'shell',
    Graphql = 'graphql',
    Redis = 'redis',
    Elasticsearch = 'elasticsearch',
}

export enum DataExplorerOutputFormat {
    Table = 'table',
    Json = 'json',
    Csv = 'csv',
    Raw = 'raw',
}

export interface DataExplorerTemplate {
    name: string;
    query: string;
    description?: string;
    parameters?: Record<string, unknown>;
}

export interface DataExplorerParameterDescriptor {
    name: string;
    description?: string;
    required?: boolean;
    defaultValue?: unknown;
}

export interface DataExplorerSourceInfo {
    name: string;
    description: string;
    language: DataExplorerLanguage;
    defaultOutputFormat: DataExplorerOutputFormat;
    templates: DataExplorerTemplate[];
    parameters: DataExplorerParameterDescriptor[];
    /** The server refuses queries that write (servers from 1.0.0-beta.25). */
    readOnly?: boolean;
    /** False when the caller may not export results (json/csv output). */
    canExport?: boolean;
}

/** Why a server refused a query (`errorCode`); newer servers may send others. */
export type DataExplorerErrorCode =
    | 'forbidden'
    | 'rate_limited'
    | 'read_only'
    | 'object_not_allowed'
    | 'unknown_source'
    | 'masked_column';

export interface DataExplorerResult {
    success: boolean;
    source: string;
    language: DataExplorerLanguage;
    defaultOutputFormat: DataExplorerOutputFormat;
    executionTime: number;
    columns: string[] | null;
    rows: unknown[][] | Record<string, unknown>[];
    rowCount: number;
    truncated: boolean;
    error: string | null;
    /** Why the server refused the query (shown with a hint for some codes). */
    errorCode?: DataExplorerErrorCode | (string & {});
}

export interface DataExplorerSchemaColumn {
    name: string;
    type: string;
    nullable: boolean;
    primaryKey: boolean;
}

export interface DataExplorerSchemaTable {
    name: string;
    type: string;
    columns: DataExplorerSchemaColumn[];
}

export interface DataExplorerSchemaResult {
    source: string;
    tables: DataExplorerSchemaTable[];
}
