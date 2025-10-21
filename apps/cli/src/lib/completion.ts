/**
 * Shell completion support for c4c CLI
 * Provides autocomplete for procedures and workflows
 */

import { readdir } from "node:fs/promises";
import { resolve, join, extname } from "node:path";
import { collectRegistry } from "@c4c/core";
import { determineProceduresPath, determineWorkflowsPath } from "./project-paths.js";

export interface CompletionOptions {
	root?: string;
}

/**
 * Get list of available procedures for autocomplete
 */
export async function listProceduresForCompletion(options: CompletionOptions = {}): Promise<string[]> {
	const rootDir = resolve(options.root ?? process.cwd());
	const proceduresPath = determineProceduresPath(rootDir);

	try {
		const registry = await collectRegistry(proceduresPath);
		return Array.from(registry.keys()).sort();
	} catch {
		return [];
	}
}

/**
 * Get list of available workflows for autocomplete
 */
export async function listWorkflowsForCompletion(options: CompletionOptions = {}): Promise<string[]> {
	const rootDir = resolve(options.root ?? process.cwd());
	const workflowsPath = determineWorkflowsPath(rootDir);

	try {
		const files = await findWorkflowFiles(workflowsPath);
		// Return workflow names with workflow/ prefix
		return files.map(f => `workflow/${f}`).sort();
	} catch {
		return [];
	}
}

/**
 * Find all workflow files in a directory
 */
async function findWorkflowFiles(dir: string): Promise<string[]> {
	const result: string[] = [];

	try {
		const entries = await readdir(dir, { withFileTypes: true });

		for (const entry of entries) {
			if (entry.isFile()) {
				const ext = extname(entry.name);
				if (ext === ".ts" || ext === ".js") {
					// Remove extension for cleaner names
					const name = entry.name.replace(/\.(ts|js)$/, "");
					result.push(name);
				}
			} else if (entry.isDirectory() && entry.name !== "node_modules") {
				// Recursively search subdirectories
				const subPath = join(dir, entry.name);
				const subFiles = await findWorkflowFiles(subPath);
				// Add subdirectory prefix
				result.push(...subFiles.map(f => `${entry.name}/${f}`));
			}
		}
	} catch {
		// Ignore errors (directory doesn't exist, etc.)
	}

	return result;
}

/**
 * Get all completions (procedures + workflows)
 */
export async function getAllCompletions(options: CompletionOptions = {}): Promise<string[]> {
	const [procedures, workflows] = await Promise.all([
		listProceduresForCompletion(options),
		listWorkflowsForCompletion(options),
	]);

	return [...procedures, ...workflows].sort();
}

/**
 * Generate bash completion script
 */
export function generateBashCompletion(): string {
	return `# c4c bash completion script
# Install: source <(c4c completion bash)
# Or add to ~/.bashrc: eval "$(c4c completion bash)"

_c4c_completion() {
    local cur prev words cword
    _init_completion || return

    # Check if we're completing after "exec"
    if [[ \${words[1]} == "exec" && \${cword} -eq 2 ]]; then
        # Get completions from c4c
        local completions
        completions=$(c4c completion list 2>/dev/null)
        COMPREPLY=($(compgen -W "$completions" -- "$cur"))
        return 0
    fi

    # Default completion for commands
    if [[ \${cword} -eq 1 ]]; then
        local commands="serve dev generate exec completion"
        COMPREPLY=($(compgen -W "$commands" -- "$cur"))
        return 0
    fi
}

complete -F _c4c_completion c4c
`;
}

/**
 * Generate zsh completion script
 */
export function generateZshCompletion(): string {
	return `#compdef c4c
# c4c zsh completion script
# Install: source <(c4c completion zsh)
# Or add to ~/.zshrc: eval "$(c4c completion zsh)"

_c4c() {
    local -a commands
    commands=(
        'serve:Start the c4c HTTP server'
        'dev:Start the c4c HTTP server with watch mode'
        'generate:Run code generators'
        'exec:Execute a procedure or workflow'
        'completion:Generate shell completion script'
    )

    local curcontext="\$curcontext" state line
    typeset -A opt_args

    _arguments -C \\
        '1: :->command' \\
        '*: :->args'

    case $state in
        command)
            _describe 'command' commands
            ;;
        args)
            case \${words[2]} in
                exec)
                    if [[ \${#words[@]} -eq 3 ]]; then
                        # Get completions for exec
                        local -a completions
                        completions=(\${(f)"$(c4c completion list 2>/dev/null)"})
                        _describe 'procedures and workflows' completions
                    fi
                    ;;
            esac
            ;;
    esac
}

_c4c "$@"
`;
}
