import { Agent } from './types';

/**
 * Gets all unique use case descriptions from agents (for filters)
 */
export function getAllUseCases(agents: Agent[]): string[] {
  const useCasesSet = new Set<string>();

  agents.forEach((agent) => {
    if (agent.useCases) {
      agent.useCases.forEach((uc) => useCasesSet.add(uc.description));
    }
  });

  return Array.from(useCasesSet).sort();
}

/**
 * Filters agents by use case description
 */
export function filterAgentsByUseCase(agents: Agent[], useCase: string): Agent[] {
  if (useCase === 'All' || useCase === '') {
    return agents;
  }

  return agents.filter((agent) =>
    agent.useCases && agent.useCases.some((uc) => uc.description === useCase)
  );
}
