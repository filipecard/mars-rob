import { DomainError } from '../errors/DomainError.js';

export interface SourceLocation {
  line: number;
  column: number;
}

// Erro no texto do script, encontrado antes de executar (lexer ou parser)
export class ScriptSyntaxError extends DomainError {
  constructor(
    readonly reason: string,
    readonly location: SourceLocation,
  ) {
    super(`Erro de sintaxe na linha ${describe(location)}: ${reason}`);
  }
}

// Erro durante a execução do script
export class ScriptRuntimeError extends DomainError {
  constructor(
    readonly reason: string,
    readonly location: SourceLocation,
  ) {
    super(`Erro na linha ${describe(location)}: ${reason}`);
  }
}

function describe({ line, column }: SourceLocation): string {
  return `${String(line)}, coluna ${String(column)}`;
}
