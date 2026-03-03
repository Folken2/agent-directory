/**
 * Formats an agent name for display
 * Converts underscores to spaces and applies title case
 * Example: "image_generation_agent" => "Image Generation Agent"
 */
export function formatAgentDisplayName(name: string): string {
    return name
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

/**
 * Normalizes an agent name for API calls
 * Converts spaces to underscores and applies lowercase
 * Example: "Image Generation Agent" => "image_generation_agent"
 */
export function normalizeAgentName(displayName: string): string {
    return displayName.toLowerCase().replace(/\s+/g, '_');
}
