export enum DataExplorerLanguage {
    Sql = 'sql',
    Json = 'json',
    Shell = 'shell',
    Graphql = 'graphql',
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
}

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
}
