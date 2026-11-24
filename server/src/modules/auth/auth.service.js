import * as usersService from '../users/users.service.js';
import { verifyGoogleIdToken } from '../../common/integrations/googleAuth.js';
import { AppError } from '../../common/errors/index.js';

// Unknown emails still pay the bcrypt cost (compared against a throwaway hash)
// so response timing doesn't reveal which emails are registered.
let dummyHashPromise;
const dummyHash = () => (dummyHashPromise ??= usersService.hashPassword(`dummy-${Date.now()}-${Math.random()}`));

function assertNotBlocked(user) {
  if (user.status === 'blocked') throw AppError.forbidden('This account has been blocked.');
}

export async function register(input) {
  const user = await usersService.createWithPassword(input);
  return user;
}

export async function login({ email, password }) {
  const user = await usersService.findByEmailWithPassword(email);
  const valid = await usersService.verifyPassword(password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !user.passwordHash || !valid) {
    throw AppError.unauthenticated('Email or password is incorrect.');
  }
  assertNotBlocked(user);
  return user;
}

export async function loginWithGoogle({ idToken }) {
  const identity = await verifyGoogleIdToken(idToken);
  const user = await usersService.findOrCreateFromGoogle(identity);
  assertNotBlocked(user);
  return user;
}

export async function me(userId) {
  return usersService.getSelf(userId);
}
