const fs = require('fs');
const readline = require('readline');
const {google} = require('googleapis');

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = '../token.json';

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback) {
  const {client_secret, client_id, redirect_uris} = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
      client_id, client_secret, redirect_uris[0]);

  // Check if we have previously stored a token.
  fs.readFile(TOKEN_PATH, (err, token) => {
    if (err) return getAccessToken(oAuth2Client, callback);
    oAuth2Client.setCredentials(JSON.parse(token));
    callback(oAuth2Client);
  });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 * @param {google.auth.OAuth2} oAuth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback for the authorized client.
 */
function getAccessToken(oAuth2Client, callback) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  rl.question('Enter the code from that page here: ', (code) => {
    rl.close();
    oAuth2Client.getToken(code, (err, token) => {
      if (err) return console.error('Error retrieving access token', err);
      oAuth2Client.setCredentials(token);
      // Store the token to disk for later program executions
      fs.writeFile(TOKEN_PATH, JSON.stringify(token), (err) => {
        if (err) return console.error(err);
        console.log('Token stored to', TOKEN_PATH);
      });
      callback(oAuth2Client);
    });
  });
}

/**
 * Lists the next 10 events on the user's primary calendar.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 */
function listEvents(auth) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: 'primary',
    timeMin: (new Date()).toISOString(),
    maxResults: 10,
    singleEvents: true,
    orderBy: 'startTime',
  }, (err, res) => {
    if (err) return console.log('The API returned an error: ' + err);
    const events = res.data.items;
    if (events.length) {
      console.log('Upcoming 10 events:');
      events.map(printEvent);
    } else {
      console.log('No upcoming events found.');
    }
  });
}

//----------------------------------------------- my code is below
/**
 * Formats the output nicely.
 * @param {Event?} event The event to be printed.
 */
function returnEvent(event) {
  const start = event.start.dateTime || event.start.date;
  const url = event.htmlLink;
  return {'start': start, 'title': event.summary, 'url': url};
}

/**
 * Lists up to 10 events with an EXACTLY specified name.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {String} name The name of the event.
 */
function getEventsByNameAdv(auth, name, callback) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: 'primary',
    q: name,
    maxResults: 10,
  }, (err, res) => {
    if (err) {
      console.log("Error occurred: " + err);
      return;
    }
    const events = res.data.items;
    if (events.length == 0) {
      console.log("No events");
      return;
    } else {
      return callback(events.map(returnEvent));
    }
  });
}
// Cleaner version
function getEventsByName(name, callback) {
  fs.readFile('../credentials.json', (err, content) => {
    if (err) return console.log("Error loading client secret file: ", err);
    authorize(JSON.parse(content), (a) => getEventsByNameAdv(a, name, callback));
  })
}
// How to use: getEventsByName(NAME, (result) => { rest of program });
// result will be an object with values {'start': ..., 'title':..., 'url':...}


/**
 * Lists up to 10 events within a specified time period.
 * @param {google.auth.OAuth2} auth An authorized OAuth2 client.
 * @param {Date} from The first time for the time period.
 * @param {Date} from The final time for the time period.
 */
function getEventsAdv(auth, from, to, callback) {
  const calendar = google.calendar({version: 'v3', auth});
  calendar.events.list({
    calendarId: 'primary',
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    maxResults: 10,
    singleEvents: true,
  }, (err, res) => {
    if (err) {
      console.log("Error occurred: " + err);
      return;
    }
    const events = res.data.items;
    if (events.length == 0) {
      console.log("No events");
      return;
    } else {
      return callback(events.map(returnEvent));
    }
  });
}
// Cleaner version
function getEvents(from, to, callback) {
  fs.readFile('../credentials.json', (err, content) => {
    if (err) return console.log("Error loading client secret file: ", err);
    authorize(JSON.parse(content), (a) => getEventsAdv(a, from, to, callback));
  })
}
// How to use: getEvents(FROM, TO, (result) => { rest of program });
// result will be an object with values {'start': ..., 'title':..., 'url':...}


// HOW TO RUN CODE ATM
// just change where it says 'here'.
// i've put in an 'auth' which is passed in as a.
fs.readFile('../credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err);
  authorize(JSON.parse(content), (a) => {

    // here

//     listEvents(a)
//    getEvents(a, new Date("2020-09-07T17:30:00+01:00"), new Date("2020-09-10T17:30:00+01:01"), console.log)
//    getEventsByName(a, "Visma Yoga", console.log);
  });
});

module.exports = {
  getEventsByName,
  getEvents
};
