import { homeserverName } from '@services/matrixApi';

const DEFAULT_SERVER = homeserverName;

export const ensureMatrixId = (usernameOrMatrixId: string) => {
  const trimmed = usernameOrMatrixId.trim();
  if (trimmed.startsWith('@') && trimmed.includes(':')) {
    return trimmed;
  }
  const localPart = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
  if (localPart.includes(':')) {
    return `@${localPart}`;
  }
  return `@${localPart}:${DEFAULT_SERVER}`;
};

/**
 * Extract a clean display name from a Matrix ID
 * @param matrixId - Full Matrix ID like @username:server.com or room alias
 * @returns Just the username/localpart without @ or server
 * @example extractDisplayName('@john:matrix.org') => 'john'
 * @example extractDisplayName('#room:server.com') => 'room'
 * @example extractDisplayName('!abc123:server.com') => '!abc123:server.com' (fallback for room IDs)
 */
export const extractDisplayName = (matrixId: string): string => {
  if (!matrixId) return 'Unknown';
  
  // If it's a room ID (starts with !), return as-is since we can't make it prettier
  if (matrixId.startsWith('!')) {
    return matrixId;
  }
  
  // For user IDs (@username:server) or room aliases (#name:server)
  if (matrixId.startsWith('@') || matrixId.startsWith('#')) {
    const withoutPrefix = matrixId.slice(1);
    const localpart = withoutPrefix.split(':')[0];
    return localpart || matrixId;
  }
  
  // If it already looks like a plain username, return it
  return matrixId;
};
