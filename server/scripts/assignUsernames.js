import mongoose from 'mongoose';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { connectDatabase } from '../config/db.js';
import { User } from '../models/index.js';

export async function assignMissingUsernames() {
  const users = User.find({ username: null }).cursor();
  let updated = 0;

  for await (const user of users) {
    if (!user.email) {
      console.warn(`Skipping user ${user.id}: email is unavailable for username generation.`);
      continue;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      user.username = await User.generateUniqueUsername(user.email);
      try {
        await user.save();
        updated += 1;
        break;
      } catch (error) {
        const usernameConflict = error.code === 11000 &&
          (error.keyPattern?.username || error.keyValue?.username);
        if (!usernameConflict || attempt === 4) throw error;
      }
    }
  }

  if (updated > 0) console.info(`Assigned usernames to ${updated} users.`);
  return updated;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    await connectDatabase();
    await assignMissingUsernames();
  } catch (error) {
    console.error('Username assignment failed:', error);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
  }
}
