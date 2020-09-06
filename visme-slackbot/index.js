// example from
// https://github.com/slackapi/node-slack-sdk
// cut

// https://slack.dev/node-slack-sdk/events-api


const app = require('express')();
const fs = require('fs');
const { createEventAdapter } = require('@slack/events-api');
const { WebClient } = require('@slack/web-api');

const chatbot = require('./chatbot');
const calendar = require('./google-calendar')
const faq = require('./faq');

const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
const slackEvents = createEventAdapter(slackSigningSecret);
const port = process.env.PORT || 3000;
const token = process.env.SLACK_TOKEN;
const web = new WebClient(token);
app.use('/slack/events', slackEvents.expressMiddleware());
app.use('/webhook', require('./webhook')(ask));

// Convert result from google-calendar to posted messages
function process_result(callback, result) {
  if (result.valid) {
    callback(result.data.map(r => `${r.title}, at ${r.start}   <${r.url}|[Calendar Link]>`).join(''));
  } else {
    callback(result.data);
  }
}

function check_validity(date, channelId) {
  if (isNaN(date.getTime())) {
    // date is not valid
    web.chat.postMessage({
      channel: channelId,
      blocks: [{
        "type": "section",
        "text": {
          "type": "mrkdwn",
          "text": "Date not recognised. Please select it here:"
        },
        "accessory": {
          "type": "datepicker",
          "placeholder": {
            "type": "plain_text",
            "text": "Select a date",
          }
        }
      }]
    });
  }
}

function ask(text, callback) {
  faq.ask(text, (err, answer) => {
    if (err || !answer) {
      fs.readFile('./credentials.json', (err, content) => {
        if (err) {
          callback("Error loading client secret file.");
          return console.log('Error loading client secret file:', err);
        }
        calendar.authorize(JSON.parse(content), (auth) => {
          const dates = chatbot.toJSDates(chatbot.getDates(text));
          if (dates.length) {
            if (dates.length == 1) {

              check_validity(dates[0], channelId);
              console.log("returned");

//               let day = chatbot.dayBounds(dates[0]);
//               calendar.getEvents(auth, day[0], day[1], r => process_result(channelId, r));
            } else if (dates.length == 2) {
              calendar.getEvents(auth, dates[0], dates[1], r => process_result(channelId, r));
            } else {
              callback("Too many dates! I don't know what to do.");
            }
          } else {
            const eventNames = chatbot.getSubjects(text);
            // ^^ returns [ 'Visma traditional breakfast', 'Yoga session' ]
            for (const eventName of eventNames) {
              // get event by eventName
              // exit on the most likely match
              // I don't know if this for loop is necessary, or if the getEventsByName returns many
            }
            callback('No events found!');
          }
        });
      });
    } else {
      callback(answer.answer);
    }
  });
}

// Attach listeners to events by Slack Event "type". See: https://api.slack.com/events/message.im
slackEvents.on('message', (event) => {
  if (event.channel_type != 'im') {
    return;
  }
  if (typeof event.bot_id != 'undefined' || typeof event.text == 'undefined')
  {
    return;
  }
  if (typeof event.text.length == 0)
  {
    return;
  }
  console.log(`message.im: ${event.text}`);
  const channelId = event.channel;
  ask(event.text, answer => web.chat.postMessage({ channel: channelId, text: answer }));
});

app.listen(port);
console.log(`Listening for events on ${port}`);

