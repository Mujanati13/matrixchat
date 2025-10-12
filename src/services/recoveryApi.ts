import axios, { AxiosResponse } from 'axios';

import { homeserverUrl } from '@services/matrixApi';

const API_BASES = [`${homeserverUrl}/api/api`, `${homeserverUrl}/api`];

type RecoveryRequest = {
  user_id: string;
  recovery_key_hash: string;
};

type ResetPasswordRequest = {
  user_id: string;
  new_password: string;
};

type MatrixSession = {
  access_token: string;
  user_id: string;
};

const shouldFallbackToAlternateBase = (error: unknown) => {
  if (!axios.isAxiosError(error)) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  const { status } = error.response;
  return status === 404 || status === 308 || status === 307;
};

const postWithFallback = async <T>(
  path: string,
  payload: unknown,
): Promise<AxiosResponse<T>> => {
  let lastError: unknown;

  for (let index = 0; index < API_BASES.length; index += 1) {
    const base = API_BASES[index];
    try {
      return await axios.post<T>(`${base}/${path}`, payload);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        return error.response as AxiosResponse<T>;
      }

      lastError = error;
      const hasNextBase = index < API_BASES.length - 1;
      if (!hasNextBase || !shouldFallbackToAlternateBase(error)) {
        throw error;
      }
    }
  }

  throw lastError ?? new Error('Unable to reach recovery service');
};

// Fallback using Matrix account data API
const storeRecoveryKeyInAccountData = async (
  session: MatrixSession, 
  recoveryKeyHash: string
) => {
  const eventType = 'com.matrixchat.recovery_key';
  const url = `${homeserverUrl}/_matrix/client/v3/user/${encodeURIComponent(session.user_id)}/account_data/${eventType}`;
  
  const payload = {
    recovery_key_hash: recoveryKeyHash,
    created_at: new Date().toISOString(),
  };

  await axios.put(url, payload, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
  });
};

const getRecoveryKeyFromAccountData = async (
  session: MatrixSession
): Promise<string | null> => {
  try {
    const eventType = 'com.matrixchat.recovery_key';
    const url = `${homeserverUrl}/_matrix/client/v3/user/${encodeURIComponent(session.user_id)}/account_data/${eventType}`;
    
    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    });

    return response.data?.recovery_key_hash || null;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return null; // No recovery key stored
    }
    throw error;
  }
};
export const storeRecoveryKey = async (payload: RecoveryRequest, session?: MatrixSession) => {
  console.log('storeRecoveryKey called with:', {
    payload: { user_id: payload.user_id, hasHash: !!payload.recovery_key_hash },
    session: session ? { hasAccessToken: !!session.access_token, hasUserId: !!session.user_id } : null
  });

  if (!session) {
    console.error('No session provided for account data storage');
    throw new Error('No session provided for account data storage');
  }
  
  if (!session.access_token) {
    console.error('Session missing access_token');
    throw new Error('Session missing access_token');
  }
  
  if (!session.user_id) {
    console.error('Session missing user_id');
    throw new Error('Session missing user_id');
  }

  // Use Matrix account data directly (skip custom API since it doesn't exist)
  console.log('Storing recovery key using Matrix account data...');
  await storeRecoveryKeyInAccountData(session, payload.recovery_key_hash);
  console.log('Recovery key stored successfully using Matrix account data');
};

export const verifyRecoveryKey = async (
  payload: RecoveryRequest,
  session?: MatrixSession
): Promise<boolean> => {
  // If we have a session, try account data directly
  if (session) {
    console.log('Verifying recovery key using Matrix account data...');
    try {
      const storedHash = await getRecoveryKeyFromAccountData(session);
      const isValid = storedHash === payload.recovery_key_hash;
      console.log('Account data verification result:', isValid);
      return isValid;
    } catch (error) {
      console.error('Account data verification failed:', error);
      return false;
    }
  }

  // For recovery without session (during login), try custom API
  try {
    console.log('Attempting custom recovery API verification...');
    const response = await postWithFallback('verifyRecoveryKey', payload);
    if (response.status === 409) {
      return true;
    }
    return response.status >= 200 && response.status < 300;
  } catch (error: any) {
    console.log('Custom recovery verification failed:', error);
    
    if (axios.isAxiosError(error) && error.response) {
      const { status } = error.response;
      if (status === 409) {
        return true;
      }
      // For recovery (no session), if we get 404, just return false
      if (status === 404) {
        console.log('Custom recovery API not available, returning false');
        return false;
      }
      return status >= 200 && status < 300;
    }
    throw error;
  }
};

export const resetPasswordAdmin = async (payload: ResetPasswordRequest) => {
  await postWithFallback('resetPasswordAdmin', payload);
};

export const isRecoveryEndpointMissing = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 404;
