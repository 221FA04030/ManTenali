import { OAuth2Client } from 'google-auth-library';
import { getEnv } from '../../config/env.js';
import { AppError } from '../errors/index.js';

let client;

/**
 * Thin wrapper around google-auth-library. Verifies a Google ID token for our
 * client id and returns the identity. Replacing Google touches only this file.
 */
export async function verifyGoogleIdToken(idToken) {
  const { GOOGLE_CLIENT_ID } = getEnv();
  if (!GOOGLE_CLIENT_ID) {
    throw new AppError('SERVICE_UNAVAILABLE', 'Google sign-in is not configured.');
  }
  client ??= new OAuth2Client(GOOGLE_CLIENT_ID);
  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: GOOGLE_CLIENT_ID });
    payload = ticket.getPayload();
  } catch {
    throw AppError.unauthenticated('Google sign-in could not be verified.');
  }
  if (!payload?.sub) throw AppError.unauthenticated('Google sign-in could not be verified.');
  return {
    googleId: payload.sub,
    email: payload.email,
    emailVerified: payload.email_verified === true,
    name: payload.name,
    picture: payload.picture,
  };
}
