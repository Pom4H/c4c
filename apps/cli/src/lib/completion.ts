/**
 * Shell completion support for c4c CLI
 * Provides autocomplete for procedures and workflows
 */

import { resolve } from "node:path";
import { collectProjectArtifacts } from "@c4c/core";

export interface CompletionOptions {
	root?: string;
}

/**
 * Get list of available procedures for autocomplete
 */
export async function listProceduresForCompletion(options: CompletionOptions = {}): Promise<string[]> {
	const rootDir = resolve(options.root ?? process.cwd());

	try {
		const artifacts = await collectProjectArtifacts(rootDir);
		return Array.from(artifacts.procedures.keys()).sort();
	} catch {
		return [];
	}
}

/**
 * Get list of available workflows for autocomplete
 */
export async function listWorkflowsForCompletion(options: CompletionOptions = {}): Promise<string[]> {
	const rootDir = resolve(options.root ?? process.cwd());

	try {
		const artifacts = await collectProjectArtifacts(rootDir);
		return Array.from(artifacts.workflows.keys()).sort();
	} catch {
		return [];
	}
}

/**
 * Get all completions (procedures + workflows)
 */
export async function getAllCompletions(options: CompletionOptions = {}): Promise<string[]> {
	try {
		const procedureCompletions = await listProceduresForCompletion(options);
		const workflowCompletions = await listWorkflowsForCompletion(options);
		return [...procedureCompletions, ...workflowCompletions];
	} catch {
		return [];
	}
}

/**
 * Generate bash completion script
 */
export function generateBashCompletion(): string {
	return `
_c4c_completion() {
  local cur="\${COMP_WORDS[COMP_CWORD]}"
  local prev="\${COMP_WORDS[COMP_CWORD-1]}"
  
  case "\$prev" in
    exec)
      # Complete procedure/workflow names
      local names=\$(c4c completion list 2>/dev/null)
      COMPREPLY=( \$(compgen -W "\$names" -- "\$cur") )
      return 0
      ;;
    *)
      # Complete commands
      COMPREPLY=( \$(compgen -W "serve dev exec generate completion" -- "\$cur") )
      return 0
      ;;
  esac
}

complete -F _c4c_completion c4c
`.trim();
}

/**
 * Generate zsh completion script
 */
export function generateZshCompletion(): string {
	return `
#compdef c4c

_c4c() {
  local -a commands
  commands=(
    'serve:Start the c4c HTTP server'
    'dev:Start the c4c HTTP server with watch mode'
    'exec:Execute a procedure or workflow'
    'generate:Run code generators'
    'completion:Generate shell completion scripts'
  )

  local -a procedures
  procedures=(\${(f)"\$(c4c completion list 2>/dev/null)"})

  _arguments \\
    '1: :->command' \\
    '*::arg:->args'

  case $state in
    command)
      _describe 'command' commands
      ;;
    args)
      case $words[1] in
        exec)
          _describe 'procedure or workflow' procedures
          ;;
      esac
      ;;
  esac
}

_c4c
`.trim();
}
