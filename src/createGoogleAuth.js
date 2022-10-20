const fs = require('fs/promises');
const { google } = require('googleapis');

const config = require('../config');

async function createGoogleAuth() {
  const credentials = JSON.parse(await fs.readFile(config.google.credentialsFile, 'utf-8'));
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return client;
}

module.exports = { createGoogleAuth };
