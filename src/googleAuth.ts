import fs from 'fs/promises';
import debug from 'debug';
import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import http from 'http';
import open from 'open';
import serverDestroy from 'server-destroy';
import envPaths from 'env-paths';
import makeDir from 'make-dir';
import path from 'path';

// Default keys configuration.
// It is not possible to keep client secret securely in native applications;
// therefore we just expose these configurations in the source client.
// (While MITM is possible with revealed client secret, this is ignorable)
const DEFAULT_KEYS = {
  web: {
    client_id: '491230429507-g47q0n19mc23a1nc6pq06ptuhbl3hu1k.apps.googleusercontent.com',
    project_id: 'i18next-sheet-sync',
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_secret: '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',
    redirect_uris: ['http://localhost:48192/oauth2callback'],
  }
};

const debugLog = debug('i18next-google-sheet:googleAuth');

export async function createGoogleAuth(
  credentials_file?: string,
  credentials_json?: string,
  oauth_client_file?: string,
) {
  let credentials;
  if (credentials_file != null) {
    credentials = JSON.parse(await fs.readFile(credentials_file, 'utf-8'));
  } else if (credentials_json != null) {
    credentials = JSON.parse(credentials_json);
  } else {
    debugLog('Credentials file or json is not specified; Using OAuth Login');
    return createGoogleAuthOAuth(oauth_client_file);
  }
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  const client = await auth.getClient();
  return client;
}

export async function createGoogleAuthOAuth(
  oauth_client_file?: string,
): Promise<OAuth2Client> {
  let keys: any;
  if (oauth_client_file != null) {
    keys = JSON.parse(await fs.readFile(oauth_client_file, 'utf-8'));
  } else {
    keys = DEFAULT_KEYS;
  }
  const client = new OAuth2Client(
    keys.web.client_id,
    keys.web.client_secret,
    keys.web.redirect_uris[0],
  );
  // Scan config directory to check if tokens are stored before
  const paths = envPaths('i18next-google-sheet');
  const configDir = paths.config;
  const credentialsFilePath = path.resolve(configDir, 'credentials.json');
  await makeDir(configDir);
  let initialCredentials: Record<string, string> = {};
  client.on('tokens', async (tokens) => {
    debugLog('Saving credentials');
    await fs.writeFile(credentialsFilePath, JSON.stringify({
      ...initialCredentials,
      ...tokens,
    }), 'utf-8');
    debugLog('Credentials saved');
  });
  try {
    const file = await fs.readFile(credentialsFilePath, 'utf-8');
    const credentials = JSON.parse(file);
    initialCredentials = credentials;
    client.setCredentials(credentials);
    await client.request({
      method: 'POST',
      url: 'https://oauth2.googleapis.com/tokeninfo',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    // Assume the credentials are correct
    return client;
  } catch (e) {
    // Bailing out
    debugLog('Saved credentials do not exist or are invalid; skipping to login process');
  }
  return new Promise((resolve, reject) => {
    const PORT = 48192;
    const server = http
      .createServer(async (req, res) => {
        try {
          if (req.url!.indexOf('/oauth2callback') > -1) {
            // Acquire the code from the querystring, and close the web server.
            const qs = new URL(req.url!, 'http://localhost:' + PORT)
              .searchParams;
            const code = qs.get('code')!;
            res.end('Authentication successful! Please return to the console.');
            server.destroy();

            // Now that we have the code, use that to acquire tokens.
            const r = await client.getToken(code);

            // Make sure to set the credentials on the OAuth2 client.
            client.setCredentials(r.tokens);
            resolve(client);
          }
        } catch (e) {
          reject(e);
        }
      })
      .listen(PORT, () => {
        const authorize_url = client.generateAuthUrl({
          access_type: 'offline',
          scope: ['https://www.googleapis.com/auth/spreadsheets'],
          prompt: 'consent',
        });
        // open the browser to the authorize url to start the workflow
        console.log('Please continue to following URL:', authorize_url);
        open(authorize_url, { wait: false }).then(cp => cp.unref());
      });
    serverDestroy(server);
  });
}
