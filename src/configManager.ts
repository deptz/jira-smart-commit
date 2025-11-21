import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Config } from './utils';

export type RepoConfig = Partial<Omit<Config, 'baseUrl' | 'email'>>;

const CONFIG_FILE_NAME = '.jira-smart-commit.json';

export function loadRepoConfigSync(cwd: string): RepoConfig | undefined {
    try {
        const configPath = path.join(cwd, CONFIG_FILE_NAME);
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            return JSON.parse(content);
        }
    } catch (error) {
        console.warn(`Failed to load ${CONFIG_FILE_NAME} from ${cwd}:`, error);
    }
    return undefined;
}

export function mergeConfig(base: Config, repo?: RepoConfig): Config {
    if (!repo) return base;

    // Security: Prevent overriding sensitive fields if they were somehow in RepoConfig type
    // (The type definition already omits them, but runtime check is safer)
    const safeRepoConfig = { ...repo };
    delete (safeRepoConfig as any).baseUrl;
    delete (safeRepoConfig as any).email;

    return {
        ...base,
        ...safeRepoConfig,
        // Ensure numeric limits are respected if overridden
        commitHistoryLimit: repo.commitHistoryLimit
            ? Math.min(repo.commitHistoryLimit, 10)
            : base.commitHistoryLimit
    };
}
