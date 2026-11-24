import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod;

/** One in-memory MongoDB for the whole run; each test file uses its own database. */
export async function setup(project) {
  mongod = await MongoMemoryServer.create();
  project.provide('mongoUri', mongod.getUri());
}

export async function teardown() {
  await mongod?.stop();
}
