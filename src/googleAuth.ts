import fs from 'fs/promises';
import { google } from 'googleapis';

export async function createGoogleAuth(
  credentials_file?: string,
  credentials_json?: string,
) {
  let credentials;
  if (credentials_file != null) {
    credentials = JSON.parse(await fs.readFile(credentials_file, 'utf-8'));
  } else if (credentials_json != null) {
    credentials = JSON.parse(credentials_json);
  } else {
    throw new Error('Credentials file or json must be specified');
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return client;
}

