import { Agent } from './types';

export interface UseCase {
  name: string;
  agents: Agent[];
  description?: string;
}

/**
 * Groups agents by their use cases
 */
export function groupAgentsByUseCase(agents: Agent[]): UseCase[] {
  const useCaseMap = new Map<string, Agent[]>();

  agents.forEach((agent) => {
    if (agent.useCases && agent.useCases.length > 0) {
      agent.useCases.forEach((useCase) => {
        if (!useCaseMap.has(useCase)) {
          useCaseMap.set(useCase, []);
        }
        useCaseMap.get(useCase)!.push(agent);
      });
    } else {
      // Agents without use cases go into "General" category
      if (!useCaseMap.has('General')) {
        useCaseMap.set('General', []);
      }
      useCaseMap.get('General')!.push(agent);
    }
  });

  return Array.from(useCaseMap.entries())
    .map(([name, agents]) => ({
      name,
      agents,
    }))
    .sort((a, b) => {
      // Sort by number of agents (descending), then alphabetically
      if (b.agents.length !== a.agents.length) {
        return b.agents.length - a.agents.length;
      }
      return a.name.localeCompare(b.name);
    });
}

/**
 * Gets all unique use cases from agents
 */
export function getAllUseCases(agents: Agent[]): string[] {
  const useCasesSet = new Set<string>();
  
  agents.forEach((agent) => {
    if (agent.useCases) {
      agent.useCases.forEach((useCase) => useCasesSet.add(useCase));
    }
  });

  return Array.from(useCasesSet).sort();
}

/**
 * Filters agents by use case
 */
export function filterAgentsByUseCase(agents: Agent[], useCase: string): Agent[] {
  if (useCase === 'All' || useCase === '') {
    return agents;
  }
  
  return agents.filter((agent) => 
    agent.useCases && agent.useCases.includes(useCase)
  );
}

